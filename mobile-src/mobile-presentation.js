// Mobile presentation only. World geometry, input and save data stay unchanged.
export function mobileScale(width,height,zoom=1){
  return Math.max(1.05,Math.min(1.5,width/700,height/300))*zoom;
}
let sampledAt=-Infinity,blocks=[];
export function mobileObstacles(){
  if(!globalThis.document)return [];
  if(performance.now()-sampledAt<100)return blocks;
  sampledAt=performance.now();
  blocks=[...document.querySelectorAll('#mobileStick,#mobileActions,#mobileFlightHud>div')].flatMap(el=>{
    const r=el.getBoundingClientRect();
    return r.width&&r.height&&getComputedStyle(el).visibility!=='hidden'?[{x:r.x,y:r.y,w:r.width,h:r.height,id:el.id||el.className}]:[];
  });
  return blocks;
}
export function mobileLabelFits(c,text,x,y,size){
  const t=c.getTransform(),dpr=Math.min(globalThis.devicePixelRatio||1,2),scale=Math.hypot(t.a,t.b)/dpr;
  const px=(t.a*x+t.c*y+t.e)/dpr,py=(t.b*x+t.d*y+t.f)/dpr,w=c.measureText(text).width*scale;
  const box={x:px-w/2-3,y:py-size-3,w:w+6,h:size+6};
  if(box.x<4||box.x+box.w>c.canvas.clientWidth-4||box.y<4||box.y+box.h>c.canvas.clientHeight-4)return false;
  return !mobileObstacles().some(r=>box.x<r.x+r.w&&box.x+box.w>r.x&&box.y<r.y+r.h&&box.y+box.h>r.y);
}
