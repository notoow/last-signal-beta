import {winchBuild,resetWinch} from './winch-build.js';
import {bilgeBuild,buildThrust,inletRate,impactLeak,pumpCharge,drainRate,validBuild} from './bilge-build.js';
import {freshSituation,startSituation,tickSituation,boosted,situationBonus,validSituation,salvageModule} from './expedition.js';
// Expedition state belongs to the saved run, never to permanent progression.
export const LEGS=['market','sluice','landing'];
export const MODULES=['pump','tools','motor','battery','turbine'];
export const PAINTS={harbor:'#426b64',ochre:'#b18a49',red:'#96564a'};
export const JOBS=['helm','engine','pump','repair'];
export const FUEL_START=240,FUEL_MAX=360,FUEL_REFILL=90;
const SEA={calm:{fuel:.9,speed:1,leak:1},headwind:{fuel:1.18,speed:.9,leak:1},rough:{fuel:1.08,speed:1,leak:1.4}};
const FORECASTS=[['calm','headwind','rough'],['calm','rough','headwind'],['headwind','calm','rough'],['headwind','rough','calm'],['rough','calm','headwind'],['rough','headwind','calm']];
export function seaState(v){const id=v?.version>=2?FORECASTS[v.seed%6][v.leg]:'calm';return {id,...SEA[id]};}
export function fuelUse(s,input={}){
 const v=s.voyage;if(!(v?.version>=2))return {rate:0,active:false,towing:false,motor:false,boost:false};
 const active=Math.abs(input.x||0)+Math.abs(input.y||0)>0||Math.hypot(s.boat.vx,s.boat.vy)>12,towing=active&&s.connected,motor=active&&v.equipment.includes('motor'),boost=boosted(s,input);
 return {rate:(.3+(active?.55:0)+(towing?.15:0)+(motor?.15:0)+(boost?.6:0))*seaState(v).fuel,active,towing,motor,boost};
}
export function fuelRate(s,input={}){return fuelUse(s,input).rate;}
export function freshVoyage(seed,version=4){const v={version,seed:seed>>>0,leg:0,phase:'refit',fuel:FUEL_START,equipment:[],parts:3,flood:0,leak:0,repair:0,lastHp:100,assignments:{operator:'helm',engineer:'engine'}};if(version>=6)resetWinch(v);if(version>=5){v.build='standard';v.valve=false;v.specialization='none';}if(version>=3){v.situation=freshSituation(v);v.log=[];}return v;}
export function offers(v){
 let n=(v.seed+Math.imul(v.leg+1,2654435761))>>>0;
 const pool=MODULES.filter(id=>(v.version>=3||id!=='turbine')&&!v.equipment.includes(id));
 for(let i=pool.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return winchBuild(v)?[...new Set(['battery','tools',...pool].filter(id=>!v.equipment.includes(id)))].slice(0,3):bilgeBuild(v)?[...new Set(['pump','turbine',...pool].filter(id=>!v.equipment.includes(id)))].slice(0,3):pool.slice(0,3);
}
export function chooseEquipment(v,id,replace=null){
 if(v.version>=4&&v.situation.salvagePlan==='module'&&id===salvageModule(v))return false;
 if(v.phase!=='refit'||!['skip','supplies',...(v.version>=2?['fuel']:[]),...offers(v)].includes(id))return false;
 if(id==='supplies')v.parts=Math.min(9,v.parts+2);
 else if(id==='fuel')v.fuel=Math.min(FUEL_MAX,v.fuel+FUEL_REFILL);
 else if(id!=='skip'){
  if(v.equipment.length>=2){const i=v.equipment.indexOf(replace);if(i<0)return false;v.equipment.splice(i,1,id);}else v.equipment.push(id);
 }
 v.phase='sailing';return true;
}
export function assignCrew(s,id,job){if(!s.voyage||!s.crew.includes(id)||!JOBS.includes(job))return false;s.voyage.assignments[id]=job;return true;}
export function propulsion(s,input={}){const v=s.voyage;if(!v)return 1;return (1-v.flood*.006)*buildThrust(v)*(v.equipment.includes('motor')?1.18:1)*(Object.values(v.assignments).includes('engine')?1:0.85)*seaState(v).speed*(boosted(s,input)?1.6:1);}
export function tickVoyage(s,dt,input={}){
 const v=s.voyage;if(!v||v.phase!=='sailing'||s.status!=='playing')return;
 startSituation(s);tickSituation(s,dt,input);if(s.status!=='playing')return;
 if(v.version>=2){const before=v.fuel;v.fuel=Math.max(0,v.fuel-fuelRate(s,input)*dt);if(before>45&&v.fuel<=45)s.events.push({type:'voyageFuelWarning'});if(v.fuel<=0){s.status='lost';s.mission.reason='fuel';s.events.push({type:'end'});return;}}
 const damage=Math.max(0,v.lastHp-s.boat.hp);v.leak=Math.min(1.5,v.leak+damage*.025*seaState(v).leak*impactLeak(v));
 const workers=job=>s.crew.filter(id=>v.assignments[id]===job).length;
 const beforeFlood=v.flood,inflow=v.leak+inletRate(v),drain=drainRate(s),pumped=Math.min(beforeFlood+inflow*dt,drain*dt);v.flood=Math.max(0,Math.min(100,beforeFlood+inflow*dt-pumped));
 if(v.version>=3)v.situation.charge=Math.min(100,v.situation.charge+(bilgeBuild(v)?pumped*pumpCharge(v):v.equipment.includes('turbine')?Math.max(0,beforeFlood-v.flood)*8:0));
 if(beforeFlood<60&&v.flood>=60)s.events.push({type:'voyageFloodWarning'});
 if(workers('repair')&&v.parts>0&&(s.boat.hp<100||v.leak>0)){
  v.repair+=dt*workers('repair');
  if(v.repair>=8){const hpBefore=s.boat.hp,leakBefore=v.leak;v.repair=0;v.parts--;s.boat.hp=Math.min(100,s.boat.hp+(v.equipment.includes('tools')?24:12));v.leak=Math.max(0,v.leak-.25);s.events.push({type:'voyageRepair',hull:s.boat.hp-hpBefore,leak:leakBefore-v.leak,parts:v.parts});}
 }
 v.lastHp=s.boat.hp;
 if(v.flood>=100){s.status='lost';s.mission.reason='flood';s.events.push({type:'end'});}
}
export function nextVoyage(s){
 if(!s.voyage||s.status!=='won'||s.voyage.leg>=LEGS.length-1)return null;
 const v=structuredClone(s.voyage);if(v.version>=3){v.log.push({leg:v.leg,contract:v.situation.contract,salvaged:v.situation.salvaged,won:true,fuel:Math.ceil(v.fuel)});const bonus=situationBonus(v);v.fuel=Math.min(FUEL_MAX,v.fuel+bonus.fuel);v.parts=Math.min(9,v.parts+bonus.parts);}
 v.leg++;v.phase='refit';if(v.version>=6)resetWinch(v);if(v.version>=5)v.valve=false;if(v.version>=3)v.situation=freshSituation(v);v.lastHp=s.boat.hp;
 // Wear is disclosed at the pier; flooding only progresses while sailing.
 v.leak=Math.min(1.5,v.leak+.12);return v;
}
export function validVoyage(v,s){
 const range=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
 return !!v&&[1,2,3,4,5,6].includes(v.version)&&validBuild(v,s)&&(v.version<3||validSituation(v)&&Array.isArray(v.log)&&v.log.length===v.leg&&v.log.every((r,i)=>r&&r.leg===i&&['squall','blackout','leaking'].includes(r.contract)&&typeof r.salvaged==='boolean'&&r.won===true&&Number.isFinite(r.fuel)&&r.fuel>=0&&r.fuel<=FUEL_MAX))&&(v.version===1||(range(v.fuel,0,FUEL_MAX)&&v.fuel>0))&&v.seed===s.seed&&Number.isInteger(v.seed)&&range(v.seed,0,4294967295)&&Number.isInteger(v.leg)&&range(v.leg,0,2)&&LEGS[v.leg]===s.missionId&&['refit','sailing'].includes(v.phase)&&Array.isArray(v.equipment)&&v.equipment.length<=2&&new Set(v.equipment).size===v.equipment.length&&v.equipment.every(id=>MODULES.includes(id)&&(v.version>=3||id!=='turbine'))&&Number.isInteger(v.parts)&&range(v.parts,0,9)&&range(v.flood,0,100)&&v.flood<100&&range(v.leak,0,1.5)&&range(v.repair,0,8)&&range(v.lastHp,.00001,100)&&v.assignments&&Object.keys(v.assignments).length===2&&['operator','engineer'].every(id=>JOBS.includes(v.assignments[id]))&&s.crew.length===2;
}
