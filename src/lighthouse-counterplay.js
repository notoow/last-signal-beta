// A voyage opts in once. The lighthouse checks a physical radio link; towing
// force, collision damage and a stored burst never substitute for transmission.
import {hullHitsCircle} from './dredger-counterplay.js';
export const LIGHTHOUSE_MODEL='signal-v1';
export const LIGHTHOUSE={range:720,spread:.17,detection:.7,warning:2.3,impactTail:.25,
  recovery:2.5,radius:70,damage:38,signalTime:3,signalSpeed:18,signalAngle:.35,
  linkRange:110,breakRange:180};
export const RELAYS=[{x:2520,y:540},{x:2400,y:1040},{x:2960,y:1320}];
export const BREAKWATERS=[{x:2600,y:760},{x:2590,y:1120},{x:3050,y:1100}];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const usesLighthouse=s=>s.lighthouseModel===LIGHTHOUSE_MODEL&&s.depth===2&&!!s.boss.lighthouse;
export const newLighthouse=seed=>({direction:seed%2?1:-1,exposure:0,target:null,impact:false,
  impactAt:-1,hit:false,progress:[0,0,0],lastSent:-1,sentAt:-1,decoyUsed:0});
export const relayPosition=i=>RELAYS[i];
export function relayApproach(s,i){
  const p=RELAYS[i],a=Math.atan2(s.map.boss.y-p.y,s.map.boss.x-p.x);
  return {x:p.x-Math.cos(a)*90,y:p.y-Math.sin(a)*90,angle:a};
}
function pointSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}
function segmentDistance(a,b,c,d){
  const x=b.x-a.x,y=b.y-a.y,u=d.x-c.x,v=d.y-c.y,den=x*v-y*u;
  if(Math.abs(den)>1e-9){
    const t=((c.x-a.x)*v-(c.y-a.y)*u)/den,q=((c.x-a.x)*y-(c.y-a.y)*x)/den;
    if(t>=0&&t<=1&&q>=0&&q<=1)return 0;
  }
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
const ends=b=>{
  const r=(b.length-b.width)/2,x=Math.cos(b.angle)*r,y=Math.sin(b.angle)*r;
  return [{x:b.x-x,y:b.y-y},{x:b.x+x,y:b.y+y}];
};
const coverEnds=p=>[{x:p.x-20,y:p.y},{x:p.x+20,y:p.y}];
export function lighthouseSight(s,p){
  return !BREAKWATERS.some(c=>segmentDistance(s.map.boss,p,...coverEnds(c))<=35);
}
export function lighthouseBlocked(s,body){
  if(!usesLighthouse(s))return false;
  // The pivot is the elevated lamp mount. Its round floating base's waterline
  // centre is 18 world units below it (asset contract), never the antenna top.
  const base={x:s.map.boss.x-.878225,y:s.map.boss.y+18.131875};
  return hullHitsCircle(base,body,70)||RELAYS.some(p=>hullHitsCircle(p,body,16))||
    BREAKWATERS.some(p=>segmentDistance(...ends(body),...coverEnds(p))<=35+body.width/2);
}
// Each tested point includes the hull width. A stern still exposed beyond
// cover can be detected, even when the boat's centre is in shadow.
export function lighthouseVisible(s,body=s.boat){
  const p=s.map.boss,[a,b]=ends(body),r=body.width/2;
  const points=[a,body,b].flatMap(q=>[q,...[0,1,2,3,4,5,6,7].map(i=>({
    x:q.x+Math.cos(i*Math.PI/4)*r,y:q.y+Math.sin(i*Math.PI/4)*r}))]);
  return points.some(q=>dist(q,p)<=LIGHTHOUSE.range&&
    Math.abs(wrap(Math.atan2(q.y-p.y,q.x-p.x)-s.boss.aim))<=LIGHTHOUSE.spread&&lighthouseSight(s,q));
}
export function lighthouseRayLength(s,angle){
  const p=s.map.boss,point=r=>({x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r});
  if(lighthouseSight(s,point(LIGHTHOUSE.range)))return LIGHTHOUSE.range;
  let low=0,high=LIGHTHOUSE.range;
  for(let i=0;i<12;i++){const mid=(low+high)/2;if(lighthouseSight(s,point(mid)))low=mid;else high=mid;}
  return low;
}
export function lighthouseStatus(s){
  const b=s.boss,l=b.lighthouse,boat=s.boat;
  const nearest=RELAYS.reduce((best,p,i)=>b.parts[i]>0&&(best<0||dist(boat,p)<dist(boat,RELAYS[best]))?i:best,-1);
  const index=b.hook>=0?b.hook:nearest,p=RELAYS[index];
  const angle=Math.atan2(s.map.boss.y-boat.y,s.map.boss.x-boat.x);
  const speed=Math.hypot(boat.vx,boat.vy),aligned=Math.abs(wrap(angle-boat.angle))<=LIGHTHOUSE.signalAngle;
  const inRange=!!p&&dist(boat,p)<=LIGHTHOUSE.linkRange;
  const clear=lighthouseSight(s,boat);
  const linked=b.hook>=0,ready=linked&&inRange&&aligned&&speed<=LIGHTHOUSE.signalSpeed&&clear;
  const canConnect=!linked&&index>=0&&inRange&&!s.tow?.connected&&s.mode==='sailing'&&s.status==='playing'&&b.active&&!b.cleared;
  const pendingImpact=s.status==='playing'&&b.active&&!b.cleared&&b.phase==='attack'&&!l.impact&&!!l.target;
  return {index,linked,inRange,canConnect,towBlocked:!!s.tow?.connected,aligned,clear,speed,maxSpeed:LIGHTHOUSE.signalSpeed,angle,ready,
    progress:index<0?0:l.progress[index],required:LIGHTHOUSE.signalTime,
    sent:b.parts.filter(h=>h===0).length,total:3,phase:b.phase,remaining:Math.max(0,b.timer),
    exposure:l.exposure,detection:LIGHTHOUSE.detection+(s.tools.includes('shutter')?.7:0),
    visible:lighthouseVisible(s),target:l.target,impact:l.impact,hit:l.hit,
    pendingImpact,impactIn:pendingImpact?Math.max(0,b.timer-LIGHTHOUSE.impactTail):0,
    targetThreatensHull:pendingImpact&&hullHitsCircle(l.target,boat,LIGHTHOUSE.radius),
    hitAge:l.impactAt<0?Infinity:s.time-l.impactAt,lastSent:l.lastSent,sentAge:l.sentAt<0?Infinity:s.time-l.sentAt,
    canBurst:s.build==='winch'&&linked&&b.tension>.1&&s.charge>=35&&s.fuel>3};
}
function lockTarget(s,p){
  const b=s.boss,l=b.lighthouse;
  b.phase='attack';b.timer=LIGHTHOUSE.warning;b.aim=Math.atan2(p.y-s.map.boss.y,p.x-s.map.boss.x);
  l.target={x:p.x,y:p.y};l.impact=false;l.exposure=0;
}
export function tickLighthouse(s,dt){
  const b=s.boss,l=b.lighthouse,result={hit:false,sent:-1,locked:false,broken:false};
  if(b.phase==='warn'){
    const held=s.captain==='jeong'&&s.skill.left>0&&b.hook>=0&&b.tension>=.25;
    if(s.captain==='jeong'&&s.skill.left>0&&!held)s.skill.left=0;
    // A suspicious contact slows the scan. The shutter buys escape time; it
    // cannot make a stationary tug permanently immune just by owning the tool.
    if(!held)b.aim=wrap(b.aim+l.direction*(.42+b.parts.filter(h=>h===0).length*.06)*(l.exposure>0?.25:1)*dt);
    const decoy=s.captain==='han'&&s.skill.left>0&&s.skill.decoy&&s.skill.uses>l.decoyUsed;
    if(decoy&&dist(s.map.boss,s.skill.decoy)<=LIGHTHOUSE.range&&lighthouseSight(s,s.skill.decoy)){
      l.decoyUsed=s.skill.uses;lockTarget(s,s.skill.decoy);result.locked=true;
    }else{
      l.exposure=clamp(l.exposure+(lighthouseVisible(s)?dt:-dt*2),0,1.4);
      if(l.exposure>=LIGHTHOUSE.detection+(s.tools.includes('shutter')?.7:0)){
        lockTarget(s,s.boat);result.locked=true;
      }
    }
  }else{
    if(s.captain==='jeong'&&s.skill.left>0)s.skill.left=0;
    b.timer=Math.max(0,b.timer-dt);
    if(b.phase==='attack'&&!l.impact&&b.timer<=LIGHTHOUSE.impactTail){
      l.impact=true;l.impactAt=s.time;l.hit=hullHitsCircle(l.target,s.boat,LIGHTHOUSE.radius);
      result.hit=l.hit;
      if(l.hit){l.progress=l.progress.map((n,i)=>b.parts[i]===0?n:0);result.broken=b.hook>=0;b.hook=-1;b.tension=0;s.charge=0;}
    }
    if(b.timer<=0){
      if(b.phase==='attack'){b.phase='recover';b.timer=LIGHTHOUSE.recovery+(s.tools.includes('ratchet')?3:0);}
      else{b.phase='warn';b.cycle++;l.target=null;l.impact=false;l.exposure=0;}
    }
  }
  // A completed packet is retained. An interrupted partial packet drains, so
  // touching three zones at full speed cannot win the encounter.
  const a=lighthouseStatus(s);
  for(let i=0;i<3;i++){
    if(b.parts[i]===0)continue;
    l.progress[i]=clamp(l.progress[i]+(a.ready&&a.index===i&&!result.hit?dt:-dt*.6),0,LIGHTHOUSE.signalTime);
    if(l.progress[i]>=LIGHTHOUSE.signalTime-1e-9){
      l.progress[i]=LIGHTHOUSE.signalTime;b.parts[i]=0;l.lastSent=i;l.sentAt=s.time;
      l.direction*=-1;result.sent=i;b.hook=-1;b.tension=0;s.charge=0;
    }
  }
  return result;
}
export function validLighthouse(s,finite){
  if(!['legacy',LIGHTHOUSE_MODEL].includes(s.lighthouseModel))return false;
  const l=s.boss.lighthouse,b=s.boss;
  if(s.lighthouseModel!==LIGHTHOUSE_MODEL||s.depth!==2)return l===null;
  if(!l||![-1,1].includes(l.direction)||!finite(l.exposure,0,1.4)||typeof l.impact!=='boolean'||typeof l.hit!=='boolean'||
    !finite(l.impactAt,-1,s.time)||!finite(l.sentAt,-1,s.time)||!Number.isInteger(l.lastSent)||!finite(l.lastSent,-1,2)||
    !Number.isInteger(l.decoyUsed)||!finite(l.decoyUsed,0,s.skill.uses)||!Array.isArray(l.progress)||l.progress.length!==3)return false;
  if(l.progress.some((p,i)=>!finite(p,0,3)||![0,30].includes(b.parts[i])||(b.parts[i]===0)!==(p===3)))return false;
  if(l.target!==null&&(!finite(l.target?.x,0,s.map.width)||!finite(l.target?.y,0,s.map.height)||dist(l.target,s.map.boss)>LIGHTHOUSE.range+50))return false;
  if((b.phase==='attack'||l.impact)&&!l.target||l.impact&&l.impactAt<0)return false;
  if(b.hook>=0&&b.parts[b.hook]===0)return false;
  if(b.cleared&&b.parts.some(h=>h>0))return false;
  return l.lastSent<0?l.sentAt===-1:l.sentAt>=0&&b.parts[l.lastSent]===0;
}
