// Video publication metadata and creator-space results. All returned fields are
// display-only. No credential handling, follow actions, or profile mutations.
export function validMid(mid){
  return /^\d+$/.test(String(mid??'')) && BigInt(String(mid))>0n;
}
export function publishTime(value){
  const unix=Number(value);
  if(!Number.isFinite(unix)||unix<=0)return '';
  const date=new Date(unix*1000);
  if(!Number.isFinite(date.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function creatorUploadsParams(mid,page=1,size=18){
  if(!validMid(mid))throw new Error('UP 主 ID 无效');
  if(!Number.isInteger(page)||page<1||page>500)throw new Error('无效的投稿页码');
  return {mid:String(mid),pn:page,ps:size,tid:0,order:'pubdate',platform:'web',web_location:1550101,order_avoided:true};
}
export function creatorVideo(raw,owner,normalize){
  if(!raw||!/^(BV)[A-Za-z0-9]+$/.test(String(raw.bvid??'')))return null;
  return normalize({
    ...raw,
    owner:{name:owner.name||raw.author||'UP 主',mid:owner.mid,face:owner.face},
    duration:raw.duration??raw.length,
    pubdate:raw.pubdate??raw.created,
    stat:{view:raw.stat?.view??raw.play??0,danmaku:raw.stat?.danmaku??raw.video_review??0}
  });
}
export function creatorHasMore(data,page,size=18){
  const total=Number(data?.page?.count);
  const length=Array.isArray(data?.list?.vlist)?data.list.vlist.length:0;
  if(length===0)return false;
  if(Number.isFinite(total)&&total>=0)return page*size<total;
  return length>=size;
}
