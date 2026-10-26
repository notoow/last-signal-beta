export const escapeUi=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Translate saved legacy failure strings at presentation time; saves retain their
// original values and unknown reasons remain visible rather than being invented.
export function rogueFailureText(reason,language='ko'){
  if(language!=='en')return reason;
  const known={
    '연료가 소진되어 항해를 잃었다':'Fuel exhausted.',
    '밸브를 닫지 못해 침몰했다':'The open inlet flooded the tug.',
    '기계선의 공격으로 선체가 파손됐다':'The machine ship destroyed the tug.',
    '수문 충돌로 선체가 파손됐다':'The tug was destroyed against the sluice gate.',
    '잠금판을 뚫었지만 선체 충격을 견디지 못했다':'The gate was breached, but the hull could not withstand the impact.',
    '수문 기둥에 부딪혀 선체가 파손됐다':'The tug was destroyed against a gate pier.',
    '닫힌 잠금판에 부딪혀 선체가 파손됐다':'The tug was destroyed against a closed gate plate.',
    '선수가 어긋난 채 수문에 부딪혀 파손됐다':'The bow was misaligned when it struck the gate.',
    '돌파 속도가 부족한 채 잠금판에 부딪혀 파손됐다':'The tug struck the plate without enough speed to breach it.',
    '크레인 버킷에 선체가 파손됐다':'The crane bucket destroyed the tug.',
    '등대 봉쇄 포격으로 선체가 파손됐다':'The lighthouse blockade battery destroyed the tug.',
    '충돌로 선체가 파손됐다':'The tug was destroyed in a collision.',
    '육상에서 선원이 쓰러졌다':'The captain fell while ashore.',
    '갈매기 습격으로 손상된 선체가 침몰했다':'The damaged tug sank under the gull attack.'
  };
  for(const [ko,en] of Object.entries({'시궁쥐':'a harbor rat','들개':'a stray dog','대왕 게':'a giant crab','약탈 갈매기':'a raiding gull'}))known[ko+'의 공격으로 선원이 쓰러졌다']='The captain fell to '+en+'.';
  return known[reason]||reason;
}
export function sessionText(language='ko'){
  return language==='en'?{
    paused:'Paused',pauseBody:'Your voyage is waiting here.',saved:'Progress saved',saveFailed:'Save failed. Keep the game open and try again.',
    complete:'Voyage complete',failed:'Voyage ended',records:'Voyage record',time:'Time under way',hull:'Tug hull',collisions:'Collisions',
    rescued:'Crew rescued',resume:'Continue voyage',home:'Save and return to harbor',controls:'Controls',camera:'Camera settings',radio:'Received messages',
    newRun:'Prepare a new voyage',retry:'Retry this seed',harbor:'Return to harbor',regions:'Region reached',equipment:'Equipment carried',
    rogueComplete:'All three regions cleared',rogueSummary:'The names of those left behind reached the lighthouse.',empty:'None'
  }:{
    paused:'일시정지',pauseBody:'항해는 여기서 기다립니다.',saved:'진행 상황 저장 완료',saveFailed:'저장 실패 · 게임을 닫지 말고 다시 시도해 주세요.',
    complete:'항해 완료',failed:'항해 중단',records:'항해 기록',time:'항해 시간',hull:'예인정 내구',collisions:'충돌 횟수',
    rescued:'구조한 동료',resume:'항해 계속',home:'저장 후 항구로',controls:'조작 안내',camera:'카메라 설정',radio:'수신 기록',
    newRun:'새 항해 준비',retry:'같은 시드 재도전',harbor:'항구로',regions:'도달 해역',equipment:'보유 장비',
    rogueComplete:'세 해역 돌파',rogueSummary:'남은 사람들의 명부를 등대에 전달했습니다.',empty:'없음'
  };
}
export function resultMarkup({outcome='success',title,kicker='',summary='',facts=[],reward='',details='',actions='',language='ko'}){
  const t=sessionText(language),esc=escapeUi;
  return '<section class="session-result" data-outcome="'+esc(outcome)+'"><header><p class="session-kicker">'+esc(kicker)+'</p><h2>'+esc(title)+'</h2><p class="session-lead">'+esc(summary)+'</p></header>'+
    '<dl class="session-facts">'+facts.map(f=>'<div><dt>'+esc(f.label)+'</dt><dd>'+esc(f.value)+'</dd></div>').join('')+'</dl>'+
    '<div class="session-body">'+reward+(details?'<details class="session-records"><summary>'+t.records+'</summary>'+details+'</details>':'')+'</div>'+
    '<footer class="session-actions">'+actions+'</footer></section>';
}
export function pauseMarkup({kicker='',saved=true,error='',actions='',details='',menuDetails='',facts=[],language='ko',saveId='sessionSaveStatus'}){
  const t=sessionText(language);
  const back=language==='en'?'Back to menu':'메뉴로 돌아가기';
  const records=menuDetails+(details?'<details class="rp-page mobile-notes"><summary>'+t.records+'</summary><div class="rp-detail-content">'+details+'</div></details>':'');
  return '<section class="session-pause rp-view"><header><p class="rp-brand">LAST SIGNAL</p><h2>'+t.paused+'</h2>'+
    '<p id="'+saveId+'" class="session-save" role="status" data-save-state="'+(saved?'saved':'failed')+'">'+escapeUi(saved?t.saved:error||t.saveFailed)+'</p></header>'+
    '<div class="rp-menu"><nav class="session-pause-actions">'+actions+'</nav><div class="session-body">'+records.replaceAll('<div class="rp-detail-content">','<div class="rp-detail-content"><button type="button" class="rp-close">← '+back+'</button>')+'</div></div>'+
    (facts.length?'<aside class="rp-context"><strong>'+(language==='en'?'Current voyage':'현재 항해')+'</strong><p>'+escapeUi(kicker)+'</p>'+facts.map(f=>'<div class="rp-meter"><span>'+escapeUi(f.label)+'</span><meter min="0" max="'+f.max+'" value="'+f.value+'" aria-label="'+escapeUi(f.label)+'"></meter><b>'+Math.ceil(f.value)+' / '+f.max+'</b></div>').join('')+'</aside>':'')+
    '<footer class="rp-footer"><p class="session-kicker">'+escapeUi(kicker)+'</p><span><kbd>Esc</kbd>'+t.resume+'</span></footer></section>';
}

// Keep game keys held across a result/pause transition from clicking a menu.
// A new input edge is required; there is no artificial input-delay timer.
const held=new Set();let active=null,blocked=new Set(),headingSerial=0;
const live=()=>active?.isConnected&&!active.hidden;
const focusables=()=>[...active.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]'));
if(typeof window!=='undefined'){
  window.addEventListener('keydown',e=>{
    held.add(e.code);if(!live())return;
    if(e.code==='Escape'&&!e.repeat){const page=active.querySelector('.rp-page[open]');if(page){e.preventDefault();e.stopImmediatePropagation();page.open=false;page.querySelector('summary')?.focus({preventScroll:true});return;}}
    if(['Space','Enter','NumpadEnter'].includes(e.code)&&(blocked.has(e.code)||e.repeat)){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.code==='Tab'){
      const items=focusables();if(!items.length){e.preventDefault();return;}
      const at=items.indexOf(document.activeElement);
      if(at<0||e.shiftKey&&at===0||!e.shiftKey&&at===items.length-1){
        e.preventDefault();(e.shiftKey?items.at(-1):items[0]).focus({preventScroll:true});
      }
      e.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('keyup',e=>{
    held.delete(e.code);
    if(blocked.delete(e.code)){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.addEventListener('blur',()=>{held.clear();blocked.clear();});
}
export function activateModal(container,preferred){
  active=container;blocked=new Set([...held].filter(k=>['Space','Enter','NumpadEnter'].includes(k)));
  const dialog=container.firstElementChild;if(!dialog)return;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
  const heading=dialog.querySelector('h1,h2');
  if(heading){heading.id||='session-heading-'+(++headingSerial);dialog.setAttribute('aria-labelledby',heading.id);}
  for(const page of dialog.querySelectorAll('.rp-page')){
    page.addEventListener('toggle',()=>{if(page.open)for(const other of dialog.querySelectorAll('.rp-page[open]'))if(other!==page)other.open=false;});
    page.querySelector('.rp-close')?.addEventListener('click',()=>{page.open=false;page.querySelector('summary')?.focus({preventScroll:true});});
  }
  if(preferred)container.querySelector(preferred)?.focus({preventScroll:true});
}
export function releaseModal(container){if(active===container){active=null;blocked.clear();}}
