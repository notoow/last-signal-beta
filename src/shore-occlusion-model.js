// Pure silhouette helpers. No scene/save/LOS mutation.
export const WHOLE_TINT={captain:[184,224,209],enemy:[242,140,112],loot:[242,201,112]};
export function wholeEligible(state,actor,{visible=true}={}){
  if(!visible||!actor?.p||actor.worker)return false;
  return actor.enemy?actor.p.hp>0&&actor.p.alert===true:actor.p===state.person;
}
export function wholeLootEligible(state,item,{visible=true}={}){
  return !!(visible&&item?.berth&&item.image&&!item.claimed&&!state.claimed.includes(item.berth.id));
}
export function sceneryCoverCommands(occluders){
  return occluders.flatMap(o=>{
    const b=o.bounds,r=o.sourceRect,image=o.image;
    if(!image||!b||!r||!b.w||!b.h)return [];
    const points=[b.x,b.y,b.x+b.w,b.y,b.x+b.w,b.y+b.h,b.x,b.y+b.h];
    const command=im=>{const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;return{image:im,points,uv:[r[0]/w,r[1]/h,(r[0]+r[2])/w,(r[1]+r[3])/h],opacity:1};};
    return [...(o.floorImage?[command(o.floorImage)]:[]),command(image)];
  });
}
// Grid coordinates are physical pixels. Each output tile owns its interior;
// a >=one-CSS-pixel halo is read but never composited twice across a seam.
export function* wholeTiles(commands,dpr=1){
  if(!Number.isFinite(dpr)||dpr<=0)throw new TypeError('Positive DPR required');
  const points=commands.filter(c=>c.image).flatMap(c=>c.points);
  if(!points.length||points.some(v=>!Number.isFinite(v)))return;
  const xs=points.filter((_,i)=>i%2===0),ys=points.filter((_,i)=>i%2===1);
  const left=Math.floor(Math.min(...xs)*dpr),top=Math.floor(Math.min(...ys)*dpr),right=Math.ceil(Math.max(...xs)*dpr),bottom=Math.ceil(Math.max(...ys)*dpr);
  const halo=Math.ceil(dpr)+1,step=512-halo*2;if(step<=0)throw new RangeError('DPR exceeds bounded tile budget');
  for(let y=top;y<bottom;y+=step)for(let x=left;x<right;x+=step){
    const w=Math.min(step,right-x),h=Math.min(step,bottom-y);
    yield {left:x-halo,top:y-halo,width:w+halo*2,height:h+halo*2,innerX:halo,innerY:halo,w,h,dpr};
  }
}
function alphaAt(rgba,w,h,x,y){
  const x0=Math.floor(x),y0=Math.floor(y),tx=x-x0,ty=y-y0;
  const a=(px,py)=>px<0||py<0||px>=w||py>=h?0:rgba[(py*w+px)*4+3];
  return (a(x0,y0)*(1-tx)+a(x0+1,y0)*tx)*(1-ty)+(a(x0,y0+1)*(1-tx)+a(x0+1,y0+1)*tx)*ty;
}
// Mirrors the GPU binary actor-mask shader: fill32%, inner contour235/255,
// neighbours one CSS pixel apart even at fractional/high device scale.
export function wholePixels(rgba,width,height,dpr=1,enemy=false){
  if(rgba.length!==width*height*4)throw new RangeError('Mask extent mismatch');
  const kind=enemy==='loot'?'loot':enemy?'enemy':'captain',output=new Uint8ClampedArray(rgba.length),tint=WHOLE_TINT[kind];let filled=0,outlined=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;if(rgba[i+3]<96)continue;
    const interior=[[dpr,0],[-dpr,0],[0,dpr],[0,-dpr]].every(([dx,dy])=>alphaAt(rgba,width,height,x+dx,y+dy)>=96);
    const detail=kind==='loot'&&interior;
    output[i]=detail?rgba[i]:tint[0];output[i+1]=detail?rgba[i+1]:tint[1];output[i+2]=detail?rgba[i+2]:tint[2];output[i+3]=interior?Math.round((kind==='loot'?.85:.32)*255):235;
    if(interior)filled++;else outlined++;
  }
  return {rgba:output,filled,outlined};
}
