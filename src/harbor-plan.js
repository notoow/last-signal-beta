import {harborArenaX} from './rogue-landmarks.js';
import {cacheOffer} from './rogue-cache.js';
import {visibleAt,surveyedAt} from './rogue-vision.js';
import {toolBerth,FLOOR_TOOLS,hasTool,FAUNA} from './shore-encounters.js';
import {rescuePendingAt,rescueBerth} from './shore-rescue.js';
import {usesDredger,CRANE} from './dredger-counterplay.js';
import {usesSluice,SLUICE} from './sluice-counterplay.js';
import {usesLighthouse,lighthouseStatus,LIGHTHOUSE} from './lighthouse-counterplay.js';

export const newHarborIntel=()=>({sites:[],target:null});
export const knownBerth=(s,b)=>!s.harborIntel||s.harborIntel.sites.some(site=>site.id===b.id);
export const bossApproach=s=>s.map.nodes?.find(n=>n.id==='sea-gate')||{x:2180,y:900};
export const knownBlockade=s=>s.boss.active||s.boss.cleared||surveyedAt(s,bossApproach(s));
// The prototype is bundled with the first region's guaranteed tool. This is
// the same public radio destination, not a new reveal of sealed cache contents.
export function rigRecoveryBerth(s){
  if(!s?.combat||s.depth!==0||s.salvage?.rank!==0||s.salvage.recovered||hasTool(s,FLOOR_TOOLS[0].id))return null;
  const berth=toolBerth(s);
  return berth&&!s.claimed.includes(berth.id)?berth:null;
}
const scans=new WeakMap();
// Static quay markings reveal the guaranteed first candidate, not the sealed
// cache's second choice. Threat records mean "seen here", never "still alive".
export function refreshHarborIntel(s){
  const intel=s.harborIntel;
  if(!intel||!s.combat||s.status!=='playing')return;
  const old=scans.get(s),origin=s.person||s.boat;
  if(old&&old.intel===intel&&s.time-old.time<.25&&old.mode===s.mode&&Math.hypot(old.x-origin.x,old.y-origin.y)<12)return;
  scans.set(s,{intel,time:s.time,mode:s.mode,x:origin.x,y:origin.y});
  for(const berth of s.map.berths){
    let record=intel.sites.find(x=>x.id===berth.id);
    if(!record&&visibleAt(s,berth)){record={id:berth.id,threats:[]};intel.sites.push(record);}
    if(!record)continue;
    const yard=s.map.islands[berth.island];
    for(const enemy of s.combat.enemies)
      if(enemy.hp>0&&enemy.x>=yard.x-80&&enemy.x<=yard.x+yard.w+80&&enemy.y>=yard.y-80&&enemy.y<=yard.y+yard.h+150&&
        visibleAt(s,enemy)&&!record.threats.includes(enemy.kind))record.threats.push(enemy.kind);
    record.threats.sort();
  }
}
export function harborPlan(s){
  if(!s.harborIntel)return null;
  const intel=s.harborIntel,tool=toolBerth(s),missing=!hasTool(s,FLOOR_TOOLS[s.depth].id),rigBerth=rigRecoveryBerth(s);
  const enabled=s.status==='playing'&&!s.pendingCache&&!s.pendingGear&&!s.salvage?.pending;
  return {target:intel.target,sites:s.map.berths.map(berth=>{
    const rescue=s.rescue?.discovered&&rescueBerth(s)?.id===berth.id?s.rescue.stage:null;
    // A discovered person remembers their pickup quay, not its unseen supplies.
    const record=intel.sites.find(x=>x.id===berth.id),known=!!record||!!rescue,radio=!!record&&missing&&berth.id===tool.id;
    const claimed=s.claimed.includes(berth.id),offer=record?cacheOffer(s,berth.id):null;
    const gear=offer?.gear[0]??null;
    return {id:berth.id,island:berth.island,known,radio,claimed,rescue,selectable:enabled&&(!claimed||rescuePendingAt(s,berth.id))&&(known||!!rescue),
      gear,supply:offer?.supply??null,threats:record?[...record.threats]:[],rig:record&&berth.id===rigBerth?.id?s.build:null,
      stack:gear?s.equipment.filter(id=>id===gear).length:0,tool:radio?FLOOR_TOOLS[s.depth].id:null,selected:intel.target===berth.id};
  }),boss:{id:'boss',known:knownBlockade(s),selectable:enabled&&knownBlockade(s)&&!s.boss.cleared,selected:intel.target==='boss'&&knownBlockade(s)||s.boss.active&&!s.boss.cleared&&intel.target===null,toolMissing:missing}};
}
export function planHarbor(s,id){
  const plan=harborPlan(s);
  if(!plan||s.status!=='playing'||s.pendingCache||s.pendingGear||s.salvage?.pending)return false;
  if(id===null){s.harborIntel.target=null;return true;}
  const target=id==='boss'?plan.boss:plan.sites.find(b=>b.id===id);
  if(!target?.selectable)return false;
  // Returning to an engaged boss restores its live objective (remaining
  // drive, lane or relay); it does not replay the arena entrance or reset it.
  s.harborIntel.target=id==='boss'&&s.boss.active?null:id;return true;
}
export function harborDestination(s){
  const id=s.harborIntel?.target;
  if(!id)return null;
  if(id==='boss')return s.boss.active||s.boss.cleared||!knownBlockade(s)?null:{id,point:bossApproach(s)};
  const berth=s.map.berths.find(b=>b.id===id);
  return berth&&(knownBerth(s,berth)||rescuePendingAt(s,id))&&(!s.claimed.includes(id)||rescuePendingAt(s,id))?{id,point:berth}:null;
}
// A selected detour can be marked during combat. The primary HUD switches
// to it outside the immediate attack/jet guidance area. Currents and other
// dangers remain: this query grants no safety, travel, healing or boss reset.
export function harborRoutePriority(s){
  const d=harborDestination(s);
  if(s.status!=='playing'||!d||d.id==='boss')return false;
  if(!s.boss.active||s.boss.cleared)return true;
  if(s.mode!=='sailing')return false;
  const range=Math.hypot(s.boat.x-s.map.boss.x,s.boat.y-s.map.boss.y),half=s.boat.length/2;
  if(usesDredger(s))return range>CRANE.reach+CRANE.radius+half;
  if(usesSluice(s))return s.boat.x+half<harborArenaX(s,SLUICE.left);
  if(usesLighthouse(s)){
    const a=lighthouseStatus(s);
    return range>LIGHTHOUSE.range+half&&a.phase!=='attack'&&!a.visible;
  }
  // Earlier profiles retain their cone warnings near the blockade.
  return range>850;
}
export function validHarborIntel(s){
  const intel=s.harborIntel;if(intel===null)return true;
  if(!intel||s.generator<2||!s.combat||!Array.isArray(intel.sites)||intel.sites.length>3)return false;
  const ids=intel.sites.map(x=>x?.id);
  if(new Set(ids).size!==ids.length||intel.sites.some(x=>!s.map.berths.some(b=>b.id===x?.id)||
    !Array.isArray(x.threats)||new Set(x.threats).size!==x.threats.length||x.threats.some(k=>!Object.hasOwn(FAUNA,k))))return false;
  if(intel.target===null)return true;
  if(intel.target==='boss')return !s.boss.active&&!s.boss.cleared;
  return s.map.berths.some(b=>b.id===intel.target)&&(!s.claimed.includes(intel.target)||rescuePendingAt(s,intel.target))&&
    (ids.includes(intel.target)||rescuePendingAt(s,intel.target)||toolBerth(s).id===intel.target&&!hasTool(s,FLOOR_TOOLS[s.depth].id));
}
