import {steeringInput} from './steering-input.js';
import {storyNavigationMap} from './story-navigation.js';
import {drawNavigationMap} from './navigation-map.js';
import {refitDraft,readRefitDraft,writeRefitDraft,clearRefitDraft} from './refit-draft.js';
import {openRogue,hasRogueSave} from './rogue-app.js';
import {sessionText,resultMarkup,pauseMarkup,activateModal,releaseModal,escapeUi} from './session-ui.js';
import {hudProbe} from './hud-layout.js';
import {compactTowHud,compactTowHudMarkup,compactTowDetailsMarkup,fieldWorkSnapshot,fieldWorkInterruption} from './compact-hud.js';
import {towWinchRelease} from './tow-core.js';
import {selectBuild,selectSpecialization,toggleValve,buildHud} from './bilge-build.js';
import {parseVoyageCode,voyageCodeMarkup,voyageCodeEntry} from './voyage-code.js';
import {applyCrewPlan} from './crew-plans.js';
import {repairFeedback} from './ship-work.js';


import {debriefMarkup,voyageDebrief} from './voyage-debrief.js';
import {nextLearningRadio} from './field-guidance.js';
import {chooseContract,chooseSalvagePlan} from './expedition.js';
import {fieldWorkFeedback,expeditionText,runOutcomeMarkup} from './expedition-view.js';
import {nextStoryRadio,storyOutcomeKeys,storyRadioRelevant} from './voyage-story.js';
import {paintedTug} from './game-art.js';
import {freshVoyage,nextVoyage,LEGS,PAINTS,chooseEquipment,assignCrew} from './voyage.js';
import {voyageText,interiorMarkup,refitMarkup} from './voyage-view.js';
import {stats,serialize,cancelAnchors} from './core.js';
import {createRescue,updateRescue,placeNet,rapidReverse,freshCampaign,concludeMission,readSaveBundle} from './rescue-core.js';
import {HarborRenderer} from './harbor-render.js';
import {TowRenderer} from './tow-render.js';
import {CAMERA_KEY,cameraSettings} from './rogue-camera.js';
import {createTow,updateTow,placeTowBuoy,towInteract,towReverse,towMission,towTarget,towBody} from './tow-core.js';
import {textFor} from './rescue-locale.js';
import {missionGuidance} from './mission-guidance.js';
import {memories,earnedMemories,createRewardTracker,collectVoyageRewards} from './rewards.js';
import {MenuScene} from './menu-scene.js';
import {HarborAudio} from './harbor-audio.js';
import {AUDIO_KEY,readAudio,audioMarkup,bindAudio} from './audio-settings.js';
const $=id=>document.getElementById(id),panel=$('panel'),hud=$('hud'),view=new HarborRenderer($('space')),towView=new TowRenderer($('space')),sound=new HarborAudio(),keys=new Set();
const playHudProbe=hudProbe($('space'),'#hud .play-top,#hud .play-console,#voyageStatus,#interiorToggle,#playPause,#storyChart:not(.expanded),#voyageStatus .sea-instruments,#rewardNotice.show,#toast.show');
const storyChart=document.createElement('button');storyChart.id='storyChart';storyChart.hidden=true;
storyChart.innerHTML='<canvas width="336" height="192" aria-hidden="true"></canvas><span></span>';document.body.append(storyChart);
towView.externalChart=true;
import {reserveTowAttempt,availableTowMissions,masteryGoals} from './campaign.js';
import {TOW_MISSION_IDS,getTowMission} from './tow-missions.js';
import {loadSaveStore,writeSaveStore} from './save-store.js';
panel.addEventListener('pointerdown',e=>{if(e.target.matches('[data-run-code]')){e.preventDefault();e.target.focus();e.target.select();}});
panel.addEventListener('click',e=>{if(e.target.matches('[data-run-code]')){e.preventDefault();e.target.select();}});
const menuScene=new MenuScene($('space')),motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let saveReadOnly=false;
let settings={language:'ko',volume:.38,music:.22,shake:true},campaign=freshCampaign(),saved=null,saveError=false;
const readCamera=()=>{try{return cameraSettings(JSON.parse(localStorage.getItem(CAMERA_KEY)));}catch{return cameraSettings(null);}};
let cameraPreferences=readCamera();
function saveCamera(){try{localStorage.setItem(CAMERA_KEY,JSON.stringify(cameraPreferences));}catch{}}
function zoomCamera(value){cameraPreferences=cameraSettings({...cameraPreferences,zoom:value});saveCamera();}
try{
 const loaded=loadSaveStore(localStorage),data=loaded.data;saveReadOnly=loaded.readOnly;
 let old=data;try{old=old||JSON.parse(localStorage.getItem('threadwake.v1')||'null');}catch{}
 if(old?.settings){if(['ko','en'].includes(old.settings.language))settings.language=old.settings.language;for(const k of ['volume','music'])if(Number.isFinite(old.settings[k]))settings[k]=Math.max(0,Math.min(1,old.settings[k]));if(typeof old.settings.shake==='boolean')settings.shake=old.settings.shake;}
 if(data){campaign=data.campaign;saved=data.run;}
 if(loaded.readOnly||loaded.recovered||loaded.corrupt)setTimeout(()=>toast(loaded.readOnly?l().saveNewerVersion:loaded.recovered?l().backupRecovered:l().corrupt),200);
}catch{setTimeout(()=>toast(l().corrupt),200);}
Object.assign(settings,readAudio(localStorage,settings));
let storyMusicUntil=0,storyMusicMission='rescue';
function changeAudio(key,value){settings[key]=value;unlock();apply();try{localStorage.setItem(AUDIO_KEY,JSON.stringify({master:settings.master,volume:settings.volume,music:settings.music}));return true;}catch{return false;}}
let state=null,screen='cabin',selected='engineer',last=0,hudClock=0,saveClock=0,ended=false,toastTimer,radio=null,radioQueue=[],radioTime=0;
let lastStoryMapFrame=-Infinity;
const chartOpen=()=>state?.kind==='tow'?towView.mapOpen:view.mapOpen;
storyChart.addEventListener('click',()=>{if(screen!=='play')return;const renderer=state.kind==='tow'?towView:view;renderer.mapOpen=!renderer.mapOpen;releaseControls();playHudProbe.invalidate();});
const steering=steeringInput(keys,{target:window,game:'story',active:()=>screen==='play'&&!chartOpen()});
function releaseControls(){keys.clear();steering.clear();window.dispatchEvent(new CustomEvent('lastsignal:input-reset',{detail:{game:'story'}}));}
let openingTime=0,storyReturn=()=>cabin();
let liveInput={},detailInput={},interiorCrew='engineer';
let workNotice=null;
const refitDrafts=new WeakMap();let refitDraftError=false;
let rewardState=null,rewardTracker=new Set(),rewardQueue=[],rewardTime=0,newMemories=[],newMastery=[];
const chapterFinished=()=>campaign.progress.landing?.completions>0;
const detours=new WeakSet(),receipts=new WeakMap();
const presentation=(at=screen)=>missionGuidance({state,campaign,screen:at,language:settings.language,detour:!!state&&detours.has(state),precision:keys.has('KeyC')});
const l=()=>textFor(settings.language),clock=n=>Math.floor(n/60).toString().padStart(2,'0')+':'+Math.floor(n%60).toString().padStart(2,'0');
function unlock(){sound.unlock();}
function apply(){document.documentElement.classList.toggle('reduce-motion',!settings.shake);sound.setLevels(settings.volume,settings.music,settings.master);view.reduce=!settings.shake;towView.reduce=!settings.shake;document.documentElement.lang=settings.language;}
function save(){
  try{
    const data={version:1,settings,campaign,run:state&&state.status==='playing'?serialize(state):saved?serialize(saved):null};
    if(saveReadOnly)throw new Error('SAVE_NEWER_VERSION');writeSaveStore(localStorage,data);saveError=false;return true;
  }catch(e){if(e.message==='SAVE_NEWER_VERSION')saveReadOnly=true;if(!saveError)toast(saveReadOnly?l().saveNewerVersion:l().saveError);saveError=true;return false;}
}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3400);}
function button(id,text,cls=''){return '<button id="'+id+'" class="'+cls+'">'+text+'</button>';}
function bind(id,fn){$(id)?.addEventListener('click',()=>{unlock();sound.event('ui');fn();});}
function shell(html,cls=''){
 releaseModal(panel);
 storyChart.hidden=screen!=='play';storyChart.classList.toggle('expanded',!!chartOpen());
 $('interiorToggle').hidden=!(screen==='play'&&state?.voyage);$('voyageStatus').hidden=true;
 $('playPause').hidden=screen!=='play';$('playPause').textContent=settings.language==='en'?'Esc · Pause':'Esc · 일시정지';playHudProbe.invalidate();
 menuScene.reset();$('rewardNotice').classList.remove('show');
 if(['pause','debrief','voyageEnd','refit','interior'].includes(screen)){clearTimeout(toastTimer);$('toast').classList.remove('show');}
 panel.className=cls;panel.innerHTML=html;hud.classList.toggle('hidden',!state||screen!=='play');
 if(saveError&&panel.querySelector('.session-result .session-body')){
  const warning=document.createElement('p');warning.className='session-save';warning.dataset.saveState='failed';warning.setAttribute('role','status');
  warning.textContent=saveReadOnly?l().saveNewerVersion:l().saveError;panel.querySelector('.session-body').prepend(warning);
 }
 $('version').textContent=l().prototype;$('version').classList.toggle('hidden',screen==='play'||cls==='session-scrim');
 if(html&&cls!=='cabin-screen'&&cls!=='playing')activateModal(panel,cls==='session-scrim'?'.primary':undefined);
}
const artPath=id=>'assets/art/'+(id==='jian'?'park-portrait-v3':id==='jeongho'?'woo-portrait-v3':id+'-v1')+'.png';
function portrait(id){return '<span class="crew-portrait '+id+'"><img src="'+artPath(id==='engineer'?'jian':'jeongho')+'" alt="'+l()[id]+'"></span>';}
function cabin(){
  state=null;screen='cabin';releaseControls();radioQueue=[];radio=null;const t=l();
  shell('<div class="title-mark" aria-hidden="true"><span>'+t.englishTitle+'</span><div>'+t.title+'</div></div><section class="harbor-menu title-navigation" aria-label="'+t.menuNavigation+'"><h1 class="visually-hidden">'+t.title+'</h1><nav class="title-choices">'+(saved?button('resume',t.menuContinue):'')+button('expedition',voyageText(settings.language).new)+button('start',campaign.busRescued?t.missionBoard:campaign.crew.length?t.towStart:(settings.language==='ko'?'첫 구조부터 시작':'Start the story'))+(!saved&&campaign.crew.length===1?button('recruit',t.recruit):'')+button('customize',voyageText(settings.language).paint)+button('story',t.storyArchive)+button('memories',t.memories)+button('manual',t.menuControls)+button('settings',t.settings)+(window.desktop?button('quit',t.quit):'')+'</nav></section><button id="menuSignal" class="scene-radio" aria-expanded="false" aria-controls="menuSignalBody"><span class="radio-spark" aria-hidden="true"></span>'+t.menuRadio+'</button><div id="menuSignalBody" class="scene-subtitle" hidden>'+t.menuSignalBody+'</div>','cabin-screen');
  bind('menuSignal',()=>{const body=$('menuSignalBody'),open=body.hidden;body.hidden=!open;$('menuSignal').setAttribute('aria-expanded',String(open));if(open)sound.event('radio');});
  bind('story',()=>storyArchive('cabin'));bind('expedition',voyageBrief);bind('customize',customizeShip);bind('memories',memoryAlbum);bind('recruit',brief);bind('start',()=>campaign.busRescued?missionBoard():campaign.crew.length?towBrief():brief());bind('resume',()=>{rewardState=null;state=saved;saved=null;ended=false;radioQueue=[];radio=null;goPlay();});bind('settings',()=>settingsScreen('cabin'));bind('manual',()=>manual('cabin'));bind('quit',()=>window.desktop.quit());
  const choices=panel.querySelector('.title-choices'),ko=settings.language==='ko';
  choices.insertAdjacentHTML('afterbegin',button('roguelike',ko?'새 항해':'New voyage')+(hasRogueSave()?button('rogueResume',ko?'항해 이어가기':'Continue voyage'):''));
  $('start').textContent=ko?'구조 이야기': 'Rescue story';
  const enterRogue=resume=>{screen='rogue';releaseControls();releaseModal(panel);openRogue({resume,language:settings.language,paint:campaign.paint,reduced:!settings.shake||motionPreference.matches,onClose:cabin,onPaint:value=>{campaign.paint=value;save();},onSound:id=>sound.event(id),onMusic:id=>sound.setMusic(id),audioSettings:()=>settings,onAudioChange:changeAudio});};
  bind('roguelike',()=>enterRogue(false));bind('rogueResume',()=>enterRogue(true));
}

function missionBoard(focusId=null){
 state=null;screen='missions';releaseControls();const t=l(),ko=settings.language==='ko',available=availableTowMissions(campaign);
 const selectedId=available.includes(campaign.selectedMissionId)?campaign.selectedMissionId:available[0];
 const g=missionGuidance({campaign:{...campaign,selectedMissionId:selectedId},screen:'towBrief',language:settings.language}),record=campaign.progress[selectedId],r=record.lastResult;
 shell('<section class="dialog departure-desk" aria-labelledby="departureTitle"><header class="departure-heading"><h2 id="departureTitle">'+t.missionBoard+'</h2><span>해문 09 · HAEMUN</span></header><div class="departure-body"><nav class="departure-index" aria-label="'+t.missionBoard+'">'+TOW_MISSION_IDS.map((id,index)=>{
  const def=getTowMission(id),done=campaign.progress[id].completions>0,open=available.includes(id);
  return '<button data-mission="'+id+'" aria-pressed="'+(selectedId===id)+'" '+(open?'':'disabled')+'><span class="departure-number">0'+(index+1)+'</span><span><strong>'+t[def.textKeys.title]+'</strong><small>'+(done?'✓ '+t.missionDone:open?t.missionNext:t.missionLocked)+'</small></span></button>';
 }).join('')+'<p class="departure-index-note">'+(ko?'완료한 임무는 다시 출항할 수 있습니다.':'Completed missions can be replayed.')+'</p></nav><article class="departure-file" aria-labelledby="missionTitle"><div class="departure-hero"><img src="'+artPath(selectedId==='bus07'?'dawn-rescue':selectedId)+'" alt=""><div><small>'+(ko?'출항 지시':'Departure orders')+' / 0'+(TOW_MISSION_IDS.indexOf(selectedId)+1)+'</small><h3 id="missionTitle">'+g.title+'</h3></div></div><div class="departure-reading"><p class="departure-goal">'+g.summary.join('<br>')+'</p>'+button('readStory',t.readStory,'reading-link')+'<details class="departure-record"><summary>'+t.masteryTitle+' · '+(record.mastery||[]).length+'/'+masteryGoals(selectedId).length+'</summary>'+(r?'<p>'+t[r.power?'towPowerOnState':'towPowerOffState']+' · '+t.recordContacts+' '+r.collisions+' · '+clock(r.time)+'</p>':'')+masteryMarkup(selectedId)+'</details></div></article></div><footer class="departure-footer"><button id="back">'+t.back+'</button><div class="departure-crew" aria-label="'+(ko?'동행 선원':'Crew aboard')+'">'+campaign.crew.map(id=>'<div>'+portrait(id)+'<span>'+t[id]+'</span></div>').join('')+'</div><button id="towBegin" class="primary">'+g.action+'</button></footer></section>','overlay');
 panel.querySelectorAll('[data-mission]').forEach(b=>b.addEventListener('click',()=>{if(!available.includes(b.dataset.mission))return;campaign.selectedMissionId=b.dataset.mission;save();missionBoard(b.dataset.mission);}));
 bind('readStory',()=>storyArchive('missions',selectedId));bind('back',cabin);bind('towBegin',()=>{campaign.selectedMissionId=selectedId;beginTow();});
 if(focusId)panel.querySelector('[data-mission="'+focusId+'"]').focus();
}

function chapterEnd(){
 screen='chapter';state=null;const t=l(),g=presentation();shell('<section class="dialog debrief"><div class="eyebrow">'+t.investigation+'</div><h2>'+g.title+'</h2><p>'+g.body.join('</p><p>')+'</p><div class="chapter-crew">'+campaign.crew.map(id=>'<div class="crew-row">'+portrait(id)+'<strong>'+t[id]+'</strong></div>').join('')+'</div><p class="micro">'+t.chapterReplayNote+'</p><div class="dialog-footer">'+button('back',t.back,'secondary')+button('replay',t.chapterReplay,'primary')+'</div></section>','overlay');
 bind('back',cabin);bind('replay',missionBoard);
}
function radioHistory(){
 if(!state)return;screen='radioLog';releaseControls();save();const t=l();
 shell('<section class="dialog manual"><div class="eyebrow">156.80 MHz / '+clock(state.time)+'</div><h2>'+t.radioLog+'</h2>'+state.mission.radioLog.map(e=>'<div class="log-entry"><small>'+clock(e.time)+' · '+t.radio[e.id][0]+'</small><p>'+t.radio[e.id][1]+'</p></div>').join('')+button('back',t.backPlay,'primary')+'</section>','overlay');bind('back',goPlay);
}

function towBrief(){
 screen='towBrief';state=null;const t=l(),g=presentation();shell('<section class="dialog debrief"><h2>'+g.title+'</h2><p class="departure-goal">'+g.summary.join('<br>')+'</p>'+button('readStory',t.readStory,'reading-link')+'<div class="dialog-footer">'+button('back',t.back,'secondary')+button('towBegin',g.action,'primary')+'</div></section>','overlay');
 bind('readStory',()=>storyArchive('towBrief',campaign.selectedMissionId));bind('back',cabin);bind('towBegin',beginTow);
}
function storyArchive(from,id=null){
 const t=l(),paused=from==='pause';
 id=id||(paused?(state?.kind==='tow'?state.missionId:'rescue'):'rescue');
 const ids=paused?[id]:['rescue',...availableTowMissions(campaign)];
 storyReturn=()=>from==='pause'?pause():from==='missions'?missionBoard(id):from==='towBrief'?towBrief():from==='brief'?brief():cabin();
 screen='story';storyMusicMission=id;releaseControls();
 const g=missionGuidance({campaign:{...campaign,selectedMissionId:id},screen:id==='rescue'?'brief':'towBrief',language:settings.language});
 const routes=(g.routeOptions||[]).map(r=>'<article><h4>'+r.title+'</h4><p>'+r.body+'</p>'+(r.note?'<small>'+r.note+'</small>':'')+'</article>').join('');
 shell('<section class="dialog story-archive" aria-labelledby="storyTitle"><header><h2 id="storyTitle">'+t.storyArchive+'</h2>'+button('back',from==='cabin'?t.back:from==='pause'?(settings.language==='ko'?'일시정지 메뉴로':'Back to pause menu'):from==='missions'?(settings.language==='ko'?'출항 임무판으로':'Back to dispatch board'):(settings.language==='ko'?'출항 준비로':'Back to departure'))+'</header>'+(ids.length>1?'<nav aria-label="'+t.storyArchive+'">'+ids.map(key=>'<button data-story="'+key+'" aria-pressed="'+(key===id)+'">'+(key==='rescue'?t.missionTitle:t[getTowMission(key).textKeys.title])+'</button>').join('')+'</nav>':'')+'<article class="story-reading"><h3>'+g.title+'</h3><p>'+g.summary.join(' ')+'</p>'+(g.story?'<img src="'+g.story.image+'" alt="'+t.landingStoryAlt+'"><p>'+g.story.body+'</p><small>'+g.story.note+'</small>':'')+'<h3>'+t.storyOperations+'</h3>'+g.body.map(p=>'<p>'+p+'</p>').join('')+'<div class="story-routes">'+routes+'</div></article></section>','overlay');
 bind('back',()=>storyReturn());panel.querySelectorAll('[data-story]').forEach(b=>b.addEventListener('click',()=>{storyArchive(from,b.dataset.story);panel.querySelector('[data-story="'+b.dataset.story+'"]').focus();}));$('back').focus();
}
function opening(){
 goPlay();screen='opening';openingTime=3.8;releaseControls();
 const t=l(),g=missionGuidance({campaign:{...campaign,selectedMissionId:state.missionId},screen:state.kind==='tow'?'towBrief':'brief',language:settings.language});
 shell('<section class="voyage-opening" aria-labelledby="openingTitle"><p>해문 · HAEMUN</p><h1 id="openingTitle">'+g.title+'</h1><div>'+g.summary.join('<br>')+'</div>'+button('skipOpening',t.openingHint)+'</section>','opening-screen');hud.classList.add('hidden');bind('skipOpening',goPlay);
}
function beginTow(){
 const reserved=reserveTowAttempt(campaign,campaign.selectedMissionId);campaign=reserved.campaign;state=createTow(20261006,campaign.crew,'full',campaign.selectedMissionId);state.attemptId=reserved.attemptId;saved=null;ended=false;radio=null;radioQueue=[];radioTime=0;saveClock=0;towView.camera=null;save();opening();if(!campaign.progress[state.missionId].heard)queueRadio(campaign.crew.map(id=>towMission(state).arrivalRadioByCrew?.[id]).find(Boolean)||towMission(state).arrivalRadio||(state.missionId==='market'?'marketArrival':campaign.crew.includes('engineer')?'towPassengersEngineer':'towPassengersOperator'));
}
function radioMarkup(t){return radio?'<div class="radio-panel" data-radio-id="'+radio+'"><div>'+t.radioLabel+' <b>'+t.radio[radio][0]+'</b></div><p>“'+t.radio[radio][1]+'”</p></div>':'';}
function netTimerMarkup(g,tow=false){const timer=g.netTimer;return timer?'<div class="net-clock '+(timer.urgent?'urgent':'')+'"><strong>'+timer.label+'</strong>'+(!tow?'<small>'+timer.note+'</small>':'')+'</div>':'';}
function drawTowHud(){
 const g=presentation(),s=state;
 hud.dataset.kind='tow';hud.dataset.ui='compact';hud.dataset.phase=g.phase;hud.dataset.learningStage=g.learningStage||'';
 if(s.status!=='playing'){hud.innerHTML='<div class="arrival-hud">'+escapeUi(g.goal)+'</div>';return;}
 hud.innerHTML=compactTowHudMarkup(compactTowHud(s,{language:settings.language,guidance:g,input:liveInput,interruption:workNotice?.state===s&&s.time<workNotice.until?workNotice.reason:null}));
 const top=hud.querySelector('.play-top');top.insertAdjacentHTML('beforeend',radioMarkup(l()));
 document.documentElement.style.setProperty('--play-notice-top',(top.querySelector('.mission-objective').getBoundingClientRect().bottom+8)+'px');
}
function voyageDetails(){return state?.kind==='tow'?compactTowDetailsMarkup(state,{language:settings.language,input:detailInput,guidance:presentation('play')}):'';}

function endTowMission(){
 if(state.voyage){endVoyageLeg();return;}
 screen='debrief';releaseControls();const t=l(),won=state.status==='won',g=presentation();
 if(!ended){const before=campaign;campaign=concludeMission(state,campaign);newMemories=earnedMemories(before,campaign);newMastery=state.kind==='tow'?campaign.progress[state.missionId].mastery.filter(k=>!before.progress[state.missionId].mastery.includes(k)):[];saved=null;ended=true;save();}
 const ui=sessionText(settings.language);
 shell(resultMarkup({outcome:won?'success':'failure',title:won?ui.complete:ui.failed,kicker:g.title,summary:g.body[0],
  facts:[{label:ui.time,value:clock(state.time)},{label:ui.hull,value:Math.ceil(state.boat.hp)+' / 100'},{label:ui.collisions,value:state.metrics.collisions}],
  reward:won?rewardReveal(state.missionId):'',details:won?masteryReveal()+'<p>06:30 → 06:47</p><p>'+escapeUi(g.body[1]||t.towRecord)+'</p>':'',
  actions:button('port',t.back,'secondary')+button(won?'chapter':'towRetry',won?(state.missionId==='landing'?t.chapterDone:t.nextDeparture):t.retry,'primary'),language:settings.language}),'session-scrim');
 bind('port',cabin);bind('chapter',()=>{const next=TOW_MISSION_IDS[TOW_MISSION_IDS.indexOf(state.missionId)+1];if(next){campaign.selectedMissionId=next;beginTow();}else chapterEnd();});bind('towRetry',beginTow);
}

function brief(){
  screen='brief';const t=l(),g=presentation(),available=['engineer','operator'].filter(id=>!campaign.crew.includes(id));if(!available.length){towBrief();return;}if(!available.includes(selected))selected=available[0];
  shell('<section class="dialog rescue-brief"><div class="eyebrow">HAEMUN / DISPATCH 07</div><h2>'+g.title+'</h2><p>'+g.summary.join('<br>')+'</p><div class="rescue-choices">'+available.map(id=>'<button class="rescue-choice '+(selected===id?'selected':'')+'" data-target="'+id+'">'+portrait(id)+'<div><small>'+t[id+'Role']+'</small><h3>'+t[id]+'</h3><span>'+t[id+'Goal']+'</span><p>'+t[id+'Reward']+'</p></div></button>').join('')+(available.length?'':'<div class="record-mission"><strong>'+t.nextRecord+'</strong><p>'+t.recordClue+'</p></div>')+'</div><p class="refuge-note">'+(available.length>1?t.aliveShelter:t.safe)+'</p>'+button('readStory',t.readStory,'reading-link')+'<div class="dialog-footer">'+button('back',t.back,'secondary')+button('begin',g.action+' ↗','primary')+'</div><p class="micro">'+t.controls+'</p></section>','overlay');
  panel.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.target;brief();}));bind('readStory',()=>storyArchive('brief','rescue'));bind('back',cabin);bind('begin',()=>begin());
}
function begin(seed=20261006){state=createRescue(seed,campaign,selected);saved=null;ended=false;radioQueue=[];radio=null;radioTime=0;saveClock=0;save();opening();state.events=state.events.filter(e=>e.type!=='radio');queueRadio('arrival');}
function goPlay(){if(state?.voyage?.phase==='refit'){voyageRefit();return;}cameraPreferences=readCamera();towView.mapOpen=false;view.mapOpen=false;if(rewardState!==state){rewardState=state;rewardTracker=createRewardTracker(state);rewardQueue=[];rewardTime=0;}screen='play';releaseControls();shell('','playing');drawHud();if(state?.kind==='tow'&&state.mapMigration){toast(l().towMapMigration);state.mapMigration=false;}}
function queueRadio(id,important=false){if(!l().radio[id])return;const log=state?.mission.radioLog;if(log&&!log.some(e=>e.id===id))log.push({id,time:state.time});if(important){radio=id;radioTime=4.5;radioQueue=[];}else radioQueue.push(id);}
function pause(){
  if(!state||state.status!=='playing')return;if(screen==='play')detailInput={...liveInput};screen='pause';releaseControls();const ok=save(),t=l();
  shell(pauseMarkup({kicker:'HAEMUN 09 · '+clock(state.time),saved:ok,error:saveReadOnly?t.saveNewerVersion:t.saveError,
   actions:button('continue',t.resume,'primary')+button('story',t.storyArchive)+button('manual',t.manual)+button('settings',t.settings)+button('saveQuit',t.saveQuit,'secondary'),
   menuDetails:audioMarkup(settings,settings.language),details:voyageDetails()+(state.voyage?'<details><summary>'+sessionText(settings.language).records+'</summary>'+voyageCodeMarkup(state.voyage,settings.language)+'</details>':''),language:settings.language}),'session-scrim');
  bindAudio(panel,changeAudio,settings.language);bind('story',()=>storyArchive('pause'));bind('continue',goPlay);bind('manual',()=>manual('pause'));bind('settings',()=>settingsScreen('pause'));bind('saveQuit',()=>{if(!save()){pause();return;}saved=state;cabin();});panel.querySelector('button')?.focus();
}
function settingsScreen(from){
  screen='settings';const t=l();
  shell('<section class="dialog compact"><div class="eyebrow">TUG SYSTEMS</div><h2>'+t.settings+'</h2><label class="setting">'+t.language+'<select id="language"><option value="ko" '+(settings.language==='ko'?'selected':'')+'>한국어</option><option value="en" '+(settings.language==='en'?'selected':'')+'>English</option></select></label><label class="setting">'+t.volume+'<input id="volume" type="range" min="0" max="100" value="'+Math.round(settings.volume*100)+'"></label><label class="setting">'+t.music+'<input id="music" type="range" min="0" max="100" value="'+Math.round(settings.music*100)+'"></label><label class="setting">'+t.shake+'<input id="shake" type="checkbox" '+(settings.shake?'checked':'')+'></label><div class="stack">'+button('fullscreen',t.fullscreen)+button('back',from==='pause'?(settings.language==='ko'?'일시정지 메뉴로':'Back to pause menu'):t.back,'primary')+'</div></section>','overlay');
  $('language').addEventListener('change',e=>{settings.language=e.target.value;apply();save();settingsScreen(from);});
  cameraPreferences=readCamera();
  const ko=settings.language==='ko';
  panel.querySelector('#volume').closest('label').insertAdjacentHTML('beforebegin','<label class="setting">'+(ko?'전체 소리':'Master volume')+'<input id="master" type="range" min="0" max="100" value="'+Math.round(settings.master*100)+'"></label>');
  panel.querySelector('.stack').insertAdjacentHTML('beforebegin','<label class="setting">'+(ko?'자동 카메라 배율':'Automatic camera zoom')+'<input id="cameraAutoZoom" type="checkbox" '+(cameraPreferences.autoZoom?'checked':'')+'></label><label class="setting">'+(ko?'운항 화면 배율':'Sailing zoom')+'<input id="cameraZoom" type="range" min="60" max="180" step="5" value="'+Math.round(cameraPreferences.zoom*100)+'"></label><p class="micro">'+(ko?'견인 중 거리 맞춤 · 로그 항해 상륙 확대<br>휠 / +− / 두 손가락 · M 전체 해도':'Fit a connected tow; zoom in ashore in a rogue run.<br>Wheel / +− / pinch · M harbor chart')+'</p>');
  $('cameraAutoZoom').addEventListener('change',e=>{cameraPreferences.autoZoom=e.target.checked;saveCamera();});
  $('cameraZoom').addEventListener('input',e=>zoomCamera(Number(e.target.value)/100));
  for(const k of ['master','volume','music']){$(k).addEventListener('input',e=>{changeAudio(k,Number(e.target.value)/100);save();});$(k).addEventListener('change',()=>{if(k==='volume')sound.event('anchor');});}
  $('shake').addEventListener('change',e=>{settings.shake=e.target.checked;apply();save();});bind('back',()=>from==='pause'?pause():cabin());bind('fullscreen',()=>{if(window.desktop)window.desktop.fullscreen();else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>{});});
}
function manual(from){
  screen='manual';const t=l();shell('<section class="dialog manual"><div class="eyebrow">TOWING HANDBOOK / 09</div><h2>'+t.guideTitle+'</h2>'+presentation().manual.map((p,i)=>'<p><b class="manual-number">0'+(i+1)+'</b> '+p+'</p>').join('')+button('back',from==='pause'?(settings.language==='ko'?'일시정지 메뉴로':'Back to pause menu'):t.back,'primary')+'</section>','overlay');bind('back',()=>from==='pause'?pause():cabin());
}
function endMission(){
  if(state.kind==='tow'){endTowMission();return;}
  screen='debrief';releaseControls();const t=l(),g=presentation();
  if(!ended){const before=campaign;campaign=concludeMission(state,campaign);newMemories=earnedMemories(before,campaign);saved=null;ended=true;save();}
  const ids=state.mission.people.filter(p=>p.state==='rescued').map(p=>p.id),won=state.status==='won';
  const ui=sessionText(settings.language),people=ids.map(id=>'<div class="return-person">'+portrait(id)+'<div><h3>'+t[id]+'</h3><p class="testimony">'+t['testimony'+(id==='engineer'?'Engineer':'Operator')]+'</p><p>'+t['outcome'+(id==='engineer'?'Engineer':'Operator')]+'</p></div></div>').join('');
  shell(resultMarkup({outcome:won?'success':'failure',title:won?ui.complete:ui.failed,kicker:g.title,summary:won?g.body[0]||'':t.failedBody,
   facts:[{label:ui.time,value:clock(state.time)},{label:ui.hull,value:Math.ceil(state.player.hp)+' / '+stats(state).maxHp},{label:ui.rescued,value:ids.length}],
   reward:won?rewardReveal(ids[0]):'',details:won?people+(state.mission.recoveredBox?'<p>'+t.recordFound+' · '+t.recordClue+'</p>':''):'',
   actions:button('port',t.back,'secondary')+button(won?'next':'retry',won?(chapterFinished()?t.chapterDone:t.next):t.retry,'primary'),language:settings.language}),'session-scrim');
  bind('port',cabin);bind('next',()=>{state=null;if(chapterFinished())chapterEnd();else towBrief();});bind('retry',()=>{const seed=state.seed;selected=state.mission.target;begin(seed);});
}
function drawHud(){
 if(!state)return;if(state.kind==='tow'){drawTowHud();return;}
 hud.dataset.kind='rescue';delete hud.dataset.ui;
 const t=l(),p=state.player,m=state.mission,st=stats(state),g=presentation();hud.dataset.phase=g.phase;hud.dataset.learningStage=g.learningStage||'';
 if(state.status!=='playing'){hud.innerHTML='<div class="arrival-hud">'+g.goal+'</div>';return;}
 hud.innerHTML='<div class="hud-top harbor-top"><div class="hud-brand">09<span>'+t.missionTitle+'</span></div><div class="meter"><div>'+t.hull+'<b>'+Math.ceil(p.hp)+' / '+st.maxHp+'</b></div><progress value="'+p.hp+'" max="'+st.maxHp+'"></progress></div><div class="meter energy"><div>'+t.energy+'<b>'+Math.floor(p.energy)+'</b></div><progress value="'+p.energy+'" max="'+st.maxEnergy+'"></progress></div><div class="hud-time">'+clock(Math.max(0,m.deadline-state.time))+'<span>'+t.tide+'</span></div></div><div class="mission-objective"><span>07 /</span> '+g.goal+'</div><div class="passenger-status">'+m.people.map(p=>'<span class="'+p.state+'">'+t[p.id]+' · '+((p.state==='aboard'||p.state==='rescued')?t.aboard:p.state==='shelter'?t.shelter:t.waiting)+'</span>').join('')+'</div>'+radioMarkup(t)+'<div class="hud-bottom rescue-footer"><div class="anchor-state"><b>'+'◆'.repeat(state.anchors.length)+'◇'.repeat(3-state.anchors.length)+'</b> '+t.net+' '+state.anchors.length+'/3'+netTimerMarkup(g)+'</div><div class="hud-hint">'+g.hint+'</div><div class="context-action">'+g.action+'</div></div>';
}
function actions(code){
  if(screen==='story'&&code==='Escape'){storyReturn();return;}
  if(screen==='opening'){
   if(code==='Escape'){pause();return;}
   if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','KeyR','KeyI','KeyF','KeyG','KeyB','KeyC','ShiftLeft','ShiftRight','Space','Enter'].includes(code))goPlay();else return;
  }
  if((code==='KeyI'||code==='Escape')&&screen==='interior'){goPlay();return;}
  if(code==='KeyI'&&screen==='play'&&state?.voyage){shipInterior();return;}
  if(code==='Escape'&&screen==='play'&&chartOpen()){(state.kind==='tow'?towView:view).mapOpen=false;releaseControls();return;}
  if(code==='Escape'){if(screen==='play'||screen==='opening')pause();else if(screen==='pause')goPlay();else if(screen==='missions'||screen==='customize')cabin();return;}
  if(screen!=='play')return;
  if(code==='KeyM'){const renderer=state.kind==='tow'?towView:view;renderer.mapOpen=!renderer.mapOpen;releaseControls();return;}
  if(chartOpen())return;
  if(state.kind==='tow'){
    if(!towView.mapOpen&&['Equal','NumpadAdd','Minus','NumpadSubtract'].includes(code)){zoomCamera(cameraPreferences.zoom*(['Equal','NumpadAdd'].includes(code)?1.1:1/1.1));return;}
  }
  if(code==='KeyB'&&state?.kind==='tow'&&towWinchRelease(state)){save();return;}if(code==='KeyB'&&toggleValve(state)){save();return;}if(code==='KeyR'){radioHistory();return;}
  if(code==='KeyG'&&state.voyage?.version>=3&&!state.voyage.situation.salvaged){if(detours.has(state))detours.delete(state);else detours.add(state);drawHud();return;}
  if(state.kind==='tow'){if(code==='KeyQ')placeTowBuoy(state);if(code==='KeyE')towInteract(state);if(code==='Space')towReverse(state);return;}
  if(code==='KeyQ')placeNet(state);if(code==='KeyE')cancelAnchors(state);if(code==='Space')rapidReverse(state);
}
addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(e.target.tagName))return;if(screen==='play'&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();unlock();if(!e.repeat)actions(e.code);keys.add(e.code);});
addEventListener('keyup',e=>keys.delete(e.code));$('space').addEventListener('pointerdown',e=>{if(screen!=='play'||e.pointerType==='touch'||chartOpen())return;unlock();if(e.button===0)(state.kind==='tow'?placeTowBuoy:placeNet)(state);if(e.button===2)(state.kind==='tow'?towReverse:rapidReverse)(state);});
const cameraActive=()=>screen==='play'&&state?.kind==='tow'&&!towView.mapOpen;
$('space').style.touchAction='none';
$('space').addEventListener('wheel',e=>{if(!cameraActive())return;e.preventDefault();zoomCamera(cameraPreferences.zoom*Math.exp(-e.deltaY*.001));},{passive:false});
const cameraTouches=new Map();let cameraPinch=null;
const cameraGap=()=>{const p=[...cameraTouches.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;};
$('space').addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||!cameraActive())return;e.preventDefault();
  cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});e.target.setPointerCapture(e.pointerId);
  if(cameraTouches.size===2)cameraPinch={gap:cameraGap(),zoom:cameraPreferences.zoom};
});
$('space').addEventListener('pointermove',e=>{
  if(!cameraTouches.has(e.pointerId))return;cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(cameraPinch?.gap>0&&cameraActive())zoomCamera(cameraPinch.zoom*cameraGap()/cameraPinch.gap);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('space').addEventListener(event,e=>{cameraTouches.delete(e.pointerId);cameraPinch=null;});
addEventListener('pointermove',e=>{if(screen==='cabin')menuScene.point(e.clientX,e.clientY);});document.documentElement.addEventListener('pointerleave',()=>menuScene.reset());
addEventListener('contextmenu',e=>e.preventDefault());addEventListener('blur',()=>{sound.setFocused(false);releaseControls();if(screen==='play'||screen==='opening')pause();});addEventListener('focus',()=>sound.setFocused(!document.hidden));document.addEventListener('visibilitychange',()=>{sound.setFocused(!document.hidden&&document.hasFocus());if(document.hidden&&(screen==='play'||screen==='opening'))pause();});addEventListener('resize',()=>{view.resize();towView.resize();});addEventListener('beforeunload',save);window.desktop?.onClosing(save);
addEventListener('mobile-layout',()=>{view.resize();towView.resize();});
function frame(now){
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(screen==='rogue'){sound.tick({playing:false});requestAnimationFrame(frame);return;}
  if(screen==='opening'){openingTime-=dt;if(openingTime<=0)goPlay();}
  const controls=chartOpen()?{x:0,y:0}:{...steering.read(),precision:keys.has('KeyC'),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),work:keys.has('KeyF'),reel:(keys.has('KeyX')?1:0)-(keys.has('KeyZ')?1:0)};
  if(screen==='play'&&state){
    liveInput=controls;
    const workBefore=fieldWorkSnapshot(state);
    (state.kind==='tow'?updateTow:updateRescue)(state,dt,controls);
    const interrupted=fieldWorkInterruption(workBefore,state,controls);
    if(interrupted)workNotice={state,reason:interrupted,until:state.time+2.5};
    else if(fieldWorkSnapshot(state)?.progress>0)workNotice=null;
    const target=state.mission.people.find(p=>p.state==='waiting');
    if(target&&Math.hypot(state.player.x-target.x,state.player.y-target.y)<390&&!state.mission.radioLog.some(e=>e.id===target.id+'Call'))queueRadio(target.id+'Call',true);
    for(const e of state.events){
      if(e.type==='radio')queueRadio(e.id,e.id.endsWith('Rescued')||e.id==='engineerReady');
      sound.gameEvent(e,state);if(e.type==='lift'||['engineerRescued','operatorRescued'].includes(e.id))storyMusicUntil=performance.now()+18000;
      if(e.type==='expeditionStorm')toast(expeditionText(settings.language).stormRadio);if(e.type==='expeditionPatched')toast(fieldWorkFeedback(e,settings.language));if(e.type==='expeditionSalvage')toast(fieldWorkFeedback(e,settings.language));if(e.type==='expeditionStart')toast(expeditionText(settings.language)[e.contract+'Note']);
      if(e.type==='winchRelease'){sound.event('anchor');toast(settings.language==='ko'?'축력 방출 · 선체 당김 · 연료 −'+e.fuel:'Stored pull released · hull hauled · fuel −'+e.fuel);}if(e.type==='bilgeValve')toast(settings.language==='ko'?(e.open?'흡수 밸브 열림 · 침수 증가 +2/초 · B로 닫기':'흡수 밸브 닫힘 · 배수로 충전'):(e.open?'Inlet OPEN · flooding +2/sec · B to close':'Inlet CLOSED · pump water for charge'));if(e.type==='voyageFuelWarning')toast(voyageText(settings.language).fuelWarning);if(e.type==='voyageRepair')toast(repairFeedback(e,settings.language));if(e.type==='voyageFloodWarning')toast(settings.language==='ko'?'침수 60% · I 키로 배수 담당을 배치하세요':'Flooding at 60% · press I to assign pumping');
      if(['lowEnergy','tooClose','tooSmall','expired','needsEngineer','routeCleared','towTooFar','moored','unmoored','moorFast','moorHeading','moorBow','cargoSecured'].includes(e.type))toast(l()[e.type]);
      if(e.type==='hurt')(state.kind==='tow'?towView:view).shake=7;if(e.type==='circuit')(state.kind==='tow'?towView:view).shake=3;
    }
    updateRewards(dt);
    state.events=[];
    if(radio&&(!storyRadioRelevant(state,radio)||(radio.startsWith('learn')&&radio!==presentation().learningRadio))){radio=null;radioTime=0;}
    radioTime-=dt;if(!radio||radioTime<=0){
     radio=radioQueue.shift()||null;radioTime=4.5;
     if(!radio){const story=nextLearningRadio(state,presentation())||nextStoryRadio(state);if(story){radio=story;radioTime=Math.min(10,Math.max(6,l().radio[story][1].length/(settings.language==='ko'?12:20)));state.mission.radioLog.push({id:story,time:state.time});save();}}
     if(radio)sound.event('radio');
    }
    if(state.status==='won'||state.status==='lost')endMission();
    saveClock+=dt;if(saveClock>=5){saveClock=0;save();}
  }
  if(!['pause','settings','manual','interior'].includes(screen)){
    const mission=screen==='story'?storyMusicMission:state?.missionId||campaign.selectedMissionId;
    const region=mission==='sluice'?'region1':mission==='landing'?'region2':'region0';
    sound.setMusic(screen==='cabin'?'title':state?.status==='won'?'home':performance.now()<storyMusicUntil?'companion':['opening','story','brief','towBrief','missions'].includes(screen)?region:screen==='play'?'sailing':'title');
  }
  sound.tick({playing:screen==='play',boosting:!!state?.voyage?.situation?.boosting,moving:Math.hypot(controls.x,controls.y)>0,tension:state?.kind==='tow'&&state.connected?state.ropeTension:0});
  if(state?.voyage&&screen==='play')$('interiorToggle').textContent=voyageText(settings.language).inside;
  towView.paint=campaign.paint;towView.language=settings.language;towView.cameraSettings=cameraPreferences;
  if(state){hudClock+=dt;if(hudClock>.1){hudClock=0;drawHud();}if(screen==='play'&&state.kind==='tow')towView.hudRects=playHudProbe.read(now);(state.kind==='tow'?towView:view).draw(state,now/1000,l(),presentation());}else menuScene.draw(now/1000,{reduced:!settings.shake||motionPreference.matches,active:screen==='cabin',paint:campaign.paint});
  if(state&&now-lastStoryMapFrame>=100){
    lastStoryMapFrame=now;
    const renderer=state.kind==='tow'?towView:view,camera=renderer.cameraFrame||{scale:renderer.scale,ox:renderer.ox,oy:renderer.oy,viewport:{x:0,y:0,w:renderer.w,h:renderer.h}};
    const minimap=storyNavigationMap(state,camera);
    if(document.documentElement.dataset.mobileUi==='true')window.dispatchEvent(new CustomEvent('lastsignal:mobile-frame',{detail:{game:'story',mode:'sailing',active:screen==='play',mapOpen:!!chartOpen(),minimap}}));
    else if(screen==='play'){
      const expanded=!!chartOpen(),c=storyChart.querySelector('canvas'),w=expanded?1000:336,h=expanded?650:192;
      if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      storyChart.classList.toggle('expanded',expanded);storyChart.setAttribute('aria-expanded',String(expanded));
      storyChart.setAttribute('aria-label',settings.language==='en'?(expanded?'Close chart':'Open chart'):(expanded?'해도 닫기':'해도 열기'));
      storyChart.querySelector('span').textContent=settings.language==='en'?(expanded?'M / Esc · Close':'M · Chart'):(expanded?'M / Esc · 닫기':'M · 해도');
      drawNavigationMap(c,minimap);
    }
  }
  requestAnimationFrame(frame);
}
$('interiorToggle').addEventListener('click',shipInterior);
$('playPause').addEventListener('click',pause);
apply();cabin();requestAnimationFrame(frame);


function memorySummary(){const cards=memories(campaign),count=cards.filter(c=>c.earned).length,t=l();return '<div class="memory-summary"><span>'+t.memoryProgress+' <b>'+count+' / '+cards.length+'</b></span><progress value="'+count+'" max="'+cards.length+'"></progress></div>';}
function memoryAlbum(){
 state=null;screen='memories';releaseControls();const t=l();
 shell('<section class="dialog memory-album"><div class="eyebrow">HAEMUN / MEMORIES</div><h2>'+t.memories+'</h2><p>'+t.memoryNote+'</p>'+memorySummary()+'<div class="memory-grid">'+memories(campaign).map(c=>'<article class="memory-card '+(c.earned?'earned':'locked')+'" data-memory="'+c.id+'">'+(c.earned?'<img src="'+artPath(c.art)+'" alt="'+t[c.title]+'">':'<div class="memory-sealed" aria-hidden="true">◇</div>')+'<div><small>'+(c.earned?t.memoryKept:t.memoryLocked)+'</small><h3>'+t[c.title]+'</h3><p>'+(c.earned?(c.id==='engineer'?t.engineerReady:c.id==='operator'?t.operatorReady:t.memorySafe):t[c.requirement])+'</p>'+(c.clean?'<b class="clean-seal">'+t.memoryClean+'</b>':'')+(c.earned?'<button class="memory-open secondary" data-view-memory="'+c.id+'">'+t.memoryOpen+' ↗</button>':'')+'</div></article>').join('')+'</div><p class="micro">'+t.memoryArtNote+'</p><div class="dialog-footer">'+button('back',t.back,'primary')+'</div></section>','overlay');bind('back',cabin);panel.querySelectorAll('[data-view-memory]').forEach(b=>b.addEventListener('click',()=>memoryDetail(b.dataset.viewMemory)));
}
function memoryDetail(id){const card=memories(campaign).find(c=>c.id===id&&c.earned);if(!card)return;screen='memoryDetail';const t=l();shell('<section class="dialog memory-detail"><div class="eyebrow">'+t.memoryKept+'</div><h2>'+t[card.title]+'</h2><img src="'+artPath(card.art)+'" alt="'+t[card.title]+'"><p class="micro">'+t.memoryArtNote+'</p>'+button('back',settings.language==='ko'?'항해의 기억 목록으로':'Back to voyage memories','primary')+'</section>','overlay');bind('back',memoryAlbum);}
function rewardReveal(id){const t=l(),card=memories(campaign).find(c=>c.id===id);if(!card?.earned)return '';return '<div class="reward-reveal"><img src="'+artPath(card.art)+'" alt="'+t[card.title]+'"><div><small>'+t[newMemories.some(c=>c.id===id)?'memoryNew':'memoryKept']+'</small><strong>'+t[card.title]+'</strong>'+(card.clean?'<span class="clean-seal">'+t.memoryClean+'</span>':'')+'<span>'+t.memoryInAlbum+'</span></div></div>';}
function updateRewards(dt){
 rewardQueue.push(...collectVoyageRewards(rewardTracker,state));rewardTime=Math.max(0,rewardTime-dt);
 if(state.status!=='playing'){rewardQueue=[];$('rewardNotice').classList.remove('show');return;}
 if(!rewardTime&&rewardQueue.length){const key=rewardQueue.shift();$('rewardNotice').innerHTML='<span aria-hidden="true">✦</span><div><small>'+l().rewardStep+'</small><strong>'+l()[key]+'</strong></div>';rewardTime=2.6;}
 $('rewardNotice').classList.toggle('show',rewardTime>0);
}

function masteryMarkup(id){const t=l(),earned=campaign.progress[id].mastery||[],goals=masteryGoals(id);return '<div class="mastery-record"><small>'+t.masteryTitle+' · '+earned.length+'/'+goals.length+'</small><div class="mastery-stamps">'+goals.map(key=>'<span class="mastery-stamp '+(earned.includes(key)?'earned':'pending')+'" title="'+t['masteryHint_'+key]+'">'+(earned.includes(key)?'✓ ':'○ ')+t['mastery_'+key]+'</span>').join('')+'</div><details class="mastery-help"><summary>'+t.masteryConditions+'</summary><ul>'+goals.map(k=>'<li>'+t['masteryHint_'+k]+'</li>').join('')+'</ul></details><p class="micro">'+t.masteryOptional+'</p></div>';}
function masteryReveal(){return newMastery.length?'<div class="mastery-reveal" role="status"><small>'+l().masteryNew+'</small><p>'+newMastery.map(k=>'✓ '+l()['mastery_'+k]).join(' · ')+'</p></div>':'';}

function voyageBrief(){
 screen='voyageBrief';releaseControls();const t=voyageText(settings.language);
 shell('<section class="dialog compact"><h2>'+t.title+'</h2><p>'+t.note+'</p>'+(saved?'<p>'+t.confirm+'</p><button id="abandonVoyage">'+t.abandon+'</button>':'<button id="launchVoyage">'+t.new+'</button>'+voyageCodeEntry(settings.language))+'<button id="voyageBack">'+t.return+'</button></section>','overlay');
 bind('voyageBack',cabin);bind('abandonVoyage',()=>{saved=null;state=null;save();voyageBrief();});bind('launchVoyage',()=>startVoyage());$('voyageCodeForm')?.addEventListener('submit',e=>{e.preventDefault();const code=parseVoyageCode($('voyageCodeInput').value);if(!code){$('voyageCodeInput').setAttribute('aria-invalid','true');$('voyageCodeError').textContent=settings.language==='ko'?'LS4-00000007 형식의 항해 코드를 확인하세요.':'Check the voyage code format, e.g. LS4-00000007.';return;}startVoyage(code.seed,code.version);});
}
function startVoyage(seed=crypto.getRandomValues(new Uint32Array(1))[0],version=6){
 clearRefitDraft(localStorage);refitDraftError=false;
 state=createTow(seed,['operator','engineer'],'full',LEGS[0]);state.voyage=freshVoyage(seed,version);saved=null;ended=false;radio=null;radioQueue=[];rewardState=null;towView.camera=null;save();voyageRefit();
}
function voyageRefit(focus=null){
 const previousPanel=screen==='refit'?panel.querySelector('.refit-panel:not([hidden])'):null;
 const scroll=previousPanel?{id:previousPanel.id,top:previousPanel.scrollTop}:null;
 const expanded=screen==='refit'?[...panel.querySelectorAll('details[open]')].map(e=>e.id?'#'+e.id:'.'+e.classList[0]):[];
 const summaryScroll=screen==='refit'?panel.querySelector('.refit-summary')?.scrollTop||0:0;
 screen='refit';releaseControls();radio=null;radioQueue=[];
 const draft=refitDraft(state,refitDrafts.get(state)||readRefitDraft(localStorage,state));refitDrafts.set(state,draft);
 const receipt=receipts.get(state),record=receipt?(receipt.outcome?'<p class="voyage-story-result">'+escapeUi(receipt.outcome)+'</p>':'')+debriefMarkup(receipt.previous,receipt.transfer,settings.language):'';
 const warning=saveError?(saveReadOnly?l().saveNewerVersion:l().saveError):refitDraftError?(settings.language==='ko'?'선택을 저장하지 못했습니다. 출항 전 다시 저장해 주세요.':'The pending choice could not be saved. Retry before departure.'):'';
 shell(refitMarkup(state,settings.language,{draft,record,saveError:warning}),'overlay');
 for(const selector of expanded){const detail=panel.querySelector(selector);if(detail)detail.open=true;}
 if(scroll&&panel.querySelector('.refit-panel:not([hidden])')?.id===scroll.id)panel.querySelector('#'+scroll.id).scrollTop=scroll.top;
 panel.querySelector('.refit-summary').scrollTop=summaryScroll;
 const refresh=selector=>{refitDraftError=!writeRefitDraft(localStorage,state,draft);voyageRefit(selector);};
 const update=selector=>{save();refresh(selector);};
 const chooseTab=id=>{draft.tab=id;refresh('[data-refit-tab="'+id+'"]');};
 panel.querySelectorAll('[data-refit-tab]').forEach(b=>{
  b.addEventListener('click',()=>chooseTab(b.dataset.refitTab));
  b.addEventListener('keydown',e=>{const tabs=[...panel.querySelectorAll('[data-refit-tab]')],i=tabs.indexOf(b);let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();chooseTab(tabs[next].dataset.refitTab);});
 });
 panel.querySelectorAll('[data-build]').forEach(b=>b.addEventListener('click',()=>{if(selectBuild(state.voyage,b.dataset.build))update('[data-build="'+b.dataset.build+'"]');}));
 panel.querySelectorAll('[data-specialization]').forEach(b=>b.addEventListener('click',()=>{if(selectSpecialization(state.voyage,b.dataset.specialization))update('#refit-tab-equipment');}));
 panel.querySelectorAll('[data-refit-crew]').forEach(select=>select.addEventListener('change',()=>{if(assignCrew(state,select.dataset.refitCrew,select.value))update('[data-refit-crew="'+select.dataset.refitCrew+'"]');}));
 panel.querySelectorAll('[data-crew-plan]').forEach(b=>b.addEventListener('click',()=>{if(applyCrewPlan(state,b.dataset.crewPlan))update('[data-crew-plan="'+b.dataset.crewPlan+'"]');}));
 $('salvageSlot')?.addEventListener('change',e=>{chooseSalvagePlan(state.voyage,state.voyage.situation.salvagePlan,Number(e.target.value));update('#salvageSlot');});
 panel.querySelectorAll('[data-salvage]').forEach(b=>b.addEventListener('click',()=>{if(chooseSalvagePlan(state.voyage,b.dataset.salvage))update('[data-salvage="'+b.dataset.salvage+'"]');}));
 panel.querySelectorAll('[data-contract]').forEach(b=>b.addEventListener('click',()=>{if(chooseContract(state.voyage,b.dataset.contract))update('[data-contract="'+b.dataset.contract+'"]');}));
 $('replaceModule')?.addEventListener('change',e=>{draft.replace=e.target.value;refresh('#replaceModule');});
 panel.querySelectorAll('[data-equipment]').forEach(b=>b.addEventListener('click',()=>{draft.choice=b.dataset.equipment;refresh('[data-equipment="'+b.dataset.equipment+'"]');}));
 bind('refitRetry',()=>{save();refresh('#refitDepart');});
 bind('refitCode',()=>{const detail=$('refitCodeDetails');detail.open=true;const code=detail.querySelector('[data-run-code]');code.focus();code.select();});
 bind('refitHome',()=>{if(save()&&writeRefitDraft(localStorage,state,draft)){saved=state;cabin();}else{refitDraftError=true;voyageRefit('#refitHome');}});
 bind('refitDepart',()=>{
  if(screen!=='refit')return;
  const before=structuredClone(state.voyage);
  if(!chooseEquipment(state.voyage,draft.choice,draft.replace))return;
  if(!save()){state.voyage=before;voyageRefit('#refitDepart');return;}
  clearRefitDraft(localStorage);refitDrafts.delete(state);refitDraftError=false;opening();
 });
 if(focus)panel.querySelector(focus)?.focus({preventScroll:true});
 else panel.querySelector('[role="tab"][aria-selected="true"]')?.focus({preventScroll:true});
}
function shipInterior(){
 if(!state?.voyage||screen!=='play'&&screen!=='interior')return;
 const entering=screen==='play';if(entering){detailInput={...liveInput};save();}
 const detailsOpen=!entering&&!!panel.querySelector('.compact-hud-details[open]');
 screen='interior';releaseControls();
 shell(interiorMarkup(state,settings.language,campaign.paint,{selectedCrew:interiorCrew,details:voyageDetails(),saveError:saveError?(saveReadOnly?l().saveNewerVersion:l().saveError):''}),'overlay');
 if(detailsOpen)panel.querySelector('.compact-hud-details').open=true;
 const refresh=selector=>{
  const scroll=['.crew-stage','.crew-inspector'].map(selector=>[selector,panel.querySelector(selector)?.scrollTop||0]);
  shipInterior();
  for(const [selector,top] of scroll){const area=panel.querySelector(selector);if(area)area.scrollTop=top;}
  panel.querySelector(selector)?.focus({preventScroll:true});
 };
 panel.querySelectorAll('[data-select-crew]').forEach(b=>b.addEventListener('click',()=>{interiorCrew=b.dataset.selectCrew;refresh('[data-select-crew="'+interiorCrew+'"]');}));
 panel.querySelectorAll('[data-assign-crew]').forEach(b=>b.addEventListener('click',()=>{
  if(assignCrew(state,b.dataset.assignCrew,b.dataset.crewJob)){save();refresh('[data-crew-job="'+b.dataset.crewJob+'"]');}
 }));
 panel.querySelectorAll('[data-crew-plan]').forEach(b=>b.addEventListener('click',()=>{if(applyCrewPlan(state,b.dataset.crewPlan)){save();refresh('[data-crew-plan="'+b.dataset.crewPlan+'"]');}}));
 bind('interiorRetry',()=>{save();refresh('[data-select-crew="'+interiorCrew+'"]');});
 bind('interiorBack',goPlay);
 if(entering)panel.querySelector('[data-select-crew="'+interiorCrew+'"]')?.focus({preventScroll:true});
}

function endVoyageLeg(){
 clearTimeout(toastTimer);$('toast').classList.remove('show');
 const runSeed=state.seed,runVersion=state.voyage.version,leg=state.voyage.leg,reason=state.mission.reason,modern=state.voyage.version>=3,xt=expeditionText(settings.language),runRecord=runOutcomeMarkup(state,settings.language);const won=state.status==='won',outcome=storyOutcomeKeys(state).map(k=>l()[k]).join(' '),v=nextVoyage(state),t=voyageText(settings.language);releaseControls();radio=null;radioQueue=[];
 if(v){const previous=state,next=createTow(v.seed,['operator','engineer'],'full',LEGS[v.leg]);next.boat.hp=state.boat.hp;next.voyage=v;receipts.set(next,{previous,transfer:structuredClone(v),outcome});state=next;saved=null;ended=false;towView.camera=null;save();voyageRefit();return;}
 const code=voyageCodeMarkup(state.voyage,settings.language)+buildHud(state,settings.language),debrief=debriefMarkup(state,null,settings.language),receipt=voyageDebrief(state,null,settings.language),ui=sessionText(settings.language);
 const facts=[{label:ui.regions,value:(leg+1)+' / 3'},{label:ui.hull,value:Math.ceil(state.boat.hp)+' / 100'},{label:ui.collisions,value:state.metrics.collisions}];
 state=null;saved=null;ended=true;screen='voyageEnd';save();
 shell(resultMarkup({outcome:won?'success':'failure',title:won?t.done:ui.failed,kicker:t.leg+' '+(leg+1)+' / 3',summary:won?t.endNote:receipt.title,facts,
  details:(outcome?'<p class="voyage-story-result">'+escapeUi(outcome)+'</p>':'')+code+debrief+runRecord,
  actions:button('voyageHome',t.return,'secondary')+(!won&&modern?button('voyageRematch',xt.rematch):'')+button('voyageRetry',modern?xt.newRun:won?t.new:t.retry,'primary'),language:settings.language}),'session-scrim');
 bind('voyageRetry',()=>won||modern?startVoyage():startVoyage(runSeed,runVersion));bind('voyageRematch',()=>startVoyage(runSeed,runVersion));bind('voyageHome',cabin);
}
function customizeShip(){
 screen='customize';const t=voyageText(settings.language),ko=settings.language==='ko';
 shell('<section class="dialog paint-shop"><header><div class="eyebrow">HAEMUN · 09 / DRY DOCK</div><h2>'+t.paint+'</h2><p>'+(ko?'소금기와 녹 위에, 다시 우리 배의 색을.':'A fresh coat. The same faithful tug.')+'</p></header><div class="paint-workspace"><figure class="paint-slip"><canvas id="paintBoat" width="1664" height="928" aria-label="'+t.paint+'"></canvas><figcaption><b>HAEMUN 09</b><span id="paintName" role="status" aria-live="polite"></span></figcaption></figure><aside class="paint-samples"><small>'+(ko?'선체 도료 견본':'HULL PAINT SAMPLES')+'</small><div class="stack">'+Object.keys(PAINTS).map((id,i)=>'<button data-paint="'+id+'" class="swatch-'+id+'" aria-pressed="'+(campaign.paint===id)+'"><i aria-hidden="true"></i><span><small>0'+(i+1)+'</small>'+t[id]+'</span><b aria-hidden="true">✓</b></button>').join('')+'</div><p class="micro">'+(ko?'선택 즉시 선체에 적용됩니다. 새 항해에서도 도색은 유지됩니다.':'Applied immediately. Your paint stays across new voyages.')+'</p><button id="paintBack">'+t.return+'</button></aside></div></section>','overlay');
 const canvas=$('paintBoat'),ctx=canvas.getContext('2d'),draw=()=>{if(!canvas.isConnected||!menuScene.tug.complete||!menuScene.tug.naturalWidth)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(paintedTug(menuScene.tug,campaign.paint),0,0,canvas.width,canvas.height);canvas.dataset.renderedPaint=campaign.paint;};
 const update=()=>{panel.querySelectorAll('[data-paint]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paint===campaign.paint)));$('paintName').textContent=t[campaign.paint];draw();};
 if(!menuScene.tug.complete)menuScene.tug.addEventListener('load',draw,{once:true});
 panel.querySelectorAll('[data-paint]').forEach(b=>b.addEventListener('click',()=>{campaign.paint=b.dataset.paint;save();update();}));update();bind('paintBack',cabin);
}

// Mobile task switching must stop both media decks and the Web Audio graph.
addEventListener('pagehide',()=>sound.setFocused(false));
addEventListener('pageshow',()=>sound.setFocused(!document.hidden&&document.hasFocus()));
