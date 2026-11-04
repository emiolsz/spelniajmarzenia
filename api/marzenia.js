import { randomUUID } from 'node:crypto';

const base = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const anon = () => process.env.SUPABASE_ANON_KEY;
const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = () => process.env.MARZENIA_ADMIN_EMAIL?.trim().toLowerCase();
const bucket = 'marzenia-photos';
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
async function publish(request) {
  const data = await request.json();
  const title = String(data.title || '').trim(), body = String(data.body || '').trim(), date = String(data.date || '');
  const parsed = new Date(date);
  const photos = data.photos;
  if (!title || title.length>160 || !body || body.length>12000 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date<'1900-01-01' || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10)!==date ||
      !Array.isArray(photos) || photos.length>10 || photos.some(p=>!p || !photoPath.test(p.path) || typeof p.alt!=='string' || !p.alt.trim() || p.alt.length>250)) return json({error:'Sprawdź tytuł, datę, opis i podpisy zdjęć.'},400);
  const result = await upstream('/rest/v1/marzenia_articles',service(),post({title,body,date,photos}));
  return result.ok ? json({ok:true},201) : json({error:'Nie udało się zapisać artykułu.'},502);
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
    if (request.method==='GET' && path==='/api/admin/sesja') return json({authorized:await authorized(request)});
    if (request.method==='GET' && path.startsWith('/api/dzialania')) {
      const match = path.match(new RegExp('^/api/dzialania/('+uuid+')$'));
      if (!match && path!=='/api/dzialania') return json(null,404);
      const query = match ? '?select=*&id=eq.'+match[1] : '?select=id,date&order=date.desc';
      const response = await upstream('/rest/v1/marzenia_articles'+query,service());
      if (!response.ok) return json({error:'Nie udało się odczytać wpisów.'},502);
      const rows = await response.json();
      if (!match) return json(rows);
      if (!rows.length) return json(null,404);
      const article = rows[0];
      return json({...article, photos:article.photos.map(p=>({alt:p.alt,src:base()+'/storage/v1/object/public/'+bucket+'/'+p.path}))});
    }
    if (request.method!=='POST') return json(null,405);
    if (request.headers.get('origin')!==url.origin) return json({error:'Nieprawidłowe źródło żądania.'},403);
    if (['/api/admin/kod','/api/admin/logowanie'].includes(path)) return await login(request,path);
    if (!await authorized(request)) return json({error:'Zaloguj się jako administrator.'},403);
    if (path==='/api/admin/zdjecie') return await upload(request);
    if (path==='/api/admin/wyloguj') return json({ok:true},200,{'Set-Cookie':sessionName+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
    if (path==='/api/dzialania') return await publish(request);
    return json(null,404);
  } catch {
    return json({error:'Usługa chwilowo niedostępna. Spróbuj ponownie.'},502);
  }
}};
