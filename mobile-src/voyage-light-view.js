import {daylight,campStatus} from './voyage-daylight.js';
import {project as projectWorld} from './world-projection.js';
// Bounded screen tint preserves silhouettes and warning readability. The
// planning chart keeps its instrument colors; the stove glows only while the
// authoritative camp timer is running, at the moored boat's cabin.
export function voyageLight(c,s,frame,reduced,mapOpen,dpr=1){
  if(!s.daylight||mapOpen)return;
  const sky=daylight(s),alpha=(1-sky.light)*.26;
  frame.daylight={...sky,tintAlpha:alpha,stove:null};
  c.save();c.setTransform(dpr,0,0,dpr,0,0);
  if(alpha>0){c.fillStyle=`rgba(5,14,35,${alpha})`;c.fillRect(0,0,frame.width,frame.height);}
  if(campStatus(s)?.reason==='resting'){
    const bounds=frame.quay?.boat?.bounds,p=bounds?{x:bounds.x+bounds.w*.62,y:bounds.y+bounds.h*.4}:projectWorld(frame,s.boat);
    const radius=22*(reduced?1:1+Math.sin(s.time*4)*.03),glow=c.createRadialGradient(p.x,p.y,1,p.x,p.y,radius);
    glow.addColorStop(0,'#ffe0a4a0');glow.addColorStop(.25,'#ffa7486b');glow.addColorStop(1,'#e6853100');
    c.fillStyle=glow;c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fill();
    c.fillStyle='#ffd394';c.fillRect(p.x-2,p.y-3,4,6);frame.daylight.stove={...p,radius};
  }
  c.restore();
}
