import {cameraSettings,clearViewport} from './rogue-camera.js';
import {project,unproject,HARBOR_PROJECTION} from './world-projection.js';
import {WORLD_UNITS_PER_METRE as M,CREW_HEIGHT} from './shore-scale.js';

function fitPaintedPair(width,height,objects,occupied,desired){
  // A pair can straddle two clear pockets even when its enclosing rectangle
  // cannot. Keep clearViewport's 10px HUD padding and 16px screen inset.
  const pad=10,edge=16,valid=b=>[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0;
  const blocks=occupied.filter(valid),clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const left=Math.max(...objects.map(a=>edge-a.x)),right=Math.min(...objects.map(a=>width-edge-a.x-a.w));
  const top=Math.max(...objects.map(a=>edge-a.y)),bottom=Math.min(...objects.map(a=>height-edge-a.y-a.h));
  if(left>right||top>bottom)return null;
  const clear=(x,y)=>!objects.some(a=>blocks.some(b=>
    a.x+x<b.x+b.w+pad-1e-7&&a.x+x+a.w>b.x-pad+1e-7&&
    a.y+y<b.y+b.h+pad-1e-7&&a.y+y+a.h>b.y-pad+1e-7));
  const start={x:clamp(desired.x,left,right),y:clamp(desired.y,top,bottom)};
  if(clear(start.x,start.y))return start;
  // Nearest feasible translations lie on a screen or obstacle boundary.
  // Enumerate those boundaries, not screen pixels; no zoom or world mutation.
  const xs=[left,right,start.x],ys=[top,bottom,start.y];
  for(const a of objects)for(const b of blocks){
    xs.push(b.x-pad-a.x-a.w,b.x+b.w+pad-a.x);
    ys.push(b.y-pad-a.y-a.h,b.y+b.h+pad-a.y);
  }
  const xx=[...new Set(xs)].filter(x=>x>=left&&x<=right),yy=[...new Set(ys)].filter(y=>y>=top&&y<=bottom);
  let best=null,score=Infinity;
  for(const x of xx)for(const y of yy){
    const d=(x-desired.x)**2+(y-desired.y)**2;
    if(d<score&&clear(x,y)){best={x,y};score=d;}
  }
  return best;
}

// An explicit docked scene uses one fixed physical lens for boat and person.
// Landing, searching, attacks and radio messages never trigger a zoom. The
// saved manual zoom remains the multiplier; auto-fit is not silently enabled.
export function quayCamera({width,height,focus,previous=null,options={},occupied=[],dt=0,projection=HARBOR_PROJECTION,projectionId='quay-v1',focusBounds=null,companionBounds=null}){
  const settings=cameraSettings(options),scale=15/M*Math.min(width/568,height/320)*settings.zoom;
  const same=previous?.projectionId===projectionId;
  const base={scale,ox:0,oy:0,projection,pixelsPerMetre:scale*M};
  // clearViewport already pads every painted HUD boundary by10px. Another6px
  // keeps a visible gap without rejecting a useful corridor for a fraction of
  // a pixel when a60px action protrudes from its52px grid column.
  const target=project(base,focus),margin=6;
  const valid=b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0;
  const union=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),
    w:Math.max(a.x+a.w,b.x+b.w)-Math.min(a.x,b.x),h:Math.max(a.y+a.h,b.y+b.h)-Math.min(a.y,b.y)});
  const crew={x:target.x-8,y:target.y-CREW_HEIGHT*scale-4,w:16,h:CREW_HEIGHT*scale+8};
  const supplied=focusBounds?.(base),actor=valid(supplied)?supplied:crew;
  const companion=companionBounds?.(base),group=valid(companion)?union(actor,companion):actor;
  const preference=b=>({w:Math.max(150,b.w+margin*2),h:Math.max(90,b.h+margin*2)});
  const fits=(b,v)=>b.w+margin*2<=v.w&&b.h+margin*2<=v.h;
  // Choose clear space for the actual silhouettes before positioning them.
  // A far-away tow must not make a roomy actor view lose to a narrow strip.
  let viewport=clearViewport(width,height,occupied,same?previous.viewport:null,preference(actor));
  if(group!==actor){
    const together=clearViewport(width,height,occupied,same?previous.viewport:null,preference(group));
    if(fits(group,together))viewport=together;
  }
  const mid={x:viewport.x+viewport.w*.5,y:viewport.y+viewport.h*.58};
  const desired={x:mid.x-target.x,y:mid.y-target.y+CREW_HEIGHT*scale*.35};
  let ox=desired.x,oy=desired.y;
  if(same&&previous.zoom===settings.zoom){
    const blend=1-Math.exp(-9*Math.max(0,dt));
    ox=previous.ox+(ox-previous.ox)*blend;oy=previous.oy+(oy-previous.oy)*blend;
  }
  // Nearby attached cargo deserves space too, but must never shrink the lens
  // or displace the controlled actor. Use actual painted alpha, not its padded
  // image canvas. If the pair cannot fit, retain the controlled actor framing;
  // following one axis of an otherwise off-screen tow creates distracting pans.
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const fitX=fits(group,viewport)?group:actor,fitY=fitX;
  ox=fitX.w+margin*2<=viewport.w?clamp(ox,viewport.x+margin-fitX.x,viewport.x+viewport.w-margin-fitX.x-fitX.w):viewport.x+viewport.w/2-actor.x-actor.w/2;
  oy=fitY.h+margin*2<=viewport.h?clamp(oy,viewport.y+margin-fitY.y,viewport.y+viewport.h-margin-fitY.y-fitY.h):viewport.y+viewport.h/2-actor.y-actor.h/2;
  if(group!==actor&&!fits(group,viewport)){
    const pair=fitPaintedPair(width,height,[actor,companion],occupied,{x:ox,y:oy});
    if(pair){ox=pair.x;oy=pair.y;}
  }
  const frame={...base,width,height,viewport,occupied,occlusionKnown:true,ox,oy,zoom:settings.zoom,overview:false,
    projectionId,worldUnitsPerMetre:M,pixelsPerMetre:scale*M};
  const corners=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(p=>unproject(frame,p));
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
  frame.bounds={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  frame.camera=unproject(frame,mid);
  return frame;
}
