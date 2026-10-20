import {inletRate} from './bilge-build.js';
import {crewPlansMarkup} from './crew-plans.js';
import {JOBS,LEGS} from './voyage.js';
export function refitPreparation(s){
 const v=s.voyage,workers=job=>s.crew.filter(id=>v.assignments[id]===job).length;
 const drain=workers('pump')*.55+(v.equipment.includes('pump')?.45:0),net=v.leak+inletRate(v)-drain;
 return {leak:v.leak,drain,net,trend:net>0?'rising':net<0&&v.flood>0?'draining':'held',missingHelm:!workers('helm'),missingEngine:!workers('engine'),repairWithoutParts:workers('repair')>0&&v.parts===0,repairing:workers('repair')>0&&v.parts>0,legs:LEGS.map((id,i)=>({id,status:i<v.leg?'completed':i===v.leg?'current':'next'}))};
}
export function voyageRouteMarkup(s,language='ko'){
 const en=language==='en',names=en?['Market','Sluice','Dawn']:['시장','수문','새벽호'];
 return '<ol class="voyage-route" aria-label="'+(en?'Rescue voyage progress':'구조 항해 진행')+'">'+refitPreparation(s).legs.map((leg,i)=>'<li data-route-state="'+leg.status+'"'+(leg.status==='current'?' aria-current="step"':'')+'><span>'+(leg.status==='completed'?'✓':i+1)+'</span> '+names[i]+'<small>'+(leg.status==='completed'?(en?'Rescued':'구조 완료'):leg.status==='current'?(en?'Prepare departure':'출항 준비'):(en?'Next harbor':'다음 항구'))+'</small></li>').join('')+'</ol>';
}
export function crewPreparationMarkup(s,language,t){
 const en=language==='en',d=refitPreparation(s),v=s.voyage;
 const balance=d.trend==='rising'?(en?'Flooding rises +':'침수 증가 +')+d.net.toFixed(2)+'/s':d.trend==='draining'?(en?'Flooding falls −':'침수 감소 −')+(-d.net).toFixed(2)+'/s':(en?'Flooding held':'침수 유지');
 const warnings=[d.missingHelm?(en?'No helm watch: slower turns':'조타 담당 없음 · 선회 저하'):null,d.missingEngine?(en?'No engine watch: lower thrust':'기관 담당 없음 · 추진 저하'):null,d.repairWithoutParts?(en?'Repairs waiting: no parts':'수리 대기 · 부품 없음'):null,d.repairing?(en?'Repairs consume shared parts after departure':'출항 후 수리 · 봉합과 같은 부품 사용'):null].filter(Boolean);
 return '<details id="refitCrew" class="refit-crew"><summary>'+(en?'Crew before departure':'출항 전 승무원 배치')+' <b data-water-trend="'+d.trend+'">'+balance+'</b></summary>'+crewPlansMarkup(s,language)+'<div class="crew-orders">'+['operator','engineer'].map(id=>'<label>'+(id==='operator'?'Woo':'Park')+'<select data-refit-crew="'+id+'" aria-label="'+(id==='operator'?'Woo':'Park')+'">'+JOBS.map(job=>'<option value="'+job+'"'+(v.assignments[id]===job?' selected':'')+'>'+(job==='pump'?(en?'Bilge pumping':'배수 작업'):t[job])+'</option>').join('')+'</select></label>').join('')+'</div><p class="crew-balance">'+(en?'Current leak ':'현재 누수 ')+d.leak.toFixed(2)+' / '+(en?'pumping ':'배수 ')+d.drain.toFixed(2)+'</p>'+(warnings.length?'<p class="crew-tradeoffs">'+warnings.join(' · ')+'</p>':'')+'<small>'+(en?'Paused at the pier. Work starts at departure. Reading uses current equipment and leak, before repairs or new damage; flooding never falls below zero.':'정비 중에는 시간이 멈춥니다. 작업은 출항 후 시작됩니다. 현재 장비·누수 기준이며 수리·추가 피해 전 수치입니다. 침수는 0 아래로 내려가지 않습니다.')+'</small></details>';
}
