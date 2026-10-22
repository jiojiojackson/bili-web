import test from 'node:test';
import assert from 'node:assert/strict';
import {commentParams,replyParams,commentId,validComments,nextCommentPage,replyHasMore,safeImageUrl,COMMENT_MODES} from '../src/comments.js';
const message=(rpid,text='hello')=>({rpid,content:{message:text}});
test('WBI main comments: only video oid, supported sort, opaque cursor',()=>{
  assert.equal(COMMENT_MODES.hot,3);
  assert.deepEqual(commentParams(170001,'hot'),{type:1,oid:'170001',mode:3,plat:1,web_location:1315875});
  const token='eyJvZmZzZXQiOiIxKioifQ==';
  assert.equal(JSON.parse(commentParams(2,'recent',token).pagination_str).offset,token);
  assert.throws(()=>commentParams('BVrandom','hot'));
  assert.throws(()=>commentParams(1,'unknown'));
});
test('top-level cursor pagination ignores duplicates, not repeated cursor strings',()=>{
  const id=String(12345678901234567890n);
  assert.equal(commentId({rpid_str:id,rpid:12}),id);
  const page={cursor:{is_end:false,all_count:123,pagination_reply:{next_offset:'same'}},replies:[message(1),message(2)]};
  const first=nextCommentPage(page,new Set());
  assert.equal(first.hasMore,true);
  assert.equal(first.count,123);
  assert.equal(nextCommentPage({...page,replies:[message(3)]},new Set(['1','2'])).hasMore,true);
  assert.equal(nextCommentPage(page,new Set(['1','2'])).hasMore,false);
  assert.equal(nextCommentPage({...page,cursor:{is_end:true}},new Set()).hasMore,false);
  assert.deepEqual(validComments([{},message(1),{rpid:2,content:{message:null}}]),[message(1)]);
});
test('child comments use bounded classic pagination and safe images',()=>{
  assert.deepEqual(replyParams(123,'456',2),{type:1,oid:'123',root:'456',pn:2,ps:20});
  assert.throws(()=>replyParams(123,'456',0));
  assert.equal(replyHasMore({page:{count:21},replies:[message(1)]},1,20),true);
  assert.equal(replyHasMore({page:{count:21},replies:[message(2)]},2,21),false);
  assert.equal(safeImageUrl('//i0.hdslb.com/a.jpg'),'https://i0.hdslb.com/a.jpg');
  assert.equal(safeImageUrl('javascript:alert(1)'),'');
  assert.equal(safeImageUrl('http://unsafe.example/a.jpg'),'');
});
