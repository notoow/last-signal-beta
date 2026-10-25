import {drawProjectedShoreActor} from './shore-animation.js';
import {project} from './world-projection.js';
import {CREW_HEIGHT,humanVisualScale} from './shore-scale.js';

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
// Render in bounded tiles with a one-pixel halo for contour neighbours.
// The halo is sampled, but never composited twice at a tile seam.
function* patches(foot,height){
  const pad=3,left=Math.floor(foot.x-height*1.15-pad),top=Math.floor(foot.y-height*1.4-pad);
  const width=Math.ceil(height*2.3+pad*2),tall=Math.ceil(height*1.8+pad*2);
  if(!Number.isFinite(width)||!Number.isFinite(tall)||width<4||tall<4)return;
  for(let y=0;y<tall;y+=510)for(let x=0;x<width;x+=510){
    const w=Math.min(510,width-x),h=Math.min(510,tall-y);
    yield {left:left+x-1,top:top+y-1,width:w+2,tall:h+2,w,h};
  }
}
function paintPatch(state,frame,actor,reduced,patch,options){
  if(!scratch){const canvas=document.createElement('canvas');scratch={canvas,context:canvas.getContext('2d',{willReadFrequently:true})};}
  const {width,tall,left,top}=patch,c=scratch.context;
  if(scratch.canvas.width!==width)scratch.canvas.width=width;
  if(scratch.canvas.height!==tall)scratch.canvas.height=tall;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,tall);
  drawProjectedShoreActor(c,state,actor,{...frame,ox:frame.ox-left,oy:frame.oy-top},reduced,options);
  return c;
}
function compositePatch(context,c,data,p){
  c.clearRect(0,0,p.width,p.tall);c.putImageData(data,0,0);
  context.drawImage(scratch.canvas,1,1,p.w,p.h,p.left+1,p.top+1,p.w,p.h);
}
export function drawCaptainVisible(context,state,frame,actor,occluders,reduced=false){
  if(!state.person||actor.p!==state.person||actor.enemy||actor.worker||!occluders.length)return drawProjectedShoreActor(context,state,actor,frame,reduced);
  const foot=project(frame,state.person),height=CREW_HEIGHT*frame.scale*humanVisualScale(state);
  for(const p of patches(foot,height)){
    const c=paintPatch(state,frame,actor,reduced,p),data=c.getImageData(0,0,p.width,p.tall);
    for(let y=1;y<=p.h;y++)for(let x=1;x<=p.w;x++){
      const i=(y*p.width+x)*4;
      if(data.data[i+3]&&covered(occluders,p.left+x+.5,p.top+y+.5))data.data[i+3]=0;
    }
    compositePatch(context,c,data,p);
  }
  return{x:foot.x-height*.35,y:foot.y-height,w:height*.7,h:height,foot,height};
}
export function drawCaptainOcclusion(context,state,frame,actor,occluders,reduced=false){
  const stats={subject:null,outlinePixels:0,hiddenPixels:0,spritePixels:0,patchPixels:0,maxPatchPixels:0,tiles:0,maskReads,occluders:occluders.length};
  if(!state.person||!actor||actor.p!==state.person||actor.enemy||actor.worker||!occluders.length)return stats;
  const foot=project(frame,state.person),height=CREW_HEIGHT*frame.scale*humanVisualScale(state);
  context.save();context.globalAlpha=1;context.globalCompositeOperation='source-over';
  for(const p of patches(foot,height)){
    const c=paintPatch(state,frame,actor,reduced,p,{shadow:false});
    const rgba=c.getImageData(0,0,p.width,p.tall).data,output=c.createImageData(p.width,p.tall),out=output.data;
    const opaque=(x,y)=>rgba[(y*p.width+x)*4+3]>=96;
    for(let y=1;y<=p.h;y++)for(let x=1;x<=p.w;x++){
      if(!opaque(x,y))continue;stats.spritePixels++;
      if(!covered(occluders,p.left+x+.5,p.top+y+.5))continue;stats.hiddenPixels++;
      if(opaque(x-1,y)&&opaque(x+1,y)&&opaque(x,y-1)&&opaque(x,y+1))continue;
      const i=(y*p.width+x)*4;out[i]=183;out[i+1]=224;out[i+2]=210;out[i+3]=235;stats.outlinePixels++;
    }
    compositePatch(context,c,output,p);
    stats.patchPixels+=p.width*p.tall;stats.maxPatchPixels=Math.max(stats.maxPatchPixels,p.width*p.tall);stats.tiles++;
  }
  context.restore();
  return {...stats,subject:'captain',maskReads,foot,height};
}
