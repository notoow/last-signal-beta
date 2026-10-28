import {rogueSupplyActions} from './rogue-context.js';
import {visibleAt} from './rogue-vision.js';
import {edgeMarker} from './rogue-camera.js';
import {unproject} from './world-projection.js';

// Staging only. The bow is the painted connection anchor; never write it to physics.
export const CUE_FONT='600 11px Pretendard, sans-serif';
export const CUE_STROKE=3;
const INSET=26,GAP=8,MARGIN=8;
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const validRect=r=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0;
const overlaps=(a,b,g=0)=>a.x<b.x+b.w+g&&a.x+a.w>b.x-g&&a.y<b.y+b.h+g&&a.y+a.h>b.y-g;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function supplyWorkMeaning(state,language='ko'){
 const t=state?.tow;
 if(state?.mode!=='sailing'||!t||!visibleAt(state,t))return null;
 const context=rogueSupplyActions(state);
 if(!context)return null;
 const tow=context.actions.find(a=>a.id==='tow'),anchor=context.actions.find(a=>a.id==='cargoAnchor');
 if(!t.connected)return tow?.enabled?{kind:'connect',text:language==='en'?'Tow point':'연결고리',action:'tow'}:null;
 if(t.anchor&&anchor?.enabled)return {kind:'raise-anchor',text:language==='en'?anchor.labelEn:anchor.labelKo,action:'cargoAnchor'};
 // A connection is a fact, not an instruction to release the line or lower anchor.
 return tow?.enabled?{kind:'connected',text:language==='en'?'Line attached':'줄 연결됨',action:'tow'}:null;
}

// Bounds are relative to the left/alphabetic baseline. Advance width alone
// misses glyph overhangs and descenders. Round the stroke extent out to raster
// cells, then reserve one cell for a fractional baseline and antialiasing.
// Keep that cell at least one CSS pixel when the backing scale is higher.
export function measureSupplyWorkLabel(metrics,pixelRatio=1){
 const {width,actualBoundingBoxLeft:left,actualBoundingBoxRight:right,actualBoundingBoxAscent:ascent,actualBoundingBoxDescent:descent}=metrics;
 if(![width,left,right,ascent,descent,pixelRatio].every(Number.isFinite)||width<=0||pixelRatio<=0)return null;
 const cell=Math.max(1,1/pixelRatio),radius=CUE_STROKE/2;
 const lower=v=>Math.floor(v/cell)*cell-cell,upper=v=>Math.ceil(v/cell)*cell+cell;
 const x=Math.min(-2,lower(-left-radius)),y=Math.min(-13,lower(-ascent-radius));
 const r=Math.max(width+2,upper(right+radius)),b=Math.max(4,upper(descent+radius));
 return {x,y,w:r-x,h:b-y};
}

function shape(side,point,textWidth,textBounds){
 const {x,y}=point;let label;
 if(side==='left')label={x:x+13,y:y+4};
 else if(side==='right')label={x:x-13-textWidth,y:y+4};
 else label={x:x-textWidth/2,y:y+(side==='top'?25:-15)};
 // Include glyph outline and triangle in the same collision envelope.
 const labelBounds={x:label.x+textBounds.x,y:label.y+textBounds.y,w:textBounds.w,h:textBounds.h};
 const l=Math.min(x-7,labelBounds.x),t=Math.min(y-7,labelBounds.y);
 const r=Math.max(x+7,labelBounds.x+labelBounds.w),b=Math.max(y+7,labelBounds.y+labelBounds.h);
 return {marker:{x,y},label,labelBounds,bounds:{x:l,y:t,w:r-l,h:b-t},side};
}

// Pure screen-space placement. A test measurement is not a rendered font receipt.
export function layoutSupplyWorkCue({frame,target,text,textWidth,textBounds,actorBounds=null,supplyBounds=null,reserved=[],previous=null}){
 const {width:w,height:h}=frame;
 if(!validPoint(target)||!validRect(textBounds)||![w,h,textWidth].every(Number.isFinite)||w<=INSET*2||h<=INSET*2||textWidth<=0||textBounds.w>w-2*MARGIN)return {reason:'invalid-geometry'};
 const hud=[...(frame.occupied||[]),...reserved].filter(validRect);
 const covers=[...hud,...(validRect(actorBounds)?[actorBounds]:[])];
 const targetBox={x:target.x-14,y:target.y-14,w:28,h:28};
 if(targetBox.x>=MARGIN&&targetBox.y>=MARGIN&&targetBox.x+28<=w-MARGIN&&targetBox.y+28<=h-MARGIN&&!covers.some(b=>overlaps(targetBox,b,GAP)))return {reason:'target-visible'};
 const blocks=[...covers,...(validRect(supplyBounds)?[supplyBounds]:[])];
 const cx=w/2,cy=h/2,dx=target.x-cx,dy=target.y-cy;
 const offscreen=target.x<0||target.y<0||target.x>w||target.y>h;
 let ideal;
 if(offscreen){
  const k=Math.min(dx>0?(w-INSET-cx)/dx:dx<0?(INSET-cx)/dx:Infinity,dy>0?(h-INSET-cy)/dy:dy<0?(INSET-cy)/dy:Infinity);
  ideal={x:cx+dx*k,y:cy+dy*k};
 }else ideal={x:clamp(target.x,INSET,w-INSET),y:clamp(target.y,INSET,h-INSET)};
 const distances=[['left',Math.abs(ideal.x-INSET)],['right',Math.abs(ideal.x-(w-INSET))],['top',Math.abs(ideal.y-INSET)],['bottom',Math.abs(ideal.y-(h-INSET))]];
 const preferredSide=distances.sort((a,b)=>a[1]-b[1])[0][0];
 const adjacent={left:['top','bottom'],right:['top','bottom'],top:['left','right'],bottom:['left','right']};
 const sides=[preferredSide,...adjacent[preferredSide]];
 const original=edgeMarker(frame,unproject(frame,target),INSET);
 const clear=q=>q.bounds.x>=MARGIN&&q.bounds.y>=MARGIN&&q.bounds.x+q.bounds.w<=w-MARGIN&&q.bounds.y+q.bounds.h<=h-MARGIN&&!blocks.some(b=>overlaps(q.bounds,b,GAP));
 const score=q=>Math.hypot(q.marker.x-ideal.x,q.marker.y-ideal.y)+(q.side===preferredSide?0:24);
 const options=[];
 for(const side of sides){
  const vertical=side==='left'||side==='right';
  const fixed=side==='left'||side==='top'?INSET:vertical?w-INSET:h-INSET;
  const point=t=>vertical?{x:fixed,y:t}:{x:t,y:fixed};
  const rel=shape(side,{x:0,y:0},textWidth,textBounds).bounds;
  const start=vertical?rel.y:rel.x,length=vertical?rel.h:rel.w,limit=vertical?h:w;
  const lo=MARGIN-start,hi=limit-MARGIN-start-length;
  if(lo>hi)continue;
  const desired=clamp(vertical?ideal.y:ideal.x,lo,hi),candidates=[desired,lo,hi];
  if(original&&Math.abs((vertical?original.x:original.y)-fixed)<.1)candidates.push(vertical?original.y:original.x);
  for(const b of blocks){const a=vertical?b.y:b.x,n=vertical?b.h:b.w;candidates.push(a-GAP-start-length,a+n+GAP-start);}
  if(previous?.side===side&&validPoint(previous.marker))candidates.push(vertical?previous.marker.y:previous.marker.x);
  for(const t of new Set(candidates)){
   if(t<lo||t>hi)continue;
   const candidate=shape(side,point(t),textWidth,textBounds);
   if(clear(candidate))options.push({...candidate,cost:score(candidate)});
  }
 }
 options.sort((a,b)=>a.cost-b.cost);
 if(!options.length)return {reason:'no-clear-space',preferredSide,searchedSides:sides,target:{...target}};
 let chosen=options[0];
 // Retain a valid adjacent pocket across a corner; never interpolate across HUD.
 if(sides.includes(previous?.side)&&validPoint(previous.marker)){
  const side=previous.side,vertical=side==='left'||side==='right';
  const fixed=side==='left'||side==='top'?INSET:vertical?w-INSET:h-INSET;
  const old=shape(side,vertical?{x:fixed,y:previous.marker.y}:{x:previous.marker.x,y:fixed},textWidth,textBounds);
  if(clear(old)&&score(old)<=chosen.cost+40)chosen={...old,cost:score(old)};
 }
 return {...chosen,text,target:{...target},marker:{...chosen.marker,angle:Math.atan2(target.y-chosen.marker.y,target.x-chosen.marker.x)},reason:'edge-cue',preferredSide,adjacentEdge:chosen.side!==preferredSide,searchedSides:sides};
}

const history=new WeakMap();
export function drawSupplyWorkCue(c,state,frame,vessels,language='ko',{reserved=[],suppressed=false}={}){
 const owner=c.canvas||c;
 if(suppressed||frame.overview){history.delete(owner);return null;}
 const meaning=supplyWorkMeaning(state,language),tow=vessels?.tow;
 if(!meaning||!validPoint(tow?.bow)){history.delete(owner);return null;}
 const old=history.get(owner),previous=old?.map===state.map&&old?.tow===state.tow?old.layout:null;
 c.save();c.font=CUE_FONT;c.textAlign='left';c.textBaseline='alphabetic';
 const metrics=c.measureText(meaning.text),textWidth=metrics.width,transform=c.getTransform();
 const pixelRatio=Math.min(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
 const textBounds=measureSupplyWorkLabel(metrics,pixelRatio);
 const layout=layoutSupplyWorkCue({frame,target:tow.bow,text:meaning.text,textWidth,textBounds,actorBounds:vessels.boat?.paintedBounds||vessels.boat?.bounds,supplyBounds:tow.visibleBounds,reserved,previous});
 if(layout.reason==='edge-cue'){
  const m=layout.marker;c.save();c.translate(m.x,m.y);c.rotate(m.angle);c.beginPath();c.moveTo(6,0);c.lineTo(-4,-4);c.lineTo(-4,4);c.closePath();c.fillStyle='#c8ddd1';c.fill();c.restore();
  c.lineWidth=CUE_STROKE;c.lineJoin='round';c.strokeStyle='#07191f';c.strokeText(meaning.text,layout.label.x,layout.label.y);c.fillStyle='#eee3c4';c.fillText(meaning.text,layout.label.x,layout.label.y);
  history.set(owner,{map:state.map,tow:state.tow,layout});
 }else history.delete(owner);
 c.restore();
 return {...layout,meaning,textWidth,textBounds,pixelRatio,eligible:true};
}
