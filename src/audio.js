// Original music motifs + selected Kenney CC0 samples; see LICENSE-NOTICES.md.
export class Sound {
  constructor(){this.ctx=null;this.volume=.35;this.music=.22;this.lastBeat=-1;this.buffers={};this.voices=0;this.lastSample={};}
  unlock(){if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createDynamicsCompressor();this.master.threshold.value=-9;this.master.knee.value=6;this.master.ratio.value=12;this.master.attack.value=.003;this.master.release.value=.1;this.master.connect(this.ctx.destination);this.load();}if(this.ctx.state==='suspended')this.ctx.resume();}
  async load(){
    await Promise.all(['ui','upgrade','anchor','circuit','dash','hurt','shot'].map(async id=>{try{const response=await fetch(new URL(`../assets/audio/${id}.ogg`,import.meta.url));if(response.ok)this.buffers[id]=await this.ctx.decodeAudioData(await response.arrayBuffer());}catch{/* Synth fallback works offline if a sample is unavailable. */}}));
  }
  sample(id){
    if(!this.ctx||!this.buffers[id])return false;
    if(this.voices>=12||this.volume===0)return true;
    const now=this.ctx.currentTime;if(now-(this.lastSample[id]??-10)<(id==='shot'?.08:.06))return true;
    this.lastSample[id]=now;const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers[id];
    source.playbackRate.value=1+Math.sin(now*19)*.025;const duration=Math.min(source.buffer.duration,{dash:.38,circuit:.65,anchor:.22,hurt:.23,shot:.12,ui:.10,upgrade:.65}[id]);
    const volume=this.volume*({shot:.10,circuit:.55,hurt:.32,dash:.25,anchor:.3,ui:.3,upgrade:.4}[id]);
    gain.gain.setValueAtTime(volume,now);gain.gain.setValueAtTime(volume,now+Math.max(.01,duration-.06));gain.gain.linearRampToValueAtTime(0,now+duration);
    source.connect(gain);gain.connect(this.master);this.voices++;source.onended=()=>{this.voices--;source.disconnect();gain.disconnect();};source.start();source.stop(now+duration);return true;
  }
  tone(freq,duration=.1,type='sine',volume=.1,slide=0){
    if(!this.ctx||this.ctx.state!=='running')return;
    const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.01);
  }
  event(type){
    if(this.sample(type))return;
    const v=this.volume;
    if(type==='anchor')this.tone(510,.16,'sine',v*.23,320);
    if(type==='circuit'){this.tone(85,.4,'triangle',v*.5,-45);this.tone(720,.45,'sine',v*.18,-400);}
    if(type==='dash')this.tone(220,.16,'sawtooth',v*.10,-170);
    if(type==='shot')this.tone(570,.045,'triangle',v*.07,-180);
    if(type==='hurt')this.tone(95,.22,'sawtooth',v*.3,-40);
    if(type==='pickup')this.tone(1050,.06,'sine',v*.08,150);
    if(type==='upgrade'||type==='level'){this.tone(440,.32,'sine',v*.2);this.tone(660,.4,'sine',v*.13);}
    if(type==='boss'||type==='bossDown')this.tone(type==='boss'?55:330,.8,'triangle',v*.28,60);
  }
  tick(time,playing){
    const beat=Math.floor(time*2.4);if(beat===this.lastBeat)return;this.lastBeat=beat;
    if(!playing||this.music===0)return;
    const notes=[0,7,12,14,7,3,10,7],root=[110,98,130.81,116.54][Math.floor(beat/32)%4];
    this.tone(root*2**(notes[beat%8]/12),.38,'sine',this.music*.11);
    if(beat%4===0)this.tone(root/2,.7,'triangle',this.music*.12);
  }
}
