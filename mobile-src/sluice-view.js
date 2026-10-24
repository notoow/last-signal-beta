import {SLUICE,sluiceGate,sluiceCleat,sluiceStatus,recentSluiceImpact} from './sluice-counterplay.js';
const sprites=Object.fromEntries(['gate-closed','gate-exposed','gate-open','capstan','foam-1','foam-2'].map(id=>{
  const image=new Image();image.src='assets/art/sluice-'+id+'-v1.png';return [id,image];
}));
function sprite(c,id,x,y,flip=false){
  const img=sprites[id];if(!img.complete||!img.naturalWidth)return;
  const scale=id.startsWith('gate')?220/676:id==='capstan'?36/235:100/447;
  c.save();c.translate(x,y);if(flip)c.scale(-1,1);
  c.drawImage(img,-img.naturalWidth*scale/2,-img.naturalHeight*scale/2,img.naturalWidth*scale,img.naturalHeight*scale);c.restore();
}
function fixedOpenGate(c,p){
  const img=sprites['gate-exposed'],k=220/676;
  if(!ready('gate-exposed'))return false;
  c.save();c.translate(p.x,p.y);
  for(const [sy,sh]of [[0,235],[457,235]])crop(c,img,[0,sy,272,sh],[-136*k,(sy-346)*k,272*k,sh*k]);
  c.restore();return true;
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Pure presentation of an actual event; the authoritative gate is already open.
export function sluiceImpactMotion(e,{opened=false,reduced=false,overview=false,scale=1}={}){
  if(!e||overview||!Number.isFinite(e.age)||e.age<0||e.age>=Math.min(e.life||.72,.72))return null;
  const success=e.outcome==='opened';
  if(success&&!opened)return null;
  const age=e.age,pixel=1/Math.max(.6,Number.isFinite(scale)?scale:1);
  if(reduced)return age<.24?{id:e.id,outcome:e.outcome,age,static:true,success,pixel,contact:e.contactPoint||e.point,alpha:.55}:null;
  if(!success)return age<.3?{id:e.id,outcome:e.outcome,age,success:false,pixel,contact:e.contactPoint||e.point,alpha:.7*(1-age/.3),radius:3+8*smooth(age/.3)}:null;
  // The middle passage starts clearing immediately, then the two leaves settle
  // inside the existing footprint. No timer/physics/controls wait for this.
  const retract=40*smooth(age/.38)+2*Math.sin(Math.max(0,age-.38)/.16*Math.PI)*Math.max(0,1-Math.max(0,age-.38)/.16);
  return {id:e.id,outcome:e.outcome,age,success:true,pixel,contact:e.contactPoint||e.point,
    retract:age>=.54?40:retract,leafAlpha:1-smooth((age-.4)/.18),
    waterAlpha:age<.34?.46*Math.sin(Math.PI*Math.min(1,age/.34)):0,waterTravel:48*smooth(age/.34)};
}
function fallbackGate(c,p,opened,exposed){
  c.save();c.translate(p.x,p.y);c.fillStyle='#283a3b';c.strokeStyle='#b39a62';c.lineWidth=2;
  for(const y of [-108,36]){c.fillRect(-34,y,68,72);c.strokeRect(-34,y,68,72);}
  if(!opened){c.fillStyle=exposed?'#b98936':'#374748';c.fillRect(-22,-36,44,72);c.strokeRect(-22,-36,44,72);}
  c.restore();
}
function ready(id){const img=sprites[id];return img?.complete&&img.naturalWidth>0;}
function crop(c,img,src,dest){c.drawImage(img,...src,...dest);}
function localCueClip(c,frame){
  if(!frame?.scale)return;
  const {scale,ox,oy,width,height}=frame,outer=[-ox/scale,-oy/scale,width/scale,height/scale];
  c.beginPath();c.rect(...outer);c.clip();
  for(const b of frame.occupied||[]){
    c.beginPath();c.rect(...outer);c.rect((b.x-ox-4)/scale,(b.y-oy-4)/scale,(b.w+8)/scale,(b.h+8)/scale);c.clip('evenodd');
  }
}
function contactCue(c,p,m,frame){
  c.save();localCueClip(c,frame);
  const q=m.contact&&Number.isFinite(m.contact.x)&&Number.isFinite(m.contact.y)?m.contact:{x:p.x-25,y:p.y};
  const pixel=m.pixel;c.strokeStyle=m.success?'#d7e4cf':'#d3ad71';c.lineWidth=1.5*pixel;
  c.globalAlpha=m.alpha??.55;
  if(m.static){c.beginPath();c.moveTo(q.x-4*pixel,q.y-7*pixel);c.lineTo(q.x-7*pixel,q.y);c.lineTo(q.x-4*pixel,q.y+7*pixel);c.stroke();}
  else if(!m.success){
    const r=m.radius*pixel;
    c.beginPath();for(const a of [-2.5,Math.PI,2.5]){c.moveTo(q.x+Math.cos(a)*r*.45,q.y+Math.sin(a)*r*.45);c.lineTo(q.x+Math.cos(a)*r,q.y+Math.sin(a)*r);}c.stroke();
  }else if(m.waterAlpha>0){
    c.globalAlpha=m.waterAlpha;c.strokeStyle='#c5dbd1';c.lineWidth=2*pixel;
    for(const [i,y]of [-22,-9,12,24].entries()){
      const x=p.x+8+m.waterTravel*(.65+i*.1);c.beginPath();c.moveTo(x-13,y+p.y);c.quadraticCurveTo(x,y+p.y+(i%2?3:-3),x+10,y+p.y);c.stroke();
    }
  }
  c.restore();
}
export function drawSluiceGate(c,p,{opened=false,exposed=false,motion=null,frame=null}={}){
  const id=opened?'gate-open':exposed?'gate-exposed':'gate-closed';
  if(motion?.success&&!motion.static&&motion.leafAlpha>0&&ready('gate-exposed')){
    // Preserve original fixed-frame pixels in every state. Only the middle
    // 72-world-unit barrier is split and retracted behind the anchored frame.
    const img=sprites['gate-exposed'],k=220/676;
    c.save();localCueClip(c,frame);c.translate(p.x,p.y);c.beginPath();c.rect(-136*k,-111*k,272*k,222*k);c.clip();c.globalAlpha=motion.leafAlpha;
    for(const [sy,sh,dy]of [[235,111,-motion.retract],[346,111,motion.retract]]){
      crop(c,img,[0,sy,272,sh],[-136*k,(sy-346)*k+dy,272*k,sh*k]);
    }
    c.restore();
  }
  // The anchored housing occludes the retracting leaves, not vice versa.
  if(opened&&fixedOpenGate(c,p)){/* final open state uses the same anchored frame */}
  else if(ready(id))sprite(c,id,p.x,p.y);else fallbackGate(c,p,opened,exposed);
  if(motion)contactCue(c,p,motion,frame);
}

export function drawSluice(c,s,{label,reduced=false,language='ko',overview=false,frame=null,hud=null}={}){
  // Screen-space label avoidance only; never changes camera fit or collision.
  const originalLabel=label;
  label=(ctx,text,x,y,color,size=15)=>{
    if(hud&&frame){
      ctx.save();ctx.font='600 '+size+'px Pretendard, sans-serif';const w=ctx.measureText(text).width;ctx.restore();
      const box={x:x*frame.scale+frame.ox-w/2-4,y:y*frame.scale+frame.oy-size-4,w:w+8,h:size+9};
      if(hud.bounds.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y))return false;
    }
    return originalLabel(ctx,text,x,y,color,size);
  };
  const b=s.boss,a=sluiceStatus(s),en=language==='en';
  const impact=recentSluiceImpact(s);
  if(b.active&&!b.cleared&&['warn','attack'].includes(b.phase)){
    const y=SLUICE.laneYs[a.lane],warn=b.phase==='warn',reverse=a.backwash;
    const color=reverse?'#d78e6b':warn?'#d9c286':'#aedaca';
    c.save();
    c.fillStyle=reverse?'#b05e411a':warn?'#c8aa5410':'#9bd6c10d';
    c.fillRect(SLUICE.left,y-SLUICE.halfWidth,SLUICE.right-SLUICE.left,SLUICE.halfWidth*2);
    c.strokeStyle=color;c.globalAlpha=.55;c.lineWidth=2;
    c.setLineDash(warn&&!a.locked?[8,9]:[]);
    for(const dy of [-SLUICE.halfWidth,SLUICE.halfWidth]){
      c.beginPath();c.moveTo(SLUICE.left,y+dy);c.lineTo(SLUICE.right,y+dy);c.stroke();
    }
    c.setLineDash([]);
    // Mark the flow direction, never a mandatory route. Sparse foam advects
    // inside the same physical band; reduced motion uses static chevrons only.
    const travel=reduced||warn?0:(s.time*110)%(SLUICE.right-SLUICE.left);
    for(let i=0;i<4;i++){
      const offset=(i*145+travel)%(SLUICE.right-SLUICE.left);
      const x=reverse?SLUICE.right-offset:SLUICE.left+offset;
      c.save();c.translate(x,y);if(reverse)c.scale(-1,1);
      c.beginPath();c.moveTo(-10,-6);c.lineTo(0,0);c.lineTo(-10,6);c.stroke();c.restore();
      if(!warn&&!reduced){
        c.globalAlpha=.22;
        sprite(c,Math.floor((s.time+i*.13)/.15)%2?'foam-1':'foam-2',x,y+(i%2?62:-62),reverse);
        c.globalAlpha=.55;
      }
    }
    c.restore();
    const text=reverse?(en?'BACKWASH ←':'역류 ←'):warn?
      (a.locked?(en?'LANE LOCKED →':'수로 고정 →'):(en?'SELECTING LANE →':'방류 수로 선택 →')):
      (a.exposed?(en?'SURGE → hit the brass plate':'방류 → 황동판에 선수 충돌'):(en?'UNLOCKED →':'잠금 해제 →'));
    if(!hud)label(c,text,2720,y-SLUICE.halfWidth-20,color,14);
  }
  for(let i=0;i<3;i++){
    const p=sluiceGate(i),opened=b.parts[i]<=0,exposed=a.exposed&&i===a.lane;
    const motion=impact?.lane===i?sluiceImpactMotion(impact,{opened,reduced,overview,scale:frame?.scale}):null;
    drawSluiceGate(c,p,{opened,exposed,motion,frame});
    label(c,`${String(i+1).padStart(2,'0')} · ${opened?(en?'OPEN':'열림'):exposed?(en?'HIT':'충돌'):en?'LOCKED':'잠김'}`,
      p.x,p.y-124,opened?'#afd4b4':exposed?'#f3cf81':'#a2b4af',13);
    if(exposed){
      // Brackets mark the actual centre tolerance, not a fictitious large hitbox.
      c.strokeStyle='#f1cc75';c.lineWidth=2;
      for(const dy of [-SLUICE.strikeHalfWidth,SLUICE.strikeHalfWidth]){
        c.beginPath();c.moveTo(p.x-48,p.y+dy);c.lineTo(p.x-64,p.y+dy);c.stroke();
      }
    }
    if(!opened){
      const cleat=sluiceCleat(i);sprite(c,'capstan',cleat.x,cleat.y);
      if(b.active&&Math.hypot(s.boat.x-cleat.x,s.boat.y-cleat.y)<130)
        label(c,b.hook===i?(en?'E · release':'E · 놓기'):(en?'E · mooring ring':'E · 계류 고리'),cleat.x,cleat.y+35,'#d8ceb0',13);
    }
  }
}
