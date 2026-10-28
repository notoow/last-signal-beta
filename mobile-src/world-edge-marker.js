import {project} from './world-projection.js';

// The camera's inner framing pocket protects the actor, not the sea's edge.
export function worldEdgeMarker(frame,world,inset=26){
  const p=project(frame,world),w=frame.width,h=frame.height;
  if(![p.x,p.y,w,h].every(Number.isFinite)||w<=inset*2||h<=inset*2)return null;
  if(p.x>=0&&p.y>=0&&p.x<=w&&p.y<=h)return null;
  const half=12,gap=8,left=inset,right=w-inset,bottom=h-inset,cx=w/2,cy=h/2;
  const dx=p.x-cx,dy=p.y-cy,t=Math.min(dx>0?(right-cx)/dx:dx<0?(left-cx)/dx:Infinity,dy>0?(bottom-cy)/dy:dy<0?(left-cy)/dy:Infinity);
  const ideal={x:cx+dx*t,y:cy+dy*t},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const blocks=(frame.occupied||[]).filter(b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0);
  const xs=[left,right,clamp(ideal.x,left,right)],ys=[left,bottom,clamp(ideal.y,left,bottom)];
  for(const b of blocks){xs.push(b.x-gap-half,b.x+b.w+gap+half);ys.push(b.y-gap-half,b.y+b.h+gap+half);}
  const candidates=[...xs.filter(x=>x>=left&&x<=right).flatMap(x=>[{x,y:left},{x,y:bottom}]),...ys.filter(y=>y>=left&&y<=bottom).flatMap(y=>[{x:left,y},{x:right,y}])];
  const clear=q=>blocks.every(b=>q.x+half<=b.x-gap||q.x-half>=b.x+b.w+gap||q.y+half<=b.y-gap||q.y-half>=b.y+b.h+gap);
  let best=null,cost=Infinity;
  for(const q of candidates){const d=Math.hypot(q.x-ideal.x,q.y-ideal.y);if(d<cost&&clear(q)){best=q;cost=d;}}
  return best?{...best,angle:Math.atan2(p.y-best.y,p.x-best.x),screenEdge:true}:null;
}
