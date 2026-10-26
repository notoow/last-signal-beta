import {sightLine} from './shore-encounters.js';
import {daylight} from './voyage-daylight.js';
export const SURVEY_CELL=80,SURVEY_COLS=43,SURVEY_ROWS=23;
const legacyGrid=Object.freeze({cell:SURVEY_CELL,cols:SURVEY_COLS,rows:SURVEY_ROWS});
export const surveyGrid=map=>map?.cliffs?{cell:40,cols:map.cols,rows:map.rows}:legacyGrid;
const views=new WeakMap();
export function surveyedAt(s,p){
  if(!s.survey)return true;
  const {cell,cols,rows}=surveyGrid(s.map);
  if(s.map?.cliffs&&s.survey.length!==cols*rows)return false;
  const x=Math.floor(p.x/cell),y=Math.floor(p.y/cell);
  return x>=0&&y>=0&&x<cols&&y<rows&&s.survey[y*cols+x]===1;
}
const reusable=(s,last,p)=>last&&last.map===s.map&&last.cliffs===s.map.cliffs&&last.survey===s.survey&&s.time-last.time>=0&&s.time-last.time<.2&&last.mode===s.mode&&Math.abs(last.radius-sightRadius(s))<1&&Math.hypot(last.x-p.x,last.y-p.y)<12;
export const sightRadius=s=>(s.generator===12&&s.depth===0?(s.person?120:s.boss.active?760:280):(s.person?250:s.boss.active?760:520))*(s.daylight?daylight(s).sight:1);
export function visibleAt(s,p){
  if(!s.survey)return true;
  const origin=s.person||s.boat;
  return Math.hypot(origin.x-p.x,origin.y-p.y)<=sightRadius(s)&&sightLine(s.map,origin,p,{revealTerrainFace:true});
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
  if(s.map.cliffs&&s.survey.length!==cols*rows)s.survey=newSurvey(s.map);
  const p=s.person||s.boat,last=views.get(s);
  if(reusable(s,last,p))return;
  const visible=new Set();
  for(const [k,value] of visibleSurvey(s).entries())if(value){visible.add(k);s.survey[k]=1;}
  views.set(s,{map:s.map,cliffs:s.map.cliffs,survey:s.survey,x:p.x,y:p.y,mode:s.mode,time:s.time,radius:sightRadius(s),visible,mask:null});
}
export function drawSurvey(c,s){
  if(!s.survey)return;
  const {cell,cols,rows}=surveyGrid(s.map),old=views.get(s),origin=s.person||s.boat;
  const remembered=s.survey.length===cols*rows?s.survey:null;
  const view=reusable(s,old,origin)?old:{visible:new Set(visibleSurvey(s).flatMap((v,i)=>v?[i]:[])),mask:null};
  if(!view.mask){
    view.mask=document.createElement('canvas');view.mask.width=cols;view.mask.height=rows;
    const m=view.mask.getContext('2d');m.fillStyle='#000';
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const k=y*cols+x;if(view.visible.has(k))continue;
      m.globalAlpha=remembered?.[k]?.7:1;m.fillRect(x,y,1,1);
    }
  }
  c.save();c.imageSmoothingEnabled=!s.map.cliffs;c.drawImage(view.mask,0,0,cols*cell,rows*cell);c.restore();
}
export function validSurvey(v,map){const {cols,rows}=surveyGrid(map);return v===null||Array.isArray(v)&&v.length===cols*rows&&v.every(x=>x===0||x===1);}
