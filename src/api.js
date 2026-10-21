import {md5} from 'js-md5';
import {request} from './transport.js';
export let session=false;
export const setSession=value=>{session=!!value};
let wbiKey='',keyTime=0;
export class BiliError extends Error{constructor(message,code){super(message);this.code=code}}
export async function api(route,params={}){
  let data;try{data=await request(route,params)}catch(e){throw new BiliError(e.name==='TimeoutError'?'请求超时，轻点重试':e.message||'暂时连不上 B 站，请检查网络',-502)}
  if(route==='nav'&&data.code===-101&&data.data)return data.data;
  if(data.code!==0)throw new BiliError(data.code===-101?'登录已过期，请使用官方登录':data.code===-412?'B 站暂时限制了当前网络，请稍后重试':data.message||'请求失败',data.code);
  return data.data??data.result;
}
const MIXIN=[46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
export async function signed(params){
  if(!wbiKey||Date.now()-keyTime>1800000){const nav=await api('nav',{},false).catch(e=>{if(e.code===-101)return null;throw e});if(nav?.wbi_img){const key=[nav.wbi_img.img_url,nav.wbi_img.sub_url].map(u=>u.slice(u.lastIndexOf('/')+1,u.lastIndexOf('.'))).join('');wbiKey=MIXIN.map(i=>key[i]).join('').slice(0,32);keyTime=Date.now()}}
  if(!wbiKey)return params;
  const clean={...params,wts:Math.floor(Date.now()/1000)};
  const query=Object.keys(clean).sort().map(k=>{clean[k]=String(clean[k]).replace(/[!'()*]/g,'');return `${encodeURIComponent(k)}=${encodeURIComponent(clean[k])}`}).join('&');
  return {...clean,w_rid:md5(query+wbiKey)};
}
export const https=u=>typeof u==='string'?u.replace(/^http:/,'https:').replace(/^\/\//,'https://'):'';
export function normalize(v){
  if(!v)return null;
  if(v.modules){const a=v.modules.module_dynamic?.major?.archive;return a?normalize({...a,owner:v.modules.module_author,stat:{view:a.stat?.play,danmaku:a.stat?.danmaku},duration:a.duration_text,pic:a.cover}):null}
  const bvid=v.bvid||v.bv_id;if(!/^BV[a-zA-Z0-9]+$/.test(bvid||''))return null;
  const title=String(v.title||'').replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ','#39':"'"}[k]));
  return {bvid,aid:v.aid||v.id,cid:v.cid,title,pic:https(v.pic||v.cover),duration:v.duration,owner:{name:v.owner?.name||v.owner?.uname||v.author||'哔哩哔哩',mid:v.owner?.mid||v.mid,face:https(v.owner?.face)},stat:{view:v.stat?.view??v.play??0,danmaku:v.stat?.danmaku??v.video_review??0,like:v.stat?.like??0},pubdate:v.pubdate,desc:v.desc||''};
}
export function count(n){if(typeof n==='string'&&/万|亿/.test(n))return n;n=Number(n)||0;return n>=1e8?`${(n/1e8).toFixed(1).replace(/\.0$/,'')}亿`:n>=1e4?`${(n/1e4).toFixed(1).replace(/\.0$/,'')}万`:String(n)}
export function duration(v){if(typeof v==='string'&&v.includes(':'))return v;const n=Number(v)||0;return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
