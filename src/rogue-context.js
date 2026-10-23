import {berthReadiness,shoreSearchStatus,SHORE_RANGE,bossLinkCandidate} from './rogue-core.js';
import {rescueStatus} from './shore-rescue.js';
import {visibleAt,SURVEY_COLS,SURVEY_CELL} from './rogue-vision.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const action=(id,code,labelKo,labelEn,enabled=true,hold=false,progress=0)=>({id,code,labelKo,labelEn,enabled,hold,progress});
// Read-only affordances. Inputs still pass through interact/tickRun; no UI can
// award an item, snap a hull, reveal an enemy, or suppress the attack control.
export function rogueContextActions(s){
  const result={primary:null,secondary:[],attack:null};
  if(!s||s.status!=='playing'||s.pendingGear||s.pendingCache||s.salvage?.pending)return result;
  if(s.person){
    result.attack=action('attack','Space','공격','Attack',true,true);
    const b=s.map.berths.find(b=>b.id===s.mooring),search=shoreSearchStatus(s);
    if(search?.berth){
      result.primary=action('search','KeyF',search.choiceMode?'수색':'보급 회수',search.choiceMode?'Search':'Supplies',!['choice','hit'].includes(search.blocked),true,search.progress/search.required);
      if(!search.choiceMode)result.secondary.push(action('equipment','KeyR','장비 회수','Equipment',result.primary.enabled,true,result.primary.progress));
    }
    if(b&&distance(s.person,b.landing)<SHORE_RANGE.boarding){
      const board=action('board','KeyE','승선','Board');
      if(result.primary)result.secondary.push(board);else result.primary=board;
    }
    const rescue=rescueStatus(s);
    if(!result.primary&&rescue?.near&&!rescue.boarding)result.primary=action('rescue','KeyE',rescue.stage==='following'?'기다려':'따라와',rescue.stage==='following'?'Wait':'Follow');
    return result;
  }
  if(s.mode==='moored'){
    result.primary=action('land','KeyE','하선','Go ashore');
    result.secondary.push(action('unmoor','KeyQ','출항','Cast off'));return result;
  }
  if(s.boss.hook>=0){result.primary=action('unhook','KeyE','줄 풀기','Release line');return result;}
  if(bossLinkCandidate(s)>=0){result.primary=action('link','KeyE',s.depth===2?'중계기 연결':'고리 연결',s.depth===2?'Link relay':'Hook drive');return result;}
  const b=[...s.map.berths,...(s.boss.cleared?[s.map.exit]:[])].filter(b=>visibleAt(s,b)).sort((a,b)=>distance(s.boat,a)-distance(s.boat,b))[0];
  if(b){const ready=berthReadiness(s,b);if(ready.near)result.primary=action('moor','KeyE',b===s.map.exit?'탈출 접안':'접안',b===s.map.exit?'Exit berth':'Moor',ready.ready);}
  return result;
}
export function rogueMinimap(s){
  if(!s)return null;
  const known=p=>!s.survey||s.survey[Math.floor(p.y/SURVEY_CELL)*SURVEY_COLS+Math.floor(p.x/SURVEY_CELL)]===1;
  const player=s.person||s.boat;
  return {width:s.map.width,height:s.map.height,cols:s.map.cols,rows:s.map.rows,tiles:s.map.tiles?.slice()||[],
    survey:s.survey?.slice()||null,surveyCols:SURVEY_COLS,surveyCell:SURVEY_CELL,
    player:{x:player.x,y:player.y,angle:player.angle},boat:{x:s.boat.x,y:s.boat.y},
    berths:s.map.berths.filter(known).map(b=>({x:b.x,y:b.y,claimed:s.claimed.includes(b.id)})),
    enemies:s.combat?.enemies.filter(e=>e.hp>0&&visibleAt(s,e)).map(e=>({x:e.x,y:e.y,kind:e.kind,asleep:!!e.asleep}))||[]};
}
