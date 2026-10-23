import {refitPreparation} from './refit-preparation.js';
// Read current work only. Interior pauses simulation; ETA assumes unchanged assignments.
export function shipWork(s){
 const v=s.voyage,workers=s.crew.filter(id=>v.assignments[id]==='repair').length;
 const hull=Math.min(100-s.boat.hp,v.equipment.includes('tools')?24:12),leak=Math.min(v.leak,.25);
 const status=hull<=0&&leak<=0?'complete':!workers?'unassigned':v.parts<=0?'empty':'working';
 return {...refitPreparation(s),repair:{status,workers,seconds:workers?(8-v.repair)/workers:null,hull,leak,parts:v.parts}};
}
export function shipWorkMarkup(s,language){
 const en=language==='en',d=shipWork(s),r=d.repair;
 const water=d.trend==='held'?(en?'Flooding held':'침수 유지'):(d.trend==='rising'?(en?'Flooding +':'침수 증가 +'):(en?'Flooding −':'침수 감소 −'))+Math.abs(d.net).toFixed(2)+'/s';
 const states=en?{complete:'No hull damage or leak',unassigned:'Assign a repair worker',empty:'Repairs stopped · no parts',working:'Next repair in '+(r.seconds===null?'—':r.seconds.toFixed(1))+'s after resuming'}:{complete:'선체 손상·누수 없음',unassigned:'수리 담당을 배치하세요',empty:'수리 중단 · 부품 없음',working:'항해 재개 후 '+(r.seconds===null?'—':r.seconds.toFixed(1))+'초 뒤 수리'};
 return '<div class="ship-work"><p data-work-water="'+d.trend+'"><strong>'+water+'</strong><small>'+(en?'Leak / pumping: ':'누수 / 배수: ')+d.leak.toFixed(2)+' / '+d.drain.toFixed(2)+'</small></p><p data-work-repair="'+r.status+'"><strong>'+states[r.status]+'</strong>'+(r.status!=='complete'?'<small>'+(en?'Per part: hull +':'부품 1개당: 선체 +')+r.hull.toFixed(1)+(en?' · leak −':' · 누수 −')+r.leak.toFixed(2)+'</small>':'')+'</p></div>';
}
export function repairFeedback(e,language){
 return language==='en'?'Repair complete · hull +'+e.hull.toFixed(1)+' · leak −'+e.leak.toFixed(2)+' · parts left '+e.parts:'수리 완료 · 선체 +'+e.hull.toFixed(1)+' · 누수 −'+e.leak.toFixed(2)+' · 남은 부품 '+e.parts;
}
// Compact live readout; keep rescue-vessel leakage separate from the tug's bilge.
export function shipWorkHud(s,language){
 if(!s?.voyage||s.voyage.phase!=='sailing'||s.status!=='playing')return '';
 const d=shipWork(s),r=d.repair,en=language==='en';
 if(s.voyage.flood<=0&&d.leak<=0&&r.status==='complete')return '';
 const water=d.trend==='held'?(en?'water held':'침수 유지'):(d.trend==='rising'?(en?'water +':'침수 증가 +'):(en?'water −':'침수 감소 −'))+Math.abs(d.net).toFixed(2)+'/s';
 const repair=r.status==='working'?(en?'repair in ':'수리까지 ')+r.seconds.toFixed(1)+'s':r.status==='empty'?(en?'repair stopped: no parts':'수리 중단: 부품 없음'):r.status==='unassigned'?(en?'repair unassigned':'수리 담당 없음'):'';
 return '<div class="ship-work-live" data-live-water="'+d.trend+'" data-live-repair="'+r.status+'"><strong>'+(en?'Tug · ':'예인선 · ')+water+'</strong>'+(repair?'<span>'+repair+'</span>':'')+'<span>'+(en?'I · crew orders':'I · 승무원 배치')+'</span></div>';
}
