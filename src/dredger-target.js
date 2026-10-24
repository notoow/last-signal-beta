import {bossLinkCandidate,partPosition} from './rogue-core.js';
import {usesDredger} from './dredger-counterplay.js';
import {harborRoutePriority} from './harbor-plan.js';

const active=s=>s.status==='playing'&&s.mode==='sailing'&&usesDredger(s)&&s.boss.active&&!s.boss.cleared;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const dredgerPartName=(index,language='ko')=>(language==='en'?['Intake pump','Crane drive']:['흡입 펌프','크레인 구동부'])[index]||'';

// Read-only identity shared by the camera, world labels and offscreen guidance.
// Being exposed is not permission to connect: the real interaction predicate
// also checks range, the existing line and a connected supply vessel.
export function dredgerTarget(s){
  if(!active(s)||harborRoutePriority(s))return null;
  const candidate=bossLinkCandidate(s),hook=s.boss.hook;
  let index=hook>=0&&s.boss.parts[hook]>0?hook:candidate;
  if(index<0){
    let nearest=Infinity;
    s.boss.parts.forEach((hp,i)=>{
      const d=distance(s.boat,partPosition(s,i));
      if(hp>0&&d<nearest){index=i;nearest=d;}
    });
  }
  if(index<0)return null;
  return {index,point:partPosition(s,index),state:hook===index?'connected':s.boss.phase==='recover'?'exposed':'lure',linkable:candidate===index};
}

// Keep the locked circle / one-second impact presentation ahead of approach
// guidance. pending=false after the one real strike; no repeated damage implied.
export function dredgerThreat(s){
  if(!active(s))return null;
  const b=s.boss,c=b.crane;
  if(!c.target||!(b.phase==='warn'&&c.locked||b.phase==='attack'))return null;
  return {point:{...c.target},pending:b.phase!=='attack'||!c.impact};
}

export function dredgerAttention(s){
  // The connected tow retains its established camera priority.
  if(s.tow?.connected)return null;
  const threat=dredgerThreat(s);
  if(threat&&distance(s.boat,threat.point)<=360)return {kind:'threat',...threat.point,bounds:{left:66,right:66,top:66,bottom:66}};
  const target=dredgerTarget(s);
  if(!target||threat||distance(s.boat,target.point)>360)return null;
  return {kind:'drive',index:target.index,...target.point,bounds:{left:44,right:44,top:44,bottom:44},
    screenBounds:{left:44,right:44,top:54,bottom:0}};
}
