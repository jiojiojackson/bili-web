import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_QUALITY, qualityLabel, qualityOptions, playbackParams, selectMp4} from '../src/quality.js';

test('labels and qualities reflect reported Bilibili playback metadata', () => {
  assert.equal(DEFAULT_QUALITY, 80);
  assert.equal(qualityLabel(80), '1080P 高清');
  assert.deepEqual(qualityOptions({quality:32, accept_quality:[16,32,64,80,80,120,125]}), [80,64,32,16]);
  assert.deepEqual(qualityOptions({quality:16, support_formats:[{quality:32}]}), [32,16]);
  assert.deepEqual(qualityOptions({quality:32}), [32]);
});
test('request MP4 rather than audio-video split DASH for native Safari video', () => {
  const p = playbackParams({bvid:'BV123'},987,80);
  assert.deepEqual(p,{bvid:'BV123',cid:987,qn:80,fnval:1,fnver:0,fourk:0,platform:'html5',high_quality:1});
});
test('never report a downgraded or DASH-only stream as selected HD', () => {
  const lower = {quality:32,accept_quality:[32,64,80],durl:[{url:'https://example.test/file.mp4'}]};
  assert.equal(selectMp4(lower,80).actualQuality,32);
  assert.throws(()=>selectMp4(lower,80,true),/未提供 1080P/);
  assert.equal(selectMp4(lower,32,true).actualQuality,32);
  assert.throws(()=>selectMp4({quality:80,dash:{video:[],audio:[]}},80,true),/没有.*MP4/);
  assert.throws(()=>selectMp4({quality:32,durl:[{url:'a'},{url:'b'}]},32,true),/分段/);
  assert.throws(()=>selectMp4({durl:[{url:'a'}]},80,true),/未提供/);
});
