import {unproject} from './world-projection.js';

export function navigationTransform(width,height,map){
  const scale=Math.min(width/map.width,height/map.height);
  return {scale,x:(width-map.width*scale)/2,y:(height-map.height*scale)/2};
}
export function navigationViewport(view){
  if(!view?.viewport||!(view.scale>0))return null;
  const {x,y,w,h}=view.viewport;
  return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}].map(p=>unproject(view,p));
}

// A north-up chart of the sanitized, remembered world. Callers supply no live
// offscreen actors. Reading this chart never explores terrain or moves a camera.
export function drawNavigationMap(canvas,map){
  if(!map||!canvas)return;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const {scale:s,x:ox,y:oy}=navigationTransform(w,h,map);
  c.clearRect(0,0,w,h);c.fillStyle='#07151c';c.fillRect(0,0,w,h);
  c.save();c.translate(ox,oy);c.scale(s,s);
  c.beginPath();c.rect(0,0,map.width,map.height);c.clip();
  c.fillStyle='#15343f';c.fillRect(0,0,map.width,map.height);
  c.fillStyle='#889b96';
  if(map.tiles?.length&&map.cols&&map.rows){
    const tw=map.width/map.cols,th=map.height/map.rows;
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)if(map.tiles[y*map.cols+x])c.fillRect(x*tw,y*th,tw+.5,th+.5);
  }else for(const p of map.islands||[])c.fillRect(p.x,p.y,p.w,p.h);
  if(map.survey){
    c.fillStyle='#07151c';
    for(let y=0;y<Math.ceil(map.height/map.surveyCell);y++)for(let x=0;x<map.surveyCols;x++)
      if(map.survey[y*map.surveyCols+x]!==1)c.fillRect(x*map.surveyCell,y*map.surveyCell,map.surveyCell+.5,map.surveyCell+.5);
  }
  if(map.viewport?.length){
    c.beginPath();map.viewport.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
    c.fillStyle='#d8e9e310';c.fill();c.strokeStyle='#e4eee15c';c.lineWidth=1/s;c.stroke();
  }
  const dot=(p,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(p.x,p.y,r/s,0,Math.PI*2);c.fill();};
  for(const b of map.berths||[])dot(b,3,b.claimed?'#829b95':'#e6c27b');
  for(const e of map.enemies||[])dot(e,2.5,e.asleep?'#b69078':'#ef8772');
  if(map.target){
    c.strokeStyle='#f5cd70';c.lineWidth=1.5/s;c.beginPath();c.arc(map.target.x,map.target.y,7/s,0,Math.PI*2);c.stroke();
  }
  if(map.rescue)dot(map.rescue,3.5,'#8ae0c4');
  if(map.boat&&Math.hypot(map.boat.x-map.player.x,map.boat.y-map.player.y)>4){
    c.strokeStyle='#9ddcea';c.lineWidth=2/s;c.strokeRect(map.boat.x-3/s,map.boat.y-3/s,6/s,6/s);
  }
  c.translate(map.player.x,map.player.y);c.rotate(map.player.angle||0);
  c.strokeStyle='#061217';c.lineWidth=3/s;c.fillStyle='#fff3ba';
  c.beginPath();c.moveTo(8/s,0);c.lineTo(-6/s,-5/s);c.lineTo(-3/s,0);c.lineTo(-6/s,5/s);c.closePath();c.stroke();c.fill();
  c.restore();
}
