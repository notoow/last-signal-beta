import {project,unproject} from './world-projection.js';
export {project,unproject,screenVectorToWorld} from './world-projection.js';
export const CAMERA_KEY='lastsignal.rogue.camera.v1';
export const DEFAULT_CAMERA={autoZoom:false,zoom:1};
export function cameraSettings(value){
  return {autoZoom:value?.autoZoom===true,zoom:Number.isFinite(value?.zoom)?Math.max(.6,Math.min(1.8,value.zoom)):1};
}
export function cameraScale(width,height,ashore,options=DEFAULT_CAMERA){
  const p=cameraSettings(options),v=cameraViewport(width,height);
  // At 960×640 the 55-unit crew is ~70px tall, rather than ~46px.
  // Disembarking never changes the scale unless the player opts in.
  return Math.min(v.w/640,v.h/300)*p.zoom*(p.autoZoom&&ashore?1.18:1);
}
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function cameraViewport(width,height,kind='rogue'){
  const top=kind==='voyage'?210:140,bottom=kind==='rogue'?116:120;
  return {x:24,y:Math.min(top,height*.28),w:Math.max(1,width-48),h:Math.max(1,height-Math.min(top,height*.28)-Math.min(bottom,height*.24))};
}
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
// Find a contiguous clear rectangle from actual HUD bounds. Scale is independent:
// opening a radio message may reframe the boat, but never changes manual zoom.
export function clearViewport(width,height,occupied=[],previous=null,preferred=null){
  const edge=16,pad=10,outer={x:edge,y:edge,w:Math.max(1,width-edge*2),h:Math.max(1,height-edge*2)};
  const right=outer.x+outer.w,bottom=outer.y+outer.h;
  const blocks=occupied.filter(r=>[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0).map(r=>{
    const x=clamp(r.x-pad,outer.x,right),y=clamp(r.y-pad,outer.y,bottom);
    return {x,y,w:Math.max(0,Math.min(right,r.x+r.w+pad)-x),h:Math.max(0,Math.min(bottom,r.y+r.h+pad)-y)};
  }).filter(r=>r.w>0&&r.h>0);
  const ys=[...new Set([outer.y,bottom,...blocks.flatMap(r=>[r.y,r.y+r.h])])].sort((a,b)=>a-b);
  let best=null,bestScore=-1,bestFits=false;
  const fits=r=>!preferred||r.w>=preferred.w&&r.h>=preferred.h;
  // A wide sliver has area, but cannot show a turn or approaching obstacle.
  // Prefer space in both axes without changing the player's chosen zoom.
  const score=r=>r.w*r.h*Math.min(1,r.w/Math.min(preferred?.w||320,outer.w))*Math.min(1,r.h/Math.min(preferred?.h||220,outer.h))*
    (1-.22*(Math.abs(r.x+r.w/2-width/2)/width+Math.abs(r.y+r.h/2-height/2)/height));
  for(let a=0;a<ys.length-1;a++)for(let b=a+1;b<ys.length;b++){
    const top=ys[a],h=ys[b]-top,intervals=blocks.filter(r=>r.y<ys[b]&&r.y+r.h>top).map(r=>[r.x,r.x+r.w]).sort((a,b)=>a[0]-b[0]);
    let left=outer.x;
    for(const [start,end] of [...intervals,[right,right]]){
      if(start>left){
        const r={x:left,y:top,w:start-left,h},value=score(r),fit=fits(r);
        // If a clear area can fit the active interaction, do not choose a
        // slightly larger but too-short strip that cannot show its label.
        if(fit&&!bestFits||fit===bestFits&&value>bestScore){best=r;bestScore=value;bestFits=fit;}
      }
      left=Math.max(left,end);
    }
  }
  // Retain a still-clear framing area across tiny number/font layout changes.
  if(previous&&previous.x>=outer.x&&previous.y>=outer.y&&previous.x+previous.w<=right&&previous.y+previous.h<=bottom&&
    !blocks.some(r=>overlaps(r,previous))&&(!bestFits||fits(previous))&&score(previous)>=bestScore*.9)return {...previous,obstructed:false};
  return best?{...best,obstructed:false}:{...outer,obstructed:true};
}
function bodyBounds(b){
  const a=b.angle||0,l=b.length||70,w=b.width||34;
  return {x:Math.abs(Math.cos(a))*l/2+Math.abs(Math.sin(a))*w/2,y:Math.abs(Math.sin(a))*l/2+Math.abs(Math.cos(a))*w/2};
}
// Presentation only: this never changes hulls, collision, sight range or saves.
export function playCamera({width,height,world,focus,partner=null,attention=null,ashore=false,kind='rogue',options=DEFAULT_CAMERA,overview=false,previous=null,dt=0,occupied=null}){
  const settings=cameraSettings(options);
  let scale=cameraScale(width,height,ashore,settings);
  const shoreBox=ashore&&attention?{left:Math.min(focus.x-24,attention.x-48),right:Math.max(focus.x+24,attention.x+48),
    top:Math.min(focus.y-65,attention.y-48),bottom:Math.max(focus.y+16,attention.y+40)}:null;
  const preferred=shoreBox?{w:Math.max(320,(shoreBox.right-shoreBox.left)*scale+24),h:Math.max(220,(shoreBox.bottom-shoreBox.top)*scale+24)}:null;
  const viewport=occupied?clearViewport(width,height,occupied,previous?.viewport,preferred):cameraViewport(width,height,kind);
  const mid={x:viewport.x+viewport.w/2,y:viewport.y+viewport.h/2};
  const lead={x:clamp((focus.vx||0)*.35,-60,60),y:clamp((focus.vy||0)*.35,-60,60)};
  let target={x:focus.x+lead.x,y:focus.y+lead.y};
  if(partner&&!ashore){
    target={x:(focus.x+partner.x)/2+lead.x,y:(focus.y+partner.y)/2+lead.y};
    if(settings.autoZoom){
      const a=bodyBounds(focus),b=bodyBounds(partner);
      const w=Math.max(focus.x+a.x,partner.x+b.x)-Math.min(focus.x-a.x,partner.x-b.x)+120;
      const h=Math.max(focus.y+a.y,partner.y+b.y)-Math.min(focus.y-a.y,partner.y-b.y)+120;
      scale=Math.min(scale,viewport.w/w,viewport.h/h);
    }
  }
  // On a pier keep the nearby search/boarding point beside the crew. Use its
  // ring/label envelope, not just its center. Never zoom to fit a distant task.
  if(shoreBox){
    if((shoreBox.right-shoreBox.left)*scale<=viewport.w-24&&(shoreBox.bottom-shoreBox.top)*scale<=viewport.h-24)
      target={x:(shoreBox.left+shoreBox.right)/2,y:(shoreBox.top+shoreBox.bottom)/2};
  }
  if(overview){
    scale=Math.min((viewport.w-32)/world.width,(viewport.h-32)/world.height);
    target={x:world.width/2,y:world.height/2};
  }else if(previous&&!previous.overview){
    const blend=1-Math.exp(-9*Math.max(0,dt));
    const start={x:(mid.x-previous.ox)/previous.scale,y:(mid.y-previous.oy)/previous.scale};
    target={x:start.x+(target.x-start.x)*blend,y:start.y+(target.y-start.y)*blend};
    if(settings.autoZoom&&previous.zoom===settings.zoom)scale=previous.scale+(scale-previous.scale)*blend;
  }
  const half={x:viewport.w/scale/2,y:viewport.h/scale/2};
  if(!overview){
    // A long tow can leave the viewport; the controlled hull cannot.
    // Prefer an edge marker to unsolicited zooming out.
    const body=ashore?{x:24,y:65}:bodyBounds(focus),mx=Math.max(64/scale,body.x+12),my=Math.max(64/scale,body.y+12);
    target.x=clamp(target.x,focus.x-Math.max(0,half.x-mx),focus.x+Math.max(0,half.x-mx));
    // Crew coordinates are at the feet. Reserving a full sprite below the feet
    // needlessly pushed the search chest behind the radio at small viewports.
    target.y=clamp(target.y,focus.y-Math.max(0,half.y-(ashore?24:my)),focus.y+Math.max(0,half.y-my));
    // Smoothing must not leave the newly actionable chest behind the HUD on
    // the first landing frame. Constrain only enough to fit both envelopes.
    const margin=12/scale;
    if(shoreBox&&shoreBox.right-shoreBox.left<=2*(half.x-margin)&&shoreBox.bottom-shoreBox.top<=2*(half.y-margin)){
      target.x=clamp(target.x,shoreBox.right-half.x+margin,shoreBox.left+half.x-margin);
      target.y=clamp(target.y,shoreBox.bottom-half.y+margin,shoreBox.top+half.y-margin);
    }
    target.x=world.width<=half.x*2?world.width/2:clamp(target.x,half.x,world.width-half.x);
    target.y=world.height<=half.y*2?world.height/2:clamp(target.y,half.y,world.height-half.y);
  }
  const ox=mid.x-target.x*scale,oy=mid.y-target.y*scale;
  return {width,height,viewport,occupied:occupied||[],occlusionKnown:Array.isArray(occupied),scale,camera:target,ox,oy,overview,zoom:settings.zoom,
    hw:width/scale/2,hh:height/scale/2,bounds:{x:-ox/scale,y:-oy/scale,w:width/scale,h:height/scale}};
}
export function edgeMarker(frame,p,inset=26){
  const q=project(frame,p),v=frame.viewport;
  // The framing rectangle keeps the controlled actor clear of the HUD; it
  // does not crop the rest of the sea. Do not point at an already visible
  // target beside that rectangle. Legacy callers without HUD geometry retain
  // their conservative framing-only behaviour.
  if(frame.occlusionKnown&&q.x>=inset&&q.x<=frame.width-inset&&q.y>=inset&&q.y<=frame.height-inset&&
    !frame.occupied.some(r=>q.x>=r.x-inset&&q.x<=r.x+r.w+inset&&q.y>=r.y-inset&&q.y<=r.y+r.h+inset))return null;
  const x=clamp(q.x,v.x+inset,v.x+v.w-inset),y=clamp(q.y,v.y+inset,v.y+v.h-inset);
  return x===q.x&&y===q.y?null:{x,y,angle:Math.atan2(q.y-y,q.x-x)};
}
