import {commentParams,replyParams,commentId,validComments,nextCommentPage,replyHasMore,safeImageUrl,commentTime} from './comments.js';

// Read-only: there are no state-changing requests or CSRF-token operations.
export function commentMarkup(item,esc,count,{child=false,pinned=false}={}){
  const id=commentId(item),member=item.member||{},image=safeImageUrl(member.avatar);
  const replies=Number(item.rcount)||0;
  const location=String(item.reply_control?.location||'');
  return `<article class="comment-item${child?' comment-child':''}" data-comment-id="${esc(id)}">
    <div class="comment-avatar">${image?`<img src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span>哔</span>'}</div>
    <div class="comment-content">
      <div class="comment-author">${esc(member.uname||'哔哩哔哩用户')}${pinned?'<span class="comment-pinned">置顶</span>':''}</div>
      <p class="comment-message">${esc(item.content?.message||'')}</p>
      <div class="comment-meta"><span>${esc(commentTime(item.ctime))}</span>${location?`<span>${esc(location)}</span>`:''}<span>♡ ${esc(count(item.like||0))}</span></div>
      ${!child&&replies>0?`<button type="button" class="comment-reply-button" data-show-replies="${esc(id)}">查看 ${esc(count(replies))} 条回复 ›</button><div class="comment-thread" data-thread="${esc(id)}" hidden></div>`:''}
    </div></article>`;
}

export function createCommentPanel({root,api,signed,esc,count}){
  let oid='',version=0,mode='hot',offset='',loading=false,hasMore=false;
  let seen=new Set(),childStates=new Map();
  const list=root.querySelector('#comments-list');
  const status=root.querySelector('#comments-status');
  const more=root.querySelector('#comments-more');
  const tabs=[...root.querySelectorAll('[data-comment-mode]')];
  const setStatus=message=>{status.textContent=message;status.hidden=!message};
  const renderTabs=()=>tabs.forEach(b=>{const selected=b.dataset.commentMode===mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
  const validOid=v=>/^\d+$/.test(String(v||''))&&Number(v)>0;
  function close(){
    ++version;oid='';offset='';loading=false;hasMore=false;seen=new Set();childStates=new Map();
    list.replaceChildren();more.hidden=true;more.textContent='加载更多评论';root.hidden=true;
    root.querySelector('#comments-count').textContent='';setStatus('');
  }
  function open(aid){
    if(!validOid(aid)){if(!oid){root.hidden=false;setStatus('无法获取视频 AV 号，暂不能查看评论');}return}
    const value=String(aid);
    if(oid===value&&!root.hidden)return;
    close();oid=value;root.hidden=false;mode='hot';renderTabs();
    void load(true);
  }
  async function load(reset=false){
    if(!oid||loading)return;
    if(reset){++version;offset='';hasMore=false;seen.clear();childStates.clear();list.replaceChildren();more.hidden=true;}
    const id=version,videoAid=oid;loading=true;more.disabled=true;setStatus('正在加载评论…');
    try{
      const response=await api('comments',await signed(commentParams(videoAid,mode,offset)));
      if(id!==version||oid!==videoAid)return;
      const result=nextCommentPage(response,seen);
      const incoming=[];
      if(reset&&mode==='hot'){
        for(const item of [response?.top?.upper,response?.top?.admin]){
          if(item&&commentId(item)&&!seen.has(commentId(item))){
            seen.add(commentId(item));incoming.push({item,pinned:true});
          }
        }
      }
      for(const item of result.replies){
        if(!seen.has(commentId(item))){seen.add(commentId(item));incoming.push({item,pinned:false});}
      }
      if(incoming.length)list.insertAdjacentHTML('beforeend',incoming.map(x=>commentMarkup(x.item,esc,count,{pinned:x.pinned})).join(''));
      offset=result.offset;hasMore=result.hasMore;more.hidden=!hasMore;more.textContent='加载更多评论';
      root.querySelector('#comments-count').textContent=result.count>0?`（${count(result.count)}）`:'';
      setStatus(list.children.length?'':(response?.cursor?.is_end||!hasMore?'暂无评论':'暂无可显示评论'));
    }catch(error){
      if(id===version&&oid===videoAid){
        setStatus('评论加载失败：'+(error.message||'请求失败'));
        more.hidden=false;more.textContent='重试加载';hasMore=true;
      }
    }finally{
      if(id===version&&oid===videoAid){loading=false;more.disabled=false}
    }
  }
  async function showReplies(commentRoot){
    if(!oid)return;
    const button=list.querySelector(`[data-show-replies="${commentRoot}"]`);
    const thread=list.querySelector(`[data-thread="${commentRoot}"]`);
    if(!thread||!button)return;
    if(!thread.hidden){thread.hidden=true;button.textContent='展开回复 ›';return}
    thread.hidden=false;
    if(childStates.has(commentRoot)){button.textContent='收起回复 ⌃';return}
    childStates.set(commentRoot,{page:0,loaded:0,seen:new Set(),busy:false,hasMore:true});
    thread.innerHTML='<p class="comment-thread-status">正在加载回复…</p>';
    button.textContent='收起回复 ⌃';
    await loadReplies(commentRoot);
  }
  async function loadReplies(commentRoot){
    const state=childStates.get(commentRoot),thread=list.querySelector(`[data-thread="${commentRoot}"]`);
    if(!state||!thread||state.busy||!state.hasMore)return;
    const id=version,videoAid=oid;
    state.busy=true;
    const nextPage=state.page+1;
    const retry=()=>`<button type="button" class="comment-reply-button" data-more-replies="${esc(commentRoot)}">重试回复</button>`;
    try{
      const data=await api('commentReplies',replyParams(videoAid,commentRoot,nextPage));
      if(version!==id||videoAid!==oid)return;
      const valid=validComments(data?.replies),fresh=valid.filter(x=>!state.seen.has(commentId(x)));
      for(const item of fresh)state.seen.add(commentId(item));
      state.page=nextPage;state.loaded+=fresh.length;
      state.hasMore=replyHasMore(data,nextPage,state.loaded)&&fresh.length>0;
      if(nextPage===1)thread.replaceChildren();
      else thread.querySelector('[data-more-replies]')?.remove();
      if(fresh.length)thread.insertAdjacentHTML('beforeend',fresh.map(x=>commentMarkup(x,esc,count,{child:true})).join(''));
      if(state.hasMore)thread.insertAdjacentHTML('beforeend',`<button type="button" class="comment-reply-button" data-more-replies="${esc(commentRoot)}">加载更多回复</button>`);
      if(!thread.children.length)thread.innerHTML='<p class="comment-thread-status">暂无可显示回复</p>';
    }catch(error){
      if(version===id&&videoAid===oid){
        thread.querySelector('.comment-thread-status')?.remove();
        thread.querySelector('[data-more-replies]')?.remove();
        thread.insertAdjacentHTML('beforeend',`<p class="comment-thread-status">${esc(error.message||'回复加载失败')}</p>${retry()}`);
      }
    }finally{if(version===id&&videoAid===oid)state.busy=false}
  }
  root.addEventListener('click',e=>{
    const sort=e.target.closest('[data-comment-mode]');
    if(sort){if(sort.dataset.commentMode===mode||loading)return;mode=sort.dataset.commentMode;renderTabs();void load(true);return}
    if(e.target.closest('#comments-more')){void load(false);return}
    const expand=e.target.closest('[data-show-replies]');
    if(expand){void showReplies(expand.dataset.showReplies);return}
    const next=e.target.closest('[data-more-replies]');
    if(next){next.disabled=true;void loadReplies(next.dataset.moreReplies)}
  });
  return {open,close};
}
