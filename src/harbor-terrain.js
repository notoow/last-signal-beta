import {identityCliffs,h12Ready} from './cliff-view.js';
import {TILE,tileAt,shoreMask,shoreBuildings} from './rogue-map.js';
import {harborFrames,gameArt} from './game-art.js';
import {quayReady,quaySprite,quayFrames} from './quay-details.js';
const load=name=>{const i=new Image();i.src='assets/art/'+name;return i;};
const atlas=load('harbor-terrain-v2.png'),modules=load('harbor-modules-v1.png');
const ready=i=>i.complete&&i.naturalWidth>0,cache=new WeakMap();
function sprite(c,kind,x,y,w,h){
  // The sailing/chart view shares the new shore solids and uses its existing
  // top-down crate artwork for cache and workbench footprints.
  if(kind==='cache'||kind==='bench')kind='crates';
  if(quayFrames[kind]){quaySprite(c,kind,x,y,w,h);return;}
  const f=harborFrames[kind];if(!ready(modules))return;
  c.drawImage(modules,...f,x,y,w,h);
}
function build(map){
  const canvas=document.createElement('canvas');canvas.width=map.width;canvas.height=map.height;
  const c=canvas.getContext('2d'),tw=atlas.naturalWidth/3,th=atlas.naturalHeight/3;
  const edges=[];
  // Material sheets span several collision tiles, so the 40px navigation grid stays invisible.
  for(let material=1;material<=4;material++){
    c.save();c.beginPath();
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)if(tileAt(map,x,y)===material)c.rect(x*TILE,y*TILE,TILE,TILE);
    c.clip();
    const sample=document.createElement('canvas');sample.width=material===1?480:128;sample.height=160;
    const sc=sample.getContext('2d');
    if(material===1)sc.drawImage(atlas,2,2,atlas.naturalWidth-4,th-4,0,0,480,160);
    else sc.drawImage(atlas,(material-2)*tw+2,th+2,tw-4,th-4,0,0,128,160);
    c.fillStyle=c.createPattern(sample,'repeat');c.fillRect(0,0,map.width,map.height);
    c.fillStyle=material===4?'#10252450':'#26353428';c.fillRect(0,0,map.width,map.height);
    // Broad water stains vary at yard scale, not tile scale.
    for(let i=0;i<50;i++){
      const x=(i*439+map.seed*13)%map.width,y=(i*233+map.seed*7)%map.height,r=75+(i%4)*37;
      const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3?'#172b3027':'#d7c5a016');g.addColorStop(1,'#20353600');
      c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }
    c.restore();
  }
  for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
    const land=tileAt(map,x,y);if(!land)continue;
    const mask=shoreMask(map,x,y);if(mask)edges.push({x:x*TILE,y:y*TILE,mask,rock:land===4});
  }
  // Retaining-wall strips rotate only around exposed sides, leaving shared tiles seamless.
  for(const e of edges)for(let side=0;side<4;side++)if(e.mask&(1<<side)){
    c.save();c.translate(e.x+20,e.y+20);c.rotate((side-2)*Math.PI/2);
    if(e.rock){
      c.drawImage(atlas,tw*2+2,th+th*.65,tw-4,th*.32,-20,12,40,8);
    }else{
      c.fillStyle='#061d2666';c.fillRect(-20,15,40,22);
      c.drawImage(atlas,100,1084,210,166,-20,5,40,28);
      c.fillStyle='#c8bea270';c.fillRect(-20,5,40,1.2);
    }
    c.restore();
  }
  let floor=null;
  if(map.cliffs){
    c.save();c.beginPath();for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)if(map.cliffs[y*map.cols+x]===1)c.rect(x*TILE,y*TILE,TILE,TILE);
    c.clip();c.clearRect(0,0,map.width,map.height);c.restore();
    floor=document.createElement('canvas');floor.width=map.width;floor.height=map.height;floor.getContext('2d').drawImage(canvas,0,0);c.clearRect(0,0,map.width,map.height);
  }
  // Architecture uses fixed-size pieces placed only on solid footprints.
  for(const p of map.props)sprite(c,p.kind,p.x,p.y,p.w,p.h);
  for(const r of map.islands){
    if(['scenery','observation'].includes(r.role))continue;
    c.save();c.beginPath();c.rect(r.x+8,r.y+8,r.w-16,r.h-18);c.clip();
    c.globalAlpha=.58;
    quaySprite(c,'puddle',r.x+r.w*.3,r.y+r.h*.48,105,105);
    quaySprite(c,'salt',r.x+10,r.y+r.h-103,63,82);
    c.restore();
    // Timber apron assembled in 40px pieces. Pedestrian blockers use these exact buildings.
    for(let x=r.x;x<r.x+r.w;x+=40)c.drawImage(atlas,tw+2,th+2,tw-4,th-4,x,r.y+r.h-40,40,30);
    for(const b of shoreBuildings(r)){
      c.fillStyle='#071c2635';c.fillRect(b.x+4,b.y+b.h*.75,b.w+4,b.h*.25+5);
      sprite(c,b.kind,b.x,b.y,b.w,b.h);
    }
    sprite(c,'crates',r.x+18,r.y+r.h-92,32,27);
    gameArt.dressing(c,r,0,true,[]);
    // Thin worn apron markings clarify the pedestrian working area.
    c.strokeStyle='#c5b57d55';c.lineWidth=2;c.setLineDash([8,14]);
    c.beginPath();c.moveTo(r.x+16,r.y+r.h-50);c.lineTo(r.x+r.w-16,r.y+r.h-50);c.stroke();c.setLineDash([]);
  }
  return {canvas:floor||canvas,scenery:floor?canvas:null,edges};
}
export function drawHarborTerrain(c,map,time=0,bounds=null,state=null,frame=null){
  if(!ready(atlas)||!ready(modules)||!quayReady()||map.cliffs&&!h12Ready())return false;
  let data=cache.get(map);if(!data){data=build(map);cache.set(map,data);}
  c.drawImage(data.canvas,0,0);
  if(map.cliffs&&state&&frame){identityCliffs(c,state,data,frame);c.drawImage(data.scenery,0,0);}
  // Small moving wash belongs to shore edges, rather than uniformly covering the screen.
  c.save();c.strokeStyle='#b1d3cf';c.lineWidth=1.2;
  for(const e of data.edges){
    if(bounds&&(e.x<bounds.x-60||e.y<bounds.y-60||e.x>bounds.x+bounds.w+60||e.y>bounds.y+bounds.h+60))continue;
    for(let side=0;side<4;side++)if(e.mask&(1<<side)){
      const phase=(Math.sin(time*.9+e.x*.027+e.y*.013)+1)/2;
      c.save();c.translate(e.x+20,e.y+20);c.rotate((side-2)*Math.PI/2);c.globalAlpha=.025+phase*.085;
      c.beginPath();c.moveTo(-17,35+phase*3);c.quadraticCurveTo(0,37+phase*3,17,35+phase*3);c.stroke();c.restore();
    }
  }
  c.restore();return true;
}
