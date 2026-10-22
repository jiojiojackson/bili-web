// Read-only helpers for Bilibili's video comment API.
export const COMMENT_MODES={hot:3,recent:2};

export function commentParams(aid,mode='hot',offset=''){
  if(!/^\d+$/.test(String(aid))||Number(aid)<=0)throw new Error('视频缺少有效的 AV 号');
  if(!Object.hasOwn(COMMENT_MODES,mode))throw new Error('未知评论排序');
  const params={type:1,oid:String(aid),mode:COMMENT_MODES[mode],plat:1,web_location:1315875};
  if(offset)params.pagination_str=JSON.stringify({offset:String(offset)});
  return params;
}
export function replyParams(aid,root,page=1){
  if(!/^\d+$/.test(String(aid))||Number(aid)<=0)throw new Error('视频缺少有效的 AV 号');
  if(!/^\d+$/.test(String(root))||Number(root)<=0)throw new Error('评论 ID 无效');
  if(!Number.isInteger(page)||page<1||page>100)throw new Error('回复页码无效');
  return {type:1,oid:String(aid),root:String(root),pn:page,ps:20};
}
export function commentId(item){
  const value=String(item?.rpid_str||item?.rpid||'');
  return /^\d+$/.test(value)?value:'';
}
export function validComments(items){
  return (Array.isArray(items)?items:[]).filter(item=>commentId(item)&&item?.content&&typeof item.content.message==='string');
}
export function nextCommentPage(data,seenIds){
  const cursor=data?.cursor||{};
  const replies=validComments(data?.replies);
  const unseen=replies.filter(item=>!seenIds.has(commentId(item)));
  // The offset may repeat across pages; trust is_end or new RPIDs.
  return {
    replies:unseen,
    offset:String(cursor.pagination_reply?.next_offset||''),
    hasMore:!cursor.is_end&&unseen.length>0&&!!cursor.pagination_reply?.next_offset,
    count:Number(cursor.all_count)||0
  };
}
export function replyHasMore(data,page,loaded){
  const total=Number(data?.page?.count);
  const rows=validComments(data?.replies);
  if(rows.length===0)return false;
  if(Number.isFinite(total)&&total>=0)return loaded<total;
  return rows.length>=20&&page<100;
}
export function safeImageUrl(raw){
  try{
    const u=new URL(String(raw||'').replace(/^\/\//,'https://'));
    return u.protocol==='https:'?u.href:'';
  }catch{return ''}
}
export function commentTime(seconds){
  const stamp=Number(seconds)*1000;
  if(!Number.isFinite(stamp)||stamp<=0)return '';
  return new Date(stamp).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
}
