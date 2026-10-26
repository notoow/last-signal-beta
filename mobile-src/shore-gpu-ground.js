import {TILE,tileAt,shoreMask} from './rogue-map.js';
import {isCliff} from './cliff-view.js';
import {WORLD_UNITS_PER_METRE as M} from './shore-scale.js';
import {HARBOR_PROJECTION as P} from './world-projection.js';

const projected=points=>points.flatMap(([x,y,z=0])=>[P.xx*x+P.xy*y,P.yx*x+P.yy*y-z]);
const rect=(x,y,w,h,uv=[0,0,1,1],opacity=1)=>({points:projected([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]),uv,opacity});
const intersection=(a,b)=>{
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.w,b.x+b.w),bottom=Math.min(a.y+a.h,b.y+b.h);
  return right>x&&bottom>y?{x,y,w:right-x,h:bottom-y}:null;
};

// Static world geometry; camera changes are a uniform update in ShoreGpuScene.
// This installs only authored ground/walls. Boats, scenery, fog and actors must
// be composed in the full shore adapter before this path replaces the live view.
export function installShoreGround(scene,s,sources,prefix='ground'){
  const tiles=[];
  for(let ty=0;ty<s.map.rows;ty++)for(let tx=0;tx<s.map.cols;tx++){
    if(tileAt(s.map,tx,ty)&&!isCliff(s,{tx,ty}))tiles.push({x:tx*TILE,y:ty*TILE,w:TILE,h:TILE,mask:shoreMask(s.map,tx,ty)});
  }
  const order=[],atlases=[],shared=new Map();
  const add=(name,source,quads)=>{
    const id=prefix+':'+name;let atlas=shared.get(source);
    if(!atlas){atlas=id;scene.atlas(atlas,source);shared.set(source,atlas);atlases.push(atlas);}
    scene.layer(id,atlas,quads);order.push(id);
  };
  const walls=[],coping=[];
  for(const t of tiles){
    const x=t.x,y=t.y,edges=[[[x+TILE,y],[x,y],1,false],[[x+TILE,y+TILE],[x+TILE,y],2,true],[[x,y+TILE],[x+TILE,y+TILE],4,true],[[x,y],[x,y+TILE],8,false]];
    for(const [a,b,bit,front]of edges){
      if(!(t.mask&bit))continue;
      if(front)walls.push({points:projected([a,b,[b[0],b[1],-1.6*M],[a[0],a[1],-1.6*M]]),uv:[0,310/sources.wall.height,2048/sources.wall.width,768/sources.wall.height]});
      const dx=(b[0]-a[0])/TILE,dy=(b[1]-a[1])/TILE,w=.53*M;
      coping.push({points:projected([[a[0]+dy*w,a[1]-dx*w],[b[0]+dy*w,b[1]-dx*w],b,a]),uv:[0,0,2048/sources.wall.width,300/sources.wall.height]});
    }
  }
  add('walls',sources.wall,walls);
  // Canvas wall tint is kept as an explicit layer rather than modifying art.
  const wallTint=prefix+':wall-tint';scene.pixels(wallTint,1,1,new Uint8Array([2,6,6,46]));scene.layer(wallTint,wallTint,walls.map(q=>({...q,uv:[0,0,1,1]})));order.push(wallTint);atlases.push(wallTint);
  const pattern=[],pw=24*M,ph=sources.wet.height*pw/sources.wet.width;
  for(const t of tiles){
    for(let y=Math.floor(t.y/ph)*ph;y<t.y+t.h;y+=ph)for(let x=Math.floor(t.x/pw)*pw;x<t.x+t.w;x+=pw){
      const r=intersection(t,{x,y,w:pw,h:ph});if(r)pattern.push(rect(r.x,r.y,r.w,r.h,[(r.x-x)/pw,(r.y-y)/ph,(r.x+r.w-x)/pw,(r.y+r.h-y)/ph]));
    }
  }
  add('wet',sources.wet,pattern);
  const tint=prefix+':tint';scene.pixels(tint,1,1,new Uint8Array([3,13,20,96]));scene.layer(tint,tint,tiles.map(t=>rect(t.x,t.y,t.w,t.h)));order.push(tint);atlases.push(tint);
  sources.materials.forEach(({area,surface},i)=>{
    const quads=[];
    for(const tile of tiles){const r=intersection(tile,area);if(r)quads.push(rect(r.x,r.y,r.w,r.h,[(r.x-area.x)/area.w,(r.y-area.y)/area.h,(r.x+r.w-area.x)/area.w,(r.y+r.h-area.y)/area.h]));}
    add('material-'+i,surface,quads);
    const patch={x:area.x+area.w*.42,y:area.y+area.h-10*M,w:7*M,h:8*M},patches=[];
    for(const tile of tiles){const r=intersection(tile,patch);if(r)patches.push(rect(r.x,r.y,r.w,r.h,[(r.x-patch.x)/patch.w,(r.y-patch.y)/patch.h,(r.x+r.w-patch.x)/patch.w,(r.y+r.h-patch.y)/patch.h],.14));}
    add('patch-'+i,sources.patch,patches);
  });
  add('coping',sources.wall,coping);
  return {order,tiles:tiles.length,walls:walls.length,dispose(){for(const id of order)scene.removeLayer(id);for(const id of atlases)scene.removeAtlas(id);}};
}
