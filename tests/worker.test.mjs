import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{cleanCookie,allowedMedia} from '../src/worker.mjs';

test('relay only forwards approved Bilibili cookies',()=>{
  assert.equal(cleanCookie('SESSDATA=abc; tracking=secret; bili_jct=csrf; DedeUserID=123'),'SESSDATA=abc; bili_jct=csrf; DedeUserID=123');
  assert.equal(cleanCookie('SESSDATA=abc\r\nX-Evil: yes'),'');
});
test('media proxy rejects SSRF and credential-bearing URLs',()=>{
  assert.equal(allowedMedia('https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/file.mp4?x=1'),true);
  for(const u of ['http://cdn.bilivideo.com/x','https://bilivideo.com.attacker.com/x','https://attackerbilivideo.com/x','https://127.0.0.1/','https://user:pass@cdn.bilivideo.com/x','https://cdn.bilivideo.com:444/x','file:///etc/passwd'])assert.equal(allowedMedia(u),false,u);
});
test('account API rejects cross-site and missing Origin requests before contacting Bilibili',async()=>{
  for(const origin of ['https://evil.example',null]){
    const headers={'Content-Type':'application/json'};if(origin)headers.Origin=origin;
    const r=await worker.fetch(new Request('https://bili.example/api/bili',{method:'POST',headers,body:JSON.stringify({route:'nav',cookie:'SESSDATA=test'})}),{});
    assert.equal(r.status,403);assert.match(r.headers.get('Cache-Control'),/no-store/);
  }
});
test('unknown API targets cannot turn the Worker into an arbitrary authenticated proxy',async()=>{
  const r=await worker.fetch(new Request('https://bili.example/api/bili',{method:'POST',headers:{Origin:'https://bili.example','Content-Type':'application/json'},body:JSON.stringify({route:'https://evil.example'})}),{});
  assert.equal(r.status,404);
});
test('media denies non-Bilibili URLs before fetch',async()=>{
  const r=await worker.fetch(new Request('https://bili.example/media?url=https://evil.example'),{});assert.equal(r.status,400);
});
test('QR login returns only approved cookies and never the callback URL or refresh token',async t=>{
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(new URL(url).hostname,'passport.bilibili.com');
    assert.equal(options.headers.Cookie,undefined);
    return Response.json({code:0,data:{code:0,url:'https://passport.bilibili.com/callback?SESSDATA=approved&DedeUserID=42&unexpected=secret',refresh_token:'do-not-persist'}},{headers:{'Set-Cookie':'bili_jct=csrf; HttpOnly; Secure'}});
  });
  const request=new Request('https://bili.example/api/bili',{method:'POST',headers:{Origin:'https://bili.example','Content-Type':'application/json'},body:JSON.stringify({route:'qrPoll',params:{qrcode_key:'test-key'},cookie:'SESSDATA=unrelated'})});
  const response=await worker.fetch(request,{});const result=await response.json();
  assert.equal(result.data.url,undefined);assert.equal(result.data.refresh_token,undefined);
  assert.match(result.data.session,/SESSDATA=approved/);assert.match(result.data.session,/bili_jct=csrf/);assert.doesNotMatch(result.data.session,/unexpected|unrelated/);
  assert.match(response.headers.get('Cache-Control'),/no-store/);
});
test('malformed JSON shapes are rejected without contacting upstream',async()=>{
  for(const body of ['null','[]','{"route":"nav","params":null}']){
    const r=await worker.fetch(new Request('https://bili.example/api/bili',{method:'POST',headers:{Origin:'https://bili.example','Content-Type':'application/json'},body}),{});assert.equal(r.status,400);
  }
});
