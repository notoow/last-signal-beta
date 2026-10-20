import {JOBS,propulsion} from './voyage.js';
import {crewPlansMarkup} from './crew-plans.js';
import {shipWork} from './ship-work.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text={
 ko:{title:'선원 배치',paused:'일시정지 · 작업은 항해 재개 후 시작됩니다',crew:'배치할 선원',job:'작업 배정',helm:'조타',engine:'기관 운전',pump:'배수',repair:'선체 수리',helmNote:'선회 성능 유지',engineNote:'기관 담당 없으면 추진 −15%',pumpNote:'1명당 침수 −0.55/초',repairNote:'1명당 8초 · 부품 1개',hull:'선체',water:'침수',parts:'부품',thrust:'추진 효율',held:'유지',rising:'증가',draining:'감소',noRepair:'손상·누수 없음',unassigned:'수리 담당 없음',empty:'수리 중단 · 부품 없음',nextRepair:'재개 후 수리까지',partEffect:'부품 1개당',leak:'누수',noHelm:'조타 담당 없음 · 선회 저하',noEngine:'기관 담당 없음 · 추진 저하',back:'항해 재개',plan:'빠른 배치'},
 en:{title:'Crew stations',paused:'Paused · work begins when sailing resumes',crew:'Select crew',job:'Assign a station',helm:'Helm',engine:'Engine watch',pump:'Bilge pump',repair:'Hull repair',helmNote:'Keeps turning responsive',engineNote:'No engine watch: thrust −15%',pumpNote:'Flooding −0.55/s per worker',repairNote:'8 seconds · 1 part per worker',hull:'Hull',water:'Flooding',parts:'Parts',thrust:'Propulsion',held:'held',rising:'rising',draining:'falling',noRepair:'No hull damage or leak',unassigned:'Repair unassigned',empty:'Repair stopped · no parts',nextRepair:'Repair after resuming',partEffect:'Per repair part',leak:'leak',noHelm:'No helm watch · slower turns',noEngine:'No engine watch · lower thrust',back:'Resume sailing',plan:'Quick assignments'}
};

// This module renders an already selected crew member; it does not assign jobs,
// advance repair timers or write a save. The app owns those existing operations.
export function crewInteriorMarkup(s,{language='ko',shipMarkup='',selectedCrew='engineer',details='',saveError=''}={}){
 const t=text[language==='en'?'en':'ko'],v=s.voyage,work=shipWork(s);
 const crew=s.crew.filter(id=>['operator','engineer'].includes(id));
 const selected=crew.includes(selectedCrew)?selectedCrew:crew[0],job=v.assignments[selected];
 const name=id=>id==='operator'?'Woo':'Park';
 const water=work.trend==='held'?t.held:`${work.net>0?'+':'−'}${Math.abs(work.net).toFixed(2)}/s`;
 const repair=work.repair.status==='working'?`${t.nextRepair} ${work.repair.seconds.toFixed(1)}s`:t[work.repair.status==='complete'?'noRepair':work.repair.status];
 return `<section class="dialog interior crew-interior" data-selected-crew="${selected}">
  <header class="crew-header"><div><p>${escape(t.paused)}</p><h2>${escape(t.title)}</h2></div>${saveError?`<div class="crew-save"><p role="status">${escape(saveError)}</p><button id="interiorRetry">${language==='en'?'Retry save':'저장 재시도'}</button></div>`:'<span>I / Esc</span>'}</header>
  <div class="crew-workspace">
   <div class="crew-stage">
    <div class="crew-ship">${shipMarkup}</div>
    <div class="crew-readings"><span>${t.hull} <b>${Math.ceil(s.boat.hp)}</b></span><span>${t.water} <b>${v.flood.toFixed(1)}%</b> <small data-work-water="${work.trend}">${water}</small></span><span>${t.parts} <b>${v.parts}</b></span><span>${t.thrust} <b>${Math.round(propulsion(s)*100)}%</b></span></div>
    <div class="crew-effects" aria-live="polite"><p data-work-repair="${work.repair.status}">${escape(repair)}${work.repair.status!=='complete'?`<small>${t.partEffect}: ${t.hull} +${work.repair.hull.toFixed(1)} · ${t.leak} −${work.repair.leak.toFixed(2)}</small>`:''}</p>${work.missingHelm?`<p class="crew-warning">${t.noHelm}</p>`:''}${work.missingEngine?`<p class="crew-warning">${t.noEngine}</p>`:''}</div>
    <div class="crew-detail-slot">${details}</div>
   </div>
   <aside class="crew-inspector" aria-label="${escape(t.job)}">
    <div class="crew-picker" role="group" aria-label="${escape(t.crew)}">${crew.map(id=>`<button type="button" data-select-crew="${id}" data-current-job="${v.assignments[id]}" aria-pressed="${id===selected}"><strong>${name(id)}</strong><span>${escape(t[v.assignments[id]])}</span></button>`).join('')}</div>
    <div class="crew-person"><img src="assets/art/${selected==='operator'?'woo':'park'}-portrait-v3.png" alt=""><div><h3>${name(selected)}</h3><p>${escape(t[job])}</p></div></div>
    <h4>${escape(t.job)}</h4>
    <div class="crew-jobs" role="group" aria-label="${name(selected)} · ${escape(t.job)}">${JOBS.map(id=>`<button type="button" data-assign-crew="${selected}" data-crew-job="${id}" aria-pressed="${job===id}"><strong>${escape(t[id])}</strong><small>${escape(t[id+'Note'])}</small></button>`).join('')}</div>
   </aside>
  </div>
  <footer class="crew-footer"><div aria-label="${escape(t.plan)}">${crewPlansMarkup(s,language)}</div><button id="interiorBack" class="primary">${escape(t.back)} <kbd>I</kbd></button></footer>
 </section>`;
}
