import {walkableAt} from './rogue-map.js';
import {toolBerth,sightLine} from './shore-encounters.js';
import {shoreRoute,shoreWaypoint,shoreSegment} from './shore-navigation.js';
import {visibleAt} from './rogue-vision.js';
import {recordVoyage} from './rogue-voyage-record.js';

export const RESCUE=Object.freeze({order:44,ladder:24,follow:40,speed:48,notice:90,leash:180,hp:24,crew:20,ammo:4});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=s=>s.depth===0&&['waiting','following'].includes(s.rescue?.stage);
function say(s,id,text){
  if(s.log.some(l=>l.id===id))return;
  s.log.push({id,text,time:s.time,depth:s.depth});s.radio={text,left:7};
}
export function newShoreRescue(s){
  if(s.generator!==2||!s.combat)return null;
  // A person is a separate reason to visit a quay, never an extra roll in the
  // compulsory counter-tool chest. Placement must have a real walkable exit.
  const candidates=s.map.berths.filter(b=>b.id!==toolBerth(s).id);
  const first=(s.seed>>>1)%candidates.length;
  for(let n=0;n<candidates.length;n++){
    const berth=candidates[(first+n)%candidates.length];
    for(let radius=36;radius<=120;radius+=12)for(let i=0;i<12;i++){
      const p={x:berth.loot.x+Math.cos(i*Math.PI/6)*radius,y:berth.loot.y+Math.sin(i*Math.PI/6)*radius};
      if(distance(p,berth.landing)<70||!walkableAt(s.map,p,9)||!shoreRoute(s.map,p,berth.landing,9))continue;
      return {...p,site:berth.island,quay:berth.island,stage:'waiting',angle:Math.PI/2,stride:0,moving:false,discovered:false,blocked:null};
    }
  }
  // The generator guarantees each cache-to-ladder route. This fallback keeps
  // a rescue possible even when nearby decoration fills the preferred spots.
  const b=candidates[first];
  return {...b.loot,site:b.island,quay:b.island,stage:'waiting',angle:Math.PI/2,stride:0,moving:false,discovered:false,blocked:null};
}
export const rescueBerth=s=>s.depth===0&&s.rescue?s.map.berths.find(b=>b.island===(active(s)?s.rescue.quay:s.rescue.site)):null;
export const rescuePendingAt=(s,id)=>active(s)&&s.rescue.discovered&&rescueBerth(s)?.id===id;
// Update on an explicit order or boarding attempt, not every render. The chart
// marks a physically reachable pickup quay; site remains the historical origin.
function markPickup(s,following){
  const r=s.rescue,old=rescueBerth(s),home=s.map.berths.find(b=>b.id===s.mooring);
  const routes=s.map.berths.map(b=>{
    const path=shoreRoute(s.map,r,b.landing,9);if(!path)return null;
    let from=r,length=0;for(const p of path){length+=distance(from,p);from=p;}
    return {b,length};
  }).filter(Boolean).sort((a,b)=>a.length-b.length);
  const pickup=(following&&routes.find(x=>x.b.id===home?.id)||routes[0])?.b;
  if(!pickup)return;
  r.quay=pickup.island;
  if(s.harborIntel?.target===old?.id)s.harborIntel.target=pickup.id;
}
export function rescueStatus(s){
  const r=s.rescue;if(!r)return null;
  const ground=active(s),home=s.map.berths.find(b=>b.id===s.mooring);
  const boarding=ground&&s.mode==='ashore'&&!!s.person&&!!home&&distance(s.person,home.landing)<36;
  return {active:ground,site:r.site,stage:r.stage,discovered:r.discovered,point:r,blocked:r.blocked,
    near:ground&&s.mode==='ashore'&&!!s.person&&distance(s.person,r)<=RESCUE.order&&sightLine(s.map,s.person,r),
    boarding,ready:boarding&&distance(r,home.landing)<=RESCUE.ladder&&shoreSegment(s.map,r,home.landing,9),
    distance:distance(s.person||s.boat,r)};
}
export function orderRescue(s){
  const a=rescueStatus(s);if(!a?.near||a.boarding)return false;
  const r=s.rescue;r.discovered=true;r.stage=r.stage==='following'?'waiting':'following';r.blocked=null;r.moving=false;
  markPickup(s,r.stage==='following');
  s.work=0;
  say(s,r.stage==='following'?'rescue-follow':'rescue-wait',r.stage==='following'?
    '정비공: 같이 가요. 짐승이 길을 막으면 못 움직여요. 너무 앞서가지 말아요.':
    '정비공: 여기서 기다릴게요. 돌아오면 다시 불러 주세요.');
  return true;
}
export function tickRescue(s,dt){
  if(!active(s))return;
  const r=s.rescue;r.moving=false;
  if(!r.discovered&&visibleAt(s,r)){
    r.discovered=true;
    say(s,'rescue-found','정비공: 여기 사람이 있어요! 가까이 와서 E로 불러 주세요. 배까지 데려가면 공구와 구급품을 나눌게요.');
  }
  r.blocked=null;
  if(r.stage!=='following'||s.mode!=='ashore'||!s.person)return;
  const d=distance(r,s.person);
  if(d>RESCUE.leash){r.blocked='distant';return;}
  if(s.combat.enemies.some(e=>e.hp>0&&e.kind!=='gull'&&distance(e,r)<RESCUE.notice&&sightLine(s.map,r,e)&&shoreSegment(s.map,r,e,1))){
    r.blocked='threat';
    if(visibleAt(s,r))say(s,'rescue-threat','정비공: 앞에 짐승이 있어요! Q로 유인하거나 길을 확보해 주세요.');
    return;
  }
  // When the captain reaches the ladder, complete the last few steps to the
  // ladder itself. A following gap must not leave someone permanently just
  // outside boarding range while both actors stand still.
  const home=s.map.berths.find(b=>b.id===s.mooring),atLadder=home&&distance(s.person,home.landing)<36;
  const target=atLadder?home.landing:s.person,gap=atLadder?12:RESCUE.follow,remaining=distance(r,target);
  if(remaining<=gap)return;
  const p=shoreWaypoint(s.map,r,target,9,s.time);
  if(!p){r.blocked='route';return;}
  const reach=distance(r,p);if(reach<.01)return;
  const step=Math.min(reach,Math.max(0,remaining-gap),RESCUE.speed*dt);
  const before={x:r.x,y:r.y},dx=(p.x-r.x)/reach*step,dy=(p.y-r.y)/reach*step;
  if(walkableAt(s.map,{x:r.x+dx,y:r.y},9))r.x+=dx;
  if(walkableAt(s.map,{x:r.x,y:r.y+dy},9))r.y+=dy;
  const moved=distance(r,before);r.moving=moved>.001;r.stride+=moved;
  if(r.moving)r.angle=Math.atan2(r.y-before.y,r.x-before.x);
}
export function boardRescue(s,hullCap){
  const a=rescueStatus(s);if(!a?.active)return false;
  const r=s.rescue;r.moving=false;r.blocked=null;
  if(!a.ready){
    if(r.stage==='following'){
      r.stage='waiting';
      say(s,'rescue-board-alone','Park: 정비공은 아직 부두에 있어. 다시 내려서 데려올 수 있어.');
    }
    if(r.discovered)markPickup(s,false);
    return false;
  }
  const pickup=rescueBerth(s);
  const before={hp:s.hp,crew:s.crewHp,ammo:s.combat.ammo};
  r.stage='aboard';r.discovered=true;
  s.hp=Math.min(hullCap,s.hp+RESCUE.hp);s.crewHp=Math.min(100,s.crewHp+RESCUE.crew);s.combat.ammo=Math.min(12,s.combat.ammo+RESCUE.ammo);
  recordVoyage(s,'rescue',{site:r.site,outcome:'aboard',discovered:true,hp:s.hp-before.hp,crew:s.crewHp-before.crew,ammo:s.combat.ammo-before.ammo});
  if(s.harborIntel?.target===pickup?.id)s.harborIntel.target=null;
  say(s,'rescue-aboard','정비공: 배에 탔어요. 챙긴 공구로 선체를 손보고, 구급품과 고철도 나눠둘게요. 제 이름도 명부에 올려 주세요.');
  return true;
}
export function leaveRescue(s){
  if(!active(s))return;
  const r=s.rescue;r.stage='left-behind';r.blocked=null;r.moving=false;
  recordVoyage(s,'rescue',{site:r.site,outcome:'left-behind',discovered:r.discovered,hp:0,crew:0,ammo:0});
  if(r.discovered)say(s,'rescue-left','Park: 정비공은 폐항에 남았어. 확인한 위치는 명부에 남겨둘게.');
}
export function validRescue(s){
  const r=s.rescue;if(r===null)return true;
  const num=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
  if(!r||s.generator!==2||!s.combat||!Number.isInteger(r.site)||!num(r.site,0,2)||!Number.isInteger(r.quay)||!num(r.quay,0,2)||
    !['waiting','following','aboard','left-behind'].includes(r.stage)||
    !num(r.x,0,3400)||!num(r.y,0,1800)||!num(r.angle,-Math.PI,Math.PI)||!num(r.stride,0,1e9)||
    !['moving','discovered'].every(k=>typeof r[k]==='boolean')||![null,'threat','distant','route'].includes(r.blocked))return false;
  if(r.stage==='following'&&(!r.discovered||s.mode!=='ashore'))return false;
  if(r.stage==='aboard'&&!r.discovered)return false;
  if(r.stage!=='following'&&(r.moving||r.blocked!==null))return false;
  if(s.depth>0&&!['aboard','left-behind'].includes(r.stage))return false;
  if(s.depth===0&&r.stage==='left-behind')return false;
  if(active(s)&&!walkableAt(s.map,r,9))return false;
  return true;
}
