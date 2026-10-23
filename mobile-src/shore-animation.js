import {shoreScale} from './shore-scale.js';
import {project,HARBOR_PROJECTION,IDENTITY_PROJECTION} from './world-projection.js';
import {FAUNA,fauna as faunaSpec} from './shore-encounters.js';
import {visibleAt} from './rogue-vision.js';
import {crewFacing,crewPose,CREW_CYCLE} from './shore-pose.js';
export {crewPose} from './shore-pose.js';
const load=file=>{const i=new Image();i.src='assets/art/'+file;return i;};
const fauna=load('shore-fauna-v1.png');
const crew=Object.fromEntries(['woo','park','han','jeong'].map(id=>[id,load('crew-sd-'+id+'-v1.png')]));
const idleSheet=load('crew-sd-idle-v1.png');
const workerSheet=load('shore-worker-v1.png');
let workerArt=null;
fetch('assets/art/shore-worker-v1-metadata.json').then(r=>r.ok?r.json():null).then(data=>{workerArt=data;}).catch(()=>{});
const crewRows={woo:0,park:1,han:2,jeong:3},faunaRows={rat:0,dog:1,crab:2,gull:3};
// Feet stay at the physical actor origin. Artwork has measured, non-square rows.
const crewAnchors={woo:[422,815,1187,350],park:[425,795,1176,350],han:[416,817,1215,375],jeong:[415,815,1208,368]};
const facings=new WeakMap();
function crewSprite(c,s,p,reduced,unit=1){
  const img=crew[s.captain],fight=s.combat;if(!img.complete||!img.naturalWidth)return;
  const facing=crewFacing(p.angle,facings.get(s.person));
  if(s.person&&!fight.action&&!fight.hit)facings.set(s.person,facing);
  const {row,col,flip}=crewPose(p.angle,fight.moving,fight.stride,fight.hit,fight.action,s.work>0,facing);
  const anchors=crewAnchors[s.captain],ys=[0,440,820,1254],xs=[0,320,632,944,1254],x=xs[col],y=ys[row],w=xs[col+1]-x,h=ys[row+1]-y;
  const idle=!fight.moving&&!fight.action&&!fight.hit&&!s.work;
  const breath=idle&&!reduced?Math.sin(s.time*2.1+crewRows[s.captain]*1.7)*.012:0,scale=55*unit/anchors[3];
  if(idle&&row===0&&idleSheet.complete&&idleSheet.naturalWidth){
    const r=crewRows[s.captain],clock=s.time+r*1.31,cycle=clock%13;
    const pose=reduced?0:cycle>11.8&&cycle<12.6?2:clock%5.3>2.9&&clock%5.3<3.04?1:0;
    const starts=[0,378,752,1130],ends=[378,752,1130,1536],feet=[374,744,1124,1510],tops=[28,390,761,1136],k=55*unit/(feet[r]-tops[r]);
    c.save();c.translate(p.x,p.y);c.scale(1,1+breath);
    c.drawImage(idleSheet,128+pose*264,starts[r],272,ends[r]-starts[r],-136*k,(starts[r]-feet[r])*k,272*k,(ends[r]-starts[r])*k);
    c.restore();return;
  }
  c.save();c.translate(p.x,p.y);c.scale(flip?-1:1,1+breath);
  if(row===2&&col===1){
    // Neighboring atlas pixels enter this cell's upper-right corner. Preserve
    // the original pivot and lower-right tool; never recenter the cut pieces.
    // Reviewed source contract: local notch [300,0,12,110].
    c.beginPath();c.rect(-w*.5*scale,(y-anchors[row])*scale,300*scale,h*scale);
    c.rect((300-w*.5)*scale,(y+110-anchors[row])*scale,(w-300)*scale,(h-110)*scale);c.clip();
  }
  c.drawImage(img,x,y,w,h,-w*.5*scale,(y-anchors[row])*scale,w*scale,h*scale);c.restore();
}
function workerSprite(c,s,p,reduced,unit=1){
  if(!workerArt||!workerSheet.complete||!workerSheet.naturalWidth)return;
  const r=s.rescue,vertical=Math.abs(Math.sin(r.angle))>.65;
  const direction=vertical?(Math.sin(r.angle)<0?'rear':'front'):'side';
  // Each contact pose advances with eight world units actually walked, so
  // standing still cannot cycle feet and obstacles cannot cause foot sliding.
  const step=['walk-a','walk-b'][Math.floor(r.stride/8)%2];
  const moving=r.moving&&workerArt.delivery.walkReady;
  const id=r.blocked==='threat'?'frightened-stop':r.stage==='waiting'?'seated-wait':direction+'-'+(moving?step:'idle');
  const frame=workerArt.frames.find(f=>f.id===id);if(!frame)return;
  const {rect,pivot}=frame,k=55*unit/workerArt.sourceReferenceHeight;
  const breath=!reduced&&!r.moving?Math.sin(s.time*2.1)*.008:0;
  c.save();c.translate(p.x,p.y);c.scale(direction==='side'&&Math.cos(r.angle)<0&&!['frightened-stop','seated-wait'].includes(id)?-1:1,1+breath);
  c.drawImage(workerSheet,rect.x,rect.y,rect.w,rect.h,-pivot.x*k,-pivot.y*k,rect.w*k,rect.h*k);c.restore();
}
export function animationFrame({hit=0,phase='idle',moving=false,stride=0,dead=0},action=null){
  if(hit>0||dead>0)return 5;
  if(action)return action.left>(action.kind==='melee'?.26:.19)?3:4;
  if(phase==='warn')return 3;
  if(phase==='strike')return 4;
  return moving?[1,0,2,0][Math.floor(stride/8)%4]:0;
}
function sprite(c,img,row,frame,p,size,opacity=1,stretch=1){
  if(!img.complete||!img.naturalWidth)return;
  const [x,w,pivot]=[frame*256,256,frame*256+128];
  const scale=size/256,baseline=248;
  c.save();c.translate(p.x,p.y);if(Math.cos(p.angle)<0)c.scale(-1,1);c.globalAlpha=opacity;
  c.scale(1,stretch);
  c.imageSmoothingEnabled=true;
  c.drawImage(img,x,row*256,w,256,(x-pivot)*scale,-baseline*scale,w*scale,256*scale);c.restore();
}
export function drawShoreEncounter(c,s,reduced){
  const fight=s.combat;if(!fight)return;
  const unit=shoreScale(s);
  for(const e of fight.enemies){
    if(!e.hp||e.phase!=='warn'||!visibleAt(s,e))continue;
    const spec=faunaSpec(s,e.kind);
    c.save();c.translate(e.x,e.y);c.rotate(e.angle);
    c.fillStyle='#dd753333';c.strokeStyle='#efbb78';c.lineWidth=1.5;
    c.beginPath();c.moveTo(0,0);c.arc(0,0,spec.reach+6*unit,-1.05,1.05);c.closePath();c.fill();c.stroke();
    c.fillStyle='#f4d29c';c.fillRect(-9,-spec.radius-8,18*(1-e.left/spec.windup),2);c.restore();
  }
  const actors=fight.enemies.filter(e=>(e.hp>0||e.dead>0)&&visibleAt(s,e)).map(e=>({p:e,enemy:true}));
  if(s.person)actors.push({p:s.person,enemy:false});
  if(s.depth===0&&['waiting','following'].includes(s.rescue?.stage)&&visibleAt(s,s.rescue))actors.push({p:s.rescue,enemy:false,worker:true});
  actors.sort((a,b)=>(a.p.y+(a.p.kind==='gull'?100:0))-(b.p.y+(b.p.kind==='gull'?100:0)));
  for(const {p,enemy,worker} of actors){
    if(unit!==1){drawProjectedShoreActor(c,s,{p,enemy,worker},{scale:1,ox:0,oy:0,projection:IDENTITY_PROJECTION},reduced);continue;}
    const bird=p.kind==='gull',size=enemy?{rat:32,dog:49,crab:78,gull:53}[p.kind]:55;
    c.fillStyle='#04141866';c.beginPath();c.ellipse(p.x,p.y+2,size*.23,size*.075,0,0,7);c.fill();
    const pose=enemy?p:{...fight,phase:'idle'};
    const frame=animationFrame(pose,enemy?null:fight.action);
    const lift=bird?16+(reduced?0:Math.sin(s.time*7+p.homeX)*2):0;
    const alpha=enemy&&p.hp===0?p.dead/.65:1;
    // The stride comes from distance actually travelled, not elapsed frames.
    // A small continuous weight transfer softens contact-pose changes while
    // preserving planted feet at rest and never blending double silhouettes.
    const stride=enemy||worker?p.stride:fight.stride,moving=enemy||worker?p.moving:fight.moving;
    const contact=enemy||worker?8:CREW_CYCLE/2;
    const stepLift=!reduced&&moving?Math.sin(stride/contact*Math.PI)**2*(enemy?1:1.5):0;
    const drawP={...p,y:p.y-lift-stepLift,angle:!enemy&&!worker&&fight.action?fight.action.angle:p.angle};
    if(enemy){
      const breath=!reduced&&!p.moving&&p.phase==='idle'?Math.sin(s.time*2.8+p.homeX)*.018:0;
      sprite(c,fauna,faunaRows[p.kind],frame,drawP,size,alpha,1+breath);
    }else if(worker)workerSprite(c,s,drawP,reduced);
    else crewSprite(c,s,drawP,reduced);
    if(enemy&&p.asleep&&p.hp>0){c.fillStyle='#c3d7db';c.font='600 12px Pretendard';c.textAlign='center';c.fillText('z Z',p.x,p.y-size-10);}
    if(enemy&&p.hp>0&&(p.alert||p.hp<FAUNA[p.kind].hp)){
      c.fillStyle='#081c20cc';c.fillRect(p.x-15,p.y-size-8,30,3);
      c.fillStyle=p.kind==='crab'&&p.phase==='recover'?'#a7e1bc':'#dfaa7c';c.fillRect(p.x-15,p.y-size-8,30*p.hp/FAUNA[p.kind].hp,3);
    }
    if(bird&&p.stolen>0){c.fillStyle='#f2cf85';c.font='bold 13px Pretendard';c.textAlign='center';c.fillText('고철 '+p.stolen,p.x,p.y-50);}
  }
  for(const p of fight.shots){
    c.save();c.translate(p.x,p.y-8*unit);c.scale(unit,unit);c.rotate(Math.atan2(p.vy,p.vx));c.strokeStyle='#f1d4a5';c.lineWidth=2.4;c.beginPath();c.moveTo(-10,0);c.lineTo(3,0);c.stroke();c.fillStyle='#aab6b4';c.fillRect(-2,-2,6,4);c.restore();
  }
  for(const f of fight.effects){
    c.save();c.globalAlpha=f.left/.3;c.strokeStyle=f.kind==='hurt'?'#de8e6f':f.kind==='shell'?'#b9c5c2':'#ffe0a3';c.lineWidth=2;
    const r=(1-f.left/.3)*17+3;
    for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(f.x+Math.cos(a)*r*.4,f.y-12+Math.sin(a)*r*.4);c.lineTo(f.x+Math.cos(a)*r,f.y-12+Math.sin(a)*r);c.stroke();}
    if(f.kind==='empty'){c.font='600 13px Pretendard';c.fillStyle='#f2d4a5';c.textAlign='center';c.fillText('고철 없음 · Space 근접',f.x,f.y-48);}
    c.restore();
  }
}

// Upright actor billboards for the real dock scene. Only the contact anchor
// and facing vector use P; painting pixels through P again would flatten faces.
export function shoreActors(s){
  const actors=(s.combat?.enemies||[]).filter(e=>(e.hp>0||e.dead>0)&&visibleAt(s,e)).map(p=>({p,enemy:true}));
  if(s.person)actors.push({p:s.person,enemy:false});
  if(s.depth===0&&['waiting','following'].includes(s.rescue?.stage)&&visibleAt(s,s.rescue))actors.push({p:s.rescue,worker:true});
  return actors;
}
export function drawProjectedShoreActor(c,s,actor,frame,reduced=false){
  const {p,enemy,worker}=actor,unit=shoreScale(s),k=unit*frame.scale;
  const foot=project(frame,p),fight=s.combat;
  const angle=(!enemy&&!worker&&fight.action?fight.action.angle:p.angle)||0;
  const m=frame.projection||HARBOR_PROJECTION,v={x:Math.cos(angle),y:Math.sin(angle)};
  const face=Math.atan2(m.yx*v.x+m.yy*v.y,m.xx*v.x+m.xy*v.y);
  const stride=(enemy||worker?p.stride:fight.stride)/unit,moving=enemy||worker?p.moving:fight.moving;
  const bird=p.kind==='gull',height=(enemy?{rat:32,dog:49,crab:78,gull:53}[p.kind]:55)*k;
  const lift=(bird?16+(reduced?0:Math.sin(s.time*7+p.homeX)*2):0)*k;
  const contact=enemy||worker?8:CREW_CYCLE/2;
  const stepLift=!reduced&&moving?Math.sin(stride/contact*Math.PI)**2*(enemy?1:1.5)*k:0;
  const drawP={...p,x:foot.x,y:foot.y-lift-stepLift,angle:face,stride};
  c.fillStyle='#03151c80';c.beginPath();c.ellipse(foot.x,foot.y,height*.22,height*.055,.198,0,7);c.fill();
  if(enemy){
    const pose={...p,stride},alpha=p.hp===0?p.dead/.65:1;
    sprite(c,fauna,faunaRows[p.kind],animationFrame(pose),drawP,height,alpha,
      !reduced&&!p.moving&&p.phase==='idle'?1+Math.sin(s.time*2.8+p.homeX)*.018:1);
  }else{
    const state={...s,combat:{...fight,stride,action:fight.action?{...fight.action,angle:face}:null},
      rescue:worker?{...s.rescue,angle:face,stride}:s.rescue};
    if(worker)workerSprite(c,state,drawP,reduced,k);else crewSprite(c,state,drawP,reduced,k);
  }
  if(enemy&&p.hp>0){
    if(p.asleep){c.font='600 10px Pretendard';c.fillStyle='#d4e7ed';c.textAlign='center';c.fillText('z',foot.x,foot.y-height-lift-3);}
    else if(p.alert||p.hp<FAUNA[p.kind].hp){
      c.fillStyle='#06181f';c.fillRect(foot.x-10,foot.y-height-lift-5,20,3);
      c.fillStyle=p.kind==='crab'&&p.phase==='recover'?'#a7e1bc':'#dfaa7c';c.fillRect(foot.x-10,foot.y-height-lift-5,20*p.hp/FAUNA[p.kind].hp,3);
    }
  }
  return {x:foot.x-height*.35,y:foot.y-height-lift,w:height*.7,h:height+lift,foot,height};
}
