import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {commentMarkup} from '../src/comment-view.js';

test('comment HTML safely escapes untrusted user-generated text',()=>{
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html=commentMarkup({rpid_str:'123',member:{uname:'<img onerror=alert(1)>'},content:{message:'<script>alert(1)</script>'},rcount:2,like:5,ctime:1750000000},esc,String);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('data-show-replies="123"'));
});
test('player HTML includes comment elements; workflow cancels superseded runs',async()=>{
  const html=await readFile('public/watch.html','utf8');
  assert.match(html,/id="comments-panel"/);
  assert.match(html,/id="comments-list"/);
  const yaml=await readFile('.github/workflows/verify.yml','utf8');
  assert.match(yaml,/cancel-in-progress:\s*true/);
  assert.match(yaml,/github\.event\.pull_request\.number \|\| github\.ref/);
});
