// Public beta: existing harbor theme only; no generated OST files or URLs.
export const OST=Object.freeze({title:'harbor-theme'});
export const ostUrl=()=>new URL('../assets/audio/harbor-theme.wav',import.meta.url).href;

// Stream compressed files, never decode the entire 30-minute album into RAM.
// At most two decks exist. New scene requests replace the pending deck; stale
// canplay/error callbacks cannot switch the current track. Failures stay silent.
export class Soundtrack {
 constructor(ctx,bus,{createAudio=()=>new Audio()}={}){
  this.ctx=ctx;this.bus=bus;this.createAudio=createAudio;this.decks=[];this.requested=null;this.current=null;this.enabled=true;this.disposed=false;
 }
 setEnabled(value){
  if(this.enabled===value)return;this.enabled=value;
  for(const d of this.decks)if(!value)d.audio.pause();else if(d.ready)d.audio.play().catch(()=>{});
 }
 select(id){
  id='title'; // One existing theme across scenes; never restart on scene changes.
  if(this.disposed||!OST[id]||id===this.requested)return;
  this.requested=id;
  for(const d of [...this.decks])if(d!==this.current)this.remove(d);
  const audio=this.createAudio(),gain=this.ctx.createGain(),source=this.ctx.createMediaElementSource(audio);
  const deck={id,audio,gain,source,ready:false,timer:null};
  gain.gain.value=0;source.connect(gain);gain.connect(this.bus);this.decks.push(deck);
  audio.preload='auto';audio.loop=true;
  audio.oncanplay=()=>{
   if(deck.ready||this.disposed||this.requested!==id||!this.decks.includes(deck))return;
   deck.ready=true;const previous=this.current;this.current=deck;
   const now=this.ctx.currentTime;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.32,now+.8);
   if(this.enabled)audio.play().catch(()=>{});
   if(previous){previous.gain.gain.cancelScheduledValues(now);previous.gain.gain.setValueAtTime(previous.gain.gain.value,now);previous.gain.gain.linearRampToValueAtTime(0,now+.8);previous.timer=setTimeout(()=>this.remove(previous),900);}
  };
  audio.onerror=()=>{this.remove(deck);};
  audio.src=ostUrl(id);audio.load();
 }
 remove(d){
  clearTimeout(d.timer);d.audio.oncanplay=null;d.audio.onerror=null;d.audio.pause();d.audio.removeAttribute('src');d.audio.load();d.source.disconnect();d.gain.disconnect();
  this.decks=this.decks.filter(x=>x!==d);if(this.current===d)this.current=null;
 }
 dispose(){this.disposed=true;for(const d of [...this.decks])this.remove(d);}
}

// Uses already-resolved encounter/discovery flags; never reveals a hidden enemy.
export class VoyageScore {
 constructor(){this.run=null;this.lastDiscovery=false;this.companionUntil=0;this.eliteUntil=0;}
 select(s,surface,visible=()=>false){
  if(!s)return 'title';
  if(s!==this.run){this.run=s;this.lastDiscovery=!!s.rescue?.discovered;this.companionUntil=0;this.eliteUntil=0;}
  if(s.status==='won')return 'home';
  if(s.status!=='playing')return 'region'+Math.min(2,s.depth||0);
  if(surface==='pause')return null; // Retain current theme and playback position.
  if(s.rescue?.discovered&&!this.lastDiscovery)this.companionUntil=s.time+18;
  this.lastDiscovery=!!s.rescue?.discovered;
  const danger=s.mode==='ashore'&&s.combat?.enemies?.some(e=>e.hp>0&&(e.kind==='crab'||e.elite===true)&&e.alert&&visible(s,e));
  if(danger)this.eliteUntil=s.time+4;
  if(s.mode==='ashore'&&s.time<this.eliteUntil)return 'elite';
  if(s.boss?.active&&!s.boss.cleared&&s.mode==='sailing')return 'boss'+Math.min(2,s.depth||0);
  if(s.time<this.companionUntil)return 'companion';
  if(['intro','chart'].includes(surface)||s.mode==='ashore')return 'region'+Math.min(2,s.depth||0);
  return 'sailing';
 }
}
