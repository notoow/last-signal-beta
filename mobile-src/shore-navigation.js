import {walkableAt} from './rogue-map.js';

const CELL=12,MAX_NODES=1400,MAX_DETOUR=180;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const paths=new WeakMap();
export function shoreSegment(map,a,b,radius){
  const n=Math.max(1,Math.ceil(distance(a,b)/6));
  for(let i=0;i<=n;i++)if(!walkableAt(map,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},radius))return false;
  return true;
}
// Local ground routing only. The caller supplies an already perceived target:
// a heard can, visible player or home. This never discovers a hidden player.
// Full-radius edge checks prevent corner cutting and crossing harbor water.
export function shoreRoute(map,start,target,radius){
  if(!walkableAt(map,start,radius)||!walkableAt(map,target,0))return null;
  const fits=walkableAt(map,target,radius);
  if(fits&&shoreSegment(map,start,target,radius))return [{x:target.x,y:target.y}];
  return searchRoute(map,start,target,radius,fits,CELL,MAX_NODES)||searchRoute(map,start,target,radius,fits,CELL/2,MAX_NODES*4);
}
function searchRoute(map,start,target,radius,fits,cell,maxNodes){
  // The fine fallback keeps a traversable corner from disappearing merely
  // because an actor's current position shifts the coarse sample lattice.
  const nodes=new Map(),open=new Set(),passable=new Map();
  const key=(x,y)=>`${x},${y}`;
  const point=(x,y)=>({x:start.x+x*cell,y:start.y+y*cell});
  const valid=(x,y)=>{
    const id=key(x,y);if(passable.has(id))return passable.get(id);
    const p=point(x,y),ok=p.x>=Math.min(start.x,target.x)-MAX_DETOUR&&p.x<=Math.max(start.x,target.x)+MAX_DETOUR&&
      p.y>=Math.min(start.y,target.y)-MAX_DETOUR&&p.y<=Math.max(start.y,target.y)+MAX_DETOUR&&walkableAt(map,p,radius);
    passable.set(id,ok);return ok;
  };
  nodes.set('0,0',{x:0,y:0,cost:0,score:distance(start,target),parent:null});open.add('0,0');
  let last=null,expanded=0;
  while(open.size&&expanded++<maxNodes){
    let id=null;for(const candidate of open)if(id===null||nodes.get(candidate).score<nodes.get(id).score)id=candidate;
    open.delete(id);const n=nodes.get(id),p=point(n.x,n.y);
    if(distance(p,target)<=cell*2&&shoreSegment(map,p,target,fits?radius:0)){last=id;break;}
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      const x=n.x+dx,y=n.y+dy,next=key(x,y);
      if(!valid(x,y))continue;
      // Do not allow a diagonal to squeeze between two solid corners.
      if(dx&&dy&&(!valid(n.x+dx,n.y)||!valid(n.x,n.y+dy)))continue;
      const q=point(x,y),cost=n.cost+Math.hypot(dx,dy)*cell;
      if(cost>=(nodes.get(next)?.cost??Infinity)||!shoreSegment(map,p,q,radius))continue;
      nodes.set(next,{x,y,cost,score:cost+distance(q,target),parent:id});open.add(next);
    }
  }
  if(last===null)return null;
  const route=fits?[{x:target.x,y:target.y}]:[];
  while(last!=='0,0'){
    const n=nodes.get(last);route.unshift(point(n.x,n.y));last=n.parent;
  }
  if(!route.length)return [{x:start.x,y:start.y}];
  // Keep necessary corners, discard only edges with the same physical clearance.
  const smooth=[];let from=start,index=0;
  while(index<route.length){
    let far=route.length-1;
    while(far>index&&!shoreSegment(map,from,route[far],radius))far--;
    smooth.push(route[far]);from=route[far];index=far+1;
  }
  return smooth;
}
export function shoreWaypoint(map,enemy,target,radius,time){
  let cached=paths.get(enemy);
  if(!cached||cached.map!==map||cached.radius!==radius||distance(cached.target,target)>12||time>=cached.until){
    cached={map,radius,target:{x:target.x,y:target.y},until:time+.75,route:shoreRoute(map,enemy,target,radius)};
    paths.set(enemy,cached);
  }
  if(!cached.route)return null;
  while(cached.route.length>1&&distance(enemy,cached.route[0])<3)cached.route.shift();
  const p=cached.route[0];
  // Knockback can move an actor to the other side of a corner. Replan, never
  // trust an old edge through an obstacle. Failed searches are briefly cached.
  if(!shoreSegment(map,enemy,p,radius)){
    cached.route=shoreRoute(map,enemy,target,radius);cached.until=time+.75;
    return cached.route?.[0]||null;
  }
  return p;
}
