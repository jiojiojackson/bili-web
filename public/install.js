const code="javascript:(()=>{if(!['www.bilibili.com','m.bilibili.com'].includes(location.hostname)){alert('请先打开 bilibili.com，再点这个书签');return}const s=document.createElement('script');s.src='https://bili-web.jiojiojackson.workers.dev/bili-local.js';document.documentElement.append(s)})()";
document.querySelector('#bookmarklet').href=code;
document.querySelector('#copy-bookmarklet').onclick=async e=>{try{await navigator.clipboard.writeText(code);e.target.textContent='已复制'}catch{e.target.textContent='请长按书签链接复制地址'}};
if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.filter(r=>new URL(r.scope).origin===location.origin).map(r=>r.unregister()))).catch(()=>{});
if('caches'in window)caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bili-shell-')).map(k=>caches.delete(k)))).catch(()=>{});
// This runs on the distribution origin only, never inside Bilibili.
if('indexedDB'in window)indexedDB.deleteDatabase('bili-private');
