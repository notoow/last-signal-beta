import {winchBuild,winchLimit} from './winch-build.js';
import {bilgeBuild,pumpCharge} from './bilge-build.js';
import {chooseEquipment,propulsion,fuelRate} from './voyage.js';
import {refitPreparation} from './refit-preparation.js';
// Apply the real choice to a disposable clone, never to the live refit.
export function equipmentComparison(s,id,replace=null){
 if(!s?.voyage||s.voyage.phase!=='refit')return null;
 const next=structuredClone(s);if(!chooseEquipment(next.voyage,id,replace))return null;
 const readings=state=>{const v=state.voyage;return {fuel:v.version>=2?v.fuel:null,parts:v.parts,drain:refitPreparation(state).drain,thrust:propulsion(state)*100,burn:v.version>=2?fuelRate({...state,connected:false},{x:1}):null,buoys:v.equipment.includes('battery')?30:18,charge:v.version>=3?(v.equipment.includes('battery')?6:2):null,repair:v.equipment.includes('tools')?24:12,winchRate:winchBuild(v)?(v.equipment.includes('battery')?1.5:1):null,winchLimit:winchBuild(v)?winchLimit(v)*100:null,recoil:winchBuild(v)?(v.equipment.includes('tools')?.5:1):null,waterCharge:bilgeBuild(v)?pumpCharge(v):null,turbine:v.equipment.includes('turbine')?1:0};};
 const before=readings(s),after=readings(next),changes=Object.keys(before).filter(k=>before[k]!==null&&Math.abs(before[k]-after[k])>1e-9).map(key=>({key,before:before[key],after:after[key]}));
 return {id,removed:replace&&s.voyage.equipment.includes(replace)&&!next.voyage.equipment.includes(replace)?replace:null,changes};
}
export function equipmentComparisonMarkup(s,id,replace,language,t){
 const d=equipmentComparison(s,id,replace);if(!d)return '';
 const en=language==='en',names=en?{winchRate:'Stored-pull charge multiplier',winchLimit:'Overload tension %',recoil:'Recoil multiplier',waterCharge:'Drive per water pumped',fuel:'Fuel',parts:'Parts',drain:'Pumping /s',thrust:'Target thrust %',burn:'Moving fuel /s',buoys:'Buoy energy /s',charge:'Normal drive recharge /s',repair:'Repair per part',turbine:'Pumping-to-charge'}:{winchRate:'축력 충전 배율',winchLimit:'과부하 장력 %',recoil:'반동 배율',waterCharge:'배수 1당 충전',fuel:'연료',parts:'부품',drain:'배수 /s',thrust:'목표 추진 %',burn:'이동 연료 /s',buoys:'부표 에너지 /s',charge:'평상 과출력 충전 /s',repair:'부품당 수리',turbine:'배수 충전'};
 const fmt=(key,n)=>key==='turbine'?(n?(en?'On':'장착'):(en?'Off':'없음')):['drain','burn'].includes(key)?n.toFixed(2):key==='thrust'?n.toFixed(1):Number.isInteger(n)?String(n):n.toFixed(1);
 const rows=d.changes.map(c=>'<span data-change="'+c.key+'">'+names[c.key]+' '+fmt(c.key,c.before)+' → '+fmt(c.key,c.after)+'</span>');
 if(!rows.length)rows.push('<span>'+(id==='fuel'||id==='supplies'?(en?'At capacity · gain +0':'보유 한도 · 증가 +0'):(en?'Current readings unchanged':'현재 수치 유지'))+'</span>');
 return (d.removed?'<b class="removed-module">'+(en?'Replaces ':'교체 대상 ')+t[d.removed]+'</b>':'')+rows.join('');
}
