import {advanceGait,sampleLayeredLegs} from './shore-gait.js';
import {WOO_SIDE_RIG,PARK_SIDE_RIG} from './shore-rig-data.js';

const cycles=new WeakMap();
const rigs={woo:{rig:WOO_SIDE_RIG,cycle:180,restHipY:365},park:{rig:PARK_SIDE_RIG,cycle:160,restHipY:367}};
const wholeWalks=Object.fromEntries(['woo','park'].map(captain=>{
  const image=new Image(),entry={image,ready:false};
  image.src='assets/art/crew-sd-'+captain+'-side-walk-v3.png';
  image.decode().then(()=>{entry.ready=true;}).catch(()=>{});return [captain,entry];
}));
// Each captain becomes ready atomically. A missing Park limb cannot disable
// Woo, and an incomplete rig always falls back to the complete original atlas.
for(const entry of Object.values(rigs)){
  entry.parts={};entry.ready=false;
  const load=async name=>{const img=new Image();img.src='assets/art/'+entry.rig.prefix+name+'.png';await img.decode();return img;};
  Promise.all([...entry.rig.parts.map(async p=>{entry.parts[p.id]={...p,image:await load(p.id)};}),
    load('foreground').then(img=>{entry.foreground=img;})]).then(()=>{entry.ready=true;}).catch(()=>{});
}
function paintBone(c,entry,id,a,b){
  const p=entry.parts[id],dx=p.end[0]-p.pivot[0],dy=p.end[1]-p.pivot[1];
  c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(dy,dx));
  c.scale(entry.rig.commonScale,entry.rig.commonScale);c.drawImage(p.image,-p.pivot[0],-p.pivot[1]);c.restore();
}
function paintFlat(c,entry,id,point){
  const p=entry.parts[id];c.save();c.translate(point.x,point.y);c.scale(entry.rig.commonScale,entry.rig.commonScale);
  c.drawImage(p.image,-p.pivot[0],-p.pivot[1]);c.restore();
}
export function drawCrewRig(c,s,p,reduced,unit,row,flip){
  const entry=rigs[s.captain];if(!s.person||!entry)return false;
  const {rig,cycle,restHipY}=entry,fight=s.combat,eligible=row===2&&!fight.action&&!fight.hit&&!s.work,old=cycles.get(s.person);
  const base=old?.captain===s.captain&&old.eligible&&eligible?old:null;
  const gait=advanceGait(base,{travel:base?Math.max(0,fight.stride-base.stride)*rig.referenceBodyHeight/55:0,
    dt:base?Math.max(0,s.time-base.time):0,moving:eligible&&fight.moving},cycle);
  cycles.set(s.person,{...gait,stride:fight.stride,time:s.time,eligible,captain:s.captain});
  if(!eligible)return false;
  const k=55*unit/rig.referenceBodyHeight;
  const whole=wholeWalks[s.captain];
  if(fight.moving&&whole?.ready){
    // Art-owner approved complete poses. Pivot/scale are shared by every cell;
    // never add the old limb layers, step lift or root bob over these frames.
    const frame=Math.floor(gait.phase*4)%4;
    c.save();c.translate(p.x,p.y);c.scale(flip?-k:k,k);
    c.drawImage(whole.image,frame*512,0,512,512,-256,-480,512,512);c.restore();return true;
  }
  if(!entry.ready)return false;
  const legs=sampleLayeredLegs(gait,rig,{cycle,restHipY,reduced});
  c.save();c.translate(p.x,p.y);c.scale(flip?-k:k,k);c.translate(-256,-480);
  for(const leg of legs){
    paintFlat(c,entry,leg.name+'-boot',leg.ankle);
    paintBone(c,entry,leg.name+'-shin',leg.knee,leg.ankle);
    paintBone(c,entry,leg.name+'-thigh',leg.hip,leg.knee);
  }
  // Bind the upper body's root to the hips it connects to, rather than leaving
  // a static torso above descending/moving thigh roots. Soles stay untouched.
  const bodyOffset=(legs[0].hip.y+legs[1].hip.y)/2-restHipY;
  c.translate(0,bodyOffset);
  paintFlat(c,entry,'pelvis',{x:250,y:365});
  const breath=!fight.moving&&!reduced?(1-gait.blend)*Math.sin(s.time*2.1)*.006:0;
  c.translate(0,365);c.scale(1,1+breath);c.drawImage(entry.foreground,0,-365);c.restore();
  return true;
}
