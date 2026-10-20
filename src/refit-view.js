import {buildChoices,bilgeBuild,pumpCharge} from './bilge-build.js';
import {winchBuild} from './winch-build.js';
import {offers,seaState} from './voyage.js';
import {voyageCodeMarkup} from './voyage-code.js';
import {voyageRouteMarkup,crewPreparationMarkup,refitPreparation} from './refit-preparation.js';
import {contractOffers,salvageModule} from './expedition.js';
import {salvagePlanMarkup,expeditionText,recoveryLabel} from './expedition-view.js';
import {equipmentComparison,equipmentComparisonMarkup} from './equipment-comparison.js';
import {refitDraft} from './refit-draft.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art={blackout:'unpowered-pier-v1',leaking:'leaking-rescue-vessel-v1',squall:'squall-tow-v1'};

export function refitDeskMarkup(s,language,t,options={}){
 const en=language==='en',v=s.voyage,x=expeditionText(language),d=refitDraft(s,options.draft),prep=refitPreparation(s);
 const tr=(ko,enText)=>en?enText:ko,job=id=>id==='pump'?tr('배수','Bilge pump'):t[id];
 const title=id=>id==='skip'?tr('보급 없이 출항','No resupply'):id==='supplies'||id==='fuel'?supplyLabel(id):t[id];
 function supplyLabel(id){
  const key=id==='fuel'?'fuel':'parts',change=equipmentComparison(s,id)?.changes.find(c=>c.key===key),gain=change?change.after-change.before:0;
  return t[key]+' +'+(Number.isInteger(gain)?gain:gain.toFixed(1));
 }
 const tabs=[...(v.version>=3?[['requests',tr('구조 요청','Distress call')]]:[]),['equipment',tr('장비 · 보급','Equipment & supplies')],['crew',tr('선원 배치','Crew stations')]];
 const core=v.build==='bilge'?tr('침수 발전선','Flood engine'):winchBuild(v)?tr('축력 윈치선','Spring winch'):tr('표준 예인선','Standard tug');
 const specialization={pressure:tr('압력 한계 돌파','Pressure redline'),recycler:tr('배수 순환 특화','Closed-loop recycler'),harpoon:tr('일격 견인','Heavy haul'),ratchet:tr('연속 래칫','Ratchet chain')}[v.specialization];
 let buildPanel=buildChoices(v,language).replace('class="build-desk" open','class="build-desk"');
 if(v.leg>0&&v.specialization==='none'&&(bilgeBuild(v)||winchBuild(v)))buildPanel=buildPanel.replace('</summary>','</summary><p class="micro">'+tr('특화는 선택 즉시 고정되며, 이번 항해에서 다시 바꿀 수 없습니다.','Specialization locks immediately when selected and cannot be changed during this voyage.')+'</p>');
 const water=prep.trend==='rising'?tr('침수 증가 +','Flooding rises +')+prep.net.toFixed(2)+'/s':prep.trend==='draining'?tr('침수 감소 −','Flooding falls −')+(-prep.net).toFixed(2)+'/s':tr('침수 유지','Flooding held');
 const comparisons=equipmentComparisonMarkup(s,d.choice,d.replace,language,t);
 const equipmentNote=id=>{
  let note=id==='turbine'&&bilgeBuild(v)?tr('실제로 배수한 침수 1당 과출력 +','Each point of water actually pumped restores ')+pumpCharge({...v,equipment:[...v.equipment,'turbine']})+tr('. 배수기·배수 담당과 조합하세요.',' drive. Combine with pumps or pumping crew.'):t[id+'Note'];
  if(id==='battery'&&v.version>=3)note+=' '+x.batteryExtra;
  if(id==='battery'&&winchBuild(v))note+=' '+tr('축력 충전 ×1.5.','Stored-pull charge ×1.5.');
  if(id==='tools'&&winchBuild(v))note+=' '+tr('과부하 장력 90% → 97% · 반동 절반.','Overload tension 90% → 97%; half recoil.');
  if(id==='motor'&&v.version>=2)note+=' '+t.motorFuelNote;
  return note;
 };
 const supplyCards=[...offers(v),'supplies',...(v.version>=2?['fuel']:[]),'skip'].map(id=>{
  const disabled=!equipmentComparison(s,id,d.replace);
  const cell={pump:4,tools:1,motor:0,battery:5,turbine:4}[id];
  const image=cell===undefined?`<span class="refit-supply-symbol" aria-hidden="true">${id==='fuel'?'▰':id==='supplies'?'✚':'—'}</span>`:`<svg class="refit-module-art" viewBox="${cell%3*512} ${Math.floor(cell/3)*512} 512 512" aria-hidden="true"><image href="assets/art/interior-objects-v1.png" width="1536" height="1024"/></svg>`;
  const note=id==='skip'?tr('현재 장비와 자원 유지','Keep current equipment and resources'):['fuel','supplies'].includes(id)?tr('보유 한도까지 지급','Gain is capped by capacity'):x['kit'+id[0].toUpperCase()+id.slice(1)];
  return `<button data-equipment="${id}" aria-pressed="${d.choice===id}" ${disabled?'disabled':''}>${image}<span><strong>${esc(title(id))}</strong><small>${esc(disabled?tr('현장 인양 장비와 중복','Reserved for field recovery'):note)}</small></span><i aria-hidden="true">${d.choice===id?'✓':'+'}</i></button>`;
 }).join('');
 const forecast=v.version<2?'':`<details class="forecast-fold"><summary>${t.forecast}</summary><div class="voyage-forecast">${[0,1,2].map(leg=>{const sea=seaState({...v,leg});return `<p class="${leg===v.leg?'current':''}">${leg+1} · ${t[sea.id]}<small>${t[sea.id+'Note']}</small></p>`;}).join('')}<small>${t.fuelRule}</small></div></details>`;
 const contractCards=v.version<3?'':contractOffers(v).map(id=>`<button data-contract="${id}" aria-pressed="${v.situation.contract===id}"><img src="assets/art/${art[id]}.png" alt=""><span class="refit-call-copy"><span class="refit-selection">${v.situation.contract===id?tr('✓ 선택한 요청','✓ Selected call'):tr('구조 요청','Distress call')}</span><strong>${esc(x[id])}</strong><span>${esc(x[id+'Note'])}</span><small>${esc(v.leg===2?tr('마지막 구조 → 항해 완료','Final rescue → complete the voyage'):x[id+'Pay'])}</small></span></button>`).join('');
 const crew=crewPreparationMarkup(s,language,t).replace('class="refit-crew"','class="refit-crew" open');
 return `<section class="dialog voyage-refit refit-desk ${v.version>=3?'expedition-refit':''}" data-refit-active="${d.tab}">
  <header class="refit-header"><div><p>${tr('출항 준비 · 시간 정지','DEPARTURE PREPARATION · PAUSED')}</p><h2>${t.refit}</h2></div>${voyageRouteMarkup(s,language)}<div class="refit-resources"><span>${t.hull} <b>${Math.ceil(s.boat.hp)}</b></span>${v.version>=2?`<span>${t.fuel} <b>${Math.ceil(v.fuel)}</b></span>`:''}<span>${t.parts} <b>${v.parts}</b></span></div></header>
  ${options.saveError?`<div class="refit-save" role="status">${esc(options.saveError)}<button id="refitRetry">${tr('저장 재시도','Retry save')}</button></div>`:''}
  <nav class="refit-tabs" role="tablist" aria-label="${t.refit}">${tabs.map(([id,label])=>`<button id="refit-tab-${id}" role="tab" data-refit-tab="${id}" aria-controls="refit-panel-${id}" aria-selected="${d.tab===id}" tabindex="${d.tab===id?0:-1}">${label}</button>`).join('')}</nav>
  <div class="refit-workspace">
   <div class="refit-panels">
    ${v.version>=3?`<section id="refit-panel-requests" class="refit-panel" role="tabpanel" aria-labelledby="refit-tab-requests" ${d.tab!=='requests'?'hidden':''}><h3>${tr('이번에 응답할 무전','Choose a distress call')}</h3><div class="refit-calls">${contractCards}</div><div class="refit-receipt">${options.record||''}</div></section>`:''}
    <section id="refit-panel-equipment" class="refit-panel" role="tabpanel" aria-labelledby="refit-tab-equipment" ${d.tab!=='equipment'?'hidden':''}>
     <h3>${tr('장비 또는 보급, 하나만 선택','Choose one module or supply')}</h3>
     ${v.equipment.length===2?`<label class="refit-replace">${t.replace}<select id="replaceModule">${v.equipment.map(id=>`<option value="${id}" ${d.replace===id?'selected':''}>${t[id]}</option>`).join('')}</select></label>`:''}
     <div class="refit-supplies">${supplyCards}</div>
     <p class="refit-pending-note">${tr('선택한 보급은 출항할 때 적용됩니다.','Your selected supply is applied at departure.')}</p>
     <div class="refit-build">${buildPanel}</div>
     ${salvagePlanMarkup(s,language).replace('class="salvage-plan" open','class="salvage-plan"')}
     ${v.version<3?`<div class="refit-receipt">${options.record||''}</div>`:''}
    </section>
    <section id="refit-panel-crew" class="refit-panel" role="tabpanel" aria-labelledby="refit-tab-crew" ${d.tab!=='crew'?'hidden':''}><h3>${tr('출항 후 맡을 작업','Assignments after departure')}</h3>${crew}<p class="refit-wear">${t.wear}</p></section>
   </div>
   <aside class="refit-summary" aria-label="${tr('출항 요약','Departure summary')}">
    <h3>${tr('출항 요약','Departure summary')}</h3>
    <dl><div><dt>${tr('요청','Call')}</dt><dd>${esc(v.version>=3?x[v.situation.contract]:tr('항구 구조','Harbor rescue'))}</dd></div><div><dt>${tr('항해 핵심','Keystone')}</dt><dd>${core}${specialization?'<br>'+specialization:''}</dd></div><div><dt>${tr('선원','Crew')}</dt><dd>Woo · ${job(v.assignments.operator)}<br>Park · ${job(v.assignments.engineer)}</dd></div>${v.version>=4?`<div><dt>${tr('현장 인양','Field recovery')}</dt><dd>${recoveryLabel(s,language)}</dd></div>`:''}</dl>
    <div class="refit-water" data-summary-trend="${prep.trend}">${water}${prep.missingHelm?`<small>${tr('조타 담당 없음 · 선회 저하','No helm watch · slower turns')}</small>`:''}${prep.missingEngine?`<small>${tr('기관 담당 없음 · 추진 저하','No engine watch · lower thrust')}</small>`:''}${prep.repairWithoutParts?`<small>${tr('수리 대기 · 부품 없음','Repairs waiting · no parts')}</small>`:''}</div>
    <div class="refit-selected"><p>${tr('출항 시 적용','Applied at departure')}</p><strong>${esc(title(d.choice))}</strong><div class="equipment-comparison">${comparisons}</div></div>
    <details class="refit-comparison-details"><summary>${tr('수치 기준과 장비 설명','Reading basis & equipment')}</summary><p class="comparison-basis">${tr('현재 배치·침수·날씨 기준. 과출력 없이 예인줄을 분리한 직진. 수리량은 부품당 최대치입니다.','Current crew, flooding and weather; moving without towline or overdrive. Repair is maximum per part.')}</p>${offers(v).map(id=>`<p><b>${t[id]}</b> ${equipmentNote(id)}</p>`).join('')}</details>
    ${forecast}<details id="refitCodeDetails"><summary>${tr('항해 코드','Voyage code')}</summary>${voyageCodeMarkup(v,language)}</details>
   </aside>
  </div>
  <footer class="refit-footer"><button id="refitHome">${t.return}</button><button id="refitCode">${tr('항해 코드','Voyage code')}</button><p>${tr('선택한 보급','Selected supply')}<strong>${esc(title(d.choice))}</strong></p><button id="refitDepart" class="primary">${tr('출항','Depart')} <span aria-hidden="true">→</span></button></footer>
 </section>`;
}
