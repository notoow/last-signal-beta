const cache=new WeakMap();
function sourceAlpha(image,u,v){
 let a=cache.get(image);
 if(!a){
  const c=document.createElement('canvas');c.width=384;c.height=256;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);
  a=ctx.getImageData(0,0,c.width,c.height).data;cache.set(image,a);
 }
 const x=Math.floor(u*384),y=Math.floor(v*256);return x<0||y<0||x>=384||y>=256?0:a[(y*384+x)*4+3];
}
function weights(p,a,b,c){
 const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-10)return null;
 const x=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den;
 const y=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den,z=1-x-y;
 return Math.min(x,y,z)>=-1e-7?[x,y,z]:null;
}
export function commandCovers(command,p,alpha=sourceAlpha){
 if(!command.image)return false;
 const xy=Array.from({length:4},(_,i)=>command.points.slice(i*2,i*2+2)),r=command.uv||[0,0,1,1];
 const uv=r.length===4?[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]]:Array.from({length:4},(_,i)=>r.slice(i*2,i*2+2));
 for(const ids of [[0,1,2],[0,2,3]]){
  const w=weights(p,...ids.map(i=>xy[i]));if(!w)continue;
  const u=ids.reduce((n,i,j)=>n+w[j]*uv[i][0],0),v=ids.reduce((n,i,j)=>n+w[j]*uv[i][1],0);
  if(alpha(command.image,u,v)>96)return true;
 }return false;
}
export function coverRatio(body,covers,bounds,alpha){
 let total=0,covered=0;
 for(let y=0;y<7;y++)for(let x=0;x<5;x++){
  const p=[bounds.x+(x+.5)/5*bounds.w,bounds.y+(y+.5)/7*bounds.h];
  if(!body.some(c=>commandCovers(c,p,alpha)))continue;
  total++;if(covers.some(c=>commandCovers(c,p,alpha)))covered++;
 }return total?covered/total:0;
}
export function coverState(previous,ratio,dt){
 const state=previous?{...previous}:{active:false,clear:0};
 if(!state.active&&ratio>=.35){state.active=true;state.clear=0;}
 if(state.active){state.clear=ratio<.12?state.clear+Math.min(.1,Math.max(0,dt)):0;if(state.clear>=.12)state.active=false;}
 return state;
}

// Only authored sprite images contribute to a body silhouette, not UI bars.
export function actorImageCommands(commands){return commands.filter(command=>!!command.image);}
