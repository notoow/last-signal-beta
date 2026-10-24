import {walkableAt} from './rogue-map.js';
import {shoreRoute} from './shore-navigation.js';
import {crewRadius,WORLD_UNITS_PER_METRE as M} from './shore-scale.js';

// A separate generation profile: do not relocate objects in underway saves.
// Candidate order is seeded independently of sea topology and item rewards.
export function placeShoreSearch(map,seed,depth){
  for(const b of map.berths){
    const yard=map.islands[b.island],cache=map.props.find(p=>p.kind==='cache'&&p.berth===b.id);
    if(!cache)throw Error('Missing physical search cache');
    const original={x:cache.x,y:cache.y};
    const choices=[];
    for(const dx of [-65,-40,0,40,65])for(const dy of [40,65,90])choices.push({dx,dy});
    let state=(seed^Math.imul(depth+1,0x9e3779b1)^Math.imul(b.island+1,0x85ebca6b))>>>0;
    for(let i=choices.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
    let placed=false;
    // Remove the old cache while checking candidates; restore exactly on failure.
    map.props.splice(map.props.indexOf(cache),1);
    for(const {dx,dy} of choices){
      const loot={x:b.x+dx,y:yard.y+yard.h-dy},search={x:loot.x,y:loot.y+.85*M};
      if(loot.x<yard.x+8||loot.x>yard.x+yard.w-8||loot.y<yard.y+8||!walkableAt(map,loot,3))continue;
      Object.assign(cache,{x:loot.x-.45*M,y:loot.y-.5*M});map.props.push(cache);
      const route=shoreRoute(map,b.landing,search,crewRadius(map));
      if(route){b.loot=loot;b.searchPoint=search;placed=true;break;}
      map.props.pop();
    }
    if(!placed){Object.assign(cache,original);map.props.push(cache);throw Error('No reachable search layout');}
  }
  return map;
}
