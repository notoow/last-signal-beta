// Crew growth values and offers are read from the authoritative core.
import {resolveCache,resolveGear,maxHp,maxFuel} from './rogue-core.js';
import {gearEffect} from './rogue-cache.js';
import {cacheChoiceModel,cacheGearModel,cacheGearName,crewPreviewCopy} from './rogue-cache-ui.js';
import {CREW_UPGRADES,crewRank,crewCurrentStat} from './crew-upgrades.js';
import {escapeUi as esc} from './session-ui.js';

const clone=s=>structuredClone(s),fmt=v=>v>0&&v<.1?'<0.1':String(Number(v.toFixed(1)));
const gearIds=['motor','pump','winch','tank','plating','turbine'];
export function rewardArt(id){
  if(id==='crew:shot')return {src:'assets/art/crew-upgrade-shot-v1.png'};
  if(id==='cache')return {src:'assets/art/rogue-shore-props-v1.png',rect:[885,90,465,318]};
  if(['crew:grip','crew:stride','crew:guard'].includes(id))return {src:`assets/art/crew-upgrade-${id.slice(5)}-v1.png`};
  const i=gearIds.indexOf(id);return i<0?null:{src:'assets/art/ship-gear-atlas-v1.png',rect:[i%3*512,Math.floor(i/3)*512,512,512]};
}
export function rewardValue(s,id){
  if(id.startsWith('crew:'))return crewCurrentStat(s,id.slice(5))?.value??null;
  return id==='tank'?maxFuel(s):id==='plating'?maxHp(s):gearEffect(s,id).before;
}
export function rewardOptions(s,lang='ko',legacy=false){
  const en=lang==='en',m=cacheChoiceModel(s,lang),result=[];
  if(!m&&!legacy)return [];
  for(const crew of m?.crews??[]){const id='crew:'+crew.id,copy=crewPreviewCopy(crew,lang);
    result.push({id,type:'crew',name:en?crew.en:crew.name,label:copy.label,before:crew.stat.before,after:crew.stat.after,unit:crew.stat.unit,rank:crew.rank,nextRank:crew.nextRank,limit:crew.limit,unlocks:copy.unlocks,
      description:en?'Worn by the crew for this voyage.':'이번 항해에서 선원이 착용합니다.',detail:[en?'Crew upgrades do not use any of the six ship equipment slots.':'선원 강화는 선박 장비 6칸을 사용하지 않습니다.',...copy.unlocks.map(x=>x.detail)].join('\n')});
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
    result.push({id:'supplies',type:'supplies',name:en?'Take supplies only':'보급만 회수',label:labels[key],before:0,after:m.supply[key],unit:'',key,gains:{...m.supply},
      description:en?'Keep your equipment. Recover only what you can use.':'장비는 유지하고, 필요한 만큼만 보충합니다.',detail:Object.entries(m.offered).filter(([,v])=>v>0).map(([k,v])=>`${labels[k]}: ${fmt(m.supply[k])} / ${fmt(v)}${k==='flood'?'%':''}`).join('\n')});
  }return result;
}
export const rewardCommon=(s,lang)=>cacheChoiceModel(s,lang)?.commonItems.filter(x=>x.amount===undefined||x.amount>0).map(x=>x.text.replace(/ · (시제품|Prototype) I$/,''))||[];
export function rewardHistory(s,lang='ko'){
  const counts=new Map();for(const id of s.equipment)counts.set(id,(counts.get(id)||0)+1);
  return [...Object.entries(CREW_UPGRADES).filter(([id])=>crewRank(s,id)>0).map(([id,g])=>({id:'crew:'+id,name:lang==='en'?g.en:g.name,progress:`Lv.${crewRank(s,id)} / ${g.limit}${crewRank(s,id)>=g.limit?' · MAX':''}`})),
    ...[...counts].map(([id,n])=>({id,name:cacheGearName(id,lang),progress:`×${n}`}))];
}
// Previews only: never mutate the live run. The app commits through the token API.
export function rewardPreview(s,id,slot,legacy=false){
  const next=clone(s);if(!legacy&&!resolveCache(next,id))return null;
  if(next.pendingGear&&slot!==undefined&&!resolveGear(next,slot))return null;return next;
}
export function rewardReceipt(before,after,id,slot,lang,legacy=false){
  const option=rewardOptions(before,lang,legacy).find(o=>o.id===id);
  const common=legacy?null:cacheChoiceModel(before,lang);
  const rig=common?.rig&&!before.salvage.recovered&&after.salvage?.recovered&&after.salvage.rank>before.salvage.rank?common.rig:null;
  return {option,trade:slot===null,legacy,crewRank:id.startsWith('crew:')?crewRank(after,id.slice(5)):null,slots:after.equipment.length,
    value:id==='supplies'?option.after:rewardValue(after,id),fuel:after.fuel-before.fuel,hp:after.hp-before.hp,scrap:after.combat.ammo-before.combat.ammo,
    rig,common:common?.commonItems.filter(x=>x.kind==='tool'&&!before.tools.includes(x.id)&&after.tools.includes(x.id)).map(x=>x.text)||[]};
}

// Lives for the whole game session, so a finger held on a gameplay control is
// known when the reward opens. No delay or synthetic click is used.
export function rewardInputGuard(root,signal){
  const contacts=new Set();let overlap=false,generation=0,modality='pointer';
  const options={capture:true,signal};
  // Mobile world aiming dispatches a synthetic mouse down without a matching
  // up. It is an action command, not a physical contact held over the dialog.
  window.addEventListener('pointerdown',e=>{if(e.isTrusted===false)return;modality='pointer';root.dataset.rewardInput=modality;if(!contacts.size)overlap=false;contacts.add(e.pointerId);if(contacts.size>1)overlap=true;},options);
  for(const type of ['pointerup','pointercancel'])window.addEventListener(type,e=>{if(e.isTrusted!==false)contacts.delete(e.pointerId);},options);
  // Only an actual window blur ends contacts. Capturing descendant focus blur
  // would erase the fingers still held when gameplay focuses the new dialog.
  const interrupt=()=>{contacts.clear();overlap=true;generation++;};
  window.addEventListener('blur',interrupt,{signal});
  // Mobile app switching can hide the page without delivering blur or the
  // final pointer event. Discard that gesture; require a fresh press on return.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();},{signal});
  return {transition(){generation++;},keyboard(){modality='keyboard';root.dataset.rewardInput=modality;},get modality(){return modality;},
    bind(el,fn){if(!el)return;let active=null;
      el.addEventListener('pointerdown',e=>{if(el.disabled||e.button!==0)return;e.preventDefault();active={id:e.pointerId,generation,x:e.clientX,y:e.clientY,dragged:false};el.setPointerCapture(e.pointerId);});
      el.addEventListener('pointermove',e=>{if(active?.id===e.pointerId&&Math.hypot(e.clientX-active.x,e.clientY-active.y)>10)active.dragged=true;});
      el.addEventListener('pointerup',e=>{if(active?.id!==e.pointerId)return;const valid=active.generation===generation&&!overlap&&!active.dragged&&Math.hypot(e.clientX-active.x,e.clientY-active.y)<=10,r=el.getBoundingClientRect();active=null;e.preventDefault();if(valid&&!el.disabled&&e.clientX>=r.x&&e.clientX<=r.right&&e.clientY>=r.y&&e.clientY<=r.bottom)fn();});
      for(const type of ['pointercancel','lostpointercapture'])el.addEventListener(type,()=>{active=null;});
      // Blur invalidates in-flight pointer gestures, not fresh keyboard input
      // on the still-mounted dialog. Detached previous views stay inert.
      el.addEventListener('click',e=>{e.preventDefault();if(e.detail===0&&!el.disabled&&!contacts.size&&el.isConnected&&root.contains(el))fn();});
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
  const rig=legacy?null:cacheChoiceModel(initial,lang)?.rig,history=rewardHistory(initial,lang);
  let phase=options.length?(legacy?'replace':'choose'):'unavailable',selected=options[0]?.id,replacing=legacy?initial.pendingGear:null,slot=undefined,receipt=null,finished=false,failed=false,details=false,detailReturn='';
  const category=o=>o.type==='crew'?T('선원 장착','CREW'):o.type==='gear'?T('선박 장비','SHIP GEAR'):T('보급','SUPPLIES');
  const btn=(id,text,cls='',disabled=false)=>`<button type="button" id="${id}" class="${cls}" ${disabled?'disabled':''}>${text}</button>`;
  const stat=(o,before=o.before,after=o.after,current=false)=>`<div class="stat" data-reward-stat="${esc(o.id)}"><span class="stat-label">${esc(o.label)}</span><div>${o.id==='supplies'?`<strong>+${esc(fmt(after))}</strong>`:current?`<small>${T('현재','Now')}</small><strong>${o.prefix||''}${esc(fmt(before))}<i>${esc(o.unit)}</i></strong>`:`<span class="before">${o.prefix||''}${esc(fmt(before))}${esc(o.unit)}</span><span class="arrow" aria-hidden="true">→</span><strong>${o.prefix||''}${esc(fmt(after))}<i>${esc(o.unit)}</i></strong>`}</div></div>`;
  const tradeStat=gain=>stat({id:'supplies',label:T('실제 연료 보충','Actual fuel recovered'),after:gain,unit:''});
  const included=()=>`<div class="included${rig?' has-rig':''}"${rig?` data-reward-rig="${rig.id}"`:''}><span>${T('어느 것을 골라도 함께','Included with any choice')}</span><div><b>${esc(common[0]||T('추가 보급 없음','No extra supplies'))}${common.length>1?` <em>+${common.length-1}</em>`:''}</b>${rig?`<small class="rig-use">${esc(rig.action)}</small>`:''}</div></div>`;
  const keep=o=>o.type==='crew'?`${T('선원 등급','Crew rank')} ${o.rank} → ${o.nextRank} / ${o.limit} · ${T('선박 장비칸 사용 안 함','No ship slot')}`:o.type==='gear'?`${T('같은 장비','Copies')} ${o.count} → ${o.count+1} · ${T('선박 장비 1칸','1 ship slot')}`:T('장비칸 사용 안 함','No equipment slot');
  const progress=o=>o.type==='crew'?`Lv.${o.rank} → ${o.nextRank}`:o.type==='gear'?(o.full?T('교체','REPLACE'):`×${o.count} → ${o.count+1}`):T('회복','RECOVER');
  const comparison=o=>o.type==='supplies'?`+${fmt(o.after)}`:o.full?`${T('현재','Now')} ${o.prefix||''}${fmt(o.before)}${o.unit}`:`${o.prefix||''}${fmt(o.before)} → ${o.prefix||''}${fmt(o.after)}${o.unit}`;
  const effectDetail=o=>o.detail.startsWith(o.description)?o.detail:o.description+'\n'+o.detail;
  const supplySummary=o=>Object.entries(o.gains).filter(([,v])=>v>0).map(([k,v])=>`${({fuel:T('연료','Fuel'),hp:T('내구','Hull'),flood:T('침수','Flood')})[k]} ${k==='flood'?'−':'+'}${fmt(v)}${k==='flood'?'%':''}`).join(' · ')||T('실제 회복량 0','Actual recovery 0');
  const commonDetails=()=>`<h3>${T('어느 보상을 골라도 함께 회수','Included with any choice')}</h3><ul>${common.map((x,i)=>`<li>${esc(x)}${rig&&i===0?`<small class="rig-use">${esc(rig.action)}</small>`:''}</li>`).join('')}</ul>`;
  const hero=(o,body,caption)=>`<section class="showcase"><div class="object">${picture(o.id,true)}<div class="object-shadow"></div><p class="object-caption">${caption}</p></div><div class="object-copy"><span class="eyebrow">${category(o)}</span><h2>${esc(o.name)}</h2>${body}</div></section>`;
  const refresh=focus=>present(api,focus);
  function markup(){
    const o=options.find(x=>x.id===selected),crewDetail=details==='effect'&&o?.type==='crew';let body='',footer='';
    if(details){
      let content;
      if(details==='history'){
        const items=history.length?`<ul class="history-list">${history.map(x=>`<li>${picture(x.id)}<span>${esc(x.name)}</span><b>${esc(x.progress)}</b></li>`).join('')}</ul>`:`<p>${T('아직 획득한 강화가 없습니다.','No upgrades acquired yet.')}</p>`;
        content=`<h2>${T('이번 항해의 성장','This voyage’s upgrades')}</h2>${items}`;
      }else if(details==='included')content=commonDetails();
      else if(crewDetail)content=`<div class="crew-detail-main" data-reward-essential><div class="crew-detail-stat">${stat(o)}</div>${o.unlocks.length?`<div class="crew-unlocks">${o.unlocks.map(u=>`<section class="crew-unlock" data-reward-unlock="${esc(u.id)}"><p class="unlock-label">${T('이번에 얻는 효과','New at this rank')}</p><h2>${esc(u.short)}</h2><ul>${u.conditionLabels.map((text,i)=>`<li data-reward-condition="${esc(u.conditions[i])}">${esc(text)}</li>`).join('')}</ul>${u.note?`<p class="unlock-note">${esc(u.note)}</p>`:''}</section>`).join('')}</div>`:''}</div>`;
      else content=`<h2>${esc(o.name)}</h2><p class="eyebrow">${category(o)} · ${esc(progress(o))}</p>${stat(o,o.before,o.after,o.full)}<p class="detail-text">${esc(effectDetail(o))}</p><p class="retention">${esc(o.full?T('선박 장비칸이 모두 찼습니다. 교체할 장비를 골라 비교하세요.','Ship slots are full. Choose a replacement to compare.'):keep(o))}</p>${commonDetails()}`;
      body=`<section class="detail-panel${crewDetail?' crew-detail':''}">${content}</section>`;footer=(crewDetail?`<p class="crew-detail-note">${T('이번 항해 · 선박 장비칸 사용 안 함','This voyage · No ship slot used')}</p>`:'')+btn('rogueRewardDetailsClose',T('돌아가기','Back to choices'),'primary');
    }else if(phase==='unavailable'){
      body=`<section class="end-state"><h2>${T('보상을 다시 확인할 수 없습니다.','This reward is unavailable.')}</h2><p>${T('항해는 멈춰 있습니다. 일시정지 메뉴로 돌아가세요.','The voyage is paused. Return to the pause menu.')}</p></section>`;
    }else if(phase==='choose'){
      const growth=options.filter(x=>x.type!=='supplies'),supply=options.find(x=>x.type==='supplies');
      body=`<nav class="growth-options" aria-label="${T('성장 선택','Choose an upgrade')}">${growth.map(x=>`<div class="growth-row"><button type="button" class="growth-pick" data-cache-choice="${esc(x.id)}"><span class="growth-art">${picture(x.id)}</span><span class="growth-copy"><b class="growth-name">${esc(x.name)} <small>${esc(progress(x))}</small></b><span class="growth-effect${x.unlocks?.length?' has-unlock':''}">${esc(x.unlocks?.length?x.unlocks.map(u=>u.short).join(' · '):x.label)}</span></span><span class="growth-value" data-reward-stat="${esc(x.id)}"><strong>${esc(comparison(x))}</strong><small>${x.full?T('교체 비교 →','Compare swap →'):x.unlocks?.length?esc(x.label):T('선택 →','Choose →')}</small></span></button><button type="button" class="growth-info" data-reward-detail="${esc(x.id)}" aria-label="${esc(x.name+' · '+T('효과 상세','Full effect'))}">ⓘ</button></div>`).join('')}</nav>`;
      footer=btn('rogueRewardHistory',`${T('이번 항해','This run')} <b>${history.length}</b> <span aria-hidden="true">›</span>`,'growth-history')+(common.length?btn('rogueRewardIncluded',`${T('함께','Also')} +${common.length}`,'growth-common'):'')+(supply?`<button type="button" class="growth-supplies" data-cache-choice="supplies"><b>${esc(supply.name)}</b><small>${esc(supplySummary(supply))}</small></button>`:'')+btn('rogueCacheLeave',T('두기','Leave'),'growth-leave');
    }else if(phase==='replace'){
      const g=options.find(x=>x.id===replacing),after=slot===undefined?null:rewardPreview(initial,replacing,slot,legacy),trade=slot===null,gain=rewardPreview(initial,replacing,null,legacy).fuel-initial.fuel;
      const loss=after?{hp:initial.hp-after.hp,fuel:initial.fuel-after.fuel}:null;
      const slots=initial.equipment.map((id,i)=>`<button type="button" data-replace="${i}" aria-pressed="${slot===i}">${picture(id)}<span><small>${T('칸','SLOT')} ${i+1}</small><b>${esc(cacheGearName(id,lang))}</b></span><i>${slot===i?'✓':''}</i></button>`).join('');
      const result=after?`${trade?tradeStat(after.fuel-initial.fuel):stat(g,rewardValue(initial,g.id),rewardValue(after,g.id))}<p class="swap-name">${trade?T('장비 6개를 모두 유지합니다.','Keep all six installed items.'):`${esc(cacheGearName(initial.equipment[slot],lang))} <span>→</span> ${esc(g.name)}`}</p><dl class="limits"><div><dt>${T('최대 내구','Hull capacity')}</dt><dd>${maxHp(initial)} → ${maxHp(after)}</dd></div><div><dt>${T('최대 연료','Fuel capacity')}</dt><dd>${maxFuel(initial)} → ${maxFuel(after)}</dd></div></dl><p class="loss" data-reward-loss>${loss.hp>0||loss.fuel>0?`${T('내리면 잃는 양','Lost on removal')}: ${loss.hp>0?T('내구','Hull')+' −'+fmt(loss.hp):''} ${loss.fuel>0?T('연료','Fuel')+' −'+fmt(loss.fuel):''}`:trade?T('현재 용량에 맞춰 보충됩니다.','Recovery is limited by current capacity.'):T('현재 내구·연료 손실 없음','No current hull or fuel lost')}</p>`:`<p class="replacement-intro">${T('내리는 장비까지 반영해<br>장착 후 상태를 비교합니다.','See the result after<br>the old item is removed.')}</p>`;
      body=`<section class="replacement"><div class="hold"><p class="eyebrow">${T('내릴 장비 하나 선택','CHOOSE ONE ITEM TO REMOVE')}</p><div class="slots">${slots}</div><button type="button" id="rogueTrade" class="trade" aria-pressed="${trade}">${T('새 물건을 연료로 교환','Trade the new item for fuel')} <b>+${esc(fmt(gain))}</b></button></div><div class="replacement-copy"><div class="incoming">${picture(replacing)}<span><small>${legacy?T('저장된 장비 · 교체 대기','SAVED ITEM · AWAITING A SLOT'):T('새로 찾은 물건','NEW FIND')}</small><h2>${esc(g.name)}</h2></span></div>${result}</div></section>`;
      footer=btn('rogueRewardBack',legacy?T('일시정지','Pause'):T('다시 고르기','Back to choices'),'quiet')+(rig?included():`<p class="replace-note">${T('확인 전에는 아무것도 바뀌지 않습니다.','Nothing changes until you confirm.')}</p>`)+btn('rogueRewardConfirm',trade?T('연료 교환 확정','Confirm fuel trade'):T('교체 확정','Confirm replacement'),'primary',slot===undefined);
    }else if(phase==='equipped'){
      const r=receipt,x=r.option,location=r.trade?T('연료로 교환했습니다.','Traded for fuel.'):x.type==='crew'?T('선원에게 장착했습니다.','Equipped on the crew.'):x.type==='gear'?T('선박에 장착했습니다.','Fitted to the boat.'):T('보급품을 회수했습니다.','Supplies recovered.');
      body=hero(x,`<p class="equipped-check">✓ ${location}</p>${r.trade?tradeStat(r.fuel):x.type==='supplies'?stat(x):stat(x,rewardValue(initial,x.id),r.value)}<p class="retention">${x.type==='crew'?`${T('선원 등급','Crew rank')} ${r.crewRank} / ${x.limit} · ${T('선박 장비','Ship gear')} ${r.slots}/6`:r.trade?T('기존 장비 6개 유지','All six items kept'):x.type==='gear'?`${T('선박 장비','Ship gear')} ${initial.equipment.length} → ${r.slots} / 6`:T('기존 장비 유지','Equipment kept')}</p><div class="receipt-extra">${r.scrap?`<span>${T('고철','Scrap')} +${r.scrap}</span>`:''}${r.common.map(x=>`<span>✓ ${esc(x)}</span>`).join('')}</div>`,T('항해 준비 완료','READY ABOARD'));
    }else body=`<section class="end-state"><h2>${T('지금은 두었습니다.','Left for now.')}</h2><p>${T('보상은 가져가지 않았습니다.','No reward was taken.')}</p></section>`;
    if(finished){
      const status=receipt?.rig?`<p class="decision-note rig-received" data-reward-rig="${receipt.rig.id}"><b>✓ ${esc(receipt.rig.name)} · ${failed?T('장착 · 저장 대기','Installed · save pending'):T('장착 · 저장 완료','Installed · saved')}</b><small class="rig-use">${esc(receipt.rig.action)}</small></p>`:
        `<p class="decision-note">${failed?T('보상은 처리됐습니다. 저장만 다시 시도합니다.','The decision is complete. Only saving will be retried.'):T('저장 완료 · 항해를 계속할 수 있습니다.','Saved. Ready to continue.')}</p>`;
      footer=status+`${failed?btn('rogueRewardRetrySave',T('저장 다시 시도','Retry saving'),'primary'):btn('rogueRewardContinue',T('항해 계속','Continue voyage'),'primary')}`;
    }
    const site=cacheChoiceModel(initial,lang)?.site||T('회수 장비','RECOVERED GEAR'),title=crewDetail?esc(o.name):finished&&failed?T('저장 대기','Save pending'):details?T('보상 정보','Reward details'):phase==='choose'?T('성장 선택','Choose an upgrade'):phase==='replace'?T('장비 교체','Make room aboard'):phase==='unavailable'?T('보상 확인','Reward unavailable'):T('회수 완료','Ready aboard');
    const subtitle=crewDetail?`${category(o)} · ${progress(o)}`:phase==='choose'?T('하나 선택 · 항해 일시정지','Choose one · Voyage paused'):site;
    const html=`<section class="view" data-reward-phase="${details?'details':phase}" data-phase="${details?'details':phase}" data-detail="${crewDetail?'crew-effect':details||''}" data-motion="${reduced?'reduced':'full'}"><header class="top"><div><small>LAST SIGNAL</small><h1 id="rogueRewardHeading" tabindex="-1">${title}</h1><p class="subtitle">${esc(subtitle)}</p></div><div class="top-tools"><span class="capacity">${T('선박 장비','SHIP GEAR')}<b>${receipt?.slots??initial.equipment.length}<i> / 6</i></b></span>${btn('rogueRewardPause','Ⅱ','tool',finished&&failed)}</div></header><div class="content">${body}</div><footer class="actions">${footer}</footer><p id="rogueCacheSaveError" class="save-error" role="status" ${failed?'':'hidden'}>${failed?T('저장 실패 · 게임을 닫지 말고 다시 시도해 주세요.','Save failed. Keep the game open and try again.'):''}</p></section>`;
    return html.replace(/class="([^"]*)"/g,(_,names)=>`class="${names.split(/\s+/).filter(Boolean).map(n=>'rr-'+n).join(' ')}"`);
  }
  function mount(container,focus){
    const bind=(id,fn)=>guard.bind(container.querySelector('#'+id),fn);
    bind('rogueCacheLeave',()=>{if(!finished)onLeave();});bind('rogueRewardPause',onPause);
    bind('rogueRewardBack',()=>{if(legacy)onPause();else{phase='choose';refresh();}});
    bind('rogueRewardConfirm',()=>{if(!finished&&slot!==undefined)onConfirm(replacing,slot);});
    bind('rogueTrade',()=>{slot=null;refresh('#rogueTrade');});bind('rogueRewardContinue',()=>{if(finished&&!failed)onContinue();});bind('rogueRewardRetrySave',onRetry);
    const openDetails=(kind,back)=>{details=kind;detailReturn=back;refresh();};
    bind('rogueRewardHistory',()=>openDetails('history','#rogueRewardHistory'));
    bind('rogueRewardIncluded',()=>openDetails('included','#rogueRewardIncluded'));
    bind('rogueRewardDetailsClose',()=>{details=false;refresh(detailReturn);});
    container.querySelectorAll('[data-reward-detail]').forEach(el=>guard.bind(el,()=>{if(finished)return;selected=el.dataset.rewardDetail;openDetails('effect',`[data-reward-detail="${selected}"]`);}));
    container.querySelectorAll('[data-cache-choice]').forEach(el=>guard.bind(el,()=>{if(finished)return;selected=el.dataset.cacheChoice;const o=options.find(x=>x.id===selected);if(!o)return;if(o.full){replacing=o.id;slot=undefined;phase='replace';refresh();}else onConfirm(o.id);}));
    container.querySelectorAll('[data-replace]').forEach(el=>guard.bind(el,()=>{slot=Number(el.dataset.replace);refresh(`[data-replace="${slot}"]`);}));
    container.querySelector('#rogueRewardPause')?.setAttribute('aria-label',T('일시정지 / 저장 후 항구로','Pause / save and return to harbor'));
    paint(container);container.querySelector(guard.modality==='keyboard'&&focus?focus:'#rogueRewardHeading')?.focus({preventScroll:true});
  }
  const api={markup,mount,legacy,get finished(){return finished;},get surface(){return phase==='replace'?'inventory':finished?'reward':'cache';},
    setSaveError(value){failed=value;},complete(before,after,id,choiceSlot){finished=true;details=false;phase=id==='leave'?'left':'equipped';if(id!=='leave')receipt=rewardReceipt(before,after,id,choiceSlot,lang,legacy);},
    escape(){if(!details)return false;details=false;refresh(detailReturn);return true;}};
  return api;
}
