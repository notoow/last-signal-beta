import {createRun,update as updateBattle,placeAnchor as anchor,circuit,spawnEnemy,inTriangle,length,clamp,restore,stats,dash,segmentDistance,damagePlayer} from './core.js';
import {restoreTow} from './tow-core.js';
import {freshCampaign,readCampaign,parseCampaign,reserveTowAttempt,recordTowResult} from './campaign.js';
export {freshCampaign,readCampaign} from './campaign.js';
export const PEOPLE=['engineer','operator'];
export const MISSION_DURATION=360;
export const HARBOR={
 extraction:{x:800,y:920,r:74},
 buildings:[{x:80,y:60,w:430,h:175},{x:620,y:70,w:320,h:175},{x:1080,y:70,w:440,h:165},{x:100,y:485,w:350,h:115},{x:1150,y:480,w:350,h:120},{x:480,y:670,w:220,h:65},{x:900,y:670,w:220,h:65}],
 platforms:[{x:316,y:319,w:98,h:94},{x:1181,y:313,w:116,h:98}],
 gate:{x:700,y:670,w:200,h:65}
};
const emit=(s,type,extra={})=>s.events.push({type,...extra});
function machine(s,kind,x,y,extra={}){
 const e=spawnEnemy(s,kind==='winch'?'shooter':'drone',{x,y});
 Object.assign(e,{machine:kind,hp:32,maxHp:32,speed:0,damage:8,xp:0,restrained:0,phase:0,...extra});return e;
}
export function createRescue(seed=20261006,campaign=freshCampaign(),target='engineer'){
 const s=createRun(seed,'voyage','weaver'),available=PEOPLE.filter(id=>!campaign.crew.includes(id));
 if(!available.includes(target))target=available[0]||'record';
 Object.assign(s.player,{x:800,y:950,dx:0,dy:-1,hp:100,fire:999});
 s.spawnIn=999;
 s.mission={version:2,target,deadline:MISSION_DURATION,gateOpen:campaign.crew.includes('operator'),repairBoost:campaign.crew.includes('engineer'),
 people:[{id:'engineer',x:365,y:365},{id:'operator',x:1235,y:365}].filter(p=>available.includes(p.id)).map(p=>({...p,state:p.id===target?'waiting':'shelter'})),
 wrecks:[{id:'left-wreck',x:450,y:790,w:130,h:55,intact:true,heavy:false},{id:'right-wreck',x:1010,y:790,w:135,h:55,intact:true,heavy:false},{id:'dock-plate',x:730,y:825,w:140,h:48,intact:true,heavy:true,moved:0}],
 fields:[],recordEnabled:target==='record',recoveredBox:false,box:{x:800,y:300},returnHold:0,radioFlags:[],reason:null,rescues:0,clearedWrecks:0,assistanceUsed:false,reverseLeft:0,reverseX:0,reverseY:0,heading:-Math.PI/2,routeChoice:null,nearestDanger:null,repairPending:0,radioLog:[],sideChannels:[]
 };
 if(s.mission.repairBoost)s.upgrades.hull=1;s.player.hp=stats(s).maxHp;
 // Fixed damaged equipment follows mechanical cycles, never aims at the player.
 machine(s,'cutter',560,765,{phase:0});machine(s,'cutter',1040,765,{phase:Math.PI});
 machine(s,'winch',620,530,{baseAngle:Math.PI,reach:145,phase:0});
 machine(s,'winch',980,530,{baseAngle:0,reach:145,phase:2});
 machine(s,'cutter',255,360,{phase:1});machine(s,'cutter',1345,360,{phase:3});
 emit(s,'radio',{id:'arrival'});return s;
}
export function machineCycle(e,time){
 const cycle=(time+e.phase)%5.4;
 const mode=e.restrained>0?'bound':cycle<1.3?'warning':cycle<2.5?'active':'rest';
 const angle=(e.baseAngle||0)+(mode==='active'?-1.05+(cycle-1.3)/1.2*2.1:-1.05);
 return {mode,angle,tip:{x:e.x+Math.cos(angle)*(e.reach||0),y:e.y+Math.sin(angle)*(e.reach||0)},cycle};
}
export function activeWalls(s){return [...HARBOR.buildings.filter((w,i)=>!(i===5&&s.mission.sideChannels.includes('west'))&&!(i===6&&s.mission.sideChannels.includes('east'))),...HARBOR.platforms,...(s.mission.gateOpen?[]:[HARBOR.gate]),...s.mission.wrecks.filter(w=>w.intact)];}
export function intersectsWall(x,y,r,w){return x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h;}
export function moveAgainstWalls(s,previous){
 const p=s.player,walls=activeWalls(s);
 if(walls.some(w=>intersectsWall(p.x,p.y,16,w))){
  const canX=!walls.some(w=>intersectsWall(p.x,previous.y,16,w)),canY=!walls.some(w=>intersectsWall(previous.x,p.y,16,w));
  if(canX)p.y=previous.y;else if(canY)p.x=previous.x;else{p.x=previous.x;p.y=previous.y;}
 }
}
export function netTargets(s,points){
 const within=p=>inTriangle(p,...points),people=s.mission.people.filter(p=>p.state==='waiting'&&within(p));
 return {kind:people.length?'rescue':'cut',people,enemies:s.enemies.filter(e=>e.hp>0&&within(e)),wrecks:s.mission.wrecks.filter(w=>w.intact&&!w.heavy&&within({x:w.x+w.w/2,y:w.y+w.h/2}))};
}
export const RESCUE_NET_SECONDS={learning:45,regular:24};
export function rescueNetSeconds(s){return s.circuits===0?RESCUE_NET_SECONDS.learning:RESCUE_NET_SECONDS.regular;}
export function placeNet(s){
 const first=s.anchors.length===0;
 const placed=anchor(s,(state,points)=>{
  const m=state.mission,targets=netTargets(state,points);
  if(targets.kind==='rescue'){
   state.circuits++;for(const e of targets.enemies){e.restrained=3;e.timer=Math.max(e.timer,3);}
   m.fields.push({points:points.map(p=>({...p})),life:.8,people:targets.people.map(p=>p.id)});
   if(m.fields.length>3)m.fields.shift();emit(state,'lift',{count:targets.people.length});
  }else{
   const cutWinch=targets.enemies.some(e=>e.machine==='winch');
   circuit(state,points,false);
   if(cutWinch){m.routeChoice='cut';for(const e of targets.enemies.filter(e=>e.machine==='winch'&&!state.enemies.includes(e))){const side=e.x<800?'west':'east';if(!m.sideChannels.includes(side))m.sideChannels.push(side);}emit(state,'radio',{id:'cableCut'});}
   for(const w of targets.wrecks){w.intact=false;m.clearedWrecks++;emit(state,'routeCleared');}
   if(m.recordEnabled!==false&&!m.recoveredBox&&inTriangle(m.box,...points)){m.recoveredBox=true;emit(state,'radio',{id:'blackbox'});}
  }
 });
 if(placed&&first)s.anchorLife=rescueNetSeconds(s);
 return placed;
}
function rescue(s,person){
 if(person.state!=='waiting')return;
 person.state='aboard';s.mission.rescues++;s.bestCircuit=Math.max(s.bestCircuit,s.mission.rescues);
 emit(s,'radio',{id:person.id+'Rescued'});
 if(person.id==='engineer'){s.mission.repairPending=2.2;}
 if(person.id==='operator'){s.mission.gateOpen=true;s.mission.assistanceUsed=true;emit(s,'gate');}
}
export function rapidReverse(s){
 const m=s.mission;if(!m.repairBoost){emit(s,'needsEngineer');return false;}
 if(!dash(s))return false;
 // Heading, not the previous reverse velocity, determines the stern direction.
 m.reverseX=-Math.cos(m.heading);m.reverseY=-Math.sin(m.heading);m.reverseLeft=.23;return true;
}
export function guidance(s){
 const m=s.mission,p=s.player,aboard=m.people.some(p=>p.state==='aboard'),target=m.people.find(p=>p.state==='waiting');
 if(s.anchors.length===2)return 'close';
 if(s.anchors.length===1)return 'turn';
 if(aboard||m.target==='record'&&m.recoveredBox)return m.repairBoost&&m.wrecks.some(w=>w.heavy&&length(p,{x:w.x+w.w/2,y:w.y+w.h/2})<230)?'reverse':'home';
 if(target&&length(p,target)<215)return 'lift';
 if(s.enemies.some(e=>e.machine==='winch'&&length(p,e)<300))return 'winch';
 if(s.enemies.some(e=>e.machine==='cutter'&&length(p,e)<180))return 'cutter';
 return 'travel';
}
export function updateRescue(s,dt,input={}){
 if(s.status!=='playing')return;dt=clamp(Number.isFinite(dt)?dt:0,0,.05);
 const m=s.mission,p=s.player,previous={x:p.x,y:p.y},aboard=m.people.filter(p=>p.state==='aboard').length;
 if(m.repairPending>0){m.repairPending=Math.max(0,m.repairPending-dt);if(m.repairPending===0){m.repairBoost=true;emit(s,'radio',{id:'engineerReady'});}}
 for(const e of s.enemies)if(e.restrained>0)e.restrained=Math.max(0,e.restrained-dt);
 let x=input.x||0,y=input.y||0,reversing=m.reverseLeft>0;
 if(reversing){x=m.reverseX;y=m.reverseY;m.reverseLeft=Math.max(0,m.reverseLeft-dt);}
 else if(Math.hypot(x,y)>.1)m.heading=Math.atan2(y,x);
 updateBattle(s,dt,{x,y,moveScale:aboard&&!m.repairBoost?.85:1});
 if(reversing){
  for(const w of m.wrecks)if(w.intact&&w.heavy&&intersectsWall(p.x,p.y,30,w)){
   const next={...w,x:clamp(w.x+m.reverseX*850*dt,590,1120),y:clamp(w.y+m.reverseY*850*dt,760,940)};
   if(!HARBOR.buildings.some(b=>intersectsWall(next.x+next.w/2,next.y+next.h/2,Math.min(next.w,next.h)/2,b))){
    const distance=Math.hypot(next.x-w.x,next.y-w.y);w.x=next.x;w.y=next.y;w.moved=(w.moved||0)+distance;
    if(distance>0&&!m.assistanceUsed){m.assistanceUsed=true;emit(s,'routeCleared');}
   }
  }
 }
 moveAgainstWalls(s,previous);
 m.nearestDanger=null;
 for(const e of s.enemies){
  if(e.restrained>0)continue;
  if(length(p,e)<e.r+16)damagePlayer(s,e.damage);
  if(e.machine==='winch'){
   const cycle=machineCycle(e,s.time);
   if(length(p,e)<e.reach+45)m.nearestDanger=cycle.mode;
   if(cycle.mode==='active'&&segmentDistance(p,e,cycle.tip)<18)damagePlayer(s,14);
  }
 }
 if(s.status==='lost'){m.reason='disabled';return;}
 if(!m.routeChoice&&(p.x<100||p.x>1500)&&p.y<600)m.routeChoice='outer';
 for(const f of m.fields){f.life-=dt;if(f.life<=0)for(const id of f.people){const person=m.people.find(p=>p.id===id);if(person)rescue(s,person);}}
 m.fields=m.fields.filter(f=>f.life>0);
 if(s.time>240&&!m.radioFlags.includes('tide')){m.radioFlags.push('tide');emit(s,'radio',{id:'tide'});}
 if(s.time>315&&!m.radioFlags.includes('lastCall')){m.radioFlags.push('lastCall');emit(s,'radio',{id:'lastCall'});}
 const passengers=m.people.filter(p=>p.state==='aboard'),ready=passengers.length>0||m.target==='record'&&m.recoveredBox;
 if(ready&&length(p,HARBOR.extraction)<HARBOR.extraction.r){
  m.returnHold+=dt;
  if(m.returnHold>=1.3){for(const person of passengers)person.state='rescued';m.reason='returned';s.status='won';emit(s,'end');}
 }else m.returnHold=0;
 if(s.time>=m.deadline&&s.status==='playing'){s.status='lost';m.reason='tide';emit(s,'end');}
}
export function concludeMission(s,campaign){
 if(s.kind==='tow')return recordTowResult(s,campaign);
 const rescued=s.status==='won'?s.mission.people.filter(p=>p.state==='rescued').map(p=>p.id):[],c=readCampaign(JSON.stringify(campaign));
 c.missions++;c.crew=[...new Set([...c.crew,...rescued])];c.bestRescued=Math.max(c.bestRescued,rescued.length);
 if(s.status==='won'&&s.mission.recoveredBox)c.blackbox=true;
 c.lastOutcome={rescued,blackbox:s.status==='won'&&s.mission.recoveredBox,reason:s.mission.reason||'disabled'};return c;
}
export function restoreRescue(raw){
 try{if(JSON.parse(raw).kind==='tow')return restoreTow(raw);}catch{return null;}
 const s=restore(raw);if(!s||!s.mission||s.status!=='playing')return null;const m=s.mission;
 if(!m.sideChannels)m.sideChannels=[];
 if(m.recordEnabled===undefined)m.recordEnabled=m.target==='record';
 if(typeof m.recordEnabled!=='boolean'||s.anchorLife>RESCUE_NET_SECONDS.learning)return null;
 if(m.version===1){m.version=2;m.repairPending=0;m.radioLog=[];m.routeChoice=null;m.nearestDanger=null;for(const e of s.enemies){e.machine=e.kind==='shooter'?'winch':'cutter';e.speed=0;e.reach=e.kind==='shooter'?165:0;e.baseAngle=e.x<800?Math.PI:0;}s.shots=[];s.hazards=[];for(const w of m.wrecks)if(w.heavy)w.moved=0;}
 if(!Array.isArray(m.sideChannels)||m.sideChannels.some(v=>!['west','east'].includes(v)))return null;
 if(m.version!==2||!['engineer','operator','record'].includes(m.target)||!Array.isArray(m.people)||m.people.length>2||new Set(m.people.map(p=>p.id)).size!==m.people.length)return null;
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1600&&p.y>=0&&p.y<=1000;
 if(m.people.some(p=>!PEOPLE.includes(p.id)||!['waiting','aboard','shelter'].includes(p.state)||!point(p)))return null;
 if(!Array.isArray(m.fields)||m.fields.length>3||m.fields.some(f=>!Array.isArray(f.points)||f.points.length!==3||!Number.isFinite(f.life)||f.life<0||f.life>.8||!Array.isArray(f.people)||f.people.some(id=>!m.people.some(p=>p.id===id))||f.points.some(p=>!point(p))))return null;
 const ids=['left-wreck','right-wreck','dock-plate'];
 if(!Array.isArray(m.wrecks)||m.wrecks.length!==3||new Set(m.wrecks.map(w=>w.id)).size!==3||m.wrecks.some(w=>!ids.includes(w.id)||!point(w)||!['w','h'].every(k=>Number.isFinite(w[k])&&w[k]>0&&w[k]<350)||typeof w.intact!=='boolean'||typeof w.heavy!=='boolean'||w.heavy!==(w.id==='dock-plate')))return null;
 if(!Array.isArray(m.radioFlags)||m.radioFlags.some(v=>!['tide','lastCall'].includes(v))||m.deadline!==MISSION_DURATION||typeof m.gateOpen!=='boolean'||typeof m.repairBoost!=='boolean'||!Number.isFinite(m.returnHold)||m.returnHold<0||m.returnHold>1.3||!Number.isFinite(m.reverseLeft)||m.reverseLeft<0||m.reverseLeft>.23||!Number.isFinite(m.reverseX)||!Number.isFinite(m.reverseY)||Math.abs(m.reverseX)>1||Math.abs(m.reverseY)>1||!Number.isFinite(m.heading)||!point(m.box)||!Number.isInteger(m.rescues)||m.rescues<0||m.rescues>2||typeof m.recoveredBox!=='boolean')return null;
 const radioIds=['arrival','engineerCall','operatorCall','engineerRescued','operatorRescued','engineerReady','blackbox','tide','lastCall','cableCut'];
 if(!Number.isFinite(m.repairPending)||m.repairPending<0||m.repairPending>2.2||!Array.isArray(m.radioLog)||m.radioLog.length>100||m.radioLog.some(e=>!radioIds.includes(e.id)||!Number.isFinite(e.time)||e.time<0)||![null,'cut','outer'].includes(m.routeChoice))return null;
 return s;
}

export function readSaveBundle(raw){
 try{if(typeof raw!=='string'||raw.length>1800000)return null;const data=JSON.parse(raw),campaign=parseCampaign(data.campaign);if(data.version!==1||!campaign)return null;let run=data.run?restoreRescue(data.run):null;let upgraded=campaign;
  if(run?.kind==='tow'&&!run.voyage){if(!run.attemptId){const reserved=reserveTowAttempt(campaign,run.missionId);upgraded=reserved.campaign;run.attemptId=reserved.attemptId;}else if(run.attemptId>=campaign.nextAttemptId||run.attemptId<=campaign.progress[run.missionId].lastResolvedAttempt)run=null;}
  return {version:1,settings:data.settings||{},campaign:upgraded,run,rejectedRun:!!data.run&&!run};}catch{return null;}
}
