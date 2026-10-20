import {towMission,towBody,towAction,bodyMoorings,bodyPoint,bodyDock,towDockStatus,temporaryMooringStatus} from './tow-core.js';
// Presentation only: targets follow real objects and never unlock or steer anything.
export function fieldGuidance(s,g,language='ko'){
 if(s?.kind!=='tow'||s.status!=='playing'||!['bus07','sluice','landing'].includes(s.missionId))return g;
 const en=language==='en',say=(ko,enText)=>en?enText:ko,def=towMission(s),action=towAction(s),pontoon=towBody(s,'pontoon'),installed=s.secured.includes('pontoon'),held=s.temporaryMoorings.some(m=>m.bodyId==='bus');
 let b=s.bus;
 if(s.connected)b=towBody(s,s.connectedBodyId)||s.bus;
 else if(s.missionId==='landing'&&!installed){
  const choice=towBody(s,action.bodyId);
  b=s.cargoLatches.pontoon?pontoon:choice&&action.kind==='connect'?choice:held||Math.hypot(s.boat.x-pontoon.x,s.boat.y-pontoon.y)<Math.hypot(s.boat.x-s.bus.x,s.boat.y-s.bus.y)?pontoon:s.bus;
 }
 // Keep the selected line while the player circles it with buoys.
 if(s.anchors.length){const p=s.anchors[0],m=s.moorings.filter(m=>!m.cut).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(m)b=towBody(s,m.bodyId||'bus');}
 const origin=s.anchors[0]||s.boat,id=b===s.bus?'bus':b.id,lines=bodyMoorings(s,b).filter(m=>!m.cut),line=lines.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0];
 let waypoint,stage,ghost=null,radioId=null,checks=g.dockChecks;
 if(b!==s.bus){const v=towDockStatus(s,b);checks=[];const d=bodyDock(s,b).berth;if(Math.hypot(b.x-d.x-d.w/2,b.y-d.y-d.h/2)<350)checks=['hull','heading','still'].map(k=>({id:k,met:v[k],text:({hull:say('선체가 설치칸 안','Hull inside installation berth'),heading:say('표시된 방향과 일치','Match the outline heading'),still:say('배가 멈춤','Hull stopped')})[k]}));}
 const point=(p,label,kind)=>({...p,label,kind});
 if(line){stage=id+'-cut';waypoint=point(line,say('Q · 이 계류줄 해제','Q · Free this mooring'),'mooring');radioId=s.missionId==='landing'?(id==='pontoon'?'learnLandingBridge':'learnLandingPeople'):s.missionId==='sluice'?'learnSluiceLines':'learnBusLines';}
 else if(!s.connected&&!(id==='bus'?s.dockLatched:s.cargoLatches[id])){stage=id+'-connect';waypoint=point(bodyPoint(b,b.length/2),held&&id==='bus'?say('E · 대기 중인 배 풀기','E · Release waiting boat'):say('E · 선수 고리 연결','E · Attach bow ring'),'ring');}
 else{
  const dock=bodyDock(s,b).berth;stage=id+'-deliver';waypoint=point({x:dock.x+dock.w/2,y:dock.y+dock.h/2},id==='pontoon'?say('부잔교 설치 자리','Install the pontoon here'):say('사람들이 내릴 부두','Passenger landing'),'berth');
  ghost={x:waypoint.x+Math.cos(dock.angle)*b.length/2,y:waypoint.y+Math.sin(dock.angle)*b.length/2,angle:dock.angle,length:b.length,width:b.width};
  if(s.missionId==='landing'&&id==='bus'&&!installed){
   const z=def.stations[0];stage='bus-wait';waypoint=point({x:z.x-Math.cos(z.angle)*b.length/2,y:z.y-Math.sin(z.angle)*b.length/2},action.kind==='moor'?say('E · 대기칸에 묶기','E · Moor in holding berth'):say('대기 자리 · 윤곽에 맞춰 정지','Holding berth · Align and stop'),'pocket');ghost={...z,length:b.length,width:b.width};radioId='learnLandingPeople';
   const v=temporaryMooringStatus(s,b,z);if(v.near)checks=['hull','heading','still','bow'].map(k=>({id:k,met:v[k],text:({hull:say('선체가 정박칸 안','Hull inside berth'),heading:say('선수를 왼쪽으로','Bow points left'),still:say('배가 멈춤','Hull stopped'),bow:say('고리가 계선주 근처','Ring near bollard')})[k]}));
  }else if(s.missionId==='landing')radioId=id==='pontoon'?'learnLandingInstall':'learnLandingReturn';
  else if(s.missionId==='sluice')radioId=s.power&&s.pumpDirection===1?'learnSluiceChoice':null;
 }
 if(s.missionId==='sluice'&&held&&!s.connected){stage='sluice-control';waypoint=point(def.crossing.sluice,say('선택 · E 수문 전환','Optional · E sluice control'),'control');radioId='learnSluiceControl';if(s.pumpDirection===-1||!s.power){stage='bus-release';waypoint=point(bodyPoint(s.bus,s.bus.length/2),say('E · 점검선 다시 풀기','E · Release inspection boat'),'ring');radioId=null;}}
 // A nearby optional control may be shown without replacing the delivery destination.
 const landmarks=[];
 if(s.missionId==='sluice'&&s.power&&s.pumpDirection===1&&!s.bypassOpen&&s.connected)landmarks.push(point(def.crossing.sluice,say('선택 · 물살 전환','Optional · Change current'),'control'));
 if(s.missionId==='landing'&&!installed)landmarks.push(point({x:def.world.berth.x+160,y:def.world.berth.y+65},say('하선 불가 · 부잔교 필요','No landing · Pontoon needed'),'blocked'));
 if(s.anchors.length)radioId=null;
 const missing=g.dockChecks.find(c=>c.id==='landing');if(missing&&stage!=='bus-wait'&&!checks.some(c=>c.id==='landing'))checks=[...checks,missing];
 return {...g,hint:stage==='bus-wait'&&!s.anchors.length?(action.kind==='moor'?say('E로 묶은 뒤 부잔교를 가져오세요.','Press E to moor, then fetch the pontoon.'):say('윤곽에 맞춰 멈추세요. 준비 전 E는 예인줄만 분리합니다.','Align and stop. Before ready, E only detaches the towline.')):g.hint,action:line&&action.kind==='approach'?say('WASD 이동 · Q 부표 놓기','WASD move · Q place buoy'):g.action,goal:s.missionId==='landing'?say('부잔교로 길을 만들고 연락선 사람들을 구조하세요','Install the pontoon and bring the passengers ashore'):s.missionId==='sluice'?say('점검선 사람들을 남동쪽 안전 부두로 데려오세요','Bring the inspection crew to the southeastern safe pier'):g.goal,focusBodyId:id,learningStage:s.missionId+'-'+stage,waypoint,pocketGhost:ghost,landmarks,learningRadio:radioId,dockChecks:checks,objectLabels:s.missionId==='landing'?{bus:say('구조 대상 · 연락선','Rescue · Passenger launch'),pontoon:installed?say('설치 완료 · 부잔교','Installed · Pontoon'):say('하선에 필요한 부잔교','Pontoon for the landing')}:undefined};
}
export function nextLearningRadio(s,g){
 const id=g.learningRadio;if(!id||s.status!=='playing'||s.time<3||s.mission.radioLog.some(e=>e.id===id))return null;
 const last=s.mission.radioLog.at(-1);return last&&s.time-last.time<9?null:id;
}
