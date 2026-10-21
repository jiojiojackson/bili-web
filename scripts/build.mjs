import {build} from 'esbuild';
import {Resvg} from '@resvg/resvg-js';
import {mkdir,copyFile,writeFile,readFile,readdir,unlink} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const name of await readdir('dist'))if(!name.startsWith('.'))await unlink(`dist/${name}`);
const base='https://bili-web.jiojiojackson.workers.dev';
const version=JSON.parse(await readFile('package.json','utf8')).version;
const metadata=`// ==UserScript==
// @name         Bili Web 本地轻装版
// @namespace    https://github.com/jiojiojackson/bili-web
// @version      ${version}
// @description  手机双列推荐、下拉刷新；使用官方登录，所有 B 站请求在本地完成。
// @match        https://www.bilibili.com/*
// @match        https://m.bilibili.com/*
// @connect      api.bilibili.com
// @grant        GM.xmlHttpRequest
// @inject-into  content
// @run-at       document-start
// @noframes
// @homepageURL  ${base}/
// @updateURL    ${base}/bili-local.meta.js
// @downloadURL  ${base}/bili-local.user.js
// ==/UserScript==
`;
const result=await build({entryPoints:['src/local-entry.js'],bundle:true,minify:false,format:'iife',target:['safari16','chrome109'],loader:{'.html':'text','.css':'text'},write:false});
const code=result.outputFiles[0].text;
await writeFile('dist/bili-local.user.js',metadata+'\n'+code);
await writeFile('dist/bili-local.js',code);
await writeFile('dist/bili-local.meta.js',metadata);
for(const file of ['index.html','install.css','install.js','style.css','icon.svg','_headers'])await copyFile(`public/${file}`,`dist/${file}`);
// iOS Home Screen icons require raster artwork. Fill every pixel; iOS applies
// its own icon mask. Keep the vector as the single source for all icon sizes.
const icon=await readFile('public/icon.svg','utf8');
for(const size of [180,512]){
  const png=new Resvg(icon,{background:'#ff6699',fitTo:{mode:'width',value:size}}).render().asPng();
  await writeFile(`dist/${size===180?'apple-touch-icon':'icon-512'}.png`,png);
}
await copyFile('dist/apple-touch-icon.png','dist/apple-touch-icon-precomposed.png');
await writeFile('dist/sw.js',`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('bili-shell-')).map(n=>caches.delete(n)))).then(()=>self.registration.unregister())));`);
console.log('Built static distribution and Safari userscript → dist/');
