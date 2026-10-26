import {ShoreSpriteRecorder} from './shore-sprite-recorder.js';
import {drawProjectedShoreActor} from './shore-animation.js';
import {quayScenerySprites,quayLootSprites} from './quay-view.js';

export function recordQuayLoot(s,frame){
  return quayLootSprites(s,frame).map(({p,image,rect:r,bounds:b,claimed,berth})=>({
    p,lootId:berth.id,commands:[{image,
      points:[b.x,b.y,b.x+b.w,b.y,b.x+b.w,b.y+b.h,b.x,b.y+b.h],
      uv:[r[0]/image.width,r[1]/image.height,(r[0]+r[2])/image.width,(r[1]+r[3])/image.height],
      opacity:claimed?.45:1,mipmaps:false}]
  }));
}

export function recordQuayScenery(s,frame){
  return quayScenerySprites(s,frame,{cull:false}).map(record=>{
    const {bounds:b,rect:r,im:image}=record,w=image.naturalWidth,h=image.naturalHeight;
    return {...record,commands:[{image,points:[b.x,b.y,b.x+b.w,b.y,b.x+b.w,b.y+b.h,b.x,b.y+b.h],uv:[r[0]/w,r[1]/h,(r[0]+r[2])/w,(r[1]+r[3])/h],opacity:1,mipmaps:true}]};
  });
}

export function recordShoreActor(s,actor,frame,reduced=false,{shadow=false}={}){
  const recorder=new ShoreSpriteRecorder();
  const bounds=drawProjectedShoreActor(recorder,s,actor,frame,reduced,{shadow});
  if(recorder.stack.length)throw Error('Unbalanced actor painter');
  return {commands:recorder.images,labels:recorder.labels,bounds};
}

// Retain sources and quads across animation frames. Input order is painter
// order, including the individual limbs of the authored walking rigs.
export class ShoreGpuSprites{
  constructor(scene,prefix='sprites'){this.scene=scene;this.prefix=prefix;this.sources=new Map();this.colors=new Map();this.previous=[];this.order=[];}
  sync(commands){
    const scene=this.scene,order=[],groups=[];
    for(const command of commands){
      let image=command.image;
      if(!image){
        image=this.colors.get(command.color);
        if(!image){image=document.createElement('canvas');image.width=image.height=1;const c=image.getContext('2d');c.fillStyle=command.color;c.fillRect(0,0,1,1);this.colors.set(command.color,image);}
      }
      let atlas=this.sources.get(image);
      if(!atlas){atlas=this.prefix+':atlas:'+this.sources.size;scene.atlas(atlas,image,{mipmaps:command.mipmaps??false,repeat:command.repeat??false});this.sources.set(image,atlas);}
      const quad={points:command.points,uv:command.uv||[0,0,1,1],opacity:command.opacity??1};
      // Only adjacent draws merge: alpha/depth ordering must never be regrouped.
      let group=groups.at(-1);
      if(!group||group.atlas!==atlas||group.occlusionMask!==command.occlusionMask){group={atlas,occlusionMask:command.occlusionMask,quads:[]};groups.push(group);}
      group.quads.push(quad);
    }
    groups.forEach(({atlas,quads,occlusionMask},i)=>{
      const id=this.prefix+':quad:'+i,old=this.previous[i],signatures=quads.map(q=>JSON.stringify(q));
      if(!old||old.atlas!==atlas||old.signatures.length!==quads.length)scene.layer(id,atlas,quads);
      else quads.forEach((quad,j)=>{if(old.signatures[j]!==signatures[j])scene.quad(id,j,quad);});
      scene.layers.get(id).occlusionMask=occlusionMask;
      this.previous[i]={atlas,signatures};order.push(id);
    });
    for(let i=groups.length;i<this.previous.length;i++)scene.removeLayer(this.prefix+':quad:'+i);
    this.previous.length=groups.length;this.order=order;return order;
  }
  dispose(){for(const id of this.order)this.scene.removeLayer(id);for(const atlas of this.sources.values())this.scene.removeAtlas(atlas);this.sources.clear();this.colors.clear();this.previous=[];this.order=[];}
}
