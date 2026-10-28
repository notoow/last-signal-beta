import {cliffGpuData} from './cliff-view.js';
import {HARBOR_PROJECTION as P} from './world-projection.js';
const point=(x,y,z=0)=>[P.xx*x+P.xy*y,P.yx*x+P.yy*y-z];

export function recordShoreCliffs(s){
  const data=cliffGpuData(s);if(!data)return null;
  const {top,face,height:H,tile:T,period:period}=data;
  return data.tiles.map(tile=>{
    const {x,y,kind}=tile,commands=[];
    const fog=(points,world)=>commands.push({atlas:'shore-fog',points,uv:world.flatMap(([wx,wy])=>[wx/(s.map.cols*T),wy/(s.map.rows*T)])});
    const add=(image,points,uv,tone)=>{
      commands.push({image,points,uv,opacity:1,mipmaps:true,repeat:true});
      if(tone<1)commands.push({color:'#000000',points,opacity:1-tone});
    };
    const topPoints=[...point(x,y,H),...point(x+T,y,H),...point(x+T,y+T,H),...point(x,y+T,H)];
    add(top,topPoints,[x/period,y/period,(x+T)/period,(y+T)/period],1);
    fog(topPoints,[[x,y],[x+T,y],[x+T,y+T],[x,y+T]]);
    for(const {side,tones}of tile.edges){
      {
        const a=side==='E'?y:x,b=a+T;
        const vertex=(u,z)=>side==='E'?point(x+T,u,z):point(u,y+T,z);
        const points=[...vertex(a,H),...vertex(b,H),...vertex(b,0),...vertex(a,0)];
        add(face,points,[a/period,0,b/period,1],1);
        const ground=u=>side==='E'?[x+T-.001,u]:[u,y+T-.001];
        fog(points,[ground(a),ground(b),ground(b),ground(a)]);
      }
    }
    const p=point(x+T,y+T);
    return {ownerIndex:tile.k,kind,box:{x,y,w:T,h:T},p:{x:p[0],y:p[1]},commands};
  });
}
