// Evidence-only presentation. Offers and committed receipts belong to core.
const hiddenReasons=new Set(['voyage-ended','no-mechanic','not-moored','choice-open','destroyed']);
const reasons={
 ko:{danger:'주변 안전·견인선 닻 확인',resting:'휴식 준비 중',intact:'선체 손상 없음',exhausted:'이 해역 정비 횟수 소진','no-scrap':'고철 부족'},
 en:{danger:'Check threats and tow anchor',resting:'Preparing to rest',intact:'Hull intact',exhausted:'No repairs left this region','no-scrap':'Not enough scrap'}
};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value>0&&value<.1?'<0.1':String(Number(value.toFixed(1)));
const finite=value=>Number.isFinite(value)&&value>=0;
export function mechanicReceiptText(event,language='ko'){
 if(event?.kind!=='mechanic'||!finite(event.hp)||!finite(event.ammo)||!Number.isInteger(event.depth)||event.depth<0||!Number.isInteger(event.remaining)||event.remaining<0)throw Error('Expected a committed mechanic event');
 return language==='en'?`Hull +${number(event.hp)} · Scrap −${number(event.ammo)} · ${event.remaining} left in region ${event.depth+1}`:
  `선체 +${number(event.hp)} · 고철 −${number(event.ammo)} · ${event.depth+1}해역 ${event.remaining}회 남음`;
}
export function mechanicRadioText(event,language='ko'){
 return (language==='en'?'Mechanic: Repair complete. ':'정비공: 수리를 마쳤어요. ')+mechanicReceiptText(event,language);
}
export function mechanicModel(snapshot,language='ko',local={}){
 const offer=snapshot?.offer,en=language==='en',lang=en?'en':'ko';
 if(!snapshot?.active||!offer||hiddenReasons.has(offer.reason))return null;
 // An unavailable dock service should not cover combat. Keep an in-flight
 // transaction or unresolved save visible; safe offers return on the next read.
 if(offer.reason==='danger'&&!local.pending&&!local.saveFailed)return null;
 if(!finite(offer.hull)||!Number.isInteger(offer.ammo)||offer.ammo<0||!Number.isInteger(offer.remaining)||offer.remaining<0)throw Error('Invalid mechanic offer');
 const available=offer.available===true&&offer.reason===null;
 const cost=offer.reason==='no-scrap'&&Number.isInteger(snapshot.ownedAmmo)?`${snapshot.ownedAmmo}/${offer.ammo}`:String(offer.ammo);
 const receipt=local.receipt?mechanicReceiptText(local.receipt,lang):'';
 // Save retry owns the control. Otherwise live danger/rest/affordability takes
 // priority over a previous completion; intact/exhausted retain a final receipt.
 const complete=!!receipt&&(local.saveFailed||available||['intact','exhausted'].includes(offer.reason));
 const phase=local.saveFailed?'save-error':complete?'complete':'offer';
 const action=local.saveFailed?'retry-save':complete?(available?'view-next':'none'):available?'mechanic':'none';
 let reason=complete?'':offer.reason?(reasons[lang][offer.reason]||(en?'Repair unavailable':'수리 불가')):'';
 let title=complete?(en?`Repaired +${number(local.receipt.hp)}`:`수리 완료 +${number(local.receipt.hp)}`):en?`Hull +${number(offer.hull)}`:`선체 +${number(offer.hull)}`;
 let detail=complete?(en?`Scrap −${number(local.receipt.ammo)} · ${local.receipt.remaining} left this region`:`고철 −${number(local.receipt.ammo)} · 이 해역 ${local.receipt.remaining}회 남음`):
  en?`${cost} scrap · ${offer.remaining} left this region`:`고철 ${cost} · 이 해역 ${offer.remaining}회 남음`;
 let label=local.pending?(en?'Saving…':'저장 중…'):action==='retry-save'?(en?'Retry save':'저장 재시도'):action==='view-next'?(en?'View next':'다음 수리 보기'):complete?(en?'Done':'완료'):(en?'Repair':'수리');
 // Unavailable service needs a clear reason, not a third row repeating an
 // unusable Repair action. Keep normal two-line density without shrinking type.
 if(!complete&&!local.saveFailed&&!local.pending&&reasons[lang][offer.reason]){
  if(offer.reason==='no-scrap')label=en?'Need scrap':'고철 부족';
  else{
   label='';
   if(offer.reason==='danger'){title=en?'Repair paused':'수리 대기';detail=reasons[lang].danger;}
   else if(offer.reason==='resting')title=reasons[lang].resting;
   else{
    title=offer.reason==='intact'?reasons[lang].intact:(en?'No repairs left':'정비 횟수 소진');
    detail=en?`${offer.remaining} repairs left this region`:`이 해역 ${offer.remaining}회 남음`;
   }
  }
  reason='';
 }
 if(local.pending)reason='';
 return {action,phase,contextKey:snapshot.contextKey,offerKey:JSON.stringify([offer.ammo,offer.hull,offer.remaining,offer.reason]),
  enabled:action!=='none'&&!local.pending,retry:!!local.saveFailed,pending:!!local.pending,title,label,detail,
  reason,reasonCode:offer.reason||'ready',receipt,
  accessible:[en?'Mechanic dock repair':'정비공 정박 수리',title,detail,reason,
   action==='view-next'?(en?'View next repair offer · no scrap spent':'다음 수리 조건 보기 · 고철 소모 없음'):
   action==='retry-save'?(en?'Retry saving only · no extra scrap':'저장만 재시도 · 추가 고철 소모 없음'):label].filter(Boolean).join(' · ')};
}
const wrench='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3a6 6 0 0 0-7 7L2.8 14.2a3.5 3.5 0 0 0 5 5L12 15a6 6 0 0 0 7-7l-4 4-3-3z"/></svg>';
export function mechanicMarkup(model){
 if(!model)return '';
 const disabled=!model.enabled&&!model.retry||model.pending;
 return `<section class="dock-mechanic" data-mechanic-context="${esc(model.contextKey)}" data-phase="${esc(model.phase||'offer')}" aria-label="${esc(model.accessible)}">
 <button type="button" class="dock-mechanic-action" data-mechanic-action="${esc(model.action||'none')}" aria-label="${esc(model.accessible)}" aria-disabled="${disabled}"${disabled?' disabled':''}>
 ${wrench}<span class="dock-mechanic-copy" aria-live="polite" aria-atomic="true"><span class="dock-mechanic-heading"><strong>${esc(model.title)}</strong><span>${esc(model.label)}</span></span><span class="dock-mechanic-detail">${esc(model.detail)}</span><span class="dock-mechanic-reason"${model.reason?'':' hidden'}>${esc(model.reason)}</span></span></button></section>`;
}

// onAction must revalidate through core and return its actual receipt. It owns
// persistence; a failed save must never be retried by applying the action again.
export function createMechanicController({read,onAction,onRetrySave,language='ko',onChange=()=>{}}){
 let local={pending:false,saveFailed:false,receipt:null},contextKey,receiptContext;
 const snapshot=()=>{
  const next=read();
  if(next.contextKey!==contextKey){contextKey=next.contextKey;if(!local.saveFailed)local.receipt=null;}
  return next;
 };
 const model=()=>{const next=snapshot();return mechanicModel(next,language,{...local,receipt:local.saveFailed||receiptContext===next.contextKey?local.receipt:null});};
 async function activate(expectedContext,expectedAction,expectedOffer){
  const current=model();
  if(!current||local.pending||expectedContext!==undefined&&expectedContext!==current.contextKey)return false;
  if(expectedAction!==undefined&&expectedAction!==current.action||expectedOffer!==undefined&&expectedOffer!==current.offerKey)return false;
  if(!current.enabled&&!current.retry)return false;
  if(current.action==='view-next'){
   // This transition reveals the current quote; it does not call core or save.
   local.receipt=null;receiptContext=undefined;onChange();return true;
  }
  const retry=current.retry;local.pending=true;onChange();
  try{
   const result=await (retry?onRetrySave():onAction('mechanic'));
   if(retry){local.saveFailed=result?.saved!==true;return !local.saveFailed;}
   if(!result?.applied)return false;
   mechanicReceiptText(result.receipt,language);
   // An old save completion may not decorate a newer dock/run with its receipt.
   const sameContext=snapshot().contextKey===current.contextKey;
   local.receipt=sameContext?{...result.receipt}:null;
   receiptContext=sameContext?current.contextKey:undefined;local.saveFailed=result.saved!==true;
   return true;
  }finally{local.pending=false;onChange();}
 }
 return {model,activate};
}

// A separate stable host, never a child of #mobileTransit (its renderer owns
// exactly three buttons). Native click preserves Tab/Enter/Space access.
export function mountMechanicUI(host,controller){
 const document=host.ownerDocument;
 host.classList.add('dock-mechanic-host');
 host.innerHTML=mechanicMarkup({contextKey:'',accessible:'',title:'',label:'',detail:'',reason:'',receipt:'',enabled:false});
 const panel=host.querySelector('.dock-mechanic'),button=host.querySelector('button');
 const title=host.querySelector('strong'),label=host.querySelector('.dock-mechanic-heading>span'),detail=host.querySelector('.dock-mechanic-detail');
 const reason=host.querySelector('.dock-mechanic-reason');
 let armed=null,keyboardArm=null,disposed=false;
 const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
 function update(){
  if(disposed)return;
  const model=controller.model();host.hidden=!model;
  if(!model){button.disabled=true;armed=null;keyboardArm=null;delete host.dataset.placementReady;return;}
  if(armed!==null&&!sameQuote(armed,model))armed=null;
  if(keyboardArm!==null&&!sameQuote(keyboardArm,model))keyboardArm=null;
  panel.dataset.mechanicContext=model.contextKey;panel.dataset.state=model.reasonCode;panel.dataset.phase=model.phase;
  panel.setAttribute('aria-label',model.accessible);button.setAttribute('aria-label',model.accessible);button.dataset.mechanicAction=model.action;
  button.disabled=(!model.enabled&&!model.retry)||model.pending;button.setAttribute('aria-disabled',String(button.disabled));
  button.setAttribute('aria-busy',String(model.pending));
  text(title,model.title);text(label,model.label);text(detail,model.detail);text(reason,model.reason);
  reason.hidden=!model.reason;
 }
 const quote=model=>model?{contextKey:model.contextKey,action:model.action,offerKey:model.offerKey}:null;
 const sameQuote=(armed,model)=>armed.contextKey===model.contextKey&&armed.action===model.action&&armed.offerKey===model.offerKey;
 const activate=expected=>controller.activate(expected.contextKey,expected.action,expected.offerKey);
 const down=event=>{event.stopPropagation();armed=quote(controller.model());};
 const up=event=>event.stopPropagation();
 const cancel=()=>{armed=null;keyboardArm=null;};
 const key=event=>{
  if(!['Enter',' '].includes(event.key))return;
  event.preventDefault();event.stopPropagation();if(event.repeat)return;keyboardArm=quote(controller.model());
 };
 const keyup=async event=>{
  if(!['Enter',' '].includes(event.key))return;
  event.preventDefault();event.stopPropagation();const expected=keyboardArm;keyboardArm=null;
  if(expected===null||button.disabled)return;await activate(expected);update();
 };
 const click=async event=>{
  event.stopPropagation();if(button.disabled)return;
  // A fast second tap may safely reveal a quote, but must never spend again.
  if(event.detail>1&&armed?.action!=='view-next'){armed=null;return;}
  if(event.detail>0&&armed===null)return;
  const expected=armed??quote(controller.model());armed=null;
  if(!expected)return;await activate(expected);update();
 };
 button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',cancel);
 button.addEventListener('keydown',key);button.addEventListener('keyup',keyup);button.addEventListener('click',click);
 // Returning from a background app must not retain an armed dock gesture.
 document.defaultView?.addEventListener('blur',cancel);
 update();
 return {update,destroy(){disposed=true;button.removeEventListener('pointerdown',down);button.removeEventListener('pointerup',up);button.removeEventListener('pointercancel',cancel);button.removeEventListener('keydown',key);button.removeEventListener('keyup',keyup);button.removeEventListener('click',click);document.defaultView?.removeEventListener('blur',cancel);host.replaceChildren();}};
}

// The app's window-capture handler currently stops all keyboard propagation.
// Its integration must call this BEFORE that stop and clear its tracked key;
// E/Q, movement and attack away from this focused button stay with the game.
export function mechanicOwnsKey(event,host){
 return !!host&&!host.hidden&&(event.code==='Tab'||!!event.target?.nodeType&&host.contains(event.target)&&['Enter','NumpadEnter','Space'].includes(event.code));
}

// Preserve the existing anchor placement when clear. Otherwise move only this
// row to the nearest clear HUD pocket. No map/control moves or z-index escape.
const mechanicAvoidSelectors='#mobileObjective,#mobileNotice,#mobileResources,#mobileVitals,#mobileMinimap,#mobileContext,#mobileBuildStatus,#mobileBossEncounter,#mobileActions button,#mobileTools,#mobileSupplyDetails,#mobileStick,#rogueMission,#rogueRadio,#rogueReadings,#rogueConditions,#rogueSkill,#roguePause,#rogueChart,#rogueQuayAssets';
const mechanicRect=r=>({left:r.left??r.x,top:r.top??r.y,width:r.width??r.w,height:r.height??r.h});
const validMechanicRect=r=>[r.left,r.top,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
export function chooseMechanicPlacement({viewportWidth:w,viewportHeight:h,width,height,anchors,avoid=[],side='right'}){
 const edge=12,gap=8,rects=anchors.map(mechanicRect).filter(validMechanicRect),obstacles=[...rects,...avoid.map(mechanicRect).filter(validMechanicRect)];
 if(!rects.length)return null;
 const clampX=x=>Math.max(edge,Math.min(w-width-edge,x)),clampY=y=>Math.max(edge,Math.min(h-height-edge,y));
 const preferred={left:clampX(side==='left'?Math.min(...rects.map(r=>r.left)):Math.max(...rects.map(r=>r.left+r.width))-width),
  top:Math.min(...rects.map(r=>r.top))-gap-height};
 const clear=p=>p.left>=edge&&p.top>=edge&&p.left+width<=w-edge&&p.top+height<=h-edge&&obstacles.every(r=>
  p.left+width+gap<=r.left||p.left>=r.left+r.width+gap||p.top+height+gap<=r.top||p.top>=r.top+r.height+gap);
 if(clear(preferred))return {...preferred,width,height,fits:true,shifted:false};
 const xs=[...new Set([clampX(preferred.left),edge,w-width-edge,...obstacles.flatMap(r=>[clampX(r.left-width-gap),clampX(r.left+r.width+gap)])])];
 const ys=[...new Set([clampY(preferred.top),edge,h-height-edge,...obstacles.flatMap(r=>[clampY(r.top-height-gap),clampY(r.top+r.height+gap)])])];
 // Horizontal movement is less disruptive to the above-transit hierarchy.
 const candidates=xs.flatMap(left=>ys.map(top=>({left,top,score:Math.abs(left-preferred.left)+3*Math.abs(top-preferred.top)})))
  .sort((a,b)=>a.score-b.score||a.top-b.top||(side==='left'?a.left-b.left:b.left-a.left));
 const found=candidates.find(clear);
 // Retain a visible, explicitly failing placement when no pocket exists. Never
 // hide the save-retry action or clip it to manufacture a passing measurement.
 return {...(found?{left:found.left,top:found.top}:preferred),width,height,fits:!!found,shifted:!!found};
}
export function positionMechanicUI(host,anchors,{side='right',viewportWidth,viewportHeight,avoid}={}){
 const win=host.ownerDocument.defaultView,w=viewportWidth??win.innerWidth,h=viewportHeight??win.innerHeight;
 const isVisible=element=>element&&element!==host&&!host.contains(element)&&!element.hidden&&element.getClientRects().length&&win.getComputedStyle(element).visibility==='visible';
 const visible=anchors.filter(isVisible);
 if(host.hidden||!visible.length){delete host.dataset.placementReady;return {placed:false,reason:host.hidden?'hidden':'no-visible-anchor'};}
 const rects=visible.map(element=>element.getBoundingClientRect()),width=Math.min(256,w-24);
 // Width must be applied before measuring localized ready/reason/retry height.
 host.style.width=width+'px';
 const blocked=[...(avoid??host.ownerDocument.querySelectorAll(mechanicAvoidSelectors))].filter(isVisible).map(element=>element.getBoundingClientRect());
 const placement=chooseMechanicPlacement({viewportWidth:w,viewportHeight:h,width,height:host.getBoundingClientRect().height,anchors:rects,avoid:blocked,side});
 if(!placement){delete host.dataset.placementReady;return {placed:false,reason:'no-measurable-anchor'};}
 const bottom=h-placement.top-placement.height;
 host.style.left=placement.left+'px';host.style.bottom=bottom+'px';
 host.dataset.placementFits=String(placement.fits);host.dataset.placementReady='true';
 host.dataset.placementShifted=String(placement.shifted);
 return {placed:true,...placement,bottom};
}
