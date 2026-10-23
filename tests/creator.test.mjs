import test from 'node:test';
import assert from 'node:assert/strict';
import {validMid,publishTime,creatorUploadsParams,creatorVideo,creatorHasMore} from '../src/creator.js';
import {normalize} from '../src/api.js';

test('UP 主 IDs are validated, without accepting profile URLs or injection',()=>{
  assert.equal(validMid(12345),true);
  assert.equal(validMid('012345'),true);
  for(const x of ['',0,-1,'1?x=evil','https://space.bilibili.com/1','abc','1e9']){
    assert.equal(validMid(x),false);
  }
  assert.deepEqual(creatorUploadsParams('123',2),{mid:'123',pn:2,ps:18,tid:0,order:'pubdate',platform:'web',web_location:1550101,order_avoided:true});
  assert.throws(()=>creatorUploadsParams('1&mid=2'),/无效/);
});
test('unix publication date shows local date and minute; missing never becomes 1970',()=>{
  assert.equal(publishTime(undefined),'');
  assert.equal(publishTime(0),'');
  assert.match(publishTime(1782345678),/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/);
});
test('space video submission maps created and length to reusable video card',()=>{
  const up={mid:'99',name:'UP 主',face:'https://i0.hdslb.com/a.jpg'};
  const result=creatorVideo({bvid:'BV1x1234',aid:123,pic:'//i0.hdslb.com/p.jpg',title:'作品',created:1782345678,length:'08:35',play:250,video_review:10},up,normalize);
  assert.equal(result.pubdate,1782345678);
  assert.equal(result.duration,'08:35');
  assert.equal(result.owner.mid,'99');
  assert.equal(result.owner.face,up.face);
  assert.equal(result.stat.view,250);
  assert.equal(result.stat.danmaku,10);
  assert.equal(creatorVideo({bvid:'bad'},up,normalize),null);
});
test('creator uploads pagination stops at the final page',()=>{
  const d={page:{count:19},list:{vlist:[{bvid:'BVx'}]}};
  assert.equal(creatorHasMore(d,1),true);
  assert.equal(creatorHasMore(d,2),false);
  assert.equal(creatorHasMore({page:{count:100},list:{vlist:[]}},1),false);
});
