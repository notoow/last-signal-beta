import {SUPPLY_FRAMES} from './supply-fleet-frames.js';
import {project} from './world-projection.js';
import {WORLD_UNITS_PER_METRE as M} from './shore-scale.js';

let images=null,retryAttempt=0;
const poses=new WeakMap();
const ready=im=>im.complete&&im.naturalWidth>0;
const load=(file,retry=0)=>{const im=new Image();im.src='assets/art/'+file+(retry?'?quayRetry='+retry:'');return im;};
const delta=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
export function prepareSupplyFleet(retry=false){
  images??=SUPPLY_FRAMES.map(f=>load(f.file));
  if(retry){retryAttempt++;images=images.map((im,i)=>ready(im)?im:load(SUPPLY_FRAMES[i].file,retryAttempt));}
  return images;
}
export function supplyPose(body){
  let index=0;
  for(let i=1;i<SUPPLY_FRAMES.length;i++)if(delta(body.angle,SUPPLY_FRAMES[i].angle)<delta(body.angle,SUPPLY_FRAMES[index].angle))index=i;
  const previous=poses.get(body);
  // Small real drift oscillations do not flicker between adjacent paintings.
  if(previous!==undefined&&delta(body.angle,SUPPLY_FRAMES[previous].angle)<=delta(body.angle,SUPPLY_FRAMES[index].angle)+.06)index=previous;
  poses.set(body,index);return index;
}
export function supplyBoatLayout(body,frame){
  const index=supplyPose(body);
  const spec=SUPPLY_FRAMES[index],scale=spec.scaleAt15*frame.pixelsPerMetre/15*body.length/94;
  const point=project(frame,body,-.8*M);
  const bounds={x:point.x-spec.pivot[0]*scale,y:point.y-spec.pivot[1]*scale,w:spec.size[0]*scale,h:spec.size[1]*scale};
  const visibleBounds={x:bounds.x+spec.alpha[0]*scale,y:bounds.y+spec.alpha[1]*scale,w:spec.alpha[2]*scale,h:spec.alpha[3]*scale};
  const contact=p=>({x:bounds.x+p[0]*scale,y:bounds.y+p[1]*scale});
  return {index,bounds,visibleBounds,point,bow:contact(spec.bow),stern:contact(spec.stern),pose:spec.id,poseAngle:spec.angle,angle:body.angle};
}
export function drawSupplyBoat(c,body,frame){
  const layout=supplyBoatLayout(body,frame),art=prepareSupplyFleet()[layout.index];if(!ready(art))return null;
  const b=layout.bounds;c.drawImage(art,b.x,b.y,b.w,b.h);return layout;
}
