// MP4 renditions returned by Bilibili's player API. DASH-only modes need
// separate audio/video handling and must not be offered as native MP4 choices.
export const DEFAULT_QUALITY = 80;
const NAMES = {
  6: '240P 极速', 16: '360P 流畅', 32: '480P 清晰',
  64: '720P 高清', 74: '720P60', 80: '1080P 高清',
  112: '1080P+ 高码率', 116: '1080P60'
};
export const qualityLabel = value => NAMES[Number(value)] || `${Number(value)} 档`;
export function qualityOptions(data) {
  const entries = Array.isArray(data?.accept_quality) ? data.accept_quality :
    (Array.isArray(data?.support_formats) ? data.support_formats.map(v => v.quality) : []);
  const current = Number(data?.quality);
  if (current) entries.push(current);
  return [...new Set(entries.map(Number))]
    .filter(q => Object.hasOwn(NAMES, q))
    .sort((a, b) => b - a);
}
export function playbackParams(video, cid, qn) {
  return { bvid: video.bvid, cid, qn, fnval: 1, fnver: 0,
    fourk: 0, platform: 'html5', high_quality: 1 };
}
export function selectMp4(data, requestedQuality, requireExact = false) {
  const parts = data?.durl;
  if (!Array.isArray(parts) || !parts.length || !parts[0]?.url)
    throw new Error('该档位没有可供 Safari 直接播放的 MP4 视频流');
  if (parts.length !== 1)
    throw new Error('视频采用分段媒体流，暂不能直接切换此画质');
  const actualQuality = Number(data.quality) || 0;
  if (requireExact && actualQuality !== Number(requestedQuality))
    throw new Error(`B 站未提供 ${qualityLabel(requestedQuality)} 的 MP4 画质（可能需要登录、大会员或 DASH 播放）`);
  return {url: parts[0].url, actualQuality, qualities: qualityOptions(data)};
}
