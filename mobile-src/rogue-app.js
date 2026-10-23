import {createRun,tickRun,interact,resolveGear,resolveSalvage,returnFromWorkshop,resolveCache,planHarbor,encodeRun,restoreRun,SAVE_KEY,RUN_VERSION,CAPTAINS,BUILDS,GEAR,maxHp} from './rogue-core.js';
import {harborPlanMarkup} from './harbor-plan-ui.js';
import {voyageRecordMarkup,voyagePreparationText} from './rogue-voyage-record-ui.js';
import {salvageChoiceMarkup,salvageDetailsMarkup} from './rogue-salvage-ui.js';
import {cacheChoiceMarkup,cacheReplacementMarkup,cacheChoiceModel} from './rogue-cache-ui.js';
import {GENERATOR_VERSION} from './rogue-map.js';
import {drawRogue,lastRogueCamera} from './rogue-view.js';
import {CAMERA_KEY,cameraSettings,project,unproject,screenVectorToWorld} from './rogue-camera.js';
import {drawCaptain} from './departure-art.js';
import {CAPTAIN_SKILLS} from './captain-skills.js';
import {CAPTAIN_VESSELS} from './captain-vessels.js';
import {drawDepartureShip} from './captain-fleet.js';
import {sessionText,resultMarkup,pauseMarkup,activateModal,releaseModal,rogueFailureText} from './session-ui.js';
import {hudProbe} from './hud-layout.js';
import {waterMotion,releaseShipAssist} from './ship-motion.js';
import {rogueHudModel,rogueHudMarkup,rogueDetailsMarkup,rogueHudText} from './rogue-hud.js';
import {impactSequence,recentImpact} from './rogue-impact.js';
import {rogueContextActions,rogueMinimap} from './rogue-context.js';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function hasRogueSave(){try{return !!restoreRun(localStorage.getItem(SAVE_KEY));}catch{return false;}}
export function openRogue({resume=false,language='ko',paint='harbor',reduced=false,onClose=()=>{},onPaint=()=>{},onSound=()=>{}}={}){
  const root=document.createElement('section');root.className='rogue-shell';root.id='rogue';root.dataset.hud='compact';
  root.innerHTML='<canvas id="rogueSea" aria-label="세 해역 로그라이크 항해"></canvas><div class="rogue-top" id="rogueHud"><div class="rogue-top-stack"><div id="rogueMission"></div><div class="rogue-radio" id="rogueRadio" aria-live="polite"></div></div><div class="rogue-console"><div class="rogue-readings" id="rogueReadings"></div><div class="rogue-conditions" id="rogueConditions"></div><div class="rogue-controls" id="rogueControls"></div></div></div><button id="roguePause" class="play-pause" hidden></button><button id="rogueSkill" class="rogue-skill" hidden></button><div class="rogue-modal" id="rogueModal"></div>';
  document.body.append(root);
  const $=id=>root.querySelector('#'+id),keys=new Set(),controller=new AbortController(),options={signal:controller.signal};
  $('roguePause').insertAdjacentHTML('beforebegin','<button id="rogueChart" class="play-pause" hidden></button>');
  $('roguePause').insertAdjacentHTML('beforebegin','<div id="rogueQuayAssets" hidden><span id="rogueQuayAssetMessage" role="status" aria-live="polite"><span class="quay-asset-long"></span><span class="quay-asset-short"></span></span><span id="rogueQuayAssetCount" aria-hidden="true"></span><button id="rogueQuayRetry" type="button" aria-controls="rogueSea" hidden></button></div>');
  const ui=sessionText(language),en=language==='en';
  const t=(ko,english)=>en?english:ko;
  const hudMarkup=new Map();
  const setHud=(id,html)=>{if(hudMarkup.get(id)!==html){$(id).innerHTML=html;hudMarkup.set(id,html);}};
  const probe=hudProbe($('rogueSea'),'#rogue .rogue-top-stack,#rogue .rogue-console,#rogueSkill,#roguePause,#rogueChart,#rogueQuayAssets,#rogue[data-shore-profile=metre] #rogueReadings,#rogue[data-shore-profile=metre] #rogueControls,#rogue[data-shore-profile=metre] #rogueConditions');
  $('rogueSea').tabIndex=-1;
  let hudRects=[];
  $('roguePause').textContent=en?'Esc · Pause':'Esc · 일시정지';
  $('rogueChart').textContent=en?'M · Chart':'M · 해도';
  let state=null,paused=true,mapOpen=false,last=performance.now(),clock=0,frameId,closed=false,captain='woo',build='standard',saveError=false;
  let preparationReturn=null,resultView=null;
  let lastMobileFrame=-Infinity;
  let quayRetryPending=false,quayAssetSignature='',quayAssetLayout='';
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
  $('rogueQuayRetry').textContent=t('다시 시도','Retry');
  $('rogueQuayRetry').setAttribute('aria-label',t('항구 이미지 다시 불러오기','Retry loading harbor images'));
  function refreshQuayAssets(view){
    const notice=$('rogueQuayAssets'),button=$('rogueQuayRetry'),assets=view?.quayAssets;
    const eligible=state?.generator===4&&['moored','ashore'].includes(state.mode)&&!paused&&!mapOpen&&root.dataset.surface==='playing';
    const status=eligible?(quayRetryPending?'loading':assets?.status):null;
    const visible=status==='loading'||status==='error',retry=visible&&status==='error';
    if(document.activeElement===button&&!retry&&!paused)$('rogueSea').focus({preventScroll:true});
    const signature=visible?`${status}:${assets?.loaded??0}:${assets?.total??0}`:'hidden';
    if(signature!==quayAssetSignature){
      const changed=notice.dataset.status!==(status||'');
      quayAssetSignature=signature;notice.hidden=!visible;notice.dataset.status=status||'';button.hidden=!retry;button.disabled=quayRetryPending;
      if(changed&&visible){
        const message=$('rogueQuayAssetMessage');
        message.querySelector('.quay-asset-long').textContent=status==='error'?t('항구 이미지를 불러오지 못했어요','Harbor images unavailable'):t('항구 이미지 불러오는 중','Loading harbor images');
        message.querySelector('.quay-asset-short').textContent=status==='error'?t('항구 이미지','Harbor art'):t('항구 준비','Harbor loading');
      }
      $('rogueQuayAssetCount').textContent=status==='loading'&&assets?.total>0?`${Math.max(0,Math.min(assets.total,assets.loaded||0))}/${assets.total}`:'';
      probe.invalidate();
    }
    if(visible&&document.documentElement.dataset.mobileUi==='true'){
      // Fit the existing top HUD gap; the fallback row stays above thumb controls.
      const goal=document.getElementById('mobileObjective')?.getBoundingClientRect(),resources=document.getElementById('mobileResources')?.getBoundingClientRect();
      if(goal&&resources){
        const left=Math.ceil(goal.right+8),available=Math.floor(resources.left-8)-left,inline=available>=148;
        const x=inline?left:Math.ceil(goal.left),y=inline?Math.max(6,Math.floor(goal.top)-4):Math.ceil(goal.bottom+6),width=inline?available:Math.min(220,innerWidth-150);
        const layout=`${inline}:${x}:${y}:${width}`;
        if(layout!==quayAssetLayout){
          quayAssetLayout=layout;notice.dataset.mobileRow=inline?'inline':'below';
          notice.style.setProperty('--quay-asset-left',`${x}px`);
          notice.style.setProperty('--quay-asset-top',`${y}px`);
          notice.style.setProperty('--quay-asset-width',`${width}px`);
          probe.invalidate();
        }
      }
    }
  }
  async function retryHarborArt(){
    const view=lastRogueCamera($('rogueSea'));
    if(quayRetryPending||paused||state?.generator!==4||!['moored','ashore'].includes(state.mode)||mapOpen||view?.quayAssets?.status!=='error')return;
    quayRetryPending=true;refreshQuayAssets(view);
    try{
      const {retryQuayArt}=await import('./quay-view.js');await retryQuayArt();
      // Let the next rendered frame replace the old error snapshot before
      // returning display ownership to its asset status.
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    catch{/* Keep the existing playable fallback and expose retry again. */}
    finally{quayRetryPending=false;if(!closed)refreshQuayAssets(lastRogueCamera($('rogueSea')));}
  }
  bind('rogueQuayRetry',()=>{void retryHarborArt();});
  function save(){
    if(!state)return true;
    try{localStorage.setItem(SAVE_KEY,encodeRun(state));saveError=false;saveStatus();return true;}
    catch{saveError=true;saveStatus();$('rogueRadio').textContent=ui.saveFailed;return false;}
  }
  function saveStatus(){const el=$('rogueSaveStatus');if(el){el.dataset.saveState=saveError?'failed':'saved';el.textContent=saveError?ui.saveFailed:ui.saved;}
    const planError=$('harborPlanSaveError');if(planError){planError.hidden=!saveError;planError.textContent=saveError?ui.saveFailed:'';}
    const workshopError=$('rogueWorkshopSaveError');if(workshopError){workshopError.hidden=!saveError;workshopError.textContent=saveError?ui.saveFailed:'';}
    const cacheError=$('rogueCacheSaveError');if(cacheError){cacheError.hidden=!saveError;cacheError.textContent=saveError?ui.saveFailed:'';}}
  function modalSurface(surface,markup){
    releaseModal($('rogueModal'));root.dataset.surface=surface;
    $('rogueModal').className='rogue-modal'+(['pause','result'].includes(surface)?' session-scrim':'');
    $('rogueModal').hidden=false;$('rogueModal').innerHTML=markup;
    activateModal($('rogueModal'),surface==='pause'?'#rogueContinue':surface==='result'?'#rogueNew':undefined);
  }
  function close(){if(!save())return;releaseModal($('rogueModal'));closed=true;controller.abort();cancelAnimationFrame(frameId);root.remove();if(document.documentElement.dataset.mobileUi==='true')window.dispatchEvent(new CustomEvent('lastsignal:mobile-frame',{detail:null}));onClose();}
  function launchIntro(){
    let seen=false;try{seen=localStorage.getItem('lastsignal.mobile.intro.v1')==='seen';}catch{}
    if(document.documentElement.dataset.mobileUi!=='true'||seen){play();return;}
    modalSurface('intro',`<section class="mobile-voyage-intro"><span>${t('마지막 신호','Last Signal')}</span><h1>${t('명부에는 전원 대피라고 적혀 있다.','The manifest says everyone has evacuated.')}</h1><p>${t('폐항을 막은 기계선을 멈추고, 남은 사람들의 이름을 등대에 전하라.','Stop the machine ship blocking the abandoned harbor, and carry the remaining names to the lighthouse.')}</p><div><button id="rogueIntroSail">${t('바로 출항','Sail now')}</button><button id="rogueIntroSkip">${t('건너뛰기','Skip')}</button></div></section>`);
    const sail=()=>{try{localStorage.setItem('lastsignal.mobile.intro.v1','seen');}catch{}play();};
    bind('rogueIntroSail',sail);bind('rogueIntroSkip',sail);activateModal($('rogueModal'),'#rogueIntroSail');
  }
  function loadout({sameMap=false}={}){
    preparationReturn=state&&state.status!=='playing'?state:null;
    const retrySeed=sameMap?preparationReturn?.seed:null;
    const retryText=sameMap?voyagePreparationText(preparationReturn,language):null;
    if(retrySeed!==null&&retrySeed!==undefined){captain=state.captain;build=state.build;}
    hudMarkup.clear();
    paused=true;keys.clear();$('rogueMission').textContent='';$('rogueReadings').textContent='';$('rogueControls').textContent='';
    $('rogueRadio').textContent='';
    releaseModal($('rogueModal'));root.dataset.surface='preparation';$('rogueModal').className='rogue-modal';
    $('rogueModal').hidden=false;
    $('rogueModal').innerHTML=`
      <div class="embark">
        <div class="embark-scenery" aria-hidden="true"></div>
        <div class="embark-ship" aria-hidden="true"><canvas id="departureBoat" width="1100" height="700"></canvas></div>
        <header class="embark-header"><div><span class="embark-location">${t('해문항 · 09번 선석','Haemun harbor · Berth 09')}</span><h1>${t('출항 준비','Prepare to sail')}</h1></div>
          ${sameMap?`<p class="embark-retry-context"><b>${esc(retryText.heading)}</b><span>${esc(retryText.detail)}</span></p>`:`<p class="embark-route"><b>${t('01 폐항','01 Harbor')}</b><span>―</span>${t('02 방조 수로','02 Sluice')}<span>―</span>${t('03 등대 해역','03 Lighthouse')}</p>`}
        </header>
        <section class="embark-crew" aria-label="${t('선장 선택','Choose captain')}">
          <h2>${t('키를 잡을 사람','At the helm')}</h2>
          <div class="embark-roster">${Object.entries(CAPTAINS).map(([id,c],i)=>`<button data-captain="${id}" aria-pressed="${id===captain}" aria-controls="departureProfile"><span class="roster-number">0${i+1}</span><b>${c.name}</b><span class="roster-mark" aria-hidden="true">◂</span></button>`).join('')}</div>
          <div id="departureProfile" class="embark-profile" aria-live="polite"></div>
        </section>
        <div class="embark-person" aria-hidden="true"><canvas id="departureCaptain" width="700" height="1100"></canvas></div>
        <section class="embark-vessel" aria-label="${t('이번 항해의 선체','Vessel for this voyage')}">
          <div id="departureVessel" class="embark-ship-name"></div>
          <div class="embark-paints" aria-label="${t('선체 도색','Hull paint')}">${Object.entries(en?{harbor:'Harbor green',ochre:'Ochre',red:'Rust red'}:{harbor:'항구 녹색',ochre:'황토색',red:'적갈색'}).map(([id,name])=>`<button data-hull-paint="${id}" aria-label="${name}" title="${name}" aria-pressed="${paint===id}"><i></i></button>`).join('')}<small>${t('도색 · 다음 항해에도 유지','Paint stays for the next voyage')}</small></div>
          <div class="embark-build-tabs">${Object.entries(BUILDS).map(([id,name])=>`<button data-build="${id}" aria-pressed="${id===build}" aria-controls="departureBuild">${rogueHudText(name,language)}</button>`).join('')}</div>
          <div id="departureBuild" class="embark-build-info" aria-live="polite"></div>
        </section>
        <footer class="embark-footer">
          <div class="embark-secondary"><button id="rogueHome" class="embark-back"><span aria-hidden="true">←</span> ${preparationReturn?t('결과로','Back to result'):t('항구로','Harbor')}</button>
            <details class="embark-options"><summary>${t('항해 설정','Voyage settings')}</summary><label for="rogueSeed">${t('같은 항구에 다시 도전하기','Replay a harbor')}</label><input id="rogueSeed" inputmode="numeric" placeholder="${t('시드 · 비우면 무작위','Seed · blank for random')}" maxlength="10" value="${retrySeed??''}" ${sameMap?'readonly':''}>${cameraMarkup()}<p>${en?'Carry your remaining fuel between regions. No automatic refuelling.<br>Equipment lasts for this voyage. Paint stays for the next.':'다음 해역에도 남은 연료 그대로 · 자동 보충 없음.<br>장비는 이번 항해까지, 도색은 다음 항해에도 유지됩니다.'}</p></details>
            <details class="embark-story"><summary>${t('출항의 이유','Why we sail')}</summary><p>${t('명부에는 모두 떠났다고 적혀 있다.<br>남은 사람들의 이름을 세 해역 너머 등대에 전하라.','The manifest says everyone left.<br>Carry the remaining names through three regions to the lighthouse.')}</p></details>
          </div>
          <button id="rogueLaunch" class="embark-launch"><span>${t('계류를 풀고 출항','Cast off and sail')}</span><span aria-hidden="true">→</span></button>
        </footer>
      </div>`;
    bindCamera();
    const traits=en?{woo:'Thick hull · small boost reserve',park:'Large boost reserve · light hull',han:'Fuel use −25% · thrust −10%',jeong:'Tow force +20% · thrust −10%'}:{woo:'두꺼운 선체 · 짧은 부스터',park:'큰 부스터 · 얇은 선체',han:'연료 소모 −25% · 추진력 −10%',jeong:'견인 전달 +20% · 추진력 −10%'};
    const buildInfo={
      standard:{verb:'부스터 운항',keys:'Shift 가속 / Space 제동',detail:'부스터로 가속하고 역추진으로 속도를 줄입니다.',risk:'부스터를 비우면 다음 회피가 어려워집니다.'},
      bilge:{verb:'침수 추진',keys:'B 흡수 밸브 개폐',detail:'밸브를 열어 물을 받으면 추진력이 높아집니다.',risk:'침수 100%에 도달하면 배를 잃습니다.'},
      winch:{verb:'장력 방출',keys:'E 고리 연결 / B 축력 방출',detail:'견인줄을 팽팽하게 당겨 축력을 모은 뒤 방출합니다.',risk:'느슨한 줄에서는 축력이 쌓이지 않습니다.'}
    };
    if(en)Object.assign(buildInfo,{
      standard:{verb:'Boost drive',keys:'Shift boost / Space brake',detail:'Accelerate with boost, then brake to control speed.',risk:'An empty boost reserve leaves fewer escape options.'},
      bilge:{verb:'Flood-powered drive',keys:'B intake valve',detail:'Open the valve to take on water and increase thrust.',risk:'At 100% flooding, the boat sinks.'},
      winch:{verb:'Stored tension',keys:'E hook / B release charge',detail:'Pull a taut line to build charge, then release its force.',risk:'Slack lines cannot store charge.'}
    });
    function selectCaptain(){
      const c=CAPTAINS[captain],skill=CAPTAIN_SKILLS[captain],vessel=CAPTAIN_VESSELS[captain];
      root.querySelectorAll('[data-captain]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.captain===captain)));
      const effects={woo:'Brace for 2.6 seconds, reducing hull damage by 75%.',park:'A short side jet helps you evade attacks.',han:'A thrown buoy draws aim. Leave when it locks.',jeong:'A taut line holds the hook exposure for up to 3 seconds.'};
      $('departureProfile').innerHTML=`<dl class="embark-stats"><div><dt>${t('선체 내구','Hull')}</dt><dd><b data-stat="hp">${c.hp}</b><meter min="0" max="120" value="${c.hp}" aria-label="${t('선체 내구','Hull')} ${c.hp}"></meter></dd></div><div><dt>${t('부스터 용량','Boost')}</dt><dd><b data-stat="boost">${c.boost}</b><meter min="0" max="120" value="${c.boost}" aria-label="${t('부스터 용량','Boost')} ${c.boost}"></meter></dd></div></dl><p class="embark-trade">${traits[captain]}</p><div class="embark-skill"><h3><kbd>G</kbd> ${rogueHudText(skill.name,language)}</h3><p>${en?effects[captain]:skill.effect}</p><small>${t('부스터','Boost')} ${skill.boost} · ${t('연료','fuel')} ${skill.fuel} · ${t('재사용','cooldown')} ${skill.cooldown}${t('초','s')}</small></div>`;
      drawCaptain($('departureCaptain'),captain);
      const vessels={woo:['Armored tug','Wide fenders · slow turns'],park:['Fast rescue boat','Narrow hull · quick turns'],han:['Survey vessel','Long hull · economical drive'],jeong:['Twin-winch workboat','Wide deck · powerful towing']};
      $('departureVessel').innerHTML=`<b>${en?vessels[captain][0]:vessel.name}</b><span>${en?vessels[captain][1]:vessel.handling}</span>`;
      $('departureVessel').title=en?vessels[captain][1]:vessel.detail;
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
      if(previous?.status==='playing')$('rogueLaunch').textContent=t('현재 항해를 끝내고 새 출항','Replace current voyage and sail');
      const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
      if(raw&&(raw.version>RUN_VERSION||raw.generator>GENERATOR_VERSION)){$('rogueLaunch').disabled=true;$('rogueLaunch').textContent=t('더 최신 버전의 항해 기록이 있습니다','Saved voyage needs a newer version');}
    }catch{}
    activateModal($('rogueModal'),'[data-captain][aria-pressed=true]');bind('rogueHome',()=>preparationReturn?end():close());bind('rogueLaunch',()=>{
      const value=$('rogueSeed').value.trim(),seed=value===''?crypto.getRandomValues(new Uint32Array(1))[0]:Number(value);
      if(!/^\d{1,10}$/.test(value)&&value!==''||!Number.isInteger(seed)||seed<0||seed>0xffffffff){$('rogueSeed').setCustomValidity(t('0~4294967295 범위의 정수를 입력하세요.','Enter an integer from 0 to 4294967295.'));$('rogueSeed').reportValidity();return;}
      state=createRun(seed,captain,build,paint);preparationReturn=null;mapOpen=false;save();launchIntro();
    });
  }
  function gearChoice(){
    paused=true;keys.clear();save();modalSurface('inventory',cacheReplacementMarkup(state,language));saveStatus();
    root.querySelectorAll('[data-replace]').forEach(b=>b.addEventListener('click',()=>{resolveGear(state,Number(b.dataset.replace));save();play();},options));
    bind('rogueTrade',()=>{resolveGear(state);save();play();});activateModal($('rogueModal'),'[data-replace]');
  }
  function cacheChoice(){
    paused=true;keys.clear();save();
    modalSurface('cache',cacheChoiceMarkup(state,language));saveStatus();
    root.querySelectorAll('[data-cache-choice]').forEach(b=>b.addEventListener('click',()=>{
      const crew=cacheChoiceModel(state,language)?.crew,choice=b.dataset.cacheChoice;
      if(!resolveCache(state,b.dataset.cacheChoice))return;
      if(document.documentElement.dataset.mobileUi==='true'&&crew&&choice==='crew:'+crew.id)window.dispatchEvent(new CustomEvent('lastsignal:mobile-reward',{detail:{id:crew.id,name:en?crew.en:crew.name,rank:crew.rank+1,image:`assets/art/crew-upgrade-${crew.id}-v1.png`}}));
      onSound('lift');save();play();
    },options));
    bind('rogueCacheLeave',()=>{if(resolveCache(state,'leave')){save();play();}});
    activateModal($('rogueModal'),'[data-cache-choice]');
  }
  function salvageChoice(){
    paused=true;keys.clear();save();
    modalSurface('salvage',salvageChoiceMarkup(state,language));saveStatus();
    root.querySelectorAll('[data-salvage-choice]').forEach(b=>b.addEventListener('click',()=>{
      if(!resolveSalvage(state,b.dataset.salvageChoice))return;
      onSound('lift');save();play();
    },options));
    bind('rogueSalvageHome',close);
    bind('rogueWorkshopReturn',()=>{
      if(state.salvage.pending&&!returnFromWorkshop(state))return;
      // After a failed save, retry this already-resolved return without applying
      // a choice. Stay paused and prevent stale departure buttons from firing.
      root.querySelectorAll('[data-salvage-choice]').forEach(b=>{b.disabled=true;});
      if(save())play();
    });
    activateModal($('rogueModal'),'[data-salvage-choice]');
  }
  function harborChart(){
    if(!state?.harborIntel||paused)return;
    paused=true;mapOpen=false;keys.clear();releaseShipAssist(state);save();
    modalSurface('chart',harborPlanMarkup(state,language));saveStatus();
    const choose=id=>{if(planHarbor(state,id)){if(save())play();}};
    root.querySelectorAll('[data-harbor-target]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.harborTarget),options));
    bind('harborPlanClear',()=>choose(null));bind('harborPlanClose',play);
    const selected='.harbor-plan-sites [aria-pressed=true]:not(:disabled)',available='.harbor-plan-sites [data-harbor-target]:not(:disabled)';
    activateModal($('rogueModal'),root.querySelector(selected)?selected:root.querySelector(available)?available:'#harborPlanClose');
  }
  function play(){if(root.dataset.surface==='salvage'&&saveError&&!state?.salvage?.pending&&!save())return;
    if(state?.pendingGear){gearChoice();return;}if(state?.pendingCache){cacheChoice();return;}if(state?.salvage?.pending){salvageChoice();return;}
    resultView=null;paused=false;keys.clear();root.dataset.surface='playing';releaseModal($('rogueModal'));$('rogueModal').hidden=true;
    $('rogueSea').focus({preventScroll:true});probe.invalidate();last=performance.now();}
  const direction=()=>{
    const input={x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)};
    const view=lastRogueCamera($('rogueSea'));
    // Desktop keys and mobile's emitted keys share one screen-to-world boundary.
    return view?.projection?screenVectorToWorld(view,input):input;
  };
  $('rogueSea').addEventListener('pointerdown',e=>{
    if(paused||!state||mapOpen||e.button!==0||e.pointerType==='touch')return;
    const rect=$('rogueSea').getBoundingClientRect(),view=lastRogueCamera($('rogueSea'));
    if(!view)return;
    if(interact(state,'ranged',{aim:unproject(view,{x:e.clientX-rect.left,y:e.clientY-rect.top})}))onSound('anchor');
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
  bind('rogueChart',harborChart);
  function pause(){
    if(!state)return;paused=true;keys.clear();releaseShipAssist(state);const saved=save();
    const controls=(en?'WASD move · C precision · Space brake · Shift boost<br>E moor / disembark / board / hook · Q unmoor / lure<br>F supplies · R equipment · B build action · M chart<br>Ashore: Space melee · V / click throw scrap<br>T tow supply boat · H supply boat anchor':'WASD 이동 · C 정밀 운항 · Space 제동 · Shift 부스터<br>E 계류 / 하선 / 재승선 / 고리 · Q 계류 해제 / 유인<br>F 보급 · R 장비 · B 빌드 조작 · M 해도<br>상륙: Space 근접 공격 · V / 클릭 고철 투척<br>T 보급정 견인 · H 보급정 닻')+(waterMotion(state)?'<br><br>'+(en?'Release movement to drift. C alone does not brake. Hold Space for powered braking and position assist; it uses fuel and can be overcome by strong flow or tow load. Pausing releases assist.':'손을 놓으면 해류를 따라 표류합니다. C만 눌러도 멈추지 않습니다. Space를 누르고 있으면 연료를 써서 감속·정지를 돕지만 강한 해류나 견인 하중에는 밀릴 수 있습니다. 일시정지하면 보조가 해제됩니다.'):'');
    modalSurface('pause',pauseMarkup({kicker:CAPTAINS[state.captain].name+' · '+(state.depth+1)+' / 3 · '+(en?'Seed ':'시드 ')+state.seed,saved,saveId:'rogueSaveStatus',language,
      actions:'<button id="rogueContinue" class="primary">'+ui.resume+'</button><button id="rogueHome" class="secondary">'+ui.home+'</button>',
      details:rogueDetailsMarkup(state,language)+salvageDetailsMarkup(state,language)+'<details><summary>'+ui.controls+'</summary><p>'+controls+'</p><p>'+(en?'Anchor the supply boat separately before leaving your tug. Deliver it to the exit for +20 fuel and crew health.':'하선 전 보급정 닻을 따로 내려주세요. 탈출 부두에 데려오면 연료·선원 체력 +20.')+'</p></details><details><summary>'+ui.camera+'</summary>'+cameraMarkup()+'</details><details><summary>'+ui.radio+'</summary>'+state.log.map(l=>'<p>'+esc(rogueHudText(l.text,language))+'</p>').join('')+'</details>'}));
    bindCamera();bind('rogueHome',close);bind('rogueContinue',play);
  }
  function end(){
    paused=true;preparationReturn=null;keys.clear();save();const won=state.status==='won';
    // Rendering discovers visible terrain. Keep the completed save immutable
    // while its backdrop is drawn or the player cancels a new preparation.
    resultView=structuredClone(state);
    modalSurface('result',resultMarkup({outcome:won?'success':'failure',title:won?ui.rogueComplete:ui.failed,
      kicker:CAPTAINS[state.captain].name+' · '+(en?'Seed ':'시드 ')+state.seed,summary:won?ui.rogueSummary:rogueFailureText(state.reason,language),
      facts:[{label:ui.regions,value:(state.depth+1)+' / 3'},{label:ui.hull,value:Math.ceil(state.hp)+' / '+maxHp(state)},{label:ui.equipment,value:state.equipment.length+' / 6'}],
      reward:voyageRecordMarkup(state,language)+'<p id="rogueSaveStatus" class="session-save" role="status" data-save-state="'+(saveError?'failed':'saved')+'">'+(saveError?ui.saveFailed:ui.saved)+'</p>',
      details:state.log.map(l=>'<p>'+esc(rogueHudText(l.text,language))+'</p>').join(''),
      actions:'<button id="rogueReprepare" class="primary">'+esc(voyagePreparationText(state,language).button)+'</button><button id="rogueRetry">'+t('바로 재도전','Retry immediately')+'</button><button id="rogueNew">'+t('새 해도 준비','New random chart')+'</button><button id="rogueHome" class="secondary">'+ui.harbor+'</button>',language}));
    root.querySelector('.session-result').classList.add('rogue-debrief-result');
    // The radio log remains separate from the factual choice and damage record.
    root.querySelector('.session-records>summary')?.replaceChildren(document.createTextNode(ui.radio));
    activateModal($('rogueModal'),'#rogueReprepare');
    bind('rogueHome',close);bind('rogueReprepare',()=>loadout({sameMap:true}));bind('rogueNew',()=>loadout());bind('rogueRetry',()=>{state=createRun(state.seed,state.captain,state.build,paint);mapOpen=false;save();play();});
  }
  function key(e,down){
    e.stopImmediatePropagation();
    if(e.target===$('rogueQuayRetry')&&['Enter','NumpadEnter','Space'].includes(e.code)){
      e.preventDefault();keys.delete(e.code);if(down&&!e.repeat)void retryHarborArt();return;
    }
    if(e.code==='Tab'&&!paused&&!$('rogueQuayAssets').hidden&&!$('rogueQuayRetry').hidden)return;
    if(!down){keys.delete(e.code);return;}
    if(e.code==='Escape'&&!e.repeat&&root.dataset.surface==='preparation'&&preparationReturn){e.preventDefault();end();return;}
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(root.dataset.surface==='chart'&&['Escape','KeyM'].includes(e.code)){
      e.preventDefault();if(!e.repeat)play();return;
    }
    if(e.code==='Escape'&&!e.repeat){e.preventDefault();if(state?.status==='playing'){
      if(['cache','inventory'].includes(root.dataset.surface))pause();else paused?play():pause();
    }else if(!state)close();return;}
    if(paused)return;
    // Menus clear game input. Repeating a key held across the transition
    // cannot restart searching, walking or attacking; require a fresh press.
    if(e.repeat&&!keys.has(e.code)){e.preventDefault();return;}
    if(['Space','Enter','NumpadEnter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(!e.repeat){
      const action={KeyE:'interact',KeyQ:'horn',KeyB:'special',KeyX:'cutnet',KeyG:'captain',KeyT:'tow',KeyH:'cargoAnchor',KeyV:'ranged',...(state.person?{Space:'melee'}:{})}[e.code];
      if(action){const uses=state.salvage?.uses??0;const used=interact(state,action,direction());if(used&&(action==='ranged'||action==='melee'))onSound('anchor');if((state.salvage?.uses??0)>uses)onSound('lift');save();}
      if(e.code==='KeyM'){e.preventDefault();if(state.harborIntel)harborChart();else mapOpen=!mapOpen;}
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
    const shoreProfile=state?.generator>=4&&['moored','ashore'].includes(state.mode)?'metre':'';
    if(root.dataset.shoreProfile!==shoreProfile){root.dataset.shoreProfile=shoreProfile;probe.invalidate();}
    if(state){
      root.dataset.mobileMode=state.mode;
      root.dataset.mobileMap=String(mapOpen);
      if(!paused){
        const before=state.combat?{...state.combat}:null;
        const impactBefore=state.boss.crane?.impactAt??-1;
        const gateBefore=state.boss.sluice?.hitAt??-1;
        const signalBefore=state.boss.lighthouse?.sentAt??-1;
        const shellBefore=state.boss.lighthouse?.impactAt??-1;
        const salvageUses=state.salvage?.uses??0;
        const hitBefore=impactSequence(state);
        tickRun(state,{...direction(),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),precision:keys.has('KeyC'),brake:keys.has('Space'),melee:keys.has('Space'),ranged:keys.has('KeyV'),recover:keys.has('KeyF'),equipment:keys.has('KeyR')},dt);
        const hit=impactSequence(state)>hitBefore?recentImpact(state):null;
        // Play one resolved-loss cue. Proximity, blocked damage and restored
        // hit history cannot produce a hurt sound; scrap theft is a metal cue.
        if(hit)onSound(hit.target==='scrap'?'anchor':'hurt');
        if((state.boss.crane?.impactAt??-1)>impactBefore&&!hit)onSound('anchor');
        if((state.boss.sluice?.hitAt??-1)>gateBefore){
          if(state.boss.sluice.lastImpact==='opened')onSound('lift');
          else if(!hit)onSound('anchor');
        }
        if((state.boss.lighthouse?.impactAt??-1)>shellBefore&&!hit)onSound('anchor');
        if((state.boss.lighthouse?.sentAt??-1)>signalBefore)onSound('lift');
        if((state.salvage?.uses??0)>salvageUses)onSound('lift');
        if(before&&state.combat){
          if(state.combat.shotId>before.shotId)onSound('anchor');
          if(state.combat.killId>before.killId)onSound('lift');
        }
        clock+=dt;if(clock>2){clock=0;save();}
        if(state.status!=='playing')end();
        else if(state.pendingGear)gearChoice();
        else if(state.pendingCache)cacheChoice();
        else if(state.salvage?.pending)salvageChoice();
      }
      const hud=rogueHudModel(state,language),markup=rogueHudMarkup(hud);
      $('rogueSkill').hidden=paused;
      $('roguePause').hidden=paused;
      $('rogueChart').hidden=paused||!state.harborIntel;
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
      refreshQuayAssets(lastRogueCamera($('rogueSea')));
      if(!paused)hudRects=probe.read(now);
      if(root.dataset.surface==='chart'){
        const chart=$('harborPlanSea'),frame=drawRogue(chart,state,{reduced:true,mapOpen:true,chartPins:true,occupied:[],language});
        root.querySelectorAll('[data-map-x]').forEach(pin=>{
          const point=project(frame,{x:Number(pin.dataset.mapX),y:Number(pin.dataset.mapY)});
          pin.style.left=point.x+'px';
          pin.style.top=point.y+'px';
        });
      }else{
        const view=drawRogue($('rogueSea'),resultView||state,{reduced,mapOpen,camera,occupied:hudRects,language});
        refreshQuayAssets(view);
      }
      if(document.documentElement.dataset.mobileUi==='true'&&now-lastMobileFrame>=100){
        lastMobileFrame=now;
        window.dispatchEvent(new CustomEvent('lastsignal:mobile-frame',{detail:{mode:state.mode,mapOpen,active:!paused,context:rogueContextActions(state),minimap:rogueMinimap(state)}}));
      }
    }
    frameId=requestAnimationFrame(frame);
  }
  if(resume){try{state=restoreRun(localStorage.getItem(SAVE_KEY));}catch{}}
  if(state){state.status==='playing'?play():end();}else loadout();
  frameId=requestAnimationFrame(frame);
}
