import {Soundtrack} from './soundtrack.js';
// Original cue design and generated harbor bed; existing Kenney CC0 samples.
// All user levels are applied once, on independent effects/ambience buses.
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const tones=(...notes)=>notes.map(([frequency,duration,gain,delay=0,slide=0,type='sine'])=>({frequency,duration,gain,delay,slide,type}));
export const HARBOR_CUES={
 ui:{sample:'ui',gain:.25},
 anchor:{sample:'anchor',gain:.3,tones:tones([145,.13,.06,0,-40,'triangle'])},
 circuit:{sample:'circuit',gain:.36,tones:tones([82,.28,.1,0,-24,'triangle'])},
 hurt:{sample:'hurt',gain:.52,tones:tones([58,.2,.14,0,-20,'sawtooth'])},
 lift:{tones:tones([330,.2,.13],[495,.3,.11,.16],[660,.2,.055,.31])},
 gate:{sample:'circuit',gain:.15,tones:tones([110,.22,.1,0,-20,'triangle'],[165,.28,.08,.15,-30,'triangle'])},
 dash:{sample:'dash',gain:.24,tones:tones([65,.3,.08,0,28,'triangle'])},
 pumpWarning:{cooldown:.6,duck:.8,tones:tones([540,.17,.14],[720,.17,.12,.23])},
 winchWarning:{cooldown:.6,duck:.8,tones:tones([310,.13,.15],[310,.13,.15,.20],[440,.13,.10,.40])},
 connect:{sample:'anchor',gain:.15,tones:tones([360,.10,.11],[540,.16,.10,.09])},
 detach:{tones:tones([320,.13,.1,0,-150,'triangle'],[150,.11,.06,.1,-30,'triangle'])},
 brake:{tones:tones([145,.4,.13,0,-65,'triangle'])},
 radio:{cooldown:.3,duck:.6,tones:tones([770,.055,.1],[990,.07,.065,.08])},
 arrival:{duck:1.3,tones:tones([220,.65,.07],[330,.45,.10,.10],[440,.55,.09,.32],[660,.6,.07,.56])},
 failure:{tones:tones([180,.4,.12,0,-55,'triangle'],[110,.6,.1,.3,-35,'triangle'])},
 reject:{cooldown:.2,tones:tones([185,.09,.085,0,-60,'triangle'])},
 cancel:{tones:tones([410,.08,.055,0,-100])}
};
export function harborCueForEvent(e,state){
 if(e.type==='radio')return {towConnected:'connect',towDetached:'detach',towGateChanged:'gate',towDockCaught:'brake',engineerRescued:'lift',operatorRescued:'lift',engineerReady:'lift'}[e.id]||null;
 if(e.type==='expeditionSalvage'||e.type==='expeditionPatched')return 'lift';
 if(e.type==='expeditionStorm')return 'pumpWarning';
 if(e.type==='end')return state?.status==='won'?'arrival':'failure';
 if(['lowEnergy','tooClose','tooSmall','expired','needsEngineer','towTooFar'].includes(e.type))return 'reject';
 if(['routeCleared','cargoSecured'].includes(e.type))return 'gate';
 if(e.type==='moored')return 'connect';if(e.type==='unmoored')return 'detach';if(['moorFast','moorHeading','moorBow'].includes(e.type))return 'reject';
 return HARBOR_CUES[e.type]?e.type:null;
}
export class HarborAudio {
 constructor({context=null,random=Math.random}={}){
  this.ctx=null;this.effects=.38;this.ambience=.22;this.masterLevel=1;this.scoreId='title';this.focused=true;this.random=random;
  this.buffers={};this.active=new Set();this.lastCue=new Map();this.targets=new Map();this.duckUntil=0;this.maxVoices=24;
  if(context)this.attach(context);
 }
 attach(ctx){
  this.ctx=ctx;this.effectsBus=ctx.createGain();this.ambienceBus=ctx.createGain();this.output=ctx.createGain();
  this.limiter=ctx.createDynamicsCompressor();this.limiter.threshold.value=-7;this.limiter.knee.value=8;this.limiter.ratio.value=10;this.limiter.attack.value=.003;this.limiter.release.value=.12;
  this.effectsBus.connect(this.limiter);this.ambienceBus.connect(this.limiter);this.limiter.connect(this.output);this.output.connect(ctx.destination);
  this.effectsBus.gain.value=this.effects;this.ambienceBus.gain.value=this.ambience;this.output.gain.value=this.focused?this.masterLevel:0;
  this.musicGain=ctx.createGain();this.musicGain.gain.value=1;this.musicGain.connect(this.ambienceBus);this.startHarbor();
  if(!ctx.startRendering&&typeof Audio!=='undefined'){this.score=new Soundtrack(ctx,this.musicGain);this.score.setEnabled(this.focused&&this.masterLevel>0&&this.ambience>0);this.score.select(this.scoreId);}
  return this;
 }
 unlock(){
  if(!this.ctx){try{this.attach(new AudioContext());this.ready=this.load();}catch{return false;}}
  if(this.ctx.state==='suspended'&&!this.ctx.startRendering)this.ctx.resume().catch(()=>{});
  return true;
 }
 async load(){
  await Promise.all(['ui','upgrade','anchor','circuit','dash','hurt','shot'].map(async id=>{try{const r=await fetch(new URL('../assets/audio/'+id+'.ogg',import.meta.url));if(r.ok)this.buffers[id]=await this.ctx.decodeAudioData(await r.arrayBuffer());}catch{/* Original tones remain available offline. */}}));
 }
 ramp(param,value,seconds=.025){
  if(this.targets.get(param)===value)return;this.targets.set(param,value);const now=this.ctx.currentTime;
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);else{param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);}
  param.linearRampToValueAtTime(value,now+seconds);
 }
 setLevels(effects,ambience,master=this.masterLevel){
  this.effects=clamp(effects);this.ambience=clamp(ambience);this.masterLevel=clamp(master);
  if(this.ctx){this.ramp(this.effectsBus.gain,this.effects);this.ramp(this.ambienceBus.gain,this.ambience);this.ramp(this.output.gain,this.focused?this.masterLevel:0);}
  this.score?.setEnabled(this.focused&&this.masterLevel>0&&this.ambience>0);
 }
 setMusic(id){if(!id)return;this.scoreId=id;this.score?.select(id);}
 setFocused(focused){this.focused=!!focused;if(this.ctx)this.ramp(this.output.gain,this.focused?this.masterLevel:0,.03);this.score?.setEnabled(this.focused&&this.masterLevel>0&&this.ambience>0);}
 startHarbor(){
  const c=this.ctx,buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);let previous=0;
  for(let i=0;i<data.length;i++){previous=(previous+(this.random()*2-1)*.022)/1.025;data[i]=previous*2.3*Math.min(1,i/(c.sampleRate*.04),(data.length-1-i)/(c.sampleRate*.04));}
  this.sea=c.createBufferSource();this.sea.buffer=buffer;this.sea.loop=true;this.seaFilter=c.createBiquadFilter();this.seaFilter.type='lowpass';this.seaFilter.frequency.value=850;
  this.seaGain=c.createGain();this.seaGain.gain.value=0;this.sea.connect(this.seaFilter);this.seaFilter.connect(this.seaGain);this.seaGain.connect(this.effectsBus);this.sea.start();
  this.boostNoise=c.createBufferSource();this.boostNoise.buffer=buffer;this.boostNoise.loop=true;this.boostFilter=c.createBiquadFilter();this.boostFilter.type='bandpass';this.boostFilter.frequency.value=700;this.boostGain=c.createGain();this.boostGain.gain.value=0;this.boostNoise.connect(this.boostFilter);this.boostFilter.connect(this.boostGain);this.boostGain.connect(this.effectsBus);this.boostNoise.start();
  this.engine=c.createOscillator();this.engine.type='triangle';this.engine.frequency.value=44;this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain);this.engineGain.connect(this.effectsBus);this.engine.start();
  this.rope=c.createOscillator();this.rope.type='sine';this.rope.frequency.value=150;this.ropeGain=c.createGain();this.ropeGain.gain.value=0;this.rope.connect(this.ropeGain);this.ropeGain.connect(this.effectsBus);this.rope.start();
 }
 track(source,gain){
  this.active.add(source);source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};
  source.connect(gain);gain.connect(this.effectsBus);
 }
 tone(note){
  if(this.active.size>=this.maxVoices)return false;
  const c=this.ctx,t=c.currentTime+(note.delay||0),duration=Math.max(.025,note.duration),o=c.createOscillator(),g=c.createGain();
  o.type=note.type||'sine';o.frequency.setValueAtTime(note.frequency,t);if(note.slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,note.frequency+note.slide),t+duration);
  g.gain.setValueAtTime(0,c.currentTime);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(note.gain,t+.006);g.gain.exponentialRampToValueAtTime(.00001,t+duration);g.gain.linearRampToValueAtTime(0,t+duration+.005);
  this.track(o,g);o.start(t);o.stop(t+duration+.01);return true;
 }
 sample(id,volume){
  const buffer=this.buffers[id];if(!buffer||this.active.size>=this.maxVoices)return false;
  const c=this.ctx,t=c.currentTime,source=c.createBufferSource(),g=c.createGain(),duration=Math.min(buffer.duration,{ui:.10,anchor:.25,circuit:.60,hurt:.25,dash:.38}[id]||.4);
  source.buffer=buffer;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.004);g.gain.setValueAtTime(volume,t+Math.max(.006,duration-.05));g.gain.linearRampToValueAtTime(0,t+duration);
  this.track(source,g);source.start();source.stop(t+duration+.005);return true;
 }
 event(id){
  const cue=HARBOR_CUES[id];if(!cue||!this.ctx||this.ctx.state==='closed'||!this.focused||this.effects===0)return false;
  const now=this.ctx.currentTime;if(now-(this.lastCue.get(id)??-100)<(cue.cooldown??.06))return false;this.lastCue.set(id,now);
  if(cue.duck)this.duckUntil=Math.max(this.duckUntil,now+cue.duck);
  const sampled=cue.sample&&this.sample(cue.sample,cue.gain);
  for(const n of cue.tones||[])this.tone(n);
  if(!sampled&&!cue.tones)this.tone({frequency:440,duration:.08,gain:.08,type:'sine'});
  return true;
 }
 gameEvent(e,state){const id=harborCueForEvent(e,state);if(id)this.event(id);}
 tick({playing=false,moving=false,tension=0,boosting=false}={}){
  if(!this.ctx)return;const duck=this.ctx.currentTime<this.duckUntil?.35:1;
  this.ramp(this.seaGain.gain,(playing?.11:.04)*duck,.18);this.ramp(this.engineGain.gain,(playing?(moving?.055:.025):0)*duck,.18);
  this.ramp(this.engine.frequency,playing&&boosting?94:playing&&moving?60:44,.20);this.ramp(this.boostGain.gain,playing&&boosting?.38:0,.09);this.ramp(this.musicGain.gain,(playing?.75:1)*duck,.4);
  const pull=playing?clamp((tension-.25)/.75):0;this.ramp(this.ropeGain.gain,pull*.035,.12);this.ramp(this.rope.frequency,130+pull*110,.15);
 }
 dispose(){
  this.disposed=true;this.score?.dispose();if(!this.ctx)return;for(const source of this.active){source.onended=null;try{source.stop();}catch{}source.disconnect();}this.active.clear();
  for(const source of [this.sea,this.engine,this.rope,this.boostNoise,this.theme].filter(Boolean)){try{source.stop();}catch{}source.disconnect();}
  for(const node of [this.musicGain,this.boostFilter,this.boostGain,this.seaFilter,this.seaGain,this.engineGain,this.ropeGain,this.effectsBus,this.ambienceBus,this.limiter,this.output])node.disconnect();
  if(this.ctx.close)this.ctx.close().catch(()=>{});
 }
}
