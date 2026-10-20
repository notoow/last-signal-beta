import {FAUNA} from './shore-encounters.js';
import {visibleAt} from './rogue-vision.js';
const load=file=>{const i=new Image();i.src='assets/art/'+file;return i;};
const fauna=load('shore-fauna-v1.png');
const crew=Object.fromEntries(['woo','park','han','jeong'].map(id=>[id,load('crew-sd-'+id+'-v1.png')]));
const idleSheet=load('crew-sd-idle-v1.png');
const crewRows={woo:0,park:1,han:2,jeong:3},faunaRows={rat:0,dog:1,crab:2,gull:3};
// Feet stay at the physical actor origin. Artwork has measured, non-square rows.
const crewAnchors={woo:[422,815,1187,350],park:[425,795,1176,350],han:[416,817,1215,375],jeong:[415,815,1208,368]};
export function crewPose(angle,moving,stride,hit,action,searching){
  if(hit>0)return {row:0,col:3,flip:false};
  if(action)return {row:2,col:action.left>(action.kind==='melee'?.26:.19)?2:3,flip:Math.cos(action.angle)<0};
  if(searching)return {row:1,col:3,flip:false};
  const vertical=Math.abs(Math.sin(angle))>.65,row=vertical?(Math.sin(angle)<0?1:0):2;
  const step=Math.floor(stride/8)%4;
  return {row,col:moving?(row===2?step%2:[1,0,2,0][step]):0,flip:row===2&&Math.cos(angle)<0};
}
function crewSprite(c,s,p,reduced){
  const img=crew[s.captain],fight=s.combat;if(!img.complete||!img.naturalWidth)return;
  const {row,col,flip}=crewPose(p.angle,fight.moving,fight.stride,fight.hit,fight.action,s.work>0);
  const anchors=crewAnchors[s.captain],ys=[0,440,820,1254],xs=[0,320,632,944,1254],x=xs[col],y=ys[row],w=xs[col+1]-x,h=ys[row+1]-y;
  const idle=!fight.moving&&!fight.action&&!fight.hit&&!s.work;
  const breath=idle&&!reduced?Math.sin(s.time*2.1+crewRows[s.captain]*1.7)*.012:0,scale=55/anchors[3];
  if(idle&&row===0&&idleSheet.complete&&idleSheet.naturalWidth){
    const r=crewRows[s.captain],clock=s.time+r*1.31,cycle=clock%13;
    const pose=reduced?0:cycle>11.8&&cycle<12.6?2:clock%5.3>2.9&&clock%5.3<3.04?1:0;
    const starts=[0,378,752,1130],ends=[378,752,1130,1536],feet=[374,744,1124,1510],tops=[28,390,761,1136],k=55/(feet[r]-tops[r]);
    c.save();c.translate(p.x,p.y);c.scale(1,1+breath);
    c.drawImage(idleSheet,128+pose*264,starts[r],272,ends[r]-starts[r],-136*k,(starts[r]-feet[r])*k,272*k,(ends[r]-starts[r])*k);
    c.restore();return;
  }
  c.save();c.translate(p.x,p.y);c.scale(flip?-1:1,1+breath);
  c.drawImage(img,x,y,w,h,-w*.5*scale,(y-anchors[row])*scale,w*scale,h*scale);c.restore();
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
  for(const e of fight.enemies){
    if(!e.hp||e.phase!=='warn'||!visibleAt(s,e))continue;
    const spec=FAUNA[e.kind];
    c.save();c.translate(e.x,e.y);c.rotate(e.angle);
    c.fillStyle='#dd753333';c.strokeStyle='#efbb78';c.lineWidth=1.5;
    c.beginPath();c.moveTo(0,0);c.arc(0,0,spec.reach+6,-1.05,1.05);c.closePath();c.fill();c.stroke();
    c.fillStyle='#f4d29c';c.fillRect(-9,-spec.radius-8,18*(1-e.left/spec.windup),2);c.restore();
  }
  const actors=fight.enemies.filter(e=>(e.hp>0||e.dead>0)&&visibleAt(s,e)).map(e=>({p:e,enemy:true}));
  if(s.person)actors.push({p:s.person,enemy:false});
  actors.sort((a,b)=>(a.p.y+(a.p.kind==='gull'?100:0))-(b.p.y+(b.p.kind==='gull'?100:0)));
  for(const {p,enemy} of actors){
    const bird=p.kind==='gull',size=enemy?{rat:32,dog:49,crab:78,gull:53}[p.kind]:55;
    c.fillStyle='#04141866';c.beginPath();c.ellipse(p.x,p.y+2,size*.23,size*.075,0,0,7);c.fill();
    const pose=enemy?p:{...fight,phase:'idle'};
    const frame=animationFrame(pose,enemy?null:fight.action);
    const lift=bird?16+(reduced?0:Math.sin(s.time*7+p.homeX)*2):0;
    const alpha=enemy&&p.hp===0?p.dead/.65:1;
    const drawP={...p,y:p.y-lift,angle:!enemy&&fight.action?fight.action.angle:p.angle};
    if(enemy){
      const breath=!reduced&&!p.moving&&p.phase==='idle'?Math.sin(s.time*2.8+p.homeX)*.018:0;
      sprite(c,fauna,faunaRows[p.kind],frame,drawP,size,alpha,1+breath);
    }else crewSprite(c,s,drawP,reduced);
    if(enemy&&p.hp>0&&(p.alert||p.hp<FAUNA[p.kind].hp)){
      c.fillStyle='#081c20cc';c.fillRect(p.x-15,p.y-size-8,30,3);
      c.fillStyle=p.kind==='crab'&&p.phase==='recover'?'#a7e1bc':'#dfaa7c';c.fillRect(p.x-15,p.y-size-8,30*p.hp/FAUNA[p.kind].hp,3);
    }
    if(bird&&p.stolen>0){c.fillStyle='#f2cf85';c.font='bold 13px Pretendard';c.textAlign='center';c.fillText('고철 '+p.stolen,p.x,p.y-50);}
  }
  for(const p of fight.shots){
    c.save();c.translate(p.x,p.y-8);c.rotate(Math.atan2(p.vy,p.vx));c.strokeStyle='#f1d4a5';c.lineWidth=2.4;c.beginPath();c.moveTo(-10,0);c.lineTo(3,0);c.stroke();c.fillStyle='#aab6b4';c.fillRect(-2,-2,6,4);c.restore();
  }
  for(const f of fight.effects){
    c.save();c.globalAlpha=f.left/.3;c.strokeStyle=f.kind==='hurt'?'#de8e6f':f.kind==='shell'?'#b9c5c2':'#ffe0a3';c.lineWidth=2;
    const r=(1-f.left/.3)*17+3;
    for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(f.x+Math.cos(a)*r*.4,f.y-12+Math.sin(a)*r*.4);c.lineTo(f.x+Math.cos(a)*r,f.y-12+Math.sin(a)*r);c.stroke();}
    if(f.kind==='empty'){c.font='600 13px Pretendard';c.fillStyle='#f2d4a5';c.textAlign='center';c.fillText('고철 없음 · Space 근접',f.x,f.y-48);}
    c.restore();
  }
}
