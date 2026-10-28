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

// Integration staging renderer, deliberately not a live-game replacement yet.
// Keep omissions explicit so an attractive partial capture cannot be mistaken
// for an accepted full scene or a measured gameplay performance improvement.
const missing=Object.freeze(['vessel-labels',
  'captain-occlusion-outline','world-labels','daylight','return-cues']);
const world={scale:1,ox:0,oy:0,pixelsPerMetre:M,projection:HARBOR_PROJECTION};

export class ShoreGpuQuay{
  constructor(canvas){this.canvas=canvas;this.scene=new ShoreGpuScene(canvas);this.map=null;}
  clearMap(){
    this.cutaways=new WeakMap();
    this.outline?.dispose();this.outline=null;this.actorMask?.dispose();this.actorMask=null;this.coverMask?.dispose();this.coverMask=null;
    this.scene.removeTarget('captain-mask');this.scene.removeTarget('cover-mask');
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
      this.outline=new ShoreGpuOutline(this.scene);this.actorMask=new ShoreGpuSprites(this.scene,'actor-mask');this.coverMask=new ShoreGpuSprites(this.scene,'cover-mask');
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
    const occluders=captain?objects.slice(objects.indexOf(captain)+1).filter(o=>o.box&&behind(world,s.person,o.box)):[];
    const camera=[frame.scale,0,0,0,frame.scale,0,frame.ox,frame.oy,1];
    // Only already visible actors can request a building cutaway. Keep the
    // foundation opaque so the blocked footprint remains legible.
    const revealed=actors.filter(a=>a===captain||a.actor.enemy&&a.actor.p.hp>0&&a.actor.p.alert);
    const coveredProps=props.filter(p=>!('ownerIndex' in p)&&(revealed.some(a=>objects.indexOf(p)>objects.indexOf(a)&&behind(world,a.actor.p,p.box))||
      loot.some(l=>{const b=s.map.berths.find(b=>b.id===l.lootId);return !s.claimed.includes(l.lootId)&&objects.indexOf(p)>objects.indexOf(l)&&behind(world,b.loot,p.box);} )));
    for(const prop of props.filter(p=>!('ownerIndex' in p))){
      const target=coveredProps.includes(prop)?.22:1,old=this.cutaways.get(prop.box);
      const opacity=old?old.opacity+(target-old.opacity)*(1-Math.exp(-12*Math.max(0,Math.min(.1,s.time-old.time)))):target;
      this.cutaways.set(prop.box,{opacity,time:s.time});
      if(opacity>.999)continue;
      prop.commands=prop.commands.flatMap(c=>{
        if(c.uv?.length!==4)return [c];
        const p=c.points,u=c.uv,cut=p[1]+(p[5]-p[1])*.9,v=u[1]+(u[3]-u[1])*.9;
        return [{...c,points:[p[0],p[1],p[2],p[3],p[4],cut,p[6],cut],uv:[u[0],u[1],u[2],v],opacity},
          {...c,points:[p[0],cut,p[2],cut,p[4],p[5],p[6],p[7]],uv:[u[0],v,u[2],u[3]]}];
      });
    }
    if(occluders.length){
      this.scene.target('captain-mask',width,height);this.scene.target('cover-mask',width,height);
      const maskCommands=recordShoreActor(s,captain.actor,frame,reduced,{shadow:false}).commands.map(normalize);
      this.scene.draw({width:frame.width,height:frame.height,camera,target:'captain-mask',order:this.actorMask.sync(maskCommands)});
      this.scene.draw({width:frame.width,height:frame.height,camera,target:'cover-mask',alphaCutoff:128/255,order:this.coverMask.sync(occluders.flatMap(o=>o.commands))});
      // Preserve the authored body beneath locally softened cover.
    }
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
    if(occluders.length)this.outline.draw('captain-mask','cover-mask',{width:frame.width,height:frame.height});
    if(effectOrder.length)this.scene.draw({width:frame.width,height:frame.height,camera,order:effectOrder,clear:false});
    const actorPending=actors.some(actor=>!actor.spriteReady);
    let returnCue=null,lighting=null,vesselGuidance=null;
    if(overlay){
      if(overlay.canvas.width!==width)overlay.canvas.width=width;
      if(overlay.canvas.height!==height)overlay.canvas.height=height;
      overlay.save();overlay.setTransform(1,0,0,1,0,0);overlay.clearRect(0,0,width,height);
      overlay.setTransform(dpr,0,0,dpr,0,0);
      vesselGuidance=drawQuayVesselGuidance(overlay,s,frame,vessels,language);
      drawQuaySearchLabels(overlay,s,frame,language);
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
