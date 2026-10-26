import {shoreSegment} from './shore-navigation.js';
import {walkableAt} from './rogue-map.js';
import {crewRadius} from './shore-scale.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function clearance(a,b,c){
 const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.y-a.y)*dy)/den)):0;
 return Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y);
}
// Local collision-aware escort route; the captain remains a moving obstacle.
const routes=new WeakMap(); export function aroundCaptain(s,target){
 const from=s.rescue,person=s.person,radius=crewRadius(s),gap=6.8;
 const clear=(a,b)=>clearance(a,b,person)>=gap-1e-6&&shoreSegment(s.map,a,b,radius);
 if(clear(from,target))return target;
 if(distance(from,person)<gap){
  const points=[target];
  for(let i=0;i<16;i++)points.push({x:person.x+Math.cos(i*Math.PI/8)*8,y:person.y+Math.sin(i*Math.PI/8)*8});
  const outward=points.filter(p=>(p.x-from.x)*(from.x-person.x)+(p.y-from.y)*(from.y-person.y)>=-1e-7&&walkableAt(s.map,p,radius)&&shoreSegment(s.map,from,p,radius));
  return outward.sort((a,b)=>distance(from,a)+distance(a,target)-distance(from,b)-distance(b,target))[0]||null;
 }
 let cached=routes.get(from);
 if(cached&&cached.map===s.map&&distance(cached.person,person)<.5&&distance(cached.target,target)<.01){
  while(cached.path.length>1&&distance(from,cached.path[0])<.15)cached.path.shift();
  if(cached.path[0]&&clear(from,cached.path[0])){return cached.path[0];}
 }

 const nodes=[from,target];
 for(let i=0;i<16;i++){
  const p={x:person.x+Math.cos(i*Math.PI/8)*8,y:person.y+Math.sin(i*Math.PI/8)*8};
  if(walkableAt(s.map,p,radius))nodes.push(p);
 }
 const costs=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set();costs[0]=0;
 while(done.size<nodes.length){
  let a=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(a<0||costs[i]<costs[a]))a=i;
  if(a<0||!Number.isFinite(costs[a]))return null;if(a===1)break;done.add(a);
  for(let b=0;b<nodes.length;b++)if(!done.has(b)&&clear(nodes[a],nodes[b])){
   const value=costs[a]+distance(nodes[a],nodes[b]);if(value<costs[b]){costs[b]=value;prev[b]=a;}
  }
 }
 if(prev[1]<0)return null;const path=[];for(let next=1;next>0;next=prev[next])path.unshift(nodes[next]);routes.set(from,{map:s.map,person:{...person},target:{...target},path});return path[0];
}


