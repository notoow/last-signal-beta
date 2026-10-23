import {CAPTAIN_VESSELS} from './captain-vessels.js';

export const WATER_PROFILE='water-v1';
export const waterMotion=s=>s.physicsProfile===WATER_PROFILE;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const masses={woo:1.6,park:.85,han:1.15,jeong:1.35};
const controls=new WeakMap();
export const hullMass=s=>masses[s.captain];

// Generator v1/v2 stores the old acceleration field. Convert it explicitly to
// water velocity at the old tug's neutral equilibrium; never reinterpret saves.
export function waterVelocity(s){
  const c=s.map.current;
  return {x:c.x/.85,y:c.y/.85};
}
// Hull-local resistance. C and Space do not change these natural coefficients.
export function waterForce(body,water){
  const fx=Math.cos(body.angle),fy=Math.sin(body.angle);
  const x=body.vx-water.x,y=body.vy-water.y;
  const forward=x*fx+y*fy,side=-x*fy+y*fx;
  return {x:-.8*forward*fx+1.8*side*fy,y:-.8*forward*fy-1.8*side*fx};
}
export function driftBody(body,water,mass,dt){
  const force=waterForce(body,water);
  body.vx+=force.x/mass*dt;body.vy+=force.y/mass*dt;
}
export function releaseShipAssist(s){if(s?.boat)controls.delete(s.boat);}
export function shipMotionStatus(s){
  if(s.mode==='ashore'||s.mode==='moored')return {mode:'moored',load:0,fuelRate:0};
  return controls.get(s.boat)||{mode:'neutral',load:0,fuelRate:.025};
}
export function motionLabel(s,language='ko'){
  if(shipMotionStatus(s).mode==='neutral'&&Math.hypot(s.boat.vx,s.boat.vy)<.75)return language==='en'?'Neutral':'중립';
  const en=language==='en',labels=en?{
    neutral:'Neutral · drifting',drive:'Under power',precision:'Precision thrust',
    braking:'Braking assist',holding:'Position assist',slipping:'Thrust limit · drifting',
    brace:'Emergency brace',moored:'Moored'
  }:{
    neutral:'중립 · 표류',drive:'추진 중',precision:'정밀 추진',
    braking:'감속 보조',holding:'정지 보조',slipping:'출력 부족 · 표류 중',
    brace:'비상 버팀',moored:'계류됨'
  };
  return labels[shipMotionStatus(s).mode];
}
export function stepShipMotion(s,input,dt,power=1){
  const b=s.boat,mass=hullMass(s),water=waterVelocity(s);
  const braced=s.captain==='woo'&&s.skill.left>0,dashing=s.captain==='park'&&s.skill.left>0;
  const mag=braced||dashing?0:Math.hypot(input.x||0,input.y||0),assist=!dashing&&(braced||!!input.brake);
  const precision=!!input.precision,boosting=!!input.boost&&mag>0&&!assist&&!precision&&s.boost>0;
  let c=controls.get(b);
  if(!c||!assist)c={mode:'neutral',target:null,load:0,fuelRate:.025,overload:0};
  const previousSpeed=Math.hypot(b.vx,b.vy);
  if(assist){
    if(c.target&&Math.hypot(c.target.x-b.x,c.target.y-b.y)>80)c.target=null;
    if(!c.target&&Math.hypot(b.vx,b.vy)<12)c.target={x:b.x,y:b.y,angle:b.angle};
  }else c.target=null;
  const turn=CAPTAIN_VESSELS[s.captain].turn,maxAngular=turn*8;
  const heading=mag?Math.atan2(input.y||0,input.x||0):assist&&c.target?c.target.angle:null;
  if(assist&&c.target&&mag)c.target.angle=heading;
  const desiredTurn=heading===null?0:clamp(wrap(heading-b.angle)*4,-turn,turn);
  let angular=heading===null?0:clamp((desiredTurn-(b.omega||0))*8,-maxAngular,maxAngular);
  const fx=Math.cos(b.angle),fy=Math.sin(b.angle);
  const capacity=(assist?190*(braced?3:1):boosting?220:precision?40:110)*power;
  const lateral=95*power*(braced?3:1);
  let forward=0,side=0;
  if(assist){
    const dx=c.target?c.target.x-b.x:0,dy=c.target?c.target.y-b.y:0;
    const x=(dx*2.5-b.vx*3.8)*mass,y=(dy*2.5-b.vy*3.8)*mass;
    forward=x*fx+y*fy;side=-x*fy+y*fx;
  }else if(mag)forward=capacity*Math.min(1,mag)*Math.cos(wrap(heading-b.angle));
  // One effort budget: steering and transverse assist cannot each get a full
  // engine in the same step. Reverse is weaker than forward assist.
  const foreLimit=forward<0&&assist?capacity*.8:capacity;
  const demand=Math.abs(forward)/foreLimit+Math.abs(side)/lateral+Math.abs(angular)/maxAngular*.2;
  const allocation=1/Math.max(1,demand);
  forward*=allocation;side*=allocation;angular*=allocation;
  driftBody(b,water,mass,dt);
  b.vx+=(fx*forward-fy*side)/mass*dt;b.vy+=(fy*forward+fx*side)/mass*dt;
  // Park's short side-jet includes heading stabilization; neutral steering
  // retains inertia, but the active ability must not inherit an old turn.
  b.omega=dashing?0:((b.omega||0)+angular*dt)*Math.exp(-2*dt);
  b.angle=wrap(b.angle+b.omega*dt);
  c.load=(Math.abs(forward)+Math.abs(side))/110+Math.abs(angular)/maxAngular*.2;
  c.fuelRate=.025+.13*c.load+(boosting?.24:0);
  // Saturation while actually slowing is ordinary braking, not a failed hold.
  // Warn only after sustained drift against an exhausted assist budget.
  const slipping=assist&&demand>1.03&&(c.target?
    Math.hypot(c.target.x-b.x,c.target.y-b.y)>8:
    Math.hypot(b.vx,b.vy)>=previousSpeed-.5*dt);
  c.overload=slipping?c.overload+dt:Math.max(0,c.overload-2*dt);
  c.mode=braced?'brace':assist?(c.overload>.6?'slipping':c.target?'holding':'braking'):mag?(precision?'precision':'drive'):'neutral';
  controls.set(b,c);
  return {boosting,fuelRate:c.fuelRate};
}
