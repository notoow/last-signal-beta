import {advanceGait,sampleLayeredLegs} from './shore-gait.js';
import {WOO_SIDE_RIG as rig} from './shore-rig-data.js';

const cycles=new WeakMap(),parts={};
let foreground,ready=false;
const load=async name=>{const img=new Image();img.src='assets/art/'+rig.prefix+name+'.png';await img.decode();return img;};
// Failed/unfinished loading uses the existing complete atlas, never partial limbs.
Promise.all([...rig.parts.map(async p=>{parts[p.id]={...p,image:await load(p.id)};}),
 load('foreground').then(img=>{foreground=img;})]).then(()=>{ready=true;}).catch(()=>{});

function paintBone(c,id,a,b){
 const p=parts[id],dx=p.end[0]-p.pivot[0],dy=p.end[1]-p.pivot[1];
 c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(dy,dx));
 c.scale(rig.commonScale,rig.commonScale);c.drawImage(p.image,-p.pivot[0],-p.pivot[1]);c.restore();
}
function paintFlat(c,id,point){
 const p=parts[id];c.save();c.translate(point.x,point.y);c.scale(rig.commonScale,rig.commonScale);
 c.drawImage(p.image,-p.pivot[0],-p.pivot[1]);c.restore();
}
export function drawCrewRig(c,s,p,reduced,unit,row,flip){
 if(!s.person||s.captain!=='woo')return false;
 const fight=s.combat,eligible=row===2&&!fight.action&&!fight.hit&&!s.work,old=cycles.get(s.person);
 const base=old?.eligible&&eligible?old:null;
 const gait=advanceGait(base,{travel:base?Math.max(0,fight.stride-base.stride)*rig.referenceBodyHeight/55:0,
  dt:base?Math.max(0,s.time-base.time):0,moving:eligible&&fight.moving},180);
 cycles.set(s.person,{...gait,stride:fight.stride,time:s.time,eligible});
 if(!ready||!eligible)return false;
 const legs=sampleLayeredLegs(gait,rig,{reduced}),k=55*unit/rig.referenceBodyHeight;
 c.save();c.translate(p.x,p.y);c.scale(flip?-k:k,k);c.translate(-256,-480);
 for(const leg of legs){
  paintFlat(c,leg.name+'-boot',leg.ankle);
  paintBone(c,leg.name+'-shin',leg.knee,leg.ankle);
  paintBone(c,leg.name+'-thigh',leg.hip,leg.knee);
 }
 paintFlat(c,'pelvis',{x:250,y:365});
 // Only the fixed upper body breathes. Soles and collision origin stay planted.
 const breath=!fight.moving&&!reduced?(1-gait.blend)*Math.sin(s.time*2.1)*.006:0;
 c.translate(0,365);c.scale(1,1+breath);c.drawImage(foreground,0,-365);c.restore();
 return true;
}
