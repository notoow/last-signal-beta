import {FLEET_FRAMES} from './captain-fleet.js';
import {floatPose} from './sea-surface.js';
import {towBow} from './rogue-tow.js';
import {project,projectedBounds} from './world-projection.js';

// Legacy overhead renderer only. These are conservative crop envelopes, not
// physical footprints or alpha-tight masks. Never use the quay atlas here.
function envelope(frame,pose,x,y,w,h){
 const co=Math.cos(pose.angle),si=Math.sin(pose.angle);
 return projectedBounds(frame,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([u,v])=>({x:pose.x+u*co-v*si,y:pose.y+u*si+v*co})));
}
function union(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};}
export function legacySupplyGeometry(state,frame,reduced=false){
 if(state.mode!=='sailing'||frame.overview||frame.projectionId==='quay-v1')return null;
 const atlas=FLEET_FRAMES[state.captain],b=state.boat,t=state.tow;
 if(!atlas||!b||!t)return null;
 const [,by,bw,bh]=atlas.body,sy=b.width/bh,sx=b.length/bw;
 const bp=floatPose(b,reduced?0:state.time,false),tp=floatPose(t,reduced?0:state.time,!!t.anchor);
 const actor=union(envelope(frame,bp,-b.length/2,-(by+bh/2)*sy,atlas.top[2]*sx,atlas.top[3]*sy),envelope(frame,bp,-b.length*.52,2-b.width*.53,b.length*1.04,b.width*1.06));
 const supply=union(envelope(frame,tp,-t.length/2,-t.width/2,t.length,t.width),envelope(frame,tp,-t.length*.52+1,-t.width*.55+2,t.length*1.04,t.width*1.1));
 // Match the actual rope endpoint, which deliberately does not bob with art.
 return {boat:{bounds:actor},tow:{bow:project(frame,towBow(t)),visibleBounds:supply}};
}
export const legacySupplyVessels=(state,frame,{reduced=false}={})=>legacySupplyGeometry(state,frame,reduced);

