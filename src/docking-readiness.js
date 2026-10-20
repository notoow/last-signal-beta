const limits={distance:26,heading:.27,speed:19,spin:.16,near:160};
export const DOCK_LIMITS=Object.freeze(limits);

// The readiness decision and its explanation share the same thresholds.
// Geometry clearance is supplied by the caller's full-hull collision model.
export function dockStatus({boat,berth,sailing=true,clear=true,spinningMatters=true}){
  const distance=Math.hypot(boat.x-berth.x,boat.y-berth.y);
  const heading=Math.abs(Math.atan2(Math.sin(boat.angle-berth.angle),Math.cos(boat.angle-berth.angle)));
  const speed=Math.hypot(boat.vx,boat.vy),spin=Math.abs(boat.omega||0);
  const reason=!sailing?'inactive':distance>=limits.near?'approach':!clear?'clearance':
    distance>=limits.distance?'position':speed>=limits.speed?'speed':
    heading>=limits.heading?'heading':spinningMatters&&spin>=limits.spin?'spin':'ready';
  return {ready:reason==='ready',near:distance<limits.near,reason,distance,heading,speed,spin};
}

export function dockHint(status,language='ko',exit=false){
  const en=language==='en';
  if(status.reason==='ready')return en?(exit?'E · Dock and leave':'E · Moor'):(exit?'E · 탈출 접안':'E · 계류');
  if(status.reason==='approach'||status.reason==='inactive')return en?(exit?'Exit berth':'→ Align alongside'):(exit?'탈출 부두':'→ 평행 접안');
  return (en?{
    clearance:'Clear the quay',position:'Move inside the berth',
    speed:'Slow down · Space',heading:'Align bow · Space + direction',
    spin:'Stop turning · Space'
  }:{
    clearance:'안벽에서 벗어나기',position:'접안선 안으로',
    speed:'감속 · Space',heading:'방향 맞추기 · Space + 방향키',
    spin:'회전 멈추기 · Space'
  })[status.reason];
}
