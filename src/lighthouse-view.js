import {LIGHTHOUSE,RELAYS,BREAKWATERS,lighthouseStatus,lighthouseRayLength,relayApproach} from './lighthouse-counterplay.js';
const images=Object.fromEntries(['base','head','relay-off','relay-on','breakwater'].map(id=>{
  const image=new Image();image.src=`assets/art/lighthouse-${id}-v1.png`;return [id,image];
}));
function sprite(c,id,x,y,angle=0){
  const img=images[id];if(!img.complete||!img.naturalWidth)return;
  // Contract pivots: the antenna height is not its waterline collision centre.
  // Every frame is authored at four pixels per world unit, including padding.
  const pivot={base:[319.5129,243.4725],head:[129.2584,140.9286],
    'relay-off':[136,234.4],'relay-on':[136,234.4],breakwater:[236,156]}[id],scale=.25;
  c.save();c.translate(x,y);c.rotate(angle);
  c.drawImage(img,-pivot[0]*scale,-pivot[1]*scale,img.naturalWidth*scale,img.naturalHeight*scale);c.restore();
}
export function drawLighthouse(c,s,{label,reduced=false,language='ko'}={}){
  const b=s.boss,l=b.lighthouse,p=s.map.boss,a=lighthouseStatus(s),en=language==='en';
  c.save();
  if(b.active&&!b.cleared&&b.phase==='warn'){
    // The visible beam uses the same occluders as detection, including their
    // first surface. Cover never merely paints an opaque rectangle over light.
    c.beginPath();c.moveTo(p.x,p.y);
    for(let i=0;i<=32;i++){
      const angle=b.aim-LIGHTHOUSE.spread+LIGHTHOUSE.spread*2*i/32,r=lighthouseRayLength(s,angle);
      c.lineTo(p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r);
    }
    c.closePath();c.fillStyle='#f0d99d22';c.fill();
    if(a.exposure>0){
      c.strokeStyle='#edb779';c.lineWidth=3;c.beginPath();
      c.arc(s.boat.x,s.boat.y,48,-Math.PI/2,-Math.PI/2+Math.PI*2*a.exposure/a.detection);c.stroke();
    }
  }
  if(b.active&&!b.cleared&&b.phase==='attack'&&l.target){
    const t=l.target;
    if(!l.impact){
      c.strokeStyle='#f29f71';c.fillStyle='#d05e4424';c.lineWidth=2;
      c.beginPath();c.arc(t.x,t.y,LIGHTHOUSE.radius,0,Math.PI*2);c.fill();c.stroke();
      const left=Math.max(0,b.timer-LIGHTHOUSE.impactTail)/(LIGHTHOUSE.warning-LIGHTHOUSE.impactTail);
      c.lineWidth=3;c.beginPath();c.arc(t.x,t.y,LIGHTHOUSE.radius+6,-Math.PI/2,-Math.PI/2+Math.PI*2*left);c.stroke();
      label(c,en?'LOCKED · leave the circle':'표적 고정 · 원 밖으로',t.x,t.y-85,'#f2bc8b',14);
    }else if(!reduced){
      const age=Math.max(0,s.time-l.impactAt);
      c.strokeStyle='#f7dbb5';c.globalAlpha=Math.max(0,1-age/.25);c.lineWidth=5;
      c.beginPath();c.arc(t.x,t.y,20+age*200,0,Math.PI*2);c.stroke();c.globalAlpha=1;
    }
  }
  for(const cover of BREAKWATERS)sprite(c,'breakwater',cover.x,cover.y);
  for(let i=0;i<RELAYS.length;i++){
    const r=RELAYS[i],sent=b.parts[i]===0,near=Math.hypot(s.boat.x-r.x,s.boat.y-r.y)<180;
    sprite(c,sent?'relay-on':'relay-off',r.x,r.y);
    label(c,`${String(i+1).padStart(2,'0')} · ${sent?(en?'ACKNOWLEDGED':'수신 확인'):en?'RELAY':'중계기'}`,r.x,r.y-48,sent?'#afd8ad':'#e5d3a2',13);
    if(!sent&&near){
      const dock=relayApproach(s,i),angle=dock.angle;
      c.strokeStyle=b.hook===i?'#bddaba':'#bcac80';c.lineWidth=2;
      c.save();c.translate(dock.x,dock.y);c.rotate(angle);
      c.beginPath();c.moveTo(-15,-10);c.lineTo(15,0);c.lineTo(-15,10);c.stroke();c.restore();
      const action=b.phase==='attack'&&!l.impact?(en?'Leave the circle':'원 밖으로 회피'):
        a.towBlocked?(en?'T · release supply tow':'T · 보급정 견인 분리'):
        b.hook===i?(en?'Bow toward lighthouse · brake':'선수를 등대로 · 감속'):
        a.index===i&&a.canConnect?(en?'E · connect cable':'E · 케이블 접속'):(en?'Approach the relay':'중계기에 접근');
      label(c,action,r.x,r.y+57,'#e4d5ae',13);
    }
    if(l.progress[i]>0&&!sent){
      c.fillStyle='#102c31';c.fillRect(r.x-25,r.y+29,50,5);
      c.fillStyle='#bed9af';c.fillRect(r.x-25,r.y+29,50*l.progress[i]/LIGHTHOUSE.signalTime,5);
    }
  }
  sprite(c,'base',p.x,p.y);
  // The beam's actual angle stays live under reduced motion; it is gameplay.
  sprite(c,'head',p.x,p.y,b.cleared?Math.atan2(s.map.exit.y-p.y,s.map.exit.x-p.x):b.aim);
  label(c,b.cleared?(en?'RETURN LIGHT RESTORED':'귀항등 복구'):(en?'LIGHTHOUSE WARDEN':'등대지기'),p.x,p.y-95,b.cleared?'#b8d8ac':'#ead6a9',17);
  if(b.cleared){
    c.strokeStyle='#b2d3a65c';c.lineWidth=4;c.setLineDash([7,12]);
    c.beginPath();c.moveTo(p.x+85,p.y);c.lineTo(s.map.exit.x-65,s.map.exit.y);c.stroke();
    c.setLineDash([]);
  }
  c.restore();
}
