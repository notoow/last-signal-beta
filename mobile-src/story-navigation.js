import {WIDTH,HEIGHT} from './core.js';
import {HARBOR} from './rescue-core.js';
import {towMission,towWalls,towTarget} from './tow-core.js';
import {navigationViewport} from './navigation-map.js';

// Story harbors are already charted. This copies geometry and known vessels;
// it does not advance the mission or use roguelike discovery to reveal actors.
export function storyNavigationMap(s,view=null){
  if(!s)return null;
  const tow=s.kind==='tow',world=tow?towMission(s).world:{width:WIDTH,height:HEIGHT};
  const p=tow?s.boat:s.player,b=tow?towTarget(s):null;
  const destination=tow?world.berth:HARBOR.extraction;
  return {width:world.width,height:world.height,mode:'sailing',tiles:[],survey:null,
    islands:(tow?towWalls(s):[...HARBOR.buildings,...HARBOR.platforms]).map(r=>({x:r.x,y:r.y,w:r.w,h:r.h})),
    player:{x:p.x,y:p.y,angle:tow?p.angle:s.mission.heading},boat:b?{x:b.x,y:b.y}:null,
    target:destination?{x:destination.x+(destination.w||0)/2,y:destination.y+(destination.h||0)/2}:null,
    berths:[],enemies:[],rescue:null,viewport:navigationViewport(view)};
}
