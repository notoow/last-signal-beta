import {towBody,towMission,bodyDock,bodyMoorings,towAction,towDockStatus,temporaryMooringStatus,towAssistState} from './tow-core.js';
const copy={ko:{reconnect:['선수 고리에 다시 연결','자세를 고치려면 선수 고리로 다가가 E로 연결한 뒤 C로 조금씩 조정하세요.'],speed:['아직 미끄러지는 중','이동 키를 놓아 감속하세요. 다시 움직일 땐 C를 누르고 조금씩 조정하세요.'],spin:['선체가 아직 회전 중','이동 키를 놓고 선미의 회전이 잦아드는지 보세요. C는 화물의 회전을 즉시 멈추지 않습니다.'],heading:['선수 방향 맞추기','표시된 배 모양과 방향을 맞추세요. C를 누르고 작은 움직임으로 선수를 당겨 주세요.'],fit:['선체 전체를 윤곽 안으로','C를 누르고 조금씩 이동해 배 전체를 정박칸에 넣으세요.'],bow:['선수 고리를 계선주 가까이','C로 조금씩 조정해 고리를 계선주에 가까이 가져오세요.'],ready:['계류 준비 완료','E로 묶으면 예인줄이 풀립니다.'],auto:['윈치가 정렬 중','윈치가 선체를 정렬합니다. 주변을 비워 두세요.'],detach:['윈치 제동 중 · 줄 분리','E로 예인줄을 분리하고 선체에서 떨어지세요. 공간이 나면 윈치가 정렬합니다.'],clear:['윈치 제동 중 · 공간 확보','선체 주변을 비워 주세요. 다른 배가 가까우면 윈치는 정렬 대신 제동합니다.'],settled:['접안 조건 충족','선체가 멈추고 방향이 맞았습니다.'],reach:['계선주로 접근','예인정도 선수 고리 가까이에 있어야 E로 묶을 수 있습니다.'],hull:'선체가 정박칸 안',angle:'선수 방향 일치',still:'이동·회전 멈춤',moving:'아직 미끄러짐',rotating:'아직 회전 중',ring:'고리가 계선주 근처',unsafe:' 지금 E는 예인줄만 분리합니다.'},en:{reconnect:['Reconnect at the bow ring','Approach the bow ring and press E to reconnect, then hold C for small corrections.'],speed:['Hull still drifting','Release movement to slow down. Hold C for small corrections when moving again.'],spin:['Hull still rotating','Release movement and watch the stern settle. C does not instantly stop cargo rotation.'],heading:['Match the bow direction','Match the ship outline. Hold C and use small movements to pull the bow around.'],fit:['Fit the whole hull inside','Hold C for small movements until the whole ship fits inside the berth.'],bow:['Bring the ring to the bollard','Use C for small corrections to bring the bow ring closer to the bollard.'],ready:['Ready to moor','Press E to moor and release the towline.'],auto:['Winch aligning','The winch is aligning the hull. Keep the surrounding water clear.'],detach:['Winch braking · Detach','Press E to detach and move clear of the hull. The winch aligns once there is space.'],clear:['Winch braking · Make room','Keep other boats clear. The winch brakes instead of aligning when a hull is nearby.'],settled:['Docking checks met','The hull is stopped and aligned.'],reach:['Approach the bow ring','Your tug must also be near the bow ring to moor with E.'],hull:'Whole hull inside',angle:'Bow aligned',still:'Movement and rotation stopped',moving:'Still drifting',rotating:'Still rotating',ring:'Ring near bollard',unsafe:' E now only detaches the towline.'}};
// Read the same readiness predicates as docking; never steer or relax completion rules.
export function dockingGuidance(s,g,language='ko'){
 if(s?.kind!=='tow'||s.status!=='playing'||s.anchors.length||g.navigation&&g.navigation.mode!=='rescue')return g;
 const id=g.focusBodyId||(s.connected?s.connectedBodyId:'bus'),b=towBody(s,id),action=towAction(s);
 if(!b||bodyMoorings(s,b).some(m=>!m.cut)||s.secured.includes(id)||s.temporaryMoorings.some(m=>m.bodyId===id)||action.kind==='sluice')return g;
 const station=g.waypoint?.kind==='pocket'?towMission(s).stations?.find(z=>z.allowed.includes(id)):null;
 const z=station?.zone||bodyDock(s,b)?.berth;
 if(!z)return g;
 // Only coach the selected destination, close enough to matter, with the tug nearby.
 if(Math.hypot(Math.max(z.x-b.x,0,b.x-z.x-z.w),Math.max(z.y-b.y,0,b.y-z.y-z.h))>160||Math.hypot(s.boat.x-b.x,s.boat.y-b.y)>380)return g;
 if(s.missionId==='landing'&&id==='bus'&&!station&&!s.secured.includes('pontoon'))return g;
 const t=copy[language]||copy.ko,v=station?temporaryMooringStatus(s,b,station):towDockStatus(s,b),assist=station?'off':towAssistState(s,b),speed=Math.hypot(b.vx,b.vy),rotating=Math.abs(b.omega)>=.12;
 let reason=assist==='braking'?(s.connected&&s.connectedBodyId===id&&action.kind==='detach'?'detach':'clear'):assist==='aligning'?'auto':speed>=12?'speed':rotating?'spin':!v.heading?'heading':!v.hull?'fit':station&&!v.bow?'bow':station?(action.kind==='moor'?'ready':'reach'):'settled';
 if(['heading','fit','bow'].includes(reason)&&(!s.connected||s.connectedBodyId!==id))reason='reconnect';
 const [label,instruction]=t[reason],unsafe=station&&s.connected&&reason!=='ready';
 const heading=station?.angle??z.angle,angleError=Math.atan2(Math.sin(heading-b.angle),Math.cos(heading-b.angle));
 const docking={bodyId:id,reason,label,speed,angleError,rotating,velocity:{x:b.x,y:b.y,vx:b.vx,vy:b.vy},ready:v.hull&&v.heading&&v.still&&(!station||v.bow&&v.near),zone:{...z,angle:heading}};
 const center=station?{x:station.x-Math.cos(heading)*b.length/2,y:station.y-Math.sin(heading)*b.length/2}:{x:z.x+z.w/2,y:z.y+z.h/2};
 const checks=[{id:'hull',met:v.hull,text:t.hull},{id:'heading',met:v.heading,text:t.angle},{id:'still',met:v.still,text:v.still?t.still:rotating?t.rotating:t.moving},...(station?[{id:'bow',met:v.bow,text:t.ring}]:[])];
 return {...g,docking,hint:instruction+(unsafe?t.unsafe:''),dockChecks:checks,waypoint:{...center,kind:station?'pocket':'berth',label},pocketGhost:{x:center.x+Math.cos(heading)*b.length/2,y:center.y+Math.sin(heading)*b.length/2,angle:heading,length:b.length,width:b.width}};
}
export function drawDockingDrift(c,g){
 const d=g?.docking;if(!d||d.speed<2)return;
 const p=d.velocity,len=Math.min(85,d.speed*1.5),angle=Math.atan2(p.vy,p.vx);
 c.save();c.translate(p.x,p.y);c.rotate(angle);c.strokeStyle=d.speed>=12?'#f0b979':'#bfdec7';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(len,0);c.lineTo(len-9,-6);c.moveTo(len,0);c.lineTo(len-9,6);c.stroke();c.restore();
}
