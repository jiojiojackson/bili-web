// Every Bilibili request originates on the user's device. There is no relay.
const PATHS={nav:'/x/web-interface/nav',feed:'/x/web-interface/wbi/index/top/feed/rcmd',feedLegacy:'/x/web-interface/index/top/feed/rcmd',popular:'/x/web-interface/popular',search:'/x/web-interface/search/type',view:'/x/web-interface/view',viewSigned:'/x/web-interface/wbi/view',play:'/x/player/playurl',playDash:'/x/player/wbi/playurl',related:'/x/web-interface/archive/related',following:'/x/polymer/web-dynamic/v1/feed/all'};
export function endpoint(route,params={}){
  if(!Object.hasOwn(PATHS,route))throw new Error('不支持的 B 站接口');
  const url=new URL(PATHS[route],'https://api.bilibili.com');
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
  return url.href;
}
export function assertLocalOrigin(host=location.hostname){if(!['www.bilibili.com','m.bilibili.com'].includes(host))throw new Error('请在 B 站页面内运行本地脚本')}
export async function request(route,params={}){
  assertLocalOrigin();const url=endpoint(route,params);
  let response;
  try{response=await fetch(url,{credentials:'include',cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin',signal:AbortSignal.timeout(18000)})}catch(error){
    // Safari Userscripts runs this locally through its extension if CORS blocks
    // native fetch. Never manually read cookies or send requests to a proxy.
    if(typeof GM==='undefined'||typeof GM.xmlHttpRequest!=='function')throw error;
    const r=await GM.xmlHttpRequest({method:'GET',url,timeout:18000,responseType:'text',headers:{Accept:'application/json',Referer:'https://www.bilibili.com/'}});
    if(r.status<200||r.status>=300)throw new Error(`B 站返回 ${r.status}`);
    return JSON.parse(r.responseText);
  }
  if(!response.ok)throw new Error(response.status===412?'B 站暂时限制了当前网络，请稍后再试':`B 站返回 ${response.status}`);
  return response.json();
}
