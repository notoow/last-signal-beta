import {voyageDebrief} from './rogue-voyage-record.js';
import {cacheGearName} from './rogue-cache-ui.js';
import {GENERATOR_VERSION} from './rogue-map.js';
import {CREW_UPGRADES} from './crew-upgrades.js';

const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>x>0&&x<.1?'<0.1':String(Number(x.toFixed(1)));
const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const sites={ko:['폐선 수리장','연료 하역장','어시장 나루'],en:['Salvage yard','Fuel wharf','Fish-market landing']};
const tools={ko:{ratchet:'역회전 멈춤쇠',baffle:'접이식 방류판',shutter:'차광 신호기'},en:{ratchet:'Anti-reverse ratchet',baffle:'Flow baffle',shutter:'Light shutter'}};
const sources={ko:{collision:'충돌',sluice:'수문 충돌',crane:'크레인',lighthouse:'등대 포격',machine:'기계선',dog:'들개',rat:'시궁쥐',crab:'대왕 게',gull:'갈매기'},en:{collision:'Collision',sluice:'Gate impact',crane:'Crane',lighthouse:'Lighthouse fire',machine:'Machine',dog:'Dog',rat:'Rat',crab:'Crab',gull:'Gull'}};
export function voyagePreparationText(s,language='ko'){
  const en=language==='en',sameLayout=s.generator===GENERATOR_VERSION;
  return {sameLayout,
    button:sameLayout?(en?'Same chart · new loadout':'같은 해도 · 다른 준비'):(en?'Same seed · new chart':'같은 시드 · 새 해도 준비'),
    heading:sameLayout?(en?'Same chart · seed ':'같은 해도 · 시드 ')+s.seed:(en?`Same seed ${s.seed} · new chart`:`같은 시드 ${s.seed} · 새 해도 준비`),
    detail:sameLayout?(en?'The layout stays the same. Equipment offers can change with your loadout.':'지도 배치는 유지됩니다. 준비에 따라 장비 선택지는 달라질 수 있습니다.'):(en?'Uses the previous voyage’s seed. New terrain generation rules apply, so the layout will change.':'이전 항해의 시드를 사용합니다. 새 지형 생성 규칙이 적용되어 배치는 달라집니다.')};
}
export function voyageEquipmentText(equipment,language='ko'){
  return [...new Set(equipment)].map(g=>cacheGearName(g,language)+(equipment.filter(x=>x===g).length>1?' ×'+equipment.filter(x=>x===g).length:'')).join(' · ')||(language==='en'?'None':'없음');
}
export function rescueResultText(s,language='ko'){
  const r=s.rescue,en=language==='en';if(!r)return '';
  if(r.stage==='aboard')return s.status==='won'?(en?'Mechanic reached the lighthouse with you':'정비공과 함께 등대 도착'):(en?'Mechanic boarded · voyage ended':'정비공 승선 기록 · 항해 중단');
  if(!r.discovered)return en?'Mechanic not found':'정비공 미발견';
  return r.stage==='left-behind'?(en?'Mechanic left at the harbor':'정비공은 폐항에 남았습니다'):(en?'Mechanic did not board · voyage ended':'정비공 미승선 · 항해 중단');
}
function gains(e,en){return [e.fuel>0?`${en?'Fuel':'연료'} +${n(e.fuel)}`:'',e.hp>0?`${en?'Hull':'선체'} +${n(e.hp)}`:'',e.drained>0?`${en?'Drained':'배수'} ${n(e.drained)}%`:'',e.crew>0?`${en?'Crew':'선원'} +${n(e.crew)}`:''].filter(Boolean).join(' · ');}
export function voyageRecordModel(s,language='ko'){
  const r=voyageDebrief(s),en=language==='en',lang=en?'en':'ko',gear=id=>cacheGearName(id,language);
  const events=r.events.map(e=>{
    let title='',detail=gains(e,en);
    if(e.kind==='cache'){
      title=sites[lang][e.site]+' · '+(e.crew?(en?CREW_UPGRADES[e.crew].en+' equipped':CREW_UPGRADES[e.crew].name+' 장착'):e.gear?gear(e.gear)+(e.pending?(en?' selected · replacement pending':' 선택 · 교체 대기'):(en?' recovered':' 회수')):(en?'Supplies taken':'보급품 수령'));
      if(e.tool)detail=[detail,tools[lang][e.tool]].filter(Boolean).join(' · ');
    }else if(e.kind==='gear'){
      title=e.slot===null?(en?`Traded ${gear(e.gear)} for fuel`:`${gear(e.gear)} 대신 연료 교환`):(en?`${gear(e.removed)} → ${gear(e.gear)}`:`${gear(e.removed)} → ${gear(e.gear)} 교체`);
      if(e.slot===null)detail=(en?'Fuel':'연료')+' +'+n(e.fuel);
    }else if(e.kind==='workshop')title=(en?'Workshop · ':'정비 · ')+(en?{rig:'Rig modified',repair:'Hull repair',fuel:'Refuel'}:{rig:'장치 개조',repair:'선체 수리',fuel:'연료 보급'})[e.choice];
    else if(e.kind==='boss'){
      title=e.stage==='entered'?(en?'Blockade entered':'봉쇄 해역 진입'):(en?'Blockade cleared':'봉쇄 해제');
      detail=`${en?'Hull':'선체'} ${n(e.hp)} · ${en?'Fuel':'연료'} ${n(e.fuel)} · ${e.tool?(en?'Counter-tool aboard':'대응 도구 보유'):(en?'No counter-tool':'대응 도구 없음')}`;
    }else if(e.kind==='passage')title=e.depth===2?(en?'Lighthouse dock · final delivery':'등대 부두 귀항 · 최종 전송 완료'):(en?`Passage to region ${e.depth+2}`:`${e.depth+2}번째 해역으로 이동`);
    else if(e.kind==='tow')title=en?'Supply boat delivered':'보급정 귀항';
    else if(e.kind==='net')title=e.choice==='cut'?(en?'Fishing net cut':'폐어망 절단'):(en?'Fishing net recovered':'폐어망 회수');
    else if(e.kind==='rescue'){
      title=e.outcome==='aboard'?(en?'Mechanic boarded':'정비공 승선'):e.discovered?(en?'Mechanic left at the harbor':'정비공은 폐항에 남았습니다'):(en?'Mechanic not found':'정비공 미발견');
      detail=e.outcome==='aboard'?`${en?'Hull':'선체'} +${n(e.hp)} · ${en?'Crew':'선원'} +${n(e.crew)} · ${en?'Scrap':'고철'} +${n(e.ammo)}`:'';
    }
    return {...e,at:clock(e.time),title,detail,equipmentText:e.kind==='boss'?voyageEquipmentText(e.equipment,language):null};
  });
  const hits=r.hits.map(h=>({...h,at:clock(h.time),title:`${sources[lang][h.source]} · ${h.target==='hull'?(en?'Hull':'선체'):(en?'Crew':'선원')} −${n(h.amount)}`,
    detail:`${en?'Remaining':h.target==='hull'?'남은 내구':'남은 체력'} ${n(h.remaining)} · ${en?'Fuel':'연료'} ${n(h.fuel)} · ${en?'Flood':'침수'} ${n(h.flood)}%`,
    context:(en?{idle:'Idle',warn:'Warning',attack:'Attack',recover:'Recovery'}:{idle:'비교전',warn:'공격 예고',attack:'공격 중',recover:'재정비'})[h.phase]+(h.speed!==null?` · ${en?'Impact speed':'충돌 직전 속도'} ${n(h.speed)}`:'')}));
  return {...r,events,hits,hullDamage:r.damage.hull.reduce((a,b)=>a+b,0),crewDamage:r.damage.crew.reduce((a,b)=>a+b,0),equipmentText:voyageEquipmentText(s.equipment,language)};
}
export function voyageRecordMarkup(s,language='ko'){
  const m=voyageRecordModel(s,language),en=language==='en';
  if(!m.available)return `<div class="rogue-debrief"><p class="rogue-record-unavailable">${en?'This older voyage has no choice or damage record.':'이전 버전 항해에는 선택·피해 기록이 없습니다.'}</p><details><summary>${en?'Equipment aboard':'보유 장비'}</summary><p>${esc(m.equipmentText)}</p></details></div>`;
  const rows=items=>`<ol class="rogue-record-list">${items.map(e=>`<li><time>${e.depth+1}/3 · ${e.at}</time><div><strong>${esc(e.title)}</strong>${e.detail?`<p>${esc(e.detail)}</p>`:''}${e.equipmentText?`<small>${esc(e.equipmentText)}</small>`:''}${e.context?`<small>${esc(e.context)}</small>`:''}</div></li>`).join('')}</ol>`;
  return `<div class="rogue-debrief">${s.rescue?`<p class="rogue-rescue-result">${esc(rescueResultText(s,language))}</p>`:''}<div class="rogue-record-summary"><span>${en?'Hull damage':'선체 피해'} <b>${esc(n(m.hullDamage))}</b></span><span>${en?'Crew damage':'선원 피해'} <b>${esc(n(m.crewDamage))}</b></span><span>${en?'Hits taken':'피격'} <b>${m.hitCount}${en?'':'회'}</b></span></div>
    <details id="rogueRecordChoices"><summary>${en?'Voyage choices':'항해 선택 기록'} <small>${m.events.length}${en?' recorded':'건 기록'}</small></summary><p class="rogue-record-equipment">${en?'Equipment aboard: ':'보유 장비: '}${esc(m.equipmentText)}</p>${m.events.length?rows(m.events):`<p>${en?'No choices recorded.':'기록된 선택이 없습니다.'}</p>`}${m.events.length===48?`<p>${en?'Showing the latest 48 choices.':'최근 선택 48건을 표시합니다.'}</p>`:''}</details>
    <details id="rogueRecordHits"><summary>${en?'Recent damage':'최근 피해 기록'} <small>${m.hits.length} / ${m.hitCount}</small></summary><div class="rogue-record-totals">${m.damage.hull.map((amount,d)=>`<span>${d+1}/3 · ${en?'Hull':'선체'} ${esc(n(amount))} / ${en?'Crew':'선원'} ${esc(n(m.damage.crew[d]))}</span>`).join('')}</div>${['fuel','flood'].includes(m.terminal)?`<p class="rogue-record-note">${en?'These are earlier hits, not the cause of this voyage ending.':'아래는 이전 피격 기록이며, 이번 항해의 종료 원인은 아닙니다.'}</p>`:''}${m.hits.length?rows(m.hits):`<p>${en?'No damage recorded.':'기록된 피해가 없습니다.'}</p>`}${m.hitCount>m.hits.length?`<p>${en?'Only the latest 8 hits are shown. Totals include every recorded hit.':'최근 피격 8건만 표시합니다. 피해 합계에는 모든 기록이 포함됩니다.'}</p>`:''}</details>
  </div>`;
}
