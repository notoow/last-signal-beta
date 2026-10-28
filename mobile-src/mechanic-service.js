// Optional finite dock maintenance earned by rescuing the mechanic.
export const SERVICE=Object.freeze({ammo:2,hull:18,perDepth:2});
// Docking alone is not safety: do not turn a boss berth into instant combat healing.
function repairDanger(s){
 return Boolean(s.boss?.active&&!s.boss.cleared||s.tow?.connected&&!s.tow.anchor||
  s.combat?.enemies?.some(e=>e.hp>0&&!e.asleep&&s.boat&&
   Math.hypot(e.x-s.boat.x,e.y-s.boat.y)<(e.alert||e.phase==='warn'?120:60)));
}
export function mechanicService(s,hullCap){
 const used=s.mechanicService?.[s.depth]??0;
 const reason=s.status!=='playing'?'voyage-ended':s.rescue?.stage!=='aboard'?'no-mechanic':
  s.mode!=='moored'||!s.mooring?'not-moored':
  s.pendingCache||s.pendingGear||s.salvage?.pending?'choice-open':
  s.daylight?.rest?'resting':
  repairDanger(s)?'danger':
  s.hp<=0?'destroyed':s.hp>=hullCap?'intact':
  used>=SERVICE.perDepth?'exhausted':s.combat.ammo<SERVICE.ammo?'no-scrap':null;
 return {available:reason===null,reason,ammo:SERVICE.ammo,hull:Math.max(0,Math.min(SERVICE.hull,hullCap-s.hp)),remaining:Math.max(0,SERVICE.perDepth-used)};
}
export function useMechanicService(s,hullCap){
 const offer=mechanicService(s,hullCap);if(!offer.available)return false;
 s.combat.ammo-=offer.ammo;s.hp+=offer.hull;
 s.mechanicService??=[0,0,0];s.mechanicService[s.depth]++;
 return {depth:s.depth,ammo:offer.ammo,hull:offer.hull,remaining:offer.remaining-1};
}
export function validMechanicService(value){
 return Array.isArray(value)&&value.length===3&&value.every(n=>Number.isInteger(n)&&n>=0&&n<=SERVICE.perDepth);
}
