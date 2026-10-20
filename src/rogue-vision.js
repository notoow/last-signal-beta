import {sightLine} from './shore-encounters.js';
export const SURVEY_CELL=80,SURVEY_COLS=43,SURVEY_ROWS=23;
const views=new WeakMap();
export const sightRadius=s=>s.person?250:s.boss.active?760:520;
export function visibleAt(s,p){
  if(!s.survey)return true;
  const origin=s.person||s.boat;
  return Math.hypot(origin.x-p.x,origin.y-p.y)<=sightRadius(s)&&sightLine(s.map,origin,p);
}
export function newSurvey(){return Array(SURVEY_COLS*SURVEY_ROWS).fill(0);}
export function updateSurvey(s){
  if(!s.survey)return;
  const p=s.person||s.boat,last=views.get(s);
  if(last&&s.time-last.time<.2&&last.mode===s.mode&&Math.hypot(last.x-p.x,last.y-p.y)<12)return;
  const visible=new Set(),r=sightRadius(s);
  for(let y=Math.max(0,Math.floor((p.y-r)/80));y<Math.min(SURVEY_ROWS,Math.ceil((p.y+r)/80));y++)
    for(let x=Math.max(0,Math.floor((p.x-r)/80));x<Math.min(SURVEY_COLS,Math.ceil((p.x+r)/80));x++){
      const k=y*SURVEY_COLS+x;
      if(visibleAt(s,{x:x*80+40,y:y*80+40})){visible.add(k);s.survey[k]=1;}
    }
  const own=Math.floor(p.y/80)*SURVEY_COLS+Math.floor(p.x/80);visible.add(own);s.survey[own]=1;
  views.set(s,{x:p.x,y:p.y,mode:s.mode,time:s.time,visible,mask:null});
}
export function drawSurvey(c,s){
  if(!s.survey)return;
  updateSurvey(s);
  const view=views.get(s),visible=view.visible;
  // Remember only static terrain. Moving actors are separately visibility-culled.
  if(!view.mask){
    view.mask=document.createElement('canvas');view.mask.width=SURVEY_COLS;view.mask.height=SURVEY_ROWS;
    const m=view.mask.getContext('2d');m.fillStyle='#07181e';
    for(let y=0;y<SURVEY_ROWS;y++)for(let x=0;x<SURVEY_COLS;x++){
      const k=y*SURVEY_COLS+x;if(visible.has(k))continue;
      m.globalAlpha=s.survey[k]?.65:.995;m.fillRect(x,y,1,1);
    }
  }
  c.save();c.imageSmoothingEnabled=true;c.drawImage(view.mask,0,0,SURVEY_COLS*80,SURVEY_ROWS*80);
  c.restore();
}
export function validSurvey(v){return v===null||Array.isArray(v)&&v.length===SURVEY_COLS*SURVEY_ROWS&&v.every(x=>x===0||x===1);}
