import {TILE,tileAt} from './rogue-map.js';
import {DOCK_LIMITS} from './docking-readiness.js';

const sites=new WeakMap();
const freeze=value=>{
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
};

// A dressing plan for existing solid ground, never new collision geometry.
// Legacy open-water maps have no eastern quay and keep their original marker.
export function exitQuay(map){
  if(map.version<2)return null;
  if(sites.has(map))return sites.get(map);
  const exit=map.exit,row=Math.floor(exit.y/TILE);
  let col=Math.ceil((exit.x+DOCK_LIMITS.distance)/TILE);
  while(col<map.cols&&!tileAt(map,col,row))col++;
  const top=Math.floor((exit.y-140)/TILE),bottom=Math.ceil((exit.y+140)/TILE);
  let supported=col<map.cols&&top>=0&&bottom<=map.rows;
  for(let y=top;supported&&y<bottom;y++){
    if(tileAt(map,col-1,y))supported=false;
    for(let x=col;supported&&x<map.cols;x++)if(!tileAt(map,x,y))supported=false;
  }
  const x=col*TILE,w=map.width-x;
  if(!supported||w<36){sites.set(map,null);return null;}
  const center=x+18;
  const plan=freeze({
    surface:{x,y:top*TILE,w,h:(bottom-top)*TILE},
    shoreX:x,berth:{x:exit.x,y:exit.y,angle:exit.angle},
    cleats:[{x:x+10,y:exit.y-100},{x:x+10,y:exit.y+108}],
    props:[
      {id:'repair-bench',x:center,y:exit.y-58,w:28,h:28*649/500},
      {id:'welding-cart',x:center,y:exit.y+20,w:22,h:22*575/452},
      {id:'worklight',x:center,y:exit.y+76,w:10,h:10*302/268}
    ]
  });
  sites.set(map,plan);return plan;
}

export function exitQuayState(s){
  const site=exitQuay(s.map);if(!site)return null;
  return {site,role:['repair','sluice','signal'][s.depth],
    open:!!s.boss.cleared,
    // Readiness alone must not paint ropes as though E had been pressed.
    tied:s.depth===0&&!!s.salvage?.pending||s.depth===2&&s.status==='won'};
}
