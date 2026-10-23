import {readSaveBundle} from './rescue-core.js';
import {getTowMission} from './tow-missions.js';
export const SAVE_KEY='lastsignal.v2';
export const LEGACY_SAVE_KEY='lastsignal.v1';
// An older executable must never overwrite a parseable save from a later schema/content build.
function unsupported(raw){
 try{const d=JSON.parse(raw);if(!d||typeof d!=='object')return false;if(d.version>1||d.campaign?.version>5)return true;
  if([3,4,5].includes(d.campaign?.version)&&d.campaign.progress&&Object.keys(d.campaign.progress).some(id=>!getTowMission(id)))return true;
  if(d.run){const s=typeof d.run==='string'?JSON.parse(d.run):d.run;if(s.kind==='tow'&&(s.version>11||s.missionId&&!getTowMission(s.missionId)||getTowMission(s.missionId)&&s.missionRevision>getTowMission(s.missionId).revision))return true;}
 }catch{}return false;
}
export function loadSaveStore(storage){
 const entries=[SAVE_KEY,SAVE_KEY+'.backup',LEGACY_SAVE_KEY,LEGACY_SAVE_KEY+'.backup'].map(key=>({key,raw:storage.getItem(key)}));
 const readOnly=entries.some(e=>e.key.startsWith(SAVE_KEY)&&unsupported(e.raw));
 for(const e of entries){const data=readSaveBundle(e.raw);if(data)return {data,source:e.key,recovered:e.key.endsWith('.backup'),corrupt:!!data.rejectedRun,readOnly};}
 return {data:null,source:null,recovered:false,corrupt:entries.some(e=>!!e.raw),readOnly};
}
export function writeSaveStore(storage,data){
 if([SAVE_KEY,SAVE_KEY+'.backup'].some(key=>unsupported(storage.getItem(key))))throw new Error('SAVE_NEWER_VERSION');
 const previous=storage.getItem(SAVE_KEY);
 if(previous){try{const prior=readSaveBundle(previous);if(prior&&!prior.rejectedRun)storage.setItem(SAVE_KEY+'.backup',previous);}catch{}}
 storage.setItem(SAVE_KEY,JSON.stringify(data));
}
