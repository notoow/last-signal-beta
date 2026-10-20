import {gameArt} from './game-art.js';
import {DEPTHS,waterAt} from './rogue-map.js';
import {drawHarborTerrain} from './harbor-terrain.js';
import {workSprite,workRope} from './harbor-work-art.js';
import {objective,partPosition,berthReadiness,GEAR} from './rogue-core.js';
import {dockHint} from './docking-readiness.js';
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
const load=file=>{const img=new Image();img.src='assets/art/'+file;return img;};
const bosses=load('rogue-bosses-v1.png');
const shoreProps=load('rogue-shore-props-v1.png');
const ready=i=>i.complete&&i.naturalWidth>0;
function prop(c,kind,x,y,w,h,flip=false){
  if(!ready(shoreProps))return;
  const f={dog:[165,50,500,365],chest:[885,90,465,318],station:[225,420,520,550],buoy:[940,460,315,520]}[kind];
  const scale=Math.min(w/f[2],h/f[3]),dw=f[2]*scale,dh=f[3]*scale;
  c.save();c.translate(x,y);if(flip)c.scale(-1,1);c.drawImage(shoreProps,...f,-dw/2,-dh,dw,dh);c.restore();
}
function label(c,text,x,y,color='#f1e6c4',size=15){
  const t=c.getTransform(),scale=Math.hypot(t.a,t.b)/Math.min(devicePixelRatio||1,2);
  c.font=`600 ${size/scale}px Pretendard, sans-serif`;c.textAlign='center';c.lineWidth=4/scale;c.strokeStyle='#071c20';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);
}
function ring(c,p,r,color){c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();}
function net(c,x,y,r=50){c.save();c.translate(x,y);c.rotate(.3);c.strokeStyle='#b4b299';c.lineWidth=1;for(let i=-r;i<=r;i+=12){c.beginPath();c.moveTo(i,-r);c.lineTo(i,r);c.moveTo(-r,i);c.lineTo(r,i);c.stroke();}c.restore();}
export function rogueCamera(canvas,s,mapOpen=false,options={},previous=null,dt=0,occupied=null){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  const target=s.person?objective(s).target:null;
  const attention=target&&Math.hypot(target.x-s.person.x,target.y-s.person.y)<=260?target:null;
  return playCamera({width,height,world:s.map,focus:s.person||s.boat,partner:s.tow?.connected?s.tow:null,attention,ashore:!!s.person,options,overview:mapOpen,previous,dt,occupied});
}
const frames=new WeakMap();
export const lastRogueCamera=canvas=>frames.get(canvas)?.frame;
export function drawRogue(canvas,s,{reduced=false,mapOpen=false,camera:settings={},occupied=null,language='ko'}={}){
  const old=frames.get(canvas),previous=!reduced&&old?.map===s.map?old.frame:null;
  const frame=rogueCamera(canvas,s,mapOpen,settings,previous,Math.min(.1,Math.max(0,s.time-(old?.time??s.time))),occupied);
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
    c.strokeStyle=selected||ok?'#a4d7b3':'#d0b875';c.lineWidth=2;c.setLineDash([8,6]);c.strokeRect(berth.x-46,berth.y-19,92,38);c.setLineDash([]);
    c.beginPath();c.moveTo(berth.landing.x,berth.landing.y);c.lineTo(berth.x,berth.y);c.stroke();
    workSprite(c,'cleat',berth.landing.x,berth.landing.y+13,20,16);
    label(c,selected?(language==='en'?'Moored':'계류 중'):dockHint(docking,language),berth.x,berth.y+48);
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
  if(boss.active&&!boss.cleared&&(boss.phase==='warn'||boss.phase==='attack')){
    c.fillStyle=boss.phase==='attack'?'#c44e3a70':'#e3ad3d35';c.strokeStyle=boss.phase==='attack'?'#ed7459':'#e4c682';c.lineWidth=2;
    if(s.depth===1){const y=p.y+Math.sin(boss.aim)*220;c.fillRect(2220,y-70,1180,140);c.strokeRect(2220,y-70,1180,140);}
    else{const spread=s.depth===0?.46:.23,r=s.depth===0?360:620;c.beginPath();c.moveTo(p.x,p.y);c.arc(p.x,p.y,r,boss.aim-spread,boss.aim+spread);c.closePath();c.fill();c.stroke();}
  }
  if(ready(bosses)){
    const frames=[[12,80,1230,308],[12,500,1230,296],[12,840,1230,350]],f=frames[s.depth],h=340*f[3]/f[2];
    c.save();c.globalAlpha=boss.cleared?.52:1;c.drawImage(bosses,...f,p.x-170,p.y-h/2,340,h);c.restore();
  }else gameArt.boat(c,{...p,angle:0,length:340,width:140},'inspection');
  label(c,DEPTHS[s.depth].boss,p.x,p.y-100,boss.cleared?'#8ab4a0':'#f1e6c4',22);
  if(!boss.cleared)boss.parts.forEach((hp,i)=>{
    const part=partPosition(s,i);ring(c,part,11,hp<=0?'#6a7771':boss.phase==='recover'?'#e8ce7d':'#856862');
    c.fillStyle=hp<=0?'#6a7771':'#e0c589';c.fillRect(part.x-14,part.y+18,28*hp/30,3);
    if(boss.phase==='recover'&&hp>0)label(c,'E',part.x,part.y-16,'#f6dda2',15);
  });
  if(boss.hook>=0){
    const part=partPosition(s,boss.hook),locked=s.captain==='jeong'&&s.skill.left>0;
    workRope(c,part,s.boat,boss.tension,locked?5:3.8);
    if(locked)label(c,'결박 · 장력 유지',part.x,part.y-38,'#f3ce8f',14);
  }
  if(s.skill.decoy&&s.skill.left>0){
    const decoy=s.skill.decoy;prop(c,'buoy',decoy.x,decoy.y+10,18,34);
    ring(c,decoy,20,'#a7e3d9');label(c,s.boss.phase==='warn'&&s.boss.timer>1.2?'미끼 부표 · 조준 유도':'미끼 부표 · 조준 고정',decoy.x,decoy.y-38,'#b9e9de',13);
    if(boss.phase==='warn'&&boss.timer>1.2){c.save();c.strokeStyle='#b9e9de88';c.setLineDash([5,7]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(decoy.x,decoy.y);c.stroke();c.restore();}
  }
  c.save();c.translate(s.map.exit.x,s.map.exit.y);c.rotate(s.map.exit.angle);c.strokeStyle=boss.cleared?'#afdcaf':'#667d79';c.lineWidth=3;c.strokeRect(-50,-24,100,48);c.restore();
  label(c,boss.cleared?dockHint(berthReadiness(s,s.map.exit),language,true):'탈출 부두 · 구동부 정지 필요',s.map.exit.x-40,s.map.exit.y+85);
  if(s.mode!=='sailing'){const berth=s.map.berths.find(b=>b.id===s.mooring);workRope(c,{x:s.boat.x-20,y:s.boat.y},berth.landing,.25,3.2);}
  if(s.tow&&visibleAt(s,s.tow)&&s.tow.hp>0){
    const t=s.tow;drawWake(c,t,s.time,reduced);gameArt.boat(c,floatPose(t,reduced?0:s.time,!!t.anchor),'inspection');
    if(t.connected)workRope(c,tugStern(s.boat),towBow(t),t.tension,3.3);
    if(t.anchor){workRope(c,towBow(t),{x:t.anchor.x,y:t.anchor.y+36},.55,2);quaySprite(c,'anchor',t.anchor.x-6,t.anchor.y+27,13,24);}
    label(c,t.connected?'T 분리 · H 닻 '+(t.anchor?'올리기':'내리기'):'보급정 · T 견인 / H 닻',t.x,t.y-43,'#e6d6a9',13);
  }
  drawWake(c,s.boat,s.time,reduced);
  drawCaptainBoat(c,floatPose(s.boat,reduced?0:s.time,s.mode!=='sailing'),s.captain,s.paint);
  if(s.skill.left>0&&s.captain==='woo'){
    const b=s.boat;workRope(c,b,{x:b.x-42,y:b.y+29},.55,2.4);quaySprite(c,'anchor',b.x-49,b.y+20,15,28);
    label(c,'비상 버팀 · 피해 −75%',b.x,b.y-45,'#d0dac5',13);
  }
  if(s.skill.left>0&&s.captain==='park'){
    const b=s.boat,v=s.skill.vector;c.strokeStyle='#cee8e5bb';c.lineWidth=3;c.beginPath();for(const d of [-9,0,9]){c.moveTo(b.x-v.x*30+v.y*d,b.y-v.y*30-v.x*d);c.lineTo(b.x-v.x*80+v.y*d,b.y-v.y*80-v.x*d);}c.stroke();
  }
  drawShoreEncounter(c,s,reduced);
  if(s.person&&!s.combat){
    c.fillStyle='#071d2077';c.beginPath();c.ellipse(s.person.x,s.person.y+2,9,4,0,0,7);c.fill();
    const {image:sprite,frame:f}=crewImage(s.captain);
    if(ready(sprite)){const w=37*f[2]/f[3];c.drawImage(sprite,...f,s.person.x-w/2,s.person.y-33,w,37);}
    label(c,s.captain[0].toUpperCase()+s.captain.slice(1),s.person.x,s.person.y-38,'#f1e6c4',12);
  }
  drawSurvey(c,s);
  if(mapOpen&&s.survey){
    for(const b of s.map.berths)label(c,SHORE_SITES[b.island],b.x,b.y+48,'#b6bda9',20);
    label(c,'탈출 부두 · 무전 좌표',s.map.exit.x-100,s.map.exit.y+75,'#c9c2a7',20);
    ring(c,s.person||s.boat,20,'#f0d98f');
  }
  const target=objective(s).target;
  if(target)ring(c,target,s.mode==='ashore'?32:42,'#ebd59e');
  c.restore();
  if(!mapOpen){
    const points=[];
    if(target)points.push({p:target,text:s.person?'수색 / 귀환':'목표',color:'#f6dda2'});
    if(s.tow?.connected&&!s.person)points.push({p:s.tow,text:'견인선',color:'#adc8c3'});
    if(s.boss.active&&!s.boss.cleared)points.push({p:s.map.boss,text:boss.phase==='warn'?'보스 · 공격 예고':'보스',color:boss.phase==='warn'?'#f4ad7d':'#e4ca9b'});
    for(const {p,text,color} of points){
      const mark=edgeMarker(frame,p);if(!mark)continue;
      c.save();c.translate(mark.x,mark.y);c.rotate(mark.angle);c.fillStyle=color;
      c.beginPath();c.moveTo(11,0);c.lineTo(-7,-6);c.lineTo(-7,6);c.closePath();c.fill();c.restore();
      label(c,text,Math.max(74,Math.min(width-74,mark.x)),mark.y-17,color,12);
    }
  }
  return frame;
}
