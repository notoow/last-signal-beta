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
// Only the active relay objective owns this cue. Planned quays, rescue and
// final docking keep their own world/edge markers.
export function lighthouseConnectionMarker(s,task,language='ko'){
  const a=lighthouseStatus(s),target=task?.target;
  if(!s.boss.active||s.boss.cleared||a.pendingImpact||a.index<0||!target||task.planSite||task.planBoss||task.rescue)return null;
  const relay=RELAYS[a.index],point=a.linked?relay:relayApproach(s,a.index);
  if(target.x!==point.x||target.y!==point.y)return null;
  const number=String(a.index+1).padStart(2,'0'),en=language==='en';
  return {index:a.index,point,relay,linked:a.linked,canConnect:a.canConnect,color:'#8de1e3',
    text:`${number} · ${a.linked?(en?'CONNECTED':'접속 중'):(en?'LINK POINT':'접속 위치')}`};
}
export function drawLighthouse(c,s,{label,reduced=false,language='ko',task=null}={}){
  const b=s.boss,l=b.lighthouse,p=s.map.boss,a=lighthouseStatus(s),en=language==='en';
  const marker=lighthouseConnectionMarker(s,task,language);
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
    const t=l.target,transform=c.getTransform(),scale=Math.hypot(transform.a,transform.b)/Math.min(globalThis.devicePixelRatio||1,2);
    if(a.pendingImpact){
      // Stroke weight stays readable on small screens. The circle and capsule
      // paths remain the exact world geometry used by hullHitsCircle.
      c.fillStyle='#d05e4424';c.beginPath();c.arc(t.x,t.y,LIGHTHOUSE.radius,0,Math.PI*2);c.fill();
      c.strokeStyle='#071c20';c.lineWidth=5/scale;c.stroke();c.strokeStyle='#f29f71';c.lineWidth=2/scale;c.stroke();
      const left=Math.min(1,a.impactIn/(LIGHTHOUSE.warning-LIGHTHOUSE.impactTail));
      c.lineWidth=3/scale;c.beginPath();c.arc(t.x,t.y,LIGHTHOUSE.radius+6/scale,-Math.PI/2,-Math.PI/2+Math.PI*2*left);c.stroke();
      const boat=s.boat,r=boat.width/2,end=(boat.length-boat.width)/2;
      c.save();c.translate(boat.x,boat.y);c.rotate(boat.angle);c.beginPath();
      c.moveTo(-end,-r);c.lineTo(end,-r);c.arc(end,0,r,-Math.PI/2,Math.PI/2);
      c.lineTo(-end,r);c.arc(-end,0,r,Math.PI/2,Math.PI*1.5);c.closePath();
      c.strokeStyle='#071c20';c.lineWidth=6/scale;c.stroke();c.strokeStyle=a.targetThreatensHull?'#ffd19a':'#d4e6e8';c.lineWidth=2.5/scale;c.stroke();c.restore();
      label(c,`${en?'Impact':'착탄'} ${a.impactIn.toFixed(1)}${en?'s':'초'}`,t.x,t.y-LIGHTHOUSE.radius-16/scale,'#f2bc8b',14);
    }else if(l.impact&&!reduced){
      const age=Math.max(0,s.time-l.impactAt);
      c.strokeStyle='#f7dbb5';c.globalAlpha=Math.max(0,1-age/.25);c.lineWidth=5;
      c.beginPath();c.arc(t.x,t.y,20+age*200,0,Math.PI*2);c.stroke();c.globalAlpha=1;
    }else if(l.impact){
      c.strokeStyle='#f7dbb5';c.lineWidth=2/scale;c.beginPath();c.arc(t.x,t.y,LIGHTHOUSE.radius,0,Math.PI*2);c.stroke();
    }
  }
  for(const cover of BREAKWATERS)sprite(c,'breakwater',cover.x,cover.y);
  for(let i=0;i<RELAYS.length;i++){
    const r=RELAYS[i],sent=b.parts[i]===0;
    sprite(c,sent?'relay-on':'relay-off',r.x,r.y);
    label(c,`${String(i+1).padStart(2,'0')} · ${sent?(en?'ACKNOWLEDGED':'수신 확인'):en?'RELAY':'중계기'}`,r.x,r.y-48,sent?'#afd8ad':'#e5d3a2',13);
    if(marker?.index===i){
      const transform=c.getTransform(),scale=Math.hypot(transform.a,transform.b)/Math.min(globalThis.devicePixelRatio||1,2),dock=relayApproach(s,i);
      // Open cyan corners identify a connection point; the orange danger
      // circle remains an exact collision area. Both retain screen stroke size.
      c.save();c.strokeStyle=marker.color;c.lineWidth=1.5/scale;c.setLineDash([3/scale,5/scale]);
      c.beginPath();c.moveTo(dock.x,dock.y);c.lineTo(r.x,r.y);c.stroke();c.setLineDash([]);
      c.translate(marker.point.x,marker.point.y);c.rotate(dock.angle);
      const size=18/scale,arm=7/scale;c.beginPath();
      for(const x of [-1,1])for(const y of [-1,1]){c.moveTo(x*(size-arm),y*size);c.lineTo(x*size,y*size);c.lineTo(x*size,y*(size-arm));}
      c.strokeStyle='#071c20';c.lineWidth=4/scale;c.stroke();c.strokeStyle=marker.color;c.lineWidth=2/scale;c.stroke();
      c.beginPath();c.moveTo(size+3/scale,-4/scale);c.lineTo(size+8/scale,0);c.lineTo(size+3/scale,4/scale);c.stroke();c.restore();
      label(c,marker.text,marker.point.x,marker.point.y+34/scale,marker.color,13);
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
  return marker;
}
