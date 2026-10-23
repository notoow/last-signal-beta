import {exitQuayState} from './exit-quay.js';
import {workSprite,workRope} from './harbor-work-art.js';

const load=name=>{const image=new Image();image.src='assets/art/'+name;return image;};
const terrain=load('harbor-terrain-v2.png'),repair=load('east-quay-repair-v1.png');
const relays={off:load('lighthouse-relay-off-v1.png'),on:load('lighthouse-relay-on-v1.png')};
const ready=image=>image.complete&&image.naturalWidth>0;
const repairFrames={'repair-bench':[333,27,500,649],'welding-cart':[994,94,452,575],worklight:[1576,226,268,302]};

export function exitQuayLabel(state,language='ko'){
  if(!state)return null;
  const en=language==='en',name=(en?{repair:'Repair quay',sluice:'Sluice service quay',signal:'Lighthouse berth'}:
    {repair:'정비 부두',sluice:'수문 관리 부두',signal:'등대 부두'})[state.role];
  return name+(state.open?'':en?' · Blocked':' · 봉쇄');
}

// Paint only the already-solid apron. Ropes are a receipt of the accepted E
// action, never a promise made by approach distance or docking readiness.
export function drawExitQuay(c,s){
  const state=exitQuayState(s);if(!state)return null;
  const {site,role,open,tied}=state,r=site.surface,props=[],ropes=[];
  c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();
  if(ready(terrain)){
    const tw=terrain.naturalWidth/3,th=terrain.naturalHeight/3;
    // Reuse the same concrete and timber material scale as the harbor yards.
    for(let y=r.y;y<r.y+r.h;y+=80)c.drawImage(terrain,2,2,tw-4,th-4,r.x,y,r.w,80);
    for(let y=r.y+16;y<r.y+r.h-16;y+=40)c.drawImage(terrain,tw+2,th+2,tw-4,th-4,r.x+2,y,12,40);
    // The retaining edge faces west; the whole strip stays on existing land.
    for(let y=r.y;y<r.y+r.h;y+=40){
      c.save();c.translate(r.x+7,y+20);c.rotate(Math.PI/2);
      c.drawImage(terrain,100,1084,210,166,-20,-7,40,14);c.restore();
    }
  }
  for(const p of site.props){
    const box={x:p.x-p.w/2,y:p.y-p.h/2,w:p.w,h:p.h};
    if(p.id==='worklight'){
      if(ready(repair)){
        c.save();if(!open)c.filter='grayscale(1) brightness(.4)';
        c.drawImage(repair,...repairFrames[p.id],box.x,box.y,box.w,box.h);c.restore();props.push({id:p.id,...box});
      }
    }else if(role==='repair'){
      if(ready(repair)){c.drawImage(repair,...repairFrames[p.id],box.x,box.y,box.w,box.h);props.push({id:p.id,...box});}
    }else if(p.id==='repair-bench'){
      if(role==='sluice'){
        if(workSprite(c,'power',p.x,p.y,p.w,p.h,0,open))props.push({id:'sluice-power',...box});
      }else{
        const relay=relays[open?'on':'off'];
        if(ready(relay)){c.drawImage(relay,box.x,box.y,box.w,box.h);props.push({id:open?'relay-on':'relay-off',...box});}
      }
    }else{
      if(workSprite(c,role==='sluice'?'winch':'power',p.x,p.y,p.w,p.h,0,open))props.push({id:role==='sluice'?'service-winch':'signal-power',...box});
    }
  }
  for(const p of site.cleats)workSprite(c,'cleat',p.x,p.y,14,11);
  c.restore();
  if(tied){
    const b=s.boat,a=b.angle,side=-b.width/2;
    const ends=[-.32,.32].map(k=>({x:b.x+Math.cos(a)*b.length*k-Math.sin(a)*side,y:b.y+Math.sin(a)*b.length*k+Math.cos(a)*side})).sort((a,b)=>a.y-b.y);
    site.cleats.forEach((cleat,i)=>{workRope(c,ends[i],cleat,.6,2.2);ropes.push({from:ends[i],to:cleat});});
  }
  return {...state,props,ropes,terrainReady:ready(terrain),repairReady:ready(repair)};
}
