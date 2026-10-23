// A searched cache offers one random component and one build/stack alternative.
// Offers depend only on the voyage and already installed gear, never on a clock.
import {RIG_MODEL,rigEffects} from './rogue-salvage.js';
import {crewOffer} from './crew-upgrades.js';
export const CACHE_MODEL='choice-v1';
const affinity={standard:['motor','turbine','plating'],bilge:['turbine','pump','motor'],winch:['winch','turbine','plating']};
const count=(s,id)=>s.equipment.filter(g=>g===id).length;
const useful=(s,id)=>(id!=='pump'||s.build==='bilge')&&(id!=='winch'||s.build==='winch'||s.depth===0);
export function cacheOffer(s,berthId=s.pendingCache?.berth){
  const berth=s.map.berths.find(b=>b.id===berthId);
  if(!berth)return null;
  const site=s.map.islands[berth.island],pool=affinity[s.build];
  const roll=(s.seed^Math.imul(s.depth+1,2654435761)^Math.imul(berth.island+1,2246822519))>>>0;
  const first=useful(s,site.equipment)?site.equipment:pool[roll%pool.length];
  const stacks=[...new Set(s.equipment)].filter(id=>useful(s,id)&&id!==first)
    .sort((a,b)=>count(s,b)-count(s,a)||(a<b?-1:a>b?1:0));
  const alternatives=pool.filter(id=>id!==first);
  const second=stacks[0]||alternatives[roll%alternatives.length];
  return {berth:berth.id,gear:[first,second],crew:crewOffer(s,berth.island),siteRole:site.role,
    supply:site.role==='repair'?{fuel:0,hp:35,flood:20}:
      {fuel:site.role==='fuel'?45:15,hp:0,flood:0}};
}
export function gearEffect(s,id){
  const n=count(s,id);
  const specs={
    motor:{base:0,step:12,unit:'%',kind:'thrustBonus'},
    winch:{base:0,step:30,unit:'%',kind:'pullBonus'},
    tank:{base:0,step:30,unit:'',kind:'fuelCapacityBonus'},
    plating:{base:0,step:15,unit:'',kind:'hullCapacityBonus'},
    pump:{base:.3,step:.7,unit:'/s',kind:'drain'},
    turbine:{base:8,step:2,unit:'/s',kind:'boostRegen'}
  };
  const spec=specs[id];if(!spec)return null;
  const result={before:+(spec.base+n*spec.step).toFixed(2),after:+(spec.base+(n+1)*spec.step).toFixed(2),
    unit:spec.unit,kind:spec.kind};
  if(id==='turbine'&&s.build==='bilge')
    result.wetThrust={before:184+n*22,after:184+(n+1)*22,flood:55,unit:'%'};
  if(id==='plating')
    result.damageReduction={before:(1-1/(1+n*.15))*100,after:(1-1/(1+(n+1)*.15))*100,unit:'%'};
  if(s.rigModel===RIG_MODEL&&(id==='pump'&&s.build==='bilge'||id==='winch'&&s.build==='winch')){
    const before=rigEffects({...s,flood:100}),after=rigEffects({...s,flood:100,equipment:[...s.equipment,id]});
    if(id==='pump')result.pressureJet={before:{water:before.pumpCapacity,power:before.jetPower},
      after:{water:after.pumpCapacity,power:after.jetPower},minimum:20};
    else{
      result.launchBonus={before:n*15,after:(n+1)*15,unit:'%'};
      result.chargeRate={before:before.winchChargeRate,after:after.winchChargeRate,unit:'/s'};
    }
  }
  return result;
}
export function validCache(s){
  if(!['legacy',CACHE_MODEL].includes(s.cacheModel))return false;
  const p=s.pendingCache;
  if(p===null)return true;
  if(!p||s.cacheModel!==CACHE_MODEL||s.generator<2||!s.combat||s.status!=='playing'||
    s.mode!=='ashore'||s.pendingGear||s.salvage?.pending||s.claimed.includes(p.berth)||!s.person)return false;
  const b=s.map.berths.find(b=>b.id===p.berth),offer=cacheOffer(s,p.berth);
  return !!b&&Math.hypot(s.person.x-b.loot.x,s.person.y-b.loot.y)<32&&
    Array.isArray(p.gear)&&p.gear.length===2&&p.gear.every((id,i)=>id===offer.gear[i]);
}
