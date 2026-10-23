// Generated raster assets are presentation only: collision bodies remain authoritative.
const asset=name=>{if(typeof Image==='undefined')return null;const image=new Image();image.src='assets/art/'+name+'-v1.png';return image;};
const fleet=asset('fleet-sprites'),tiles=asset('harbor-tiles'),water=asset('harbor-water'),modules=asset('harbor-modules'),details=asset('harbor-details');
const materials=new Map(),patterns=new WeakMap();
function material(c,key,image,source,width,height){
 if(!ready(image))return null;
 if(!materials.has(key)){const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;canvas.getContext('2d').drawImage(image,...source,0,0,canvas.width,canvas.height);materials.set(key,canvas);}
 let cache=patterns.get(c);if(!cache){cache=new Map();patterns.set(c,cache);}if(!cache.has(key)){const pattern=c.createPattern(materials.get(key),'repeat');pattern.setTransform(new DOMMatrix().scale(.5));cache.set(key,pattern);}return cache.get(key);
}
function fillMaterial(c,key,source,w,tileW,tileH=tileW){const pattern=material(c,key,tiles,source,tileW,tileH);if(!pattern)return false;c.fillStyle=pattern;c.fillRect(w.x,w.y,w.w,w.h);return true;}

const ready=image=>image?.complete&&image.naturalWidth>0;
const frames={tug:[25,115,680,315],bus:[725,170,800,260],inspection:[20,520,835,335],pontoon:[870,530,650,350],ice:[870,530,650,350]};
const boatCache=new Map();
const contactCache=new Map();
// Recolour only blue-green painted steel; preserve lamps, rope, rust and rubber.
const hullCache=new WeakMap();
export function paintedTug(image,paint='harbor'){
 if(!ready(image)||paint==='harbor')return image;
 let cache=hullCache.get(image);if(!cache){cache=new Map();hullCache.set(image,cache);}if(cache.has(paint))return cache.get(paint);
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height),d=pixels.data,target=paint==='red'?[177,74,51]:[197,151,56];
 for(let y=Math.floor(canvas.height*.48);y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
  const i=(y*canvas.width+x)*4,r=d[i],g=d[i+1],b=d[i+2],chroma=Math.min(g-r,b-r);
  if(!d[i+3]||chroma<3)continue;
  const weight=Math.min(1,(chroma-3)/12),light=Math.min(1.5,(r*.21+g*.72+b*.07)/80);
  for(let k=0;k<3;k++)d[i+k]=d[i+k]*(1-weight)+Math.min(255,target[k]*light)*weight;
 }
 c.putImageData(pixels,0,0);cache.set(paint,canvas);return canvas;
}
export const harborFrames={warehouse:[42,92,594,362],hut:[689,140,210,305],pump:[944,140,342,304],crane:[1338,40,399,416],edge:[44,617,490,173],corner:[585,499,340,336],bollards:[987,660,361,98],crates:[1418,564,310,261]};
export function harborPieces(w){
 const id=w.id||'',yard=/yard|island/.test(id),warehouse=/hall|^s-(upper|mid|lower)$/.test(id),service=/pump|control/.test(id),out=[];
 const put=(kind,x,y,width,height)=>{if(x>=w.x&&y>=w.y&&x+width<=w.x+w.w&&y+height<=w.y+w.h)out.push({kind,x,y,w:width,h:height});};
 if((yard||warehouse)&&w.w>=170&&w.h>=110){const limit=yard&&w.w>300?w.w-86:w.w-12,rows=yard?1:Math.min(3,Math.floor((w.h-20)/104));for(let row=0;row<rows;row++)for(let x=16;x+144<=limit;x+=160)put('warehouse',w.x+x,w.y+14+row*104,144,84);}
 if(yard&&w.w>300&&w.h>160)put('crane',w.x+w.w-68,w.y+w.h-86,48,62);
 if((yard||warehouse)&&w.h>120)for(let i=0,x=18;x<w.w-90;x+=76,i++)if(i%3!==1)put('crates',w.x+x,w.y+w.h-39,24,22);
 if(service&&w.w>90&&w.h>100){put('hut',w.x+14,w.y+w.h-83,30,42);put('pump',w.x+w.w/2-24,w.y+w.h-86,48,44);}
 if(w.w>80&&w.h>50)put('bollards',w.x+w.w-34,w.y+5,22,6);
 if(w.w>=40&&w.h>=35){for(let x=0;x+48<=w.w;x+=46)put('edge',w.x+x,w.y+w.h-18,48,18);put('corner',w.x,w.y+w.h-30,30,30);}
 return out;
}
function drawHarborProp(c,p){if(!ready(modules))return false;const f=harborFrames[p.kind],scale=Math.min(p.w/f[2],p.h/f[3]),width=f[2]*scale,height=f[3]*scale;c.drawImage(modules,...f,p.x+(p.w-width)/2,p.y+p.h-height,width,height);return true;}
// Dressing stays on already-solid quay plots; it never creates hidden obstacles or targets.
export const detailFrames={net:[81,43,663,434],fenders:[855,29,600,432],rope:[117,545,719,419],lamp:[948,471,514,507]};
export function harborDressing(w){
 const out=[];if(w.w<130||w.h<100||/pontoon|boom|cable/.test(w.id||''))return out;
 const seed=[...(w.id||'quay')].reduce((n,ch)=>n+ch.charCodeAt(0),0);
 const put=(kind,x,y,width,height)=>out.push({kind,x,y,w:width,h:height});
 for(let i=0,x=40+(seed%29);x<w.w-62;x+=109,i++){
  if(i%3===seed%3)put('net',w.x+x,w.y+w.h-62,29,22);
  else put('rope',w.x+x,w.y+w.h-44,16,13);
 }
 put('lamp',w.x+w.w-53,w.y+w.h-54,18,30);
 for(let x=48+(seed%17);x<w.w-30;x+=91)put('fenders',w.x+x,w.y+w.h-13,15,13);
 return out;
}
function detailSprite(c,p){if(!ready(details))return;const f=detailFrames[p.kind],scale=Math.min(p.w/f[2],p.h/f[3]),width=f[2]*scale,height=f[3]*scale;c.drawImage(details,...f,p.x+(p.w-width)/2,p.y+p.h-height,width,height);}
export const gameArt={
 dressing(c,w,time=0,powered=true,walls=[]){
  const pieces=harborDressing(w);if(!pieces.length)return;
  c.save();c.beginPath();c.rect(w.x,w.y,w.w,w.h);c.clip();
  // Dark salt-wet working strip and worn drainage seams, underneath the small objects.
  const wet=c.createLinearGradient(0,w.y+w.h-46,0,w.y+w.h);wet.addColorStop(0,'#20393900');wet.addColorStop(1,'#152c2c85');c.fillStyle=wet;c.fillRect(w.x,w.y+w.h-46,w.w,46);
  c.strokeStyle='#182a2933';c.lineWidth=1;for(let x=w.x+39;x<w.x+w.w-24;x+=83){c.beginPath();c.moveTo(x,w.y+w.h-35);c.lineTo(x+22,w.y+w.h-35);c.stroke();}
  for(const p of pieces){
   if(p.kind==='lamp'&&powered&&ready(details)){const x=p.x+p.w*.65,y=p.y+p.h*.42,g=c.createRadialGradient(x,y,1,x,y,45);g.addColorStop(0,'#f5cb7350');g.addColorStop(1,'#e5b45a00');c.fillStyle=g;c.fillRect(x-45,y-45,90,90);}
   detailSprite(c,p);
  }
  c.restore();
  // Broken reflections belong to real worklights, and stop when harbor power is cut.
  if(powered&&ready(details))for(const p of pieces.filter(p=>p.kind==='lamp')){const x=p.x+p.w*.65,y=w.y+w.h;c.save();for(let i=0;i<7;i++){if(walls.some(other=>x>other.x-15&&x<other.x+other.w+15&&y+5+i*4>other.y&&y+5+i*4<other.y+other.h))continue;const flicker=Math.sin(time*1.3+i*2.7),width=3+i*1.4;c.strokeStyle='rgba(232,190,105,'+(.13*(1-i/7))+')';c.lineWidth=1.3;c.beginPath();c.moveTo(x-width+flicker*2,y+5+i*4);c.lineTo(x+width+flicker*2,y+5+i*4);c.stroke();}c.restore();}
 },
 boat(c,b,kind='tug',paint='harbor'){
  if(!ready(fleet))return false;const frame=frames[kind]||frames.bus,key=kind+'-'+paint;
  if(!boatCache.has(key)){
   const canvas=document.createElement('canvas');canvas.width=frame[2];canvas.height=frame[3];const ctx=canvas.getContext('2d');ctx.drawImage(fleet,...frame,0,0,canvas.width,canvas.height);
   if(kind==='tug'&&paint!=='harbor'){ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.42;ctx.fillStyle=paint==='red'?'#a24e37':'#bd9947';ctx.fillRect(0,0,canvas.width,canvas.height);}
   boatCache.set(key,canvas);
  }
  if(!contactCache.has(key)){const silhouette=document.createElement('canvas');silhouette.width=frame[2];silhouette.height=frame[3];const sc=silhouette.getContext('2d');sc.drawImage(boatCache.get(key),0,0);sc.globalCompositeOperation='source-in';sc.fillStyle='#051e24';sc.fillRect(0,0,silhouette.width,silhouette.height);contactCache.set(key,silhouette);}
  c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.globalAlpha=.55;c.drawImage(contactCache.get(key),-b.length*.52+1,-b.width*.55+2,b.length*1.04,b.width*1.1);c.globalAlpha=1;c.drawImage(boatCache.get(key),-b.length/2,-b.width/2,b.length,b.width);c.restore();return true;
 },
 water(c,w,h,time=0){
  const image=ready(water)?water:tiles,source=ready(water)?[0,0,water.naturalWidth,water.naturalHeight]:[0,0,512,512];
  const pattern=material(c,ready(water)?'sea-v3':'sea-fallback',image,source,384,384);if(!pattern)return false;
  c.save();c.fillStyle='#10363e';c.fillRect(0,0,w,h);
  // Slow advection, low contrast, and a second broad scale break up the tile rhythm.
  const dx=(time*.7)%384,dy=(time*.24)%384;
  c.save();c.translate(dx,dy);c.globalAlpha=.34;c.fillStyle=pattern;c.fillRect(-384,-384,w+768,h+768);c.restore();
  c.save();c.scale(1.73,1.73);c.translate(-(time*.22)%384,0);c.globalAlpha=.07;c.fillStyle=pattern;c.fillRect(-384,0,w/1.73+768,h/1.73);c.restore();
  c.restore();return true;
 },
 wall(c,w){
  if(!ready(tiles))return false;const id=w.id||'',wood=/pontoon|boom|cable/.test(id);
  c.save();c.fillStyle='#06151c88';c.fillRect(w.x+4,w.y+5,w.w,w.h);c.beginPath();c.rect(w.x,w.y,w.w,w.h);c.clip();
  c.fillStyle=wood?'#655e48':'#797868';c.fillRect(w.x,w.y,w.w,w.h);c.globalAlpha=.52;fillMaterial(c,wood?'deck':'paving',wood?[580,600,340,280]:[1280,30,200,200],w,wood?40:96,wood?32:96);c.globalAlpha=1;
  // A quay is paved land assembled from individual sprites, never a stretched building picture.
  c.fillStyle='#111f21';c.fillRect(w.x,w.y+w.h-7,w.w,7);
  fillMaterial(c,'coping',[1050,344,460,74],{x:w.x,y:w.y+w.h-12,w:w.w,h:8},72,12);
  for(const piece of harborPieces(w))drawHarborProp(c,piece);
  c.restore();c.save();c.strokeStyle='#a4b5aa88';c.lineWidth=1.5;c.strokeRect(w.x+.75,w.y+.75,w.w-1.5,w.h-1.5);c.restore();return true;
 }
};
