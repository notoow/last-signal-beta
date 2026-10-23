import {cameraSettings,clearViewport} from './rogue-camera.js';
import {project,unproject,HARBOR_PROJECTION} from './world-projection.js';
import {WORLD_UNITS_PER_METRE as M,CREW_HEIGHT} from './shore-scale.js';

// An explicit docked scene uses one fixed physical lens for boat and person.
// Landing, searching, attacks and radio messages never trigger a zoom. The
// saved manual zoom remains the multiplier; auto-fit is not silently enabled.
export function quayCamera({width,height,focus,previous=null,options={},occupied=[],dt=0,projection=HARBOR_PROJECTION,projectionId='quay-v1',companionBounds=null}){
  const settings=cameraSettings(options),scale=15/M*Math.min(width/568,height/320)*settings.zoom;
  const same=previous?.projectionId===projectionId;
  const viewport=clearViewport(width,height,occupied,same?previous.viewport:null,{w:150,h:90});
  const mid={x:viewport.x+viewport.w*.5,y:viewport.y+viewport.h*.58};
  const base={scale,ox:0,oy:0,projection,pixelsPerMetre:scale*M};
  const target=project(base,focus),desired={x:mid.x-target.x,y:mid.y-target.y+CREW_HEIGHT*scale*.35};
  let ox=desired.x,oy=desired.y;
  if(same&&previous.zoom===settings.zoom){
    const blend=1-Math.exp(-9*Math.max(0,dt));
    ox=previous.ox+(ox-previous.ox)*blend;oy=previous.oy+(oy-previous.oy)*blend;
    // Keep the actual controlled actor in clear space even on a newly opened
    // HUD panel. Camera lag cannot push a tiny crew sprite beneath controls.
    ox=Math.max(viewport.x+16-target.x,Math.min(viewport.x+viewport.w-16-target.x,ox));
    oy=Math.max(viewport.y+CREW_HEIGHT*scale+12-target.y,Math.min(viewport.y+viewport.h-12-target.y,oy));
  }
  // Nearby attached cargo deserves space too, but must never shrink the lens
  // or displace the controlled actor. Use actual painted alpha, not its padded
  // image canvas. If both do not fit on an axis, keep actor framing there.
  const companion=companionBounds?.(base);
  if(companion){
    const left=Math.min(target.x-8,companion.x),right=Math.max(target.x+8,companion.x+companion.w);
    const top=Math.min(target.y-CREW_HEIGHT*scale-4,companion.y),bottom=Math.max(target.y+4,companion.y+companion.h);
    const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    if(right-left<=viewport.w-16)ox=clamp(ox,viewport.x+8-left,viewport.x+viewport.w-8-right);
    if(bottom-top<=viewport.h-16)oy=clamp(oy,viewport.y+8-top,viewport.y+viewport.h-8-bottom);
  }
  const frame={...base,width,height,viewport,occupied,ox,oy,zoom:settings.zoom,overview:false,
    projectionId,worldUnitsPerMetre:M,pixelsPerMetre:scale*M};
  const corners=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(p=>unproject(frame,p));
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
  frame.bounds={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  frame.camera=unproject(frame,mid);
  return frame;
}
