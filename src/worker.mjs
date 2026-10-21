// Stateless, read-only Bilibili relay. No KV, database, cookies, or request logging.
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const ROUTES={
  nav:['api.bilibili.com','/x/web-interface/nav'],
  feed:['api.bilibili.com','/x/web-interface/wbi/index/top/feed/rcmd'],
  feedLegacy:['api.bilibili.com','/x/web-interface/index/top/feed/rcmd'],
  popular:['api.bilibili.com','/x/web-interface/popular'],
  search:['api.bilibili.com','/x/web-interface/search/type'],
  view:['api.bilibili.com','/x/web-interface/view'],
  viewSigned:['api.bilibili.com','/x/web-interface/wbi/view'],
  play:['api.bilibili.com','/x/player/playurl'],
  related:['api.bilibili.com','/x/web-interface/archive/related'],
  following:['api.bilibili.com','/x/polymer/web-dynamic/v1/feed/all'],
  qrGenerate:['passport.bilibili.com','/x/passport-login/web/qrcode/generate'],
  qrPoll:['passport.bilibili.com','/x/passport-login/web/qrcode/poll']
};
const COOKIE_NAMES=new Set(['SESSDATA','bili_jct','DedeUserID','DedeUserID__ckMd5','sid','buvid3','buvid4','b_nut']);
const DEVICE_NAMES=new Set(['buvid3','buvid4','b_nut']);
const SECURITY={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store, private','Vary':'Origin'};
export function cleanCookie(raw=''){
  return String(raw).split(';').map(p=>p.trim()).filter(p=>{const i=p.indexOf('=');return i>0&&COOKIE_NAMES.has(p.slice(0,i))&&!/[\r\n\x00-\x1f]/.test(p)&&p.length<4096}).join('; ');
}
export function allowedMedia(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(/\.(bilivideo\.com|bilivideo\.cn|bilivideo\.net|hdslb\.com)$/.test(u.hostname))}catch{return false}}
function json(data,status=200){return Response.json(data,{status,headers:SECURITY})}
async function relay(request){
  const origin=new URL(request.url).origin;
  if(request.headers.get('Origin')!==origin)return json({code:-403,message:'仅允许本站请求'},403);
  if(request.method!=='POST'||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({code:-405,message:'请使用 JSON POST'},405);
  if(Number(request.headers.get('Content-Length'))>16384)return json({code:-413,message:'请求过大'},413);
  const raw=await request.text();
  if(raw.length>16384)return json({code:-413,message:'请求过大'},413);
  let body;try{body=JSON.parse(raw)}catch{return json({code:-400,message:'无效请求'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body)||body.params!==undefined&&(!body.params||typeof body.params!=='object'||Array.isArray(body.params)))return json({code:-400,message:'无效请求'},400);
  const clientUA=request.headers.get('User-Agent')||'';
  const headers={'User-Agent':/^Mozilla\//.test(clientUA)&&clientUA.length<512?clientUA:UA,'Referer':'https://www.bilibili.com/','Origin':'https://www.bilibili.com','Accept':'application/json','Accept-Language':'zh-CN,zh;q=0.9'};
  if(body.route==='device'){
    try{
      const home=await fetch('https://www.bilibili.com/',{headers:{...headers,Accept:'text/html'},redirect:'manual',signal:AbortSignal.timeout(12000)});
      const cookies=(home.headers.getSetCookie?.()||[]).map(c=>c.split(';')[0]).filter(c=>DEVICE_NAMES.has(c.split('=')[0]));
      await home.body?.cancel();
      if(!cookies.some(c=>c.startsWith('buvid3='))){const r=await fetch('https://api.bilibili.com/x/frontend/finger/spi',{headers,redirect:'manual',signal:AbortSignal.timeout(10000)});if(r.ok){const d=await r.json();if(d.data?.b_3)cookies.push(`buvid3=${d.data.b_3}`);if(d.data?.b_4)cookies.push(`buvid4=${d.data.b_4}`)}}
      if(!cookies.some(c=>c.startsWith('b_nut=')))cookies.push(`b_nut=${Math.floor(Date.now()/1000)}`);
      return json({code:0,data:{cookie:cleanCookie(cookies.join('; '))}});
    }catch{return json({code:-502,message:'游客会话初始化失败，请稍后重试'},502)}
  }
  const route=ROUTES[body.route];
  if(!route)return json({code:-404,message:'接口不存在'},404);
  const target=new URL(`https://${route[0]}${route[1]}`);
  for(const [key,value] of Object.entries(body.params||{})){
    if(!/^[a-zA-Z0-9_]{1,40}$/.test(key)||!['string','number','boolean'].includes(typeof value)||String(value).length>2500)return json({code:-400,message:'参数无效'},400);
    target.searchParams.set(key,String(value));
  }
  let cookie=cleanCookie(body.cookie);if(body.route.startsWith('qr'))cookie=cookie.split('; ').filter(c=>DEVICE_NAMES.has(c.split('=')[0])).join('; ');if(cookie)headers.Cookie=cookie;
  try{
    const response=await fetch(target,{headers,redirect:'manual',signal:AbortSignal.timeout(18000)});
    if(!response.ok)return json({code:response.status===412?-412:-502,message:response.status===412?'B 站暂时限制了此网络的请求，请稍后重试':'B 站接口暂时不可用'},502);
    const data=await response.json();
    if(body.route==='qrPoll'&&data.data){
      if(data.data.code===0){
        const cookies=(response.headers.getSetCookie?.()||[]).map(c=>c.split(';')[0]);
        // Some upstreams also include the approved login cookies in the callback URL.
        try{for(const [k,v] of new URL(data.data.url).searchParams)if(COOKIE_NAMES.has(k))cookies.push(`${k}=${v}`)}catch{}
        const entries=new Map();for(const c of cookies){const i=c.indexOf('=');if(i>0)entries.set(c.slice(0,i),c.slice(i+1))}
        const approved=cleanCookie([...entries].map(([k,v])=>`${k}=${v}`).join('; '));
        if(approved.includes('SESSDATA='))data.data.session=approved;
      }
      delete data.data.url;delete data.data.refresh_token;
    }
    return json(data);
  }catch(e){return json({code:-502,message:['localhost','127.0.0.1'].includes(new URL(request.url).hostname)?`本地网络连接失败：${e.message}`:'暂时连不上 B 站，请检查网络后重试'},502)}
}
async function media(request){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
  const u=new URL(request.url);const target=u.searchParams.get('url');
  if(!allowedMedia(target))return new Response('Invalid media host',{status:400});
  // No account credentials are ever forwarded to CDN hosts.
  const headers={'User-Agent':UA,'Referer':'https://www.bilibili.com/'};
  const range=request.headers.get('Range');if(range&&/^bytes=\d*-\d*$/.test(range))headers.Range=range;
  try{
    let response=await fetch(target,{headers,method:request.method,redirect:'manual',signal:AbortSignal.timeout(25000)});
    if(response.status>=300&&response.status<400){const next=new URL(response.headers.get('Location'),target).href;if(!allowedMedia(next))return new Response('Invalid redirect',{status:403});response=await fetch(next,{headers,method:request.method,redirect:'manual',signal:AbortSignal.timeout(25000)})}
    const out=new Headers({'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    for(const h of ['Content-Type','Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(h))out.set(h,response.headers.get(h));
    return new Response(response.body,{status:response.status,headers:out});
  }catch{return new Response('Media temporarily unavailable',{status:502})}
}
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/bili')return relay(request);
  if(path==='/api/health')return json({ok:true,service:'bili-web',storage:'browser-only'});
  if(path.startsWith('/api/'))return json({code:-404,message:'接口不存在'},404);
  if(path==='/media')return media(request);
  return env.ASSETS.fetch(request);
}};
