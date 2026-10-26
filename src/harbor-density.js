import {harborRoute} from './harbor-water-route.js';
import {restoreInnerBarriers} from './harbor-inner-barriers.js';
const BANDS=[[800,960,1120],[840,1000,1160],[760,920,1080],[840,920,1000]];
export function harborApproachLengths(map){return map.berths.map(berth=>{
 const basin=map.nodes.find(n=>n.id==='basin-'+berth.island);
 // The planner returns future waypoints, so include the first sailing leg.
 const points=[map.spawn,...harborRoute(map,map.spawn,{x:berth.x,y:basin.y},70)];
 return points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
});}
// Searching a second quay and continuing to the boss must not become a longer
// commute merely because the first approach improved.
export function harborExplorationLengths(map){
 const points=[...map.berths.map(b=>({x:b.x,y:map.nodes.find(n=>n.id==='basin-'+b.island).y})),map.nodes.find(n=>n.id==='sea-gate')];
 const lengths=[];
 for(let i=0;i<points.length-1;i++)for(let j=i+1;j<points.length;j++){
  const route=[points[i],...harborRoute(map,points[i],points[j],70)];
  lengths.push(route.slice(1).reduce((n,p,k)=>n+Math.hypot(p.x-route[k].x,p.y-route[k].y),0));
 }
 return lengths;
}
export function selectDenseHarbor(original,build,validate){
 const before=harborApproachLengths(original),total=before.reduce((a,b)=>a+b,0);
 const onward=harborExplorationLengths(original);
 let selected=original,best=1;
 for(const bands of BANDS){
  let map,after;
  try{map=restoreInnerBarriers(build(bands));
   if(map.topology!==original.topology||!validate(map).ok)continue;
   after=harborApproachLengths(map);
  }catch{continue;} // A rejected layout never invalidates the original seed.
  const ratio=after.reduce((a,b)=>a+b,0)/total;
  if(ratio>=.95||ratio>=best||after.some((n,i)=>n>before[i]+.01))continue;
  try{if(harborExplorationLengths(map).some((n,i)=>n>onward[i]+.01))continue;}catch{continue;}
  selected=map;best=ratio;
 }
 return selected;
}
