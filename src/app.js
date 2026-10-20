import {createRun,createLesson,synergies,update,placeAnchor,dash,cancelAnchors,chooseUpgrade,serialize,restore,stats,UPGRADES,inTriangle} from './core.js';
import {locale} from './locale.js';
import {Renderer} from './render.js';
import {Sound} from './audio.js';
const $=id=>document.getElementById(id),panel=$('panel'),hud=$('hud');
const render=new Renderer($('space')),sound=new Sound();
const keys=new Set(),STORE='threadwake.v1';
let settings={language:'ko',volume:.35,music:.22,shake:true},profile={runs:0,wins:0,best:0,tutorialComplete:false},saved=null,saveFailure=false;
try{
  const data=JSON.parse(localStorage.getItem(STORE)||'null');
  if(data?.version===1){
    if(['en','ko'].includes(data.settings?.language))settings.language=data.settings.language;
    for(const k of ['volume','music'])if(Number.isFinite(data.settings?.[k]))settings[k]=Math.max(0,Math.min(1,data.settings[k]));
    if(typeof data.settings?.shake==='boolean')settings.shake=data.settings.shake;
    for(const k of ['runs','wins','best'])if(Number.isSafeInteger(data.profile?.[k])&&data.profile[k]>=0)profile[k]=data.profile[k];
    profile.tutorialComplete=data.profile?.tutorialComplete===true;
    saved=restore(data.run);
    if(data.run&&!saved)setTimeout(()=>toast(t().corrupt),100);
  }
}catch{setTimeout(()=>toast(t().corrupt),100);}
let s=null,screen='menu',selectedShip='weaver',selectedMode='voyage',selectedSeed='',selectedLesson=!profile.tutorialComplete,last=0,saveClock=0,hudClock=0,toastTimer,lastPad=[],endRecorded=false;
const t=()=>locale(settings.language);
const clock=n=>`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
function applySettings(){sound.volume=settings.volume;sound.music=settings.music;render.reduce=!settings.shake;document.documentElement.lang=settings.language;}
function store(){
  try{localStorage.setItem(STORE,JSON.stringify({version:1,settings,profile,run:s&&['playing','draft'].includes(s.status)?serialize(s):saved?serialize(saved):null}));saveFailure=false;return true;}
  catch{if(!saveFailure)toast(t().saveError);saveFailure=true;return false;}
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function btn(id,label,cls=''){return `<button id="${id}" class="${cls}">${label}</button>`;}
function bind(id,fn){$(id)?.addEventListener('click',()=>{sound.unlock();sound.event('ui');fn();});}
function shell(html,cls=''){panel.className=cls;panel.innerHTML=html;hud.classList.toggle('hidden',!s||screen==='menu');$('version').classList.toggle('hidden',screen==='play');}
function focusFirst(){panel.querySelector('button')?.focus({preventScroll:true});}
function menu(){
  screen='menu';keys.clear();s=null;endRecorded=false;const l=t();
  shell(`<section class="menu"><div class="eyebrow"><span class="dot"></span> FIELD NOTES / 001 <span class="edition">SOLO VOYAGE</span></div>
    <h1>THREAD<br><span>WAKE</span><i>↗</i></h1><div class="subtitle">${l.subtitle}</div>
    <h2>${l.tagline}</h2><p class="intro">${l.intro.replace('\n','<br>')}</p>
    <div class="menu-actions">${saved?btn('resume',l.resume+' <span>↗</span>','primary'):''}${btn('start',l.start+' <span>↗</span>',saved?'secondary':'primary')}</div>
    <div class="menu-secondary">${btn('manual',l.codex)}${btn('settings',l.settings)}${window.desktop?btn('quit',l.exit):''}</div>
    <div class="record"><span>${l.best} <b>${profile.best.toLocaleString()}</b></span><span>${l.runs} <b>${profile.runs}</b></span><span>${l.wins} <b>${profile.wins}</b></span></div>
    <p class="build-note">${l.buildNote}</p></section><div class="art-note">01 / TRIANGULATE THE UNKNOWN<br><span>THREE POINTS. INFINITE POSSIBILITIES.</span></div>`,'menu-screen');
  bind('start',()=>launch());bind('resume',()=>{s=saved;saved=null;endRecorded=false;goPlay();});bind('manual',()=>manual());bind('settings',()=>settingsScreen('menu'));bind('quit',()=>window.desktop.quit());
}
function launch(){
  screen='launch';const l=t();
  shell(`<section class="dialog launch"><div class="eyebrow">DEPARTURE / ${l.chassis}</div><h2>${l.start}</h2><p>${l.modeHint}</p>
    <div class="ship-grid">${['weaver','courier','bastion'].map((id,i)=>`<button class="ship ${id===selectedShip?'selected':''}" data-ship="${id}"><span class="ship-icon">${['△','↗','⬡'][i]}</span><strong>${l[id]}</strong><small>${l[id+'Desc']}</small></button>`).join('')}</div>
    <div class="mode-row">${btn('voyage',l.voyage,selectedMode==='voyage'?'selected':'')}${btn('sprint',l.sprint,selectedMode==='sprint'?'selected':'')}</div>
    <label class="seed-setting">${l.seed} <input id="seed" type="number" min="0" max="4294967295" step="1" placeholder="Random" value="${selectedSeed}"></label><label class="lesson-toggle"><input type="checkbox" id="tutorial" ${selectedLesson?'checked':''}> ${l.lessonToggle}</label>
    <div class="dialog-footer">${btn('back',l.back,'secondary')}${btn('begin',l.start+' ↗','primary')}</div><p class="micro">${l.controls}</p></section>`,'overlay');
  panel.querySelectorAll('[data-ship]').forEach(b=>b.addEventListener('click',()=>{selectedShip=b.dataset.ship;launch();}));
  $('seed').addEventListener('input',e=>selectedSeed=e.target.value);
  $('tutorial').addEventListener('change',e=>selectedLesson=e.target.checked);
  bind('voyage',()=>{selectedMode='voyage';launch();});bind('sprint',()=>{selectedMode='sprint';launch();});bind('back',menu);bind('begin',()=>{if($('seed').reportValidity())begin();});
}
function begin(seed=selectedSeed===''?Date.now():Number(selectedSeed)){
  s=selectedLesson?createLesson(seed,selectedMode,selectedShip):createRun(seed,selectedMode,selectedShip);saved=null;endRecorded=false;saveClock=0;store();goPlay();
}
function goPlay(){keys.clear();if(s.status==='draft'){draft();return;}screen='play';shell(s.tutorialStep>=0?btn('skipLesson',t().skipLesson,'skip-lesson'):'','playing');bind('skipLesson',finishLesson);drawHud();}
function finishLesson(){
  const {seed,mode,ship}=s;profile.tutorialComplete=true;selectedLesson=false;s=createRun(seed,mode,ship);saved=null;endRecorded=false;store();goPlay();
}
function lessonComplete(){
  screen='lessonComplete';keys.clear();profile.tutorialComplete=true;selectedLesson=false;store();const l=t();
  shell(`<section class="dialog compact"><div class="eyebrow">FIRST CIRCUIT / COMPLETE</div><h2>${l.lessonComplete}</h2><p>${l.lessonSub}</p><div class="result-score">${s.bestCircuit}<small>${l.capture}</small></div>${btn('launchVoyage',l.beginVoyage+' ↗','primary')}</section>`,'overlay');
  bind('launchVoyage',finishLesson);focusFirst();
}
function manual(from='menu'){
  screen='manual';const l=t();shell(`<section class="dialog manual"><div class="eyebrow">PILOT'S HANDBOOK</div><h2>${l.guideTitle}</h2><div class="guide-diagram"><span>1</span><i>────</i><span>2</span><i>────</i><span>3</span><b>△</b></div>${[1,2,3,4].map(i=>`<p>${l['guide'+i]}</p>`).join('')}<p class="muted">${l.guideFoot}</p><div class="guide-combos">${Object.values(l.combos).map(c=>`<p><b>${c[0]}</b><br>${c[1]}</p>`).join('')}</div>${btn('back',l.back,'primary')}</section>`,'overlay');bind('back',()=>from==='pause'?pause():menu());
}
function pause(){
  if(!s||['won','lost'].includes(s.status))return;
  screen='pause';keys.clear();const ok=store(),l=t();
  shell(`<section class="dialog compact"><div class="eyebrow">SIGNAL HELD / ${clock(s.time)}</div><h2>${l.paused}</h2><p>${ok?l.pauseSub:l.saveError}</p><div class="stack">${btn('continue',l.continue,'primary')}${btn('manual',l.codex)}${btn('settings',l.settings)}${btn('saveQuit',l.saveQuit,'secondary')}</div><p class="micro">${l.seed}: ${s.seed}</p></section>`,'overlay');
  bind('continue',goPlay);bind('manual',()=>manual('pause'));bind('settings',()=>settingsScreen('pause'));bind('saveQuit',()=>{saved=s;store();menu();});focusFirst();
}
function settingsScreen(from){
  screen='settings';const l=t();
  shell(`<section class="dialog compact"><div class="eyebrow">FLIGHT SYSTEMS</div><h2>${l.settings}</h2>
    <label class="setting">${l.language}<select id="language"><option value="ko" ${settings.language==='ko'?'selected':''}>한국어</option><option value="en" ${settings.language==='en'?'selected':''}>English</option></select></label>
    <label class="setting">${l.volume}<input id="volume" aria-label="${l.volume}" type="range" min="0" max="100" value="${Math.round(settings.volume*100)}"></label>
    <label class="setting">${l.music}<input id="music" aria-label="${l.music}" type="range" min="0" max="100" value="${Math.round(settings.music*100)}"></label>
    <label class="setting">${l.motionLabel}<input id="shake" type="checkbox" ${settings.shake?'checked':''}></label>
    <div class="stack">${btn('fullscreen',l.fullscreen)}${btn('back',l.back,'primary')}</div></section>`,'overlay');
  $('language').addEventListener('change',e=>{settings.language=e.target.value;applySettings();store();settingsScreen(from);});
  for(const k of ['volume','music'])$(k).addEventListener('input',e=>{settings[k]=Number(e.target.value)/100;sound.unlock();applySettings();store();if(k==='volume')sound.event('anchor');});
  $('shake').addEventListener('change',e=>{settings.shake=e.target.checked;applySettings();store();});
  bind('fullscreen',fullscreen);bind('back',()=>from==='pause'?pause():menu());
}
function fullscreen(){if(window.desktop)window.desktop.fullscreen();else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>{});}
function draft(){
  screen='draft';keys.clear();store();const l=t();
  shell(`<section class="dialog draft"><div class="eyebrow">RECONFIGURE / LV. ${s.level}</div><h2>${l.level}</h2><p>${l.levelSub}</p><div class="card-grid">${s.draft.map((id,i)=>{const u=UPGRADES.find(u=>u.id===id),rank=(s.upgrades[id]||0)+1;const unlocked=synergies({...s,upgrades:{...s.upgrades,[id]:rank}}).filter(k=>!synergies(s).includes(k));return `<button class="card family-${u.family}" data-upgrade="${id}"><div class="card-top"><span>${l[u.family]}</span><kbd>${i+1}</kbd></div><div class="card-symbol">${{circuit:'△',frost:'❄',salvage:'◇',weapon:'⌁',motion:'↗'}[u.family]}</div><h3>${l.upgrades[id][0]}</h3><p>${l.upgrades[id][1]}</p>${unlocked.length?`<div class="combo-unlock">${l.unlocks}: ${unlocked.map(k=>l.combos[k][0]).join(', ')}</div>`:''}<div class="rank">${l.rank} ${rank} / ${u.max} <span>${'●'.repeat(rank)}${'○'.repeat(u.max-rank)}</span></div></button>`;}).join('')}</div><div class="active-combos">${synergies(s).map(k=>`<span title="${l.combos[k][1]}">◇ ${l.combos[k][0]}</span>`).join('')}</div><div class="installed">${l.installed}: ${Object.keys(s.upgrades).map(id=>`${l.upgrades[id][0]} ${s.upgrades[id]}`).join(' · ')||'—'}</div></section>`,'overlay');
  panel.querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>pick(b.dataset.upgrade)));focusFirst();
}
function pick(id){if(chooseUpgrade(s,id)){sound.unlock();sound.event('upgrade');store();goPlay();}}
function ending(){
  const l=t();screen='end';keys.clear();
  if(!endRecorded){profile.runs++;if(s.status==='won')profile.wins++;profile.best=Math.max(profile.best,Math.round(s.score));saved=null;endRecorded=true;store();}
  shell(`<section class="dialog result"><div class="eyebrow">${s.status==='won'?'VOYAGE COMPLETE':'FLIGHT RECORDER'} / ${s.mode==='sprint'?'TRIAL':'VOYAGE'}</div><h2>${s.status==='won'?l.won:l.lost}</h2><p>${s.status==='won'?l.wonSub:l.lostSub}</p><div class="result-score">${Math.round(s.score).toLocaleString()}<small>${l.score}</small></div><div class="result-grid">${[['time',clock(s.time)],['kills',s.kills],['circuits',s.circuits],['capture',s.bestCircuit]].map(([k,v])=>`<div><b>${v}</b><span>${l[k]}</span></div>`).join('')}</div><div class="installed">${Object.keys(s.upgrades).map(id=>`${l.upgrades[id][0]} ${s.upgrades[id]}`).join(' · ')||'—'}</div><div class="dialog-footer">${btn('port',l.back,'secondary')}${btn('retry',l.restart,'primary')}</div><p class="micro">${l.seed}: ${s.seed}</p></section>`,'overlay');
  bind('port',menu);bind('retry',()=>{selectedMode=s.mode;selectedShip=s.ship;begin(s.seed);});focusFirst();
}
function drawHud(){
  if(!s)return;const l=t(),st=stats(s),duration=s.mode==='sprint'?180:720;
  const preview=s.anchors.length===2?[...s.anchors,s.player]:null,hits=preview?s.enemies.filter(e=>inTriangle(e,...preview)).length:0;
  const boss=s.enemies.find(e=>e.kind==='boss');
  hud.innerHTML=`<div class="hud-top"><div class="hud-brand">TW<span>${l.sector} ${Math.min(4,1+Math.floor(s.time/(duration/4)))}</span></div><div class="meter"><div>${l.hull}<b>${Math.ceil(s.player.hp)} / ${st.maxHp}</b></div><progress value="${s.player.hp}" max="${st.maxHp}"></progress></div><div class="meter energy"><div>${l.energy}<b>${Math.floor(s.player.energy)}</b></div><progress value="${s.player.energy}" max="${st.maxEnergy}"></progress></div><div class="hud-time">${clock(Math.max(0,duration-s.time))}<span>${l.time} ${clock(s.time)}</span></div><div class="hud-level">LV ${s.level}<progress value="${s.xp}" max="${s.nextXp}"></progress></div></div>
    ${boss?`<div class="boss-meter"><span>${l.bossNames[boss.tier]} · ${boss.tier+1} / 4</span><small>${l.bossHints[boss.tier]}</small><progress value="${boss.hp}" max="${boss.maxHp}"></progress></div>`:''}
    <div class="hud-bottom"><div class="anchor-state"><b>${'◆'.repeat(s.anchors.length)}${'◇'.repeat(3-s.anchors.length)}</b> ${l.anchor} ${s.anchors.length}/3 ${s.anchors.length&&s.tutorialStep<0?`<em>${Math.ceil(s.anchorLife)}s</em>`:''}${preview?`<span class="target-count">${l.targets} ${hits}</span>`:''}</div><div class="hud-hint">${s.tutorialStep>=0?l.lessonSteps[Math.min(s.tutorialStep,2)]:s.circuits<2?l.tutorial:s.time>=duration?l.survive:l.anchorHelp+' · '+l.dashHelp+' · '+l.cancelHelp+' · '+l.pauseHelp}</div><div class="dash-state">${l.dash} <b>${s.player.dash<=0?l.ready:s.player.dash.toFixed(1)+'s'}</b></div></div>`;
}
function actions(code){
  if(code==='Escape'){if(screen==='play'||screen==='draft')pause();else if(screen==='pause')goPlay();return;}
  if(screen==='draft'&&/^Digit[123]$/.test(code)){pick(s.draft[Number(code.slice(-1))-1]);return;}
  if(screen!=='play')return;
  if(code==='KeyQ')placeAnchor(s);if(code==='Space')dash(s);if(code==='KeyE')cancelAnchors(s);
}
addEventListener('keydown',e=>{
  if(['INPUT','SELECT'].includes(e.target.tagName))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&screen==='play')e.preventDefault();
  sound.unlock();if(!e.repeat)actions(e.code);keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));
$('space').addEventListener('pointerdown',e=>{if(screen!=='play')return;sound.unlock();if(e.button===0)placeAnchor(s);else if(e.button===2)dash(s);});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{keys.clear();if(screen==='play'||screen==='draft')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(screen==='play'||screen==='draft'))pause();});
addEventListener('resize',()=>render.resize());
addEventListener('beforeunload',()=>store());
window.desktop?.onClosing(()=>store());
function gamepad(){
  const pad=navigator.getGamepads?.()[0];if(!pad){lastPad=[];return {x:0,y:0};}
  const down=i=>pad.buttons[i]?.pressed&&!lastPad[i];
  if(down(9))actions('Escape');
  if(screen==='play'){if(down(0))placeAnchor(s);if(down(1))dash(s);if(down(2))cancelAnchors(s);}
  else if(screen==='draft'){if(down(0))document.activeElement?.click();if(down(15)||down(14)){const cards=[...panel.querySelectorAll('.card')],i=cards.indexOf(document.activeElement);cards[(i+(down(15)?1:cards.length-1))%cards.length]?.focus();}}
  lastPad=pad.buttons.map(b=>b.pressed);
  return {x:Math.abs(pad.axes[0])>.18?pad.axes[0]:0,y:Math.abs(pad.axes[1])>.18?pad.axes[1]:0};
}
function frame(now){
  const dt=Math.min((now-last)/1000,.05);last=now;const pad=gamepad();
  if(screen==='play'&&s){
    update(s,dt,{x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+pad.x,y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+pad.y});
    for(const e of s.events){sound.event(e.type);if(['lowEnergy','tooClose','tooSmall','expired','boss','bossDown'].includes(e.type))toast(t()[e.type]);if(e.type==='circuit')render.shake=6;if(e.type==='hurt')render.shake=12;}
    s.events=[];
    if(s.status==='lessonComplete')lessonComplete();if(s.status==='draft')draft();if(s.status==='lost'||s.status==='won')ending();
    saveClock+=dt;if(saveClock>=5){saveClock=0;store();}
  }
  if(s){render.draw(s,now/1000,t());hudClock+=dt;if(hudClock>.1){hudClock=0;drawHud();}}
  else render.menu(now/1000);
  sound.tick(now/1000,screen==='play');requestAnimationFrame(frame);
}
applySettings();menu();requestAnimationFrame(frame);
