import builtinActions from '../lib/builtin-actions.js';
import { randomUUID, createHash } from 'node:crypto';

const base = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const anon = () => process.env.SUPABASE_ANON_KEY;
const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = () => process.env.MARZENIA_ADMIN_EMAIL?.trim().toLowerCase();
const bucket = 'marzenia-photos';
const settingsId='00000000-0000-4000-8000-000000000099';
const defaultFacebook='https://www.facebook.com/profile.php?id=61567116359921';
const sessionName = 'marzenia_session';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const photoPath = new RegExp('^' + uuid + '\\.(jpg|png|webp)$');
const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function json(data, status = 200, headers = {}) {
  return Response.json(data, {status, headers: {'Cache-Control':'no-store', ...headers}});
}
function upstream(path, key, options = {}, token = key) {
  return fetch(base() + path, {...options, headers: {apikey:key, Authorization:'Bearer ' + token, ...options.headers}, signal:AbortSignal.timeout(15000)});
}
function post(body) {
  return {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)};
}
async function authorized(request) {
  const token = request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(sessionName+'='))?.slice(sessionName.length+1);
  if (!token || !admin()) return false;
  const result = await upstream('/auth/v1/user', anon(), {}, token);
  if (!result.ok) return false;
  const user = await result.json();
  return Boolean(user.email_confirmed_at && user.email?.toLowerCase() === admin());
}
async function login(request, path) {
  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  if (!admin() || email !== admin()) return json({error:'Brak dostępu do panelu.'},403);
  if (path.endsWith('/kod')) {
    const response = await upstream('/auth/v1/otp', anon(), post({email, create_user:false}));
    return response.ok ? json({ok:true}) : json({error:'Nie udało się wysłać kodu. Sprawdź konto i ustawienia poczty.'},429);
  }
  const token = String(body.token || '');
  if (!/^\d{6,10}$/.test(token)) return json({error:'Wpisz kod z wiadomości.'},400);
  const response = await upstream('/auth/v1/verify', anon(), post({email, token, type:'email'}));
  if (!response.ok) return json({error:'Kod jest nieprawidłowy lub wygasł.'},401);
  const session = await response.json();
  if (!session.access_token || !session.user?.email_confirmed_at || session.user.email?.toLowerCase() !== admin()) return json({error:'Brak dostępu do panelu.'},403);
  const maxAge = Math.min(3600, Math.max(0, Number(session.expires_in) || 3600));
  return json({ok:true},200,{'Set-Cookie':sessionName+'='+session.access_token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge});
}
async function upload(request) {
  const type = request.headers.get('content-type');
  const ext = types[type];
  if (!ext || Number(request.headers.get('content-length')) > 2097152) return json({error:'Zdjęcie musi być JPG, PNG lub WebP do 2 MB.'},400);
  const bytes = new Uint8Array(await request.arrayBuffer());
  const signature = new TextDecoder();
  const valid = ext==='jpg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255 : ext==='png' ? bytes[0]===137 && signature.decode(bytes.slice(1,4))==='PNG' : signature.decode(bytes.slice(0,4))==='RIFF' && signature.decode(bytes.slice(8,12))==='WEBP';
  if (!valid || bytes.length>2097152) return json({error:'Nieprawidłowy plik zdjęcia.'},400);
  const path = randomUUID()+'.'+ext;
  const response = await upstream('/storage/v1/object/'+bucket+'/'+path, service(), {method:'POST',headers:{'Content-Type':type},body:bytes});
  if (!response.ok) return json({error:'Nie udało się zapisać zdjęcia.'},502);
  return json({path},201);
}
const localPhotos = new Set(builtinActions.flatMap(a => a.photos.map(p => p.path)));
// Empty title and body mark a removed article, preventing legacy content from reappearing.
const isDeleted = article => article.title === '' && article.body === '';
const storedDate = date => date || '0001-01-01';
const visibleDate = date => date === '0001-01-01' ? '' : date;
function revision(article) {
  return createHash('sha256').update(JSON.stringify([article.title, article.date, article.body, article.photos])).digest('hex');
}
function withPhotos(article) {
  return {...article, date:visibleDate(article.date), photos:article.photos.map(p=>({...p, src:localPhotos.has(p.path) ? '/'+p.path : base()+'/storage/v1/object/public/'+bucket+'/'+p.path}))};
}
async function allArticles() {
  const response = await upstream('/rest/v1/marzenia_articles?select=*&id=neq.'+settingsId+'&order=date.desc,id&limit=1000',service());
  if (!response.ok) throw new Error('read');
  const rows = await response.json();
  // Fetch every page, including accounts with more than 1000 articles.
  for (let offset=1000; rows.length===offset; offset+=1000) {
    const next=await upstream('/rest/v1/marzenia_articles?select=*&id=neq.'+settingsId+'&order=date.desc,id&limit=1000&offset='+offset,service());
    if (!next.ok) throw new Error('read');
    const page=await next.json(); rows.push(...page); if(page.length<1000) break;
  }
  const ids = new Set(rows.map(a=>a.id));
  return [...rows.map(a=>({...a,deleted:isDeleted(a),revision:revision(a)})), ...builtinActions.filter(a=>!ids.has(a.id)).map(a=>({...a,builtin:true,revision:'builtin'}))]
    .sort((a,b)=>visibleDate(b.date).localeCompare(visibleDate(a.date)) || a.id.localeCompare(b.id));
}
async function publish(request, editing=false) {
  const data = await request.json();
  const title = String(data.title || '').trim(), body = String(data.body || '').trim(), date = String(data.date || '');
  const parsed = new Date(date);
  const photos = data.photos;
  if (!title || title.length>160 || !body || body.length>12000 || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date<'1900-01-01' || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10)!==date)) ||
      !Array.isArray(photos) || photos.length>10 || photos.some(p=>!p || !(photoPath.test(p.path) || localPhotos.has(p.path)) || typeof p.alt!=='string' || !p.alt.trim() || p.alt.length>250)) return json({error:'Sprawdź tytuł, datę, opis i podpisy zdjęć.'},400);
  const article={title,body,date:storedDate(date),photos:photos.map(p=>({path:p.path,alt:p.alt.trim()}))};
  let options=post(article), query='';
  if(editing) {
    if(data.id===settingsId || !new RegExp('^'+uuid+'$').test(data.id)) return json({error:'Nieprawidłowy wpis.'},400);
    const read=await upstream('/rest/v1/marzenia_articles?select=*&id=eq.'+data.id,service());
    if(!read.ok) throw new Error('read');
    const [current]=await read.json();
    if(current) {
      if(isDeleted(current)) return json({error:'Ten wpis został usunięty. Odśwież listę.'},404);
      if(data.revision!==revision(current)) return json({error:'Ten wpis został już zmieniony. Otwórz go ponownie z listy.'},409);
      const filters=new URLSearchParams({id:'eq.'+data.id,select:'id',title:'eq.'+current.title,body:'eq.'+current.body,date:'eq.'+current.date,photos:'eq.'+JSON.stringify(current.photos)});
      query='?'+filters;
      options={...post(article),method:'PATCH'};
    } else {
      if(data.revision!=='builtin' || !builtinActions.some(a=>a.id===data.id)) return json({error:'Nie znaleziono wpisu. Odśwież listę.'},404);
      options=post({...article,id:data.id});
    }
  }
  options.headers.Prefer='return=representation';
  const result = await upstream('/rest/v1/marzenia_articles'+query,service(),options);
  if(result.status===409) return json({error:'Ten wpis został już zmieniony. Otwórz go ponownie z listy.'},409);
  if(!result.ok) return json({error:'Nie udało się zapisać artykułu. Zachowaliśmy formularz; spróbuj ponownie.'},502);
  const saved=await result.json();
  if(!saved.length) return json({error:'Ten wpis został już zmieniony. Otwórz go ponownie z listy.'},409);
  return json({ok:true},editing?200:201);
}
async function removeArticle(request) {
  const data=await request.json();
  if(data.id===settingsId || typeof data.id!=='string' || !new RegExp('^'+uuid+'$').test(data.id)) return json({error:'Nieprawidłowy wpis.'},400);
  const read=await upstream('/rest/v1/marzenia_articles?select=*&id=eq.'+data.id,service());
  if(!read.ok) throw new Error('read');
  const [current]=await read.json();
  const builtin=builtinActions.find(a=>a.id===data.id);
  if(!current && !builtin) return json({ok:true});
  const article={...(current || builtin)};
  if(!isDeleted(article)) {
    if(data.revision!==(current ? revision(current) : 'builtin')) return json({error:'Wpis zmienił się od otwarcia listy. Odśwież listę przed usunięciem.'},409);
    // First remove the text and hide the article. Keep only pending file paths for retryable cleanup.
    const tombstone={title:'',body:'',date:storedDate(''),photos:article.photos.filter(p=>photoPath.test(p.path)).map(p=>({path:p.path,alt:''}))};
    let query='', options;
    if(current) {
      query='?'+new URLSearchParams({id:'eq.'+data.id,select:'id',title:'eq.'+current.title,body:'eq.'+current.body,date:'eq.'+current.date,photos:'eq.'+JSON.stringify(current.photos)});
      options={...post(tombstone),method:'PATCH'};
    } else options=post({...tombstone,id:data.id});
    options.headers.Prefer='return=representation';
    const removed=await upstream('/rest/v1/marzenia_articles'+query,service(),options);
    if(removed.status===409) return json({error:'Wpis zmienił się. Odśwież listę przed usunięciem.'},409);
    if(!removed.ok) return json({error:'Nie udało się usunąć wpisu. Spróbuj ponownie.'},502);
    if(!(await removed.json()).length) return json({error:'Wpis zmienił się. Odśwież listę przed usunięciem.'},409);
    article.photos=tombstone.photos;
  }
  if(!article.photos.length) return json({ok:true});
  try {
    // A photo used by another published article must stay available for that article.
    const referenced=new Set((await allArticles()).filter(a=>!isDeleted(a)).flatMap(a=>a.photos.map(p=>p.path)));
    const paths=[...new Set(article.photos.map(p=>p.path).filter(path=>photoPath.test(path) && !referenced.has(path)))];
    if(paths.length) {
      const files=await upstream('/storage/v1/object/'+bucket,service(),{...post({prefixes:paths}),method:'DELETE'});
      if(!files.ok) return json({ok:true,cleanupPending:true});
    }
    const cleared=await upstream('/rest/v1/marzenia_articles?id=eq.'+data.id,service(),{...post({photos:[]}),method:'PATCH'});
    return json({ok:true,...(!cleared.ok ? {cleanupPending:true} : {})});
  } catch {return json({ok:true,cleanupPending:true});}
}
function facebookUrl(value) {
  if(typeof value!=='string' || value.length>500) return null;
  try {
    const url=new URL(value.trim());
    if(url.protocol!=='https:' || !['facebook.com','www.facebook.com','m.facebook.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
    if(url.pathname==='/profile.php') {
      const id=url.searchParams.get('id');
      return /^\d{5,30}$/.test(id || '') ? 'https://www.facebook.com/profile.php?id='+id : null;
    }
    if(!/^\/[A-Za-z0-9._-]+\/?$/.test(url.pathname) && !/^\/(people|pages)\/[^/]+\/\d+\/?$/.test(url.pathname)) return null;
    if(/^\/(l.php|login|logout|dialog|sharer.php|plugins|checkpoint)(\/|$)/i.test(url.pathname)) return null;
    return 'https://www.facebook.com'+url.pathname;
  } catch {return null;}
}
async function readFacebook() {
  const response=await upstream('/rest/v1/marzenia_articles?select=body&id=eq.'+settingsId,service());
  if(!response.ok) throw new Error('settings');
  const [row]=await response.json();
  if(!row) return json({url:defaultFacebook,domain:''});
  const settings=JSON.parse(row.body);
  return json({url:facebookUrl(settings.facebookUrl) || defaultFacebook,domain:settings.domain || ''});
}
async function saveFacebook(request) {
  const data=await request.json();
  const url=facebookUrl(data?.url);
  if(!url) return json({error:'Wklej pełny adres strony Facebook, zaczynający się od https://www.facebook.com/.'},400);
  let domain='';
  if(typeof data.domain==='string' && data.domain.trim()) {
    try {
      const parsed=new URL('https://'+data.domain.trim().replace(/^https?:\/\//i,'').replace(/\/$/,''));
      domain=parsed.hostname.toLowerCase();
      if(parsed.username || parsed.password || parsed.port || parsed.pathname!=='/' || parsed.search || parsed.hash || domain.length>253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw new Error('domain');
    } catch {return json({error:'Wpisz poprawną domenę, np. stowarzyszeniemarzenia.pl, bez ścieżki do podstrony.'},400);}
  }
  const options=post({id:settingsId,title:'Ustawienia strony',body:JSON.stringify({facebookUrl:url,domain}),date:storedDate(''),photos:[]});
  options.headers.Prefer='resolution=merge-duplicates';
  const response=await upstream('/rest/v1/marzenia_articles?on_conflict=id',service(),options);
  return response.ok ? json({ok:true,url,domain}) : json({error:'Nie udało się zapisać adresów. Spróbuj ponownie.'},502);
}
export default {async fetch(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('route');
  let path = url.pathname;
  if (path === '/api/marzenia') {
    const id = url.searchParams.get('id');
    if (route === 'dzialania') path = '/api/dzialania' + (id ? '/' + id : '');
    if (route === 'admin') path = '/api/admin/' + url.searchParams.get('operation');
  }
  if (!base() || !anon() || !service() || !admin()) return json({error:'Panel wymaga konfiguracji Supabase i adresu administratora.'},503);
  try {
    if(request.method==='GET' && path==='/api/admin/facebook') return await readFacebook();
    if (request.method==='GET' && path==='/api/admin/sesja') return json({authorized:await authorized(request)});
    if(request.method==='GET' && path==='/api/admin/artykuly') {
      if(!await authorized(request)) return json({error:'Zaloguj się jako administrator.'},403);
      return json((await allArticles()).filter(a=>!a.deleted || a.photos.length).map(a=>a.deleted ? {id:a.id,deleted:true,revision:a.revision,title:'Usunięty wpis — dokończ usuwanie zdjęć',date:'',photos:[]} : withPhotos(a)));
    }
    if (request.method==='GET' && path.startsWith('/api/dzialania')) {
      const match=path.match(new RegExp('^/api/dzialania/('+uuid+')$'));
      if(!match && path!=='/api/dzialania') return json(null,404);
      if(!match) return json((await allArticles()).map(a=>(a.deleted ? {id:a.id,deleted:true} : {id:a.id,date:visibleDate(a.date),builtin:Boolean(a.builtin)})));
      if(match[1]===settingsId) return json(null,404);
      const response=await upstream('/rest/v1/marzenia_articles?select=*&id=eq.'+match[1],service());
      if(!response.ok) throw new Error('read');
      const rows=await response.json();
      const article=rows[0] || builtinActions.find(a=>a.id===match[1]);
      return article && !isDeleted(article) ? json(withPhotos(article)) : json(null,404);
    }
    if (request.method!=='POST') return json(null,405);
    if (request.headers.get('origin')!==url.origin) return json({error:'Nieprawidłowe źródło żądania.'},403);
    if (['/api/admin/kod','/api/admin/logowanie'].includes(path)) return await login(request,path);
    if (!await authorized(request)) return json({error:'Zaloguj się jako administrator.'},403);
    if (path==='/api/admin/zdjecie') return await upload(request);
    if (path==='/api/admin/wyloguj') return json({ok:true},200,{'Set-Cookie':sessionName+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
    if(path==='/api/admin/facebook') return await saveFacebook(request);
    if (path==='/api/admin/usun') return await removeArticle(request);
    if (path==='/api/admin/edycja') return await publish(request,true);
    if (path==='/api/dzialania') return await publish(request);
    return json(null,404);
  } catch {
    return json({error:'Usługa chwilowo niedostępna. Spróbuj ponownie.'},502);
  }
}};
