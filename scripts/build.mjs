import {build} from 'esbuild';
import {mkdir, copyFile} from 'node:fs/promises';
await mkdir('dist', {recursive: true});
await build({entryPoints:['src/app.js'], bundle:true, minify:true, format:'esm', target:['safari16','chrome109'], outfile:'dist/app.js'});
for (const file of ['index.html','style.css','icon.svg','manifest.webmanifest','sw.js','_headers']) await copyFile(`public/${file}`, `dist/${file}`);
console.log('Built Bili Web → dist/');
