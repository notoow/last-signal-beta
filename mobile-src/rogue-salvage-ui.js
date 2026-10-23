import {maxHp,maxFuel,salvageChoicePreview} from './rogue-core.js';
import {salvageStatus,rigEffects} from './rogue-salvage.js';
import {usesSluice} from './sluice-counterplay.js';
import {usesLighthouse} from './lighthouse-counterplay.js';
import {pendingRescueDestination} from './harbor-plan-ui.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=value=>Number(value.toFixed(1));
const deviceCopy={
  ko:{
    standard:{name:'제동 축압기',upgrade:'보존 시간 4 → 7초 · 분사력 증가',install:'7초 보존 · 강화 분사',
      operation:'속도 40을 넘었을 때 Space로 감속해 충전. 35% 이상 모은 뒤 Shift + 전진으로 분사합니다.',
      cost:'부스터 18 · 연료 2 · 재사용 6초',caution:'저장 시간이 끝나면 모은 에너지가 사라집니다. 감속·정밀 추진 중에는 분사할 수 없습니다.'},
    bilge:{name:'압력 배수기',upgrade:'밸브를 닫을 때 분사력 증가',install:'밸브 제어로 강화 분사',
      operation:'밸브가 열린 상태에서 침수 20% 이상일 때 B로 닫으면, 물 20%를 배출하며 전진합니다.',
      cost:'연료 2 · 재사용 6초',caution:'재사용 중이거나 물이 부족해도 B는 밸브를 닫습니다. 분사 준비를 먼저 확인하세요.'},
    winch:{name:'축력 걸쇠',upgrade:'보존 시간 4 → 7초 · 분사력 증가',install:'7초 보존 · 강화 분사',
      operation:'축력 35 이상·장력 15% 초과일 때 E로 고리를 놓아 저장. 고리 없이 B를 누르면 저장한 방향으로 분사합니다.',
      cost:'연료 2 · 재사용 6초',caution:'다시 연결하면 저장분이 사라집니다. 고리에 연결된 B는 기존 구동부 공격입니다.'}
  },
  en:{
    standard:{name:'Brake accumulator',upgrade:'Storage 4 → 7s · stronger thrust',install:'7s storage · stronger thrust',
      operation:'Brake with Space above speed 40 to charge. At 35% or more, use Shift + forward to fire.',
      cost:'18 boost · 2 fuel · 6s cooldown',caution:'Stored energy expires when its timer runs out. Braking and precision thrust prevent firing.'},
    bilge:{name:'Pressure pump',upgrade:'Stronger thrust when closing the valve',install:'Stronger valve-powered thrust',
      operation:'With the valve open and at least 20% flooding, press B to close it. Expel 20% water for forward thrust.',
      cost:'2 fuel · 6s cooldown',caution:'B still closes the valve during cooldown or with too little water. Check that the pump is ready first.'},
    winch:{name:'Tension latch',upgrade:'Storage 4 → 7s · stronger thrust',install:'7s storage · stronger thrust',
      operation:'At 35 charge and over 15% tension, release the hook with E to store it. With no hook attached, B fires in the stored direction.',
      cost:'2 fuel · 6s cooldown',caution:'Reconnecting clears stored energy. While hooked, B still attacks the drive.'}
  }
};
export const salvageDeviceName=(s,language='ko')=>deviceCopy[language==='en'?'en':'ko'][s.build].name;

export function salvageChoiceMarkup(s,language='ko'){
  if(!s.salvage?.pending)return '';
  const en=language==='en',copy=deviceCopy[en?'en':'ko'][s.build],rank=s.salvage.rank;
  const rescue=pendingRescueDestination(s,language);
  const mechanic=(en?{standard:'Space brake → Shift forward',bilge:'B close valve → water jet',winch:'E store tension → B escape'}:
    {standard:'Space 감속 → Shift 전진',bilge:'B 밸브 닫기 → 물 분사',winch:'E 축력 저장 → B 회피'})[s.build];
  const labels=en?{hp:'Hull',fuel:'Fuel',flood:'Flooding'}:{hp:'선체',fuel:'연료',flood:'침수'};
  const stats=values=>`<dl class="rogue-salvage-stats">${['hp','fuel','flood'].map(key=>`<div data-salvage-resource="${key}"><dt>${labels[key]}</dt><dd>${amount(values[key])}${key==='flood'?'%':`<small> / ${key==='hp'?maxHp(s):maxFuel(s)}</small>`}</dd></div>`).join('')}</dl>`;
  const carried=s.supplyModel!=='legacy';
  const previews=Object.fromEntries(['rig','repair','fuel'].map(id=>[id,salvageChoicePreview(s,id)]));
  // The gain includes all departure supplies, in the same order/caps as core.
  // Do not attribute lost cargo/automatic fuel to the +55 choice alone.
  const fuelAdded=Math.max(0,previews.fuel.fuel-s.fuel);
  const fuelOffered=55+(carried?0:30)+(previews.fuel.cargoDelivered?20:0);
  const fuelOverflow=Math.max(0,fuelOffered-fuelAdded);
  const delta=value=>value>1e-6&&value<.1?'<0.1':amount(value);
  const choices=[
    {id:'rig',number:'01',title:en?'Modify the rig':'장치 개조',gain:'II',unit:copy.name,
      effect:rank>0?copy.upgrade:copy.install,
      note:rank>0?(en?'Prototype I → Modified II':'시제품 I → 개조 II'):(en?'Install directly · no prototype required':'시제품 없이 바로 설치'),
      action:en?'Fit rig & sail':'개조하고 출항'},
    {id:'repair',number:'02',title:en?'Repair the hull':'선체 수리',gain:'+45',unit:en?'Hull':'선체 내구도',
      effect:en?'Remove 30% flooding':'침수 30% 추가 제거',
      note:rank>0?(en?'Keep your current rig':'현재 장치 유지'):(en?'Rig remains uninstalled':'장치 미장착 유지'),
      action:en?'Repair & sail':'수리하고 출항'},
    {id:'fuel',number:'03',title:en?'Take on fuel':'연료 보충',gain:`+${delta(fuelAdded)}`,unit:en?'Total fuel added':'총 연료 증가',
      effect:en?'Choice reward +55':'선택 보상 +55',
      detail:fuelOverflow>1e-6?(en?`Total departure supplies: ${delta(fuelOverflow)} cannot fit.`:`이번 출항 총 보급 중 ${delta(fuelOverflow)} 미수령 · 용량 초과`):
        (en?'All departure fuel fits.':'이번 출항 연료 전량 적재'),
      note:rank>0?(en?'Keep your current rig':'현재 장치 유지'):(en?'Rig remains uninstalled':'장치 미장착 유지'),
      action:en?'Refuel & sail':'보충하고 출항'}
  ];
  return `<section class="rogue-salvage-desk" aria-labelledby="rogueSalvageTitle">
    <header class="rogue-salvage-header"><div><p class="rogue-salvage-kicker">${en?'QUAYSIDE WORKSHOP · 01 / 03':'부두 정비소 · 01 / 03'}</p><h2 id="rogueSalvageTitle">${en?'Ready for the next waters':'다음 해역을 준비하세요'}</h2><p>${en?'Next: Sluice channel · choose to depart immediately':'다음 해역: 방조 수로 · 선택하면 바로 출항'}</p></div><div class="rogue-salvage-current"><span>${en?'ARRIVAL CONDITION':'현재 선박 상태'}</span>${stats({hp:s.hp,fuel:s.fuel,flood:s.flood})}</div></header>
    <div class="rogue-salvage-common"><strong>${en?'Every choice includes':'공통 출항 보급'}</strong><span>${carried?(en?'Hull +18 · flooding −15%':'선체 +18 · 침수 −15%'):(en?'Hull +18 · fuel +30 · flooding −15%':'선체 +18 · 연료 +30 · 침수 −15%')}</span><small>${carried?(en?'Fuel carries over. No automatic refuel between regions. Supplies stop at capacity.':'남은 연료 이월 · 해역 이동 시 자동 보충 없음. 보급은 최대치까지만 적용됩니다.'):(en?'Choose one extra below. Supplies stop at capacity.':'아래에서 하나를 추가로 선택합니다. 최대치까지만 적용됩니다.')}${previews.rig.cargoDelivered?`<br>${en?'Supply boat return: fuel +20 · crew health +20 also included.':'보급정 귀환: 연료 +20 · 선원 체력 +20도 포함됩니다.'}`:''}</small></div>
    <div class="rogue-salvage-options">${choices.map(c=>`<article class="rogue-salvage-option" data-salvage-option="${c.id}"><div class="rogue-salvage-option-heading"><span>${c.number}</span><h3>${c.title}</h3></div><p class="rogue-salvage-gain"><b>${esc(c.gain)}</b><span>${esc(c.unit)}</span></p><p class="rogue-salvage-effect">${esc(c.effect)}${c.id==='rig'?`<span class="rogue-salvage-mechanic">${mechanic}</span>`:c.detail?`<span class="rogue-salvage-mechanic">${esc(c.detail)}</span>`:''}</p><p class="rogue-salvage-note">${esc(c.note)}</p><div class="rogue-salvage-preview"><span>${en?'AFTER DEPARTURE':'출항 후 예상 상태'}</span>${stats(previews[c.id])}</div><button type="button" data-salvage-choice="${c.id}">${c.action}<span aria-hidden="true">↗</span></button></article>`).join('')}</div>
    <footer class="rogue-workshop-return"><div>${rescue?`<p id="rogueWorkshopRescue">${en?'The mechanic is still on the quay. Once you sail onward, you cannot return.':'정비공이 아직 부두에 있습니다. 출항하면 돌아올 수 없습니다.'}</p><small>${en?'Location: ':'위치: '}${esc(rescue.name)}</small>`:`<p>${en?'You can keep exploring before choosing.':'선택하기 전에 폐항을 더 둘러볼 수 있습니다.'}</p>`}</div><div class="rogue-workshop-actions"><button type="button" id="rogueWorkshopReturn" ${rescue?'aria-describedby="rogueWorkshopRescue"':''}>${en?'Return to abandoned harbor':'폐항으로 돌아가기'}</button><button type="button" id="rogueSalvageHome">${en?'Harbor menu':'항구로 · 메뉴'}</button></div></footer>
    <p id="rogueWorkshopSaveError" class="rogue-workshop-save-error" role="status" hidden></p>
  </section>`;
}

export function salvageDetailsMarkup(s,language='ko'){
  if(!s.salvage)return '';
  const en=language==='en',copy=deviceCopy[en?'en':'ko'][s.build],rank=s.salvage.rank;
  if(!rank)return `<section class="rogue-salvage-details"><h3>${en?'Salvaged rig':'회수 장치'}</h3><p>${en?'No rig installed. Search the first region’s tool berth for a prototype, or fit a modified rig at the first exit workshop.':'아직 장치가 없습니다. 첫 해역의 도구 부두를 수색해 시제품을 찾거나, 첫 탈출 부두에서 개조 장치를 설치할 수 있습니다.'}</p></section>`;
  const caution=usesLighthouse(s)&&s.build==='winch'?(en?'Reconnecting clears stored energy. While connected to a relay, B spends 3 fuel, disconnects and launches away from it. This requires more than 3 fuel; it does not damage the lighthouse or transmit a manifest.':'다시 연결하면 저장분이 사라집니다. 중계기에 연결된 B는 연료 3을 써 접속을 끊고 중계기 반대쪽으로 발진합니다. 연료 3 초과가 필요하며 등대에 피해를 주거나 명부를 전송하지 않습니다.'):
    usesSluice(s)&&s.build==='winch'?(en?'Reconnecting clears stored energy. While moored to a sluice cleat, B spends 3 fuel and launches away from it, releasing the line. This requires more than 3 fuel and does not damage gates.':'다시 연결하면 저장분이 사라집니다. 수로의 계류 고리에 연결된 B는 연료 3을 써 줄을 놓고 계류점 반대쪽으로 발진합니다. 연료 3 초과가 필요하며 수문에 피해를 주지 않습니다.'):copy.caution;
  const effects=rigEffects(s),stackedPump=effects.stacked&&s.build==='bilge';
  const operation=stackedPump?(en?`With the valve open and at least 20% flooding, B closes and fires. Drain up to ${amount(effects.pumpCapacity)}% using water aboard. Extra thrust uses only water actually spent.`:`열린 밸브를 침수 20% 이상에서 B로 닫으면 분사합니다. 보유한 물을 최대 ${amount(effects.pumpCapacity)}% 배출하며, 실제 쓴 물만큼 분사력이 더해집니다.`):copy.operation;
  const water=stackedPump?(s.flood>=20?(en?`Current water: drain ${amount(effects.jetWater)}% · jet impulse ${amount(effects.jetPower)}.`:`현재 물 기준: 배수 ${amount(effects.jetWater)}% · 분사력 ${amount(effects.jetPower)}.`):(en?`Needs 20% flooding · current ${amount(s.flood)}%.`:`침수 20% 필요 · 현재 ${amount(s.flood)}%.`)):'';
  return `<section class="rogue-salvage-details"><h3>${esc(copy.name)} <span>${rank===2?(en?'Modified II':'개조 II'):(en?'Prototype I':'시제품 I')}</span></h3><p>${esc(operation)}</p>${water?`<p data-rig-water>${esc(water)}</p>`:''}<p>${esc(copy.cost)}${s.build!=='bilge'?` · ${en?'Storage':'보존'} ${rank===2?7:4}${en?'s':'초'}`:''}</p><p>${esc(caution)}</p><small>${en?'Requires more than 2 fuel and no active brace or side jet. Available during this run only.':'연료 2 초과 필요 · 버팀·횡추진 중 사용 불가. 이번 항해에서만 유지됩니다.'}</small></section>`;
}

// Eligibility comes from the machinery rules. This adds copy and a gauge only;
// mission/action priority and input handling remain with the HUD and app.
export function salvageHudCondition(s,language='ko'){
  const status=salvageStatus(s);if(!status.visible)return null;
  const en=language==='en',m=s.salvage,effects=rigEffects(s);
  const prompts=en?{
    inactive:'Underway only',cooldown:`Cooldown ${m.cooldown.toFixed(1)}s`,fuel:'Needs >2 fuel',
    skill:'Wait for captain skill',brake:'Build speed, then Space brake',boost:'Needs 18 boost',
    open:'B Open valve',fill:'Needs 20% flooding',release:'E Release → store',pull:'35 charge · tension >15%',hook:'E Hook required',
    ready:{standard:'Shift + forward · fire',bilge:'B Close & fire',winch:'B Escape thrust'}[s.build]
  }:{
    inactive:'운항 중 사용',cooldown:`재사용 ${m.cooldown.toFixed(1)}초`,fuel:'연료 2 초과 필요',
    skill:'선장 기술 종료 대기',brake:'속도를 낸 뒤 Space 충전',boost:'부스터 18 필요',
    open:'B 밸브 열기',fill:'침수 20% 필요',release:'E 분리 → 저장',pull:'축력 35 · 장력 15% 초과',hook:'E 고리 연결 필요',
    ready:{standard:'Shift + 전진 · 분사',bilge:'B 닫고 분사',winch:'B 회피 분사'}[s.build]
  };
  if(effects.stacked&&status.phase==='ready'){
    if(s.build==='bilge')prompts.ready+=en?` · drain ${amount(effects.jetWater)}%`:` · 배수 ${amount(effects.jetWater)}%`;
    if(s.build==='winch'&&effects.winchLaunchMultiplier>1)prompts.ready+=` ×${Number(effects.winchLaunchMultiplier.toFixed(2))}`;
  }
  const stored=m.window>0&&m.charge>0?` · ${Math.floor(m.charge)}% / ${m.window.toFixed(1)}${en?'s':'초'}`:'';
  const condition={id:'salvage',phase:status.phase,text:`${salvageDeviceName(s,language)} ${m.rank===2?'II':'I'}${stored} · ${prompts[status.phase]}`,
    tone:['ready','release'].includes(status.phase)?'ready':['fuel','boost'].includes(status.phase)?'warning':'normal'};
  if(s.mode==='sailing'&&(s.build==='standard'||s.build==='winch'&&s.boss.hook<0)&&m.charge>0){
    condition.gauge={value:m.charge,max:100,label:en?'Rig stored energy':'장치 저장 에너지',marks:[{value:35,label:en?'35 charge required':'축력 35 필요'}]};
  }
  return condition;
}
