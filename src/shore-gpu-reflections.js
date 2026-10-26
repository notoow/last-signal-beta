import {quayReflectionSprites} from './quay-view.js';
import {tileAt,TILE} from './rogue-map.js';
import {project} from './world-projection.js';

// Convex clip with UV interpolation keeps the original reflected image intact.
function clip(vertices,polygon){
  const area=polygon.reduce((a,p,i)=>{const q=polygon[(i+1)%polygon.length];return a+p.x*q.y-q.x*p.y;},0),sign=Math.sign(area);
  for(let i=0;i<polygon.length&&vertices.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],side=p=>sign*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));
    const out=[];
    for(let j=0;j<vertices.length;j++){
      const p=vertices[j],q=vertices[(j+1)%vertices.length],dp=side(p),dq=side(q);
      if(dp>=0)out.push(p);
      if((dp>=0)!==(dq>=0)){
        const t=dp/(dp-dq);out.push(Object.fromEntries(['x','y','u','v'].map(k=>[k,p[k]+(q[k]-p[k])*t])));
      }
    }
    vertices=out;
  }
  return vertices;
}
export class ShoreReflections{
  constructor(){this.map=null;this.sources=[];this.commands=[];}
  get(s,frame){
    const sources=quayReflectionSprites(s,frame);
    if(this.map===s.map&&sources.length===this.sources.length&&sources.every((c,i)=>c.image===this.sources[i].image&&c.points.every((v,j)=>v===this.sources[i].points[j])))return this.commands;
    this.map=s.map;this.sources=sources;this.commands=[];
    const tiles=[];
    for(let ty=0;ty<s.map.rows;ty++)for(let tx=0;tx<s.map.cols;tx++)if(tileAt(s.map,tx,ty)){
      const x=tx*TILE,y=ty*TILE,points=[{x,y},{x:x+TILE,y},{x:x+TILE,y:y+TILE},{x,y:y+TILE}].map(p=>project(frame,p));
      tiles.push({points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))});
    }
    for(const source of sources){
      const vertices=[0,1,2,3].map((i)=>({x:source.points[i*2],y:source.points[i*2+1],u:i===1||i===2?1:0,v:i>=2?1:0}));
      const minX=Math.min(...vertices.map(p=>p.x)),maxX=Math.max(...vertices.map(p=>p.x)),minY=Math.min(...vertices.map(p=>p.y)),maxY=Math.max(...vertices.map(p=>p.y));
      for(const tile of tiles){
        if(tile.maxX<minX||tile.minX>maxX||tile.maxY<minY||tile.minY>maxY)continue;
        const polygon=clip(vertices,tile.points);
        for(let i=1;i<polygon.length-1;i++){
          const q=[polygon[0],polygon[i],polygon[i+1],polygon[i+1]];
          this.commands.push({image:source.image,opacity:source.opacity,points:q.flatMap(p=>[p.x,p.y]),uv:q.flatMap(p=>[p.u,p.v])});
        }
      }
    }
    return this.commands;
  }
}
