import {JOBS,propulsion,assignCrew} from './voyage.js';
import {crewPlansMarkup} from './crew-plans.js';
import {shipWork} from './ship-work.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text={
 ko:{title:'선원 배치',paused:'일시정지 · 작업은 항해 재개 후 시작됩니다',crew:'배치할 선원',job:'작업 배정',helm:'조타',engine:'기관 운전',pump:'배수',repair:'선체 수리',helmNote:'선회 성능 유지',engineNote:'기관 담당 없으면 추진 −15%',pumpNote:'1명당 침수 −0.55/초',repairNote:'1명당 8초 · 부품 1개',hull:'선체',water:'침수',parts:'부품',thrust:'추진 효율',held:'유지',rising:'증가',draining:'감소',noRepair:'손상·누수 없음',unassigned:'수리 담당 없음',empty:'수리 중단 · 부품 없음',nextRepair:'재개 후 수리까지',partEffect:'부품 1개당',leak:'누수',noHelm:'조타 담당 없음 · 선회 저하',noEngine:'기관 담당 없음 · 추진 저하',back:'항해 재개',plan:'빠른 배치'},
 en:{title:'Crew stations',paused:'Paused · work begins when sailing resumes',crew:'Select crew',job:'Assign a station',helm:'Helm',engine:'Engine watch',pump:'Bilge pump',repair:'Hull repair',helmNote:'Keeps turning responsive',engineNote:'No engine watch: thrust −15%',pumpNote:'Flooding −0.55/s per worker',repairNote:'8 seconds · 1 part per worker',hull:'Hull',water:'Flooding',parts:'Parts',thrust:'Propulsion',held:'held',rising:'rising',draining:'falling',noRepair:'No hull damage or leak',unassigned:'Repair unassigned',empty:'Repair stopped · no parts',nextRepair:'Repair after resuming',partEffect:'Per repair part',leak:'leak',noHelm:'No helm watch · slower turns',noEngine:'No engine watch · lower thrust',back:'Resume sailing',plan:'Quick assignments'}
};
Object.assign(text.ko,{map:'현재 배치도',emptyStation:'미배치',assigned:'배치됨',preview:'배정 시',turns:'조타 유지',noTurns:'조타 없음',repairReady:'수리까지',perSecond:'/초'});
Object.assign(text.en,{map:'Current stations',emptyStation:'Unstaffed',assigned:'Assigned',preview:'If assigned',turns:'Helm staffed',noTurns:'No helm watch',repairReady:'Repair in',perSecond:'/s'});
text.ko.paused='일시정지 · 현재 장비 기준, 작업은 항해 재개 후 시작';
text.en.paused='Paused · Current gear · Work starts on resume';
text.ko.previewTitle='배정 후 효과';
text.en.previewTitle='Effects after assigning';
const crewName=id=>id==='operator'?'Woo':'Park';
const signed=value=>(value>0?'+':value<0?'−':'')+Math.abs(value).toFixed(2);
const waterReading=(work,t)=>work.trend==='held'?t.held:signed(work.net)+t.perSecond;

// Preview uses the same assignment/calculation functions as play, on a copy.
// It spends no parts and does not advance time, repairs or flooding.
export function crewAssignmentPreview(s,id,job){
 const next={...s,voyage:{...s.voyage,assignments:{...s.voyage.assignments}}};
 if(!assignCrew(next,id,job))return null;
 return {before:{work:shipWork(s),thrust:propulsion(s)},after:{work:shipWork(next),thrust:propulsion(next)}};
}

function assignmentEffect(s,id,job,t){
 const {before,after}=crewAssignmentPreview(s,id,job),a=after.work;
 if(job==='helm')return a.missingHelm?t.noTurns:t.turns;
 if(job==='engine'){
  const from=Math.round(before.thrust*100),to=Math.round(after.thrust*100);
  return `${t.thrust} ${from===to?to:from+' → '+to}%`;
 }
 if(job==='pump'){
  const from=waterReading(before.work,t),to=waterReading(a,t);
  return `${t.water} ${from===to?to:from+' → '+to}`;
 }
 if(a.repair.status==='working')return `${t.repairReady} ${a.repair.seconds.toFixed(1)}s · ${t.hull} +${a.repair.hull.toFixed(0)}`;
 return t[a.repair.status==='complete'?'noRepair':a.repair.status];
}

// This module renders an already selected crew member; it does not assign jobs,
// advance repair timers or write a save. The app owns those existing operations.
export function crewInteriorMarkup(s,{language='ko',shipMarkup='',selectedCrew='engineer',details='',saveError=''}={}){
 const t=text[language==='en'?'en':'ko'],v=s.voyage,work=shipWork(s);
 const crew=s.crew.filter(id=>['operator','engineer'].includes(id));
 const selected=crew.includes(selectedCrew)?selectedCrew:crew[0],job=v.assignments[selected];
 const name=crewName;
 const water=waterReading(work,t);
 const repair=work.repair.status==='working'?`${t.nextRepair} ${work.repair.seconds.toFixed(1)}s`:t[work.repair.status==='complete'?'noRepair':work.repair.status];
 return `<section class="dialog interior crew-interior" data-selected-crew="${selected}">
  <header class="crew-header"><div><p>${escape(t.paused)}</p><h2>${escape(t.title)}</h2></div>${saveError?`<div class="crew-save"><p role="status">${escape(saveError)}</p><button id="interiorRetry">${language==='en'?'Retry save':'저장 재시도'}</button></div>`:'<span>I / Esc</span>'}</header>
  <div class="crew-workspace">
   <div class="crew-stage">
    <div class="crew-map-title"><strong>${t.map}</strong><span>${name(selected)} · ${t[job]}</span></div>
    <div class="crew-ship">${shipMarkup}<div class="crew-station-map" aria-label="${t.map}">${JOBS.map(station=>{
     const occupants=crew.filter(id=>v.assignments[id]===station);
     return `<div class="crew-station-tag" data-station="${station}" data-selected="${job===station}" data-occupied="${!!occupants.length}"><span>${t[station]}</span><strong>${occupants.length?occupants.map(name).join(' · '):t.emptyStation}</strong></div>`;
    }).join('')}</div></div>
    <div class="crew-readings"><span>${t.hull} <b>${Math.ceil(s.boat.hp)}</b></span><span>${t.water} <b>${v.flood.toFixed(1)}%</b> <small data-work-water="${work.trend}">${water}</small></span><span>${t.parts} <b>${v.parts}</b></span><span>${t.thrust} <b>${Math.round(propulsion(s)*100)}%</b></span></div>
    <div class="crew-effects" aria-live="polite"><p data-work-repair="${work.repair.status}">${escape(repair)}${work.repair.status!=='complete'?`<small>${t.partEffect}: ${t.hull} +${work.repair.hull.toFixed(1)} · ${t.leak} −${work.repair.leak.toFixed(2)}</small>`:''}</p>${work.missingHelm?`<p class="crew-warning">${t.noHelm}</p>`:''}${work.missingEngine?`<p class="crew-warning">${t.noEngine}</p>`:''}</div>
    <div class="crew-detail-slot">${details}</div>
   </div>
   <aside class="crew-inspector" aria-label="${escape(t.job)}">
    <div class="crew-picker" role="group" aria-label="${escape(t.crew)}">${crew.map(id=>`<button type="button" data-select-crew="${id}" data-current-job="${v.assignments[id]}" aria-pressed="${id===selected}"><img src="assets/art/${id==='operator'?'woo':'park'}-portrait-v3.png" alt=""><span class="crew-picker-copy"><strong>${name(id)}</strong><span>${escape(t[v.assignments[id]])}</span></span></button>`).join('')}</div>
    <h4><strong>${name(selected)}</strong> · ${escape(t.previewTitle)}</h4>
    <div class="crew-jobs" role="group" aria-label="${name(selected)} · ${escape(t.job)}">${JOBS.map(id=>`<button type="button" data-assign-crew="${selected}" data-crew-job="${id}" aria-pressed="${job===id}"><span class="crew-job-title"><strong>${escape(t[id])}</strong>${job===id?'<span class="crew-assigned" aria-label="'+t.assigned+'">✓</span>':''}</span><small>${escape(t[id+'Note'])}</small><span class="crew-job-effect" aria-label="${job===id?t.assigned:t.preview}"><b>${escape(assignmentEffect(s,selected,id,t))}</b></span></button>`).join('')}</div>
   </aside>
  </div>
  <footer class="crew-footer"><div aria-label="${escape(t.plan)}">${crewPlansMarkup(s,language)}</div><button id="interiorBack" class="primary">${escape(t.back)} <kbd>I</kbd></button></footer>
 </section>`;
}
