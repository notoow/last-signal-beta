// Run-local machinery. Energy comes from actual braking, water or a taut line.
// Neither looting nor firing a rig restores fuel/boost.
import {CAPTAINS} from './captain-vessels.js';
import {usesSluice} from './sluice-counterplay.js';
import {usesLighthouse} from './lighthouse-counterplay.js';
export const RIG_MODEL='stack-v1';
// Read-only shared values for simulation and previews. Old saves retain their
// original impulses and the dredger's old fixed charging rate.
export function rigEffects(s){
  const stacked=s.rigModel===RIG_MODEL,count=id=>s.equipment.filter(x=>x===id).length;
  const pumps=stacked&&s.build==='bilge'?count('pump'):0;
  const lines=stacked&&s.build==='winch'?count('winch'):0;
  const pumpCapacity=20+pumps*4,jetWater=Math.min(s.flood,pumpCapacity);
  return {stacked,pumpCapacity,jetWater,
    jetPower:(s.salvage?.rank===2?170:110)+Math.max(0,jetWater-20)*3,
    winchLaunchMultiplier:1+lines*.15,
    winchChargeRate:stacked||usesSluice(s)||usesLighthouse(s)?65*(1+count('winch')*.3)*CAPTAINS[s.captain].pull:65};
}
export const SALVAGE_NAMES={standard:'제동 축압기',bilge:'압력 배수기',winch:'축력 걸쇠'};
export const newSalvage=()=>({rank:0,recovered:false,choice:null,pending:false,charge:0,window:0,cooldown:0,vector:null,uses:0});
export const salvageWindow=s=>s.salvage?.rank===2?7:4;
export function clearSalvageCharge(s){
  if(!s.salvage)return;
  Object.assign(s.salvage,{charge:0,window:0,vector:null});
}
export function recoverSalvage(s){
  const m=s.salvage;
  if(!m||m.recovered||s.depth!==0)return false;
  m.recovered=true;m.rank=Math.max(1,m.rank);return true;
}
const canFire=s=>s.salvage?.rank>0&&s.salvage.cooldown<=0&&s.fuel>2&&
  s.mode==='sailing'&&s.status==='playing'&&!s.salvage.pending&&!s.pendingGear&&!s.pendingCache&&
  !(s.skill?.left>0&&['woo','park'].includes(s.captain));
function impulse(s,vector,power){
  s.boat.vx+=vector.x*power;s.boat.vy+=vector.y*power;
  s.fuel-=2;s.salvage.cooldown=6;s.salvage.uses++;
  clearSalvageCharge(s);
}
export function tickSalvage(s,input,dt){
  const m=s.salvage;if(!m)return;
  m.cooldown=Math.max(0,m.cooldown-dt);
  m.window=Math.max(0,m.window-dt);
  if(!m.window)clearSalvageCharge(s);
  if(s.mode!=='sailing'||m.rank===0||s.build!=='standard')return;
  const speed=Math.hypot(s.boat.vx,s.boat.vy);
  if(input.brake&&speed>40&&m.cooldown===0){
    m.charge=Math.min(100,m.charge+speed*1.8*dt);m.window=salvageWindow(s);
  }
  const mag=Math.hypot(input.x||0,input.y||0);
  const forward=mag>0&&((input.x||0)*Math.cos(s.boat.angle)+(input.y||0)*Math.sin(s.boat.angle))/mag>.5;
  if(canFire(s)&&m.charge>=35&&input.boost&&!input.brake&&!input.precision&&forward&&s.boost>=18){
    const power=(m.rank===2?120:80)+m.charge*(m.rank===2?.6:.4);
    s.boost-=18;
    impulse(s,{x:Math.cos(s.boat.angle),y:Math.sin(s.boat.angle)},power);
  }
}
export function dischargeBilge(s){
  if(s.build!=='bilge'||s.valve||s.flood<20||!canFire(s))return false;
  const effect=rigEffects(s);
  s.flood-=effect.jetWater;
  impulse(s,{x:Math.cos(s.boat.angle),y:Math.sin(s.boat.angle)},effect.jetPower);
  return true;
}
export function catchWinch(s,anchor){
  const m=s.salvage;
  if(!m?.rank||s.build!=='winch'||s.charge<35||s.boss.tension<=.15||m.cooldown>0)return false;
  const dx=s.boat.x-anchor.x,dy=s.boat.y-anchor.y,d=Math.hypot(dx,dy);
  if(d<1)return false;
  m.charge=s.charge;m.window=salvageWindow(s);m.vector={x:dx/d,y:dy/d};return true;
}
export function dischargeWinch(s){
  const m=s.salvage;
  if(s.build!=='winch'||s.boss.hook>=0||!canFire(s)||m.charge<35||!m.vector||m.window<=0)return false;
  impulse(s,m.vector,m.charge*(m.rank===2?1.8:1.2)*rigEffects(s).winchLaunchMultiplier);return true;
}
export function salvageStatus(s){
  const m=s.salvage;
  if(!m?.rank)return {visible:false,phase:'missing'};
  let phase='ready';
  if(s.mode!=='sailing'||s.status!=='playing'||s.pendingGear||s.pendingCache||m.pending)phase='inactive';
  else if(m.cooldown>0)phase='cooldown';
  else if(s.fuel<=2)phase='fuel';
  else if(s.skill?.left>0&&['woo','park'].includes(s.captain))phase='skill';
  else if(s.build==='standard')phase=m.charge<35?'brake':s.boost<18?'boost':'ready';
  else if(s.build==='bilge')phase=!s.valve?'open':s.flood<20?'fill':'ready';
  else if(s.boss.hook>=0)phase=s.charge>=35&&s.boss.tension>.15?'release':'pull';
  else phase=m.charge>=35&&m.window>0&&m.vector?'ready':'hook';
  return {visible:true,phase,rank:m.rank,build:s.build,charge:m.charge,window:m.window,
    cooldown:m.cooldown,uses:m.uses,lineCharge:s.charge};
}
export function validSalvage(s,finite){
  const m=s.salvage;
  if(m===null)return true; // Existing runs keep their original equipment rules.
  if(!m||![0,1,2].includes(m.rank)||typeof m.recovered!=='boolean'||typeof m.pending!=='boolean'||
    ![null,'rig','repair','fuel'].includes(m.choice)||!finite(m.charge,0,100)||!finite(m.window,0,7)||
    !finite(m.cooldown,0,6)||!Number.isInteger(m.uses)||!finite(m.uses,0,1e6))return false;
  if(m.rank===0&&(m.recovered||m.charge||m.window||m.cooldown||m.uses))return false;
  if(m.rank===1&&!m.recovered||m.rank===2&&m.choice!=='rig'||m.choice==='rig'&&m.rank!==2)return false;
  if(m.choice!==null&&s.depth===0)return false;
  if(m.pending&&(s.depth!==0||m.choice!==null||!s.boss.cleared||s.boss.parts.some(h=>h>0)||
    s.mode!=='sailing'||s.status!=='playing'||s.pendingGear))return false;
  if(m.window>salvageWindow(s)||(!m.window&&(m.charge||m.vector)))return false;
  if(s.build==='bilge'&&(m.charge||m.window||m.vector))return false;
  if(s.build!=='winch'&&m.vector!==null)return false;
  if(s.build==='winch'&&((m.charge>0)!=(m.vector!==null)))return false;
  if(m.vector&&(!finite(m.vector.x,-1,1)||!finite(m.vector.y,-1,1)||Math.abs(Math.hypot(m.vector.x,m.vector.y)-1)>.001))return false;
  return true;
}
