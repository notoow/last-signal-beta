import {touchText} from './mobile-touch-text.js';
import {mobileLabelFits} from './mobile-presentation.js';
import {gameArt} from './game-art.js';
import {DEPTHS,waterAt} from './rogue-map.js';
import {drawHarborTerrain} from './harbor-terrain.js';
import {workSprite,workRope} from './harbor-work-art.js';
import {objective,partPosition,berthReadiness,berthAlignment,GEAR} from './rogue-core.js';
import {dockHint} from './docking-readiness.js';
import {dockAlignmentPresentation} from './rogue-hud.js';
import {crewImage} from './departure-art.js';
import {drawCaptainBoat} from './captain-fleet.js';
import {drawShoreEncounter} from './shore-animation.js';
import {FLOOR_TOOLS,SHORE_SITES,toolBerth,hasTool} from './shore-encounters.js';
import {drawSurvey,visibleAt} from './rogue-vision.js';
import {playCamera,edgeMarker} from './rogue-camera.js';
import {waterMotion,waterVelocity} from './ship-motion.js';
import {towBow,tugStern} from './rogue-tow.js';
import {floatPose,drawWake} from './sea-surface.js';
import {quaySprite} from './quay-details.js';
import {usesDredger,CRANE,craneLockTime} from './dredger-counterplay.js';
import {usesSluice,SLUICE} from './sluice-counterplay.js';
import {drawSluice} from './sluice-view.js';
import {usesLighthouse} from './lighthouse-counterplay.js';
import {drawLighthouse} from './lighthouse-view.js';
import {harborPlan} from './harbor-plan.js';
import {rescueStatus} from './shore-rescue.js';
const load=file=>{const img=new Image();img.src='assets/art/'+file;return img;};
const bosses=load('rogue-bosses-v1.png');
const shoreProps=load('rogue-shore-props-v1.png');
const dredgerArt=Object.fromEntries(['bucket-raised','bucket-falling','bucket-impact','winch-intact','winch-damaged','winch-destroyed','impact-fx-1','impact-fx-2','impact-fx-3'].map(id=>[id,load('dredger-'+id+'-v1.png')]));
const ready=i=>i.complete&&i.naturalWidth>0;
function prop(c,kind,x,y,w,h,flip=false){
  if(!ready(shoreProps))return;
  const f={dog:[165,50,500,365],chest:[885,90,465,318],station:[225,420,520,550],buoy:[940,460,315,520]}[kind];
  const scale=Math.min(w/f[2],h/f[3]),dw=f[2]*scale,dh=f[3]*scale;
  c.save();c.translate(x,y);if(flip)c.scale(-1,1);c.drawImage(shoreProps,...f,-dw/2,-dh,dw,dh);c.restore();
}
function canvasLabel(c,text,x,y,color='#f1e6c4',size=15){
  text=touchText(text);
  const t=c.getTransform(),scale=Math.hypot(t.a,t.b)/Math.min(devicePixelRatio||1,2);
  c.font=`600 ${size/scale}px Pretendard, sans-serif`;c.textAlign='center';c.lineWidth=4/scale;c.strokeStyle='#071c20';if(!mobileLabelFits(c,text,x,y,size))return;
  c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);
}
function ring(c,p,r,color){c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();}
const dockFrames=new WeakMap();
export const lastRogueDocking=canvas=>dockFrames.get(canvas)||null;
const dockOverlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function dockGeometry(c,a,scale){
  const p=a.boat,t=a.berth,r=a.limits.distance,color=a.status.ready?'#a4d7b3':'#95d1df';
  c.save();c.lineWidth=1.5/scale;c.strokeStyle=color;c.fillStyle=a.status.ready?'#a4d7b318':'#95d1df0c';
  c.setLineDash(a.checks.position?[]:[5/scale,4/scale]);c.beginPath();c.arc(t.x,t.y,r,0,Math.PI*2);c.fill();c.stroke();
  c.setLineDash([]);c.beginPath();c.moveTo(t.x-4/scale,t.y);c.lineTo(t.x+4/scale,t.y);c.moveTo(t.x,t.y-4/scale);c.lineTo(t.x,t.y+4/scale);c.stroke();
  // The single arrow outside the circle is the required bow direction. The
  // circle itself remains exactly the canonical centre-distance boundary.
  c.save();c.translate(t.x,t.y);c.rotate(t.angle);c.lineWidth=2/scale;
  c.beginPath();c.moveTo(r+5/scale,0);c.lineTo(r+27/scale,0);c.lineTo(r+19/scale,-5/scale);c.moveTo(r+27/scale,0);c.lineTo(r+19/scale,5/scale);c.stroke();c.restore();
  if(!a.checks.position){c.strokeStyle='#e8f2f099';c.setLineDash([3/scale,5/scale]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(t.x,t.y);c.stroke();c.setLineDash([]);}
  // Actual velocity, never the direction requested by a steering key.
  const speed=Math.hypot(p.vx,p.vy);
  if(speed>.75){
    const length=Math.min(48,speed*.8)*scale+10,angle=Math.atan2(p.vy,p.vx);
    c.save();c.translate(p.x,p.y);c.rotate(angle);c.strokeStyle='#edf2ed';c.lineWidth=1.5/scale;
    c.beginPath();c.moveTo(6/scale,0);c.lineTo(length/scale,0);c.lineTo((length-6)/scale,-3/scale);c.moveTo(length/scale,0);c.lineTo((length-6)/scale,3/scale);c.stroke();c.restore();
  }
  c.fillStyle='#f3f1e8';c.strokeStyle='#10171c';c.lineWidth=2/scale;
  c.beginPath();c.arc(p.x,p.y,4/scale,0,Math.PI*2);c.fill();c.stroke();c.restore();
}
function dockPanel(c,a,frame,presentation,s,language){
  const point=p=>({x:p.x*frame.scale+frame.ox,y:p.y*frame.scale+frame.oy}),t=point(a.berth),p=point(a.boat),r=a.limits.distance*frame.scale;
  const rect=(x,y,w,h)=>({x,y,w,h}),pad=16,v=frame.viewport;
  const hullRadius=(Math.hypot(s.boat.length,s.boat.width)/2+5)*frame.scale;
  const hull=rect(p.x-hullRadius,p.y-hullRadius,hullRadius*2,hullRadius*2),marker=rect(t.x-r-32,t.y-r-32,r*2+64,r*2+64);
  const enemies=(s.combat?.enemies||[]).filter(e=>e.hp>0&&visibleAt(s,e)).map(e=>{
    const q=point(e),size=({gull:72,crab:90,dog:60,rat:40}[e.kind]||50)*frame.scale;
    return rect(q.x-size*.55,q.y-size,size*1.1,size*1.25);
  });
  const width=Math.min(376,v.w-16),font=14,lines=[];
  if(width<290)return null;
  c.save();c.font=`600 ${font}px Pretendard, sans-serif`;
  let line='';for(const word of presentation.hint.split(' ')){
    const next=line?line+' '+word:word;
    if(c.measureText(next).width>width-24&&line){lines.push(line);line=word;}else line=next;
  }if(line)lines.push(line);
  c.font='500 14px Pretendard, sans-serif';
  let checkX=0,checkRow=0;
  const checkLabels=presentation.checks.map(check=>{
    const arrow=check.id==='spin'&&!check.ok?(a.boat.omega>0?' ↻':' ↺'):'';
    const text=(check.ok?'✓ ':'○ ')+check.label+arrow,w=c.measureText(text).width;
    if(checkX+w>width-24&&checkX){checkX=0;checkRow++;}
    const item={...check,text,w,x:checkX,row:checkRow};checkX+=w+16;return item;
  });
  const hintY=28+(checkRow+1)*24,height=hintY+lines.length*19+8;
  const left=Math.min(hull.x,marker.x),right=Math.max(hull.x+hull.w,marker.x+marker.w),top=Math.min(hull.y,marker.y),bottom=Math.max(hull.y+hull.h,marker.y+marker.h);
  const candidates=[rect((p.x+t.x)/2-width/2,bottom+pad,width,height),rect(right+pad,(p.y+t.y)/2-height/2,width,height),rect(left-pad-width,(p.y+t.y)/2-height/2,width,height),rect((p.x+t.x)/2-width/2,top-pad-height,width,height)]
    .map(q=>({...q,x:Math.max(v.x+4,Math.min(v.x+v.w-q.w-4,q.x)),y:Math.max(v.y+4,Math.min(v.y+v.h-q.h-4,q.y))}));
  const blocks=[hull,marker,...enemies,...frame.occupied];
  const panel=candidates.find(q=>!blocks.some(b=>dockOverlap(q,b)));if(!panel){c.restore();return null;}
  c.shadowColor='#00121f';c.shadowBlur=4; // Text stays legible without an opaque panel.
  c.strokeStyle=presentation.ready?'#a4d7b3':'#95d1df';c.lineWidth=2;c.beginPath();c.moveTo(panel.x,panel.y);c.lineTo(panel.x,panel.y+panel.h);c.stroke();
  c.textAlign='left';c.textBaseline='top';c.font='600 12px Pretendard, sans-serif';c.fillStyle='#95d1df';
  c.fillText(presentation.title,panel.x+12,panel.y+9);
  const label=language==='en'?'● Boat centre   → Berth bow':'● 배 중심   → 계류 방향';c.font='400 11px Pretendard, sans-serif';c.fillStyle='#aab9c1';
  c.textAlign='right';c.fillText(label,panel.x+panel.w-12,panel.y+9);c.textAlign='left';
  c.font='500 14px Pretendard, sans-serif';
  const textBounds=[];
  for(const check of checkLabels){
    const x=panel.x+12+check.x,y=panel.y+28+check.row*24,w=check.w;
    c.fillStyle=check.active?'#f3f1e8':check.ok?'#c8dbde':'#aab9c1';c.fillText(check.text,x,y);
    textBounds.push({x,y,w,h:19});
    if(check.ratio!==null){c.fillStyle='#3b5059';c.fillRect(x,y+16,w,2);c.fillStyle=check.ok?'#95d1df':'#e8d9ab';c.fillRect(x,y+16,w*check.ratio/2,2);c.fillStyle='#edf2ed';c.fillRect(x+w/2,y+15,1,4);}
  }
  c.font=`600 ${font}px Pretendard, sans-serif`;c.fillStyle=presentation.tone==='warning'?'#ffbe78':'#f3f1e8';
  lines.forEach((text,i)=>{const x=panel.x+12,y=panel.y+hintY+i*19;c.fillText(text,x,y);textBounds.push({x,y,w:c.measureText(text).width,h:19});});c.restore();
  return {...panel,lines,textBounds,protected:[hull,marker,...enemies]};
}
function net(c,x,y,r=50){c.save();c.translate(x,y);c.rotate(.3);c.strokeStyle='#b4b299';c.lineWidth=1;for(let i=-r;i<=r;i+=12){c.beginPath();c.moveTo(i,-r);c.lineTo(i,r);c.moveTo(-r,i);c.lineTo(r,i);c.stroke();}c.restore();}
function dredgerSprite(c,id,x,y){
  const image=dredgerArt[id];if(!ready(image))return false;
  const fx=id.startsWith('impact-'),bucket=id.startsWith('bucket-');
  const scale=fx?120/423:bucket?60/394:48/428;
  const pivotY=fx?{'impact-fx-1':282.5,'impact-fx-2':290,'impact-fx-3':242}[id]:image.naturalHeight/2;
  c.drawImage(image,x-image.naturalWidth/2*scale,y-pivotY*scale,image.naturalWidth*scale,image.naturalHeight*scale);
  return true;
}
function craneWarning(c,s){
  const b=s.boss,a=b.crane,t=a.target;if(!t||!['warn','attack'].includes(b.phase))return;
  const locked=a.locked,color=locked?'#f39668':'#e5c87f';
  c.save();c.fillStyle=locked?'#bd513426':'#d9b44b14';c.strokeStyle=color;c.lineWidth=locked?3:2;
  c.setLineDash(locked?[]:[7,7]);c.beginPath();c.arc(t.x,t.y,CRANE.radius,0,Math.PI*2);c.fill();c.stroke();
  c.setLineDash([]);c.lineWidth=2;
  // The shrinking outer arc is time to impact, never a second damage radius.
  if(b.phase==='warn'&&locked){c.beginPath();c.arc(t.x,t.y,CRANE.radius+6,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,b.timer)/craneLockTime(s));c.stroke();}
  c.restore();
}
function craneBucket(c,s,reduced){
  const b=s.boss,a=b.crane,t=a.target;if(!t||!['warn','attack'].includes(b.phase))return;
  const age=s.time-a.impactAt;
  let height=b.phase==='warn'?78:0;
  if(b.phase==='warn'&&a.locked&&!reduced)height=78*Math.min(1,Math.max(0,b.timer)/.35);
  const pivot={x:s.map.boss.x-32,y:s.map.boss.y-35},end={x:t.x,y:t.y-height-20};
  workRope(c,pivot,end,1,3);
  dredgerSprite(c,b.phase==='attack'?'bucket-impact':a.locked?'bucket-falling':'bucket-raised',t.x,t.y-height);
  if(b.phase==='attack'&&a.impact&&age>=0&&age<.31&&!reduced)dredgerSprite(c,age<.07?'impact-fx-1':age<.17?'impact-fx-2':'impact-fx-3',t.x,t.y+10);
}
export function rogueCamera(canvas,s,mapOpen=false,options={},previous=null,dt=0,occupied=null){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  const target=s.person?objective(s).target:null;
  const attention=target&&Math.hypot(target.x-s.person.x,target.y-s.person.y)<=260?target:null;
  return playCamera({width,height,world:s.map,focus:s.person||s.boat,partner:s.tow?.connected?s.tow:null,attention,ashore:!!s.person,options,overview:mapOpen,previous,dt,occupied});
}
const frames=new WeakMap();
export const lastRogueCamera=canvas=>frames.get(canvas)?.frame;
export function drawRogue(canvas,s,{reduced=false,mapOpen=false,chartPins=false,camera:settings={},occupied=null,language='ko'}={}){
  // The compact planning chart has accessible DOM pins; world-size action
  // captions would obscure entire quays at this scale.
  const label=chartPins?()=>{}:canvasLabel;
  const old=frames.get(canvas),previous=!reduced&&old?.map===s.map?old.frame:null;
  const frame=rogueCamera(canvas,s,mapOpen,settings,previous,Math.min(.1,Math.max(0,s.time-(old?.time??s.time))),occupied);
  const alignment=mapOpen?null:berthAlignment(s),dockCopy=dockAlignmentPresentation(alignment,language);
  dockFrames.delete(canvas);
  frames.set(canvas,{map:s.map,time:s.time,frame});
  const {width,height,scale,ox,oy}=frame;
  const dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  c.save();c.translate(ox,oy);c.scale(scale,scale);
  gameArt.water(c,s.map.width,s.map.height,reduced?0:s.time);
  if(s.map.version===2){c.fillStyle='#0b293c44';c.fillRect(0,0,s.map.width,s.map.height);}
  // Surface arrows are actual ambient current vectors, not routes.
  const current=waterMotion(s)?waterVelocity(s):s.map.current,a=Math.atan2(current.y,current.x);
  c.strokeStyle='#bfdbce45';c.lineWidth=1.5;
  for(let x=130;mapOpen&&x<s.map.width;x+=280)for(let y=180;y<s.map.height;y+=280){
    if(!waterAt(s.map,{x,y},35))continue;
    c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.moveTo(-12,0);c.lineTo(12,0);c.lineTo(6,-4);c.moveTo(12,0);c.lineTo(6,4);c.stroke();c.restore();
  }
  if(s.map.version===2)drawHarborTerrain(c,s.map,reduced?0:s.time,frame.bounds);
  else for(const island of s.map.islands){
    // Walkable service yard: roof modules are confined to a small back apron.
    gameArt.wall(c,{...island,id:'walkable-quay'});
    if(!['scenery','observation'].includes(island.role))gameArt.wall(c,{id:'service-pump',x:island.x+island.w-130,y:island.y+20,w:112,h:125});
    gameArt.dressing(c,island,reduced?0:s.time,true,s.map.islands);
  }
  for(const berth of s.map.berths){
    const selected=berth.id===s.mooring,docking=berthReadiness(s,berth),ok=docking.ready;
    const aligning=alignment&&!alignment.exit&&alignment.berth.id===berth.id;
    c.strokeStyle=selected||ok?'#a4d7b3':'#d0b875';c.lineWidth=2;
    if(!aligning){c.setLineDash([8,6]);c.strokeRect(berth.x-46,berth.y-19,92,38);c.setLineDash([]);}
    c.beginPath();c.moveTo(berth.landing.x,berth.landing.y);c.lineTo(berth.x,berth.y);c.stroke();
    workSprite(c,'cleat',berth.landing.x,berth.landing.y+13,20,16);
    if(!aligning)label(c,selected?(language==='en'?'Moored':'계류 중'):dockHint(docking,language),berth.x,berth.y+48);
    if(s.combat)label(c,SHORE_SITES[berth.island],berth.landing.x,berth.landing.y-30,'#c4cbb8',15);
    if(!s.claimed.includes(berth.id)&&visibleAt(s,berth.loot)){
      const l=berth.loot;prop(c,'chest',l.x,l.y+9,28,21);
      const island=s.map.islands[berth.island],counter=s.combat&&berth.id===toolBerth(s).id&&!hasTool(s,FLOOR_TOOLS[s.depth].id);
      // The chest remains in the world; its work label matters only on foot
      // when it is the current target, not behind the sailing HUD.
      if(s.person&&objective(s).target===l)label(c,counter?'정비 기록 · 수색':s.combat?'봉인된 보급 상자':GEAR[island.equipment],l.x,l.y-20,'#f3d99d',13);
      if(s.work&&s.mode==='ashore'&&selected){c.fillStyle='#eacb83';c.fillRect(l.x-20,l.y+18,40*s.work/1.8,3);}
    }
  }
  for(const dog of s.combat?[]:s.dogs){
    prop(c,'dog',dog.x,dog.y+5,27,20,(s.noise?.left>0?s.noise.x:s.person?.x??dog.homeX)<dog.x);
    if(dog.alert)label(c,'!',dog.x,dog.y-15,'#eea17b',18);
  }
  if(s.noise?.left>0)ring(c,s.noise,15+(reduced?0:(s.time*12)%25),'#d3cbb37a');
  if(!s.netResolved){net(c,2110,500);label(c,'폐어망 · F 회수 / X 절단',2110,430,'#d5caa1',13);}
  if(s.debris&&s.depth>0){net(c,2070,350,85);label(c,'떠밀려온 폐어망',2070,240,'#d5caa1',13);}
  if(s.depth===2&&s.map.secret){
    prop(c,'station',2080,175,95,100);prop(c,'buoy',2180,205,18,30);
    label(c,s.secretFound?'백야 관측소 · 영구 폐쇄':'봉쇄된 관측소 · E',2080,78,'#c9bc95',13);
  }
  const boss=s.boss,p=s.map.boss;
  const dredger=usesDredger(s);
  const sluice=usesSluice(s);
  const lighthouse=usesLighthouse(s);
  if(sluice)drawSluice(c,s,{label,reduced,language});
  if(lighthouse)drawLighthouse(c,s,{label,reduced,language});
  if(dredger&&boss.active&&!boss.cleared)craneWarning(c,s);
  if(!dredger&&!sluice&&!lighthouse&&boss.active&&!boss.cleared&&(boss.phase==='warn'||boss.phase==='attack')){
    c.fillStyle=boss.phase==='attack'?'#c44e3a70':'#e3ad3d35';c.strokeStyle=boss.phase==='attack'?'#ed7459':'#e4c682';c.lineWidth=2;
    if(s.depth===1){const y=p.y+Math.sin(boss.aim)*220;c.fillRect(2220,y-70,1180,140);c.strokeRect(2220,y-70,1180,140);}
    else{const spread=s.depth===0?.46:.23,r=s.depth===0?360:620;c.beginPath();c.moveTo(p.x,p.y);c.arc(p.x,p.y,r,boss.aim-spread,boss.aim+spread);c.closePath();c.fill();c.stroke();}
  }
  if(!sluice&&!lighthouse&&ready(bosses)){
    const frames=[[12,80,1230,308],[12,500,1230,296],[12,840,1230,350]],f=frames[s.depth],h=340*f[3]/f[2];
    c.save();c.globalAlpha=boss.cleared?.52:1;c.drawImage(bosses,...f,p.x-170,p.y-h/2,340,h);c.restore();
  }else if(!sluice&&!lighthouse)gameArt.boat(c,{...p,angle:0,length:340,width:140},'inspection');
  if(!sluice&&!lighthouse)label(c,DEPTHS[s.depth].boss,p.x,p.y-100,boss.cleared?'#8ab4a0':'#f1e6c4',22);
  if(!sluice&&!lighthouse&&(!boss.cleared||dredger))boss.parts.forEach((hp,i)=>{
    const part=partPosition(s,i);
    if(dredger){
      const mount={x:p.x-85,y:p.y+(i===0?24:-24)},dx=part.x-mount.x,dy=part.y-mount.y;
      workSprite(c,'gangway',(mount.x+part.x)/2,(mount.y+part.y)/2,Math.hypot(dx,dy)+28,25,Math.atan2(dy,dx));
      workSprite(c,'dock',part.x,part.y+7,48,37);
      dredgerSprite(c,hp<=0?'winch-destroyed':hp<30?'winch-damaged':'winch-intact',part.x,part.y);
      if(boss.active&&!boss.cleared)label(c,language==='en'?(i===0?'Intake pump':'Crane drive'):(i===0?'흡입 펌프':'크레인 구동부'),part.x,part.y-38,hp<=0?'#9bada2':'#f1e6c4',13);
    }else ring(c,part,11,hp<=0?'#6a7771':boss.phase==='recover'?'#e8ce7d':'#856862');
    c.fillStyle=hp<=0?'#6a7771':'#e0c589';c.fillRect(part.x-14,part.y+18,28*hp/30,3);
    if(boss.phase==='recover'&&hp>0)label(c,'E',part.x,part.y-16,'#f6dda2',15);
  });
  if(boss.hook>=0){
    const part=partPosition(s,boss.hook),locked=s.captain==='jeong'&&s.skill.left>0;
    workRope(c,part,s.boat,boss.tension,locked?5:3.8);
    if(locked)label(c,language==='en'?(lighthouse?'Rotation held · keep tension':sluice?'Hold surge · keep tension':'Bound · keep tension'):(lighthouse?'회전 잠금 · 장력 유지':sluice?'방류 유지 · 장력 유지':'결박 · 장력 유지'),part.x,part.y-65,'#f3ce8f',14);
  }
  if(s.skill.decoy&&s.skill.left>0){
    const decoy=s.skill.decoy;prop(c,'buoy',decoy.x,decoy.y+10,18,34);
    const tracking=boss.phase==='warn'&&(lighthouse||boss.timer>(dredger?craneLockTime(s):sluice?SLUICE.lockTime:1.2));
    ring(c,decoy,20,'#a7e3d9');label(c,tracking?'미끼 부표 · 조준 유도':'미끼 부표 · 조준 고정',decoy.x,decoy.y-38,'#b9e9de',13);
    if(tracking){c.save();c.strokeStyle='#b9e9de88';c.setLineDash([5,7]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(decoy.x,decoy.y);c.stroke();c.restore();}
  }
  if(!alignment?.exit){c.save();c.translate(s.map.exit.x,s.map.exit.y);c.rotate(s.map.exit.angle);c.strokeStyle=boss.cleared?'#afdcaf':'#667d79';c.lineWidth=3;c.strokeRect(-50,-24,100,48);c.restore();}
  if(!alignment?.exit)label(c,boss.cleared?dockHint(berthReadiness(s,s.map.exit),language,true):language==='en'?
    (lighthouse?'Lighthouse berth · acknowledge all 3 relays':sluice?'Exit berth · open all 3 gates':'Exit berth · stop the drives'):
    (lighthouse?'등대 부두 · 명부 3개 수신 확인 필요':sluice?'탈출 부두 · 수문 3개 개방 필요':'탈출 부두 · 구동부 정지 필요'),s.map.exit.x-40,s.map.exit.y+85);
  if(s.mode!=='sailing'){const berth=s.map.berths.find(b=>b.id===s.mooring);workRope(c,{x:s.boat.x-20,y:s.boat.y},berth.landing,.25,3.2);}
  if(s.tow&&visibleAt(s,s.tow)&&s.tow.hp>0){
    const t=s.tow;drawWake(c,t,s.time,reduced);gameArt.boat(c,floatPose(t,reduced?0:s.time,!!t.anchor),'inspection');
    if(t.connected)workRope(c,tugStern(s.boat),towBow(t),t.tension,3.3);
    if(t.anchor){workRope(c,towBow(t),{x:t.anchor.x,y:t.anchor.y+36},.55,2);quaySprite(c,'anchor',t.anchor.x-6,t.anchor.y+27,13,24);}
    label(c,language==='en'?(t.connected?'T Release · H '+(t.anchor?'Raise anchor':'Drop anchor'):'Supply boat · T Tow / H Anchor'):
      t.connected?'T 분리 · H 닻 '+(t.anchor?'올리기':'내리기'):'보급정 · T 견인 / H 닻',t.x,t.y-43,'#e6d6a9',13);
  }
  drawWake(c,s.boat,s.time,reduced);
  drawCaptainBoat(c,floatPose(s.boat,reduced?0:s.time,s.mode!=='sailing'),s.captain,s.paint);
  if(dredger&&boss.active&&(!boss.cleared||s.time-boss.crane.impactAt<.31))craneBucket(c,s,reduced);
  if(s.skill.left>0&&s.captain==='woo'){
    const b=s.boat;workRope(c,b,{x:b.x-42,y:b.y+29},.55,2.4);quaySprite(c,'anchor',b.x-49,b.y+20,15,28);
    label(c,language==='en'?'Emergency brace · damage −75%':'비상 버팀 · 피해 −75%',b.x,b.y-45,'#d0dac5',13);
  }
  if(s.skill.left>0&&s.captain==='park'){
    const b=s.boat,v=s.skill.vector;c.strokeStyle='#cee8e5bb';c.lineWidth=3;c.beginPath();for(const d of [-9,0,9]){c.moveTo(b.x-v.x*30+v.y*d,b.y-v.y*30-v.x*d);c.lineTo(b.x-v.x*80+v.y*d,b.y-v.y*80-v.x*d);}c.stroke();
  }
  drawShoreEncounter(c,s,reduced);
  const rescued=rescueStatus(s);
  if(rescued?.active&&visibleAt(s,rescued.point)&&!mapOpen&&(!s.person||rescued.distance>70)){
    label(c,language==='en'?'Mechanic':'정비공',rescued.point.x,rescued.point.y-62,'#f6d9a0',12);
  }
  if(s.person&&!s.combat){
    c.fillStyle='#071d2077';c.beginPath();c.ellipse(s.person.x,s.person.y+2,9,4,0,0,7);c.fill();
    const {image:sprite,frame:f}=crewImage(s.captain);
    if(ready(sprite)){const w=37*f[2]/f[3];c.drawImage(sprite,...f,s.person.x-w/2,s.person.y-33,w,37);}
    label(c,s.captain[0].toUpperCase()+s.captain.slice(1),s.person.x,s.person.y-38,'#f1e6c4',12);
  }
  drawSurvey(c,s);
  if(mapOpen&&s.survey&&!chartPins){
    const plan=harborPlan(s),siteNames=language==='en'?['Shipbreaking yard','Fuel quay','Fish-market jetty']:SHORE_SITES;
    for(const b of s.map.berths){
      const site=plan?.sites.find(x=>x.id===b.id);
      if(plan&&!site.known&&!site.radio)continue;
      label(c,(site?.selected?'◆ ':site?.claimed?'✓ ':'')+siteNames[b.island],b.x,b.y+48,site?.selected?'#f0d98f':'#b6bda9',20);
    }
    label(c,language==='en'?'Exit berth · radio coordinates':'탈출 부두 · 무전 좌표',s.map.exit.x-100,s.map.exit.y+75,'#c9c2a7',20);
    ring(c,s.person||s.boat,20,'#f0d98f');
  }
  const task=objective(s),target=task.target;
  const alignedTarget=alignment&&target&&target.x===alignment.berth.x&&target.y===alignment.berth.y;
  if(target&&!alignedTarget)ring(c,target,task.rescue&&target===s.rescue?16:s.mode==='ashore'?32:42,'#ebd59e');
  if(alignment)dockGeometry(c,alignment,scale);
  c.restore();
  const panel=alignment?dockPanel(c,alignment,frame,dockCopy,s,language):null;
  canvas.dataset.dockPanel=String(!!panel);
  if(alignment)dockFrames.set(canvas,{berth:alignment.berth,boat:alignment.boat,worldRadius:alignment.limits.distance,radius:alignment.limits.distance*scale,
    centre:{x:alignment.berth.x*scale+ox,y:alignment.berth.y*scale+oy},presentation:dockCopy,panel,oldTargetRingSuppressed:!!alignedTarget});
  if(!mapOpen){
    const points=[];
    if(target)points.push({p:target,text:task.rescue?(language==='en'?'Escort / ladder':'정비공 / 사다리'):task.planSite?(language==='en'?'Planned quay':'선택한 부두'):task.planBoss?(language==='en'?'Outer approach':'바깥 해역 입구'):language==='en'?(s.person?'Search / return':'Target'):(s.person?'수색 / 귀환':'목표'),color:'#f6dda2'});
    if(s.tow?.connected&&!s.person)points.push({p:s.tow,text:language==='en'?'Supply tow':'견인선',color:'#adc8c3'});
    if(!sluice&&!lighthouse&&s.boss.active&&!s.boss.cleared)points.push({p:s.map.boss,text:boss.phase==='warn'?'보스 · 공격 예고':'보스',color:boss.phase==='warn'?'#f4ad7d':'#e4ca9b'});
    for(const {p,text,color} of points){
      const mark=edgeMarker(frame,p);if(!mark)continue;
      c.save();c.translate(mark.x,mark.y);c.rotate(mark.angle);c.fillStyle=color;
      c.beginPath();c.moveTo(11,0);c.lineTo(-7,-6);c.lineTo(-7,6);c.closePath();c.fill();c.restore();
      label(c,text,Math.max(74,Math.min(width-74,mark.x)),mark.y-17,color,12);
    }
  }
  return frame;
}
