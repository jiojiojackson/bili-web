import shaka from 'shaka-player/dist/shaka-player.dash.js';
export async function startDash(video, mpd, position=0, onFatal=()=>{}){
  shaka.polyfill.installAll();
  if(!shaka.Player.isBrowserSupported())
    throw new Error('此 Safari 不支持所需的 DASH 媒体播放能力');
  // WebKit requires disableRemotePlayback or an AirPlay-compatible fallback
  // for ManagedMediaSource to function on iPhone.
  video.disableRemotePlayback=true;
  const url=URL.createObjectURL(new Blob([mpd],{type:'application/dash+xml'}));
  const player=new shaka.Player();
  player.addEventListener('error',e=>{
    if(e.detail?.severity===shaka.util.Error.Severity.CRITICAL)onFatal(e.detail);
  });
  try{
    await player.attach(video);
    player.configure({abr:{enabled:false},streaming:{bufferingGoal:12,rebufferingGoal:3}});
    await player.load(url,Math.max(0,position),'application/dash+xml');
    return {player,dispose:async()=>{await player.destroy();URL.revokeObjectURL(url)}};
  }catch(e){
    await player.destroy().catch(()=>{});
    URL.revokeObjectURL(url);
    throw e;
  }
}
