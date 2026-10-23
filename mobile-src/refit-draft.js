import {equipmentComparison} from './equipment-comparison.js';

export const REFIT_DRAFT_KEY='threadwake.ui.refit-draft.v1';
const identity=s=>[s.voyage.version,s.voyage.seed,s.voyage.leg,s.voyage.equipment.join(',')].join(':');
// A pending choice never grants equipment or supplies. The app commits through
// chooseEquipment only when departure is saved successfully.
export function refitDraft(s,raw={}){
 const replace=s.voyage.equipment.includes(raw.replace)?raw.replace:s.voyage.equipment[0]||null;
 const choice=equipmentComparison(s,raw.choice,replace)?raw.choice:'skip';
 const tab=['requests','equipment','crew'].includes(raw.tab)?raw.tab:s.voyage.version>=3?'requests':'equipment';
 return {choice,replace,tab:s.voyage.version<3&&tab==='requests'?'equipment':tab};
}
export function readRefitDraft(storage,s){
 try{const value=JSON.parse(storage.getItem(REFIT_DRAFT_KEY));return refitDraft(s,value?.identity===identity(s)?value.draft:{});}catch{return refitDraft(s);}
}
export function writeRefitDraft(storage,s,draft){
 try{storage.setItem(REFIT_DRAFT_KEY,JSON.stringify({identity:identity(s),draft:refitDraft(s,draft)}));return true;}catch{return false;}
}
export function clearRefitDraft(storage){try{storage.removeItem(REFIT_DRAFT_KEY);}catch{}}
