// Each menu cutout matches its overhead ship. Keep generated source PNGs intact.
export const FLEET_FRAMES={
  woo:{top:[29,97,673,364],body:[0,83,673,281],menu:[30,36,727,440]},
  park:{top:[759,158,758,263],body:[0,42,758,221],menu:[757,80,757,395]},
  han:{top:[18,552,754,304],body:[0,88,754,216],menu:[16,534,756,406]},
  jeong:{top:[805,500,714,400],body:[0,90,714,310],menu:[759,514,757,479]}
};
const images=new Map(),sprites=new Map();let retryAttempt=0;
function imageFor(view,retry=0){
  if(!images.has(view)){const image=new Image();image.src='assets/art/captain-fleet-'+view+'-v1.png'+(retry?'?quayRetry='+retry:'');images.set(view,image);}
  return images.get(view);
}
// Share the menu atlas with docked rendering so readiness includes the actual
// image used by drawDockedCaptainBoat, not a separate cached request.
export function prepareDockedFleet(retry=false){
  const image=imageFor('menu');
  if(retry&&!(image.complete&&image.naturalWidth)){images.delete('menu');return imageFor('menu',++retryAttempt);}
  return image;
}
function sprite(view,captain,paint){
  const image=imageFor(view);
  if(!image.complete||!image.naturalWidth)return null;
  const key=view+captain+paint;if(sprites.has(key))return sprites.get(key);
  const f=FLEET_FRAMES[captain][view],canvas=document.createElement('canvas');canvas.width=f[2];canvas.height=f[3];
  const c=canvas.getContext('2d');
  // The lower atlas silhouettes share a few columns but never the same pixels.
  if(view==='menu'&&(captain==='han'||captain==='jeong')){
    c.beginPath();
    const boundary=[[752,500],[752,780],[780,810],[780,1024]];
    const points=captain==='han'?[[0,500],...boundary,[0,1024]]:[[1536,500],...boundary,[1536,1024]];
    points.forEach(([x,y],i)=>i?c.lineTo(x-f[0],y-f[1]):c.moveTo(x-f[0],y-f[1]));c.closePath();c.clip();
  }
  c.drawImage(image,...f,0,0,f[2],f[3]);
  if(paint!=='harbor'){
    // Tint blue/green painted steel only, keeping face-colored lamps, ropes,
    // rubber and captain-specific cream/ochre/rose wheelhouses readable.
    const pixels=c.getImageData(0,0,canvas.width,canvas.height),d=pixels.data,target=paint==='red'?[177,74,51]:[197,151,56];
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2],chroma=Math.min(g-r,b-r);
      if(!d[i+3]||chroma<4)continue;
      const weight=Math.min(1,(chroma-4)/12),light=Math.min(1.4,(r*.21+g*.72+b*.07)/80);
      for(let k=0;k<3;k++)d[i+k]=d[i+k]*(1-weight)+Math.min(255,target[k]*light)*weight;
    }
    c.putImageData(pixels,0,0);
  }
  sprites.set(key,canvas);return canvas;
}
export function drawCaptainBoat(c,b,captain,paint='harbor'){
  const art=sprite('top',captain,paint);if(!art)return false;
  const [,by,bw,bh]=FLEET_FRAMES[captain].body,sx=b.length/bw,sy=b.width/bh;
  c.save();c.translate(b.x,b.y);c.rotate(b.angle);
  c.fillStyle='#061c2680';c.beginPath();c.ellipse(0,2,b.length*.52,b.width*.53,0,0,Math.PI*2);c.fill();
  c.drawImage(art,-b.length/2,-(by+bh/2)*sy,art.width*sx,art.height*sy);c.restore();return true;
}
// Fixed berth pose only. Keep each captain's existing hull and live paint.
// This is a waterline fit of the menu atlas, never a rotated overhead sprite.
export function drawDockedCaptainBoat(c,point,length,captain,paint='harbor'){
  const art=sprite('menu',captain,paint);if(!art)return null;
  const scale=length/art.width;
  const pivot={x:art.width*.5,y:art.height*.79};
  const bounds={x:point.x-pivot.x*scale,y:point.y-pivot.y*scale,w:art.width*scale,h:art.height*scale};
  c.drawImage(art,bounds.x,bounds.y,bounds.w,bounds.h);
  return bounds;
}
export function drawDepartureShip(canvas,captain,paint='harbor'){
  const image=imageFor('menu'),identity=captain+'-'+paint;
  canvas.dataset.ship=identity;delete canvas.dataset.ready;
  const draw=()=>{
    if(!canvas.isConnected||canvas.dataset.ship!==identity)return;
    const art=sprite('menu',captain,paint);if(!art)return;
    const c=canvas.getContext('2d'),scale=Math.min(canvas.width*.96/art.width,canvas.height*.88/art.height);
    const w=art.width*scale,h=art.height*scale,x=(canvas.width-w)/2,y=canvas.height*.93-h;
    c.clearRect(0,0,canvas.width,canvas.height);
    c.save();c.globalAlpha=.14;c.translate(0,y+h);c.scale(1,-.18);c.drawImage(art,x,-h,w,h);c.restore();
    c.drawImage(art,x,y,w,h);canvas.dataset.ready=identity;
  };
  if(image.complete&&image.naturalWidth)draw();else image.addEventListener('load',draw,{once:true});
}
