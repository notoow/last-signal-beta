// Read-only boss instrument; collision decisions remain in sluice-counterplay.
import {SLUICE,sluiceStatus} from './sluice-counterplay.js';
import {harborRoutePriority} from './harbor-plan.js';
export function sluiceInstrument(s,{active=true,mapOpen=false}={}){
  if(!active||mapOpen||s.status!=='playing'||s.mode!=='sailing'||!s.boss.active||s.boss.cleared||harborRoutePriority(s))return null;
  const a=sluiceStatus(s);if(!a)return null;
  const phase=a.backwash?'backwash':a.exposed?'open':a.phase==='warn'?(a.locked?'locked':'tracking'):a.phase==='attack'?'opened':'recover';
  return {lane:a.lane+1,phase,seconds:phase==='open'?Math.max(0,a.remaining-SLUICE.backwash):a.remaining,
    speed:a.speed,speedDisplay:Math.floor(a.speed),requiredSpeed:a.requiredSpeed,speedMet:a.speed>=a.requiredSpeed,
    centred:a.centred,centreDirection:a.centred?'aligned':s.boat.y>SLUICE.laneYs[a.lane]?'up':'down',
    aligned:a.aligned,hooked:a.hooked,tensionPercent:Math.round(s.boss.tension*100),canBurst:a.canBurst,opened:a.opened,total:a.total,
    receipt:a.hitAge>=0&&a.hitAge<2.2&&['slow','pier','angle','closed','opened'].includes(a.lastImpact)?{
      kind:a.lastImpact,age:a.hitAge,life:2.2,impactSpeed:Number.isFinite(s.boss.sluice.impactSpeed)?s.boss.sluice.impactSpeed:null}:null};
}
