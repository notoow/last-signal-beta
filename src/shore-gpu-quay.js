import {coverRatio,coverState,actorImageCommands} from './shore-actor-cover.js';
import {ShoreGpuScene} from './shore-gpu-scene.js';
import {installShoreGround} from './shore-gpu-ground.js';
import {installShoreFog} from './shore-gpu-fog.js';
import {installShoreWater} from './shore-gpu-water.js';
import {recordShoreCliffs} from './shore-gpu-cliffs.js';
import {recordQuayThreats} from './shore-gpu-threats.js';
import {ShoreTextCache} from './shore-gpu-text.js';
import {ShoreReflections} from './shore-gpu-reflections.js';
import {ShoreGpuOutline} from './shore-gpu-outline.js';
import {voyageLight} from './voyage-light-view.js';
import {drawReturnLanding} from './shore-return-cue.js';
import {ShoreSpriteRecorder} from './shore-sprite-recorder.js';
import {ShoreGpuSprites,recordShoreActor,recordQuayScenery,recordQuayLoot} from './shore-gpu-sprites.js';
import {quayGroundSources,behind,drawQuayVessels,drawQuayCombat,drawQuaySearchProgress,drawQuaySearchLabels,drawQuaySearchRings,drawQuayObjective,drawQuayVesselGuidance} from './quay-view.js';
import {shoreActors,captainActionSources} from './shore-animation.js';
import {project,HARBOR_PROJECTION} from './world-projection.js';
import {WORLD_UNITS_PER_METRE as M} from './shore-scale.js';

// World-space scene with optional labels, lighting and vessel UI overlay.
const missing=Object.freeze(['vessel-labels',
  'world-labels','daylight','return-cues']);
const world={scale:1,ox:0,oy:0,pixelsPerMetre:M,projection:HARBOR_PROJECTION};

export class ShoreGpuQuay{
  constructor(canvas){this.canvas=canvas;this.scene=new ShoreGpuScene(canvas);this.map=null;}
  clearMap(){
    for(let i=0;i<(this.silhouetteCount||0);i++){this.scene.removeTarget('shore-silhouette-'+i);}this.silhouetteCount=0;
    this.ghostStates=new WeakMap();
    this.outline?.dispose();this.outline=null;this.actorMask?.dispose();this.actorMask=null;
    this.reflections?.dispose();this.reflections=null;this.reflectionGeometry=null;
    this.text?.clear();this.text=null;
    this.threats?.dispose();this.threats=null;
    this.effects?.dispose();this.effects=null;this.sprites?.dispose();this.vessels?.dispose();this.fog?.dispose();this.ground?.dispose();this.water?.dispose();
    this.sprites=this.vessels=this.fog=this.ground=this.water=null;this.map=null;
  }
  draw(s,frame,{dpr=1,reduced=false,search=null,overlay=null,task=null,language='ko',applyLighting=true}={}){
    if(frame.projectionId&&frame.projectionId!=='quay-v1')throw Error('GPU shore requires quay projection');
    if(this.map!==s.map){
      const sources=quayGroundSources(s);if(!sources)return {ready:false,missing};
      this.clearMap();this.water=installShoreWater(this.scene,sources.water);this.ground=installShoreGround(this.scene,s,sources);this.fog=installShoreFog(this.scene,s);
      this.sprites=new ShoreGpuSprites(this.scene);this.vessels=new ShoreGpuSprites(this.scene,'vessels');this.effects=new ShoreGpuSprites(this.scene,'effects');this.map=s.map;
      this.threats=new ShoreGpuSprites(this.scene,'threats');
      this.text=new ShoreTextCache();
      this.reflections=new ShoreGpuSprites(this.scene,'reflections');this.reflectionGeometry=new ShoreReflections();
      this.outline=new ShoreGpuOutline(this.scene);this.actorMask=new ShoreGpuSprites(this.scene,'actor-mask');
    }
    if(s.person){const actionSources=captainActionSources(s.captain);if(!actionSources||!this.sprites.prepare(actionSources))return {ready:false,missing};}
    const width=Math.round(frame.width*dpr),height=Math.round(frame.height*dpr);
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const cliffs=recordShoreCliffs(s);if(!cliffs)return {ready:false,missing};
    const props=[...recordQuayScenery(s,world).map(r=>({p:r.p,box:r.b,commands:r.commands})),...cliffs];
    const normalize=command=>({...command,points:command.points.map((value,i)=>Math.round((value-(i%2?frame.oy:frame.ox))/frame.scale*1e6)/1e6)});
    const actors=shoreActors(s).map(actor=>{
      const recorded=recordShoreActor(s,actor,frame,reduced,{shadow:true});
      return {actor,p:project(world,actor.p),...recorded,spriteReady:recorded.commands.some(command=>command.image),
        commands:[...recorded.commands,...this.text.commands(recorded.labels)].map(normalize)};
    });
    const loot=recordQuayLoot(s,world);
    const objects=[...props,...loot,...actors].sort((a,b)=>a.p.y-b.p.y);
    // Same physical-footprint correction as the existing quay painter.
    for(const actor of actors)for(const prop of props){
      const ai=objects.indexOf(actor),bi=objects.indexOf(prop);
      if(behind(world,actor.actor.p,prop.box)&&ai>bi){objects.splice(ai,1);objects.splice(objects.indexOf(prop),0,actor);}
    }
    const captain=actors.find(a=>a.actor.p===s.person&&!a.actor.enemy&&!a.actor.worker);
    const camera=[frame.scale,0,0,0,frame.scale,0,frame.ox,frame.oy,1];
    // Only already visible captain or living alerted enemies receive silhouettes.
    const revealed=actors.filter(a=>a===captain||a.actor.enemy&&a.actor.p.hp>0&&a.actor.p.alert);
    const silhouettes=[];
    for(const actor of revealed){
      const covers=objects.slice(objects.indexOf(actor)+1).filter(o=>o.box&&behind(world,actor.actor.p,o.box));
      const body=recordShoreActor(s,actor.actor,frame,reduced,{shadow:false}).commands.map(normalize);
      const b=actor.bounds,bounds={x:(b.x-frame.ox)/frame.scale,y:(b.y-frame.oy)/frame.scale,w:b.w/frame.scale,h:b.h/frame.scale};
      const ratio=coverRatio(body,covers.flatMap(o=>o.commands),bounds);
      const old=this.ghostStates.get(actor.actor.p),state=coverState(old,ratio,old?s.time-old.time:0);state.time=s.time;
      this.ghostStates.set(actor.actor.p,state);
      if(!state.active)continue;
      const actorId='shore-silhouette-'+silhouettes.length;
      const maskWidth=Math.ceil(frame.width),maskHeight=Math.ceil(frame.height);
      this.scene.target(actorId,maskWidth,maskHeight);
      const mask=actorImageCommands(body);
      this.scene.draw({width:frame.width,height:frame.height,camera,target:actorId,order:this.actorMask.sync(mask)});

      actor.commands=body.filter(c=>!c.image);
      silhouettes.push({actorId,enemy:!!actor.actor.enemy});
    }
    for(const item of loot){
      const berth=s.map.berths.find(b=>b.id===item.lootId);
      if(!berth||s.claimed.includes(item.lootId))continue;
      const covers=objects.slice(objects.indexOf(item)+1).filter(o=>o.box&&behind(world,berth.loot,o.box));
      const points=item.commands.flatMap(c=>c.points),xs=points.filter((_,i)=>!(i%2)),ys=points.filter((_,i)=>i%2);
      const bounds={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
      const ratio=coverRatio(item.commands,covers.flatMap(o=>o.commands),bounds);
      const old=this.ghostStates.get(berth),state=coverState(old,ratio,old?s.time-old.time:0);state.time=s.time;this.ghostStates.set(berth,state);
      if(!state.active)continue;
      const actorId='shore-silhouette-'+silhouettes.length;
      this.scene.target(actorId,Math.ceil(frame.width),Math.ceil(frame.height));
      this.scene.draw({width:frame.width,height:frame.height,camera,target:actorId,order:this.actorMask.sync(item.commands)});
      item.commands=[];silhouettes.push({actorId,lootId:item.lootId,tint:[.95,.79,.44]});
    }
    for(let i=silhouettes.length;i<(this.silhouetteCount||0);i++){this.scene.removeTarget('shore-silhouette-'+i);}
    this.silhouetteCount=silhouettes.length;
    const order=this.sprites.sync(objects.flatMap(object=>object.commands)),fog=this.fog.sync(s);
    const vesselRecorder=new ShoreSpriteRecorder(),vessels=drawQuayVessels(vesselRecorder,s,frame);
    // Existing rope widths and fitting dimensions are screen-space contracts.
    // Normalize the recorded points; quantization only removes cancellation
    // noise from camera translation (one millionth of a world unit).
    const vesselOrder=this.vessels.sync(vesselRecorder.images.map(command=>({...command,
      points:command.points.map((value,i)=>Math.round((value-(i%2?frame.oy:frame.ox))/frame.scale*1e6)/1e6)})));
    const effectRecorder=new ShoreSpriteRecorder();drawQuayCombat(effectRecorder,s,frame);
    drawQuaySearchProgress(effectRecorder,s,frame,search);
    const effectOrder=this.effects.sync(effectRecorder.images.map(command=>({...command,
      points:command.points.map((value,i)=>(value-(i%2?frame.oy:frame.ox))/frame.scale)})));
    const ringRecorder=new ShoreSpriteRecorder();drawQuaySearchRings(ringRecorder,s,frame);
    const threatOrder=this.threats.sync([...recordQuayThreats(s,frame),...ringRecorder.images].map(command=>({...command,
      points:command.points.map((value,i)=>(value-(i%2?frame.oy:frame.ox))/frame.scale)})));
    const reflectionOrder=this.reflections.sync(this.reflectionGeometry.get(s,world));
    const drawn=this.scene.draw({width:frame.width,height:frame.height,
      camera:[frame.scale,0,0,0,frame.scale,0,frame.ox,frame.oy,1],layerViews:this.water.views(frame,s.time,reduced),
      order:[...this.water.order,...this.ground.order,...reflectionOrder,this.fog.id,...vesselOrder,...threatOrder,...order]});
    for(const x of silhouettes)this.outline.draw(x.actorId,{width:frame.width,height:frame.height,detail:x.lootId!==undefined?1:0,tint:x.tint||(x.enemy?[.95,.55,.44]:[.72,.88,.82])});
    if(effectOrder.length)this.scene.draw({width:frame.width,height:frame.height,camera,order:effectOrder,clear:false});
    const actorPending=actors.some(actor=>!actor.spriteReady);
    let returnCue=null,lighting=null,vesselGuidance=null;
    if(overlay){
      if(overlay.canvas.width!==width)overlay.canvas.width=width;
      if(overlay.canvas.height!==height)overlay.canvas.height=height;
      overlay.save();overlay.setTransform(1,0,0,1,0,0);overlay.clearRect(0,0,width,height);
      overlay.setTransform(dpr,0,0,dpr,0,0);
      vesselGuidance=drawQuayVesselGuidance(overlay,s,frame,vessels,language);
      drawQuaySearchLabels(overlay,s,frame,language,new Set(silhouettes.filter(x=>x.lootId!==undefined).map(x=>x.lootId)));
      returnCue=drawReturnLanding(overlay,s,frame,vessels.boat?.bounds);
      drawQuayObjective(overlay,s,frame,task,language);
      const lightFrame={...frame,quay:vessels};if(applyLighting)voyageLight(overlay,s,lightFrame,reduced,false,dpr);
      lighting=lightFrame.daylight||null;overlay.restore();
    }
    return {ready:drawn&&!actorPending,missing:overlay?missing.filter(x=>!['daylight','return-cues','world-labels','vessel-labels'].includes(x)):missing,returnCue,lighting,vesselGuidance,fog,actors:actors.length,buildings:props.length-cliffs.length,cliffs:cliffs.length,
      boat:vessels.boat,tow:vessels.tow,actorBounds:actors.map(a=>a.bounds),
      scenery:props.map(prop=>{const points=prop.commands.flatMap(c=>c.points),xs=points.filter((_,i)=>i%2===0).map(x=>x*frame.scale+frame.ox),ys=points.filter((_,i)=>i%2===1).map(y=>y*frame.scale+frame.oy);return {box:prop.box,bounds:{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}};}),
      labels:actors.flatMap(actor=>actor.labels),loot:loot.map(o=>o.lootId),vessels:!!vessels.boat,order:objects.map(o=>o.actor?'actor':o.lootId?'loot':'scenery')};
  }
  dispose(){this.clearMap();this.scene.dispose();}
}
