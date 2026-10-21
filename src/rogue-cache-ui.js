import {GEAR,maxHp,maxFuel,cacheSupplyPreview} from './rogue-core.js';
import {cacheOffer,gearEffect} from './rogue-cache.js';
import {FLOOR_TOOLS,SHORE_SITES,toolBerth,hasTool} from './shore-encounters.js';
import {salvageDeviceName} from './rogue-salvage-ui.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value>0&&value<.1?'<0.1':String(Number(value.toFixed(1)));
const names={motor:'Drive motor',pump:'Bilge pump',winch:'Reinforced line',tank:'Fuel tank',plating:'Impact bulkhead',turbine:'Flood turbine'};
export const cacheGearName=(id,language='ko')=>language==='en'?names[id]:GEAR[id];
const effectCopy={
  ko:{
    motor:['장비 추진력 보너스','%','선체의 기본 추진력을 강화합니다.'],
    pump:['밸브를 닫았을 때 배수','%/초','침수 발전선의 물을 더 빨리 뺍니다.'],
    winch:['장비 견인력 보너스','%','팽팽한 줄로 전달하는 힘이 커집니다.'],
    tank:['최대 연료','','탱크 용량만 늘어납니다. 연료는 채워지지 않습니다.'],
    plating:['최대 선체 내구','','내구 한도와 피해 경감이 늘어납니다. 자동 수리는 없습니다.'],
    turbine:['부스터 회복','/초','부스터를 쓰지 않을 때 더 빨리 회복합니다.']
  },
  en:{
    motor:['Equipment thrust bonus','%','Increases the force of the boat’s drive.'],
    pump:['Drain with valve closed','%/s','Drain water faster on the Flood drive.'],
    winch:['Equipment towing bonus','%','Transfer more force through a taut line.'],
    tank:['Fuel capacity','','A larger tank. Does not add fuel.'],
    plating:['Hull capacity','','Raises capacity and reduces damage. Does not repair damage.'],
    turbine:['Boost recovery','/s','Recover boost faster while not boosting.']
  }
};

function gearDescription(g,en){
  if(g.pressureJet){const p=g.pressureJet;return en?
    `Max jet ${number(p.before.water)}% → ${number(p.after.water)}% · impulse ${number(p.before.power)} → ${number(p.after.power)}`:
    `최대 분사 배수 ${number(p.before.water)}% → ${number(p.after.water)}% · 분사력 ${number(p.before.power)} → ${number(p.after.power)}`;}
  if(g.launchBonus&&g.chargeRate){const b=g.launchBonus,c=g.chargeRate;return en?
    `Charge ${number(c.before)} → ${number(c.after)}/s · launch +${number(b.before)}% → +${number(b.after)}%`:
    `충전 ${number(c.before)} → ${number(c.after)}/초 · 발진 +${number(b.before)}% → +${number(b.after)}%`;}
  if(g.damageReduction)return en?`Damage reduced ${number(g.damageReduction.before)}% → ${number(g.damageReduction.after)}%. No repair.`:`피해 경감 ${number(g.damageReduction.before)}% → ${number(g.damageReduction.after)}% · 자동 수리 없음`;
  if(g.wetThrust)return en?`At ${g.wetThrust.flood}% flooding: thrust ${g.wetThrust.before}% → ${g.wetThrust.after}%`:`침수 ${g.wetThrust.flood}%일 때 추진력 ${g.wetThrust.before}% → ${g.wetThrust.after}%`;
  return g.description;
}

// Read-only: previews use the same offer and gear-effect helpers as the core.
export function cacheChoiceModel(s,language='ko'){
  if(!s.pendingCache)return null;
  const offer=cacheOffer(s);
  if(!offer)return null;
  const en=language==='en',lang=en?'en':'ko';
  const berth=s.map.berths.find(b=>b.id===s.pendingCache.berth);
  const preview=cacheSupplyPreview(s);
  const supply={fuel:preview.fuelGain,hp:preview.hpGain,flood:preview.floodRemoved};
  const common=[];
  if(s.combat){
    const ammo=Math.min(4,12-s.combat.ammo);
    common.push(en?`Scrap +${ammo}${ammo<4?' · capacity 12':''}`:`고철 +${ammo}${ammo<4?' · 최대 12':''}`);
    if(berth.id===toolBerth(s).id&&!hasTool(s,FLOOR_TOOLS[s.depth].id)){
      common.push(en?['Anti-reverse ratchet','Flow baffle','Light shutter'][s.depth]:FLOOR_TOOLS[s.depth].name);
      if(s.depth===0&&s.salvage&&!s.salvage.recovered)common.push(salvageDeviceName(s,language)+(en?' · Prototype I':' · 시제품 I'));
    }
  }
  return {full:s.equipment.length>=6,slots:s.equipment.length,
    site:en?['Salvage yard','Fuel wharf','Fish-market landing'][berth.island]:SHORE_SITES[berth.island],
    gear:offer.gear.map(id=>{
      const effect=gearEffect(s,id),capacity=id==='tank'?maxFuel(s):id==='plating'?maxHp(s):null;
      return {id,name:cacheGearName(id,language),...effect,
        before:capacity??effect.before,after:capacity===null?effect.after:capacity+effect.after-effect.before,
        prefix:['thrustBonus','pullBonus'].includes(effect.kind)?'+':'',
        label:effectCopy[lang][id][0],suffix:effectCopy[lang][id][1],description:effectCopy[lang][id][2],
        needsRig:!s.salvage?.rank,count:s.equipment.filter(x=>x===id).length};
    }),supply,offered:offer.supply,siteRole:offer.siteRole,common};
}

export function cacheChoiceMarkup(s,language='ko'){
  const m=cacheChoiceModel(s,language);if(!m)return '';
  const en=language==='en',labels=en?{fuel:'Fuel',hp:'Hull repair',flood:'Flooding removed'}:{fuel:'연료',hp:'선체 수리',flood:'침수 제거'};
  const primary=m.siteRole==='repair'?'hp':'fuel';
  const supplyStats=Object.keys(labels).filter(key=>m.offered[key]>0);
  const capacityLimited=supplyStats.some(key=>m.supply[key]<m.offered[key]-1e-6);
  return `<section class="rogue-salvage-desk rogue-cache-desk">
    <header class="rogue-salvage-header"><div><p class="rogue-salvage-kicker">${esc(m.site)} · ${en?'SEARCH COMPLETE':'수색 완료'}</p>
      <h2>${en?'Choose what to take':'가져갈 것을 고르세요'}</h2><p>${en?'Choose one. The voyage is paused.':'하나만 선택하세요. 항해는 잠시 멈춰 있습니다.'}</p></div>
      <div class="rogue-cache-capacity"><span>${en?'Equipment carried':'보유 장비'}</span><b>${m.slots}<small> / 6</small></b><span>${m.full?(en?'Replacement required':'선택 후 교체 필요'):(en?'Copies stack':'같은 장비도 중첩')}</span></div>
    </header>
    <div class="rogue-salvage-options">
      ${m.gear.map((g,i)=>`<article class="rogue-salvage-option" data-cache-option="${g.id}">
        <div class="rogue-salvage-option-heading"><span>0${i+1}</span><h3>${esc(g.name)}</h3></div>
        <p class="rogue-cache-label">${m.full?(en?'If added · ':'추가 장착 시 · '):''}${esc(g.label)}</p>
        <p class="rogue-cache-effect"><span>${g.prefix}${esc(number(g.before))}${esc(g.suffix)}</span><i aria-hidden="true">→</i><b>${g.prefix}${esc(number(g.after))}${esc(g.suffix)}</b></p>
        <p class="rogue-cache-description">${esc(gearDescription(g,en))}</p>
        <p class="rogue-cache-note">${g.pressureJet?(en?`20% min · water-limited${g.needsRig?' · needs a rig':''}`:`침수 20%부터 · 실제 물만 사용${g.needsRig?' · 장치 필요':''}`):g.launchBonus?(en?'Taut line to charge · launch / stored jets':'팽팽한 줄에서 충전 · 발진 / 저장 분사 적용'):m.full?(en?'Compare the actual result on the next screen.':'다음 화면에서 실제 교체 결과를 비교합니다.'):(en?`Carried ${g.count} → ${g.count+1}`:`보유 ${g.count}개 → ${g.count+1}개`)}</p>
        <button data-cache-choice="${g.id}">${m.full?(en?'Choose replacement':'교체할 장비 선택'):(en?'Take equipment':'장비 가져가기')}<span aria-hidden="true">↗</span></button>
      </article>`).join('')}
      <article class="rogue-salvage-option" data-cache-option="supplies">
        <div class="rogue-salvage-option-heading"><span>03</span><h3>${en?'Take supplies':'보급품 가져가기'}</h3></div>
        <p class="rogue-cache-label">${en?'Actual recovery':'실제 회복량'}</p>
        <p class="rogue-cache-effect"><b>+${esc(number(m.supply[primary]))}</b><span>${labels[primary]}</span></p>
        <p class="rogue-cache-description">${supplyStats.filter(key=>key!==primary).map(key=>`${labels[key]} ${key==='flood'?'−':'+'}${number(m.supply[key])}${key==='flood'?'%':''}`).join(' · ')|| (en?'Keep your current equipment.':'현재 장비는 그대로 유지됩니다.')}</p>
        <p class="rogue-cache-note">${capacityLimited?(en?'Recovery is limited by your current condition.':'현재 상태·용량에 맞춰 회복됩니다.'):(en?'No equipment slot used.':'장비칸을 사용하지 않습니다.')}</p>
        <button data-cache-choice="supplies">${en?'Take supplies':'보급품 받기'}<span aria-hidden="true">↗</span></button>
      </article>
    </div>
    ${m.common.length?`<div class="rogue-cache-common"><strong>${en?'With any reward':'어느 보상이든 함께'}</strong><span>${m.common.map(esc).join(' · ')}</span></div>`:''}
    <footer class="rogue-salvage-footer"><button id="rogueCacheLeave">${en?'Leave for now':'지금은 두기'}</button><p>${en?'Esc · Pause / save and return to harbor':'Esc · 일시정지 / 저장 후 항구로'}</p></footer>
    <p id="rogueCacheSaveError" class="rogue-cache-save-error" role="status" hidden></p>
  </section>`;
}

export function cacheReplacementMarkup(s,language='ko'){
  const en=language==='en',gain=Math.max(0,Math.min(maxFuel(s),s.fuel+15)-s.fuel);
  return `<section class="rogue-salvage-desk rogue-cache-desk">
    <header class="rogue-salvage-header"><div><p class="rogue-salvage-kicker">${en?'EQUIPMENT · 6 / 6':'보유 장비 · 6 / 6'}</p><h2>${en?'Make room for ':'새로 싣기 · '}${esc(cacheGearName(s.pendingGear,language))}</h2><p>${en?'Choose one item to replace. Copies stack.':'교체할 장비 하나를 고르세요. 같은 장비도 중첩됩니다.'}</p></div></header>
    <div class="rogue-cache-replacements">${s.equipment.map((id,i)=>{
      const after={...s,equipment:s.equipment.map((g,j)=>j===i?s.pendingGear:g)};
      const gear=s.pendingGear,copy=effectCopy[en?'en':'ko'][gear];
      const beforeValue=gear==='tank'?maxFuel(s):gear==='plating'?maxHp(s):gearEffect(s,gear).before;
      const afterValue=gear==='tank'?maxFuel(after):gear==='plating'?maxHp(after):gearEffect(after,gear).before;
      return `<button data-replace="${i}"><span><small>0${i+1}</small> ${esc(cacheGearName(id,language))}</span><small class="rogue-cache-replace-effect">${esc(copy[0])}<br>${esc(number(beforeValue))}${esc(copy[1])} → ${esc(number(afterValue))}${esc(copy[1])}</small><small>${en?'After: hull limit':'교체 후 최대 내구'} ${maxHp(after)} · ${en?'fuel':'연료'} ${maxFuel(after)}</small></button>`;
    }).join('')}</div>
    <div class="rogue-cache-common"><span>${en?'Removing a tank or bulkhead lowers capacity. Excess fuel or hull is lost.':'연료통·격벽을 내리면 최대치가 줄며, 초과하는 연료·내구는 사라집니다.'}</span></div>
    <footer class="rogue-salvage-footer"><button id="rogueTrade">${en?'Trade instead · fuel':'대신 연료로 교환'} +${esc(number(gain))}</button><p>${en?'Esc · Pause / save and return to harbor':'Esc · 일시정지 / 저장 후 항구로'}</p></footer>
    <p id="rogueCacheSaveError" class="rogue-cache-save-error" role="status" hidden></p>
  </section>`;
}
