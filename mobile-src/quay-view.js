import {makeCliffs,isCliff,h12Ready} from './cliff-view.js';
import {drawReturnLanding,isOwnReturnTarget} from './shore-return-cue.js';
import {project,unproject} from './world-projection.js';
import {edgeMarker} from './rogue-camera.js';
import {WORLD_UNITS_PER_METRE as M,CREW_HEIGHT,shoreScale,shoreRanges,humanVisualScale} from './shore-scale.js';
import {TILE,tileAt,shoreMask,shoreBuildings} from './rogue-map.js';
import {visibleAt,drawSurvey,surveyedAt} from './rogue-vision.js';
import {fauna} from './shore-encounters.js';
import {shoreActors,drawProjectedShoreActor} from './shore-animation.js';
import {drawDockedCaptainBoat,prepareDockedFleet} from './captain-fleet.js';
import {workRope,dockWorkRope,dockWorkSprite} from './harbor-work-art.js';
import {bakeQuayMaterial} from './quay-material.js';
import {prepareSupplyFleet,drawSupplyBoat} from './supply-fleet.js';
import {tugStern,towBow} from './rogue-tow.js';
import {quaySprite} from './quay-details.js';
import {drawCaptainOcclusion,drawCaptainVisible} from './shore-occlusion-outline.js';

const load=(file,retry=0)=>{const im=new Image();im.src='assets/art/'+file+(retry?'?quayRetry='+retry:'');return im;};
let art=null,loadStarted=0,retryAttempt=0;
let chestSource=null,chestCrop=null;
function chestRaster(){
  if(chestSource!==art.chest){
    chestSource=art.chest;chestCrop=document.createElement('canvas');
    chestCrop.width=465;chestCrop.height=318;
    const context=chestCrop.getContext('2d');
    context.drawImage(art.chest,885,90,465,318,0,0,465,318);
    // Materialize only this small crop now. A deferred canvas draw otherwise
    // decodes the whole PNG during the first discovered chest's GPU upload.
    context.getImageData(0,0,465,318);
  }
  return chestCrop;
}
const files={serviceGround:'quay-service-diffuse-v1.png',serviceWetness:'quay-service-wetness-v1.png',workshop:'quay-landing-workshop-v1.png',warehouse:'quay-landing-warehouse-v1.png',
  ground:'quay-landing-ground-v2.png',wall:'quay-landing-wall-v1.png',wet:'quay-landing-wet-material-v4.png',
  gold:'quay-landing-ground-gold-v3.png',patch:'quay-landing-wet-patch-v1.png',props:'quay-landing-props-v1.png',
  supplies:'quay-landing-supplies-v1.png',reflection:'quay-landing-water-reflection-v1.png',
  water:'harbor-water-v1.png',chest:'rogue-shore-props-v1.png'};
const ready=im=>im.complete&&im.naturalWidth>0;
export function prepareQuayArt(){
  if(!art){art=Object.fromEntries(Object.entries(files).map(([id,file])=>[id,load(file)]));loadStarted=performance.now();}
  const images=[...Object.values(art),prepareDockedFleet(),...prepareSupplyFleet()],loaded=images.filter(ready).length;
  if(loaded===images.length)chestRaster();
  return {status:loaded===images.length?'ready':images.some(im=>im.complete&&!im.naturalWidth)||performance.now()-loadStarted>15000?'error':'loading',loaded,total:images.length};
}
export function retryQuayArt(){
  if(!art)return prepareQuayArt();
  retryAttempt++;
  // A fresh URL breaks the browser's in-flight image-request coalescing. The
  // original stalled request cannot hold every subsequent retry hostage.
  for(const [id,file]of Object.entries(files))if(!ready(art[id]))art[id]=load(file,retryAttempt);
  prepareDockedFleet(true);prepareSupplyFleet(true);loadStarted=performance.now();
  return prepareQuayArt();
}
const materialCache=new WeakMap(),coverageCache=new WeakMap();
const terrainCache=new WeakMap();
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function polygon(c,points,fill){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}}
function plane(c,f,fn){const m=f.projection;c.save();c.transform(f.scale*m.xx,f.scale*m.yx,f.scale*m.xy,f.scale*m.yy,f.ox,f.oy);fn();c.restore();}
function visibleTiles(s,f){
  const b=f.bounds,tiles=[];
  for(let y=Math.max(0,Math.floor(b.y/TILE)-3);y<Math.min(s.map.rows,Math.ceil((b.y+b.h)/TILE)+3);y++)
    for(let x=Math.max(0,Math.floor(b.x/TILE)-3);x<Math.min(s.map.cols,Math.ceil((b.x+b.w)/TILE)+3);x++)
      if(tileAt(s.map,x,y))tiles.push({x:x*TILE,y:y*TILE,mask:shoreMask(s.map,x,y),tx:x,ty:y});
  return tiles;
}
// visibleTiles creates a fresh array each frame. Share its projected clip among
// buildings within that frame; the weak key cannot retain old camera frames.
const landClips=new WeakMap();
function clipLand(c,f,tiles){
  let path=landClips.get(tiles);
  if(!path){
    path=new Path2D();
    for(const r of tiles){const p=[r,{x:r.x+TILE,y:r.y},{x:r.x+TILE,y:r.y+TILE},{x:r.x,y:r.y+TILE}].map(q=>project(f,q));
      p.forEach((q,i)=>i?path.lineTo(q.x,q.y):path.moveTo(q.x,q.y));path.closePath();}
    landClips.set(tiles,path);
  }
  c.clip(path);
}
function buildingLights(b){
  // Lamp floor points measured on the original 1536px upright art. Its front
  // foundation has the same slope as the ground projection, so these offsets
  // share the sprite's 704px pivot and 98.5px/metre scale.
  const lamp=(pixel,spread,reach,power,width,height,alpha)=>({
    x:b.x+b.w/2+(pixel-704)/98.5*M,y:b.y+b.h,spread,reach,power,
    reflection:{width,height,alpha}});
  return b.visual==='warehouse'?[lamp(245,1.45,3.5,.65,3.6,4.1,.52)]:
    [lamp(467,2.4,3.4,.8,5.2,3.2,.45),
     lamp(874,2.1,3.1,.7,4.1,3.8,.4)];
}
function material(s,yard){
  let cache=materialCache.get(s.map);if(!cache){cache=new Map();materialCache.set(s.map,cache);}
  if(cache.has(yard.id))return cache.get(yard.id);
  const buildings=shoreBuildings(yard).filter(b=>b.visual==='warehouse'||b.visual==='workshop');
  const area={x:yard.x,y:yard.y,w:yard.w,h:yard.h};
  const lights=buildings.flatMap(buildingLights).map(l=>({...l,x:(l.x-area.x)/M,y:(l.y-area.y)/M}));
  const paint=bakeQuayMaterial(art.wet,{x:0,y:0,w:area.w/M,h:area.h/M},lights,Math.imul(yard.x,73856093)^Math.imul(yard.y,19349663),s.map.berths.find(b=>b.island===s.map.islands.indexOf(yard))?.layout==='service'?{diffuse:art.serviceGround,wetness:art.serviceWetness}:null);
  // Source-over layers have no animation. Composite once instead of scaling
  // five translucent yard-sized images through the land clip every frame.
  const surface=document.createElement('canvas');surface.width=paint.surface.width;surface.height=paint.surface.height;
  const context=surface.getContext('2d');
  for(const [layer,alpha]of [['surface',.96],['sheen',.55],['environment',.7],['sky',.65],['warm',.85]]){
    context.globalAlpha=alpha;context.drawImage(paint[layer],0,0);
  }
  const result={area,surface};cache.set(yard.id,result);return result;
}
// The GPU migration consumes the same authored textures and baked materials;
// it must not substitute a separate, simplified set of terrain artwork.
export function quayGroundSources(s){
  if(prepareQuayArt().status!=='ready')return null;
  return {wet:art.wet,wall:art.wall,patch:art.patch,water:art.water,materials:s.map.islands.map(yard=>material(s,yard))};
}
function ground(c,s,f,tiles){
  plane(c,f,()=>{
    c.beginPath();for(const t of tiles)c.rect(t.x,t.y,TILE,TILE);c.clip();
    const pattern=c.createPattern(art.wet,'repeat');pattern.setTransform(new DOMMatrix().scale(24*M/art.wet.width));
    c.fillStyle=pattern;c.fillRect(f.bounds.x-120,f.bounds.y-120,f.bounds.w+240,f.bounds.h+240);
    c.fillStyle='#09233460';c.fillRect(f.bounds.x-120,f.bounds.y-120,f.bounds.w+240,f.bounds.h+240);
    for(const yard of s.map.islands){
      if(!overlap(yard,{x:f.bounds.x-150,y:f.bounds.y-150,w:f.bounds.w+300,h:f.bounds.h+300}))continue;
      const {area,surface}=material(s,yard);
      c.drawImage(surface,area.x,area.y,area.w,area.h);
      // One broad wet patch per service yard, fixed to its generated geometry.
      c.globalAlpha=.14;c.drawImage(art.patch,yard.x+yard.w*.42,yard.y+yard.h-10*M,7*M,8*M);c.globalAlpha=1;
    }
  });
}
function walls(c,s,f,tiles){
  const edges=[];
  for(const t of tiles){const x=t.x,y=t.y;
    if(t.mask&1)edges.push([{x:x+TILE,y},{x,y},false]);
    if(t.mask&2)edges.push([{x:x+TILE,y:y+TILE},{x:x+TILE,y},true]);
    if(t.mask&4)edges.push([{x,y:y+TILE},{x:x+TILE,y:y+TILE},true]);
    if(t.mask&8)edges.push([{x,y},{x,y:y+TILE},false]);
  }
  // This fixed view sees south/east outward normals. Painting north/west
  // backfaces created folded dark triangles at concave water corners. Their
  // top coping still follows the real boundary; no interior seam has a wall.
  for(const [a,b,front] of edges){
    if(!front)continue;
    const p=project(f,a),q=project(f,b),h=1.6*M*f.scale;
    c.save();c.transform((q.x-p.x)/2048,(q.y-p.y)/2048,0,h/458,p.x,p.y);
    c.drawImage(art.wall,0,310,2048,458,0,0,2048,458);
    c.fillStyle='#0c201f2e';c.fillRect(0,0,2048,458);c.restore();
  }
  return edges;
}
function coping(c,f,edges){
  plane(c,f,()=>{for(const [a,b]of edges){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx));
    c.drawImage(art.wall,0,0,2048,300,0,-.53*M,len,.53*M);c.restore();
  }});
}
function terrain(c,s,f,tiles){const edges=walls(c,s,f,tiles);ground(c,s,f,tiles);coping(c,f,edges);return edges;}
function cachedTerrain(c,s,f,tiles){
  // Only static floor/walls are cached. Fog, actors, building occlusion and
  // water remain live. A padded raster follows camera translation cheaply;
  // pinch reuses it briefly, then refreshes at the settled exact resolution.
  const dpr=c.getTransform().a,now=performance.now();
  let entry=terrainCache.get(s.map);
  if(entry&&entry.requestScale!==f.scale){entry.requestScale=f.scale;entry.changedAt=now;}
  const ratio=entry?f.scale/entry.scale:1;
  const x=entry?f.ox-entry.ox*ratio:0,y=entry?f.oy-entry.oy*ratio:0;
  const covered=entry&&x<=0&&y<=0&&x+entry.width*ratio>=f.width&&y+entry.height*ratio>=f.height;
  if(!entry||!covered||entry.dpr!==dpr||entry.retry!==retryAttempt||ratio<.67||ratio>1.5||
      Math.abs(ratio-1)>.001&&now-entry.changedAt>140){
    const margin=192,width=Math.ceil(f.width+margin*2),height=Math.ceil(f.height+margin*2);
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);
    const ctx=canvas.getContext('2d'),view={...f,width,height,ox:f.ox+margin,oy:f.oy+margin};
    const corners=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(p=>unproject(view,p));
    const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
    view.bounds={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
    ctx.setTransform(dpr,0,0,dpr,0,0);terrain(ctx,s,view,visibleTiles(s,view));
    entry={canvas,width,height,ox:view.ox,oy:view.oy,scale:f.scale,requestScale:f.scale,changedAt:now,dpr,retry:retryAttempt};terrainCache.set(s.map,entry);
  }
  const scale=f.scale/entry.scale;
  c.drawImage(entry.canvas,0,0,entry.canvas.width,entry.canvas.height,f.ox-entry.ox*scale,f.oy-entry.oy*scale,entry.width*scale,entry.height*scale);
  // Metadata counts are based on the visible world, not the padded cache.
  return tiles.reduce((count,t)=>count+[1,2,4,8].filter(bit=>t.mask&bit).length,0);
}
function alphaCovers(im,bounds,foot,height){
  let mask=coverageCache.get(im);if(!mask){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0,384,256);
    mask=c.getImageData(0,0,384,256).data;coverageCache.set(im,mask);
  }
  for(const dy of [.15,.45,.75,.95])for(const dx of [-.12,0,.12]){
    const x=Math.floor((foot.x+height*dx-bounds.x)/bounds.w*384),y=Math.floor((foot.y-height*dy-bounds.y)/bounds.h*256);
    if(x>=0&&x<384&&y>=0&&y<256&&mask[(y*384+x)*4+3]>64)return true;
  }return false;
}
export function behind(f,p,box){
  const foot=project(f,p),corners=(box.footprint||[box,{x:box.x+box.w,y:box.y},{x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h}]).map(q=>project(f,q));
  let front=-Infinity;
  for(let i=0;i<corners.length;i++){const a=corners[i],b=corners[(i+1)%corners.length];if(foot.x<Math.min(a.x,b.x)||foot.x>Math.max(a.x,b.x))continue;
    front=Math.max(front,Math.abs(a.x-b.x)<1e-6?Math.max(a.y,b.y):a.y+(b.y-a.y)*(foot.x-a.x)/(b.x-a.x));}
  return foot.y<front;
}
const architectureReflections=new WeakMap();
function architectureReflection(image){
  let canvas=architectureReflections.get(image);
  if(canvas)return canvas;
  canvas=document.createElement('canvas');canvas.width=1540;canvas.height=1024;
  const c=canvas.getContext('2d');
  for(let row=0;row<32;row++){
    const sy=row*32;c.globalAlpha=.035+.04*(1+Math.sin(row*2.7))/2;
    c.drawImage(image,0,sy,1536,22,2+Math.sin(row*1.7)*2,sy,1536,22);
  }
  architectureReflections.set(image,canvas);return canvas;
}
export function quayScenerySprites(s,f,{cull=true}={}){
  const records=[],unit=f.pixelsPerMetre;
  const boxes=[...s.map.islands.flatMap(shoreBuildings),...s.map.props];
  for(const b of boxes){
    if(!b.visual)continue;
    if(s.survey&&![{x:b.x,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].some(p=>
      surveyedAt(s,p)))continue;
    const p=project(f,{x:b.x+b.w/2,y:b.y+b.h});
    const supply=b.visual==='supplies',im=supply?art.supplies:art[b.visual];if(!im)continue;
    const scale=supply?2*unit/996:unit/98.5,rect=supply?[284,92,996,809]:[0,0,1536,1024],pivot=supply?[498,809]:[704,858];
    const bounds={x:p.x-pivot[0]*scale,y:p.y-pivot[1]*scale,w:rect[2]*scale,h:rect[3]*scale};
    if(cull&&!overlap(bounds,{x:0,y:0,w:f.width,h:f.height}))continue;
    records.push({b,p,supply,im,scale,rect,bounds});
  }
  return records;
}
function scenery(c,s,f,tiles){
  const objects=[],unit=f.pixelsPerMetre;
  for(const {b,p,supply,im,scale,rect,bounds} of quayScenerySprites(s,f)){
    objects.push({type:'scenery',p,box:b,bounds,image:im,sourceRect:rect,draw:()=>{
      // Source art and projected anchors stay unchanged; no building fade.
      c.save();c.globalAlpha=1;c.drawImage(im,...rect,bounds.x,bounds.y,bounds.w,bounds.h);c.restore();
    }});
    if(supply)continue;
    c.save();clipLand(c,f,tiles);
    // Reflected architecture shares its real foundation, not a detached decal.
    c.save();const k=.24,slope=f.projection.yx;
    c.transform(scale,slope*(1+k)*scale,0,-k*scale,p.x-704*scale,p.y+(k*858-slope*(1+k)*704)*scale);
    c.drawImage(architectureReflection(im),-2,0);c.restore();
    for(const light of buildingLights(b)){
      const q=project(f,{x:light.x,y:light.y+.35*M}),r=light.reflection,w=r.width*unit,h=r.height*unit;
      c.globalAlpha=r.alpha;c.drawImage(art.gold,q.x-w*.5,q.y-h*.08,w,h);
    }c.restore();
  }
  return objects;
}
export function quayReflectionSprites(s,f){
  const commands=[];
  for(const {b,p,supply,im,scale} of quayScenerySprites(s,f,{cull:false})){
    if(supply)continue;
    const image=architectureReflection(im),k=.24,slope=f.projection.yx;
    const matrix=new DOMMatrix([scale,slope*(1+k)*scale,0,-k*scale,p.x-704*scale,p.y+(k*858-slope*(1+k)*704)*scale]);
    const points=[[-2,0],[image.width-2,0],[image.width-2,image.height],[-2,image.height]].flatMap(([x,y])=>{const q=matrix.transformPoint({x,y});return [q.x,q.y];});
    commands.push({image,points,opacity:1});
    for(const light of buildingLights(b)){
      const q=project(f,{x:light.x,y:light.y+.35*M}),r=light.reflection,w=r.width*f.pixelsPerMetre,h=r.height*f.pixelsPerMetre;
      const x=q.x-w*.5,y=q.y-h*.08;
      commands.push({image:art.gold,points:[x,y,x+w,y,x+w,y+h,x,y+h],opacity:r.alpha});
    }
  }
  return commands;
}
function boatAndLadder(c,s,f,tiles){
  const b=s.map.berths.find(b=>b.id===s.mooring);if(!b)return null;
  const unit=f.pixelsPerMetre,p=project(f,s.boat,-.8*M),ladder=project(f,b.ladder||b.landing);
  const crop=[1131,81,362,739],k=1.8*unit/739;
  c.drawImage(art.props,...crop,ladder.x-181*k,ladder.y-110*k,362*k,739*k);
  for(const offset of [-.27,.27]){
    const mount=project(f,{x:b.x+s.boat.length*offset,y:(b.ladder||b.landing).y},-.13*M),k=1.1333*unit/689;
    c.drawImage(art.props,255,104,450,689,mount.x-225*k,mount.y-25*k,450*k,689*k);
  }
  const reflection=project(f,s.boat,-1.6*M),w=12*unit,h=7.5*unit;
  c.save();c.globalAlpha=.45;c.drawImage(art.reflection,reflection.x-w/2,reflection.y-h*.25,w,h);c.restore();
  // The approved cutouts already carry a dark waterline. A second wide ellipse
  // floats visibly away from narrow Park/Han hulls, so retain that painted edge.
  const bounds=drawDockedCaptainBoat(c,p,s.boat.length*f.scale,s.captain,s.paint);
  for(const x of [-.32,.32]){
    const a=project(f,{x:b.x+s.boat.length*x,y:b.landing.y}),end=project(f,{x:s.boat.x+s.boat.length*x,y:s.boat.y-s.boat.width*.3},-.15*M);
    dockWorkRope(c,a,end,1,Math.max(1.3,unit*.1));dockWorkSprite(c,'cleat',a.x,a.y,unit*.6,unit*.48);
  }
  // Boarding uses the ladder. The existing gangway crop cannot span this gap
  // at its approved proportions and has no verified captain-specific deck
  // anchor; drawing it at the midpoint leaves an isolated plank on the water.
  return {bounds,point:p,ladder};
}
export function quayThreats(s){
  return s.combat.enemies.filter(e=>e.hp>0&&e.phase==='warn'&&visibleAt(s,e))
    .map(e=>({x:e.x,y:e.y,angle:e.angle,radius:fauna(s,e.kind).reach+.9}));
}
function groundThreats(c,s,f){
  plane(c,f,()=>{for(const e of quayThreats(s)){
    c.save();c.translate(e.x,e.y);c.rotate(e.angle);
    c.fillStyle='#e16c3444';c.strokeStyle='#ffd28a';c.lineWidth=1.2/f.scale;
    c.beginPath();c.moveTo(0,0);c.arc(0,0,e.radius,-1.05,1.05);c.closePath();c.fill();c.stroke();c.restore();
  }});
}
function supplyVessel(c,s,f,language,markers=true){
  const t=s.tow;if(!t||t.hp<=0||t.delivered||!visibleAt(s,t))return null;
  const sprite=drawSupplyBoat(c,t,f);if(!sprite)return null;
  const unit=f.pixelsPerMetre;
  if(t.connected)workRope(c,project(f,tugStern(s.boat),-.15*M),sprite.bow,t.tension,Math.max(1.2,unit*.1));
  if(t.anchor){
    const anchor=project(f,t.anchor,-1.5*M);
    workRope(c,sprite.bow,anchor,.65,Math.max(1,unit*.075));
    quaySprite(c,'anchor',anchor.x-unit*.22,anchor.y-unit*.1,unit*.45,unit*.75);
  }
  const mark=markers?edgeMarker(f,t,26):null;
  if(mark){
    c.save();c.translate(mark.x,mark.y);c.rotate(mark.angle);polygon(c,[{x:6,y:0},{x:-4,y:-4},{x:-4,y:4}],'#c8ddd1');c.restore();
  }
  return {...sprite,connected:t.connected,anchored:!!t.anchor,tension:t.tension,physicalBow:project(f,towBow(t),-.15*M),marker:mark};
}
export function drawQuayVessels(c,s,f){
  const supplyBehind=s.tow&&project(f,s.tow).y<project(f,s.boat).y;
  let boat,tow;
  if(supplyBehind){tow=supplyVessel(c,s,f,'ko',false);boat=boatAndLadder(c,s,f,[]);}
  else{boat=boatAndLadder(c,s,f,[]);tow=supplyVessel(c,s,f,'ko',false);}
  return {boat,tow};
}
function supplyCaption(c,tow,boat,f,language){
  if(!tow)return;
  const text=language==='en'?(tow.anchored?'Supply · anchored':'Supply · drifting'):(tow.anchored?'보급정 · 닻 내림':'보급정 · 표류');
  c.font='600 11px Pretendard, sans-serif';const w=c.measureText(text).width+8,b=tow.visibleBounds;
  const candidates=[{x:b.x+b.w/2,y:b.y+b.h+14},{x:b.x+b.w+w/2+8,y:b.y+b.h*.75},
    {x:b.x-w/2-8,y:b.y+b.h*.75},{x:b.x+b.w/2,y:b.y-6}];
  if(tow.marker)candidates.unshift({x:tow.marker.x,y:tow.marker.y-12});
  const blocks=[b,...f.occupied,...(boat?.bounds?[boat.bounds]:[])];
  for(const p of candidates){
    const rect={x:p.x-w/2,y:p.y-12,w,h:16};
    if(rect.x<8||rect.x+w>f.width-8||rect.y<8||rect.y+rect.h>f.height-8||blocks.some(b=>overlap(rect,b)))continue;
    label(c,text,p);tow.caption=rect;return;
  }
  // The HUD already reports cargo health/anchor state. Omit a redundant world
  // label when no clear spot exists; never stamp it onto the other vessel.
  tow.caption=null;
}
export function drawQuayVesselGuidance(c,s,f,vessels,language='ko'){
  const {boat,tow}=vessels;if(!tow)return null;
  const mark=edgeMarker(f,s.tow,26);
  if(mark){
    c.save();c.translate(mark.x,mark.y);c.rotate(mark.angle);
    polygon(c,[{x:6,y:0},{x:-4,y:-4},{x:-4,y:4}],'#c8ddd1');c.restore();
  }
  const annotated={...tow,marker:mark};supplyCaption(c,annotated,boat,f,language);
  return {marker:mark,caption:annotated.caption};
}
function label(c,text,p){
  c.font='600 11px Pretendard, sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#07191f';c.strokeText(text,p.x,p.y);c.fillStyle='#eee3c4';c.fillText(text,p.x,p.y);
}
// Shared loot image contract for both renderers; visibility and claimed state
// belong to the voyage, not to a separate GPU scene approximation.
export function quayLootSprites(s,f){
  const records=[];
  for(const berth of s.map.berths){
    if(!visibleAt(s,berth.searchPoint||berth.loot))continue;
    const p=project(f,berth.loot),k=1.2*f.pixelsPerMetre/465;
    records.push({berth,p,image:chestRaster(),claimed:s.claimed.includes(berth.id),
      rect:[0,0,465,318],bounds:{x:p.x-465*k/2,y:p.y-318*k,w:465*k,h:318*k}});
  }
  return records;
}
export function drawQuayCombat(c,s,f){
  for(const shot of s.combat.shots){
    const p=project(f,shot,8*shoreScale(s)),v=project({...f,ox:0,oy:0},{x:shot.vx,y:shot.vy});
    const a=Math.atan2(v.y,v.x);c.strokeStyle='#f4d398';c.lineWidth=2;c.beginPath();c.moveTo(p.x-Math.cos(a)*5,p.y-Math.sin(a)*5);c.lineTo(p.x,p.y);c.stroke();
  }
  for(const fx of s.combat.effects){const p=project(f,fx,3*shoreScale(s));c.save();c.globalAlpha=fx.left/.3;c.strokeStyle=fx.kind==='hurt'?'#f18c76':'#ffda8d';c.lineWidth=1.5;
    const r=(1-fx.left/.3)*7+2;for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(p.x+Math.cos(a)*r*.4,p.y+Math.sin(a)*r*.4);c.lineTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);c.stroke();}c.restore();}
}
export function drawQuaySearchProgress(c,s,f,search){
  if(s.person&&search?.progress>0){const p=project(f,s.person,CREW_HEIGHT*humanVisualScale(s));c.strokeStyle='#efc567';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y-7,4,-Math.PI/2,-Math.PI/2+Math.PI*2*search.progress/search.required);c.stroke();}
}
export function drawQuayObjective(c,s,f,task,language='ko'){
  if(task?.target&&s.person&&!isOwnReturnTarget(s,task.target)){
    const mark=edgeMarker(f,task.target,20);
    if(mark){
      c.save();c.translate(mark.x,mark.y);c.rotate(mark.angle);polygon(c,[{x:6,y:0},{x:-4,y:-4},{x:-4,y:4}],'#ecd393');c.restore();
      label(c,language==='en'?'Objective':'목표',{x:Math.max(30,Math.min(f.width-30,mark.x)),y:mark.y-10});
    }
  }
}
export function drawQuaySearchRings(c,s,f){
  for(const {berth,p,claimed} of quayLootSprites(s,f)){
    if(!s.person||distance(s.person,berth.loot)>=shoreRanges(s).search||claimed)continue;
    c.strokeStyle='#f3c477';c.lineWidth=1.25;c.beginPath();c.ellipse(p.x,p.y,f.pixelsPerMetre*.55,f.pixelsPerMetre*.18,.198,0,7);c.stroke();
  }
}
export function drawQuaySearchLabels(c,s,f,language='ko'){
  for(const {berth,p,claimed} of quayLootSprites(s,f)){
    if(s.person&&distance(s.person,berth.loot)<shoreRanges(s).search&&!claimed)
      label(c,language==='en'?'Search':'수색',{x:p.x,y:p.y-Math.max(1.2*f.pixelsPerMetre,CREW_HEIGHT*humanVisualScale(s)*f.scale+8)});
  }
}
export function drawQuay(c,s,f,{reduced=false,language='ko',task=null,search=null,cacheTerrain=true}={}){
  if(prepareQuayArt().status!=='ready'||s.map.cliffs&&!h12Ready())return {ready:false};
  const unit=f.pixelsPerMetre,tiles=visibleTiles(s,f);
  c.fillStyle='#092d38';c.fillRect(0,0,f.width,f.height);
  const texture=c.createPattern(art.water,'repeat'),motion=reduced?0:s.time;
  texture.setTransform(new DOMMatrix().translate(f.ox+Math.sin(motion*.14)*unit*.055,f.oy+Math.sin(motion*.11)*unit*.025).scale(18*unit/art.water.width));
  c.save();c.globalAlpha=.68;c.fillStyle=texture;c.fillRect(0,0,f.width,f.height);c.restore();
  const groundTiles=s.map.cliffs?tiles.filter(t=>!isCliff(s,t)):tiles;
  const edgeCount=cacheTerrain?cachedTerrain(c,s,f,groundTiles):terrain(c,s,f,groundTiles).length;
  const props=scenery(c,s,f,tiles);
  if(s.map.cliffs)props.push(...makeCliffs(c,s,f,tiles));
  // Survey dims remembered terrain, never a visible captain's actual painted
  // silhouette. Dynamic actors have their own LOS test; seen scenery retains
  // the same footprint ordering after this ground mask.
  plane(c,f,()=>drawSurvey(c,s));
  const supplyBehind=s.tow&&project(f,s.tow).y<project(f,s.boat).y;
  let boat,tow;
  if(supplyBehind){tow=supplyVessel(c,s,f,language);boat=boatAndLadder(c,s,f,tiles);}
  else{boat=boatAndLadder(c,s,f,tiles);tow=supplyVessel(c,s,f,language);}
  supplyCaption(c,tow,boat,f,language);
  groundThreats(c,s,f);
  // Cache contents, search clock, threats and rewards all come from the voyage.
  for(const {berth:b,p,image,claimed,rect,bounds} of quayLootSprites(s,f)){
    props.push({type:'cache',p,draw:()=>{c.save();c.globalAlpha=claimed?.45:1;c.drawImage(image,...rect,bounds.x,bounds.y,bounds.w,bounds.h);c.restore();}});
  }
  drawQuaySearchRings(c,s,f);
  const actorBounds=[];
  const actors=shoreActors(s).map(a=>({type:'actor',p:project(f,a.p),actor:a,draw:()=>actorBounds.push({enemy:!!a.enemy,worker:!!a.worker,
    ...(a.enemy?{kind:a.p.kind,phase:a.p.phase,hp:a.p.hp}:{}),...(a.p===s.person&&!a.enemy&&!a.worker?drawCaptainVisible(c,s,f,a,props.filter(o=>o.image&&behind(f,a.p,o.box)),reduced):drawProjectedShoreActor(c,s,a,f,reduced))})}));
  // Sorting uses the ground contact, then corrects only actual footprint
  // occlusion around tall buildings. Empty alpha padding never hides the crew.
  const objects=[...props,...actors].sort((a,b)=>a.p.y-b.p.y);
  for(const a of actors)for(const b of props.filter(p=>p.box)){
    const ai=objects.indexOf(a),bi=objects.indexOf(b),shouldBehind=behind(f,a.actor.p,b.box);
    if(shouldBehind&&ai>bi){objects.splice(ai,1);objects.splice(objects.indexOf(b),0,a);}
  }
  for(const o of objects)o.draw();
  const captain=actors.find(a=>a.actor.p===s.person&&!a.actor.enemy&&!a.actor.worker);
  const occluders=captain?objects.slice(objects.indexOf(captain)+1).filter(o=>o.image&&behind(f,s.person,o.box)):[];
  const captainOcclusion=drawCaptainOcclusion(c,s,f,captain?.actor,occluders,reduced);
  drawQuaySearchLabels(c,s,f,language);
  drawQuayCombat(c,s,f);
  drawQuaySearchProgress(c,s,f,search);
  const returnCue=drawReturnLanding(c,s,f,boat?.bounds);
  drawQuayObjective(c,s,f,task,language);
  return {ready:true,returnCue,boat,tow,vesselOrder:supplyBehind?['supply','captain']:['captain','supply'],actorBounds,captainOcclusion,scenery:props.filter(p=>p.box).map(p=>({box:p.box,bounds:p.bounds})),shoreEdges:edgeCount};
}
