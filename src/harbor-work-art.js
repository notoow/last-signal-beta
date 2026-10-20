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
