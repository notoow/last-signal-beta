import {project} from './world-projection.js';
import {shoreRanges,WORLD_UNITS_PER_METRE as M,CREW_HEIGHT} from './shore-scale.js';
import {surveyedAt} from './rogue-vision.js';
import {knownBerth} from './harbor-plan.js';

const overlap=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
const valid=r=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0;
export function isOwnReturnTarget(s,target){
 const b=s.map?.berths?.find(b=>b.id===s.mooring);
 return !!(s.person&&b&&target&&Math.hypot(target.x-b.landing.x,target.y-b.landing.y)<.01);
}
// Read-only. Only the player's already discovered, current boarding point is
// eligible. No other quay, exit, actor, path or survey cell is exposed here.
export function returnLandingCue(s,f,boatBounds=null,previous=null){
 const hidden=reason=>({kind:'hidden',reason});
 if(s.status!=='playing'||s.mode!=='ashore'||!s.person)return hidden('inactive');
 const b=s.map.berths.find(b=>b.id===s.mooring);
 if(!b||!knownBerth(s,b)||!surveyedAt(s,b.landing))return hidden('unknown-own-landing');
 const distance=Math.hypot(s.person.x-b.landing.x,s.person.y-b.landing.y);
 if(distance<shoreRanges(s).boarding)return hidden('boarding-control-near');
 const q=project(f,b.landing),foot=project(f,s.person),h=CREW_HEIGHT*f.scale;
 const hud=(f.occupied||[]).filter(valid),actor={x:foot.x-h*.4,y:foot.y-h-4,w:h*.8,h:h+8};
 const safe=r=>r.x>=6&&r.y>=6&&r.x+r.w<=f.width-6&&r.y+r.h<=f.height-6&&!hud.some(b=>overlap(r,b,6))&&!overlap(r,actor,4);
 const boatVisible=valid(boatBounds)&&boatBounds.x>=0&&boatBounds.y>=0&&boatBounds.x+boatBounds.w<=f.width&&boatBounds.y+boatBounds.h<=f.height&&!hud.some(b=>overlap(boatBounds,b,2));
 const type=boatVisible?'ground':'landing',bounds=boatVisible?{x:q.x-11,y:q.y-6,w:22,h:13}:{x:q.x-12,y:q.y-33,w:24,h:40};
 const common={targetId:b.id,target:{...b.landing},projectedTarget:q,metres:Math.ceil(distance/M),boatVisible};
 if(safe(bounds))return {...common,kind:type,point:q,bounds};
 // Do not send a player to the screen edge for a landing next to their feet.
 // A nearby captain can cover this passive glyph before the Board button
 // enters range; retain the real ladder instead of creating a false edge cue.
 if(q.x>=6&&q.y>=6&&q.x<=f.width-6&&q.y<=f.height-6&&!hud.some(b=>overlap(bounds,b,6))&&overlap(bounds,actor,4))return hidden('near-captain');
 // Keep the small directional glyph outside every painted HUD rectangle.
 // Prefer the nearest physical screen edge, then the camera's clear region.
 const candidates=[],box=(x,y)=>({x:x-23,y:y-23,w:46,h:54});
 const add=(x,y,edge)=>{const bounds=box(x,y);if(safe(bounds))candidates.push({x,y,edge,bounds,score:(x-q.x)**2+(y-q.y)**2});};
 const border=(left,top,right,bottom,prefix)=>{if(right<left||bottom<top)return;for(let x=left;x<=right;x+=4){add(x,top,prefix+'-top');add(x,bottom,prefix+'-bottom');}for(let y=top;y<=bottom;y+=4){add(left,y,prefix+'-left');add(right,y,prefix+'-right');}};
 border(29,29,f.width-29,f.height-37,'screen');
 if(f.viewport){const v=f.viewport;border(v.x+25,v.y+25,v.x+v.w-25,v.y+v.h-33,'clear');}
 candidates.sort((a,b)=>a.score-b.score);
 // Crossing a joystick corner must not jump the same arrow between two
 // equally clear pockets. Retain its safe edge while the landing stays on
 // that side. The normal world marker takes over when its true point clears.
 const edge=previous?.kind==='edge'&&previous.targetId===b.id?previous.edge:null;
 const compatible=edge?.endsWith('left')?q.x<=f.width/2:edge?.endsWith('right')?q.x>=f.width/2:edge?.endsWith('top')?q.y<=f.height/2:edge?.endsWith('bottom')?q.y>=f.height/2:false;
 const p=(compatible&&candidates.find(p=>p.edge===edge))||candidates[0];
 if(!p)return hidden('no-clear-space');
 return {...common,kind:'edge',edge:p.edge,point:{x:p.x,y:p.y},bounds:p.bounds,angle:Math.atan2(q.y-p.y,q.x-p.x),targetOffscreen:q.x<0||q.y<0||q.x>f.width||q.y>f.height};
}
function ink(c,path,width=1.6){c.beginPath();path();c.strokeStyle='#07151ce8';c.lineWidth=width+3;c.stroke();c.strokeStyle='#d9e9d9';c.lineWidth=width;c.stroke();}
function ladder(c,x,y){ink(c,()=>{c.moveTo(x-5,y-7);c.lineTo(x-5,y+7);c.moveTo(x+5,y-7);c.lineTo(x+5,y+7);for(const dy of [-4,0,4]){c.moveTo(x-5,y+dy);c.lineTo(x+5,y+dy);}});}
const previousCues=new WeakMap();
export function drawReturnLanding(c,s,f,boatBounds=null){
 const cue=returnLandingCue(s,f,boatBounds,previousCues.get(s));
 if(cue.kind==='hidden'){previousCues.delete(s);return cue;}previousCues.set(s,cue);
 c.save();c.lineCap='round';c.lineJoin='round';const p=cue.point;
 if(cue.kind==='edge'){
  ladder(c,p.x,p.y-2);const a=cue.angle,x=p.x+Math.cos(a)*18,y=p.y+Math.sin(a)*18;
  ink(c,()=>{c.moveTo(x-Math.cos(a)*4+Math.sin(a)*3,y-Math.sin(a)*4-Math.cos(a)*3);c.lineTo(x,y);c.lineTo(x-Math.cos(a)*4-Math.sin(a)*3,y-Math.sin(a)*4+Math.cos(a)*3);},1.8);
  c.font='600 11px Pretendard, sans-serif';c.textAlign='center';c.textBaseline='alphabetic';c.lineWidth=3;c.strokeStyle='#07151ce8';c.strokeText(cue.metres+'m',p.x,p.y+25);c.fillStyle='#d9e9d9';c.fillText(cue.metres+'m',p.x,p.y+25);
 }else{
  ink(c,()=>{c.ellipse(p.x,p.y,8,2.5,.198,Math.PI*.12,Math.PI*.88);c.moveTo(p.x-8,p.y-1);c.lineTo(p.x-8,p.y+2);c.moveTo(p.x+8,p.y+1);c.lineTo(p.x+8,p.y+4);},1.4);
  if(cue.kind==='landing'){ladder(c,p.x,p.y-21);ink(c,()=>{c.moveTo(p.x-3,p.y-10);c.lineTo(p.x,p.y-7);c.lineTo(p.x+3,p.y-10);},1.4);}
 }
 c.restore();return cue;
}
