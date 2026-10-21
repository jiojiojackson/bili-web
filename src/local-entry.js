import template from '../public/watch.html';
import css from '../public/style.css';

const permitted=['www.bilibili.com','m.bilibili.com'];
async function mount(){
  if(window.top!==window.self||!permitted.includes(location.hostname)||new URL(location.href).searchParams.get('bili_lite')==='off')return;
  if(location.pathname!=='/'&&!/^\/video\/BV[a-zA-Z0-9]+\/?$/.test(location.pathname))return;
  if(document.querySelector('#bili-local-runtime'))return;
  if(!document.documentElement)await new Promise(resolve=>{const observer=new MutationObserver(()=>{if(document.documentElement){observer.disconnect();resolve()}});observer.observe(document,{childList:true})});
  window.stop();
  // The complete UI and stylesheet are bundled in this installed file. Loading
  // the UI never fetches Cloudflare with a Bilibili cookie or account payload.
  const html=template.replace('<link rel="stylesheet" href="/style.css">',`<style id="bili-local-runtime">${css}</style>`).replace(/\s*<link[^>]+(?:rel="icon"|rel="manifest")[^>]*>/g,'');
  document.open();document.write(html);document.close();
  await import('./app.js');
}
mount();
