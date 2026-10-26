import {shoreStandingPoint} from './shore-boarding.js';
import {shoreSiteName} from './shore-sites.js';
import {harborLandmark,harborArenaX} from './rogue-landmarks.js';
import {generateHarbor,GENERATOR_VERSION,DEPTHS,inside,waterAt,shoreBuildings,walkableAt} from './rogue-map.js';
import {newSkillState,activateCaptainSkill,advanceSkill,validateSkill} from './captain-skills.js';
import {CAPTAIN_VESSELS,CAPTAINS} from './captain-vessels.js';
import {newEncounter,tickEncounter,shoreAttack,validateEncounter,toolBerth,FLOOR_TOOLS,SHORE_SITES,hasTool,startleGulls,recoverGullScrap} from './shore-encounters.js';
import {newSurvey,updateSurvey,validSurvey,visibleAt,surveyedAt} from './rogue-vision.js';
import {newRogueTow,towControl,tickRogueTow,deliverRogueTow,canDeliverRogueTow,validRogueTow} from './rogue-tow.js';
import {WATER_PROFILE,waterMotion,stepShipMotion,releaseShipAssist} from './ship-motion.js';
import {terrainTurnPose} from './ship-contact.js';
import {dockStatus,dockHint,dockingAlignment} from './docking-readiness.js';
import {DREDGER_MODEL,CRANE,usesDredger,newCrane,beginCrane,trackCrane,strikeCrane,craneHitsHull,hullHitsCircle,validCrane,craneWarningTime,recordDredgerBreak} from './dredger-counterplay.js';
import {newSalvage,recoverSalvage,tickSalvage,clearSalvageCharge,catchWinch,dischargeWinch,dischargeBilge,validSalvage,SALVAGE_NAMES,RIG_MODEL,rigEffects,winchBurstReady} from './rogue-salvage.js';
import {SLUICE_MODEL,SLUICE,usesSluice,newSluice,beginSluice,trackSluice,sluiceGate,sluiceCleat,applySluiceFlow,sluiceBlocked,sluiceContact,sluiceStatus,validSluice} from './sluice-counterplay.js';
import {LIGHTHOUSE_MODEL,LIGHTHOUSE,usesLighthouse,newLighthouse,relayPosition,relayApproach,lighthouseStatus,tickLighthouse,lighthouseBlocked,validLighthouse} from './lighthouse-counterplay.js';
import {CACHE_MODEL,cacheOffer,validCache} from './rogue-cache.js';
import {CREW_UPGRADES,crewEffects,validCrewUpgrades} from './crew-upgrades.js';
import {shoreScale,crewRadius,shoreRanges,crewSpeed} from './shore-scale.js';
import {newHarborIntel,refreshHarborIntel,harborPlan,harborDestination,harborRoutePriority,planHarbor,validHarborIntel,knownBerth,knownBlockade,bossApproach} from './harbor-plan.js';
import {newVoyageRecord,recordVoyage,recordHit,resourceSnapshot,resourceGains,validVoyageRecord} from './rogue-voyage-record.js';
import {newShoreRescue,rescueStatus,rescueBerth,rescuePendingAt,orderRescue,tickRescue,boardRescue,leaveRescue,validRescue} from './shore-rescue.js';
import {publishRigAction} from './rig-feedback.js';
import {newDaylight,startCamp,tickDaylight,validDaylight} from './voyage-daylight.js';
export {planHarbor};
export const RUN_VERSION=18;
export const SUPPLY_MODEL='carried-v1';
export {CAPTAINS};
export const BUILDS={standard:'표준선',bilge:'침수 발전선',winch:'축력 윈치선'};
export const GEAR={motor:'개량 추진기',pump:'배수 펌프',winch:'강화 견인줄',tank:'보조 연료통',plating:'충격 격벽',turbine:'침수 터빈'};
export const SAVE_KEY='lastsignal.rogue.v1';
export const SHORE_RANGE=Object.freeze({search:32,boarding:36});
const searchInterruptions=new WeakMap();
const searchCache=s=>s.person?s.map.berths.find(b=>!s.claimed.includes(b.id)&&distance(s.person,b.loot)<shoreRanges(s).search):null;
function interruptSearch(s,reason,work=s.work){
  if(s.mode==='ashore'&&work>0)searchInterruptions.set(s,{reason,time:s.time});
}
// Read-only guidance uses the same range and blockers as the actual hold action.
// A short interruption receipt is presentation-only and never changes a save.
export function shoreSearchStatus(s){
  if(s.mode!=='ashore'||!s.person)return null;
  const found=searchCache(s),last=searchInterruptions.get(s),age=last?s.time-last.time:Infinity;
  const blocked=s.pendingCache||s.pendingGear?'choice':s.combat?.hit>0?'hit':s.combat?.action?'attack':null;
  return {berth:found?.id??null,available:!!found&&s.status==='playing'&&!blocked,blocked,
    progress:found?Math.min(s.work,1.8):0,required:1.8,choiceMode:s.cacheModel===CACHE_MODEL,
    interruption:age>=0&&age<2?{reason:last.reason,age}:null};
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const level=(s,id)=>s.equipment.filter(x=>x===id).length;
export const maxHp=s=>CAPTAINS[s.captain].hp+level(s,'plating')*15;
export const maxFuel=s=>140+level(s,'tank')*30;
export const speed=b=>Math.hypot(b.vx,b.vy);
function say(s,id,text,brief=text){if(s.log.some(l=>l.id===id))return;s.log.push({id,text,time:s.time,depth:s.depth});s.radio={text:brief,left:7};}
function floor(s){
  clearSalvageCharge(s);
  if(s.skill){s.skill.left=0;s.skill.vector=null;s.skill.decoy=null;}
  s.map=generateHarbor(s.seed,s.depth,s.generator);
  const hull=CAPTAIN_VESSELS[s.captain];
  s.boat={x:s.map.spawn.x,y:s.map.spawn.y,angle:0,omega:0,vx:0,vy:0,length:hull.length,width:hull.width,inv:0};
  s.mode='sailing';s.mooring=null;s.person=null;s.claimed=[];s.work=0;s.noise=null;s.secretFound=false;s.pendingCache=null;
  if(s.harborIntel!==null)s.harborIntel=newHarborIntel();
  s.dogs=s.map.berths.slice(1).map(b=>{
    const x=s.generator>=4?b.loot.x:b.loot.x+80,y=s.generator>=4?b.landing.y:s.generator===1?b.loot.y+20:Math.max(b.loot.y+40,s.map.islands[b.island].y+175);
    return {x,y,homeX:x,homeY:y,island:b.island,alert:0,bite:0};
  });
  if(s.combat!==null)s.combat=newEncounter(s,s.combat?.ammo??12);
  s.survey=s.combat?newSurvey():null;
  s.tow=s.combat&&s.generator>=2?newRogueTow(s):null;
  s.boss={active:false,cleared:false,phase:'idle',timer:0,cycle:0,aim:0,parts:Array(s.depth===0?2:3).fill(30),hook:-1,rest:70,tension:0};
  s.boss.crane=s.bossModel===DREDGER_MODEL&&s.depth===0?newCrane():null;
  s.boss.sluice=s.sluiceModel===SLUICE_MODEL&&s.depth===1?newSluice():null;
  s.boss.lighthouse=s.lighthouseModel===LIGHTHOUSE_MODEL&&s.depth===2?newLighthouse(s.seed):null;
  s.charge=0;s.valve=false;s.netResolved=false;s.netChoice=null;
  if(s.depth===0&&s.rescue!==null)s.rescue=newShoreRescue(s);
  say(s,'arrival-'+s.depth,DEPTHS[s.depth].arrival);
  updateSurvey(s);
  if(s.combat)say(s,'counter-clue-'+s.depth,'Park: '+shoreSiteName(s,toolBerth(s))+'에 '+
    (usesLighthouse(s)?'차광 신호기가 있어. 탐조등에 발각되기까지 시간을 더 벌 수 있어.':FLOOR_TOOLS[s.depth].clue));
}
export function createRun(seed,captain='woo',build='standard',paint='harbor',generator=GENERATOR_VERSION){
  if(!Object.hasOwn(CAPTAINS,captain)||!Object.hasOwn(BUILDS,build)||!['harbor','ochre','red'].includes(paint))throw Error('Unknown loadout');
  const s={version:RUN_VERSION,physicsProfile:WATER_PROFILE,bossModel:DREDGER_MODEL,sluiceModel:SLUICE_MODEL,lighthouseModel:LIGHTHOUSE_MODEL,supplyModel:SUPPLY_MODEL,cacheModel:CACHE_MODEL,rigModel:RIG_MODEL,generator,seed,depth:0,captain,build,paint,
    status:'playing',time:0,daylight:newDaylight(),fuel:140,hp:CAPTAINS[captain].hp,boost:CAPTAINS[captain].boost,
    flood:0,valve:false,charge:0,crewHp:100,crewUpgrades:[],equipment:[],pendingGear:null,salvage:newSalvage(),harborIntel:newHarborIntel(),voyageRecord:newVoyageRecord(),log:[],radio:null,reason:'',debris:false,netChoices:[],skill:newSkillState(),tools:[],combat:undefined};
  floor(s);return s;
}
export function hullPoints(b){
  const end=(b.length-b.width)/2;
  return [-end,0,end].map(d=>({x:b.x+Math.cos(b.angle)*d,y:b.y+Math.sin(b.angle)*d}));
}
function hullClear(s,b){return hullPoints(b).every(p=>waterAt(s.map,p,b.width/2));}
export const berthReadiness=(s,b)=>{
  const result=dockStatus({boat:s.boat,berth:b,sailing:s.mode==='sailing',clear:hullClear(s,s.boat),spinningMatters:waterMotion(s)});
  // Throw a mooring line from the present hull. Never rotate or translate the
  // boat into a prescribed pose: a close bow, stern or broadside all qualify.
  const capture=76+s.boat.length/2,near=capture+65;
  let clear=!vesselBlocked(s,s.boat);
  const steps=Math.max(1,Math.ceil(result.distance/4));
  // The rope must cross open water. This excludes a quay on the other side
  // of a wall without demanding clearance for an artificial hull snap.
  for(let i=1;i<=steps&&clear;i++)clear=waterAt(s.map,{
    x:s.boat.x+(b.x-s.boat.x)*i/steps,y:s.boat.y+(b.y-s.boat.y)*i/steps},0);
  const checks={clearance:clear,position:result.distance<=capture,speed:result.speed<80,heading:true,spin:true};
  const reason=s.mode!=='sailing'?'inactive':result.distance>=near?'approach':!clear?'clearance':!checks.position?'position':!checks.speed?'speed':'ready';
  return {...result,near:result.distance<near,checks,reason,ready:reason==='ready',assisted:true,freeHeading:true,
    limits:{distance:capture,heading:Math.PI,speed:80,spin:Infinity,near}};
};
export const berthReady=(s,b)=>berthReadiness(s,b).ready;
function vesselContact(s,pose){
  if(!hullClear(s,pose))return 'terrain';
  if(usesLighthouse(s)?lighthouseBlocked(s,pose):!usesSluice(s)&&!s.boss.cleared&&[-110,0,110].some(dx=>distance(pose,{x:s.map.boss.x+dx,y:s.map.boss.y})<58))return 'structure';
  if(usesDredger(s)&&s.boss.parts.some((_,i)=>hullHitsCircle(partPosition(s,i),pose,CRANE.driveRadius)))return 'drive';
  return null;
}
const vesselBlocked=(s,pose)=>!!vesselContact(s,pose);
// Presentation query only. It never selects a destination or changes a save.
export function berthAlignment(s){
  if(s.status!=='playing'||s.mode!=='sailing'||s.boss.active&&!s.boss.cleared&&!harborRoutePriority(s)||
    s.boss.hook>=0||s.pendingGear||s.pendingCache||s.salvage?.pending)return null;
  const candidates=s.boss.cleared?[...s.map.berths,s.map.exit]:s.map.berths;
  const berth=candidates.filter(b=>visibleAt(s,b)).sort((a,b)=>distance(s.boat,a)-distance(s.boat,b))[0];
  if(!berth)return null;
  const status=berthReadiness(s,berth);if(!status.near)return null;
  return dockingAlignment({boat:s.boat,berth,status,poseClear:pose=>!vesselBlocked(s,pose),
    turnPose:waterMotion(s)?(pose,angle)=>terrainTurnPose(pose,angle,p=>hullClear(s,p),p=>!vesselBlocked(s,p)):null,
    spinningMatters:waterMotion(s),fuel:s.fuel>0,ability:s.skill.left>0&&['woo','park'].includes(s.captain),exit:berth===s.map.exit});
}
export function partPosition(s,i){
  if(usesSluice(s))return sluiceCleat(i,s);
  if(usesLighthouse(s))return relayPosition(i,s);
  const count=s.boss.parts.length,a=Math.PI+(i-(count-1)/2)*.7;
  return {x:s.map.boss.x+Math.cos(a)*190,y:s.map.boss.y+Math.sin(a)*190};
}
function nearestDredgerDrive(s,range=Infinity){
  let index=-1,nearest=range;
  s.boss.parts.forEach((hp,i)=>{
    const d=distance(s.boat,partPosition(s,i));
    if(hp>0&&d<nearest){index=i;nearest=d;}
  });
  return index;
}
export function bossLinkCandidate(s){
  if(s.mode!=='sailing'||s.tow?.connected||s.boss.hook>=0||s.boss.cleared)return -1;
  if(!(s.boss.phase==='recover'||(usesSluice(s)||usesLighthouse(s))&&s.boss.active))return -1;
  return usesDredger(s)?nearestDredgerDrive(s,105):s.boss.parts.findIndex((h,i)=>h>0&&
    (usesLighthouse(s)?distance(s.boat,partPosition(s,i))<=LIGHTHOUSE.linkRange:distance(s.boat,partPosition(s,i))<105));
}
export function objective(s){
  if(s.status==='lost')return {text:s.reason,target:null};
  if(s.status==='won')return {text:'세 계층 돌파 · 마지막 신호를 전달했다',target:null};
  if(s.mode==='ashore'){
    const b=s.map.berths.find(b=>!s.claimed.includes(b.id)&&distance(s.person,b.loot)<100)||s.map.berths.find(b=>b.id===s.mooring);
    const cache=s.map.berths.find(x=>!s.claimed.includes(x.id)&&distance(s.person,x.loot)<shoreRanges(s).search);
    const home=s.map.berths.find(x=>x.id===s.mooring);
    const rescue=rescueStatus(s);
    if(rescue?.active&&rescue.discovered){
      const ladder=rescue.boarding;
      const action=ladder?(rescue.ready?'E · 정비공과 함께 승선':'E · 혼자 승선 · 정비공은 부두에 남음'):
        rescue.near?(rescue.stage==='following'?'E · 정비공 기다리기':'E · 정비공 따라오기'):null;
      if(ladder&&(rescue.ready||rescue.stage==='following'||rescueBerth(s)?.id===home.id))return {text:rescue.ready?'정비공 도착 · 함께 승선':
        rescue.stage==='following'?'정비공이 사다리에 올 때까지 기다리기':'정비공은 부두에서 기다리는 중',target:shoreStandingPoint(s,home),action,rescue:true};
      if(rescue.stage==='following'&&!visibleAt(s,rescue.point))return {text:'정비공이 보이는 곳으로 돌아가기',target:null,action:'Q 유인 · Space 근접 · V 투척',rescue:true};
      if(rescue.stage==='following')return {text:rescue.blocked==='threat'?'정비공이 멈췄다 · 짐승을 유인하거나 물리치기':
        rescue.blocked==='distant'?'정비공에게 돌아가기 · 너무 멀어졌다':rescue.blocked==='route'?'정비공이 지나올 길 확보':
        rescue.ready?'정비공 도착 · 함께 승선':ladder?'정비공이 사다리에 올 때까지 기다리기':'정비공을 배까지 호위',target:rescue.blocked?rescue.point:shoreStandingPoint(s,home),action:action||'Q 유인 · Space 근접 · V 투척',rescue:true};
      if(rescue.near||s.claimed.includes(b.id)&&rescueBerth(s)?.id===home.id)return {
        text:ladder&&rescue.ready?'정비공 도착 · 함께 승선':'고립된 정비공 · 가까이 가서 E',target:rescue.point,action:action||'E · 가까이서 따라오기',rescue:true};
    }
    let action=s.combat?'Space 근접 · V 투척 · Q 유인':'Q 유인';
    if(cache){
      const island=s.map.islands[cache.island],gear=GEAR[island.equipment];
      action=s.cacheModel===CACHE_MODEL?'F / R 수색 · 길게 누른 뒤 장비 또는 보급 선택':island.role==='equipment'?'F / R '+gear+' 회수 · 길게 누르기':
        'F '+(island.role==='fuel'?'연료 보충':'선체 수리')+' · R '+gear+' 회수 · 길게 누르기';
    }else if(distance(s.person,home.landing)<shoreRanges(s).boarding)action='E 재승선';
    return s.claimed.includes(b.id)?{text:'배로 돌아가기',target:shoreStandingPoint(s,b),action}:{text:'부두 수색',target:surveyedAt(s,b.loot)||visibleAt(s,b.loot)?b.loot:null,action};
  }
  if(s.mode==='moored')return {text:'E · 하선 / Q · 계류 해제',target:s.map.berths.find(b=>b.id===s.mooring)};
  if(s.boss.cleared){
    // Victory opens an exit, not a compulsory departure. A deliberate chart
    // detour keeps ordinary docking guidance, collision and fuel costs.
    const planned=harborDestination(s);
    if(planned){
      const docking=berthReadiness(s,planned.point);
      return {text:docking.near?dockHint(docking):shoreSiteName(s,planned.point)+' · 선택한 목적지',target:planned.point,planSite:planned.id};
    }
    const docking=berthReadiness(s,s.map.exit);
    if(!surveyedAt(s,s.map.exit)&&!visibleAt(s,s.map.exit))return {text:'봉쇄가 풀렸다 · 해안을 따라 출구 찾기',target:null,exploring:true};
    return {text:docking.near?dockHint(docking,'ko',true):usesLighthouse(s)?'명부 확인 완료 · 등대 부두에 접안해 최종 전송 · E':'탈출 부두 가까이 접근 · 방향 자유',target:s.map.exit};
  }
  if(s.boss.active&&!harborRoutePriority(s)){
    if(usesLighthouse(s)){
      const a=lighthouseStatus(s);
      if(a.phase==='attack'&&!a.impact)return {text:'충격탄 표적 고정 · 원 밖으로 회피',target:null};
      if(!a.linked)return {text:'중계기에 접근 · E 케이블 접속',target:relayApproach(s,a.index)};
      return {text:!a.inRange?'케이블 범위 안으로 돌아가기':!a.clear?'방파제 뒤에서는 송신 불가 · 등대가 보이는 수면으로':
        !a.aligned?'선수를 등대 쪽으로 맞추기':a.speed>a.maxSpeed?'Space 감속 · 속도 18 이하로 송신':'명부 송신 중 · 자세와 저속 유지',
        target:relayPosition(a.index,s)};
    }
    if(usesSluice(s)){
      const a=sluiceStatus(s);
      if(s.boss.hook>=0)return {text:s.build==='winch'?'물살로 축력 모으기 · E 분리 / 축력 35에서 B 발진':'계류 고리에 연결 · E로 놓고 방류 타기',target:partPosition(s,s.boss.hook)};
      if(a.phase==='attack'&&(a.exposed||a.backwash))return {text:a.exposed?'물살을 타고 동쪽으로 가속 · 잠금판에 선수 충돌':'역류 · 닫힌 수문에서 물러나기',target:a.exposed?sluiceGate(a.lane,s):null};
      if(a.phase==='warn')return {text:a.locked?'수로 고정 · 동쪽으로 선수 정렬':'방류할 수로 유도 · 고정되면 상류에서 가속 준비',target:sluiceGate(a.lane,s)};
      return {text:'다음 방류 준비 · 상류로 돌아가 가속 거리 확보',target:{x:harborArenaX(s,2520),y:SLUICE.laneYs[s.boss.parts.findIndex(h=>h>0)]}};
    }
    if(s.boss.hook>=0)return {text:'고리에서 멀어지며 견인 · 줄이 붉어지면 E로 놓기',target:partPosition(s,s.boss.hook)};
    if(s.boss.phase==='recover')return {text:'노출된 구동 고리에 접근 · E로 연결',target:partPosition(s,usesDredger(s)?nearestDredgerDrive(s):s.boss.parts.findIndex(h=>h>0))};
    if(usesDredger(s))return {text:s.boss.phase==='attack'?'낙하 지점에서 벗어나기':s.boss.crane.locked?'표적 고정 · 지금 원 밖으로 회피':'크레인을 구동부 위로 유인 · 고정되면 회피',target:null};
    return {text:s.depth===0?'흡입류·크레인 예고 밖으로 이동':s.depth===1?'방류 예고 띠에서 벗어나기':'탐조등이 멈추면 빛 밖으로 회피',target:null};
  }
  // Passing a quay must not replace a route deliberately chosen on the chart.
  // Local interaction remains available; only mooring/landing changes the task.
  const planned=harborDestination(s);
  if(planned){
    if(planned.id==='boss')return {text:'기계선으로 · 바깥 해역 입구',target:planned.point,planBoss:true};
    const docking=berthReadiness(s,planned.point);
    return {text:docking.near?dockHint(docking):shoreSiteName(s,planned.point)+' · 선택한 목적지',target:planned.point,planSite:planned.id};
  }
  const nearby=s.map.berths.find(b=>(!s.claimed.includes(b.id)||rescuePendingAt(s,b.id))&&distance(s.boat,b)<130&&visibleAt(s,b));
  if(nearby)return {text:dockHint(berthReadiness(s,nearby)),target:nearby};
  const special=s.combat&&!hasTool(s,FLOOR_TOOLS[s.depth].id)?toolBerth(s):null;
  const berth=special&&knownBerth(s,special)?special:s.map.berths.find(b=>!s.claimed.includes(b.id)&&knownBerth(s,b));
  if(special&&berth===special)return {text:shoreSiteName(s,special)+' 수색 · '+FLOOR_TOOLS[s.depth].name+' 확보 / 기존 장비로 돌파도 가능',target:special};
  if(berth)return {text:'부두 가까이 감속 · 방향 자유 · E 계류 / 장비 없이 보스 진입도 가능',target:berth};
  if(knownBlockade(s))return {text:'바깥 해역의 기계선을 정지시켜 탈출로 열기',target:bossApproach(s)};
  return {text:'해안을 따라 탐색 · 발견한 부두는 해도에 기록',target:null,exploring:true};
}
function damage(s,n,reason,source,impactSpeed=null,contact=null){
  if(s.boat.inv>0||s.status!=='playing')return;
  const before=s.hp;
  const brace=s.captain==='woo'&&s.skill.left>0?.25:1;
  s.hp=Math.max(0,s.hp-n*brace/(1+level(s,'plating')*.15));s.boat.inv=.8;
  recordHit(s,'hull',source,before,impactSpeed,contact);
  if(s.hp<=0){s.status='lost';s.reason=reason;}
}
export function interact(s,action,input={}){
  if(s.status!=='playing'||s.pendingGear||s.pendingCache||s.salvage?.pending)return false;
  if(action==='rest')return startCamp(s);
  if(action==='recoverScrap')return recoverGullScrap(s);
  if(action==='tow'||action==='cargoAnchor'){
    const result=towControl(s,action);s.radio={text:result.reason,left:5};return result.ok;
  }
  if(action==='ranged'||action==='melee'){
    const work=s.work,used=shoreAttack(s,action,input.aim);
    if(used)interruptSearch(s,'attack',work);
    return used;
  }
  if(action==='captain')return activateCaptainSkill(s,input);
  const b=s.boat;
  if(action==='special'){
    if(s.mode!=='sailing')return false;
    if(s.build==='bilge'){
      s.valve=!s.valve;
      if(s.valve)publishRigAction(s,{kind:'valve-open'});
      else if(!dischargeBilge(s))publishRigAction(s,{kind:'valve-close'});
      return true;
    }
    if(dischargeWinch(s))return true;
    if(usesSluice(s)||usesLighthouse(s)){
      if(!winchBurstReady(s))return false;
      const p=partPosition(s,s.boss.hook),d=distance(b,p)||1,force=(120+s.charge*.5)*rigEffects(s).winchLaunchMultiplier;
      const result={kind:'line-launch',index:s.boss.hook,charge:s.charge,fuel:3,vector:{x:(b.x-p.x)/d*force,y:(b.y-p.y)/d*force}};
      b.vx+=(b.x-p.x)/d*force;b.vy+=(b.y-p.y)/d*force;
      s.boss.hook=-1;s.boss.tension=0;s.charge=0;s.fuel-=3;clearSalvageCharge(s);publishRigAction(s,result);return true;
    }
    if(winchBurstReady(s)){
      const p=partPosition(s,s.boss.hook),d=distance(b,p)||1;
      const index=s.boss.hook,before=s.boss.parts[index],charge=s.charge,fuel=s.fuel;
      const force=120*rigEffects(s).winchLaunchMultiplier;
      b.vx+=(b.x-p.x)/d*force;b.vy+=(b.y-p.y)/d*force;
      s.boss.parts[s.boss.hook]=Math.max(0,s.boss.parts[s.boss.hook]-s.charge*.22);
      recordDredgerBreak(s,index,before,p,'winch');
      s.charge=0;s.fuel=Math.max(0,s.fuel-3);
      publishRigAction(s,{kind:'winch-pull',index,amount:before-s.boss.parts[index],remaining:s.boss.parts[index],charge,fuel:fuel-s.fuel,partPoint:p});return true;
    }return false;
  }
  if(action==='horn'){
    const startled=startleGulls(s);
    if(s.mode==='moored'){if(s.daylight)s.daylight.rest=null;s.mode='sailing';s.mooring=null;return true;}
    if(startled)return true;
    const origin=s.person||b;
    const reach=90*(s.person?shoreScale(s):1);
    s.noise={x:origin.x+Math.cos(origin.angle||0)*reach,y:origin.y+Math.sin(origin.angle||0)*reach,left:5};
    return true;
  }
  if(action==='cutnet'&&s.mode==='sailing'&&distance(b,harborLandmark(s.map,'net'))<95&&!s.netResolved){
    s.netResolved=true;s.netChoice='cut';s.netChoices.push('cut');s.debris=true;
    recordVoyage(s,'net',{choice:'cut'});
    say(s,'net-cut-'+s.depth,'Park: 줄은 끊었어. 풀린 그물이 바깥 수로로 떠내려가고 있어.');return true;
  }
  if(action!=='interact')return false;
  if(s.mode==='ashore'){
    const berth=s.map.berths.find(x=>x.id===s.mooring);
    if(distance(s.person,berth.landing)<shoreRanges(s).boarding){boardRescue(s,maxHp(s));s.person=null;s.mode='moored';return true;}
    return orderRescue(s);
  }
  if(s.mode==='moored'){
    if(s.daylight)s.daylight.rest=null;
    const berth=s.map.berths.find(x=>x.id===s.mooring);s.person={...shoreStandingPoint(s,berth),angle:-Math.PI/2};s.mode='ashore';
    say(s,'shore-'+s.depth,s.combat?'Park: Space로 갈고리를 휘두르고, V나 클릭으로 고철을 던져. 게가 집게를 들면 뒤로 빠져. Q 깡통으로 짐승을 유인할 수도 있어.':'Park: 상자를 확인해. 발소리가 크면 들개가 따라올 거야. Q로 빈 깡통을 던져 시선을 돌릴 수 있어.','Park: 상자를 확인해. 짐승이 몰려오면 배로 돌아와.');
    if(s.tow?.connected&&!s.tow.anchor)s.radio={text:'Park: 보급정 닻을 안 내렸어. 우리 배만 계류돼 있어. 떠밀리기 전에 다시 타서 H로 닻을 내려.',left:7};
    return true;
  }
  if(s.boss.hook>=0){catchWinch(s,partPosition(s,s.boss.hook));s.boss.hook=-1;s.boss.tension=0;s.charge=0;return true;}
  if(s.depth===2&&s.map.secret&&distance(b,harborLandmark(s.map,'testSite'))<90&&!s.secretFound){
    s.secretFound=true;say(s,'test-site','Woo: 「백야 해상 핵실험 관측소 — 영구 폐쇄」… 실험 날짜는 지워졌는데, 바다 시료 채취표는 아직 여기 있네.');return true;
  }
  if(s.boss.cleared&&berthReady(s,s.map.exit)){
    if(s.depth===0&&s.salvage&&s.salvage.choice===null){
      s.salvage.pending=true;releaseShipAssist(s);return true;
    }
    depart(s);
    return true;
  }
  if((s.boss.phase==='recover'||(usesSluice(s)||usesLighthouse(s))&&s.boss.active&&!s.boss.cleared)&&!s.tow?.connected){
    const id=bossLinkCandidate(s);
    if(id>=0){clearSalvageCharge(s);s.boss.hook=id;s.boss.rest=usesLighthouse(s)?45:clamp(distance(b,partPosition(s,id)),45,95);return true;}
  }
  const berth=s.map.berths.filter(x=>berthReady(s,x)).sort((a,c)=>distance(b,a)-distance(b,c))[0];
  if(berth){
    releaseShipAssist(s);clearSalvageCharge(s);s.mooring=berth.id;s.mode='moored';
    Object.assign(b,{omega:0,vx:0,vy:0});return true;
  }
  return false;
}
// Old underway voyages retain the promised harbour allowance. New voyages
// carry their real fuel: only an earned cache, reward or delivered tow adds it.
const passageFuel=s=>s.supplyModel==='legacy'?30:0;
function depart(s){
  if(s.depth===0)leaveRescue(s);
  const beforeTow=resourceSnapshot(s);
  if(deliverRogueTow(s)){
    s.fuel=Math.min(maxFuel(s),s.fuel+20);s.crewHp=Math.min(100,s.crewHp+20);
    recordVoyage(s,'tow',{fuel:s.fuel-beforeTow.fuel,crew:s.crewHp-beforeTow.crew});
    say(s,'supply-delivered-'+s.depth,'Woo: 보급정까지 돌아왔어. 남은 연료와 구급품을 나눠 받았어.');
  }
  if(s.depth===2){
    s.status='won';
    recordVoyage(s,'passage',{fuel:0,hp:0,drained:0});
    const cargo=s.tow?.delivered,clean=s.netChoices.includes('recovered');
    say(s,'ending',usesLighthouse(s)?
      'Park: 「전원 대피」 기록, 정정됐어. '+(s.rescue?.stage==='aboard'?'정비공과 함께 등대에 도착했어. 직접 증언도 전했어.':s.rescue?.discovered?'폐항에 남은 정비공의 위치도 전했어. 후속 구조가 필요해.':cargo?'보급정 귀항 기록까지 함께 전송했어.':'우리가 확인한 사람들 이름을 전송했어.')+
      (clean?' 걷어 온 폐어망 기록도 함께 보냈어.':'')+' 이제 등대는 돌아오는 배를 비춰.':
      'Park: 명부 전송됐어. 이제 등대가 돌아오는 배를 비춰. 아직 사람은 남아 있어.');
  }
  else{
    const before=resourceSnapshot(s);
    s.fuel=Math.min(maxFuel(s),s.fuel+passageFuel(s));s.hp=Math.min(maxHp(s),s.hp+18);s.flood=Math.max(0,s.flood-15);
    recordVoyage(s,'passage',resourceGains(s,before));s.depth++;floor(s);
  }
}
export function returnFromWorkshop(s){
  const m=s.salvage;
  if(s.status!=='playing'||s.depth!==0||!s.boss.cleared||!m?.pending||m.choice!==null)return false;
  m.pending=false;
  const berth=rescueBerth(s);
  if(berth&&rescuePendingAt(s,berth.id))planHarbor(s,berth.id);
  return true;
}
export function resolveSalvage(s,choice){
  const m=s.salvage;
  if(s.status!=='playing'||s.depth!==0||!s.boss.cleared||!m?.pending||m.choice!==null||
    !['rig','repair','fuel'].includes(choice))return false;
  const before=resourceSnapshot(s);
  m.choice=choice;m.pending=false;
  if(choice==='rig')m.rank=2;
  else if(choice==='repair'){s.hp=Math.min(maxHp(s),s.hp+45);s.flood=Math.max(0,s.flood-30);}
  else s.fuel=Math.min(maxFuel(s),s.fuel+55);
  recordVoyage(s,'workshop',{choice,...resourceGains(s,before)});
  depart(s);
  say(s,'salvage-choice','Woo: '+(choice==='rig'?SALVAGE_NAMES[s.build]+' 개조 끝. 다음 물살에 써 보자.':choice==='repair'?'개조 부품을 수리에 썼어. 이번엔 배를 지키면서 가자.':'개조 부품을 연료로 바꿨어. 다음 부두까지 더 뒤져볼 수 있겠어.'));
  return true;
}
export function salvageChoicePreview(s,choice){
  const cargo=canDeliverRogueTow(s)?20:0;
  return {hp:Math.min(maxHp(s),s.hp+18+(choice==='repair'?45:0)),
    fuel:Math.min(maxFuel(s),s.fuel+passageFuel(s)+cargo+(choice==='fuel'?55:0)),
    flood:Math.max(0,s.flood-15-(choice==='repair'?30:0)),
    crewHp:Math.min(100,s.crewHp+cargo),rank:choice==='rig'?2:s.salvage?.rank||0,
    cargoDelivered:cargo>0};
}
function reward(s,berth,equipment,selectedGear=null,supply=null,crew=null){
  const before=resourceSnapshot(s);
  const island=s.map.islands[berth.island];
  let foundTool=null,gear=null;
  if(s.combat){
    s.combat.ammo=Math.min(12,s.combat.ammo+4);
    if(berth.id===toolBerth(s).id&&!hasTool(s,FLOOR_TOOLS[s.depth].id)){
      foundTool=FLOOR_TOOLS[s.depth];s.tools.push(foundTool.id);
    }
  }
  if(crew){
    s.crewUpgrades.push(crew);
    say(s,'crew-loot-'+s.depth+'-'+berth.id,'Park: '+CREW_UPGRADES[crew].name+'. 이번 항해에서 내가 직접 쓸게.');
  }else if(selectedGear||!supply&&(equipment||island.role==='equipment')){
    const id=selectedGear||island.equipment;
    gear=id;
    if(s.equipment.length>=6)s.pendingGear=id;
    else s.equipment.push(id);
    say(s,'loot-'+s.depth+'-'+berth.id,'Woo: '+GEAR[id]+' 회수. 같은 장비도 중첩해서 실을 수 있어.');
  }else if(supply){
    s.fuel=Math.min(maxFuel(s),s.fuel+supply.fuel);s.hp=Math.min(maxHp(s),s.hp+supply.hp);
    s.flood=Math.max(0,s.flood-supply.flood);
    say(s,'loot-'+s.depth+'-'+berth.id,'Woo: 부품은 보급으로 바꿨어. '+(supply.hp?'선체를 수리하고 물을 빼뒀어.':'쓸 수 있는 연료를 챙겼어.'));
  }else if(island.role==='fuel')s.fuel=Math.min(maxFuel(s),s.fuel+45);
  else{s.hp=Math.min(maxHp(s),s.hp+35);s.flood=Math.max(0,s.flood-20);}
  s.claimed.push(berth.id);s.work=0;
  recordVoyage(s,'cache',{site:berth.island,gear,crew,pending:!!s.pendingGear,tool:foundTool?.id||null,...resourceGains(s,before)});
  if(s.harborIntel?.target===berth.id&&!rescuePendingAt(s,berth.id))s.harborIntel.target=null;
  say(s,'discovery-'+s.depth,DEPTHS[s.depth].discovery);
  if(foundTool){
    say(s,'tool-'+s.depth,'Park: '+foundTool.name+' 찾았어. '+(usesLighthouse(s)&&foundTool.id==='shutter'?'탐조등에 발각되기까지 시간이 늘어나':foundTool.effect)+'. 다음 층에도 가져갈 수 있어.');
    if(recoverSalvage(s))say(s,'salvage-prototype','Park: '+SALVAGE_NAMES[s.build]+'도 찾았어. '+
      ({standard:'속도를 낸 뒤 Space로 모으고, Shift로 다시 튀어나가 봐.',bilge:'침수 20%를 모아 열린 밸브를 B로 닫아 봐. 물을 뒤로 뿜어내.',winch:'축력을 모아 E로 줄을 놓고, B로 빠져나와. 저장된 힘은 금방 풀려.'}[s.build]));
  }
}
export function cacheSupplyPreview(s){
  const offer=cacheOffer(s);if(!offer)return null;
  const fuel=Math.min(maxFuel(s),s.fuel+offer.supply.fuel),hp=Math.min(maxHp(s),s.hp+offer.supply.hp);
  const flood=Math.max(0,s.flood-offer.supply.flood);
  return {fuel,hp,flood,fuelGain:fuel-s.fuel,hpGain:hp-s.hp,floodRemoved:s.flood-flood};
}
// A preview has no authority to claim a later offer. Keep its identity separate
// from presentation phases; nothing new is stored in the voyage schema.
export function cacheSelectionToken(s){
  if(!s.pendingCache||!validCache(s))return null;
  const offer=cacheOffer(s);
  return JSON.stringify([s.seed,s.depth,offer.berth,offer.gear,offer.crew,
    s.equipment,s.crewUpgrades,s.hp,s.fuel,s.flood,s.combat.ammo,s.tools,s.salvage?.rank]);
}
// Full-hold previews choose a slot before claiming anything. Validate every
// input first, then resolve both existing operations in the same synchronous
// action: no observer/save can see a half-claimed cache or duplicate its extras.
export function resolveCacheSelection(s,choice,selection={}){
  const token=cacheSelectionToken(s);
  if(!token||selection?.token!==token)return false;
  const slot=selection.slot,full=s.equipment.length>=6&&cacheOffer(s).gear.includes(choice);
  if(full?!(slot===null||Number.isInteger(slot)&&slot>=0&&slot<s.equipment.length):slot!==undefined)return false;
  if(!resolveCache(s,choice))return false;
  if(full)resolveGear(s,slot);
  return true;
}
export function resolveCache(s,choice){
  if(!s.pendingCache||!validCache(s))return false;
  if(choice==='leave'){s.pendingCache=null;s.work=0;return true;}
  const offer=cacheOffer(s);
  const crew=offer.crew&&choice==='crew:'+offer.crew?offer.crew:null;
  if(!crew&&choice!=='supplies'&&!offer.gear.includes(choice))return false;
  const berth=s.map.berths.find(b=>b.id===offer.berth);
  s.pendingCache=null;
  reward(s,berth,!crew&&choice!=='supplies',crew||choice==='supplies'?null:choice,choice==='supplies'?offer.supply:null,crew);
  return true;
}
export function resolveGear(s,index=null){
  if(!s.pendingGear)return false;
  const gear=s.pendingGear,removed=index===null?null:s.equipment[index],beforeFuel=s.fuel;
  if(index===null)s.fuel=Math.min(maxFuel(s),s.fuel+15);
  else if(Number.isInteger(index)&&index>=0&&index<s.equipment.length)s.equipment[index]=s.pendingGear;
  else return false;
  s.pendingGear=null;s.fuel=Math.min(s.fuel,maxFuel(s));s.hp=Math.min(s.hp,maxHp(s));
  recordVoyage(s,'gear',{gear,removed,slot:index,fuel:Math.max(0,s.fuel-beforeFuel)});return true;
}
function shore(s,input,dt){
  const p=s.person,berth=s.map.berths.find(b=>b.id===s.mooring),island=s.map.islands[berth.island];
  const old={...p},buildings=shoreBuildings(island);
  const mag=Math.hypot(input.x||0,input.y||0),fast=input.boost;
  if(mag){p.angle=Math.atan2(input.y,input.x);const v=crewSpeed(s,fast)*crewEffects(s).speed*Math.min(1,mag)*(s.combat?.action?.kind==='melee'?.55:1);
    if(s.generator===1){
      p.x=clamp(p.x+input.x/mag*v*dt,island.x+12,island.x+island.w-12);
      p.y=clamp(p.y+input.y/mag*v*dt,island.y+12,island.y+island.h-12);
      if(buildings.some(building=>inside(p,building,9))){p.x=old.x;p.y=old.y;}
    }else{
      const nx=p.x+input.x/mag*v*dt,ny=p.y+input.y/mag*v*dt;
      if(walkableAt(s.map,{x:nx,y:p.y},crewRadius(s)))p.x=nx;
      if(walkableAt(s.map,{x:p.x,y:ny},crewRadius(s)))p.y=ny;
    }
  }
  if(s.combat){const traveled=distance(p,old);s.combat.moving=traveled>.01;s.combat.stride+=traveled;}
  for(const dog of s.combat?[]:s.dogs){
    if(s.generator===1&&dog.island!==berth.island)continue;
    if(s.generator!==1&&distance(dog,p)>400&&!(s.noise?.left>0&&distance(dog,s.noise)<230))continue;
    dog.bite=Math.max(0,dog.bite-dt);
    const sight=s.generator===1||Array.from({length:8},(_,i)=>({x:dog.x+(p.x-dog.x)*(i+1)/9,y:dog.y+(p.y-dog.y)*(i+1)/9})).every(q=>walkableAt(s.map,q,1));
    const heard=distance(dog,p)<(fast&&mag?200:95)&&sight;
    const noiseHeard=s.noise?.left>0&&(s.generator===1||distance(dog,s.noise)<230);
    const target=noiseHeard?s.noise:heard?p:{x:dog.homeX+Math.sin(s.time*.5)*35,y:dog.homeY};
    dog.alert=heard||noiseHeard?1:0;
    const d=distance(dog,target),v=dog.alert?77:28;
    if(d>3){
      const nx=dog.x+(target.x-dog.x)/d*v*dt,ny=dog.y+(target.y-dog.y)/d*v*dt;
      if(s.generator===1){dog.x=clamp(nx,island.x+10,island.x+island.w-10);dog.y=clamp(ny,island.y+10,island.y+island.h-10);}
      else{if(walkableAt(s.map,{x:nx,y:dog.y},7))dog.x=nx;if(walkableAt(s.map,{x:dog.x,y:ny},7))dog.y=ny;}
    }
    if(distance(dog,p)<20&&!dog.bite){interruptSearch(s,'hit');s.crewHp=Math.max(0,s.crewHp-12);dog.bite=1.6;s.work=0;if(!s.crewHp){s.status='lost';s.reason='육상에서 선원이 쓰러졌다';}}
  }
  const search=shoreSearchStatus(s),found=search.berth?s.map.berths.find(b=>b.id===search.berth):null;
  if(search.available&&(input.recover||input.equipment)){
    s.work+=dt;if(s.work>=1.8){
      if(s.cacheModel===CACHE_MODEL){const offer=cacheOffer(s,found.id);s.pendingCache={berth:found.id,gear:offer.gear};s.work=0;}
      else reward(s,found,!!input.equipment);
    }
  }else s.work=0;
}
export function bossAttack(s){
  const b=s.boss,origin=s.map.boss,a=angleDiff(Math.atan2(s.boat.y-origin.y,s.boat.x-origin.x),b.aim),d=distance(s.boat,origin);
  if(b.phase!=='attack')return false;
  if(usesLighthouse(s))return !b.lighthouse.impact&&b.timer<=LIGHTHOUSE.impactTail&&hullHitsCircle(b.lighthouse.target,s.boat,LIGHTHOUSE.radius);
  if(usesSluice(s))return false; // Water applies force; the physical gate applies collision damage.
  if(usesDredger(s))return !b.crane.impact&&craneHitsHull(b.crane.target,s.boat);
  if(s.depth===0)return d<360&&Math.abs(a)<.46;
  if(s.depth===1)return Math.abs(s.boat.y-(origin.y+Math.sin(b.aim)*220))<70&&s.boat.x>harborArenaX(s,2220);
  return d<620&&Math.abs(a)<.23;
}
function bossTick(s,dt){
  const b=s.boss,p=s.map.boss,boat=s.boat;
  if(b.cleared)return;
  if(!b.active&&boat.x>harborArenaX(s,2210)){b.active=true;b.phase='warn';b.timer=2.8;b.aim=Math.atan2(boat.y-p.y,boat.x-p.x);
    recordVoyage(s,'boss',{stage:'entered',hp:s.hp,fuel:s.fuel,equipment:[...s.equipment],tool:hasTool(s,FLOOR_TOOLS[s.depth].id)});
    if(s.harborIntel)s.harborIntel.target=null;
    if(usesDredger(s))b.timer=craneWarningTime(s);
    if(usesSluice(s)){b.timer=SLUICE.warning;beginSluice(s);}
    if(usesLighthouse(s)){b.timer=0;b.aim=-Math.PI/2;}
    beginCrane(s);
    say(s,'boss-'+s.depth,usesLighthouse(s)?'Park: 등대는 대피가 끝났다고 믿고 배를 막고 있어. 중계기 세 곳에 E로 접속해. 선수를 등대로 맞추고 Space로 감속하면 남은 사람들 명부를 보낼 수 있어.':usesSluice(s)?'Park: 돌아오는 배만 막고 있어. 방류 때 노란 잠금판이 열려! 물살을 타고 동쪽으로 가속해서 선수로 쳐!':usesDredger(s)?'Park: 버킷이 우릴 따라와. 구동부 위로 유인하고 원이 멈추면 빠져! 멈춘 동안 고리를 당겨도 돼.':s.depth===0?'Woo: 크레인이 멈춘 뒤에 구동 고리가 드러나. 고리를 걸고 바깥으로 당겨!':s.depth===1?'Park: 방류 전에 수면에 띠가 보여. 물살이 멎으면 터빈 고리를 당기자.':'Woo: 빛이 우리를 쫓아와. 조준이 멈추면 벗어나. 발전기 고리는 충전하는 동안 노출돼.');}
  if(!b.active)return;
  if(b.parts.every(h=>h<=0)){
    b.cleared=true;b.hook=-1;b.tension=0;s.charge=0;
    recordVoyage(s,'boss',{stage:'cleared',hp:s.hp,fuel:s.fuel,equipment:[...s.equipment],tool:hasTool(s,FLOOR_TOOLS[s.depth].id)});
    say(s,'boss-clear-'+s.depth,usesLighthouse(s)?'Han: 세 명부가 대조됐어. 봉쇄 해제! 등대 부두에 직접 대서 원본까지 전달하자.':usesSluice(s)?'Han: 수문 세 개 전부 열렸어. 봉쇄 명령은 등대에서 왔어… 돌아오는 배를 누가 막은 거지?': 'Park: 구동부가 멈췄어. 탈출 부두에 접안하면 다음 항로로 이어져.');return;
  }
  if(usesLighthouse(s)){
    updateBossLine(s,dt);
    const result=tickLighthouse(s,dt);
    if(result.locked)say(s,'lighthouse-lock','Woo: 표적이 멈췄어! 원 밖으로 빠져. 방파제 뒤에서는 탐조등이 우릴 못 봐.');
    if(result.hit){damage(s,LIGHTHOUSE.damage*(s.shielded?.6:1),'등대 봉쇄 포격으로 선체가 파손됐다','lighthouse');clearSalvageCharge(s);}
    if(result.sent>=0){
      clearSalvageCharge(s);
      say(s,'signal-sent-'+result.sent,[
        'Park: 폐항 명부 수신 확인. 「대피 완료」라던 선착장에 사람이 남아 있었어.',
        'Han: 수문 기록 수신 확인. 구조 요청은 왔는데 자동 봉쇄가 해제되지 않았어.',
        'Woo: 등대 명부 수신 확인. 돌아오는 배를 막을 이유가 이제 없어.'
      ][result.sent]);
      if(b.parts.every(h=>h<=0))bossTick(s,0);
    }
    return;
  }
  if(usesSluice(s)){
    const held=s.captain==='jeong'&&s.skill.left>0&&b.hook>=0&&b.tension>=.25&&b.phase==='attack'&&b.timer>SLUICE.backwash;
    if(s.captain==='jeong'&&s.skill.left>0&&!held)s.skill.left=0;
    if(!held)b.timer-=dt;
    if(b.phase==='warn')trackSluice(s);
    if(b.timer<=0){
      if(b.phase==='warn'){b.phase='attack';b.timer=SLUICE.attack;b.sluice.locked=true;}
      else if(b.phase==='attack'){b.phase='recover';b.timer=SLUICE.recovery+(hasTool(s,'ratchet')?3:0);}
      else{b.phase='warn';b.timer=SLUICE.warning;b.cycle++;beginSluice(s);}
    }
    applySluiceFlow(s,dt);updateBossLine(s,dt);return;
  }
  // Jeong earns extra pulling time only while physically holding a taut line.
  const a=s.skill,held=s.captain==='jeong'&&a.left>0&&b.hook>=0&&b.tension>=.25&&b.phase==='recover';
  if(s.captain==='jeong'&&a.left>0&&!held)a.left=0;
  if(!held)b.timer-=dt;const broken=b.parts.filter(h=>h<=0).length;
  const target=a.left>0&&a.decoy?a.decoy:boat;
  const dredger=usesDredger(s);
  if(dredger&&b.phase==='warn')trackCrane(s);
  else if(b.phase==='warn'&&b.timer>1.2&&(s.depth===2||a.decoy)&&!(s.depth===2&&hasTool(s,'shutter')))b.aim=Math.atan2(target.y-p.y,target.x-p.x);
  if(b.timer<=0){
    if(b.phase==='warn'){b.phase='attack';b.timer=dredger?CRANE.attackTime:2.8+broken*.4;}
    else if(b.phase==='attack'){b.phase='recover';b.timer=7-broken*.4+(hasTool(s,'ratchet')?3:0);}
    else{b.phase='warn';b.timer=dredger?craneWarningTime(s):2.8-broken*.3;b.hook=-1;s.charge=0;b.cycle++;b.aim=Math.atan2(target.y-p.y,target.x-p.x);beginCrane(s);}
  }
  if(dredger&&['warn','attack'].includes(b.phase)){
    const d=distance(boat,p)||1;
    if(d<620){const force=(b.parts[0]>0?42:8)*(s.shielded?.25:1);boat.vx+=(p.x-boat.x)/d*force*dt;boat.vy+=(p.y-boat.y)/d*force*dt;}
  }
  if(b.phase==='attack'){
    const shield=s.shielded;
    if(dredger){
      const impact=strikeCrane(s,b.parts.map((_,i)=>partPosition(s,i)));
      if(impact.hitHull)damage(s,CRANE.hullDamage*(shield?.6:1),'크레인 버킷에 선체가 파손됐다','crane');
      if(impact.part>=0)say(s,'crane-self-hit-'+b.crane.selfHits,'Woo: 자기 구동부를 찍었어! 고리를 당겨 마무리하자.');
    }else{
      if(s.depth===0){const d=distance(boat,p)||1;if(d<620){const force=(35+broken*13)*(shield?.25:1);boat.vx+=(p.x-boat.x)/d*force*dt;boat.vy+=(p.y-boat.y)/d*force*dt;}}
      if(bossAttack(s)){damage(s,(18+s.depth*4)*(shield?.6:1),'기계선의 공격으로 선체가 파손됐다','machine');if(s.depth===1)boat.vx-=150*(shield?.25:1)*dt;}
    }
  }
  updateBossLine(s,dt);
  if(dredger){
    if(b.parts[0]<=0)say(s,'dredger-pump-broken','Park: 흡입 펌프가 멈췄어. 이제 덜 끌려가!');
    if(b.parts[1]<=0)say(s,'dredger-drive-broken','Woo: 크레인 구동부가 나갔어. 다음 낙하 준비가 느려졌어.');
  }
}
function updateBossLine(s,dt){
  const b=s.boss,boat=s.boat,sluice=usesSluice(s),signal=usesLighthouse(s);
  if(b.hook>=0){
    const anchor=partPosition(s,b.hook),d=distance(boat,anchor)||1,dx=(boat.x-anchor.x)/d,dy=(boat.y-anchor.y)/d;
    b.tension=clamp((d-b.rest)/85,0,1);
    const outward=boat.vx*dx+boat.vy*dy;
    boat.vx-=dx*b.tension*45*dt;boat.vy-=dy*b.tension*45*dt;
    if(!sluice&&!signal&&b.tension>.15&&outward>4){
      const before=b.parts[b.hook];
      b.parts[b.hook]=Math.max(0,b.parts[b.hook]-outward*.3*b.tension*(1+level(s,'winch')*.3)*CAPTAINS[s.captain].pull*dt);
      recordDredgerBreak(s,b.hook,before,anchor,'tow');
    }
    if(s.build==='winch')s.charge=clamp(s.charge+(b.tension>.15?rigEffects(s).winchChargeRate:-12)*dt,0,100);
    if(d>(signal?LIGHTHOUSE.breakRange:260)||b.parts[b.hook]<=0){b.hook=-1;s.charge=0;b.tension=0;}
  }else b.tension=0;
}
export function tickRun(s,input,elapsed){
  if(s.status!=='playing'||s.pendingGear||s.pendingCache||s.salvage?.pending)return;
  input={...input,x:Number.isFinite(input.x)?clamp(input.x,-1,1):0,y:Number.isFinite(input.y)?clamp(input.y,-1,1):0};
  let left=clamp(elapsed,0,.1);
  // Animation observes a whole display frame. A tiny final physics remainder
  // must not overwrite real travel with "idle" (notably at 60/120 Hz).
  const motion=left>0&&s.combat?[s.combat,...s.combat.enemies].map(actor=>[actor,actor.stride]):[];
  while(left>0){const dt=Math.min(left,1/120);left-=dt;step(s,input,dt);}
  for(const [actor,stride] of motion)actor.moving=actor.stride-stride>1e-7;
  if(s.status==='playing')tickRescue(s,clamp(elapsed,0,.1));
  updateSurvey(s);
  refreshHarborIntel(s);
  if(s.harborIntel&&s.status==='playing'&&s.mode==='sailing'&&(!s.boss.active||s.boss.cleared||harborRoutePriority(s))&&!(s.radio?.left>0)){
    const site=harborPlan(s).sites.find(b=>b.known&&b.gear&&!b.claimed&&!s.log.some(l=>l.id==='scout-'+s.depth+'-'+b.id));
    if(site)say(s,'scout-'+s.depth+'-'+site.id,'Park: '+shoreSiteName(s,site)+' 표식에 '+GEAR[site.gear]+'가 있어. M 해도에 남겨둘게.');
  }
}
function step(s,input,dt){
  if(s.status!=='playing'||s.pendingGear||s.pendingCache||s.salvage?.pending)return;
  s.time+=dt;s.boat.inv=Math.max(0,s.boat.inv-dt);
  advanceSkill(s,dt);
  if(s.radio)s.radio.left=Math.max(0,s.radio.left-dt);
  if(s.noise)s.noise.left=Math.max(0,s.noise.left-dt);
  tickSalvage(s,input,dt);
  tickRogueTow(s,dt);
  const searching=s.work,crewBefore=s.crewHp;
  tickEncounter(s,input,dt);
  if(input.recover&&s.person&&recoverGullScrap(s)){s.work=0;input={...input,recover:false};}
  tickDaylight(s,dt);
  if(searching>0&&!s.work){
    if(s.crewHp<crewBefore)interruptSearch(s,'hit',searching);
    else if(s.combat?.action)interruptSearch(s,'attack',searching);
  }
  if(s.status!=='playing')return;
  if(s.mode==='ashore'){shore(s,input,dt);return;}
  if(s.mode==='moored')return;
  const braced=s.captain==='woo'&&s.skill.left>0,dashing=s.captain==='park'&&s.skill.left>0;
  const b=s.boat,mag=braced||dashing?0:Math.hypot(input.x||0,input.y||0);
  let boost=!!input.boost&&mag>0&&s.boost>0,fuelRate=.025+.13*Math.min(1,mag)+(boost?.24:0);
  const old={...b},brake=!!input.brake,precision=!!input.precision;
  const bilge=s.build==='bilge'?(.85+Math.min(s.flood,55)*(.018+level(s,'turbine')*.004)):1;
  const motor=(1+level(s,'motor')*.12)*CAPTAINS[s.captain].thrust;
  if(waterMotion(s)){
    const motion=stepShipMotion(s,input,dt,bilge*motor);boost=motion.boosting;fuelRate=motion.fuelRate;
  }else{
   if(mag){
    const a=Math.atan2(input.y,input.x);
    const turn=CAPTAIN_VESSELS[s.captain].turn;
    b.angle+=clamp(angleDiff(a,b.angle),-turn*dt,turn*dt);
    // Reverse thrust while the requested direction is behind the bow lets a
    // skipper back out of a quay instead of powering farther into it.
    const alignment=Math.cos(angleDiff(a,b.angle));
    const thrust=(boost?220:precision?40:110)*Math.min(1,mag)*alignment;
    // The helm turns first; thrust follows the bow. Inertia makes wide turns real.
    b.vx+=Math.cos(b.angle)*thrust*bilge*motor*dt;
    b.vy+=Math.sin(b.angle)*thrust*bilge*motor*dt;
  }
  // Real ambient drift also affects the player; neutral input does not target zero world velocity.
  b.vx+=(s.map.current.x-b.vx*(brake?4:precision?1.6:.85))*dt;
  b.vy+=(s.map.current.y-b.vy*(brake?4:precision?1.6:.85))*dt;
  }
  s.boost=clamp(s.boost+(boost?-23:8+level(s,'turbine')*2)*dt,0,CAPTAINS[s.captain].boost);
  s.fuel=Math.max(0,s.fuel-fuelRate*CAPTAINS[s.captain].fuel*dt);
  if(s.build==='bilge'){
    s.flood=clamp(s.flood+(s.valve?2.4:-.3-level(s,'pump')*.7)*dt,0,100);
    if(s.flood>=100){s.status='lost';s.reason='밸브를 닫지 못해 침몰했다';}
  }
  if(s.fuel<=0){s.status='lost';s.reason='연료가 소진되어 항해를 잃었다';return;}
  s.shielded=hasTool(s,'baffle')&&brake;
  bossTick(s,dt);
  if(braced&&!waterMotion(s)){b.vx=0;b.vy=0;}
  if(dashing){b.vx=s.skill.vector.x*290;b.vy=s.skill.vector.y*290;}
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  // A rejected turn must not leave the hull embedded in a gate pier. Keep a
  // clear translation at the previous heading, just as for ordinary seawalls.
  if(sluiceBlocked(s,b)&&!sluiceBlocked(s,{...b,angle:old.angle})){
    b.angle=old.angle;b.omega=0;
  }
  const sluice=sluiceContact(s,old);
  if(sluice){
    const impact=speed(b);
    // Preserve the old clear pose in full. An already-overlapping historical
    // save may still rotate out; do not lock its invalid starting heading.
    const angle=sluiceBlocked(s,old)?b.angle:old.angle;
    Object.assign(b,{x:old.x,y:old.y,angle,omega:0,vx:-Math.abs(b.vx)*(sluice.opened?.32:.18),vy:b.vy*.18});
    if(sluice.damage){
      const contact=sluice.opened?'opened':s.boss.sluice.lastImpact;
      const reason={opened:'잠금판을 뚫었지만 선체 충격을 견디지 못했다',pier:'수문 기둥에 부딪혀 선체가 파손됐다',
        closed:'닫힌 잠금판에 부딪혀 선체가 파손됐다',angle:'선수가 어긋난 채 수문에 부딪혀 파손됐다',
        slow:'돌파 속도가 부족한 채 잠금판에 부딪혀 파손됐다'}[contact]||'수문 충돌로 선체가 파손됐다';
      damage(s,sluice.damage*(s.shielded?.6:1),reason,'sluice',impact,contact);
    }
    if(sluice.opened){
      clearSalvageCharge(s);
      say(s,'sluice-open-'+sluice.lane,'Woo: '+(sluice.lane+1)+'번 잠금 풀렸어! 열린 수로는 다시 닫히지 않아.');
      if(s.boss.parts.every(h=>h<=0))bossTick(s,0);
    }
  }
  const blocked=pose=>vesselBlocked(s,pose);
  if(blocked(b)){
    const turn={angle:b.angle,omega:b.omega};
    // The attempted turn can touch a drive while reversing still leads into
    // clear water. Reject that rotation independently instead of cancelling
    // every escape step and trapping the hull at the edge of the machinery.
    b.angle=old.angle;b.omega=0;
    const contact=vesselContact(s,b);
    if(contact){
      // A current into the wall must not cancel propulsion along it. Test each
      // translation with the same whole-hull/machinery predicates, then retain
      // the larger clear component. Never move to an unchecked diagonal pose.
      const next={x:b.x,y:b.y},vx=b.vx,vy=b.vy;
      b.y=old.y;const clearX=!blocked(b);
      b.x=old.x;b.y=next.y;const clearY=!blocked(b);
      let impact;
      if(clearX&&(!clearY||Math.abs(next.x-old.x)>=Math.abs(next.y-old.y))){
        b.x=next.x;b.y=old.y;b.vy=-vy*.18;impact=Math.abs(vy);
      }else if(clearY){
        b.x=old.x;b.y=next.y;b.vx=-vx*.18;impact=Math.abs(vx);
      }else{
        Object.assign(b,{x:old.x,y:old.y,vx:-vx*.18,vy:-vy*.18});impact=Math.hypot(vx,vy);
      }
      if(impact>38)damage(s,(impact-25)*.15,'충돌로 선체가 파손됐다','collision',impact,contact);
    }
    if(waterMotion(s)){
      const pivot=terrainTurnPose(b,turn.angle,pose=>hullClear(s,pose),pose=>!blocked(pose));
      if(pivot)Object.assign(b,{x:pivot.x,y:pivot.y,angle:pivot.angle,omega:turn.omega});
    }
  }
  // Cutting is fast; loose nets impede the next layer's northern shortcut.
  if(s.debris&&s.depth>0&&distance(b,harborLandmark(s.map,'debris'))<100){b.vx*=Math.exp(-2*dt);b.vy*=Math.exp(-2*dt);s.fuel=Math.max(0,s.fuel-.3*dt);}
  if(!s.netResolved&&distance(b,harborLandmark(s.map,'net'))<70){b.vx*=Math.exp(-2.3*dt);b.vy*=Math.exp(-2.3*dt);}
  if(!s.netResolved&&distance(b,harborLandmark(s.map,'net'))<95&&input.recover&&speed(b)<25){
    s.work+=dt;if(s.work>=3){s.netResolved=true;s.netChoice='recovered';s.netChoices.push('recovered');s.debris=false;s.fuel=Math.max(0,s.fuel-2);s.work=0;recordVoyage(s,'net',{choice:'recovered'});say(s,'net-recover-'+s.depth,'Woo: 폐어망은 선미에 실었어. 다음 수로까지 떠내려갈 일은 없겠네.');}
  }else s.work=0;
}
export function encodeRun(s){return JSON.stringify(s);}
export function restoreRun(raw){
  try{
    if(typeof raw!=='string'||raw.length>160000)return null;
    const s=JSON.parse(raw),finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
    if(![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,RUN_VERSION].includes(s.version)||![1,2,3,4,5,6,7,8,9].includes(s.generator)||!Number.isInteger(s.seed)||!finite(s.seed,0,0xffffffff)||!Number.isInteger(s.depth)||!finite(s.depth,0,2))return null;
    if(s.version<18){s.daylight=newDaylight();if(s.combat?.enemies)for(const e of s.combat.enemies)e.stash=0;}
    if(!validDaylight(s))return null;
    if(s.version<17)s.crewUpgrades=null;
    if(!validCrewUpgrades(s))return null;
    if(s.version<15)s.rescue=null;
    if(s.version===15&&s.rescue)s.rescue.quay=s.rescue.site;
    if(s.version<14)s.voyageRecord=null;
    if(s.version<13)s.harborIntel=null;
    if(s.version<12)s.rigModel='legacy';
    if(!['legacy',RIG_MODEL].includes(s.rigModel))return null;
    if(s.version<11){s.cacheModel='legacy';s.pendingCache=null;}
    if(s.version<10)s.supplyModel='legacy';
    if(!['legacy',SUPPLY_MODEL].includes(s.supplyModel))return null;
    if(s.version<9){s.lighthouseModel='legacy';if(s.boss)s.boss.lighthouse=null;}
    if(s.version<8){s.sluiceModel='legacy';if(s.boss)s.boss.sluice=null;}
    if(s.version<7)s.salvage=null;
    if(s.version<6){s.bossModel='legacy';if(s.boss)s.boss.crane=null;}
    if(!['legacy',DREDGER_MODEL].includes(s.bossModel))return null;
    const oldHull=s.version<3;
    if(s.version<5){s.physicsProfile='legacy';if(s.boat)s.boat.omega=0;}
    if(!['legacy',WATER_PROFILE].includes(s.physicsProfile))return null;
    if(!Object.hasOwn(CAPTAINS,s.captain)||!Object.hasOwn(BUILDS,s.build)||!['harbor','ochre','red'].includes(s.paint)||!['playing','won','lost'].includes(s.status))return null;
    if(!Array.isArray(s.equipment)||s.equipment.length>6||s.equipment.some(g=>!Object.hasOwn(GEAR,g)))return null;
    if(s.pendingGear!==null&&(!Object.hasOwn(GEAR,s.pendingGear)||s.equipment.length!==6))return null;
    if(!finite(s.hp,0,maxHp(s))||!finite(s.crewHp,0,100)||!finite(s.fuel,0,maxFuel(s))||!finite(s.boost,0,CAPTAINS[s.captain].boost)||!finite(s.flood,0,100)||!finite(s.charge,0,100)||!finite(s.time,0,1e7))return null;
    s.map=generateHarbor(s.seed,s.depth,s.generator);
    if(s.version===1)s.skill=newSkillState();
    if(s.version<4){s.combat=null;s.tools=[];s.survey=null;s.tow=null;}
    s.version=RUN_VERSION;
    if(!validateEncounter(s,finite)||!validSurvey(s.survey)||!validRogueTow(s.tow,finite,s.map))return null;
    if(!validateSkill(s,finite))return null;
    const b=s.boat;if(!b||!finite(b.x,0,s.map.width)||!finite(b.y,0,s.map.height)||!finite(b.vx,-2000,2000)||!finite(b.vy,-2000,2000)||!finite(b.angle,-1e7,1e7)||!finite(b.inv,0,2))return null;
    if(!finite(b.omega,-20,20))return null;
    const hull=CAPTAIN_VESSELS[s.captain];b.length=hull.length;b.width=hull.width;
    if(!['sailing','moored','ashore'].includes(s.mode))return null;
    if(s.mode!=='sailing'&&!s.map.berths.some(b=>b.id===s.mooring))return null;
    // Fixed mooring cannot preserve a pre-landing turn for the next departure.
    if(s.mode!=='sailing')b.omega=0;
    if(s.mode==='ashore'&&(!s.person||!finite(s.person.x,0,3400)||!finite(s.person.y,0,1800)||!finite(s.person.angle,-1e7,1e7)||(s.generator===1?!inside(s.person,s.map.islands[s.map.berths.find(b=>b.id===s.mooring).island]):!walkableAt(s.map,s.person,0))))return null;
    if(!Array.isArray(s.claimed)||new Set(s.claimed).size!==s.claimed.length||s.claimed.some(id=>!s.map.berths.some(b=>b.id===id)))return null;
    if(!validCache(s))return null;
    if(!validHarborIntel(s))return null;
    if(!validVoyageRecord(s))return null;
    if(!validRescue(s))return null;
    const boss=s.boss;if(!boss||!['idle','warn','attack','recover'].includes(boss.phase)||!Array.isArray(boss.parts)||boss.parts.length!==(s.depth===0?2:3)||boss.parts.some(h=>!finite(h,0,30))||!Number.isInteger(boss.hook)||boss.hook< -1||boss.hook>=boss.parts.length||!finite(boss.timer,-.1,10)||!finite(boss.aim,-Math.PI,Math.PI)||!finite(boss.rest,45,95)||!finite(boss.tension,0,1)||!finite(boss.cycle,0,1e6)||typeof boss.active!=='boolean'||typeof boss.cleared!=='boolean')return null;
    if(!validCrane(s,finite)||!validSalvage(s,finite)||!validSluice(s,finite)||!validLighthouse(s,finite))return null;
    if(!Array.isArray(s.dogs)||s.dogs.length!==2||s.dogs.some(d=>![d.x,d.y,d.homeX,d.homeY,d.island,d.alert,d.bite].every(Number.isFinite)||!s.map.islands[d.island]||(s.generator===1?!inside(d,s.map.islands[d.island]):!walkableAt(s.map,d,0))))return null;
    if(!Array.isArray(s.log)||s.log.length>80||s.log.some(l=>typeof l.id!=='string'||typeof l.text!=='string'||l.text.length>500||!finite(l.time,0,s.time)||!finite(l.depth,0,2)))return null;
    if(typeof s.valve!=='boolean'||typeof s.debris!=='boolean'||typeof s.secretFound!=='boolean'||typeof s.netResolved!=='boolean'||!finite(s.work,0,3)||!Array.isArray(s.netChoices)||s.netChoices.length>3||s.netChoices.some(x=>!['cut','recovered'].includes(x)))return null;
    if(s.noise&&(!finite(s.noise.x,-100,3500)||!finite(s.noise.y,-100,1900)||!finite(s.noise.left,0,5)))return null;
    if(s.radio&&(typeof s.radio.text!=='string'||s.radio.text.length>500||!finite(s.radio.left,0,7)))return null;
    if(typeof s.reason!=='string'||s.reason.length>200)return null;
    // Older runs used a single 64x28 hull. Expand into adjacent water rather
    // than leave a resumed wider vessel trapped inside a quay; never refill it.
    if(oldHull&&!hullClear(s,b)){
      const origin={x:b.x,y:b.y};let found=false;
      for(let r=2;r<=48&&!found;r+=2)for(let i=0;i<16&&!found;i++){
        b.x=origin.x+Math.cos(i*Math.PI/8)*r;b.y=origin.y+Math.sin(i*Math.PI/8)*r;
        found=hullClear(s,b);
      }
      if(!found)return null;
      b.vx=0;b.vy=0;
    }
    return s;
  }catch{return null;}
}
