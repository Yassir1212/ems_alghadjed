const RIGHTS = ['users','roles','committees','news','gallery','team','applications','complaints','events','attendance','tasks','points','certificates','statistics','settings','audit','notifications'];
const DEFAULT = { supervisor:['news','gallery','team','applications','complaints','events','attendance','tasks','certificates','statistics','notifications'], vice:['news','gallery','team','applications','events','attendance','tasks','points','certificates','statistics'], coordinator:['news','gallery','events','attendance','tasks','notifications'], member:[] };
const KINDS=['news','gallery','team','committees','applications','complaints','events','attendance','tasks','certificates','settings'];
const PUBLIC=['news','gallery','team','committees','events'];
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const random=()=>crypto.randomUUID();
const salt=()=>crypto.getRandomValues(new Uint8Array(16));
async function passwordHash(pass,s){const key=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(s),iterations:210000,hash:'SHA-256'},key,256));}
const resp=(obj,status=200,headers={})=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const fail=(message,status=400)=>resp({error:message},status);
const safeParse=(x,fallback={})=>{try{return JSON.parse(x)}catch{return fallback}};
function has(u,right){return u?.role==='president' || (u && u.role!=='member' && (safeParse(u.permissions,[])||[]).includes(right));}
async function actor(req,env){const raw=(req.headers.get('cookie')||'').match(/(?:^|;\s*)ems_session=([^;]+)/)?.[1];if(!raw)return null;const token=decodeURIComponent(raw);if(!/^[a-f0-9-]{36}$/.test(token))return null;const s=await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>? AND u.enabled=1').bind(await digest(token),Date.now()).first();return s||null;}
function userSafe(u){return {id:u.id,username:u.username,name:u.name,role:u.role,committee:u.committee,permissions:u.role==='president'?RIGHTS:safeParse(u.permissions,[]),enabled:!!u.enabled};}
async function audit(env,u,action,detail=''){await env.DB.prepare('INSERT INTO audit(id,actor_id,action,detail) VALUES(?,?,?,?)').bind(random(),u?.id||null,action,String(detail).slice(0,300)).run();}
async function payload(req){if(Number(req.headers.get('content-length')||0)>100000)return null;try{return await req.json()}catch{return null}}
function validText(s,n=200){return typeof s==='string' && s.trim().length>0 && s.length<=n}
async function handler(req,env){const url=new URL(req.url),p=url.pathname,m=req.method;
 if(!p.startsWith('/api/')) return env.ASSETS.fetch(req);
 if(['POST','PUT','PATCH','DELETE'].includes(m)){const origin=req.headers.get('origin');if(origin && origin!==url.origin)return fail('طلب من موقع غير مسموح',403);if(req.headers.get('content-type')?.includes('text/plain'))return fail('نوع طلب غير مدعوم',415)}
 const u=await actor(req,env);
 if(p==='/api/setup-status'&&m==='GET'){const row=await env.DB.prepare("SELECT id FROM users WHERE role='president' LIMIT 1").first();return resp({needsSetup:!row})}
 if(p==='/api/setup'&&m==='POST'){
  const data=await payload(req);if(!data||!env.BOOTSTRAP_KEY||data.key!==env.BOOTSTRAP_KEY)return fail('رمز التأسيس غير صحيح',403);
  const existing=await env.DB.prepare("SELECT id FROM users WHERE role='president' LIMIT 1").first();if(existing)return fail('تم إنشاء الرئيس مسبقاً',409);
  if(!validText(data.password,128)||data.password.length<14)return fail('اختر كلمة مرور لا تقل عن 14 حرفاً');
  const s=hex(salt()),id=random();await env.DB.prepare('INSERT INTO users(id,username,name,role,salt,password_hash,permissions) VALUES(?,?,?,?,?,?,?)').bind(id,'president','رئيس النادي','president',s,await passwordHash(data.password,s),'[]').run();await audit(env,{id},'setup','created president');return resp({ok:true,username:'president'});
 }
 if(p==='/api/login'&&m==='POST'){
  const data=await payload(req);if(!data||!validText(data.username,64)||!validText(data.password,128))return fail('أدخل اسم المستخدم وكلمة المرور');
  const account=await env.DB.prepare('SELECT * FROM users WHERE username=? AND enabled=1').bind(data.username).first();
  const s=account?.salt || '00000000000000000000000000000000';const hash=await passwordHash(data.password,s);
  if(!account||hash!==account.password_hash)return fail('بيانات الدخول غير صحيحة',401);
  const session=random();await env.DB.prepare('INSERT INTO sessions(id_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(session),account.id,Date.now()+7*86400000).run();await audit(env,account,'login');
  return resp({ok:true,user:userSafe(account)},200,{'set-cookie':`ems_session=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=604800`});
 }
 if(p==='/api/logout'&&m==='POST'){const token=(req.headers.get('cookie')||'').match(/ems_session=([^;]+)/)?.[1];if(token)await env.DB.prepare('DELETE FROM sessions WHERE id_hash=?').bind(await digest(decodeURIComponent(token))).run();return resp({ok:true},200,{'set-cookie':'ems_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'})}
 if(p==='/api/me'&&m==='GET')return resp({user:u?userSafe(u):null});
 if(p==='/api/rights'&&m==='GET')return resp({roles:['president','supervisor','vice','coordinator','member'],rights:RIGHTS,default:DEFAULT});
 if(p==='/api/users'){
  if(!u||!has(u,'users'))return fail('غير مخول',403);
  if(m==='GET'){const rows=await env.DB.prepare('SELECT id,username,name,role,committee,permissions,enabled,created_at FROM users ORDER BY created_at DESC LIMIT 250').all();return resp({rows:rows.results.map(userSafe)});}
  if(m==='POST'){
   const d=await payload(req);if(!d||!validText(d.username,40)||!/^\w{3,40}$/.test(d.username)||!validText(d.name,100)||!validText(d.password,128)||d.password.length<12)return fail('راجع البيانات؛ كلمة المرور 12 حرفاً على الأقل');
   const role=['supervisor','vice','coordinator','member'].includes(d.role)?d.role:'member';const perms=Array.isArray(d.permissions)?d.permissions.filter(x=>RIGHTS.includes(x)&&x!=='users'&&x!=='roles'&&x!=='audit'):DEFAULT[role];
   const s=hex(salt());try{await env.DB.prepare('INSERT INTO users(id,username,name,role,committee,salt,password_hash,permissions) VALUES(?,?,?,?,?,?,?,?)').bind(random(),d.username.toLowerCase(),d.name,role,String(d.committee||'').slice(0,100),s,await passwordHash(d.password,s),JSON.stringify(perms)).run();await audit(env,u,'create_user',d.username);return resp({ok:true})}catch{return fail('اسم المستخدم مستخدم أو حصل خطأ',409)}
  }
 }
 if(p.startsWith('/api/users/') && u?.role==='president'){
  const id=p.split('/').at(-1);const target=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();if(!target)return fail('الحساب غير موجود',404);if(target.role==='president')return fail('حساب الرئيس محمي');
  if(m==='PATCH'){const d=await payload(req);if(!d)return fail('طلب غير صالح');const role=['supervisor','vice','coordinator','member'].includes(d.role)?d.role:target.role;const perms=Array.isArray(d.permissions)?d.permissions.filter(x=>RIGHTS.includes(x)&&!['users','roles','audit'].includes(x)):safeParse(target.permissions,[]);await env.DB.prepare('UPDATE users SET name=?,role=?,committee=?,permissions=?,enabled=? WHERE id=?').bind(String(d.name??target.name).slice(0,100),role,String(d.committee??target.committee).slice(0,100),JSON.stringify(perms),d.enabled===undefined?target.enabled:Number(!!d.enabled),id).run();await audit(env,u,'update_user',target.username);return resp({ok:true})}
  if(m==='DELETE'){await env.DB.prepare('UPDATE users SET enabled=0 WHERE id=?').bind(id).run();await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();await audit(env,u,'disable_user',target.username);return resp({ok:true})}
 }
 if(p==='/api/password'&&m==='POST'){
  if(!u)return fail('تحتاج تسجيل الدخول',401);const d=await payload(req);if(!d||!validText(d.oldPassword,128)||!validText(d.newPassword,128)||d.newPassword.length<12)return fail('راجع البيانات');if(await passwordHash(d.oldPassword,u.salt)!==u.password_hash)return fail('كلمة المرور الحالية غير صحيحة',401);const s=hex(salt());await env.DB.prepare('UPDATE users SET salt=?,password_hash=? WHERE id=?').bind(s,await passwordHash(d.newPassword,s),u.id).run();await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id).run();await audit(env,u,'change_password');return resp({ok:true});
 }
 if(p==='/api/points'&&m==='GET'){if(!u)return fail('تحتاج تسجيل الدخول',401);const rows=await env.DB.prepare('SELECT * FROM points WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(u.id).all();return resp({rows:rows.results,total:rows.results.reduce((a,r)=>a+r.amount,0)});}
 if(p==='/api/points'&&m==='POST'){if(!has(u,'points'))return fail('غير مخول',403);const d=await payload(req);if(!d||!validText(d.reason,200)||!Number.isInteger(d.amount)||Math.abs(d.amount)>200||!validText(d.user_id,60))return fail('بيانات غير صالحة');await env.DB.prepare('INSERT INTO points(id,user_id,amount,reason,actor_id) VALUES(?,?,?,?,?)').bind(random(),d.user_id,d.amount,d.reason,u.id).run();await audit(env,u,'points',d.user_id);return resp({ok:true})}
 if(p==='/api/notifications'&&m==='GET'){if(!u)return fail('تحتاج تسجيل الدخول',401);const rows=await env.DB.prepare('SELECT * FROM notifications WHERE user_id=? OR user_id IS NULL ORDER BY created_at DESC LIMIT 70').bind(u.id).all();return resp({rows:rows.results});}
 if(p==='/api/notifications'&&m==='POST'){if(!has(u,'notifications'))return fail('غير مخول',403);const d=await payload(req);if(!d||!validText(d.title,160))return fail('عنوان غير صالح');await env.DB.prepare('INSERT INTO notifications(id,user_id,title,body) VALUES(?,?,?,?)').bind(random(),d.user_id||null,d.title,String(d.body||'').slice(0,2000)).run();await audit(env,u,'notification');return resp({ok:true})}
 if(p==='/api/audit'&&m==='GET'){if(u?.role!=='president')return fail('غير مخول',403);return resp({rows:(await env.DB.prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 150').all()).results})}
 if(p==='/api/stats'&&m==='GET'){if(!has(u,'statistics'))return fail('غير مخول',403);const a=await env.DB.prepare('SELECT kind,COUNT(*) n FROM records GROUP BY kind').all();const b=await env.DB.prepare('SELECT COUNT(*) n FROM users WHERE enabled=1').first();return resp({records:a.results,users:b.n})}
 if(p==='/api/media'&&m==='POST'){
  if(!u||!(has(u,'gallery')||has(u,'team')))return fail('غير مخول',403);if(!env.MEDIA)return fail('يرجى تفعيل R2 أولاً',503);const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||file.size>3_000_000||!['image/jpeg','image/png','image/webp'].includes(file.type))return fail('اختر صورة JPG/PNG/WebP بحجم لا يتجاوز 3MB');const id=random();await env.MEDIA.put(id,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});await audit(env,u,'upload_image',id);return resp({url:'/api/media/'+id});
 }
 if(p.startsWith('/api/media/')&&m==='GET'){if(!env.MEDIA)return fail('رفع الصور غير مفعّل',404);const obj=await env.MEDIA.get(p.split('/').at(-1));if(!obj)return fail('الصورة غير موجودة',404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'application/octet-stream','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}})}
 const match=p.match(/^\/api\/records\/([a-z]+)(?:\/([a-f0-9-]+))?$/);if(match){const kind=match[1],id=match[2];if(!KINDS.includes(kind))return fail('قسم غير معروف',404);
  const right=kind==='committees'?'committees':kind==='settings'?'settings':kind;
  if(m==='GET'){
   if(!PUBLIC.includes(kind)&&!u)return fail('تحتاج تسجيل الدخول',401);
   if(kind==='complaints'&& !has(u,'complaints')){const rows=await env.DB.prepare("SELECT * FROM records WHERE kind=? AND author_id=? ORDER BY created_at DESC LIMIT 100").bind(kind,u.id).all();return resp({rows:rows.results.map(recordSafe)});}
   if(kind==='applications'&&!has(u,'applications')){const rows=await env.DB.prepare('SELECT * FROM records WHERE kind=? AND author_id=? ORDER BY created_at DESC LIMIT 100').bind(kind,u.id).all();return resp({rows:rows.results.map(recordSafe)});}
   if(!PUBLIC.includes(kind)&&!has(u,right))return fail('غير مخول',403);
   const rows=await env.DB.prepare('SELECT * FROM records WHERE kind=? ORDER BY created_at DESC LIMIT 150').bind(kind).all();return resp({rows:rows.results.map(recordSafe)});
  }
  if(m==='POST'){
   const submitting=['applications','complaints'].includes(kind)&&!!u;
   if(!has(u,right)&&!submitting)return fail('غير مخول',403);
   const d=await payload(req);if(!d||!validText(d.title,180))return fail('العنوان مطلوب');const data=typeof d.data==='object'&&d.data!==null?d.data:{};if(JSON.stringify(data).length>3000)return fail('البيانات طويلة جداً');
   const newId=random();await env.DB.prepare('INSERT INTO records(id,kind,title,body,data,status,author_id) VALUES(?,?,?,?,?,?,?)').bind(newId,kind,d.title,String(d.body||'').slice(0,4000),JSON.stringify(data),submitting?'pending':String(d.status||'active').slice(0,40),u?.id||null).run();await audit(env,u,'create_'+kind,newId);return resp({ok:true,id:newId});
  }
  if((m==='PATCH'||m==='DELETE')&&id){if(!has(u,right))return fail('غير مخول',403);const old=await env.DB.prepare('SELECT * FROM records WHERE id=? AND kind=?').bind(id,kind).first();if(!old)return fail('العنصر غير موجود',404);if(m==='DELETE')await env.DB.prepare('DELETE FROM records WHERE id=?').bind(id).run();else{const d=await payload(req);if(!d)return fail('طلب غير صالح');await env.DB.prepare('UPDATE records SET title=?,body=?,status=?,data=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(String(d.title??old.title).slice(0,180),String(d.body??old.body).slice(0,4000),String(d.status??old.status).slice(0,40),JSON.stringify(d.data??safeParse(old.data)),id).run();}await audit(env,u,m.toLowerCase()+'_'+kind,id);return resp({ok:true})}
 }
 return fail('الرابط غير موجود',404);
}
function recordSafe(r){return {...r,data:safeParse(r.data,{})}}
export default {async fetch(req,env){try{return await handler(req,env)}catch(err){console.error(err);return fail('حدث خطأ في الخادم. اطلب مراجعة سجلات Cloudflare لمعرفة السبب.',500)}}};
