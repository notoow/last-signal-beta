import {drawProjectedShoreActor} from './shore-animation.js';
import {ShoreSpriteRecorder} from './shore-sprite-recorder.js';
import {visibleAt} from './rogue-vision.js';
import {coverRatio,coverState,actorImageCommands} from './shore-actor-cover.js';
import {wholeEligible,wholeLootEligible,sceneryCoverCommands,wholeTiles,wholePixels} from './shore-occlusion-model.js';

// Caller supplies shoreActors(state), already filtered by LOS.
// State/hysteresis and one bounded scratch surface belong to this Canvas view.
const views=new WeakMap();
function viewFor(context){let v=views.get(context);if(!v){v={states:new WeakMap(),canvas:null,context:null};views.set(context,v);}return v;}
function record(state,actor,frame,reduced){const c=new ShoreSpriteRecorder(),bounds=drawProjectedShoreActor(c,state,actor,frame,reduced,{shadow:false});if(c.stack.length)throw Error('Unbalanced actor painter');return{commands:c.images,bounds};}
export function prepareWholeActor(context,state,frame,actor,occluders,reduced=false){
  const view=viewFor(context);
  if(!wholeEligible(state,actor,{visible:!actor?.enemy||!!actor.p&&visibleAt(state,actor.p)})){if(actor?.p)view.states.delete(actor.p);return null;}
  const recorded=record(state,actor,frame,reduced),body=actorImageCommands(recorded.commands);
  const ratio=coverRatio(body,sceneryCoverCommands(occluders),recorded.bounds);
  const previous=view.states.get(actor.p),next=coverState(previous,ratio,previous?state.time-previous.time:0);next.time=state.time;view.states.set(actor.p,next);
  return {actor,kind:actor.enemy?'enemy':'captain',...recorded,ratio,active:next.active&&body.length>0,clear:next.clear};
}
export function prepareWholeLoot(context,state,item,occluders){
  const view=viewFor(context),visible=!!item?.berth&&visibleAt(state,item.berth.loot);
  if(!wholeLootEligible(state,item,{visible})){if(item?.berth)view.states.delete(item.berth);return null;}
  const commands=sceneryCoverCommands([{image:item.image,sourceRect:item.rect,bounds:item.bounds}]);
  const ratio=coverRatio(commands,sceneryCoverCommands(occluders),item.bounds),previous=view.states.get(item.berth);
  const next=coverState(previous,ratio,previous?state.time-previous.time:0);next.time=state.time;view.states.set(item.berth,next);
  return {kind:'loot',lootId:item.berth.id,commands,bounds:item.bounds,ratio,active:next.active&&commands.length>0,clear:next.clear};
}
function nonImage(context,commands){
  context.save();try{for(const c of commands){if(c.image||!c.color)continue;context.globalAlpha=c.opacity??1;context.fillStyle=c.color;context.beginPath();context.moveTo(c.points[0],c.points[1]);for(let i=2;i<c.points.length;i+=2)context.lineTo(c.points[i],c.points[i+1]);context.closePath();context.fill();}}finally{context.restore();}
}
export function drawWholeActorBase(context,state,frame,actor,prepared,reduced=false){
  if(!prepared?.active)return drawProjectedShoreActor(context,state,actor,frame,reduced);
  // Remove the normal coloured sprite/shadow before the ghost pass, retaining
  // the actor's normal non-image bars. Never paint the full original twice.
  nonImage(context,prepared.commands);return prepared.bounds;
}
function sprite(context,command){
  if(!command.image)return;const p=command.points,u=command.uv;
  if(u?.length!==4)throw Error('Canvas recorded actor requires rectangular source crop');
  const iw=command.image.naturalWidth||command.image.width,ih=command.image.naturalHeight||command.image.height;
  const sx=u[0]*iw,sy=u[1]*ih,sw=(u[2]-u[0])*iw,sh=(u[3]-u[1])*ih;
  context.save();context.globalAlpha=command.opacity??1;
  context.transform((p[2]-p[0])/sw,(p[3]-p[1])/sw,(p[6]-p[0])/sh,(p[7]-p[1])/sh,p[0],p[1]);
  context.drawImage(command.image,sx,sy,sw,sh,0,0,sw,sh);context.restore();
}
export function drawWholeActorOverlay(context,prepared){
  const stats={subject:prepared?.kind||'captain',...(prepared?.lootId!==undefined?{lootId:prepared.lootId}:{}),active:!!prepared?.active,ratio:prepared?.ratio??0,clear:prepared?.clear??0,fillPixels:0,outlinePixels:0,tiles:0,maxPatchPixels:0};
  if(!prepared?.active)return stats;
  const view=viewFor(context);if(!view.canvas){view.canvas=document.createElement('canvas');view.context=view.canvas.getContext('2d',{willReadFrequently:true});if(!view.context)throw Error('Canvas actor scratch unavailable');}
  const dpr=Math.hypot(context.getTransform().a,context.getTransform().b),c=view.context;
  context.save();context.globalAlpha=1;context.globalCompositeOperation='source-over';
  try{for(const p of wholeTiles(prepared.commands,dpr)){
    if(view.canvas.width!==p.width)view.canvas.width=p.width;if(view.canvas.height!==p.height)view.canvas.height=p.height;
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,p.width,p.height);c.setTransform(dpr,0,0,dpr,-p.left,-p.top);
    for(const command of prepared.commands)sprite(c,command);
    const input=c.getImageData(0,0,p.width,p.height),result=wholePixels(input.data,p.width,p.height,dpr,prepared.kind==='loot'?'loot':!!prepared.actor?.enemy);
    input.data.set(result.rgba);c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,p.width,p.height);c.putImageData(input,0,0);
    context.drawImage(view.canvas,p.innerX,p.innerY,p.w,p.h,(p.left+p.innerX)/dpr,(p.top+p.innerY)/dpr,p.w/dpr,p.h/dpr);
    for(let y=p.innerY;y<p.innerY+p.h;y++)for(let x=p.innerX;x<p.innerX+p.w;x++){
      const alpha=result.rgba[(y*p.width+x)*4+3];if(alpha===235)stats.outlinePixels++;else if(alpha)stats.fillPixels++;
    }
    stats.tiles++;stats.maxPatchPixels=Math.max(stats.maxPatchPixels,p.width*p.height);
  }}finally{context.restore();}return stats;
}
