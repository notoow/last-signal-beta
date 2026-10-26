import {rasterCliff as paint} from './cliff-raster.js';
// Bounded raised-terrain raster cache. Each entry owns an immutable raster; any visibility change
// changes the key. Bound both entry count and total physical pixels.
const layers=new Map(),images=new WeakMap();let imageId=0,pixels=0;
const id=im=>{if(!images.has(im))images.set(im,++imageId);return images.get(im);};
export function rasterCliff(args){
 const {tile,frame:f,dpr,top,face,kind,edges,solid}=args,m=f.projection||{xx:1,xy:0,yx:0,yy:1};
 const px=f.ox*dpr,py=f.oy*dpr;
 const key=JSON.stringify([tile.x,tile.y,f.scale,dpr,m.xx,m.xy,m.yx,m.yy,px-Math.floor(px),py-Math.floor(py),id(top),id(face),kind,edges.map(e=>[e.side,e.tones]),solid||null]);
 let entry=layers.get(key);
 if(entry){layers.delete(key);layers.set(key,entry);const dx=px-entry.px,dy=py-entry.py,r=entry.r;
 if(r.native.x+dx+r.native.w<0||r.native.x+dx>f.width*dpr||r.native.y+dy+r.native.h<0||r.native.y+dy>f.height*dpr)return null;
 return {...r,bounds:{...r.bounds,x:r.bounds.x+dx/dpr,y:r.bounds.y+dy/dpr},native:{...r.native,x:r.native.x+dx,y:r.native.y+dy}};}
 const r=paint(args);if(!r)return r;const size=r.image.width*r.image.height;
 if(size>4194304)return r;
 while(layers.size&&(layers.size>=64||pixels+size>4194304)){const first=layers.keys().next().value;pixels-=layers.get(first).size;layers.delete(first);}
 layers.set(key,{r,size,px,py});pixels+=size;return r;
}
export const cacheStats=()=>({entries:layers.size,pixels});
