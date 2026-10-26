import {cliffGpuData} from './cliff-view.js';
import {HARBOR_PROJECTION as P} from './world-projection.js';
const point=(x,y,z=0)=>[P.xx*x+P.xy*y,P.yx*x+P.yy*y-z];

export function recordShoreCliffs(s){
  const data=cliffGpuData(s);if(!data)return null;
  const {top,face,height:H,tile:T,period:period}=data;
  return data.tiles.map(tile=>{
    const {x,y,kind}=tile,commands=[];
    const add=(image,points,uv,tone)=>{
      commands.push({image,points,uv,opacity:1,mipmaps:true,repeat:true});
      if(tone<1)commands.push({color:'#000000',points,opacity:1-tone});
    };
    add(top,[...point(x,y,H),...point(x+T,y,H),...point(x+T,y+T,H),...point(x,y+T,H)],
      [x/period,y/period,(x+T)/period,(y+T)/period],kind==='remembered'?.3:1);
    for(const {side,tones}of tile.edges){
      for(let j=0;j<T;){
        const start=j,tone=tones[j];while(j<T&&tones[j]===tone)j++;if(!tone)continue;
        const a=side==='E'?y+start:x+start,b=side==='E'?y+j:x+j;
        const vertex=(u,z)=>side==='E'?point(x+T,u,z):point(u,y+T,z);
        add(face,[...vertex(a,H),...vertex(b,H),...vertex(b,0),...vertex(a,0)],[a/period,0,b/period,1],tone);
      }
    }
    const p=point(x+T,y+T);
    return {ownerIndex:tile.k,kind,box:{x,y,w:T,h:T},p:{x:p[0],y:p[1]},commands};
  });
}
