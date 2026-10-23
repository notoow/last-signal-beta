import {cacheOffer} from './rogue-cache.js';
import {visibleAt} from './rogue-vision.js';
import {toolBerth,FLOOR_TOOLS,hasTool,FAUNA} from './shore-encounters.js';
import {rescuePendingAt,rescueBerth} from './shore-rescue.js';

export const newHarborIntel=()=>({sites:[],target:null});
const scans=new WeakMap();
// Static quay markings reveal the guaranteed first candidate, not the sealed
// cache's second choice. Threat records mean "seen here", never "still alive".
export function refreshHarborIntel(s){
  const intel=s.harborIntel;
  if(!intel||!s.combat||s.status!=='playing'||s.boss.active&&!s.boss.cleared)return;
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
  const intel=s.harborIntel,tool=toolBerth(s),missing=!hasTool(s,FLOOR_TOOLS[s.depth].id);
  const enabled=s.status==='playing'&&(!s.boss.active||s.boss.cleared)&&!s.pendingCache&&!s.pendingGear&&!s.salvage?.pending;
  return {target:intel.target,sites:s.map.berths.map(berth=>{
    const record=intel.sites.find(x=>x.id===berth.id),known=!!record,radio=missing&&berth.id===tool.id;
    const claimed=s.claimed.includes(berth.id),offer=known?cacheOffer(s,berth.id):null;
    const gear=offer?.gear[0]??null;
    const rescue=s.rescue?.discovered&&rescueBerth(s)?.id===berth.id?s.rescue.stage:null;
    return {id:berth.id,island:berth.island,known,radio,claimed,rescue,selectable:enabled&&(!claimed||rescuePendingAt(s,berth.id))&&(known||radio||!!rescue),
      gear,supply:offer?.supply??null,threats:record?[...record.threats]:[],
      stack:gear?s.equipment.filter(id=>id===gear).length:0,tool:radio?FLOOR_TOOLS[s.depth].id:null,selected:intel.target===berth.id};
  }),boss:{id:'boss',selectable:enabled&&!s.boss.cleared,selected:intel.target==='boss',toolMissing:missing}};
}
export function planHarbor(s,id){
  const plan=harborPlan(s);
  if(!plan||s.status!=='playing'||s.pendingCache||s.pendingGear||s.salvage?.pending)return false;
  if(id===null){s.harborIntel.target=null;return true;}
  const target=id==='boss'?plan.boss:plan.sites.find(b=>b.id===id);
  if(!target?.selectable)return false;
  s.harborIntel.target=id;return true;
}
export function harborDestination(s){
  const id=s.harborIntel?.target;
  if(!id||s.boss.active&&!s.boss.cleared)return null;
  if(id==='boss')return s.boss.cleared?null:{id,point:s.map.nodes?.find(n=>n.id==='sea-gate')||{x:2180,y:900}};
  const berth=s.map.berths.find(b=>b.id===id);
  return berth&&(!s.claimed.includes(id)||rescuePendingAt(s,id))?{id,point:berth}:null;
}
export function validHarborIntel(s){
  const intel=s.harborIntel;if(intel===null)return true;
  if(!intel||s.generator<2||!s.combat||!Array.isArray(intel.sites)||intel.sites.length>3)return false;
  const ids=intel.sites.map(x=>x?.id);
  if(new Set(ids).size!==ids.length||intel.sites.some(x=>!s.map.berths.some(b=>b.id===x?.id)||
    !Array.isArray(x.threats)||new Set(x.threats).size!==x.threats.length||x.threats.some(k=>!Object.hasOwn(FAUNA,k))))return false;
  if(intel.target===null)return true;
  if(s.boss.active&&!s.boss.cleared)return false;
  if(intel.target==='boss')return !s.boss.cleared;
  return s.map.berths.some(b=>b.id===intel.target)&&(!s.claimed.includes(intel.target)||rescuePendingAt(s,intel.target))&&
    (ids.includes(intel.target)||rescuePendingAt(s,intel.target)||toolBerth(s).id===intel.target&&!hasTool(s,FLOOR_TOOLS[s.depth].id));
}
