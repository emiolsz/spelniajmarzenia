import assert from 'node:assert/strict';import api from '../api/marzenia.js';
Object.assign(process.env,{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',MARZENIA_ADMIN_EMAIL:'admin@test.pl'});
let settings=null;
global.fetch=async(url,options={})=>{
 const u=new URL(url);
 if(u.pathname==='/auth/v1/user')return Response.json({email:'admin@test.pl',email_confirmed_at:'yes'});
 if(options.method==='POST'){settings=JSON.parse(options.body);return new Response(null,{status:201});}
 return Response.json(u.searchParams.get('id')?.startsWith('neq.')?[]:settings?[settings]:[]);
};
const call=(data,auth=true)=>api.fetch(new Request('https://site.test/api/admin/facebook',{method:data?'POST':'GET',headers:{origin:'https://site.test','content-type':'application/json',...(auth?{cookie:'marzenia_session=x'}:{})},...(data?{body:JSON.stringify(data)}:{})}));
assert.match((await(await call()).json()).url,/facebook.com/);
assert.equal((await call({url:'https://facebook.com/test'},false)).status,403);
for(const url of ['https://evil.test','javascript:alert(1)','https://facebook.com.evil.test/test','https://facebook.com/l.php?u=https://evil.test'])assert.equal((await call({url})).status,400);
assert.equal((await call({url:'https://m.facebook.com/MarzeniaTest/'})).status,200);
assert.equal((await(await call()).json()).url,'https://www.facebook.com/MarzeniaTest/');
const list=await(await api.fetch(new Request('https://site.test/api/dzialania'))).json();assert.equal(list.length,5);assert.equal(list.some(a=>a.id===settings.id),false);
assert.equal((await api.fetch(new Request('https://site.test/api/dzialania/'+settings.id))).status,404);
console.log('PASS Facebook: public address, protected write, reject external URLs, save/reload, exclude settings from articles');
