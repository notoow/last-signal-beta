// Opt-in coastal geometry. Protect authored sailing corridors and working quays.
import {harborRoute} from './harbor-water-route.js';
function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function coastalHarbor(original){
 const m=structuredClone(original),gate=m.nodes.find(n=>n.id==='sea-gate'),segments=[];
 for(const edge of m.edges)for(let i=1;i<edge.points.length;i++)segments.push({a:edge.points[i-1],b:edge.points[i],radius:edge.width/2+40});
 const points=[m.spawn,...m.berths.map(b=>({x:b.x,y:m.nodes.find(n=>n.id==='basin-'+b.island).y})),gate];
 for(let i=0;i<points.length-1;i++)for(let j=i+1;j<points.length;j++){
  const path=[points[i],...harborRoute(m,points[i],points[j],70)];
  for(let k=1;k<path.length;k++)segments.push({a:path[k-1],b:path[k],radius:160});
 }
 for(let y=0;y<m.rows;y++)for(let x=0;x<m.cols;x++){
  const k=y*m.cols+x,p={x:x*40+20,y:y*40+20};if(m.tiles[k]||p.x>=gate.x-100)continue;
  if(m.berths.some(b=>Math.abs(p.x-b.x)<300&&p.y>b.landing.y-60&&p.y<b.y+320))continue;
  if(m.islands.some(b=>p.x>b.x-40&&p.x<b.x+b.w+40&&p.y>b.y-40&&p.y<b.y+b.h+40))continue;
  if(segments.some(s=>distance(p,s.a,s.b)<=s.radius))continue;
  m.tiles[k]=4;
 }
 // Never restore rear land across the protected sailing routes.
 m.cliffs=m.tiles.map((t,k)=>t===4&&!original.tiles[k]?1:0);
 return m;
}
