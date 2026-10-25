import {drawProjectedShoreActor} from './shore-animation.js';
import {project} from './world-projection.js';
import {CREW_HEIGHT} from './shore-scale.js';

// Isolated visual candidate. Source-sized static alpha is read once per image.
// Per-frame work is limited to a captain-sized patch; no map or LOS mutation.
const sourceMasks=new WeakMap();
let maskReads=0,scratch=null;
function sourceMask(image){
  let mask=sourceMasks.get(image);if(mask)return mask;
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const rgba=context.getImageData(0,0,canvas.width,canvas.height).data,alpha=new Uint8Array(canvas.width*canvas.height);
  for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
  mask={alpha,width:canvas.width,height:canvas.height};sourceMasks.set(image,mask);maskReads++;return mask;
}
function covered(occluders,x,y){
  for(const o of occluders){
    const b=o.bounds;if(x<b.x||x>=b.x+b.w||y<b.y||y>=b.y+b.h)continue;
    const [sx,sy,sw,sh]=o.sourceRect,mask=sourceMask(o.image);
    const px=Math.floor(sx+(x-b.x)/b.w*sw),py=Math.floor(sy+(y-b.y)/b.h*sh);
    if(px>=0&&py>=0&&px<mask.width&&py<mask.height&&mask.alpha[py*mask.width+px]>=128)return true;
  }return false;
}
export function drawCaptainVisible(context,state,frame,actor,occluders,reduced=false){
  if(!state.person||actor.p!==state.person||actor.enemy||actor.worker||!occluders.length)return drawProjectedShoreActor(context,state,actor,frame,reduced);
  const foot=project(frame,state.person),height=CREW_HEIGHT*frame.scale,pad=3;
  const left=Math.floor(foot.x-height*1.15-pad),top=Math.floor(foot.y-height*1.4-pad),width=Math.ceil(height*2.3+pad*2),tall=Math.ceil(height*1.8+pad*2);
  if(width>512||tall>512||width<4||tall<4)return drawProjectedShoreActor(context,state,actor,frame,reduced);
  if(!scratch){const canvas=document.createElement('canvas');scratch={canvas,context:canvas.getContext('2d',{willReadFrequently:true})};}
  const c=scratch.context;if(scratch.canvas.width!==width)scratch.canvas.width=width;if(scratch.canvas.height!==tall)scratch.canvas.height=tall;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,tall);
  drawProjectedShoreActor(c,state,actor,{...frame,ox:frame.ox-left,oy:frame.oy-top},reduced);
  const data=c.getImageData(0,0,width,tall);
  for(let y=0;y<tall;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(data.data[i+3]&&covered(occluders,left+x+.5,top+y+.5))data.data[i+3]=0;}
  c.clearRect(0,0,width,tall);c.putImageData(data,0,0);context.drawImage(scratch.canvas,left,top);
  return{x:foot.x-height*.35,y:foot.y-height,w:height*.7,h:height,foot,height};
}
export function drawCaptainOcclusion(context,state,frame,actor,occluders,reduced=false){
  const stats={subject:null,outlinePixels:0,hiddenPixels:0,spritePixels:0,patchPixels:0,maskReads,occluders:occluders.length};
  // Never outline enemies or workers, even if callers pass an arbitrary actor.
  if(!state.person||!actor||actor.p!==state.person||actor.enemy||actor.worker||!occluders.length)return stats;
  const foot=project(frame,state.person),height=CREW_HEIGHT*frame.scale,pad=3;
  const left=Math.floor(foot.x-height*1.15-pad),top=Math.floor(foot.y-height*1.4-pad);
  const width=Math.ceil(height*2.3+pad*2),tall=Math.ceil(height*1.8+pad*2);
  // Fail closed for unusually large/unexpected actor projections.
  if(width>512||tall>512||width<4||tall<4)return {...stats,skipped:'patch-size'};
  if(!scratch){const canvas=document.createElement('canvas');scratch={canvas,context:canvas.getContext('2d',{willReadFrequently:true})};}
  const c=scratch.context;if(scratch.canvas.width!==width)scratch.canvas.width=width;if(scratch.canvas.height!==tall)scratch.canvas.height=tall;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,tall);
  drawProjectedShoreActor(c,state,actor,{...frame,ox:frame.ox-left,oy:frame.oy-top},reduced,{shadow:false});
  const pixels=c.getImageData(0,0,width,tall),rgba=pixels.data,output=c.createImageData(width,tall),out=output.data;
  const opaque=(x,y)=>x>=0&&y>=0&&x<width&&y<tall&&rgba[(y*width+x)*4+3]>=96;
  for(let y=1;y<tall-1;y++)for(let x=1;x<width-1;x++){
    if(!opaque(x,y))continue;stats.spritePixels++;
    if(!covered(occluders,left+x+.5,top+y+.5))continue;stats.hiddenPixels++;
    // One CSS-pixel inner contour: only actual sprite alpha, never its shadow.
    if(opaque(x-1,y)&&opaque(x+1,y)&&opaque(x,y-1)&&opaque(x,y+1))continue;
    const i=(y*width+x)*4;out[i]=183;out[i+1]=224;out[i+2]=210;out[i+3]=235;stats.outlinePixels++;
  }
  c.clearRect(0,0,width,tall);c.putImageData(output,0,0);
  context.save();context.globalAlpha=1;context.globalCompositeOperation='source-over';context.drawImage(scratch.canvas,left,top);context.restore();
  return {...stats,subject:'captain',maskReads,patchPixels:width*tall,patch:{x:left,y:top,w:width,h:tall},foot,height};
}
