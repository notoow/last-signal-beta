import {sightLine} from './shore-encounters.js';
import {daylight} from './voyage-daylight.js';
export const SURVEY_CELL=80,SURVEY_COLS=43,SURVEY_ROWS=23;
const legacyGrid=Object.freeze({cell:SURVEY_CELL,cols:SURVEY_COLS,rows:SURVEY_ROWS});
export const surveyGrid=map=>map?.cliffs?{cell:40,cols:map.cols,rows:map.rows}:legacyGrid;
const views=new WeakMap();
const fineViews=new WeakMap();
const fogViews=new WeakMap();
const legacyFogViews=new WeakMap();
export function fogState(s){
  const grid=surveyGrid(s.map),fine=fineSight(s);
  if(!fine){
    const p=s.person||s.boat,old=legacyFogViews.get(s);if(reusable(s,old,p))return old.result;
    const visible=visibleSurvey(s),result={...grid,alpha:Uint8Array.from({length:grid.cols*grid.rows},(_,i)=>!s.survey||visible?.[i]?0:s.survey[i]?179:255)};
    legacyFogViews.set(s,{map:s.map,cliffs:s.map.cliffs,survey:s.survey,x:p.x,y:p.y,mode:s.mode,time:s.time,radius:sightRadius(s),result});return result;
  }
  const old=fogViews.get(s),memory=s.fineSurvey?.cols===grid.cols&&s.fineSurvey?.rows===grid.rows?s.fineSurvey:null;
  if(old?.sight===fine&&old.memory===memory)return old.result;
  const cols=grid.cols*4,rows=grid.rows*4,alpha=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const i=Math.floor(y/4)*grid.cols+Math.floor(x/4),bit=1<<((y%4)*4+x%4);
    alpha[y*cols+x]=fine[i]&bit?0:(memory?.bits[i]??(s.survey.length===grid.cols*grid.rows&&s.survey[i]?65535:0))&bit?179:255;
  }
  const result={cols,rows,cell:grid.cell/4,alpha};fogViews.set(s,{sight:fine,memory,result});return result;
}
export function newFineSurvey(map,survey){
  if(!map?.cliffs||!survey)return null;
  const {cols,rows}=surveyGrid(map);
  return {version:1,cols,rows,bits:Array.from({length:cols*rows},(_,i)=>survey[i]===1?65535:0)};
}
export function validFineSurvey(memory,map,survey){
  if(!map?.cliffs||!survey)return memory===null;
  const {cols,rows}=surveyGrid(map);
  return memory?.version===1&&memory.cols===cols&&memory.rows===rows&&Array.isArray(memory.bits)&&memory.bits.length===cols*rows&&memory.bits.every(v=>Number.isInteger(v)&&v>=0&&v<=65535);
}
// A cell retains sixteen independently observed pieces. Charts and objective
// pins continue to use the coarse survey; drawing cannot grant discoveries.
export function fineSight(s){
  if(!s.map?.cliffs||!s.survey)return null;
  const p=s.person||s.boat,last=fineViews.get(s);
  if(reusable(s,last,p))return last.bits;
  const {cell,cols,rows}=surveyGrid(s.map),coarse=visibleSurvey(s),bits=new Uint16Array(cols*rows),radius=sightRadius(s);
  for(let y=Math.max(0,Math.floor((p.y-radius-cell)/cell));y<Math.min(rows,Math.ceil((p.y+radius+cell)/cell));y++)
    for(let x=Math.max(0,Math.floor((p.x-radius-cell)/cell));x<Math.min(cols,Math.ceil((p.x+radius+cell)/cell));x++){
      const i=y*cols+x;
      let boundary=false,interior=!!coarse[i];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const seen=x+dx>=0&&x+dx<cols&&y+dy>=0&&y+dy<rows&&coarse[(y+dy)*cols+x+dx];
        if(seen)boundary=true;else interior=false;
      }
      if(interior){bits[i]=65535;continue;}
      if(!boundary)continue;
      for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++)if(visibleAt(s,{x:(x+(sx+.5)/4)*cell,y:(y+(sy+.5)/4)*cell}))bits[i]|=1<<(sy*4+sx);
    }
  fineViews.set(s,{map:s.map,cliffs:s.map.cliffs,survey:s.survey,x:p.x,y:p.y,mode:s.mode,time:s.time,radius,bits});
  return bits;
}
export function surveyedAt(s,p){
  if(!s.survey)return true;
  const {cell,cols,rows}=surveyGrid(s.map);
  if(s.map?.cliffs&&s.survey.length!==cols*rows)return false;
  const x=Math.floor(p.x/cell),y=Math.floor(p.y/cell);
  return x>=0&&y>=0&&x<cols&&y<rows&&s.survey[y*cols+x]===1;
}
const reusable=(s,last,p)=>last&&last.map===s.map&&last.cliffs===s.map.cliffs&&last.survey===s.survey&&s.time-last.time>=0&&s.time-last.time<.2&&last.mode===s.mode&&Math.abs(last.radius-sightRadius(s))<1&&Math.hypot(last.x-p.x,last.y-p.y)<12;
export const sightRadius=s=>(s.generator===12&&s.depth===0?(s.person?180:s.boss.active?760:280):(s.person?250:s.boss.active?760:520))*(s.daylight?daylight(s).sight:1);
export function visibleAt(s,p){
  if(!s.survey)return true;
  const origin=s.person||s.boat;
  return Math.hypot(origin.x-p.x,origin.y-p.y)<=sightRadius(s)&&sightLine(s.map,origin,p,{revealTerrainFace:true,visionOnly:true});
}
export function newSurvey(map){const {cols,rows}=surveyGrid(map);return Array(cols*rows).fill(0);}
// Read-only current sight for charts. Never commit exploration while rendering.
export function visibleSurvey(s){
  if(!s.survey)return null;
  const p=s.person||s.boat,last=views.get(s),{cell,cols,rows}=surveyGrid(s.map);
  if(reusable(s,last,p))return s.survey.map((_,k)=>last.visible.has(k)?1:0);
  const mask=newSurvey(s.map),r=sightRadius(s);
  for(let y=Math.max(0,Math.floor((p.y-r)/cell));y<Math.min(rows,Math.ceil((p.y+r)/cell));y++)
    for(let x=Math.max(0,Math.floor((p.x-r)/cell));x<Math.min(cols,Math.ceil((p.x+r)/cell));x++)
      if(visibleAt(s,{x:(x+.5)*cell,y:(y+.5)*cell}))mask[y*cols+x]=1;
  const x=Math.floor(p.x/cell),y=Math.floor(p.y/cell);
  if(x>=0&&y>=0&&x<cols&&y<rows)mask[y*cols+x]=1;return mask;
}
export function updateSurvey(s){
  if(!s.survey)return;
  const {cols,rows}=surveyGrid(s.map);
  // An explicitly replaced terrain profile cannot reinterpret coarse old bits
  // as fine-grid discoveries. Generated maps initialize with their own grid.
  if(s.map.cliffs&&s.survey.length!==cols*rows){s.survey=newSurvey(s.map);s.fineSurvey=newFineSurvey(s.map,s.survey);}
  const p=s.person||s.boat,last=views.get(s);
  if(reusable(s,last,p))return;
  if(s.map.cliffs){
    if(!validFineSurvey(s.fineSurvey,s.map,s.survey))s.fineSurvey=newFineSurvey(s.map,s.survey);
    const sight=fineSight(s);
    for(let i=0;i<sight.length;i++)s.fineSurvey.bits[i]|=sight[i];
  }
  const visible=new Set();
  for(const [k,value] of visibleSurvey(s).entries())if(value){visible.add(k);s.survey[k]=1;}
  views.set(s,{map:s.map,cliffs:s.map.cliffs,survey:s.survey,x:p.x,y:p.y,mode:s.mode,time:s.time,radius:sightRadius(s),visible,mask:null});
}
const fogCanvases=new WeakMap();
// Keep the interpolation band inside discovered space. Every unknown texel's
// neighbours are opaque too, so smoothing cannot expose unseen terrain.
export function fogRenderAlpha({cols,rows,alpha}){
  const result=new Uint8Array(alpha.length);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    let value=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=Math.max(0,Math.min(cols-1,x+dx)),ny=Math.max(0,Math.min(rows-1,y+dy));
      value=Math.max(value,alpha[ny*cols+nx]);
    }
    result[y*cols+x]=value;
  }
  return result;
}
export function drawSurvey(c,s){
  if(!s.survey)return;
  const {cols,rows,cell,alpha}=fogState(s);
  let mask=fogCanvases.get(alpha);
  if(!mask){
    mask=document.createElement('canvas');mask.width=cols;mask.height=rows;
    const m=mask.getContext('2d'),pixels=m.createImageData(cols,rows);
    const shaded=fogRenderAlpha({cols,rows,alpha});
    for(let i=0;i<alpha.length;i++){pixels.data[i*4]=7;pixels.data[i*4+1]=20;pixels.data[i*4+2]=27;pixels.data[i*4+3]=shaded[i];}
    m.putImageData(pixels,0,0);fogCanvases.set(alpha,mask);
  }
  c.save();c.imageSmoothingEnabled=true;c.drawImage(mask,0,0,cols*cell,rows*cell);c.restore();
}
export function validSurvey(v,map){const {cols,rows}=surveyGrid(map);return v===null||Array.isArray(v)&&v.length===cols*rows&&v.every(x=>x===0||x===1);}
