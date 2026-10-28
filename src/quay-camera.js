import {cameraSettings,clearViewport} from './rogue-camera.js';
import {project,unproject,HARBOR_PROJECTION} from './world-projection.js';
import {WORLD_UNITS_PER_METRE as M,CREW_HEIGHT} from './shore-scale.js';

function fitPaintedPair(width,height,objects,occupied,desired,pad=10){
  // A pair can straddle two clear pockets even when its enclosing rectangle
  // cannot. Keep clearViewport's 10px HUD padding and 16px screen inset.
  const edge=16,valid=b=>[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0;
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

// Camera translations are actor top-left positions in screen space. Route
// between clear pockets around HUD rectangles, so easing a valid start/end
// cannot carry the controlled hull through a joystick or action button.
export function cameraTranslationStep(from,to,actor,width,height,occupied,budget){
  if(!(budget>0))return from;
  let start={x:from.x+actor.x,y:from.y+actor.y};const goal={x:to.x+actor.x,y:to.y+actor.y};
  const hud=occupied.filter(b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0),eps=1e-7;
  // Fresh HUD/role layouts may leave a valid start with less than the preferred
  // clearance. Do not misclassify it as blocked and cut straight through a
  // control: retain its available gap while routing towards the padded goal.
  let pad=10,edge=16;
  for(const p of [start,goal]){
    edge=Math.min(edge,p.x,p.y,width-p.x-actor.w,height-p.y-actor.h);
    for(const b of hud)pad=Math.min(pad,Math.max(b.x-p.x-actor.w,p.x-b.x-b.w,b.y-p.y-actor.h,p.y-b.y-b.h));
  }
  pad=Math.max(0,pad);edge=Math.max(0,edge);
  const right=width-edge-actor.w,bottom=height-edge-actor.h;
  const blocks=hud.map(b=>({left:b.x-pad-actor.w,right:b.x+b.w+pad,top:b.y-pad-actor.h,bottom:b.y+b.h+pad}));
  const clear=p=>p.x>=edge-eps&&p.x<=right+eps&&p.y>=edge-eps&&p.y<=bottom+eps&&!blocks.some(b=>p.x>b.left+eps&&p.x<b.right-eps&&p.y>b.top+eps&&p.y<b.bottom-eps);
  const segment=(a,b)=>!blocks.some(r=>{
    let lo=0,hi=1;
    for(const [v,d,min,max]of [[a.x,b.x-a.x,r.left,r.right],[a.y,b.y-a.y,r.top,r.bottom]]){
      if(Math.abs(d)<eps){if(v<=min+eps||v>=max-eps)return false;}
      else{let t=(min-v)/d,u=(max-v)/d;if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>=hi-eps)return false;}
    }
    return lo<hi-eps;
  });
  // A freshly measured HUD can appear over the previous frame's hull (for
  // example, the health panel during first load). Leave that overlap by the
  // shortest clear displacement before following the ordinary clear-space path.
  if(!clear(start)&&clear(goal)){
    const xs=[start.x,goal.x,edge,right],ys=[start.y,goal.y,edge,bottom];
    for(const b of blocks){xs.push(b.left,b.right);ys.push(b.top,b.bottom);}
    let escape=null,best=Infinity;
    for(const x of xs)for(const y of ys){const p={x,y},d=Math.hypot(x-start.x,y-start.y);if(d<best&&clear(p)){escape=p;best=d;}}
    if(escape){
      if(best>budget)return {x:start.x+(escape.x-start.x)*budget/best-actor.x,y:start.y+(escape.y-start.y)*budget/best-actor.y};
      start=escape;budget-=best;
    }
  }
  let route=[goal];
  if(clear(start)&&clear(goal)&&!segment(start,goal)){
    const points=[start,goal];
    for(const b of blocks)for(const x of [Math.max(edge,b.left),Math.min(right,b.right)])for(const y of [Math.max(edge,b.top),Math.min(bottom,b.bottom)]){
      const p={x,y};if(clear(p)&&!points.some(q=>Math.abs(q.x-x)<eps&&Math.abs(q.y-y)<eps))points.push(p);
    }
    const cost=Array(points.length).fill(Infinity),parent=Array(points.length).fill(-1),visited=new Set();cost[0]=0;
    while(true){
      let next=-1;for(let i=0;i<points.length;i++)if(!visited.has(i)&&cost[i]<(next<0?Infinity:cost[next]))next=i;
      if(next<0||next===1)break;visited.add(next);
      for(let i=1;i<points.length;i++)if(!visited.has(i)){
        const candidate=cost[next]+Math.hypot(points[i].x-points[next].x,points[i].y-points[next].y);
        if(candidate<cost[i]&&segment(points[next],points[i])){cost[i]=candidate;parent[i]=next;}
      }
    }
    if(parent[1]<0)return from;
    route=[];for(let i=1;i!==0;i=parent[i])route.unshift(points[i]);
  }
  let position=start;
  for(const point of route){const d=Math.hypot(point.x-position.x,point.y-position.y);if(d>budget){position={x:position.x+(point.x-position.x)*budget/d,y:position.y+(point.y-position.y)*budget/d};break;}position=point;budget-=d;}
  return {x:position.x-actor.x,y:position.y-actor.y};
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
    else{
      const single=fitPaintedPair(width,height,[actor],occupied,{x:ox,y:oy},2);
      if(single){ox=single.x;oy=single.y;}
    }
  }else if(!fits(actor,viewport)){
    const single=fitPaintedPair(width,height,[actor],occupied,{x:ox,y:oy},2);
    if(single){ox=single.x;oy=single.y;}
  }
  // Smooth the completed layout, not an intermediate target that the later
  // HUD/pair clamps can overwrite. A change of clear-space pocket must not
  // teleport the world underneath a continuously walking character.
  if(same&&previous.scale===scale&&previous.width===width&&previous.height===height&&previous.zoom===settings.zoom){
    const elapsed=Math.max(0,dt),blend=1-Math.exp(-9*elapsed);
    const dx=(ox-previous.ox)*blend,dy=(oy-previous.oy)*blend,distance=Math.hypot(dx,dy),limit=base.pixelsPerMetre*30*elapsed;
    const next=cameraTranslationStep({x:previous.ox,y:previous.oy},{x:ox,y:oy},actor,width,height,occupied,Math.min(distance,limit));
    ox=next.x;oy=next.y;
  }
  const frame={...base,width,height,viewport,occupied,occlusionKnown:true,ox,oy,zoom:settings.zoom,overview:false,
    projectionId,worldUnitsPerMetre:M,pixelsPerMetre:scale*M};
  const corners=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(p=>unproject(frame,p));
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
  frame.bounds={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  frame.camera=unproject(frame,mid);
  return frame;
}
