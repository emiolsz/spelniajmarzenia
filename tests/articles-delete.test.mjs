import assert from 'node:assert/strict';
import api from '../api/marzenia.js';
Object.assign(process.env,{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',MARZENIA_ADMIN_EMAIL:'admin@test.pl'});
const id='11111111-1111-4111-8111-111111111111', photo='22222222-2222-4222-8222-222222222222.jpg';
let rows=[{id,title:'Wpis',date:'2026-11-10',body:'Treść',photos:[{path:photo,alt:'Zdjęcie'}]}], deletes=[],failStorage=false,writes=0;
global.fetch=async(url,options={})=>{
 const u=new URL(url);
 if(u.pathname==='/auth/v1/user') return Response.json({email:'admin@test.pl',email_confirmed_at:'2026-01-01'});
 if(u.pathname.startsWith('/storage/')) {deletes.push(JSON.parse(options.body).prefixes);return Response.json({}, {status:failStorage?500:200});}
 if(u.pathname.startsWith('/rest/')) {
  const current=u.searchParams.get('id')?rows.filter(a=>a.id===u.searchParams.get('id').slice(3)):rows;
  if(options.method==='PATCH'){writes++; const data=JSON.parse(options.body);current.forEach(a=>Object.assign(a,data));return Response.json(current);}
  if(options.method==='POST'){writes++;const data=JSON.parse(options.body);rows.push(data);return Response.json([data],{status:201});}
  return Response.json(current);
 }throw Error(url);
};
const call=(path,data,auth=true,origin='https://site.test')=>api.fetch(new Request('https://site.test'+path,{method:data?'POST':'GET',headers:{origin,...(auth?{cookie:'marzenia_session=test'}:{}),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}));
let article=(await(await call('/api/admin/artykuly')).json()).find(a=>a.id===id);
assert.equal((await call('/api/admin/usun',article,false)).status,403);assert.equal(writes,0);
assert.equal((await call('/api/admin/usun',article,true,'https://evil.test')).status,403);
assert.equal((await call('/api/admin/usun',{...article,revision:'stale'})).status,409);
failStorage=true;assert.equal((await(await call('/api/admin/usun',article)).json()).cleanupPending,true);
assert.equal(rows[0].body,'');assert.equal(rows[0].title,'');assert.equal((await call('/api/dzialania/'+id)).status,404);
assert.equal((await(await call('/api/admin/artykuly')).json()).find(a=>a.id===id).deleted,true);
failStorage=false;assert.equal((await call('/api/admin/usun',article)).status,200);assert.deepEqual(rows[0].photos,[]);
assert.equal((await(await call('/api/admin/artykuly')).json()).some(a=>a.id===id),false);
assert.equal((await call('/api/admin/edycja',article)).status,404);
let builtin=(await(await call('/api/admin/artykuly')).json()).find(a=>a.title==='Wiosenne recytowanie');
assert.equal((await call('/api/admin/usun',builtin)).status,200);
assert.equal((await call('/api/dzialania/'+builtin.id)).status,404);
assert.equal((await(await call('/api/dzialania')).json()).find(a=>a.id===builtin.id).deleted,true);
// Shared file is retained for the other active article.
rows=[{...article,photos:[{path:photo,alt:'x'}]},{...article,id:'33333333-3333-4333-8333-333333333333',photos:[{path:photo,alt:'y'}]}];deletes=[];
article=(await(await call('/api/admin/artykuly')).json()).find(a=>a.id===id);
assert.equal((await call('/api/admin/usun',article)).status,200);assert.equal(deletes.length,0);assert.equal(rows[1].photos.length,1);
console.log('PASS: auth, origin, stale revision, delete text and photo, cleanup failure/retry, legacy deletion persists, prevent resurrection, preserve shared image');
