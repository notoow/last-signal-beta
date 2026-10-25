// Generation8 compacts new voyages while preserving authored sprite scale.
// Complete terrain before spawning actors; never migrate an underway map.
import {WORLD_UNITS_PER_METRE as M} from './shore-scale.js';
export function compactHarbor(source,seed,{variedSearch=true}={}){
 const map=structuredClone(source);
  for(const b of map.berths){
    const r=map.islands[b.island],old={x:r.x,y:r.y,w:r.w,h:r.h},edge=r.y+r.h;
    const x=Math.floor((b.x-80)/40)*40,y=edge-120;
    const contains=(p,box)=>p.x>=box.x&&p.x<box.x+box.w&&p.y>=box.y&&p.y<box.y+box.h;
    for(let ty=old.y/40;ty<edge/40;ty++)for(let tx=old.x/40;tx<(old.x+old.w)/40;tx++){
      const p={x:tx*40+20,y:ty*40+20};
      if(!contains(p,{x,y,w:160,h:120}))map.tiles[ty*map.cols+tx]=0;
    }
    Object.assign(r,{x,y,w:160,h:120});
    // Leave 7m from building fronts to quay edge: apron and passage do not
    // double-count the same clearance. A 3.5m central passage joins the rear.
    const center=x+80,gap=3.5*M,front=edge-7*M;
    r.buildings=[{kind:'warehouse',visual:'warehouse',x:center-gap/2-8*M,y:front-4.33*M,w:8*M,h:4.33*M},
      {kind:'warehouse',visual:'workshop',x:center+gap/2,y:front-4.33*M,w:8*M,h:4.33*M}];
    map.props=map.props.filter(p=>!contains(p,old));
    b.x=center;b.ladder={x:center,y:edge};b.landing={x:center,y:edge-6};
    // Sideyard keeps the searcher outside the workshop roof silhouette.
    const choices=[{x:center-13*M,y:front-2*M},{x:center-6*M,y:front+3*M},{x:center+6*M,y:front+3*M}];
    const index=variedSearch?((Math.imul(seed+1,2654435761)>>>0)+b.island)%choices.length:0;
    b.loot=choices[index];b.searchPoint={x:b.loot.x,y:b.loot.y+.85*M};
    map.props.push({kind:'cache',visual:'cache',berth:b.id,x:b.loot.x-.45*M,y:b.loot.y-.5*M,w:.9*M,h:.5*M});
  }

 const m=map,yards=m.berths.map(b=>m.islands[b.island]).sort((a,b)=>a.x-b.x),removed=[];
  // Shared positions are consumed by interaction, physics and rendering.
  m.landmarks={net:{x:2110,y:500},debris:{x:2070,y:350},testSite:{x:2080,y:190}};
  const solids=[...m.islands,...m.props],protectedPoints=[m.spawn,m.boss,m.exit,...m.berths];
  for(let i=1;i<yards.length;i++){
    const left=yards[i-1].x+yards[i-1].w,right=yards[i].x;
    // Keep at least 320 units between districts for the 264-unit convoy
    // diameter; only remove complete grid columns free of authored solids.
    const count=Math.max(0,Math.floor((right-left-320)/40));
    let accepted=0;
    for(let x=Math.ceil((left+160)/40)*40;x+40<=right-160&&accepted<count;x+=40){
      if(solids.some(p=>p.x<x+40&&p.x+p.w>x)||protectedPoints.some(p=>p.x>=x-40&&p.x<=x+80))continue;
      removed.push(x/40);accepted++;
    }
  }
  const columns=new Set(removed),oldCols=m.cols;
  if(removed.some(c=>(c+1)*40>2210))throw Error('Compact seam overlaps boss arena');
  m.arenaShiftX=-removed.length*40;
  m.tiles=m.tiles.filter((_,i)=>!columns.has(i%oldCols));
  const shift=x=>x-removed.reduce((sum,c)=>sum+Math.max(0,Math.min(40,x-c*40)),0);
  const seen=new WeakSet();
  function move(value){
    if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
    if(typeof value.x==='number')value.x=shift(value.x);
    if(typeof value.homeX==='number')value.homeX=shift(value.homeX);
    for(const [key,child]of Object.entries(value))if(key!=='tiles'&&key!=='survey')move(child);
  }
  // Only spatial trees: do not shift current vectors, velocity or UI data.
  for(const value of [m.islands,m.props,m.nodes,m.edges,m.berths,m.spawn,m.boss,m.exit,m.landmarks])move(value);
  m.cols-=removed.length;m.width-=removed.length*40;
  // Column removal contracts a vertical channel's width as well as travel
  // distance. Re-carve the original planned width locally at each seam.
  // Authored land/objects are immutable; an obstructed repair must fail QA.
  const seams=[...new Set(removed.map(c=>shift(c*40)))],protectedRects=[...m.islands,...m.props];
  let repairedTiles=0;
  for(const e of m.edges)for(let segment=1;segment<e.points.length;segment++){
    const a=e.points[segment-1],b=e.points[segment],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/20)),radius=e.width/2;
    for(let step=0;step<=steps;step++){
      const cx=a.x+(b.x-a.x)*step/steps,cy=a.y+(b.y-a.y)*step/steps;
      if(!seams.some(x=>Math.abs(x-cx)<=radius))continue;
      for(let y=Math.max(2,Math.floor((cy-radius)/40));y<Math.min(m.rows-2,Math.ceil((cy+radius)/40));y++)for(let x=Math.max(2,Math.floor((cx-radius)/40));x<Math.min(m.cols-2,Math.ceil((cx+radius)/40));x++){
        const px=(x+.5)*40,py=(y+.5)*40,index=y*m.cols+x;
        if(!m.tiles[index]||!seams.some(seam=>Math.abs(px-seam)<=radius)||Math.hypot(px-cx,py-cy)>=radius)continue;
        if(protectedRects.some(r=>r.x<(x+1)*40&&r.x+r.w>x*40&&r.y<(y+1)*40&&r.y+r.h>y*40))continue;
        m.tiles[index]=0;repairedTiles++;
      }
    }
  }

 m.version=8;return m;
}
