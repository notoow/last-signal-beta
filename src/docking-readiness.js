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
  return {ready:reason==='ready',near:distance<limits.near,reason,distance,heading,speed,spin,
    checks:{clearance:clear,position:distance<limits.distance,speed:speed<limits.speed,
      heading:heading<limits.heading,spin:!spinningMatters||spin<limits.spin}};
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

// This is a local steering hint, not an autopilot or a forecast of current/tow
// forces. The caller checks candidate poses against the real collision model.
export function dockingAlignment({boat,berth,status,poseClear,spinningMatters=true,fuel=true,ability=false,exit=false}){
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const dx=berth.x-boat.x,dy=berth.y-boat.y;
  const checks={...status.checks};
  const keysFor=angle=>{
    const n=((Math.round(angle/(Math.PI/4))%8)+8)%8;
    return [['D'],['S','D'],['S'],['S','A'],['A'],['W','A'],['W'],['W','D']][n];
  };
  let next;
  if(status.ready)next={kind:'moor',keys:['E']};
  else if(!fuel)next={kind:'resource',keys:[]};
  else if(ability)next={kind:'ability',keys:[]};
  else if(!spinningMatters)next={kind:'legacy',keys:[]};
  else if(!checks.clearance)next={kind:'maneuver',keys:[]};
  else if(!checks.speed)next={kind:'brake',keys:['Space']};
  else if(!checks.position||!checks.heading){
    // WASD targets eight headings. Never imply a key supplies sideways thrust.
    const target=!checks.position?Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4:berth.angle;
    const delta=wrap(target-boat.angle),steps=Math.max(1,Math.ceil(Math.abs(delta)/.025));
    let turnClear=true;
    for(let i=1;i<=steps;i++)if(!poseClear({...boat,angle:boat.angle+delta*i/steps})){turnClear=false;break;}
    if(!turnClear)next={kind:'maneuver',keys:[],heading:target};
    else if(Math.abs(delta)>.12)next={kind:'turn',keys:['Space',...keysFor(target)],heading:target};
    else if(!checks.position){
      const travel=Math.min(20,Math.max(2,status.distance-limits.distance+4));
      let pathClear=true;
      for(let d=2;d<=travel+2&&pathClear;d+=2){
        const t=Math.min(d,travel);
        // Include present and requested bow directions; drift is still real.
        for(const angle of [boat.angle,target])if(!poseClear({...boat,
          x:boat.x+Math.cos(angle)*t,y:boat.y+Math.sin(angle)*t,angle})){pathClear=false;break;}
      }
      next=pathClear?{kind:'approach',keys:['C',...keysFor(target)],heading:target}:{kind:'maneuver',keys:[],heading:target};
    }else next={kind:'settle',keys:['Space']};
  }else next={kind:'settle',keys:['Space']};
  return {berth:{id:berth.id??'exit',x:berth.x,y:berth.y,angle:berth.angle},exit,status,limits,checks,
    boat:{x:boat.x,y:boat.y,angle:boat.angle,vx:boat.vx,vy:boat.vy,omega:boat.omega||0},offset:{x:dx,y:dy},next};
}

export function dockAlignmentHint(model,language='ko'){
  const en=language==='en',next=model.next,keys=next.keys.join(' + ');
  switch(next.kind){
    case 'moor':return dockHint(model.status,language,model.exit);
    case 'brake':return en?'Release direction · hold Space to slow':'방향키 놓고 Space 유지 · 감속';
    case 'settle':return en?'Release direction · hold Space to steady':'방향키 놓고 Space 유지 · 회전 안정';
    case 'turn':return en?`Hold ${keys} · turn the bow`:`${keys} 유지 · 선수 돌리기`;
    case 'approach':return en?`Release Space · ${keys} to creep ahead`:`Space 놓고 ${keys} · 천천히 전진`;
    case 'maneuver':return en?'Too close to obstacles · make room to turn':'장애물 가까움 · 회전할 공간 확보';
    case 'resource':return en?'No fuel for steering assist':'연료 부족 · 조타 보조 불가';
    case 'ability':return en?'Captain skill active · wait before aligning':'선장 기술 작동 중 · 종료 후 정렬';
    default:return dockHint(model.status,language,model.exit);
  }
}
