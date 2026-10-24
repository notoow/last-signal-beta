import {hullMass} from './ship-motion.js';

export const SLUICE_MODEL='ram-v1';
export const SLUICE={
  gateX:3020,laneYs:[600,900,1200],left:2400,right:2994,halfWidth:110,
  warning:3.8,lockTime:2.2,attack:4.2,backwash:.8,recovery:4,
  requiredSpeed:150,heading:.82,strikeHalfWidth:20,force:55,returnForce:170
};
export const usesSluice=s=>s.sluiceModel===SLUICE_MODEL&&s.depth===1&&!!s.boss.sluice;
export const newSluice=()=>({lane:1,locked:false,lastHit:-1,hitAt:-1,lastImpact:'none',impactSpeed:0});
export const sluiceGate=i=>({x:SLUICE.gateX,y:SLUICE.laneYs[i]});
export const sluiceCleat=i=>({x:2640,y:SLUICE.laneYs[i]});
// Actual contacts only. A restored open gate never replays its breakthrough.
const impacts=new WeakMap();
export const sluiceImpactSequence=s=>impacts.get(s)?.id??0;
function publishContact(s,lane,outcome,obstacles){
  const b=s.boat,previous=impacts.get(s);
  const contacts=obstacles.filter(r=>capsuleRect(b,r)).map(r=>({
    x:Math.max(r.x,Math.min(r.x+r.w,b.x)),y:Math.max(r.y,Math.min(r.y+r.h,b.y))
  }));
  const contact=contacts.reduce((best,p)=>Math.hypot(p.x-b.x,p.y-b.y)<Math.hypot(best.x-b.x,best.y-b.y)?p:best);
  const event=Object.freeze({id:(previous?.id??0)+1,time:s.time,depth:s.depth,lane,outcome,life:.9,
    point:Object.freeze(sluiceGate(lane)),contactPoint:Object.freeze(contact),
    speed:Math.hypot(b.vx,b.vy),normalSpeed:Math.max(0,b.vx)});
  impacts.set(s,{id:event.id,boss:s.boss,event});
}
export function recentSluiceImpact(s){
  const current=impacts.get(s),event=current?.event,age=event?s.time-event.time:Infinity;
  return event&&current.boss===s.boss&&usesSluice(s)&&s.status==='playing'&&s.mode==='sailing'&&
    event.depth===s.depth&&age>=0&&age<event.life?Object.freeze({...event,age}):null;
}
// Capture the sequence before tickRun, then dispatch at most once after it.
export function sluiceImpactCue(s,previous){
  const event=recentSluiceImpact(s);
  return event&&event.id>previous?(event.outcome==='opened'?'circuit':'anchor'):null;
}
const target=s=>s.skill?.left>0&&s.skill.decoy?s.skill.decoy:s.boat;
export function beginSluice(s){
  const a=s.boss.sluice;a.locked=false;trackSluice(s);
}
export function trackSluice(s){
  const a=s.boss.sluice;
  if(a.locked)return;
  const p=target(s);
  const intact=s.boss.parts.map((hp,i)=>({hp,i})).filter(x=>x.hp>0);
  if(!intact.length)return;
  a.lane=intact.reduce((best,x)=>Math.abs(p.y-SLUICE.laneYs[x.i])<Math.abs(p.y-SLUICE.laneYs[best.i])?x:best).i;
  s.boss.aim=Math.atan2(SLUICE.laneYs[a.lane]-s.map.boss.y,SLUICE.left-s.map.boss.x);
  if(s.boss.timer<=SLUICE.lockTime)a.locked=true;
}
export const sluiceExposed=s=>usesSluice(s)&&!s.boss.cleared&&s.boss.phase==='attack'&&
  s.boss.timer>SLUICE.backwash&&s.boss.parts[s.boss.sluice.lane]>0;
export function hullInSluice(s,body=s.boat){
  const y=SLUICE.laneYs[s.boss.sluice.lane],half=(body.length-body.width)/2;
  const rx=Math.abs(Math.cos(body.angle))*half+body.width/2;
  const ry=Math.abs(Math.sin(body.angle))*half+body.width/2;
  return body.x+rx>=SLUICE.left&&body.x-rx<=SLUICE.right&&
    Math.abs(body.y-y)<=SLUICE.halfWidth+ry;
}
export function applySluiceFlow(s,dt){
  if(!usesSluice(s)||s.boss.cleared||s.boss.phase!=='attack')return;
  // A current force, not a coordinate tween or an invisible damage strip.
  const force=s.boss.timer>SLUICE.backwash?SLUICE.force:-SLUICE.returnForce;
  if(hullInSluice(s))s.boat.vx+=force/hullMass(s)*(s.shielded?.25:1)*dt;
  if(s.tow&&s.tow.hp>0&&!s.tow.anchor&&hullInSluice(s,s.tow))s.tow.vx+=force/1.8*dt;
}
// Capsule/axis-aligned rectangle overlap. Endpoint circles and the centre-line
// intersections cover the complete hull, including rotated bows at gate posts.
function capsuleRect(b,r){
  const d=(b.length-b.width)/2,rad=b.width/2;
  const a={x:b.x-Math.cos(b.angle)*d,y:b.y-Math.sin(b.angle)*d};
  const z={x:b.x+Math.cos(b.angle)*d,y:b.y+Math.sin(b.angle)*d};
  const pointRect=p=>Math.hypot(Math.max(r.x-p.x,0,p.x-r.x-r.w),Math.max(r.y-p.y,0,p.y-r.y-r.h));
  if(pointRect(a)<=rad||pointRect(z)<=rad)return true;
  const dx=z.x-a.x,dy=z.y-a.y,dd=dx*dx+dy*dy;
  for(const x of [r.x,r.x+r.w])for(const y of [r.y,r.y+r.h]){
    const t=dd?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/dd)):0;
    if(Math.hypot(a.x+t*dx-x,a.y+t*dy-y)<=rad)return true;
  }
  let lo=0,hi=1;
  for(const [start,delta,min,max] of [[a.x,dx,r.x,r.x+r.w],[a.y,dy,r.y,r.y+r.h]]){
    if(Math.abs(delta)<1e-9){if(start<min||start>max)return false;}
    else{const t1=(min-start)/delta,t2=(max-start)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
  }
  return lo<=hi;
}
function gateObstacles(s,i){
  const p=sluiceGate(i);
  const piers=[{x:p.x-41,y:p.y-110,w:82,h:74},{x:p.x-41,y:p.y+36,w:82,h:74}];
  return s.boss.parts[i]>0?[...piers,{x:p.x-26,y:p.y-36,w:52,h:72}]:piers;
}
export const sluiceBlocked=(s,body)=>usesSluice(s)&&[0,1,2].some(i=>gateObstacles(s,i).some(r=>capsuleRect(body,r)));
export function sluiceContact(s,old){
  if(!usesSluice(s))return null;
  const b=s.boat,a=s.boss.sluice;
  for(let i=0;i<3;i++){
    const p=sluiceGate(i);
    // Open gates retain their two solid stone piers; the centre really clears.
    const obstacles=gateObstacles(s,i);
    if(!obstacles.some(r=>capsuleRect(b,r)))continue;
    const pierHit=obstacles.slice(0,2).some(r=>capsuleRect(b,r));
    const plateHit=obstacles.length===3&&capsuleRect(b,obstacles[2]);
    const normalSpeed=Math.max(0,b.vx);
    const front=old.x<p.x-26&&b.x>=old.x;
    const centred=Math.abs(b.y-p.y)<=SLUICE.strikeHalfWidth;
    const aligned=Math.cos(b.angle)>=SLUICE.heading;
    const open=plateHit&&!pierHit&&s.boss.parts[i]>0&&i===a.lane&&sluiceExposed(s)&&front&&centred&&aligned&&normalSpeed>=SLUICE.requiredSpeed;
    if(open){
      s.boss.parts[i]=0;a.lastHit=i;a.hitAt=s.time;a.lastImpact='opened';a.impactSpeed=normalSpeed;
      s.boss.hook=-1;s.boss.tension=0;s.charge=0;
      publishContact(s,i,'opened',obstacles);
      return {opened:true,lane:i,speed:normalSpeed,damage:8};
    }
    const speed=Math.hypot(b.vx,b.vy);
    if(speed>38&&b.inv<=0){
      a.lastHit=i;a.hitAt=s.time;a.impactSpeed=normalSpeed;
      a.lastImpact=pierHit||!centred?'pier':!sluiceExposed(s)||i!==a.lane?'closed':!aligned||!front?'angle':'slow';
      publishContact(s,i,a.lastImpact,obstacles);
    }
    return {opened:false,lane:i,speed:normalSpeed,damage:speed>38?Math.max(12,(speed-25)*.15):0};
  }
  return null;
}
export function sluiceStatus(s){
  if(!usesSluice(s))return null;
  const b=s.boss,a=b.sluice;
  return {lane:a.lane,phase:b.phase,locked:a.locked,remaining:Math.max(0,b.timer),
    opened:b.parts.filter(h=>h<=0).length,total:3,speed:Math.max(0,s.boat.vx),
    requiredSpeed:SLUICE.requiredSpeed,aligned:Math.cos(s.boat.angle)>=SLUICE.heading,
    centred:Math.abs(s.boat.y-SLUICE.laneYs[a.lane])<=SLUICE.strikeHalfWidth,
    backwash:b.phase==='attack'&&b.timer<=SLUICE.backwash,
    exposed:sluiceExposed(s),hooked:b.hook>=0,
    canBurst:s.build==='winch'&&b.hook>=0&&b.tension>.1&&s.charge>=35&&s.fuel>3,
    lastImpact:a.lastImpact,hitAge:a.hitAt<0?Infinity:s.time-a.hitAt};
}
export function validSluice(s,finite){
  if(!['legacy',SLUICE_MODEL].includes(s.sluiceModel))return false;
  if(s.sluiceModel!==SLUICE_MODEL||s.depth!==1)return s.boss.sluice===null;
  const a=s.boss.sluice;
  return !!a&&Number.isInteger(a.lane)&&finite(a.lane,0,2)&&typeof a.locked==='boolean'&&
    Number.isInteger(a.lastHit)&&finite(a.lastHit,-1,2)&&finite(a.hitAt,-1,s.time)&&
    ['none','opened','slow','angle','closed','pier'].includes(a.lastImpact)&&finite(a.impactSpeed,0,2000)&&
    s.boss.parts.every(h=>h===0||h===30);
}
