import {PAINTS} from './voyage.js';
import {TOW_MISSION_IDS,DEFAULT_TOW_MISSION,getTowMission} from './tow-missions.js';
export const CREW_IDS=Object.freeze(['engineer','operator']);
const integer=(v,max=1000000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const finite=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
export const MASTERY_IDS=Object.freeze(['powered','manual','clean','temporary-mooring','reversed-flow']);
export function masteryGoals(id){return ['powered','manual','clean',...(id!=='bus07'?['temporary-mooring']:[]),...(id==='sluice'?['reversed-flow']:[])];}
function restoredMastery(p,id){const r=result(p.lastResult);return masteryGoals(id).filter(key=>(p.mastery||[]).includes(key)||(p.completions>0&&(key==='clean'?p.bestCleanTime!==null:r&&(key===(r.power?'powered':'manual')||r.tags.includes(key)))));}
const emptyRecord=()=>({attempts:0,completions:0,lastResolvedAttempt:0,lastResult:null,bestCleanTime:null,heard:false,mastery:[]});
const result=r=>r&&typeof r==='object'&&finite(r.time,36000)&&finite(r.damage,1000)?{power:r.power===true,time:r.time,damage:r.damage,collisions:integer(r.collisions)?r.collisions:0,route:['inner','outer','unselected'].includes(r.route)?r.route:'unselected',tags:Array.isArray(r.tags)?[...new Set(r.tags.filter(v=>['inner','outer','powered','manual','temporary-mooring','reversed-flow'].includes(v)))]:[]}:null;
function aliases(c){c.busRescued=c.progress.bus07.completions>0;c.busResult=c.progress.bus07.lastResult?{power:c.progress.bus07.lastResult.power,time:c.progress.bus07.lastResult.time,damage:c.progress.bus07.lastResult.damage}:null;return c;}
export function freshCampaign(){return aliases({version:5,paint:'harbor',crew:[],blackbox:false,missions:0,bestRescued:0,lastOutcome:null,nextAttemptId:1,selectedMissionId:DEFAULT_TOW_MISSION,progress:Object.fromEntries(TOW_MISSION_IDS.map(id=>[id,emptyRecord()]))});}
export function parseCampaign(raw){
 try{
  const old=typeof raw==='string'?JSON.parse(raw):raw;if(!old||![1,2,3,4,5].includes(old.version)||!Array.isArray(old.crew))return null;
  const c=freshCampaign();if(old.version>=5){if(!Object.hasOwn(PAINTS,old.paint))return null;c.paint=old.paint;}c.crew=CREW_IDS.filter(id=>old.crew.includes(id));c.blackbox=old.blackbox===true;c.missions=integer(old.missions)?old.missions:0;c.bestRescued=finite(old.bestRescued,2)?old.bestRescued:0;
  if(old.lastOutcome&&typeof old.lastOutcome==='object')c.lastOutcome={rescued:CREW_IDS.filter(id=>old.lastOutcome.rescued?.includes?.(id)),blackbox:old.lastOutcome.blackbox===true,reason:['returned','disabled','tide'].includes(old.lastOutcome.reason)?old.lastOutcome.reason:'returned'};
  if(old.version<3){
   if(old.busRescued===true){const p=c.progress.bus07;p.attempts=1;p.completions=1;p.lastResult=old.busResult?result({...old.busResult,time:Number(old.busResult.time)||0,damage:Number(old.busResult.damage)||0}):null;p.bestCleanTime=p.lastResult?.damage===0?p.lastResult.time:null;p.heard=true;p.mastery=restoredMastery(p,'bus07');}
   return aliases(c);
  }
  if(!integer(old.nextAttemptId,Number.MAX_SAFE_INTEGER-1)||old.nextAttemptId<1||!getTowMission(old.selectedMissionId)||!old.progress||Array.isArray(old.progress)||typeof old.progress!=='object'||Object.keys(old.progress).some(id=>!getTowMission(id)))return null;
  c.nextAttemptId=old.nextAttemptId;c.selectedMissionId=old.selectedMissionId;
  for(const id of TOW_MISSION_IDS){
   const p=old.progress[id];if(p===undefined)continue;
   if(!p||(p.mastery!==undefined&&(!Array.isArray(p.mastery)||p.mastery.some(k=>!masteryGoals(id).includes(k))||(p.mastery.length>0&&p.completions===0)))||!integer(p.attempts)||!integer(p.completions)||p.completions>p.attempts||!integer(p.lastResolvedAttempt,Number.MAX_SAFE_INTEGER-1)||p.lastResolvedAttempt>=c.nextAttemptId||typeof p.heard!=='boolean'||p.bestCleanTime!==null&&!finite(p.bestCleanTime,36000)||p.lastResult!==null&&!result(p.lastResult))return null;
   c.progress[id]={attempts:p.attempts,completions:p.completions,lastResolvedAttempt:p.lastResolvedAttempt,lastResult:result(p.lastResult),bestCleanTime:p.bestCleanTime,heard:p.heard,mastery:restoredMastery(p,id)};
  }
  return aliases(c);
 }catch{return null;}
}
export function readCampaign(raw){return parseCampaign(raw)||freshCampaign();}
export function availableTowMissions(c){return TOW_MISSION_IDS.filter(id=>(getTowMission(id).requires||[]).every(key=>c.progress[key]?.completions>0));}
export function campaignComplete(c){return TOW_MISSION_IDS.every(id=>c.progress[id]?.completions>0);}
export function reserveTowAttempt(campaign,id=DEFAULT_TOW_MISSION){
 const c=parseCampaign(campaign);if(!c||!getTowMission(id)||!availableTowMissions(c).includes(id)||!c.crew.length)throw new RangeError('Mission is not available');
 const attemptId=c.nextAttemptId++;c.selectedMissionId=id;c.progress[id].attempts++;return {campaign:c,attemptId};
}
export function recordTowResult(s,campaign){
 const c=readCampaign(campaign),id=s.missionId??DEFAULT_TOW_MISSION,p=c.progress[id];if(!p||!['won','lost'].includes(s.status))return c;
 // Real runs reserve a persistent sequence at launch. Legacy standalone callers use a fresh sequence.
 const attempt=s.attemptId||c.nextAttemptId;if(attempt<=p.lastResolvedAttempt||s.attemptId&&attempt>=c.nextAttemptId)return c;
 if(attempt>=c.nextAttemptId){c.nextAttemptId=attempt+1;p.attempts++;}p.lastResolvedAttempt=attempt;c.missions++;
 if(s.status==='won'){
  const r=result({power:s.power,time:s.time,damage:s.metrics.damage,collisions:s.metrics.collisions,route:s.route,tags:[s.power?'powered':'manual',...(['inner','outer'].includes(s.route)?[s.route]:[]),...(s.metrics.temporaryMoorings?['temporary-mooring']:[]),...(s.pumpDirection===-1?['reversed-flow']:[])]});
  if(!r)return readCampaign(campaign);p.completions++;p.lastResult=r;p.heard=true;
  if(r.damage===0&&r.collisions===0)p.bestCleanTime=p.bestCleanTime===null?r.time:Math.min(p.bestCleanTime,r.time);
  p.mastery=restoredMastery(p,id);
 }
 return aliases(c);
}
