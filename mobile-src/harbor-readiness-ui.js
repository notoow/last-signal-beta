import {activateModal,releaseModal} from './session-ui.js';

const words={
 ko:{loading:'항구를 준비하고 있어요',delayed:'준비에 시간이 조금 더 필요해요',error:'항구 화면을 불러오지 못했어요',switching:'간소화 화면으로 전환하고 있어요',
  loadingDetail:'준비가 끝나면 이어집니다. 기다리는 동안 항해는 멈춰 있습니다.',switchingDetail:'간소화 화면이 준비될 때까지 항해는 멈춰 있습니다.',
  delayedDetail:'조금 더 기다리거나 간소화 화면으로 계속할 수 있습니다.',
  errorDetail:'다시 시도하거나 간소화 화면으로 계속할 수 있습니다.',
  unavailableDetail:'다시 시도하거나 돌아갈 수 있습니다.',
  fallbackNote:'간소화 화면은 건물 표현이 달라지며, 조작은 그대로 유지됩니다.',
  retry:'다시 시도',fallback:'간소화 화면으로 계속',harbor:'항구로',preparation:'준비 화면으로',paused:'대기 중에는 항해가 멈춥니다.',
  retryFailed:'다시 불러오지 못했어요. 재시도하거나 돌아갈 수 있습니다.',
  fallbackFailed:'화면을 열지 못했어요. 다시 시도하거나 돌아갈 수 있습니다.',
  backFailed:'돌아가지 못했어요. 다시 시도해 주세요.'},
 en:{loading:'Preparing the harbor',delayed:'The harbor is taking longer to load',error:'The harbor could not load',switching:'Opening simple visuals',
  loadingDetail:'Your voyage will continue when ready. It stays paused while you wait.',switchingDetail:'Your voyage stays paused until the simple scene is ready.',
  delayedDetail:'Keep waiting, or continue with simple visuals.',
  errorDetail:'Try again, or continue with simple visuals.',
  unavailableDetail:'Try again or go back.',
  fallbackNote:'Buildings will look simpler. Controls stay the same.',
  retry:'Retry',fallback:'Continue with simple visuals',harbor:'Back to harbor',preparation:'Back to preparation',paused:'Your voyage stays paused while you wait.',
  retryFailed:'Loading failed again. You can retry or go back.',
  fallbackFailed:'The scene could not open. You can retry or go back.',
  backFailed:'Could not go back. Please try again.'}
};
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function harborReadyModel({phase='loading',language='ko',returnTo='harbor',canFallback=false,busy=null,notice=null,reduced=false}={}){
 if(!['loading','delayed','error'].includes(phase))throw new TypeError('Unknown readiness phase');
 if(!['harbor','preparation'].includes(returnTo))throw new TypeError('Unknown return destination');
 if(busy!==null&&!['retry','fallback'].includes(busy))throw new TypeError('Unknown readiness action');
 canFallback=canFallback===true;
 const w=words[language==='en'?'en':'ko'],recovery=phase!=='loading';
 return {phase,language:language==='en'?'en':'ko',returnTo,canFallback:canFallback===true,busy,reduced:!!reduced,
  title:busy==='fallback'?w.switching:busy==='retry'?w.loading:w[phase],
  detail:busy==='fallback'?w.switchingDetail:busy==='retry'||phase==='loading'?w.loadingDetail:canFallback?w[phase+'Detail']:w.unavailableDetail,
  pauseNote:phase==='loading'?'':w.paused,
  fallbackNote:recovery&&canFallback?w.fallbackNote:'',
  notice:w[notice]||'',indicator:phase!=='error'||!!busy,
  actions:{back:{label:w[returnTo],visible:true,disabled:false},retry:{label:w.retry,visible:recovery,disabled:!!busy},fallback:{label:w.fallback,visible:recovery&&canFallback===true,disabled:!!busy}}};
}
const button=(action,m)=>`<button type="button" data-ready-action="${action}"${m.visible?'':' hidden'}${m.disabled?' disabled':''}>${action==='back'?'<span aria-hidden="true">←</span> ':''}${escape(m.label)}</button>`;
export function harborReadyMarkup(options={}){
 const m=harborReadyModel(options);
 return `<section class="harbor-ready" data-phase="${m.phase}" data-reduced="${m.reduced}" aria-describedby="harbor-ready-detail">
  <header>${button('back',m.actions.back)}</header>
  <div class="harbor-ready-copy"><p class="harbor-ready-brand">LAST SIGNAL</p>
   <h2 id="harbor-ready-title" tabindex="-1" data-ready-heading>${escape(m.title)}</h2>
   <span class="harbor-ready-indicator" aria-hidden="true"${m.indicator?'':' hidden'}></span>
   <p id="harbor-ready-detail" role="status" aria-live="polite" aria-atomic="true">${escape(m.detail)}</p>
   <p class="harbor-ready-paused"${m.pauseNote?'':' hidden'}>${escape(m.pauseNote)}</p>
   <p class="harbor-ready-notice" role="status" aria-live="polite"${m.notice?'':' hidden'}>${escape(m.notice)}</p>
  </div>
  <footer${m.phase==='loading'?' hidden':''}><p class="harbor-ready-fallback-note"${m.fallbackNote?'':' hidden'}>${escape(m.fallbackNote)}</p>
   <div class="harbor-ready-actions">${button('retry',m.actions.retry)}${button('fallback',m.actions.fallback)}</div>
  </footer>
 </section>`;
}

// Presentation only. The caller owns pause, readiness, cancellation tokens,
// renderer choice, saves and entry/exit. Updating this view cannot resume play.
export function mountHarborReadiness(container,{onAction,signal,...initial}={}){
 if(typeof onAction!=='function')throw new TypeError('Readiness actions require an owner');
 if(signal?.aborted)return {update:()=>false,dispose(){},request:()=>false};
 let state={...initial},model=harborReadyModel(state),disposed=false,generation=0;
 const controller=new AbortController();
 releaseModal(container);container.classList.add('harbor-ready-modal');container.hidden=false;
 container.innerHTML=harborReadyMarkup(state);const section=container.firstElementChild;
 const get=s=>section.querySelector(s),heading=get('[data-ready-heading]');
 const setText=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 function update(next){
  if(disposed||container.firstElementChild!==section)return false;
  state={...state,...next};model=harborReadyModel(state);generation++;
  section.dataset.phase=model.phase;section.dataset.reduced=String(model.reduced);setText(heading,model.title);
  setText(get('#harbor-ready-detail'),model.detail);
  for(const [selector,value]of [['.harbor-ready-paused',model.pauseNote],['.harbor-ready-fallback-note',model.fallbackNote],['.harbor-ready-notice',model.notice]]){
   const el=get(selector);setText(el,value);el.hidden=!value;
  }
  get('.harbor-ready-indicator').hidden=!model.indicator;get('footer').hidden=model.phase==='loading';
  for(const [key,a]of Object.entries(model.actions)){
   const el=get(`[data-ready-action="${key}"]`);el.hidden=!a.visible;el.disabled=a.disabled;
   if(key==='back'){const html='<span aria-hidden="true">←</span> '+escape(a.label);if(el.innerHTML!==html)el.innerHTML=html;}else setText(el,a.label);
  }
  const focused=container.ownerDocument.activeElement;
  if(section.contains(focused)&&(focused.hidden||focused.disabled||focused.closest('[hidden]')))heading.focus({preventScroll:true});
  return true;
 }
 function request(action){
  const a=model.actions[action];
  if(disposed||container.firstElementChild!==section||!a?.visible||a.disabled)return false;
  update({busy:action==='back'?null:action,notice:null});const token=generation;
  const fail=()=>{if(!disposed&&token===generation)update({busy:null,phase:action==='back'?state.phase:'error',notice:action==='back'?'backFailed':action==='retry'?'retryFailed':'fallbackFailed'});};
  try{Promise.resolve(onAction(action)).then(result=>{if(result===false)fail();},fail);}catch{fail();}
  return true;
 }
 for(const el of section.querySelectorAll('[data-ready-action]'))el.addEventListener('click',()=>request(el.dataset.readyAction),{signal:controller.signal});
 function dispose(){
  if(disposed)return;disposed=true;generation++;controller.abort();signal?.removeEventListener('abort',dispose);
  if(container.firstElementChild===section){releaseModal(container);container.replaceChildren();container.classList.remove('harbor-ready-modal');container.hidden=true;}
 }
 signal?.addEventListener('abort',dispose,{once:true});activateModal(container,'[data-ready-heading]');
 return {update,dispose,request};
}
