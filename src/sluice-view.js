import {SLUICE,sluiceGate,sluiceCleat,sluiceStatus} from './sluice-counterplay.js';
const sprites=Object.fromEntries(['gate-closed','gate-exposed','gate-open','capstan','foam-1','foam-2'].map(id=>{
  const image=new Image();image.src='assets/art/sluice-'+id+'-v1.png';return [id,image];
}));
function sprite(c,id,x,y,flip=false){
  const img=sprites[id];if(!img.complete||!img.naturalWidth)return;
  const scale=id.startsWith('gate')?220/676:id==='capstan'?36/235:100/447;
  c.save();c.translate(x,y);if(flip)c.scale(-1,1);
  c.drawImage(img,-img.naturalWidth*scale/2,-img.naturalHeight*scale/2,img.naturalWidth*scale,img.naturalHeight*scale);c.restore();
}
export function drawSluice(c,s,{label,reduced=false,language='ko'}={}){
  const b=s.boss,a=sluiceStatus(s),en=language==='en';
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
    label(c,text,2720,y-SLUICE.halfWidth-20,color,14);
  }
  for(let i=0;i<3;i++){
    const p=sluiceGate(i),opened=b.parts[i]<=0,exposed=a.exposed&&i===a.lane;
    sprite(c,opened?'gate-open':exposed?'gate-exposed':'gate-closed',p.x,p.y);
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
