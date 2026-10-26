const image=typeof Image==='undefined'?null:new Image();
if(image)image.src='assets/art/harbor-interactions-v1.png';
const frames={winch:[50,120,470,365],buoy:[550,135,345,360],power:[965,125,355,370],cleat:[1360,190,375,300],gangway:[30,600,490,200],rope:[620,690,140,34],barrier:[860,610,460,180],dock:[1350,600,395,215]};
const ready=()=>image?.complete&&image.naturalWidth>0;
export function workSprite(c,kind,x,y,w,h,angle=0,active=true){
  if(!ready())return false;
  const f=frames[kind],ratio=Math.min(w/f[2],h/f[3]);
  c.save();c.translate(x,y);c.rotate(angle);if(!active)c.globalAlpha=.5;
  c.drawImage(image,...f,-f[2]*ratio/2,-f[3]*ratio/2,f[2]*ratio,f[3]*ratio);
  c.restore();return true;
}
// Repeat the braided raster along the actual line; sag disappears under tension.
export function workRope(c,a,b,tension=0,width=3.8,active=true){
  if(!ready())return false;
  const d=Math.hypot(b.x-a.x,b.y-a.y),sag=Math.min(18,d*.12)*(1-Math.min(1,tension));
  const steps=Math.max(1,Math.ceil(d/10)),f=frames.rope;
  let prev=a;c.save();if(!active)c.globalAlpha=.5;
  for(let i=1;i<=steps;i++){
    const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t+4*sag*t*(1-t)};
    const dx=p.x-prev.x,dy=p.y-prev.y;c.save();c.translate(prev.x,prev.y);c.rotate(Math.atan2(dy,dx));
    c.drawImage(image,...f,0,-width/2,Math.hypot(dx,dy)+.6,width);c.restore();prev=p;
  }
  c.restore();return true;
}
export function workBuoy(c,p,time=0,index=0){
  const bob=Math.sin(time*2+index*1.7)*1.2;
  c.save();c.fillStyle='#06191b70';c.beginPath();c.ellipse(p.x,p.y+5,10,4,0,0,Math.PI*2);c.fill();c.restore();
  return workSprite(c,'buoy',p.x,p.y+bob,23,23,Math.sin(time*.8+index)*.07);
}

// Screen-projected, stationary dock fittings reuse their full painted raster.
// Underway ropes retain the live renderer. Bound storage for repeated zooms.
const dockLayers=new Map(),dockCandidates=new Set();let dockPixels=0;
function dockRaster(c,key,bounds,anchor,paint){
  const t=c.getTransform();
  if(t.b||t.c||t.a!==t.d||t.a<=0||c.globalAlpha!==1||c.globalCompositeOperation!=='source-over'||c.filter!=='none'||c.shadowBlur||c.shadowOffsetX||c.shadowOffsetY)return null;
  const dpr=t.a,px=t.e+anchor.x*dpr,py=t.f+anchor.y*dpr;
  const left=Math.floor(px+bounds.x*dpr),top=Math.floor(py+bounds.y*dpr);
  const w=Math.ceil(px+(bounds.x+bounds.w)*dpr)-left,h=Math.ceil(py+(bounds.y+bounds.h)*dpr)-top,pixels=w*h;
  bounds={x:(left-px)/dpr,y:(top-py)/dpr,w:w/dpr,h:h/dpr};
  key=key.concat(bounds.x,bounds.y);
  if(!w||!h||pixels>1048576)return null;
  key=key.map(v=>typeof v==='number'?Math.round(v*1e6)/1e6:v).concat(dpr,c.imageSmoothingEnabled,c.imageSmoothingQuality).join(':');
  let layer=dockLayers.get(key);
  if(layer){dockLayers.delete(key);dockLayers.set(key,layer);return layer;}
  // Moving/zooming projections often never reuse this exact pixel phase.
  // Paint their first request directly instead of allocating a throwaway canvas.
  if(!dockCandidates.has(key)){
    dockCandidates.add(key);
    if(dockCandidates.size>48)dockCandidates.delete(dockCandidates.values().next().value);
    return null;
  }
  dockCandidates.delete(key);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=c.imageSmoothingEnabled;ctx.imageSmoothingQuality=c.imageSmoothingQuality;
  ctx.setTransform(dpr,0,0,dpr,-bounds.x*dpr,-bounds.y*dpr);paint(ctx);
  layer={canvas,...bounds,w:w/dpr,h:h/dpr,pixels};
  while(dockLayers.size&&(dockLayers.size>=24||dockPixels+pixels>2097152)){
    const first=dockLayers.keys().next().value;dockPixels-=dockLayers.get(first).pixels;dockLayers.delete(first);
  }
  dockLayers.set(key,layer);dockPixels+=pixels;return layer;
}
function drawDockRaster(c,layer,x,y){
  c.drawImage(layer.canvas,0,0,layer.canvas.width,layer.canvas.height,x+layer.x,y+layer.y,layer.w,layer.h);
}
export function dockWorkSprite(c,kind,x,y,w,h,angle=0,active=true){
  if(!ready())return false;
  const size=Math.ceil(Math.hypot(w,h)+4),bounds={x:-size/2,y:-size/2,w:size,h:size};
  const layer=dockRaster(c,['sprite',kind,w,h,angle,active],bounds,{x,y},ctx=>workSprite(ctx,kind,0,0,w,h,angle,active));
  if(!layer)return workSprite(c,kind,x,y,w,h,angle,active);
  drawDockRaster(c,layer,x,y);return true;
}
export function dockWorkRope(c,a,b,tension=0,width=3.8,active=true){
  if(!ready())return false;
  const dx=b.x-a.x,dy=b.y-a.y,pad=width+22;
  const bounds={x:Math.min(0,dx)-pad,y:Math.min(0,dy)-pad,w:Math.ceil(Math.abs(dx)+2*pad),h:Math.ceil(Math.abs(dy)+2*pad)};
  const layer=dockRaster(c,['rope',dx,dy,tension,width,active],bounds,a,ctx=>workRope(ctx,{x:0,y:0},{x:dx,y:dy},tension,width,active));
  if(!layer)return workRope(c,a,b,tension,width,active);
  drawDockRaster(c,layer,a.x,a.y);return true;
}
