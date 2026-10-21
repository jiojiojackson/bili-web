import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readdir,unlink} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const name of await readdir('dist'))if(!name.startsWith('.'))await unlink(`dist/${name}`);
const base='https://bili-web.jiojiojackson.workers.dev';
const metadata=`// ==UserScript==
// @name         Bili Web 本地轻装版
// @namespace    https://github.com/jiojiojackson/bili-web
// @version      2.0.0
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
await writeFile('dist/sw.js',`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('bili-shell-')).map(n=>caches.delete(n)))).then(()=>self.registration.unregister())));`);
console.log('Built static distribution and Safari userscript → dist/');
