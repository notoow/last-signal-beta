// Explicit per-cell rear-cliff mask; absent mask preserves legacy terrain.
const TILE=40;
export function cliffAt(map,x,y){return x>=0&&y>=0&&x<map.cols&&y<map.rows&&map.cliffs?.[y*map.cols+x]===1;}
export function cliffBlocksBody(map,p,radius=0){
 if(!map.cliffs)return false;
 for(let y=Math.floor((p.y-radius)/TILE);y<=Math.floor((p.y+radius)/TILE);y++)for(let x=Math.floor((p.x-radius)/TILE);x<=Math.floor((p.x+radius)/TILE);x++){
  if(!cliffAt(map,x,y))continue;
  const dx=Math.max(x*TILE-p.x,0,p.x-(x+1)*TILE),dy=Math.max(y*TILE-p.y,0,p.y-(y+1)*TILE);
  if(dx*dx+dy*dy<=radius*radius)return true;
 }return false;
}
export function cliffRayClear(map,a,b,{revealFace=false}={}){
 if(!map.cliffs)return true;
 let x=Math.floor(a.x/TILE),y=Math.floor(a.y/TILE);const endX=Math.floor(b.x/TILE),endY=Math.floor(b.y/TILE),dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy);
 const blocked=(cx,cy)=>cliffAt(map,cx,cy)&&!(revealFace&&cx===endX&&cy===endY);
 const stepX=dx?TILE/Math.abs(dx):Infinity,stepY=dy?TILE/Math.abs(dy):Infinity;
 let tx=dx?((sx>0?(x+1)*TILE:x*TILE)-a.x)/dx:Infinity,ty=dy?((sy>0?(y+1)*TILE:y*TILE)-a.y)/dy:Infinity;
 const limit=Math.abs(endX-x)+Math.abs(endY-y)+2;
 for(let n=0;n<limit;n++){
  if(blocked(x,y)||(!dx&&a.x%TILE===0&&blocked(x-1,y))||(!dy&&a.y%TILE===0&&blocked(x,y-1)))return false;
  if(x===endX&&y===endY)return true;
  if(Math.abs(tx-ty)<1e-10){if(blocked(x+sx,y)||blocked(x,y+sy))return false;x+=sx;y+=sy;tx+=stepX;ty+=stepY;}
  else if(tx<ty){x+=sx;tx+=stepX;}else{y+=sy;ty+=stepY;}
 }return false;
}

