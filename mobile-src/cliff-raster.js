const mipmaps=new WeakMap();
function mipImage(image,footprint){const level=Math.max(0,Math.min(8,Math.floor(Math.log2(Math.max(1,footprint)))));let levels=mipmaps.get(image);if(!levels){levels=[image];mipmaps.set(image,levels);}for(let i=levels.length;i<=level;i++){const previous=levels[i-1],c=document.createElement('canvas');c.width=Math.max(1,Math.floor((previous.naturalWidth||previous.width)/2));c.height=Math.max(1,Math.floor((previous.naturalHeight||previous.height)/2));const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(previous,0,0,c.width,c.height);levels.push(c);}return levels[level];}
// Canvas pattern prototype: analytical scanline coverage, no per-pixel texture sampling.
export function paintPolygon(ctx,points,image,matrix,tone=1,owns=null){
 const minX=Math.floor(Math.min(...points.map(p=>p.x))),minY=Math.floor(Math.min(...points.map(p=>p.y)));
 const width=Math.ceil(Math.max(...points.map(p=>p.x)))-minX,height=Math.ceil(Math.max(...points.map(p=>p.y)))-minY;
 if(width<=0||height<=0)return;
 const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d');g.fillStyle='#fff';
 for(let row=0;row<height;row++){
  const y=minY+row+.5,xs=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));}
  xs.sort((a,b)=>a-b);
  for(let i=0;i+1<xs.length;i+=2){let left=Math.ceil(xs[i]-.5),right=Math.ceil(xs[i+1]-.5);
    if(owns){left=Math.max(minX,left-1);right=Math.min(minX+width,right+1);
      while(left<right&&!owns(left+.5,y))left++;
      while(right>left&&!owns(right-.5,y))right--;
    }
    g.fillRect(left-minX,row,right-left,1);}
 }
 const pattern=g.createPattern(image,'repeat');pattern.setTransform(new DOMMatrix([matrix.a,matrix.b,matrix.c,matrix.d,matrix.e-minX,matrix.f-minY]));
 g.globalCompositeOperation='source-in';g.fillStyle=pattern;g.fillRect(0,0,width,height);
 if(tone<1){g.globalCompositeOperation='source-atop';g.fillStyle=`rgba(0,0,0,${1-tone})`;g.fillRect(0,0,width,height);}
 ctx.drawImage(c,minX,minY);return c;
}
export function rasterCliff({tile,frame,dpr,top,face,kind,edges,solid=null}){
 const T=40,H=12,P=19.2,m=frame.projection||{xx:1,xy:0,yx:0,yy:1},s=frame.scale*dpr,ox=frame.ox*dpr,oy=frame.oy*dpr,det=m.xx*m.yy-m.xy*m.yx;
 const point=(x,y,z)=>({x:(m.xx*x+m.xy*y)*s+ox,y:(m.yx*x+m.yy*y-z)*s+oy});
 const topPoints=[[tile.x,tile.y],[tile.x+T,tile.y],[tile.x+T,tile.y+T],[tile.x,tile.y+T]].map(([x,y])=>point(x,y,H));
 const all=[...topPoints,...edges.flatMap(e=>e.side==='E'?[point(tile.x+T,tile.y,0),point(tile.x+T,tile.y+T,0)]:[point(tile.x,tile.y+T,0),point(tile.x+T,tile.y+T,0)])];
 const x=Math.floor(Math.min(...all.map(p=>p.x))),y=Math.floor(Math.min(...all.map(p=>p.y))),w=Math.ceil(Math.max(...all.map(p=>p.x)))-x,h=Math.ceil(Math.max(...all.map(p=>p.y)))-y;
 if(x+w<0||x>frame.width*dpr||y+h<0||y>frame.height*dpr)return null;
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,w);canvas.height=Math.max(1,h);const ctx=canvas.getContext('2d');ctx.translate(-x,-y);
 const topFootprint=Math.max(Math.hypot(m.yy,m.yx),Math.hypot(m.xy,m.xx))/Math.abs(det)/s*top.naturalWidth/P;
 let topImage=solid?top:mipImage(top,topFootprint),faceImage=face;
 if(solid){const im=document.createElement('canvas');im.width=im.height=1;im.getContext('2d').fillStyle=`rgba(${solid[0]},${solid[1]},${solid[2]},${solid[3]/255})`;im.getContext('2d').fillRect(0,0,1,1);topImage=faceImage=im;}
 const iw=im=>im.naturalWidth||im.width,ih=im=>im.naturalHeight||im.height;
 paintPolygon(ctx,topPoints,topImage,{a:s*m.xx*P/iw(topImage),b:s*m.yx*P/iw(topImage),c:s*m.xy*P/ih(topImage),d:s*m.yy*P/ih(topImage),e:ox,f:oy-H*s},kind==='remembered'?.3:1,(px,py)=>{const sx=(px-ox)/s,sy=(py-oy)/s,wx=(m.yy*sx-m.xy*(sy+H))/det,wy=(-m.yx*sx+m.xx*(sy+H))/det;return wx>=tile.x&&wx<tile.x+T&&wy>=tile.y&&wy<tile.y+T;});
 for(const edge of edges){const east=edge.side==='E',tx=east?m.xy:m.xx,ty=east?m.yy:m.yx;if(Math.abs(tx)<1e-10)continue;
 if(!solid){const footprint=Math.max(Math.hypot(face.naturalWidth/(P*tx*s),face.naturalHeight*ty/(H*tx*s)),face.naturalHeight/(H*s));faceImage=mipImage(face,footprint);}
 const fixed=east?tile.x+T:tile.y+T,base=east?tile.y:tile.x,cx=(east?m.xx:m.xy)*fixed,cy=(east?m.yx:m.yy)*fixed;
 for(let j=0;j<T;){const tone=edge.tones[j],start=j;while(j<T&&edge.tones[j]===tone)j++;if(!tone)continue;const a=base+start,b=base+j;
 const q=t=>east?{x:fixed,y:t}:{x:t,y:fixed},aa=q(a),bb=q(b),points=[point(aa.x,aa.y,H),point(bb.x,bb.y,H),point(bb.x,bb.y,0),point(aa.x,aa.y,0)];
 paintPolygon(ctx,points,faceImage,{a:tx*s*P/iw(faceImage),b:ty*s*P/iw(faceImage),c:0,d:H*s/ih(faceImage),e:cx*s+ox,f:(cy-H)*s+oy},tone,(px,py)=>{const sx=(px-ox)/s,sy=(py-oy)/s,t=(sx-cx)/tx,z=cy+ty*t-sy;return t>=a&&t<b&&z>=0&&z<H;});
 }
 }
 return {image:canvas,bounds:{x:x/dpr,y:y/dpr,w:canvas.width/dpr,h:canvas.height/dpr},native:{x,y,w:canvas.width,h:canvas.height}};
}
