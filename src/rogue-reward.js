import {resolveCache,resolveGear,maxHp,maxFuel} from './rogue-core.js';
import {gearEffect} from './rogue-cache.js';
import {cacheChoiceModel,cacheGearModel,cacheGearName} from './rogue-cache-ui.js';
import {crewEffects,crewRank} from './crew-upgrades.js';
import {escapeUi as esc} from './session-ui.js';

const clone=s=>structuredClone(s),fmt=v=>v>0&&v<.1?'<0.1':String(Number(v.toFixed(1)));
const gearIds=['motor','pump','winch','tank','plating','turbine'];
export function rewardArt(id){
  if(id==='cache')return {src:'assets/art/rogue-shore-props-v1.png',rect:[885,90,465,318]};
  if(['crew:grip','crew:stride','crew:guard'].includes(id))return {src:`assets/art/crew-upgrade-${id.slice(5)}-v1.png`};
  const i=gearIds.indexOf(id);return i<0?null:{src:'assets/art/ship-gear-atlas-v1.png',rect:[i%3*512,Math.floor(i/3)*512,512,512]};
}
export function rewardValue(s,id){
  if(id.startsWith('crew:')){const k=id.slice(5),e=crewEffects(s);return k==='grip'?e.melee:k==='stride'?(e.speed-1)*100:(1-e.damage)*100;}
  return id==='tank'?maxFuel(s):id==='plating'?maxHp(s):gearEffect(s,id).before;
}
export function rewardOptions(s,lang='ko',legacy=false){
  const en=lang==='en',m=cacheChoiceModel(s,lang),result=[];
  if(!m&&!legacy)return [];
  if(m?.crew){const id='crew:'+m.crew.id,after=clone(s);resolveCache(after,id);
    const labels=en?{grip:'Melee damage',stride:'Movement speed bonus',guard:'Crew damage reduction'}:{grip:'근접 공격력',stride:'이동 속도 보너스',guard:'선원 피해 감소'};
    result.push({id,type:'crew',name:en?m.crew.en:m.crew.name,label:labels[m.crew.id],before:rewardValue(s,id),after:rewardValue(after,id),unit:m.crew.id==='grip'?'':'%',rank:m.crew.rank,limit:m.crew.limit,
      description:en?'Worn by the crew for this voyage.':'이번 항해에서 선원이 착용합니다.',detail:en?'Crew upgrades do not use any of the six ship equipment slots.':'선원 강화는 선박 장비 6칸을 사용하지 않습니다.'});
  }
  for(const g of legacy?[cacheGearModel(s,s.pendingGear,lang)]:m.gear){
    if(!g)continue;const details=[g.description];
    if(g.pressureJet){const p=g.pressureJet;details.push(en?`Jet water ${fmt(p.before.water)}% → ${fmt(p.after.water)}%; impulse ${fmt(p.before.power)} → ${fmt(p.after.power)}`:`분사 배수 ${fmt(p.before.water)}% → ${fmt(p.after.water)}% · 분사력 ${fmt(p.before.power)} → ${fmt(p.after.power)}`);details.push(en?`Requires at least ${p.minimum}% flooding; only expels actual water.`:`침수 ${p.minimum}% 이상에서 실제 물만 배출합니다.`);if(g.needsRig)details.push(en?'Requires the recovered ship device.':'회수한 선박 장치가 필요합니다.');}
    if(g.wetThrust)details.push(en?`At ${g.wetThrust.flood}% flooding: thrust ${g.wetThrust.before}% → ${g.wetThrust.after}%`:`침수 ${g.wetThrust.flood}%에서 추진력 ${g.wetThrust.before}% → ${g.wetThrust.after}%`);
    if(g.launchBonus)details.push(en?`Launch +${g.launchBonus.before}% → +${g.launchBonus.after}%; charge ${fmt(g.chargeRate.before)} → ${fmt(g.chargeRate.after)}/s`:`발진 +${g.launchBonus.before}% → +${g.launchBonus.after}% · 충전 ${fmt(g.chargeRate.before)} → ${fmt(g.chargeRate.after)}/초`);
    if(g.damageReduction)details.push(en?`Damage reduction ${fmt(g.damageReduction.before)}% → ${fmt(g.damageReduction.after)}%`:`피해 경감 ${fmt(g.damageReduction.before)}% → ${fmt(g.damageReduction.after)}%`);
    result.push({...g,type:'gear',unit:g.suffix,detail:details.join('\n'),full:legacy||m.full});
  }
  if(m){const key=m.siteRole==='repair'?'hp':'fuel',labels=en?{hp:'Hull repair',fuel:'Fuel recovered',flood:'Flooding removed'}:{hp:'선체 수리',fuel:'연료 보충',flood:'침수 제거'};
    result.push({id:'supplies',type:'supplies',name:en?'Take supplies':'보급품 회수',label:labels[key],before:0,after:m.supply[key],unit:'',key,
      description:en?'Keep your equipment. Recover only what you can use.':'장비는 유지하고, 필요한 만큼만 보충합니다.',detail:Object.entries(m.offered).filter(([,v])=>v>0).map(([k,v])=>`${labels[k]}: ${fmt(m.supply[k])} / ${fmt(v)}${k==='flood'?'%':''}`).join('\n')});
  }return result;
}
export const rewardCommon=(s,lang)=>cacheChoiceModel(s,lang)?.common.map(v=>v.replace(/ · (시제품|Prototype) I$/,''))||[];
// Previews only: never mutate the live run. The app commits through the token API.
export function rewardPreview(s,id,slot,legacy=false){
  const next=clone(s);if(!legacy&&!resolveCache(next,id))return null;
  if(next.pendingGear&&slot!==undefined&&!resolveGear(next,slot))return null;return next;
}
export function rewardReceipt(before,after,id,slot,lang,legacy=false){
  const option=rewardOptions(before,lang,legacy).find(o=>o.id===id);
  return {option,trade:slot===null,legacy,crewRank:id.startsWith('crew:')?crewRank(after,id.slice(5)):null,slots:after.equipment.length,
    value:id==='supplies'?option.after:rewardValue(after,id),fuel:after.fuel-before.fuel,hp:after.hp-before.hp,scrap:after.combat.ammo-before.combat.ammo,
    common:legacy?[]:rewardCommon(before,lang).slice(1)};
}

// Lives for the whole game session, so a finger held on a gameplay control is
// known when the reward opens. No delay or synthetic click is used.
export function rewardInputGuard(root,signal){
  const contacts=new Set();let overlap=false,generation=0,modality='pointer';
  const options={capture:true,signal};
  window.addEventListener('pointerdown',e=>{modality='pointer';root.dataset.rewardInput=modality;if(!contacts.size)overlap=false;contacts.add(e.pointerId);if(contacts.size>1)overlap=true;},options);
  for(const type of ['pointerup','pointercancel'])window.addEventListener(type,e=>contacts.delete(e.pointerId),options);
  // Only an actual window blur ends contacts. Capturing descendant focus blur
  // would erase the fingers still held when gameplay focuses the new dialog.
  window.addEventListener('blur',()=>{contacts.clear();overlap=true;generation++;},{signal});
  return {transition(){generation++;},keyboard(){modality='keyboard';root.dataset.rewardInput=modality;},get modality(){return modality;},
    bind(el,fn){if(!el)return;let active=null;const born=generation;
      el.addEventListener('pointerdown',e=>{if(el.disabled||e.button!==0)return;e.preventDefault();active={id:e.pointerId,generation,x:e.clientX,y:e.clientY,dragged:false};el.setPointerCapture(e.pointerId);});
      el.addEventListener('pointermove',e=>{if(active?.id===e.pointerId&&Math.hypot(e.clientX-active.x,e.clientY-active.y)>10)active.dragged=true;});
      el.addEventListener('pointerup',e=>{if(active?.id!==e.pointerId)return;const valid=active.generation===generation&&!overlap&&!active.dragged&&Math.hypot(e.clientX-active.x,e.clientY-active.y)<=10,r=el.getBoundingClientRect();active=null;e.preventDefault();if(valid&&!el.disabled&&e.clientX>=r.x&&e.clientX<=r.right&&e.clientY>=r.y&&e.clientY<=r.bottom)fn();});
      for(const type of ['pointercancel','lostpointercapture'])el.addEventListener(type,()=>{active=null;});
      el.addEventListener('click',e=>{e.preventDefault();if(e.detail===0&&!el.disabled&&!contacts.size&&born===generation)fn();});
    }};
}

const imageCache=new Map();
function paint(container){for(const canvas of container.querySelectorAll('canvas[data-reward-art]')){
  const spec=rewardArt(canvas.dataset.rewardArt);if(!spec)continue;
  if(!imageCache.has(spec.src)){const img=new Image();img.src=spec.src;imageCache.set(spec.src,img);}const img=imageCache.get(spec.src);
  const draw=()=>{const c=canvas.getContext('2d');c.clearRect(0,0,512,512);if(spec.rect){const[x,y,w,h]=spec.rect,z=Math.min(512/w,512/h);c.drawImage(img,x,y,w,h,(512-w*z)/2,(512-h*z)/2,w*z,h*z);}else c.drawImage(img,0,0,512,512);canvas.dataset.loaded='true';};
  if(img.complete&&img.naturalWidth)draw();else img.addEventListener('load',draw,{once:true});
}}
function picture(id,hero=false){return rewardArt(id)?`<canvas width="512" height="512" data-reward-art="${esc(id)}" class="${hero?'hero-art':'thumb-art'}" aria-hidden="true"></canvas>`:`<div class="supply-mark ${hero?'large':''}" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M12 22h40v32H12zM22 22V12h20v10M12 32h40M27 32v7h10v-7"/></svg></div>`;}

export function rewardPresentation({initial,language='ko',reduced=false,legacy=false,guard,present,onConfirm,onLeave,onContinue,onRetry,onPause}){
  initial=clone(initial);const lang=language,T=(ko,en)=>lang==='en'?en:ko,options=rewardOptions(initial,lang,legacy),common=legacy?[]:rewardCommon(initial,lang);
  let phase=legacy?'replace':'found',selected=options[0].id,replacing=legacy?initial.pendingGear:null,slot=undefined,receipt=null,finished=false,failed=false,details=false;
  const category=o=>o.type==='crew'?T('선원 장착','CREW'):o.type==='gear'?T('선박 장비','SHIP GEAR'):T('보급','SUPPLIES');
  const btn=(id,text,cls='',disabled=false)=>`<button type="button" id="${id}" class="${cls}" ${disabled?'disabled':''}>${text}</button>`;
  const stat=(o,before=o.before,after=o.after,current=false)=>`<div class="stat" data-reward-stat="${esc(o.id)}"><span class="stat-label">${esc(o.label)}</span><div>${o.id==='supplies'?`<strong>+${esc(fmt(after))}</strong>`:current?`<small>${T('현재','Now')}</small><strong>${o.prefix||''}${esc(fmt(before))}<i>${esc(o.unit)}</i></strong>`:`<span class="before">${o.prefix||''}${esc(fmt(before))}${esc(o.unit)}</span><span class="arrow" aria-hidden="true">→</span><strong>${o.prefix||''}${esc(fmt(after))}<i>${esc(o.unit)}</i></strong>`}</div></div>`;
  const tradeStat=gain=>stat({id:'supplies',label:T('실제 연료 보충','Actual fuel recovered'),after:gain,unit:''});
  const included=()=>`<div class="included"><span>${T('어느 것을 골라도 함께','Included with any choice')}</span><b>${esc(common[0]||T('추가 보급 없음','No extra supplies'))}${common.length>1?` <em>+${common.length-1}</em>`:''}</b></div>`;
  const keep=o=>o.type==='crew'?`${T('선원 등급','Crew rank')} ${o.rank} → ${o.rank+1} / ${o.limit} · ${T('선박 장비칸 사용 안 함','No ship slot')}`:o.type==='gear'?`${T('같은 장비','Copies')} ${o.count} → ${o.count+1} · ${T('선박 장비 1칸','1 ship slot')}`:T('장비칸 사용 안 함','No equipment slot');
  const hero=(o,body,caption)=>`<section class="showcase"><div class="object">${picture(o.id,true)}<div class="object-shadow"></div><p class="object-caption">${caption}</p></div><div class="object-copy"><span class="eyebrow">${category(o)}</span><h2>${esc(o.name)}</h2>${body}</div></section>`;
  const refresh=focus=>present(api,focus);
  function markup(){
    const o=options.find(x=>x.id===selected);let body='',footer='';
    if(details){body=`<section class="detail-panel"><h2>${esc(o.name)}</h2><p class="eyebrow">${T('효과 상세','FULL EFFECT')}</p><p class="detail-text">${esc(o.detail)}</p><h3>${T('어느 보상을 골라도 함께 회수','Included with any choice')}</h3><ul>${common.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;footer=btn('rogueRewardDetailsClose',T('돌아가기','Back to the find'),'primary');}
    else if(phase==='found'){
      body=`<section class="discovery"><div class="object">${picture('cache',true)}<div class="object-shadow"></div></div><div><p class="eyebrow">${T('부두에서 찾은 물건','FOUND ON THE QUAY')}</p><h2>${T('살펴보고,<br>하나만 싣자.','Take a look.<br>Bring one aboard.')}</h2><p class="muted">${T('선원에게 필요한 것, 배를 위한 것.','Something for the crew. Something for the boat.')}</p><div class="find-count">${[...new Set(options.map(category))].map(esc).join('<i> / </i>')}</div></div></section>`;
      footer=btn('rogueCacheLeave',T('지금은 두기','Leave for now'),'quiet')+included()+btn('rogueRewardInspect',T('물건 살펴보기','Inspect the find'),'primary');
    }else if(phase==='choose'){
      body=`<nav class="choice-shelf" style="--rr-choices:${options.length}" aria-label="${T('발견한 보상','Found rewards')}">${options.map((x,i)=>`<button type="button" data-cache-choice="${x.id}" aria-pressed="${x.id===selected}" aria-label="${esc(x.name+' · '+category(x))}"><span class="choice-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="choice-art">${picture(x.id)}</span><b class="choice-name">${esc(x.name)}</b><span class="choice-category">${category(x)}</span>${stat(x,x.before,x.after,x.full)}</button>`).join('')}</nav>`;
      body+=`<div class="selection-note"><div><p class="retention">${esc(o.full?T('선박 장비칸이 모두 찼습니다. 교체할 장비를 골라 비교하세요.','Ship slots are full. Choose a replacement to compare.'):keep(o))}</p><p class="description">${esc(o.description)}</p></div>${btn('rogueRewardDetails',T('효과 자세히','Full effect'),'text-link')}</div>`;
      footer=btn('rogueCacheLeave',T('두기','Leave'),'quiet')+included()+btn('rogueRewardTake',o.type==='crew'?T('선원에게 장착','Equip on crew'):o.type==='supplies'?T('보급품 회수','Take supplies'):o.full?T('교체할 장비 선택','Choose replacement'):T('배에 장착','Fit to the boat'),'primary');
    }else if(phase==='replace'){
      const g=options.find(x=>x.id===replacing),after=slot===undefined?null:rewardPreview(initial,replacing,slot,legacy),trade=slot===null,gain=rewardPreview(initial,replacing,null,legacy).fuel-initial.fuel;
      const loss=after?{hp:initial.hp-after.hp,fuel:initial.fuel-after.fuel}:null;
      const slots=initial.equipment.map((id,i)=>`<button type="button" data-replace="${i}" aria-pressed="${slot===i}">${picture(id)}<span><small>${T('칸','SLOT')} ${i+1}</small><b>${esc(cacheGearName(id,lang))}</b></span><i>${slot===i?'✓':''}</i></button>`).join('');
      const result=after?`${trade?tradeStat(after.fuel-initial.fuel):stat(g,rewardValue(initial,g.id),rewardValue(after,g.id))}<p class="swap-name">${trade?T('장비 6개를 모두 유지합니다.','Keep all six installed items.'):`${esc(cacheGearName(initial.equipment[slot],lang))} <span>→</span> ${esc(g.name)}`}</p><dl class="limits"><div><dt>${T('최대 내구','Hull capacity')}</dt><dd>${maxHp(initial)} → ${maxHp(after)}</dd></div><div><dt>${T('최대 연료','Fuel capacity')}</dt><dd>${maxFuel(initial)} → ${maxFuel(after)}</dd></div></dl><p class="loss" data-reward-loss>${loss.hp>0||loss.fuel>0?`${T('내리면 잃는 양','Lost on removal')}: ${loss.hp>0?T('내구','Hull')+' −'+fmt(loss.hp):''} ${loss.fuel>0?T('연료','Fuel')+' −'+fmt(loss.fuel):''}`:trade?T('현재 용량에 맞춰 보충됩니다.','Recovery is limited by current capacity.'):T('현재 내구·연료 손실 없음','No current hull or fuel lost')}</p>`:`<p class="replacement-intro">${T('내리는 장비까지 반영해<br>장착 후 상태를 비교합니다.','See the result after<br>the old item is removed.')}</p>`;
      body=`<section class="replacement"><div class="hold"><p class="eyebrow">${T('내릴 장비 하나 선택','CHOOSE ONE ITEM TO REMOVE')}</p><div class="slots">${slots}</div><button type="button" id="rogueTrade" class="trade" aria-pressed="${trade}">${T('새 물건을 연료로 교환','Trade the new item for fuel')} <b>+${esc(fmt(gain))}</b></button></div><div class="replacement-copy"><div class="incoming">${picture(replacing)}<span><small>${legacy?T('저장된 장비 · 교체 대기','SAVED ITEM · AWAITING A SLOT'):T('새로 찾은 물건','NEW FIND')}</small><h2>${esc(g.name)}</h2></span></div>${result}</div></section>`;
      footer=btn('rogueRewardBack',legacy?T('일시정지','Pause'):T('다시 고르기','Back to choices'),'quiet')+`<p class="replace-note">${T('확인 전에는 아무것도 바뀌지 않습니다.','Nothing changes until you confirm.')}</p>`+btn('rogueRewardConfirm',trade?T('연료 교환 확정','Confirm fuel trade'):T('교체 확정','Confirm replacement'),'primary',slot===undefined);
    }else if(phase==='equipped'){
      const r=receipt,x=r.option,location=r.trade?T('연료로 교환했습니다.','Traded for fuel.'):x.type==='crew'?T('선원에게 장착했습니다.','Equipped on the crew.'):x.type==='gear'?T('선박에 장착했습니다.','Fitted to the boat.'):T('보급품을 회수했습니다.','Supplies recovered.');
      body=hero(x,`<p class="equipped-check">✓ ${location}</p>${r.trade?tradeStat(r.fuel):x.type==='supplies'?stat(x):stat(x,rewardValue(initial,x.id),r.value)}<p class="retention">${x.type==='crew'?`${T('선원 등급','Crew rank')} ${r.crewRank} / ${x.limit} · ${T('선박 장비','Ship gear')} ${r.slots}/6`:r.trade?T('기존 장비 6개 유지','All six items kept'):x.type==='gear'?`${T('선박 장비','Ship gear')} ${initial.equipment.length} → ${r.slots} / 6`:T('기존 장비 유지','Equipment kept')}</p><div class="receipt-extra">${r.scrap?`<span>${T('고철','Scrap')} +${r.scrap}</span>`:''}${r.common.map(x=>`<span>✓ ${esc(x)}</span>`).join('')}</div>`,T('항해 준비 완료','READY ABOARD'));
    }else body=`<section class="end-state"><h2>${T('지금은 두었습니다.','Left for now.')}</h2><p>${T('보상은 가져가지 않았습니다.','No reward was taken.')}</p></section>`;
    if(finished)footer=`<p class="decision-note">${failed?T('보상은 처리됐습니다. 저장만 다시 시도합니다.','The decision is complete. Only saving will be retried.'):T('저장 완료 · 항해를 계속할 수 있습니다.','Saved. Ready to continue.')}</p>${failed?btn('rogueRewardRetrySave',T('저장 다시 시도','Retry saving'),'quiet'):''}${btn('rogueRewardContinue',T('항해 계속','Continue voyage'),'primary',failed)}`;
    const site=cacheChoiceModel(initial,lang)?.site||T('회수 장비','RECOVERED GEAR'),title=details?T('물건 자세히 보기','Inspect the details'):phase==='found'?T('수색 완료','Search complete'):phase==='choose'?T('회수품 선택','Choose your salvage'):phase==='replace'?T('장비 교체','Make room aboard'):T('회수 완료','Ready aboard');
    const subtitle=phase==='choose'?T('이번 항해에 가져갈 하나를 고르세요.','Choose one thing to bring on this voyage.'):site;
    const html=`<section class="view" data-reward-phase="${details?'details':phase}" data-phase="${details?'details':phase}" data-motion="${reduced?'reduced':'full'}"><header class="top"><div><small>LAST SIGNAL</small><h1 id="rogueRewardHeading" tabindex="-1">${title}</h1><p class="subtitle">${esc(subtitle)}</p></div><div class="top-tools"><span class="capacity">${T('선박 장비','SHIP GEAR')}<b>${receipt?.slots??initial.equipment.length}<i> / 6</i></b></span>${btn('rogueRewardPause','Ⅱ','tool',finished&&failed)}</div></header><div class="content">${body}</div><footer class="actions">${footer}</footer><p id="rogueCacheSaveError" class="save-error" role="status" ${failed?'':'hidden'}>${failed?T('저장 실패 · 게임을 닫지 말고 다시 시도해 주세요.','Save failed. Keep the game open and try again.'):''}</p></section>`;
    return html.replace(/class="([^"]*)"/g,(_,names)=>`class="${names.split(/\s+/).filter(Boolean).map(n=>'rr-'+n).join(' ')}"`);
  }
  function mount(container,focus){
    const bind=(id,fn)=>guard.bind(container.querySelector('#'+id),fn);
    bind('rogueRewardInspect',()=>{phase='choose';refresh();});bind('rogueCacheLeave',()=>{if(!finished)onLeave();});bind('rogueRewardPause',onPause);
    bind('rogueRewardTake',()=>{if(finished)return;const o=options.find(x=>x.id===selected);if(o.full){replacing=o.id;slot=undefined;phase='replace';refresh();}else onConfirm(o.id);});
    bind('rogueRewardBack',()=>{if(legacy)onPause();else{phase='choose';refresh();}});
    bind('rogueRewardConfirm',()=>{if(!finished&&slot!==undefined)onConfirm(replacing,slot);});
    bind('rogueTrade',()=>{slot=null;refresh('#rogueTrade');});bind('rogueRewardContinue',()=>{if(finished&&!failed)onContinue();});bind('rogueRewardRetrySave',onRetry);
    bind('rogueRewardDetails',()=>{details=true;refresh();});bind('rogueRewardDetailsClose',()=>{details=false;refresh('#rogueRewardDetails');});
    container.querySelectorAll('[data-cache-choice]').forEach(el=>guard.bind(el,()=>{selected=el.dataset.cacheChoice;refresh(`[data-cache-choice="${selected}"]`);}));
    container.querySelectorAll('[data-replace]').forEach(el=>guard.bind(el,()=>{slot=Number(el.dataset.replace);refresh(`[data-replace="${slot}"]`);}));
    container.querySelector('#rogueRewardPause')?.setAttribute('aria-label',T('일시정지 / 저장 후 항구로','Pause / save and return to harbor'));
    paint(container);container.querySelector(guard.modality==='keyboard'&&focus?focus:'#rogueRewardHeading')?.focus({preventScroll:true});
  }
  const api={markup,mount,legacy,get finished(){return finished;},get surface(){return phase==='replace'?'inventory':finished?'reward':'cache';},
    setSaveError(value){failed=value;},complete(before,after,id,choiceSlot){finished=true;details=false;phase=id==='leave'?'left':'equipped';if(id!=='leave')receipt=rewardReceipt(before,after,id,choiceSlot,lang,legacy);},
    escape(){if(!details)return false;details=false;refresh('#rogueRewardDetails');return true;}};
  return api;
}
