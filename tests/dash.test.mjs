import test from 'node:test';
import assert from 'node:assert/strict';
import {dashVideos,dashQualities,manifestForQuality} from '../src/dash.js';

const sample={
  dash:{duration:125, video:[
    {id:64,codecs:'avc1.64001f',width:1280,height:720,bandwidth:1000,baseUrl:'https://v.example.test/a?x=1&y=2',SegmentBase:{Initialization:'0-999',indexRange:'1000-1500'}},
    {id:80,codecs:'avc1.640028',width:1920,height:1080,bandwidth:2000,baseUrl:'https://v.example.test/b?x=1&y=2',SegmentBase:{Initialization:'0-999',indexRange:'1000-1500'}}
  ],audio:[{id:30280,codecs:'mp4a.40.2',bandwidth:130000,baseUrl:'https://a.example.test/audio.m4s',SegmentBase:{Initialization:'0-899',indexRange:'900-1300'}}]}
};
test('only actual DASH representations count as available quality',()=>{
  assert.deepEqual(dashQualities(sample),[80,64]);
  assert.equal(dashVideos({dash:{video:[{id:80,codecs:'avc1.6',baseUrl:'x'}]}}).length,1);
  assert.deepEqual(dashQualities({dash:{video:[]}}),[]);
});
test('MPD contains requested 1080P and distinct audio, without another quality',()=>{
  const xml=manifestForQuality(sample,80);
  assert.match(xml,/width="1920" height="1080"/);
  assert.doesNotMatch(xml,/width="1280"/);
  assert.match(xml,/indexRange="1000-1500"/);
  assert.match(xml,/indexRange="900-1300"/);
  assert.match(xml,/x=1&amp;y=2/);
  assert.match(xml,/PT125\.000S/);
  assert.match(xml,/audio\/mp4/);
});
test('no invented 1080P and no unsafe media schemes',()=>{
  assert.throws(()=>manifestForQuality(sample,112),/未向当前账号提供/);
  const invalid=structuredClone(sample);invalid.dash.video[1].SegmentBase.Initialization='x-y';
  assert.throws(()=>manifestForQuality(invalid,80),/缺少 DASH 分段索引/);
  invalid.dash.video[1].SegmentBase.Initialization='0-100';
  invalid.dash.video[1].baseUrl='javascript:alert(1)';
  assert.throws(()=>manifestForQuality(invalid,80),/非 HTTPS 视频流/);
});
