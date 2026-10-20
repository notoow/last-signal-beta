import {createRun,tickRun,interact,resolveGear,encodeRun,restoreRun,SAVE_KEY,RUN_VERSION,CAPTAINS,BUILDS,GEAR,maxHp} from './rogue-core.js';
import {GENERATOR_VERSION} from './rogue-map.js';
import {drawRogue,rogueCamera,lastRogueCamera} from './rogue-view.js';
import {CAMERA_KEY,cameraSettings} from './rogue-camera.js';
import {drawCaptain} from './departure-art.js';
import {CAPTAIN_SKILLS} from './captain-skills.js';
import {CAPTAIN_VESSELS} from './captain-vessels.js';
import {drawDepartureShip} from './captain-fleet.js';
import {sessionText,resultMarkup,pauseMarkup,activateModal,releaseModal,rogueFailureText} from './session-ui.js';
import {hudProbe} from './hud-layout.js';
import {waterMotion,releaseShipAssist} from './ship-motion.js';
import {rogueHudModel,rogueHudMarkup,rogueDetailsMarkup,rogueHudText} from './rogue-hud.js';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function hasRogueSave(){try{return !!restoreRun(localStorage.getItem(SAVE_KEY));}catch{return false;}}
export function openRogue({resume=false,language='ko',paint='harbor',reduced=false,onClose=()=>{},onPaint=()=>{},onSound=()=>{}}={}){
  const root=document.createElement('section');root.className='rogue-shell';root.id='rogue';root.dataset.hud='compact';
  root.innerHTML='<canvas id="rogueSea" aria-label="세 해역 로그라이크 항해"></canvas><div class="rogue-top" id="rogueHud"><div class="rogue-top-stack"><div id="rogueMission"></div><div class="rogue-radio" id="rogueRadio" aria-live="polite"></div></div><div class="rogue-console"><div class="rogue-readings" id="rogueReadings"></div><div class="rogue-conditions" id="rogueConditions"></div><div class="rogue-controls" id="rogueControls"></div></div></div><button id="roguePause" class="play-pause" hidden></button><button id="rogueSkill" class="rogue-skill" hidden></button><div class="rogue-modal" id="rogueModal"></div>';
  document.body.append(root);
  const $=id=>root.querySelector('#'+id),keys=new Set(),controller=new AbortController(),options={signal:controller.signal};
  const ui=sessionText(language),en=language==='en';
  const hudMarkup=new Map();
  const setHud=(id,html)=>{if(hudMarkup.get(id)!==html){$(id).innerHTML=html;hudMarkup.set(id,html);}};
  const probe=hudProbe($('rogueSea'),'#rogue .rogue-top-stack,#rogue .rogue-console,#rogueSkill,#roguePause');
  let hudRects=[];
  $('roguePause').textContent=en?'Esc · Pause':'Esc · 일시정지';
  let state=null,paused=true,mapOpen=false,last=performance.now(),clock=0,frameId,closed=false,captain='woo',build='standard',saveError=false;
  let camera=cameraSettings(null);
  try{camera=cameraSettings(JSON.parse(localStorage.getItem(CAMERA_KEY)));}catch{}
  const saveCamera=()=>{try{localStorage.setItem(CAMERA_KEY,JSON.stringify(camera));}catch{}};
  const changeZoom=value=>{camera=cameraSettings({...camera,zoom:value});saveCamera();};
  const cameraMarkup=()=>'<div class="rogue-camera-options"><label><input id="rogueAutoZoom" type="checkbox" '+(camera.autoZoom?'checked':'')+'> '+(en?'Automatic zoom · shore / connected tow':'자동 배율 · 상륙 확대 / 견인 거리 맞춤')+'</label><label for="rogueZoom">'+(en?'Zoom':'화면 배율')+' <output id="rogueZoomValue">'+Math.round(camera.zoom*100)+'%</output></label><input id="rogueZoom" type="range" min="60" max="180" step="5" value="'+Math.round(camera.zoom*100)+'"><small>'+(en?'Wheel / +− / pinch<br>M chart shows your explored harbor at any zoom':'휠 / +− · 모바일 두 손가락<br>M 해도는 배율과 관계없이 전체 탐사 기록')+'</small></div>';
  function bindCamera(){
    $('rogueAutoZoom')?.addEventListener('change',e=>{camera.autoZoom=e.target.checked;saveCamera();},options);
    $('rogueZoom')?.addEventListener('input',e=>{changeZoom(Number(e.target.value)/100);$('rogueZoomValue').textContent=Math.round(camera.zoom*100)+'%';},options);
  }
  const bind=(id,fn)=>$(id)?.addEventListener('click',fn,options);
  function save(){
    if(!state)return true;
    try{localStorage.setItem(SAVE_KEY,encodeRun(state));saveError=false;saveStatus();return true;}
    catch{saveError=true;saveStatus();$('rogueRadio').textContent=ui.saveFailed;return false;}
  }
  function saveStatus(){const el=$('rogueSaveStatus');if(el){el.dataset.saveState=saveError?'failed':'saved';el.textContent=saveError?ui.saveFailed:ui.saved;}}
  function modalSurface(surface,markup){
    releaseModal($('rogueModal'));root.dataset.surface=surface;
    $('rogueModal').className='rogue-modal'+(['pause','result'].includes(surface)?' session-scrim':'');
    $('rogueModal').hidden=false;$('rogueModal').innerHTML=markup;
    activateModal($('rogueModal'),surface==='pause'?'#rogueContinue':surface==='result'?'#rogueNew':undefined);
  }
  function close(){if(!save())return;releaseModal($('rogueModal'));closed=true;controller.abort();cancelAnimationFrame(frameId);root.remove();onClose();}
  function loadout(){
    hudMarkup.clear();
    paused=true;keys.clear();$('rogueMission').textContent='';$('rogueReadings').textContent='';$('rogueControls').textContent='';
    $('rogueRadio').textContent='';
    releaseModal($('rogueModal'));root.dataset.surface='preparation';$('rogueModal').className='rogue-modal';
    $('rogueModal').hidden=false;
    $('rogueModal').innerHTML=`
      <div class="embark">
        <div class="embark-scenery" aria-hidden="true"></div>
        <div class="embark-ship" aria-hidden="true"><canvas id="departureBoat" width="1100" height="700"></canvas></div>
        <header class="embark-header"><div><span class="embark-location">해문항 · 09번 선석</span><h1>출항 준비</h1></div>
          <p class="embark-route"><b>01 폐항</b><span>―</span>02 방조 수로<span>―</span>03 등대 해역</p>
        </header>
        <section class="embark-crew" aria-label="선장 선택">
          <h2>키를 잡을 사람</h2>
          <div class="embark-roster">${Object.entries(CAPTAINS).map(([id,c],i)=>`<button data-captain="${id}" aria-pressed="${id===captain}" aria-controls="departureProfile"><span class="roster-number">0${i+1}</span><b>${c.name}</b><span class="roster-mark" aria-hidden="true">◂</span></button>`).join('')}</div>
          <div id="departureProfile" class="embark-profile" aria-live="polite"></div>
        </section>
        <div class="embark-person" aria-hidden="true"><canvas id="departureCaptain" width="700" height="1100"></canvas></div>
        <section class="embark-vessel" aria-label="이번 항해의 선체">
          <div id="departureVessel" class="embark-ship-name"></div>
          <div class="embark-paints" aria-label="선체 도색">${Object.entries({harbor:'항구 녹색',ochre:'황토색',red:'적갈색'}).map(([id,name])=>`<button data-hull-paint="${id}" aria-label="${name}" title="${name}" aria-pressed="${paint===id}"><i></i></button>`).join('')}<small>도색 · 다음 항해에도 유지</small></div>
          <div class="embark-build-tabs">${Object.entries(BUILDS).map(([id,name])=>`<button data-build="${id}" aria-pressed="${id===build}" aria-controls="departureBuild">${name}</button>`).join('')}</div>
          <div id="departureBuild" class="embark-build-info" aria-live="polite"></div>
        </section>
        <footer class="embark-footer">
          <div class="embark-secondary"><button id="rogueHome" class="embark-back"><span aria-hidden="true">←</span> 항구로</button>
            <details class="embark-options"><summary>항해 설정</summary><label for="rogueSeed">같은 항구에 다시 도전하기</label><input id="rogueSeed" inputmode="numeric" placeholder="시드 · 비우면 무작위" maxlength="10">${cameraMarkup()}<p>장비는 이번 항해에만 적용됩니다.<br>도색은 다음 항해에도 유지됩니다.</p></details>
            <details class="embark-story"><summary>출항의 이유</summary><p>명부에는 모두 떠났다고 적혀 있다.<br>남은 사람들의 이름을 세 해역 너머 등대에 전하라.</p></details>
          </div>
          <button id="rogueLaunch" class="embark-launch"><span>계류를 풀고 출항</span><span aria-hidden="true">→</span></button>
        </footer>
      </div>`;
    bindCamera();
    const traits={woo:'두꺼운 선체 · 짧은 부스터',park:'큰 부스터 · 얇은 선체',han:'연료 소모 −25% · 추진력 −10%',jeong:'견인 전달 +20% · 추진력 −10%'};
    const buildInfo={
      standard:{verb:'부스터 운항',keys:'Shift 가속 / Space 제동',detail:'부스터로 가속하고 역추진으로 속도를 줄입니다.',risk:'부스터를 비우면 다음 회피가 어려워집니다.'},
      bilge:{verb:'침수 추진',keys:'B 흡수 밸브 개폐',detail:'밸브를 열어 물을 받으면 추진력이 높아집니다.',risk:'침수 100%에 도달하면 배를 잃습니다.'},
      winch:{verb:'장력 방출',keys:'E 고리 연결 / B 축력 방출',detail:'견인줄을 팽팽하게 당겨 축력을 모은 뒤 방출합니다.',risk:'느슨한 줄에서는 축력이 쌓이지 않습니다.'}
    };
    function selectCaptain(){
      const c=CAPTAINS[captain],skill=CAPTAIN_SKILLS[captain],vessel=CAPTAIN_VESSELS[captain];
      root.querySelectorAll('[data-captain]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.captain===captain)));
      $('departureProfile').innerHTML=`<dl class="embark-stats"><div><dt>선체 내구</dt><dd><b data-stat="hp">${c.hp}</b><meter min="0" max="120" value="${c.hp}" aria-label="선체 내구 ${c.hp}"></meter></dd></div><div><dt>부스터 용량</dt><dd><b data-stat="boost">${c.boost}</b><meter min="0" max="120" value="${c.boost}" aria-label="부스터 용량 ${c.boost}"></meter></dd></div></dl><p class="embark-trade">${traits[captain]}</p><div class="embark-skill"><h3><kbd>G</kbd> ${skill.name}</h3><p>${skill.effect}</p><small>부스터 ${skill.boost} · 연료 ${skill.fuel} · 재사용 ${skill.cooldown}초</small></div>`;
      drawCaptain($('departureCaptain'),captain);
      $('departureVessel').innerHTML=`<b>${vessel.name}</b><span>${vessel.handling}</span>`;
      $('departureVessel').title=vessel.detail;
      drawDepartureShip($('departureBoat'),captain,paint);
    }
    function selectBuild(){
      const b=buildInfo[build];
      root.querySelectorAll('[data-build]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.build===build)));
      $('departureBuild').innerHTML=`<h2>${b.verb}</h2><p>${b.detail}</p><p class="embark-build-risk">${b.risk}</p><div class="embark-key">${b.keys}</div>`;
    }
    root.querySelectorAll('[data-captain]').forEach(b=>b.addEventListener('click',()=>{captain=b.dataset.captain;selectCaptain();},options));
    root.querySelectorAll('[data-build]').forEach(b=>b.addEventListener('click',()=>{build=b.dataset.build;selectBuild();},options));
    root.querySelectorAll('[data-hull-paint]').forEach(b=>b.addEventListener('click',()=>{
      paint=b.dataset.hullPaint;onPaint(paint);
      root.querySelectorAll('[data-hull-paint]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.hullPaint===paint)));
      drawDepartureShip($('departureBoat'),captain,paint);
    },options));
    selectCaptain();selectBuild();
    root.querySelectorAll('.embark details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)root.querySelectorAll('.embark details').forEach(x=>{if(x!==d)x.open=false;});},options));
    try{
      const previous=restoreRun(localStorage.getItem(SAVE_KEY));
      if(previous?.status==='playing')$('rogueLaunch').textContent='현재 항해를 끝내고 새 출항';
      const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
      if(raw&&(raw.version>RUN_VERSION||raw.generator>GENERATOR_VERSION)){$('rogueLaunch').disabled=true;$('rogueLaunch').textContent='더 최신 버전의 항해 기록이 있습니다';}
    }catch{}
    activateModal($('rogueModal'));bind('rogueHome',close);bind('rogueLaunch',()=>{
      const value=$('rogueSeed').value.trim(),seed=value===''?crypto.getRandomValues(new Uint32Array(1))[0]:Number(value);
      if(!/^\d{1,10}$/.test(value)&&value!==''||!Number.isInteger(seed)||seed<0||seed>0xffffffff){$('rogueSeed').setCustomValidity('0~4294967295 범위의 정수를 입력하세요.');$('rogueSeed').reportValidity();return;}
      state=createRun(seed,captain,build,paint);save();play();
    });
  }
  function gearChoice(){
    paused=true;keys.clear();save();root.dataset.surface='inventory';$('rogueModal').className='rogue-modal';$('rogueModal').hidden=false;
    $('rogueModal').innerHTML='<div class="rogue-chart"><h2>'+GEAR[state.pendingGear]+' 회수</h2><p>장비칸 6개가 찼습니다. 교체할 장비를 고르거나 연료로 교환하세요. 같은 장비를 여러 개 실으면 효과가 중첩됩니다.</p><div class="rogue-builds">'+state.equipment.map((id,i)=>'<button data-replace="'+i+'">'+(i+1)+'. '+GEAR[id]+' 교체</button>').join('')+'</div><button id="rogueTrade">장비 대신 연료 +15</button><p>연료통·격벽을 내리면 최대 연료·내구도도 함께 줄어듭니다.</p></div>';
    root.querySelectorAll('[data-replace]').forEach(b=>b.addEventListener('click',()=>{resolveGear(state,Number(b.dataset.replace));save();play();},options));
    bind('rogueTrade',()=>{resolveGear(state);save();play();});activateModal($('rogueModal'),'[data-replace]');
  }
  function play(){if(state?.pendingGear){gearChoice();return;}paused=false;keys.clear();root.dataset.surface='playing';releaseModal($('rogueModal'));$('rogueModal').hidden=true;probe.invalidate();last=performance.now();}
  const direction=()=>({x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)});
  $('rogueSea').addEventListener('pointerdown',e=>{
    if(paused||!state||mapOpen||e.button!==0||e.pointerType==='touch')return;
    const rect=$('rogueSea').getBoundingClientRect(),view=lastRogueCamera($('rogueSea'))||rogueCamera($('rogueSea'),state,false,camera);
    if(interact(state,'ranged',{aim:{x:(e.clientX-rect.left-view.ox)/view.scale,y:(e.clientY-rect.top-view.oy)/view.scale}}))onSound('anchor');
  },options);
  $('rogueSea').addEventListener('wheel',e=>{
    if(paused||mapOpen)return;e.preventDefault();changeZoom(camera.zoom*Math.exp(-e.deltaY*.001));
  },{...options,passive:false});
  const touches=new Map();let pinch=null;
  const touchGap=()=>{const a=[...touches.values()];return a.length===2?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0;};
  $('rogueSea').addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||paused||mapOpen)return;
    e.preventDefault();touches.set(e.pointerId,{x:e.clientX,y:e.clientY});e.target.setPointerCapture(e.pointerId);
    if(touches.size===2)pinch={gap:touchGap(),zoom:camera.zoom};
  },options);
  $('rogueSea').addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&pinch.gap>0&&!paused&&!mapOpen)changeZoom(pinch.zoom*touchGap()/pinch.gap);
  },options);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('rogueSea').addEventListener(event,e=>{touches.delete(e.pointerId);pinch=null;},options);
  bind('rogueSkill',()=>{if(!paused&&state){interact(state,'captain',direction());save();}});
  bind('roguePause',pause);
  function pause(){
    if(!state)return;paused=true;keys.clear();releaseShipAssist(state);const saved=save();
    const controls=(en?'WASD move · C precision · Space brake · Shift boost<br>E moor / disembark / board / hook · Q unmoor / lure<br>F supplies · R equipment · B build action · M chart<br>Ashore: Space melee · V / click throw scrap<br>T tow supply boat · H supply boat anchor':'WASD 이동 · C 정밀 운항 · Space 제동 · Shift 부스터<br>E 계류 / 하선 / 재승선 / 고리 · Q 계류 해제 / 유인<br>F 보급 · R 장비 · B 빌드 조작 · M 해도<br>상륙: Space 근접 공격 · V / 클릭 고철 투척<br>T 보급정 견인 · H 보급정 닻')+(waterMotion(state)?'<br><br>'+(en?'Release movement to drift. C alone does not brake. Hold Space for powered braking and position assist; it uses fuel and can be overcome by strong flow or tow load. Pausing releases assist.':'손을 놓으면 해류를 따라 표류합니다. C만 눌러도 멈추지 않습니다. Space를 누르고 있으면 연료를 써서 감속·정지를 돕지만 강한 해류나 견인 하중에는 밀릴 수 있습니다. 일시정지하면 보조가 해제됩니다.'):'');
    modalSurface('pause',pauseMarkup({kicker:CAPTAINS[state.captain].name+' · '+(state.depth+1)+' / 3 · '+(en?'Seed ':'시드 ')+state.seed,saved,saveId:'rogueSaveStatus',language,
      actions:'<button id="rogueContinue" class="primary">'+ui.resume+'</button><button id="rogueHome" class="secondary">'+ui.home+'</button>',
      details:rogueDetailsMarkup(state,language)+'<details><summary>'+ui.controls+'</summary><p>'+controls+'</p><p>'+(en?'Anchor the supply boat separately before leaving your tug. Deliver it to the exit for +20 fuel and crew health.':'하선 전 보급정 닻을 따로 내려주세요. 탈출 부두에 데려오면 연료·선원 체력 +20.')+'</p></details><details><summary>'+ui.camera+'</summary>'+cameraMarkup()+'</details><details><summary>'+ui.radio+'</summary>'+state.log.map(l=>'<p>'+esc(rogueHudText(l.text,language))+'</p>').join('')+'</details>'}));
    bindCamera();bind('rogueHome',close);bind('rogueContinue',play);
  }
  function end(){
    paused=true;keys.clear();save();const won=state.status==='won';
    modalSurface('result',resultMarkup({outcome:won?'success':'failure',title:won?ui.rogueComplete:ui.failed,
      kicker:CAPTAINS[state.captain].name+' · '+(en?'Seed ':'시드 ')+state.seed,summary:won?ui.rogueSummary:rogueFailureText(state.reason,language),
      facts:[{label:ui.regions,value:(state.depth+1)+' / 3'},{label:ui.hull,value:Math.ceil(state.hp)+' / '+maxHp(state)},{label:ui.equipment,value:state.equipment.length+' / 6'}],
      reward:'<p id="rogueSaveStatus" class="session-save" role="status" data-save-state="'+(saveError?'failed':'saved')+'">'+(saveError?ui.saveFailed:ui.saved)+'</p>',
      details:'<p>'+esc(state.equipment.map(g=>GEAR[g]).join(' / ')||ui.empty)+'</p>'+state.log.map(l=>'<p>'+esc(l.text)+'</p>').join(''),
      actions:'<button id="rogueHome" class="secondary">'+ui.harbor+'</button><button id="rogueRetry">'+ui.retry+'</button><button id="rogueNew" class="primary">'+ui.newRun+'</button>',language}));
    bind('rogueHome',close);bind('rogueNew',()=>{state=null;loadout();});bind('rogueRetry',()=>{state=createRun(state.seed,state.captain,state.build,paint);save();play();});
  }
  function key(e,down){
    e.stopImmediatePropagation();
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(!down){keys.delete(e.code);return;}
    if(e.code==='Escape'&&!e.repeat){if(state?.status==='playing')paused?play():pause();else if(!state)close();return;}
    if(paused)return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(!e.repeat){
      const action={KeyE:'interact',KeyQ:'horn',KeyB:'special',KeyX:'cutnet',KeyG:'captain',KeyT:'tow',KeyH:'cargoAnchor',KeyV:'ranged',...(state.person?{Space:'melee'}:{})}[e.code];
      if(action){const used=interact(state,action,direction());if(used&&(action==='ranged'||action==='melee'))onSound('anchor');save();}
      if(e.code==='KeyM')mapOpen=!mapOpen;
      if(!mapOpen&&['Equal','NumpadAdd','Minus','NumpadSubtract'].includes(e.code))changeZoom(camera.zoom*(['Equal','NumpadAdd'].includes(e.code)?1.1:1/1.1));
    }
  }
  window.addEventListener('keydown',e=>key(e,true),{...options,capture:true});
  window.addEventListener('keyup',e=>key(e,false),{...options,capture:true});
  window.addEventListener('blur',()=>{if(state?.status==='playing'&&!paused)pause();},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state?.status==='playing'&&!paused)pause();},options);
  window.addEventListener('beforeunload',save,options);
  function frame(now){
    if(closed)return;const dt=Math.min((now-last)/1000,.05);last=now;
    if(state){
      if(!paused){
        const axis=(a,b,c,d)=>(keys.has(a)||keys.has(b)?1:0)-(keys.has(c)||keys.has(d)?1:0);
        const before=state.combat?{...state.combat}:null;
        tickRun(state,{x:axis('KeyD','ArrowRight','KeyA','ArrowLeft'),y:axis('KeyS','ArrowDown','KeyW','ArrowUp'),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),precision:keys.has('KeyC'),brake:keys.has('Space'),melee:keys.has('Space'),ranged:keys.has('KeyV'),recover:keys.has('KeyF'),equipment:keys.has('KeyR')},dt);
        if(before&&state.combat){
          if(state.combat.shotId>before.shotId)onSound('anchor');
          if(state.combat.hitId>before.hitId)onSound('hurt');
          if(state.combat.killId>before.killId)onSound('lift');
        }
        clock+=dt;if(clock>2){clock=0;save();}
        if(state.status!=='playing')end();
        else if(state.pendingGear)gearChoice();
      }
      const hud=rogueHudModel(state,language),markup=rogueHudMarkup(hud);
      $('rogueSkill').hidden=paused;
      $('roguePause').hidden=paused;
      $('rogueSkill').dataset.compact=String(hud.skill.compact);
      $('rogueSkill').setAttribute('aria-disabled',String(!hud.skill.usable));
      $('rogueSkill').setAttribute('aria-label',hud.skill.name+' · '+hud.skill.reason);
      $('rogueSkill').title=hud.skill.name+' · '+hud.skill.reason;
      setHud('rogueSkill',markup.skill);
      setHud('rogueMission',markup.mission);
      setHud('rogueReadings',markup.readings);
      setHud('rogueConditions',markup.conditions);
      if(!saveError)$('rogueRadio').textContent=state.radio?.left>0?rogueHudText(state.radio.text,language):'';
      $('rogueControls').dataset.motion=hud.motion;
      setHud('rogueControls',markup.controls);
      if(!paused)hudRects=probe.read(now);
      drawRogue($('rogueSea'),state,{reduced,mapOpen,camera,occupied:hudRects,language});
    }
    frameId=requestAnimationFrame(frame);
  }
  if(resume){try{state=restoreRun(localStorage.getItem(SAVE_KEY));}catch{}}
  if(state){state.status==='playing'?play():end();}else loadout();
  frameId=requestAnimationFrame(frame);
}
