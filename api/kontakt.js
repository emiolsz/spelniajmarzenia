import nodemailer from 'nodemailer';

const recipient='stowarzyszeniemarzenia@gmail.com';
const topics=new Set(['Pytanie ogólne','Szukam pomocy','Współpraca dla firm']);
const attempts=new Map();
const configured=()=>Boolean(process.env.BREVO_SMTP_KEY?.trim());
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

// Keep SMTP credentials on the server; visitor addresses are only used as Reply-To.
export function createHandler(send = sendMessage) {
  return async function(request) {
    if(request.method==='GET') return json({available:configured()});
    if(request.method!=='POST') return json({error:'Niedozwolona metoda.'},405);
    if(request.headers.get('origin')!==new URL(request.url).origin) return json({error:'Odśwież stronę i spróbuj ponownie.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'Nieprawidłowy formularz.'},415);
    if(!configured()) return json({error:'Formularz jest chwilowo niedostępny. Napisz na '+recipient+'.'},503);
    try {
      const raw=await request.text();
      if(new TextEncoder().encode(raw).length>45000) return json({error:'Wiadomość jest zbyt długa.'},413);
      let data;
      try {data=JSON.parse(raw);} catch {return json({error:'Nieprawidłowy formularz.'},400);}
      if(!data || typeof data!=='object') return json({error:'Nieprawidłowy formularz.'},400);
      if(data.website) return json({error:'Nie udało się wysłać wiadomości.'},400);
      const email=typeof data.email==='string' ? data.email.trim() : '';
      const message=typeof data.message==='string' ? data.message.trim() : '';
      if(email.length>254 || !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email) || !message || message.length>10000 || !topics.has(data.topic)) return json({error:'Sprawdź adres e-mail, temat i treść wiadomości.'},400);
      // Best-effort per-instance throttling, in addition to the hidden spam field.
      const ip=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
      const now=Date.now();
      for(const [key,item] of attempts) if(item.until<=now) attempts.delete(key);
      const previous=attempts.get(ip);
      if(previous?.count>=5) return json({error:'Wysłano zbyt wiele wiadomości. Spróbuj ponownie za godzinę.'},429);
      if(attempts.size>=10000 && !previous) return json({error:'Spróbuj ponownie później.'},429);
      attempts.set(ip,{count:(previous?.count || 0)+1,until:previous?.until || now+3600000});
      await send({email,topic:data.topic,message});
      return json({ok:true});
    } catch {
      return json({error:'Nie udało się potwierdzić wysłania wiadomości. Treść pozostała w formularzu. Możesz napisać bezpośrednio na '+recipient+'.'},502);
    }
  };
}
async function sendMessage({email,topic,message}) {
  const transport=nodemailer.createTransport({host:'smtp-relay.brevo.com',port:587,secure:false,requireTLS:true,auth:{user:'be269e001@smtp-brevo.com',pass:process.env.BREVO_SMTP_KEY.trim()},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
  try {
    const result=await transport.sendMail({from:{name:'Stowarzyszenie Marzenia',address:'emikon888@gmail.com'},to:recipient,replyTo:email,subject:'Formularz kontaktowy — '+topic,text:message+'\n\nE-mail do odpowiedzi: '+email,disableFileAccess:true,disableUrlAccess:true});
    if(!result.accepted?.includes(recipient)) throw new Error('Recipient rejected');
  } finally {transport.close();}
}
export default {fetch:createHandler()};
