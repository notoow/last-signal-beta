import {project,IDENTITY_PROJECTION} from './world-projection.js';
import {visibleSurvey,visibleAt,drawSurvey} from './rogue-vision.js';
import {rasterCliff} from './cliff-raster-cache.js';
const H=12,T=40,TARGET=975,PERIOD=19.2;
const top=new Image(),face=new Image(),variations=[];top.src='assets/art/cliff-top-v1.png';face.src='assets/art/cliff-face-v1.png';
const ready=im=>im.complete&&im.naturalWidth>0;
let retryAttempt=0;
export function retryCliffArt(){retryAttempt++;for(const image of [top,face,...variations])if(!ready(image)){const url=new URL(image.src,document.baseURI);url.searchParams.set('retry',retryAttempt);image.src=url.href;}}
export const h12Ready=()=>ready(top)&&ready(face)&&variations.every(ready);
export const isCliff=(s,t)=>s.map.cliffs?.[t.ty*s.map.cols+t.tx]===1;
const views=new WeakMap(),lastIdentity=new WeakMap();export let h12Diagnostics=null;
function ownerView(s){let v=views.get(s);if(!v){v={current:visibleSurvey(s),remembered:s.survey?.length===s.map.cols*s.map.rows?s.survey:null};views.set(s,v);}return v;}
function ownership(s,k){if(!s.survey)return 'revealed';const v=ownerView(s);return v.current?.[k]?'visible':v.remembered?.[k]===1?'remembered':'unknown';}
// World-space visibility contract for the retained GPU path. No canvas, camera
// phase or texture rasterization participates in deciding which face is seen.
export function cliffGpuData(s){
 if(!h12Ready())return null;views.delete(s);
 const tiles=[];
 for(let ty=0;ty<s.map.rows;ty++)for(let tx=0;tx<s.map.cols;tx++){
  const k=ty*s.map.cols+tx;if(s.map.cliffs?.[k]!==1)continue;
  const kind=ownership(s,k);if(kind==='unknown')continue;
  const x=tx*T,y=ty*T,edges=[];
  for(const side of ['E','S']){
   if(side==='E'?tx+1<s.map.cols&&s.map.cliffs[k+1]===1:ty+1<s.map.rows&&s.map.cliffs[k+s.map.cols]===1)continue;
   const tones=[];
   for(let j=0;j<T;j++){
    const p=side==='E'?{x:x+T-.001,y:y+j+.5}:{x:x+j+.5,y:y+T-.001};
    const visible=!s.survey||kind==='visible'&&visibleAt(s,p),remembered=ownerView(s).remembered?.[k]===1;
    tones.push(visible?1:remembered?.3:0);
   }
   edges.push({side,tones});
  }
  tiles.push({k,x,y,kind,edges});
 }
 return {top,face,height:H,tile:T,period:PERIOD,tiles};
}
function area(q){let a=0;for(let i=0;i<q.length;i++){const p=q[i],r=q[(i+1)%q.length];a+=p.x*r.y-r.x*p.y;}return Math.abs(a)/2;}
const faceQuad=(f,a,b)=>[project(f,a,H),project(f,b,H),project(f,b),project(f,a)];
export function makeCliffs(context,s,f,tiles){
 if(!h12Ready())return [];
 views.delete(s); // Re-evaluate current sight; experiment snapshots are not live caches.
 const objects=[],report={heightWorld:H,materialScope:'all owned cliffs',materialPeriod:PERIOD,variations:false,projection:f.projection||IDENTITY_PROJECTION,scale:f.scale,ox:f.ox,oy:f.oy,unknownSkipped:[],drawn:[],selected:null,partialFaceSegments:0};
 const rasterFrame=f.rasterFrame||f,dpr=f.rasterDpr||context.getTransform().a;
 for(const t of tiles){
  if(!isCliff(s,t))continue;const k=t.ty*s.map.cols+t.tx,kind=ownership(s,k);if(kind==='unknown'){report.unknownSkipped.push(k);continue;}
  const p0={x:t.x,y:t.y},p1={x:t.x+T,y:t.y},p2={x:t.x+T,y:t.y+T},p3={x:t.x,y:t.y+T},topQuad=[p0,p1,p2,p3].map(p=>project(f,p,H)),ground=[p0,p1,p2,p3].map(p=>project(f,p));
  const east=t.tx+1>=s.map.cols||s.map.cliffs[k+1]!==1,south=t.ty+1>=s.map.rows||s.map.cliffs[k+s.map.cols]!==1,edges=[...(east?[{side:'E',p0:p1,p1:p2,quad:faceQuad(f,p1,p2)}]:[]),...(south?[{side:'S',p0:p3,p1:p2,quad:faceQuad(f,p3,p2)}]:[])];
  const all=[...topQuad,...edges.flatMap(e=>e.quad)],left=Math.floor(Math.min(...all.map(p=>p.x))),right=Math.ceil(Math.max(...all.map(p=>p.x))),up=Math.floor(Math.min(...all.map(p=>p.y))),down=Math.ceil(Math.max(...all.map(p=>p.y)));
  if(right<0||left>f.width||down<0||up>f.height)continue;
  const faceStats=[];
  for(const edge of edges){let visibleSegments=0,rememberedSegments=0,omittedSegments=0;edge.tones=[];for(let j=0;j<T;j++){const u=(j+.5)/T,mid={x:edge.p0.x+(edge.p1.x-edge.p0.x)*u,y:edge.p0.y+(edge.p1.y-edge.p0.y)*u},p={x:mid.x-(edge.side==='E'?.001:0),y:mid.y-(edge.side==='S'?.001:0)},visible=!s.survey||kind==='visible'&&visibleAt(s,p),remembered=ownerView(s).remembered?.[k]===1;if(visible){visibleSegments++;edge.tones.push(1);}else if(remembered){rememberedSegments++;edge.tones.push(.3);}else{omittedSegments++;edge.tones.push(0);}}
   if(omittedSegments>0&&visibleSegments+rememberedSegments>0)report.partialFaceSegments++;faceStats.push({side:edge.side,area:area(edge.quad),quad:edge.quad,visibleSegments,rememberedSegments,omittedSegments});}
  const sentinel=null,hex=sentinel?.indices.includes(k)?sentinel.color:null,solid=hex?[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255]:null;
  const raster=rasterCliff({tile:t,frame:rasterFrame,dpr,top,face,variations,decals:false,kind,edges,solid});
  const image=raster?.image||document.createElement('canvas'),bounds={x:left,y:up,w:Math.max(1,right-left),h:Math.max(1,down-up)};
  const obj={type:'cliff',p:project(f,p2),box:{x:t.x,y:t.y,w:T,h:T},bounds:f.rasterFrame?bounds:(raster?.bounds||bounds),image,sourceRect:[0,0,image.width,image.height],ownerIndex:k,raster,draw:()=>{if(!raster)return;context.save();if(f.rasterFrame)context.setTransform(dpr,0,0,dpr,0,0);context.drawImage(image,raster.bounds.x,raster.bounds.y,raster.bounds.w,raster.bounds.h);context.restore();}};
  objects.push(obj);const item={index:k,ownership:kind,heightWorld:H,depth:obj.p.y,groundAnchor:p2,groundQuad:ground,topQuad,faces:faceStats,bounds};report.drawn.push(item);if(k===TARGET)report.selected=item;
 }
 objects.sort((a,b)=>a.p.y-b.p.y);h12Diagnostics=report;return objects;
}
export function identityCliffs(c,s,data,f){
 const tiles=[];for(let ty=0;ty<s.map.rows;ty++)for(let tx=0;tx<s.map.cols;tx++)if(s.map.cliffs[ty*s.map.cols+tx])tiles.push({tx,ty,x:tx*T,y:ty*T});
 const dpr=c.getTransform().a/f.scale,world={...f,width:s.map.width,height:s.map.height,scale:1,sampleScale:f.scale,ox:0,oy:0,projection:IDENTITY_PROJECTION,rasterFrame:f,rasterDpr:dpr};
 const objects=makeCliffs(c,s,world,tiles);for(const o of objects)o.draw();lastIdentity.set(s,{objects,frame:f,dpr});h12Diagnostics.displayFrame={scale:f.scale,ox:f.ox,oy:f.oy,projection:IDENTITY_PROJECTION};
}
export function identitySurvey(c,s){
 if(!s.survey)return;if(!s.map.cliffs)return drawSurvey(c,s);const view=lastIdentity.get(s);if(!view)return drawSurvey(c,s);const {objects,frame:f,dpr}=view,mask=document.createElement('canvas');mask.width=Math.round(f.width*dpr);mask.height=Math.round(f.height*dpr);const m=mask.getContext('2d');m.setTransform(f.scale*dpr,0,0,f.scale*dpr,f.ox*dpr,f.oy*dpr);drawSurvey(m,s);m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='destination-out';for(const o of objects)if(o.raster)m.drawImage(o.image,o.raster.native.x,o.raster.native.y);c.save();c.setTransform(dpr,0,0,dpr,0,0);c.drawImage(mask,0,0,mask.width/dpr,mask.height/dpr);c.restore();
}
