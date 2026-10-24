// Mobile presentation only. World geometry, input and save data stay unchanged.
export function mobileScale(width,height,zoom=1){
  return Math.max(1.15,Math.min(1.5,width/700,height/300))*zoom;
}
let blocks=null,observer=null,observed=[],clearScheduled=false;
const visibleRect=el=>{
  const r=el.getBoundingClientRect(),style=getComputedStyle(el);
  return r.width&&r.height&&style.visibility!=='hidden'&&style.visibility!=='collapse'?{x:r.x,y:r.y,w:r.width,h:r.height}:null;
};
const union=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.max(a.x+a.w,b.x+b.w)-Math.min(a.x,b.x),h:Math.max(a.y+a.h,b.y+b.h)-Math.min(a.y,b.y)});
function watchHud(){
  const roots=[document.getElementById('mobileControls'),document.getElementById('mobileFlightHud')];
  if(!observer||roots.some((el,i)=>el!==observed[i])){
    observer?.disconnect();observer=new MutationObserver(()=>{blocks=null;});observed=roots;blocks=null;
    for(const el of roots)if(el)observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','style','data-mode','data-layout','data-context-count','data-special']});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-mobile-move-side']});
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class','style','hidden']});
  }
  // A caller may measure immediately after changing the DOM, before the
  // observer microtask. Never return the previous mode/stick/button bounds.
  if(observer.takeRecords().length)blocks=null;
}
export function mobileObstacles(){
  if(!globalThis.document)return [];
  watchHud();if(blocks)return blocks;
  // Share layout reads between camera and labels within this frame, while
  // resize/font/layout changes are remeasured by the next rendered frame.
  if(!clearScheduled){clearScheduled=true;requestAnimationFrame(()=>{blocks=null;clearScheduled=false;});}
  blocks=[...document.querySelectorAll('#mobileStick,#mobileActions,#mobileTools,#mobileFlightHud>div,#mobileMinimap,#mobileGullHorn')].flatMap(el=>{
    let r=visibleRect(el);if(!r)return [];
    // Grid children and transformed bars can protrude beyond their parent's
    // rectangle. Keep the group id, but include every visible child boundary.
    if(!['mobileStick','mobileTools'].includes(el.id))for(const child of el.querySelectorAll('*')){
      // The tools tray clips its scrolled children and has its own occupied
      // rectangle; do not turn the empty gap above main controls into a box.
      // The temporary horn owns its small rectangle; do not reserve the empty
      // sea between it and the normal action grid as part of one large box.
      if(el.id==='mobileActions'&&child.closest('#mobileTools,#mobileGullHorn'))continue;
      if(!(child instanceof HTMLElement)&&child.tagName.toLowerCase()!=='svg')continue;
      const bounds=visibleRect(child);if(bounds)r=union(r,bounds);
    }
    if(el.id==='mobileActions')for(const button of el.querySelectorAll('.mobile-context-action.working')){
      const bounds=visibleRect(button);if(!bounds)continue;
      const ring=getComputedStyle(button,'::after'),style=getComputedStyle(button);
      if(ring.content==='none'||ring.display==='none')continue;
      // Absolute inset uses the padding box: account for the button border
      // rather than treating inset:-5px as five pixels outside its border box.
      const x=bounds.x+parseFloat(style.borderLeftWidth)+parseFloat(ring.left),y=bounds.y+parseFloat(style.borderTopWidth)+parseFloat(ring.top),w=parseFloat(ring.width),h=parseFloat(ring.height);
      if([x,y,w,h].every(Number.isFinite)&&w>0&&h>0)r=union(r,{x,y,w,h});
    }
    return [{...r,id:el.id||el.className}];
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
