// Convert official Bilibili DASH metadata into a standards-compliant VOD MPD.
// URLs are only used in the viewer's browser; no server-side media relay.
const VALID_RANGE = /^\d+-\d+$/;
const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const numeric = (n, fallback=0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
export function dashVideos(data) {
  return (data?.dash?.video || []).filter(v => Number.isInteger(Number(v.id))
    && v.codecs && v.baseUrl || v?.base_url).filter(v => Number(v.id)>0);
}
export function dashQualities(data) {
  return [...new Set(dashVideos(data).map(v=>Number(v.id)))].sort((a,b)=>b-a);
}
function mediaUrl(stream) {
  const url = new URL(stream.baseUrl || stream.base_url);
  if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error('非 HTTPS 视频流');
  url.protocol='https:';
  return url.href;
}
function segmentBase(stream) {
  const base=stream.SegmentBase || stream.segment_base;
  const index=base?.indexRange || base?.index_range;
  const init=base?.Initialization || base?.initialization;
  if(!VALID_RANGE.test(index||'') || !VALID_RANGE.test(init||''))
    throw new Error('视频缺少 DASH 分段索引');
  return `<SegmentBase indexRange="${index}"><Initialization range="${init}"/></SegmentBase>`;
}
function representation(stream, audio=false) {
  const bandwidth=Math.max(1,Math.round(numeric(stream.bandwidth,1)));
  const id=Number(stream.id);
  const codecs=escapeXml(stream.codecs||'');
  const mime=audio?'audio/mp4':'video/mp4';
  const dimensions=audio
    ? ` audioSamplingRate="${Math.max(1,Math.round(numeric(stream.audioSamplingRate,48000)))}"`
    : ` width="${Math.max(1,Math.round(numeric(stream.width,1280)))}" height="${Math.max(1,Math.round(numeric(stream.height,720)))}"`;
  return `<Representation id="${id}" bandwidth="${bandwidth}" mimeType="${mime}" codecs="${codecs}"${dimensions}><BaseURL>${escapeXml(mediaUrl(stream))}</BaseURL>${segmentBase(stream)}</Representation>`;
}
export function manifestForQuality(data,quality,fallbackDuration=0) {
  const tracks=dashVideos(data).filter(v=>Number(v.id)===Number(quality));
  if(!tracks.length)throw new Error('B 站未向当前账号提供这个分辨率的 DASH 视频流');
  // Prefer AVC/H.264 over AV1/HEVC to maximize compatibility with iPhone Safari.
  const video=tracks.sort((a,b)=>{
    const avc=s=>/^(avc1|avc3)/i.test(s.codecs||'') ? 1 : 0;
    return avc(b)-avc(a)||numeric(b.bandwidth)-numeric(a.bandwidth);
  })[0];
  const audio=(data.dash.audio||[]).filter(a=>a.baseUrl||a.base_url).sort((a,b)=>numeric(b.bandwidth)-numeric(a.bandwidth))[0];
  if(!audio)throw new Error('B 站未提供此视频的 DASH 音频流');
  const duration=numeric(data.dash.duration)||numeric(fallbackDuration)||numeric(data.timelength)/1000;
  if(!(duration>0))throw new Error('视频时长无效，不能生成 DASH 播放列表');
  const seconds=duration.toFixed(3);
  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" minBufferTime="PT3S" mediaPresentationDuration="PT${seconds}S">
<Period id="0" duration="PT${seconds}S">
<AdaptationSet contentType="video" segmentAlignment="true" startWithSAP="1">${representation(video)}</AdaptationSet>
<AdaptationSet contentType="audio" segmentAlignment="true" startWithSAP="1">${representation(audio,true)}</AdaptationSet>
</Period></MPD>`;
}
