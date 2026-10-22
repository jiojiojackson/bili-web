import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {endpoint,assertLocalOrigin,request} from '../src/transport.js';
test('all supported requests go directly to a fixed Bilibili API host',()=>{
  for(const route of ['nav','feed','feedLegacy','popular','search','view','viewSigned','play','playDash','related','following']){
    const u=new URL(endpoint(route,{keyword:'鱼 & 面',page:2}));
    assert.equal(u.origin,'https://api.bilibili.com');assert.equal(u.searchParams.get('keyword'),'鱼 & 面');
  }
  for(const route of ['https://evil.example','__proto__','qrPoll','device'])assert.throws(()=>endpoint(route));
});
test('runtime rejects the distribution site and lookalike domains',()=>{
  for(const host of ['www.bilibili.com','m.bilibili.com'])assert.doesNotThrow(()=>assertLocalOrigin(host));
  for(const host of ['bili-web.jiojiojackson.workers.dev','bilibili.com.attacker.test','localhost'])assert.throws(()=>assertLocalOrigin(host));
});
test('browser handles official cookies without script reading or copying credentials',async t=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'www.bilibili.com'}});
  t.after(()=>{if(old)Object.defineProperty(globalThis,'location',old);else delete globalThis.location});
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(new URL(url).origin,'https://api.bilibili.com');
    assert.equal(options.credentials,'include');assert.equal(options.body,undefined);assert.equal(options.headers,undefined);
    return Response.json({code:0,data:{isLogin:true}});
  });
  assert.equal((await request('nav')).data.isLogin,true);
});
test('deployment contains no Worker handler or credential relay',async()=>{
  const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
  assert.equal(config.main,undefined);assert.equal(config.assets.directory,'./dist');
  const script=await readFile('dist/bili-local.user.js','utf8');
  assert.match(script,/@inject-into\s+content/);assert.match(script,/@connect\s+api\.bilibili\.com/);
  assert.doesNotMatch(script,/document\.cookie|SESSDATA|\/api\/bili|\/media\?url|serviceWorker\.register|bili-private/);
});
