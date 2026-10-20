// CSS pixels relative to the game canvas; no world coordinates or save mutations.
export function hudProbe(canvas,selector){
  let at=-Infinity,width=0,height=0,rects=[];
  return {read(now=performance.now()){
    const base=canvas.getBoundingClientRect();
    if(now-at<100&&width===base.width&&height===base.height)return rects;
    at=now;width=base.width;height=base.height;
    rects=[...document.querySelectorAll(selector)].flatMap(el=>{
      const r=el.getBoundingClientRect(),style=getComputedStyle(el);
      if(!r.width||!r.height||style.visibility==='hidden'||Number(style.opacity)<.02||!el.getClientRects().length)return [];
      const x=Math.max(0,r.left-base.left),y=Math.max(0,r.top-base.top);
      const w=Math.min(width,r.right-base.left)-x,h=Math.min(height,r.bottom-base.top)-y;
      return w>0&&h>0?[{x,y,w,h,id:el.id||el.classList[0]||el.tagName.toLowerCase()}]:[];
    });
    return rects;
  },invalidate(){at=-Infinity;}};
}
// The renderer and camera use the same minimap geometry, including its frame.
export function minimapLayout(width,height,world){
  if(width<700)return null;
  const w=width<1100?154:192,h=w*world.height/world.width,x=28,y=height-33-h;
  return {x,y,w,h,scale:w/world.width,occupied:{x:x-12,y:y-25,w:w+24,h:h+42,id:'minimap'}};
}
