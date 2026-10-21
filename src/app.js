import QRCode from 'qrcode';
import {api,signed,normalize,count,duration,https,session,setSession} from './api.js';
import {loadSession,saveSession,clearSession} from './vault.js';

const $=s=>document.querySelector(s);
const icons={
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v11h14V9M9 15q3 4 6 0"/>',
  follow:'<path d="M12 12C3-2-2 14 12 12c-14 9 2 14 0 0 9 14 14-2 0 0 14-9-2-14 0 0Z"/>',
  message:'<path d="M21 11c0 5-4 9-9 9H4l2-3a8 8 0 0 1-3-6c0-5 4-8 9-8s9 3 9 8Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
  tv:'<rect x="3" y="6" width="18" height="15" rx="4"/><path d="m7 2 5 4 5-4M7 12h3m4 0h3M9 17h6"/>',
  play:'<rect x="2" y="4" width="20" height="16" rx="4"/><path d="m10 8 6 4-6 4Z"/>',
  danmaku:'<rect x="2" y="4" width="20" height="16" rx="4"/><path d="M6 9h.01M10 9h7M6 14h8m3 0h.01"/>',
  up:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-4 6 4-2-9"/>',
  refresh:'<path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5"/>',
  more:'<circle cx="12" cy="4" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="20" r="1"/>',
  back:'<path d="m14 5-7 7 7 7"/>',
  heart:'<path d="m12 21-8-8a5.5 5.5 0 0 1 8-7 5.5 5.5 0 0 1 8 7Z"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  share:'<path d="M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8"/>',
  shield:'<path d="m12 2 8 4v6c0 6-8 10-8 10S4 18 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  logout:'<path d="M10 3H4v18h6m3-14 5 5-5 5M8 12h14"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
const icon=(name)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.tv}</svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,fallback){try{return JSON.parse(localStorage.getItem(`bili:${key}`))??fallback}catch{return fallback}}
function write(key,value){try{localStorage.setItem(`bili:${key}`,JSON.stringify(value))}catch{}}
let user=null,tab='recommend',nav='home',query='',page=1,fresh=Date.now()%10000,items=[],loading=false,hasMore=true,offset='',version=0;
let qrTimer,qrVersion=0,toastTimer,currentVideo,playVersion=0,mediaFallback=false,mediaSource='',activePart=0;
let history=read('history',[]),saved=read('saved',[]),hidden=new Set(read('hidden',[]));
const records=new Map();

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600)}
function notice(text,action){const n=$('#notice');n.replaceChildren();n.hidden=!text;if(text){n.append(document.createTextNode(text));if(action){const b=document.createElement('button');b.textContent=action.label;b.onclick=action.fn;n.append(b)}}}
function remember(v){records.set(v.bvid,v);return v}
function card(v,featured=false){remember(v);return `<article class="card${featured?' featured':''}"><button class="card-open" data-video="${v.bvid}" aria-label="播放：${esc(v.title)}"><div class="cover"><img src="${esc(v.pic)}" alt="" loading="${featured?'eager':'lazy'}" referrerpolicy="no-referrer"><div class="cover-stats"><span class="stat">${icon('play')}${count(v.stat.view)}</span><span class="stat">${icon('danmaku')}${count(v.stat.danmaku)}</span><span class="duration">${duration(v.duration)}</span></div>${featured?`<span class="feature-play">${icon('play')}点击播放</span>`:''}</div><h2 class="card-title">${esc(v.title)}</h2></button><div class="card-footer"><span class="up-icon">${icon('up')}</span><span class="uploader">${esc(v.owner.name)}</span><button class="more-button" data-more="${v.bvid}" aria-label="更多：${esc(v.title)}">${icon('more')}</button></div></article>`}
function render(){const feed=$('#feed');feed.innerHTML=items.map((v,i)=>card(v,i===0&&nav==='home'&&!query)).join('');feed.setAttribute('aria-busy','false');if(!items.length)empty(query?'没有找到相关视频':'这里还没有视频',query?'换个关键词试试吧。':'下拉刷新，再看看新的推荐。');$('#load-more').hidden=!hasMore||!items.length;$('#load-label').textContent=!hasMore&&items.length?'已经看到这里啦':''}
function skeleton(){ $('#feed').innerHTML=Array.from({length:7},(_,i)=>`<div class="card skeleton${i===0&&!query?' featured':''}" aria-hidden="true"><div class="cover"></div><div class="skeleton-title"></div><div class="skeleton-author"></div></div>`).join('');$('#feed').setAttribute('aria-busy','true')}
function empty(title,text,button='再试一次',fn=()=>load(true)){$('#feed').innerHTML=`<div class="empty"><div class="empty-icon">${icon('tv')}</div><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="primary">${button}</button></div>`;$('#feed .primary').onclick=fn;$('#load-more').hidden=true;$('#feed').setAttribute('aria-busy','false')}
function updateHeading(){const el=$('#feed-heading');el.hidden=!query&&nav!=='following';el.replaceChildren();if(!el.hidden){el.append(document.createTextNode(query?`“${query}” 的搜索结果`:'关注的 UP 主'));if(query){const b=document.createElement('button');b.textContent='返回推荐';b.onclick=()=>{query='';$('#search').value='';$('#search-clear').hidden=true;load(true)};el.append(b)}}}
function cacheKey(){return `feed:${user?.mid||'guest'}:${tab}`}
async function load(reset=false){
  if(loading&&!reset)return;
  if(loading&&reset){version++;loading=false}
  if(nav==='following'&&!session){empty('看看你关注的人','登录账号后，在这里浏览关注 UP 主的新视频。','扫码登录',showLogin);return}
  loading=true;const id=++version;$('#refresh').classList.add('busy');$('#load-more').disabled=true;updateHeading();
  if(reset){page=1;fresh++;offset='';hasMore=true;notice('');if(!items.length||query||nav==='following')skeleton()}
  let list=[],fallback=false;
  try{
    if(nav==='following'){
      const d=await api('following',{type:'video',offset});list=(d.items||[]).map(normalize).filter(Boolean);offset=d.offset;hasMore=!!d.has_more;
    }else if(query||tab==='anime'){
      const d=await api('search',{search_type:'video',keyword:query||'动画 番剧',tids:query?0:32,page,page_size:20,order:query?'totalrank':'pubdate'});list=(d.result||[]).map(normalize).filter(Boolean);hasMore=page<(d.numPages||50);
    }else{
      const params={ps:20,fresh_type:reset?3:4,fresh_idx:fresh,fresh_idx_1h:fresh,feed_version:'V8',homepage_ver:1,y_num:5,brush:page-1};
      let d;try{d=await api('feed',await signed(params))}catch{try{d=await api('feedLegacy',params)}catch{d=await api('popular',{pn:reset?1+Math.floor(Math.random()*5):page,ps:20});fallback=true}}
      list=(d.item||d.list||[]).filter(v=>v.bvid&&v.goto!=='ad'&&v.goto!=='bangumi'&&!v.is_ad).map(normalize).filter(Boolean);hasMore=list.length>0;
    }
    if(id!==version)return;
    const existing=new Set(reset?[]:items.map(v=>v.bvid));list=list.filter(v=>!existing.has(v.bvid)&&!hidden.has(v.bvid));
    items=reset?list:[...items,...list];page++;fresh++;render();
    if(nav==='home'&&!query)write(cacheKey(),{at:Date.now(),items:items.slice(0,60)});
    if(fallback)notice('推荐接口暂时不可用，先看看热门视频。', {label:'重试推荐',fn:()=>load(true)});
    else if(!session&&nav==='home'&&!query)notice('正在浏览游客推荐，登录后更懂你的喜好。',{label:'登录',fn:showLogin});
    if(reset&&items.length)toast('推荐已更新');
  }catch(e){
    if(id!==version)return;
    if(!items.length||query||nav==='following')empty('暂时没连上 B 站',e.message);
    else notice(`${e.message}，保留上次的推荐。`,{label:'重试',fn:()=>load(true)});
  }finally{if(id===version){loading=false;$('#refresh').classList.remove('busy');$('#load-more').disabled=false;$('#pull').style.height='0px';$('#pull').className='pull-indicator'}}
}
function showSheet(html){clearTimeout(qrTimer);qrVersion++;$('#sheet-content').innerHTML=html;if(!$('#sheet').open)$('#sheet').showModal()}
function closeSheet(){$('#sheet').close();clearTimeout(qrTimer);qrVersion++}
async function updateUser(){try{const d=await api('nav');if(d.isLogin){user=d;$('#avatar').innerHTML=`<img src="${esc(https(d.face))}" alt="${esc(d.uname)}" referrerpolicy="no-referrer">`;return true}}catch{}user=null;$('#avatar').innerHTML='<span class="guest-avatar" aria-hidden="true">哔</span>';return false}
async function acceptLogin(cookie){
  setSession(cookie);if(!await updateUser()){setSession('');throw new Error('未能验证登录，请重新扫码或检查 Cookie')}
  try{await saveSession(cookie)}catch{toast('当前浏览器无法持久保存，关闭后需重新登录')}
  closeSheet();items=[];toast(`欢迎回来，${user.uname}`);await load(true);
}
function showLogin(){
  if(user)return showProfile();
  showSheet(`<h2>登录，遇见更多喜欢</h2><p>用哔哩哔哩 App 扫码，并在 App 内确认登录。</p><div class="qr-box" id="qr-box"><span class="subtext">正在生成二维码…</span></div><div class="login-status" id="login-status">准备中</div><div class="login-options"><button class="secondary" id="qr-refresh">刷新二维码</button></div><p class="subtext">同一手机：截图保存二维码，在 B 站「扫一扫」中从相册识别。登录需由你在 B 站 App 中确认。</p><p class="privacy-note">${icon('shield')} <strong>账号缓存只留在这台设备。</strong><br>登录凭据在浏览器内加密保存；Cloudflare 仅在请求时转发给 B 站，不保存凭据。不需要输入密码。</p><details><summary>高级：导入已有的 B 站 Cookie</summary><p>仅在你了解 Cookie 用途时使用。它具有账号访问权限，请勿分享。退出会清除本机缓存。</p><textarea id="cookie-input" placeholder="SESSDATA=…; bili_jct=…; DedeUserID=…" autocomplete="off" spellcheck="false"></textarea><button class="primary" id="cookie-import">在本机保存并登录</button></details>`);
  $('#qr-refresh').onclick=generateQR;$('#cookie-import').onclick=async()=>{const value=$('#cookie-input').value.trim();if(!/(^|;\s*)SESSDATA=[^;]+/.test(value))return toast('缺少 SESSDATA，请检查 Cookie');try{await acceptLogin(value)}catch(e){toast(e.message)}};
  generateQR();
}
async function generateQR(){
  const id=++qrVersion;clearTimeout(qrTimer);$('#login-status').textContent='正在获取二维码…';
  try{const d=await api('qrGenerate',{},false);const image=await QRCode.toDataURL(d.url,{width:384,margin:2,errorCorrectionLevel:'M',color:{dark:'#272d36',light:'#ffffff'}});if(id!==qrVersion)return;$('#qr-box').innerHTML=`<img src="${image}" alt="B 站登录二维码，使用哔哩哔哩 App 扫描">`;$('#login-status').textContent='等待扫码';poll(d.qrcode_key,id)}catch(e){if(id!==qrVersion)return;$('#qr-box').innerHTML=`<span class="subtext">二维码暂不可用</span>`;$('#login-status').textContent=e.message}
}
function poll(key,id){qrTimer=setTimeout(async()=>{if(id!==qrVersion||!$('#sheet').open)return;try{const d=await api('qrPoll',{qrcode_key:key},false);if(id!==qrVersion)return;if(d.code===0){if(!d.session)throw new Error('B 站未返回登录凭据，请重新扫码');$('#login-status').textContent='正在验证登录…';await acceptLogin(d.session);return}if(d.code===86038){$('#login-status').textContent='二维码已过期，点击刷新';return}$('#login-status').textContent=d.code===86090?'已扫码，请在 B 站 App 确认':'等待扫码';poll(key,id)}catch(e){if(id===qrVersion){$('#login-status').textContent=e.message;poll(key,id)}}},2500)}
function showProfile(){
  const name=user?.uname||'还未登录';
  showSheet(`<div class="profile-card">${user?`<img src="${esc(https(user.face))}" alt="" referrerpolicy="no-referrer">`:`<span class="profile-avatar">${icon('tv')}</span>`}<div><h2>${esc(name)}</h2><p>${user?'账号已保存在本机':'登录后，推荐更懂你'}</p></div></div>${!user?'<button class="primary" id="profile-login">扫码登录 B 站</button>':''}<button class="menu-row" id="history-button">${icon('history')}浏览记录<span class="row-caption">${history.length} 条 ›</span></button><button class="menu-row" id="saved-button">${icon('heart')}稍后再看<span class="row-caption">${saved.length} 条 · 本机 ›</span></button><button class="menu-row" id="clear-cache">${icon('trash')}清理推荐缓存<span class="row-caption">释放空间 ›</span></button><button class="menu-row" id="privacy-button">${icon('shield')}隐私与说明<span class="row-caption">›</span></button>${session?`<button class="menu-row danger" id="logout">${icon('logout')}退出并清除账号缓存</button>`:''}<p class="subtext">Bili Web · 非哔哩哔哩官方产品<br>没有开屏广告，也没有 App 下载弹窗。</p>`);
  if($('#profile-login'))$('#profile-login').onclick=showLogin;
  $('#history-button').onclick=()=>showList('浏览记录',history,'history');$('#saved-button').onclick=()=>showList('稍后再看',saved,'saved');
  $('#clear-cache').onclick=()=>{Object.keys(localStorage).filter(k=>k.startsWith('bili:feed:')).forEach(k=>localStorage.removeItem(k));toast('推荐缓存已清理')};
  $('#privacy-button').onclick=()=>showSheet('<h2>你的账号，留在你的设备</h2><p>账号 Cookie 由本机 IndexedDB 加密保存，密钥不可导出。任何同源脚本仍可能访问登录状态，请只使用你信任的部署地址。</p><p>由于 B 站跨域限制，接口通过本项目 Cloudflare Worker 转发。凭据会在请求期间经过 Worker，只发往预设的 B 站接口，不写入数据库或日志。Cloudflare 作为托管方仍会处理网络流量。</p><p>封面、视频优先直连 B 站 CDN；直连失败时转发播放。不提供会员、付费或地域限制绕过。B 站可能调整接口或触发风控。</p><p>推荐缓存、浏览记录和稍后再看保存在本机；稍后再看不会同步到 B 站账号。退出清除账号和推荐缓存，浏览记录可单独清理。</p>');
  if($('#logout'))$('#logout').onclick=async()=>{await clearSession();setSession('');user=null;Object.keys(localStorage).filter(k=>k.startsWith('bili:feed:')).forEach(k=>localStorage.removeItem(k));await updateUser();closeSheet();items=[];nav='home';setNav('home');load(true);toast('已退出，账号缓存已清除')};
}
function showList(title,list,key){showSheet(`<h2>${title}</h2><p>仅保存在当前浏览器</p>${list.length?`<div class="history-list">${list.map(v=>{remember(v);return `<button class="history-item" data-video="${v.bvid}"><img src="${esc(v.pic)}" alt="" referrerpolicy="no-referrer"><span>${esc(v.title)}<small>${esc(v.owner.name)}</small></span></button>`}).join('')}</div><button class="secondary" id="clear-list">清空${title}</button>`:'<p>暂时还没有视频，去发现一些喜欢的吧。</p>'}`);if($('#clear-list'))$('#clear-list').onclick=()=>{write(key,[]);if(key==='history')history=[];else saved=[];showList(title,[],key);toast('已清空')}}
function showMore(v){showSheet(`<h2>${esc(v.title)}</h2><p>${esc(v.owner.name)}</p><button class="menu-row" id="more-save">${icon('heart')}${saved.some(s=>s.bvid===v.bvid)?'移出稍后再看':'加入稍后再看'}<span class="row-caption">仅本机</span></button><button class="menu-row" id="more-hide">${icon('trash')}减少这类推荐<span class="row-caption">隐藏此视频</span></button><a class="menu-row" href="https://www.bilibili.com/video/${v.bvid}" target="_blank" rel="noopener noreferrer">${icon('share')}在 B 站打开 ↗</a>`);$('#more-save').onclick=()=>{toggleSave(v);closeSheet()};$('#more-hide').onclick=()=>{hidden.add(v.bvid);write('hidden',[...hidden].slice(-300));items=items.filter(x=>x.bvid!==v.bvid);render();closeSheet();toast('已隐藏此视频')}}
function toggleSave(v){const exists=saved.some(x=>x.bvid===v.bvid);saved=exists?saved.filter(x=>x.bvid!==v.bvid):[v,...saved].slice(0,200);write('saved',saved);updateSave();toast(exists?'已移出稍后再看':'已加入稍后再看 · 仅本机')}
function updateSave(){if(!currentVideo)return;const exists=saved.some(x=>x.bvid===currentVideo.bvid);$('#save-video').innerHTML=`${icon('heart')}${exists?'已加入稍后再看':'稍后再看'}`;$('#save-video').classList.toggle('saved-label',exists)}
function playbackError(message){$('#play-status').innerHTML=`<span>${esc(message)}</span><button class="secondary" id="retry-play">重新播放</button><a class="secondary" href="https://www.bilibili.com/video/${currentVideo.bvid}" target="_blank" rel="noopener noreferrer">在 B 站打开 ↗</a>`;$('#retry-play').onclick=()=>playPart(activePart)}
async function openVideo(v){
  if(!v)return;closeSheet();currentVideo=v;const id=++playVersion;$('#video').pause();$('#video').removeAttribute('src');$('#video').load();$('#player').showModal();$('#player').scrollTop=0;$('#official-video').href=`https://www.bilibili.com/video/${v.bvid}`;$('#play-status').textContent='正在连接视频…';$('#related').replaceChildren();$('#parts').replaceChildren();$('#player-info').innerHTML=`<h1>${esc(v.title)}</h1><p>${esc(v.owner.name)} · ${count(v.stat.view)} 次观看</p>`;updateSave();
  history=[{...v,watched:Date.now()},...history.filter(h=>h.bvid!==v.bvid)].slice(0,100);write('history',history);
  api('related',{bvid:v.bvid}).then(list=>{if(currentVideo?.bvid!==v.bvid||!$('#player').open)return;$('#related').innerHTML=(list||[]).slice(0,12).map(normalize).filter(Boolean).map(x=>card(x)).join('')}).catch(()=>{});
  try{const detail=await api('view',{bvid:v.bvid});if(id!==playVersion)return;currentVideo={...normalize(detail),pages:detail.pages,rights:detail.rights};remember(currentVideo);$('#player-info').innerHTML=`<h1>${esc(detail.title)}</h1><p>${esc(detail.owner.name)} · ${count(detail.stat.view)} 次观看 · ${count(detail.stat.danmaku)} 条弹幕</p><p class="description">${esc(detail.desc)}</p>`;if(detail.pages.length>1){$('#parts').innerHTML=detail.pages.map((p,i)=>`<button data-part="${i}">P${i+1} ${esc(p.part)}</button>`).join('');$('#parts').querySelectorAll('button').forEach(b=>b.onclick=()=>playPart(Number(b.dataset.part)))}await playPart(0)}catch(e){if(id===playVersion)playbackError(e.message)}
}
async function playPart(index){
  activePart=index;const id=++playVersion;const v=currentVideo;$('#video').pause();$('#play-status').textContent='正在获取播放地址…';$('#parts').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('selected',i===index));
  try{const d=await api('play',{bvid:v.bvid,cid:v.pages?.[index]?.cid||v.cid,qn:32,fnval:1,fnver:0,fourk:0,platform:'html5',high_quality:1});if(id!==playVersion)return;const source=d.durl?.[0]?.url;if(!source)throw new Error('此视频暂不支持网页直接播放，请在 B 站观看');if(d.durl.length>1)throw new Error('此视频采用分段播放，请在 B 站观看完整视频');mediaSource=https(source);mediaFallback=false;$('#video').src=mediaSource;$('#video').poster=v.pic;$('#play-status').textContent='';$('#video').play().catch(()=>{})}catch(e){if(id===playVersion)playbackError(e.message)}
}
function closePlayer(){++playVersion;$('#video').pause();$('#video').removeAttribute('src');$('#video').load();$('#player').close();const u=new URL(location.href);u.searchParams.delete('v');historyReplace(u)}
function historyReplace(u){window.history.replaceState(null,'',u.pathname+u.search)}
function setNav(value){document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===value))}

$('#search-icon').innerHTML=icon('search');$('#refresh').innerHTML=icon('refresh');$('#player-close').innerHTML=icon('back');$('#share-video').innerHTML=`${icon('share')}分享`;document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('#avatar').onclick=()=>user?showProfile():showLogin();$('#refresh').onclick=()=>{window.scrollTo({top:0,behavior:'smooth'});load(true)};$('#load-more').onclick=()=>load();
$('#search-form').onsubmit=e=>{e.preventDefault();const value=$('#search').value.trim();if(!value)return;query=value;nav='home';items=[];setNav('home');$('#search').blur();load(true);window.scrollTo({top:0})};$('#search').oninput=()=>{$('#search-clear').hidden=!$('#search').value};$('#search-clear').onclick=()=>{query='';$('#search').value='';$('#search-clear').hidden=true;items=[];load(true)};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(tab===b.dataset.tab&&!query)return;tab=b.dataset.tab;nav='home';query='';$('#search').value='';$('#search-clear').hidden=true;items=[];setNav('home');document.querySelectorAll('[data-tab]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-selected',active)});load(true);window.scrollTo({top:0})});
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{const value=b.dataset.nav;if(value==='profile')return showProfile();if(value==='messages')return showSheet(`<h2>消息</h2><p>私信与通知请在哔哩哔哩官方消息中心查看。</p><a class="menu-row" href="https://message.bilibili.com/" target="_blank" rel="noopener noreferrer">${icon('message')}打开 B 站消息中心 ↗</a><p class="subtext">浏览器的登录状态彼此独立，官方页面可能需要再次登录。</p>`);if(nav===value&&value==='home'){window.scrollTo({top:0,behavior:'smooth'});return load(true)}nav=value;query='';$('#search').value='';items=[];setNav(value);load(true);window.scrollTo({top:0})});
document.addEventListener('click',e=>{const video=e.target.closest('[data-video]');if(video)return openVideo(records.get(video.dataset.video));const more=e.target.closest('[data-more]');if(more)showMore(records.get(more.dataset.more))});
$('#sheet .sheet-close').onclick=closeSheet;$('#sheet').addEventListener('close',()=>{clearTimeout(qrTimer);qrVersion++});$('#sheet').onclick=e=>{if(e.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(e.clientY<r.top)closeSheet()}};
$('#player-close').onclick=closePlayer;$('#player').addEventListener('cancel',e=>{e.preventDefault();closePlayer()});$('#video').onerror=()=>{if(!$('#player').open||!mediaSource)return;if(!mediaFallback){mediaFallback=true;$('#video').src=`/media?url=${encodeURIComponent(mediaSource)}`;$('#video').play().catch(()=>{});return}playbackError('播放连接失败，可能是 B 站网络限制。')};
$('#save-video').onclick=()=>currentVideo&&toggleSave(currentVideo);$('#share-video').onclick=async()=>{if(!currentVideo)return;const u=new URL(location.origin);u.searchParams.set('v',currentVideo.bvid);try{if(navigator.share)await navigator.share({title:currentVideo.title,url:u.href});else{await navigator.clipboard.writeText(u.href);toast('视频链接已复制')}}catch{}};

// Pull-to-refresh only captures a downward gesture starting at the top.
let startY=0,startX=0,pulling=false,pullDistance=0;
document.addEventListener('touchstart',e=>{if(window.scrollY>1||$('#sheet').open||$('#player').open||loading||e.touches.length!==1)return;startY=e.touches[0].clientY;startX=e.touches[0].clientX;pulling=true;pullDistance=0},{passive:true});
document.addEventListener('touchmove',e=>{if(!pulling)return;const dy=e.touches[0].clientY-startY,dx=e.touches[0].clientX-startX;if(dy<0||Math.abs(dx)>Math.abs(dy)){pulling=false;return}if(dy>8){if(e.cancelable)e.preventDefault();pullDistance=Math.min(95,dy*.45);$('#pull').className=`pull-indicator dragging${pullDistance>=60?' ready':''}`;$('#pull').style.height=`${pullDistance}px`;$('#pull-label').textContent=pullDistance>=60?'松开，换一批推荐':'下拉换一批'}},{passive:false});
function releasePull(){if(!pulling)return;pulling=false;if(pullDistance>=60){$('#pull').className='pull-indicator loading';$('#pull').style.height='48px';$('#pull-label').textContent='正在刷新…';load(true)}else $('#pull').style.height='0px'}
document.addEventListener('touchend',releasePull,{passive:true});document.addEventListener('touchcancel',()=>{pulling=false;$('#pull').style.height='0px'},{passive:true});
const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!loading&&items.length&&hasMore)load()},{rootMargin:'250px'});observer.observe($('#feed-end'));
window.addEventListener('offline',()=>notice('网络已断开，已加载的推荐仍可浏览。'));window.addEventListener('online',()=>{notice('');if(!items.length)load(true)});

async function init(){skeleton();setSession(await loadSession());if(session)await updateUser();const cached=read(cacheKey(),null);if(cached?.items?.length){items=cached.items.map(remember);render();notice('正在更新推荐…')}await load(true);const bvid=new URL(location.href).searchParams.get('v');if(/^BV[a-zA-Z0-9]+$/.test(bvid||'')){try{const v=normalize(await api('view',{bvid}));if(v)openVideo(v)}catch(e){toast(e.message)}}if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})}
init();
