import {harborPlan} from './harbor-plan.js';
import {maxFuel,maxHp} from './rogue-core.js';
import {cacheGearName} from './rogue-cache-ui.js';
import {DEPTHS} from './rogue-map.js';
import {FLOOR_TOOLS,SHORE_SITES} from './shore-encounters.js';
import {rescueBerth} from './shore-rescue.js';

const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n>0&&n<.1?'<0.1':String(Number(n.toFixed(1)));
const siteNames=['Salvage yard','Fuel wharf','Fish-market landing'];
const toolNames=['Anti-reverse ratchet','Flow baffle','Light shutter'];
const threatNames={ko:{rat:'시궁쥐',dog:'들개',crab:'대왕 게',gull:'갈매기'},en:{rat:'Rats',dog:'Dogs',crab:'Crabs',gull:'Gulls'}};
const siteName=(site,en)=>en?siteNames[site.island]:SHORE_SITES[site.island];
// A remembered quay, never the actor's live offscreen position or condition.
export function pendingRescueDestination(s,language='ko'){
  const r=s.rescue;
  if(s.status!=='playing'||s.depth!==0||!r?.discovered||!['waiting','following'].includes(r.stage))return null;
  const berth=rescueBerth(s);
  return berth?{id:berth.id,name:siteName(berth,language==='en')}:null;
}
function supplyCopy(s,supply,en,actual=false){
  if(!supply)return '';
  const values=actual?{fuel:Math.min(supply.fuel,Math.max(0,maxFuel(s)-s.fuel)),hp:Math.min(supply.hp,Math.max(0,maxHp(s)-s.hp)),flood:Math.min(supply.flood,s.flood)}:supply;
  return [supply.fuel>0?`${en?'Fuel':'연료'} +${number(values.fuel)}`:'',supply.hp>0?`${en?'Repair':'수리'} +${number(values.hp)}`:'',supply.flood>0?`${en?'Drain':'배수'} ${number(values.flood)}%`:''].filter(Boolean).join(' · ');
}

// Only the sanitized planning contract supplies rewards and sighting records.
// Unseen cache alternatives and live enemy counts never enter the markup.
export function harborPlanModel(s,language='ko'){
  const plan=harborPlan(s);if(!plan)return null;
  const en=language==='en',lang=en?'en':'ko',fighting=s.boss.active&&!s.boss.cleared;
  const editable=s.status==='playing'&&!s.pendingCache&&!s.pendingGear&&!s.salvage?.pending;
  return {...plan,fighting,canClear:editable&&!!plan.target,region:en?['Abandoned harbor','Sluice channel','Lighthouse waters'][s.depth]:DEPTHS[s.depth].name,
    sites:plan.sites.map(site=>{
      const known=site.known,visible=known||site.radio||!!site.rescue;
      const supply=known?supplyCopy(s,site.supply,en):'',actual=known?supplyCopy(s,site.supply,en,true):'';
      return {...site,name:visible?siteName(site,en):(en?'Unexplored quay':'미탐사 부두'),
        status:site.claimed?(en?'Searched':'수색 완료'):known?(en?'Discovered':'발견'):site.radio?(en?'Radio location':'무전 위치'):(en?'Unexplored':'미탐사'),
        gearText:known&&site.gear?cacheGearName(site.gear,language):'',supplyText:supply,actualSupplyText:actual,
        limited:supply!==actual,
        rescueText:site.rescue==='aboard'?(en?'Mechanic boarded':'정비공 승선 완료'):site.rescue?(en?'Mechanic found · not aboard':'정비공 발견 · 아직 미승선'):'',
        toolText:site.tool?(en?toolNames[FLOOR_TOOLS.findIndex(t=>t.id===site.tool)]:FLOOR_TOOLS.find(t=>t.id===site.tool)?.name):'',
        threatText:known?site.threats.map(t=>threatNames[lang][t]).filter(Boolean).join(' · '):'',
        point:visible?s.map.berths.find(b=>b.id===site.id):null};
    }),boss:{...plan.boss,name:fighting?(en?'Return to encounter':'교전으로 복귀'):(en?'Blockade entrance':'봉쇄 해역 입구'),point:fighting?s.map.boss:s.map.nodes?.find(n=>n.id==='sea-gate')||{x:2180,y:900}}};
}

export function harborPlanSummary(s,guide,language='ko'){
  if(!guide.planSite&&!guide.planBoss)return null;
  const m=harborPlanModel(s,language);if(!m)return null;
  const en=language==='en';
  if(guide.planBoss)return {title:en?'Head for the blockade entrance':'봉쇄 해역 입구로',detail:m.boss.toolMissing?(en?'Counter-tool not recovered · M Chart':'대응 도구 미회수 · M 해도'):(en?'Counter-tool aboard · M Chart':'대응 도구 보유 · M 해도')};
  const site=m.sites.find(x=>x.id===guide.planSite);if(!site)return null;
  if(site.rescue&&site.rescue!=='aboard')return {title:(en?'To ':'목적지 · ')+site.name,detail:(en?'Mechanic found · return to escort them · M Chart':'정비공 발견 · 돌아가서 동행 · M 해도')};
  return {title:(en?'To ':'목적지 · ')+site.name,detail:site.known?
    [site.gearText,site.supplyText?(en?'up to ':'최대 ')+site.supplyText:''].filter(Boolean).join(en?' or ':' 또는 '):
    (en?'Radio location · contents unconfirmed':'무전 위치 · 내용물 미확인')};
}

export function harborPlanMarkup(s,language='ko'){
  const m=harborPlanModel(s,language);if(!m)return '';
  const en=language==='en';
  const point=(site,label)=>site.point&&site.selectable?`<button class="harbor-plan-pin" data-harbor-target="${esc(site.id)}" data-map-x="${site.point.x}" data-map-y="${site.point.y}" aria-label="${esc(site.name)}" aria-pressed="${site.selected}" tabindex="-1">${label}</button>`:'';
  return `<section class="harbor-plan" data-harbor-mode="${m.fighting?'combat':'planning'}">
    <header class="harbor-plan-header"><div><p>${s.depth+1} / 3 · ${esc(m.region)}</p><h2>${en?'Navigation chart':'항해도'}</h2></div><span class="harbor-plan-paused">${en?'VOYAGE PAUSED':'항해 일시정지'}</span><button id="harborPlanClose">M / Esc · ${en?'Resume':'계속'}</button></header>
    <div class="harbor-plan-body"><div class="harbor-plan-map"><canvas id="harborPlanSea" aria-label="${en?'Explored harbor and known destinations':'탐사한 항구와 알려진 목적지'}"></canvas>${m.sites.map(site=>point(site,String(site.island+1))).join('')}${point(m.boss,'↗')}<span class="harbor-plan-you" data-map-x="${(s.person||s.boat).x}" data-map-y="${(s.person||s.boat).y}">● <small>${en?'You':'현재 위치'}</small></span><div class="harbor-plan-legend">${m.fighting?(en?'Explored terrain · dark water is unexplored':'탐사한 지형 · 어두운 곳은 미탐사'):(en?'Numbers match destinations · dark water is unexplored':'번호로 목적지를 선택하세요 · 어두운 곳은 미탐사')}</div></div>
    <details class="harbor-plan-directory"><summary>${en?'Destinations & supplies':'목적지 · 보급 정보'} <span aria-hidden="true">＋</span></summary><nav class="harbor-plan-sites" aria-label="${en?'Choose destination':'목적지 선택'}"><p class="harbor-plan-list-label">${en?'SELECT A DESTINATION':'목적지 선택'}</p>
    ${m.sites.map(site=>`<button class="harbor-plan-site" data-harbor-target="${esc(site.id)}" aria-pressed="${site.selected}" ${site.selectable?'':'disabled'}><span class="harbor-plan-site-heading"><b><small>0${site.island+1}</small> ${esc(site.name)}</b><span>${site.selected?(en?'Selected':'선택됨'):site.status}</span></span>
      ${site.claimed?`<span class="harbor-plan-muted">${en?'Supplies already recovered':'물품 회수 완료'}</span>`:site.known?`<span class="harbor-plan-gear">${esc(site.gearText)} <small>${en?'aboard':'보유'} ${site.stack}</small></span><span>${en?'or ':'또는 '}${esc(site.supplyText)}${site.limited?`<small class="harbor-plan-actual">${en?'Now: ':'현재: '}${esc(site.actualSupplyText)}</small>`:''}</span>`:`<span class="harbor-plan-muted">${site.radio?(en?'Contents unconfirmed':'내용물 미확인'):(en?'Approach to discover':'접근하면 정보를 기록합니다')}</span>`}
      ${site.toolText?`<span class="harbor-plan-tool">${en?'Radio: ':'무전: '}${esc(site.toolText)}</span>`:''}
      ${site.rescueText?`<span class="harbor-plan-rescue">${esc(site.rescueText)}</span>`:''}
      ${site.threatText?`<span class="harbor-plan-sightings">${en?'Seen: ':'목격: '}${esc(site.threatText)}</span>`:''}
    </button>`).join('')}
    <button class="harbor-plan-site harbor-plan-boss" data-harbor-target="boss" aria-pressed="${m.boss.selected}" ${m.boss.selectable?'':'disabled'}><span class="harbor-plan-site-heading"><b>↗ ${m.boss.name}</b><span>${m.boss.selected?(en?'Selected':'선택됨'):s.boss.cleared?(en?'Cleared':'봉쇄 해제'):s.boss.active?(en?'Engaged':'교전 중'):en?'Optional':'직접 진입'}</span></span><span>${s.boss.cleared?(en?'Blockade cleared · quays remain accessible':'봉쇄 해제 완료 · 부두로 돌아갈 수 있습니다'):m.boss.toolMissing?(en?'Counter-tool not recovered':'대응 도구 미회수'):(en?'Counter-tool aboard':'대응 도구 보유')}</span></button>
    </nav></details></div>
    <footer class="harbor-plan-footer"><button id="harborPlanClear" ${m.canClear?'':'disabled'}>${en?'Clear destination':'목적지 해제'}</button><p>${en?'Select to resume · steer the boat yourself':'선택하면 항해로 복귀 · 배는 직접 조종하세요'}<small class="harbor-plan-record-note">${en?'Supply amounts are maxima. Sightings are past records.':'보급은 최대 제공량입니다. 목격은 과거 기록입니다.'}</small></p><span id="harborPlanSaveError" role="status" hidden></span></footer>
  </section>`;
}
