// Receipts of resolved actions, never predictions or reconstructed radio text.
// Independent of core/encounters so every damage source can record its real delta.
import {publishImpact} from './rogue-impact.js';
const GEAR=['motor','pump','winch','tank','plating','turbine'];
const SOURCES=['collision','sluice','crane','lighthouse','machine','dog','rat','crab','gull'];
const PHASES=['idle','warn','attack','recover'];
export const RECORD_LIMITS=Object.freeze({events:48,hits:8});
export const newVoyageRecord=()=>({events:[],hits:[],damage:{hull:[0,0,0],crew:[0,0,0]},hitCount:0});
export const resourceSnapshot=s=>({fuel:s.fuel,hp:s.hp,flood:s.flood,crew:s.crewHp});
export const resourceGains=(s,before)=>({fuel:Math.max(0,s.fuel-before.fuel),hp:Math.max(0,s.hp-before.hp),drained:Math.max(0,before.flood-s.flood)});
export function recordVoyage(s,kind,fields={}){
  if(!s.voyageRecord)return;
  const events=s.voyageRecord.events;
  events.push({kind,time:s.time,depth:s.depth,...fields});
  if(events.length>RECORD_LIMITS.events)events.shift();
}
export function recordHit(s,target,source,before,impactSpeed=null,contact=null){
  const r=s.voyageRecord,remaining=target==='hull'?s.hp:s.crewHp,amount=before-remaining;
  if(amount<=0)return;
  publishImpact(s,{target,source,amount,remaining,contact});
  if(!r)return;
  r.damage[target][s.depth]+=amount;r.hitCount++;
  r.hits.push({time:s.time,depth:s.depth,target,source,amount,remaining,fuel:s.fuel,flood:s.flood,
    phase:s.boss?.phase||'idle',speed:impactSpeed});
  if(r.hits.length>RECORD_LIMITS.hits)r.hits.shift();
}
export function voyageDebrief(s){
  const r=s.voyageRecord;
  // A previous impact is not a cause of an eventual fuel/flood loss.
  const terminal=s.status!=='lost'?null:s.reason==='연료가 소진되어 항해를 잃었다'?'fuel':
    s.reason==='밸브를 닫지 못해 침몰했다'?'flood':s.crewHp<=0?'crew':s.hp<=0?'hull':null;
  return {available:!!r,...structuredClone(r||newVoyageRecord()),terminal};
}
export function validVoyageRecord(s){
  const r=s.voyageRecord;if(r===null)return true;
  const num=(n,min=0,max=1e7)=>Number.isFinite(n)&&n>=min&&n<=max;
  const int=(n,min,max)=>Number.isInteger(n)&&num(n,min,max);
  const gear=id=>GEAR.includes(id),gains=e=>num(e.fuel,0,320)&&num(e.hp,0,210)&&num(e.drained,0,100);
  const ordered=items=>items.every((e,i)=>e&&int(e.depth,0,s.depth)&&num(e.time,0,s.time)&&
    (!i||(e.time>=items[i-1].time&&e.depth>=items[i-1].depth)));
  if(!r||!Array.isArray(r.events)||r.events.length>RECORD_LIMITS.events||!ordered(r.events)||
    !Array.isArray(r.hits)||r.hits.length>RECORD_LIMITS.hits||!ordered(r.hits)||!int(r.hitCount,r.hits.length,1e7)||
    !r.damage||!['hull','crew'].every(k=>Array.isArray(r.damage[k])&&r.damage[k].length===3&&
      r.damage[k].every((v,d)=>num(v,0,1e9)&&(d<=s.depth||v===0))))return false;
  if(r.events.some(e=>{
    switch(e.kind){
      case 'cache':return !int(e.site,0,2)||!(e.gear===null||gear(e.gear))||typeof e.pending!=='boolean'||
        (e.pending&&e.gear===null)||(e.crew!=null&&!['grip','stride','guard'].includes(e.crew))||![null,'ratchet','baffle','shutter'].includes(e.tool)||!gains(e);
      case 'gear':return !gear(e.gear)||!(e.removed===null||gear(e.removed))||
        !(e.slot===null?e.removed===null:int(e.slot,0,5)&&e.removed!==null)||!num(e.fuel,0,15);
      case 'workshop':return e.depth!==0||!['rig','repair','fuel'].includes(e.choice)||!gains(e);
      case 'boss':return !['entered','cleared'].includes(e.stage)||!num(e.hp,0,210)||!num(e.fuel,0,320)||
        !Array.isArray(e.equipment)||e.equipment.length>6||!e.equipment.every(gear)||typeof e.tool!=='boolean';
      case 'passage':return !gains(e);
      case 'tow':return !num(e.fuel,0,20)||!num(e.crew,0,20);
      case 'rescue':return e.depth!==0||!int(e.site,0,2)||!['aboard','left-behind'].includes(e.outcome)||
        typeof e.discovered!=='boolean'||!num(e.hp,0,24)||!num(e.crew,0,20)||!int(e.ammo,0,4)||
        (e.outcome==='aboard'?!e.discovered:e.hp!==0||e.crew!==0||e.ammo!==0);
      case 'net':return !['cut','recovered'].includes(e.choice);
      default:return true;
    }
  }))return false;
  if(r.hits.some(h=>!['hull','crew'].includes(h.target)||!SOURCES.includes(h.source)||!num(h.amount,Number.EPSILON,210)||
    !num(h.remaining,0,h.target==='hull'?210:100)||!num(h.fuel,0,320)||!num(h.flood,0,100)||!PHASES.includes(h.phase)||
    !(h.speed===null||['collision','sluice'].includes(h.source)&&num(h.speed,0,3000))))return false;
  // Totals may exceed the recent-hit ring, but may never be smaller.
  return ['hull','crew'].every(k=>r.damage[k].every((total,d)=>total+1e-7>=
    r.hits.filter(h=>h.target===k&&h.depth===d).reduce((sum,h)=>sum+h.amount,0)));
}
