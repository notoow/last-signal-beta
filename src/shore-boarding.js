import {walkableAt} from './rogue-map.js';
import {crewRadius} from './shore-scale.js';
import {shoreSegment} from './shore-navigation.js';
export function boardingSlot(s,home){
 // Prefer the worker's existing screen side; do not cross a ready pair.
 const origin=home.rescuePoint||home.landing;
 const dx=origin.x-home.landing.x,dy=origin.y-home.landing.y;
 const relative=(s.rescue.x-s.person.x)-.6*(s.rescue.y-s.person.y);
 const side=Math.abs(relative)>.5?Math.sign(relative):Math.abs(dx-.6*dy)>.1?Math.sign(dx-.6*dy):(s.seed%2?1:-1);
 const radius=crewRadius(s);
 // Move inland if the preferred shoulder reaches the quay edge. Never cross
 // the captain to choose the opposite shoulder during a small movement.
 for(const inland of [0,2,4,6,8]){
  const p={x:s.person.x+.9071*side*9-.5145*inland,y:s.person.y-.4209*side*9-.8575*inland,sign:side};
  if(walkableAt(s.map,p,radius)&&shoreSegment(s.map,p,home.landing,radius))return p;
 }
 return null;
}
export function boardingTogether(s){
 const dx=s.rescue.x-s.person.x,dy=s.rescue.y-s.person.y;
 return Math.abs(dx-.6*dy)>=8&&Math.hypot(dx,dy)<=13&&Math.abs(dx*(156/788)+dy*.4266)<=4.5;
}
