import {assignCrew} from './voyage.js';
export const CREW_PLANS={sail:{operator:'helm',engineer:'engine'},drain:{operator:'helm',engineer:'pump'},repair:{operator:'helm',engineer:'repair'}};
export function applyCrewPlan(s,id){
 const plan=Object.hasOwn(CREW_PLANS,id)?CREW_PLANS[id]:null;if(!plan||!s?.voyage||s.status!=='playing'||!['refit','sailing'].includes(s.voyage.phase)||!['operator','engineer'].every(id=>s.crew.includes(id)))return false;
 for(const [id,job] of Object.entries(plan))assignCrew(s,id,job);return true;
}
export function crewPlansMarkup(s,language){
 const en=language==='en',names=en?{sail:'Sail',drain:'Pump',repair:'Repair'}:{sail:'항해 배치',drain:'배수 배치',repair:'수리 배치'},notes=en?{sail:'Woo: helm · Park: engine',drain:'Woo: helm · Park: pump · thrust −15%',repair:'Woo: helm · Park: repair · uses parts, thrust −15%'}:{sail:'Woo 조타 · Park 기관 운전',drain:'Woo 조타 · Park 배수 · 추진 −15%',repair:'Woo 조타 · Park 수리 · 부품 사용, 추진 −15%'};
 return '<div class="crew-plans" aria-label="'+(en?'Crew plans':'승무원 빠른 배치')+'">'+Object.entries(CREW_PLANS).map(([id,plan])=>'<button type="button" data-crew-plan="'+id+'" aria-pressed="'+Object.entries(plan).every(([id,job])=>s.voyage.assignments[id]===job)+'"><strong>'+names[id]+'</strong><small>'+notes[id]+'</small></button>').join('')+'</div>';
}
