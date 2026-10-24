// The warning, impact and artwork share world-space geometry. Old voyages keep
// their original cone attack; this rule is chosen once, when a run is created.
export const DREDGER_MODEL='counterplay-v1';
export const CRANE={reach:360,radius:60,driveRadius:24,partRadius:84,lockTime:2,hullDamage:42,partDamage:18,attackTime:1};
export const usesDredger=s=>s.bossModel===DREDGER_MODEL&&s.depth===0&&!!s.boss.crane;
export const craneLockTime=s=>CRANE.lockTime+(s.boss.parts[1]<=0?.6:0);
export const craneWarningTime=s=>1.4+craneLockTime(s);
export const newCrane=()=>({target:null,locked:false,impact:false,selfHits:0,lastHit:-1,hitAt:-1,impactAt:-1,lastDamage:0});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Ephemeral physical outcomes, not inferred from a rendered or restored state.
// All three damage paths publish at the positive-to-zero transition itself.
const driveBreaks=new WeakMap();
export function recordDredgerBreak(s,index,before,position,cause){
  if(!usesDredger(s)||s.status!=='playing'||!s.boss.active||!(before>0)||
    ![0,1].includes(index)||s.boss.parts[index]!==0||!['tow','winch','crane'].includes(cause))return;
  const old=driveBreaks.get(s);
  if(old?.boss===s.boss&&old.events.some(e=>e.index===index))return;
  const dx=s.boat.x-position.x,dy=s.boat.y-position.y,d=Math.hypot(dx,dy)||1;
  const event=Object.freeze({id:(old?.id??0)+1,index,cause,time:s.time,depth:s.depth,life:1.1,
    point:Object.freeze({x:position.x,y:position.y}),
    vector:Object.freeze(cause==='crane'?{x:0,y:1}:{x:dx/d,y:dy/d})});
  driveBreaks.set(s,{id:event.id,boss:s.boss,events:[...(old?.boss===s.boss?old.events:[]),event].slice(-2)});
}
export function recentDredgerBreaks(s){
  if(!usesDredger(s)||s.status!=='playing'||s.mode!=='sailing')return [];
  const current=driveBreaks.get(s);
  return (current?.boss===s.boss?current.events:[]).flatMap(event=>{
    const age=s.time-event.time;
    return event.depth===s.depth&&age>=0&&age<event.life?[Object.freeze({...event,age})]:[];
  });
}
function aimedPoint(s){
  const origin=s.map.boss,target=s.skill.left>0&&s.skill.decoy?s.skill.decoy:s.boat;
  const d=distance(origin,target),scale=d>CRANE.reach?CRANE.reach/d:1;
  return {x:origin.x+(target.x-origin.x)*scale,y:origin.y+(target.y-origin.y)*scale};
}
export function beginCrane(s){
  if(!usesDredger(s))return;
  Object.assign(s.boss.crane,{target:aimedPoint(s),locked:false,impact:false});
}
export function trackCrane(s){
  const b=s.boss,c=b.crane;
  if(!c.target)c.target=aimedPoint(s);
  if(!c.locked&&b.timer>craneLockTime(s))c.target=aimedPoint(s);
  else c.locked=true;
  b.aim=Math.atan2(c.target.y-s.map.boss.y,c.target.x-s.map.boss.x);
}
export function hullHitsCircle(target,hull,radius){
  if(!target)return false;
  const dx=target.x-hull.x,dy=target.y-hull.y,cos=Math.cos(hull.angle),sin=Math.sin(hull.angle);
  const x=dx*cos+dy*sin,y=-dx*sin+dy*cos,end=(hull.length-hull.width)/2;
  return Math.hypot(x-Math.max(-end,Math.min(end,x)),y)<=radius+hull.width/2;
}
export const craneHitsHull=(target,hull)=>hullHitsCircle(target,hull,CRANE.radius);
export function strikeCrane(s,positions){
  const b=s.boss,c=b.crane;
  if(c.impact||!c.target)return {hitHull:false,part:-1};
  c.impact=true;c.locked=true;c.impactAt=s.time;
  // One bucket can hit at most one intact drive. No automatic aim snapping.
  let part=-1,nearest=CRANE.partRadius;
  positions.forEach((p,i)=>{
    const d=distance(c.target,p);
    if(b.parts[i]>0&&d<=nearest){part=i;nearest=d;}
  });
  if(part>=0){
    const before=b.parts[part];
    c.lastDamage=Math.min(b.parts[part],CRANE.partDamage);
    b.parts[part]-=c.lastDamage;c.lastHit=part;c.hitAt=s.time;c.selfHits++;
    recordDredgerBreak(s,part,before,positions[part],'crane');
  }
  return {hitHull:craneHitsHull(c.target,s.boat),part};
}
export function validCrane(s,finite){
  const c=s.boss.crane;
  if(s.bossModel!==DREDGER_MODEL||s.depth!==0)return c===null;
  if(!c||typeof c.locked!=='boolean'||typeof c.impact!=='boolean'||
    !Number.isInteger(c.selfHits)||!finite(c.selfHits,0,4)||
    !Number.isInteger(c.lastHit)||!finite(c.lastHit,-1,1)||
    !finite(c.hitAt,-1,s.time)||!finite(c.impactAt,-1,s.time)||!finite(c.lastDamage,0,CRANE.partDamage))return false;
  if(c.target!==null&&(!finite(c.target.x,0,s.map.width)||!finite(c.target.y,0,s.map.height)||distance(c.target,s.map.boss)>CRANE.reach+.001))return false;
  if((c.locked||c.impact)&&!c.target)return false;
  if(c.impact&&(!c.locked||c.impactAt<0))return false;
  if(c.selfHits===0)return c.lastHit===-1&&c.hitAt===-1&&c.lastDamage===0;
  return c.lastHit>=0&&c.hitAt>=0&&c.lastDamage>0;
}
