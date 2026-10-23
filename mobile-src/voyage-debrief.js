import {expeditionText} from './expedition-view.js';
import {salvageSite} from './expedition.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function voyageDebrief(s,next=null,language='ko'){
 if(!s?.voyage||!['won','lost'].includes(s.status))return null;
 const en=language==='en',say=(ko,english)=>en?english:ko,v=s.voyage,a=v.situation,t=expeditionText(language),reason=s.mission.reason,workers=Object.values(v.assignments).filter(x=>x==='pump').length,drain=workers*.55+(v.equipment.includes('pump')?.45:0),won=s.status==='won';
 const failure=reason==='fuel'?say('연료 소진','Fuel exhausted'):reason==='flood'?say('예인정 침수 100%','Tug flooding reached 100%'):reason==='passenger-sunk'?say('누수로 구조선이 침몰했습니다','The rescue vessel sank from its leak'):s.boat.hp<=0?say('예인정 충돌 파손','Tug disabled by collision'):s.bus.hp<=0?say('구조선 충돌 파손','Rescue vessel disabled by collision'):say('예인 대상 충돌 파손','Towed vessel disabled by collision');
 const facts=[];
 if(a){const site=salvageSite(s);facts.push({label:say('현장 인양','Field recovery'),value:a.salvaged?(site.reward==='fuel'?say('연료 보급 회수','Fuel recovered'):site.reward==='parts'?say('수리 부품 회수','Repair parts recovered'):t[site.reward]):say('미회수','Not recovered')});if(a.contract==='leaking')facts.push({label:say('구조선 봉합','Rescue hull patch'),value:a.patched?say('완료','Completed'):say('미완료','Not completed')});}
 if(s.missionId==='market')facts.push({label:say('얼음선 정박','Carrier mooring'),value:s.temporaryMoorings.some(x=>x.bodyId==='ice')?say('정박 상태로 종료','Moored at finish'):say('정박하지 않음','Not moored')});
 if(s.missionId==='sluice')facts.push({label:say('수문 우회로','Sluice bypass'),value:s.bypassOpen?say('개방됨','Opened'):say('닫힘','Closed')});
 if(s.missionId==='landing')facts.push({label:say('부잔교 설치','Pontoon installation'),value:s.secured.includes('pontoon')?s.checkpoints.includes('landing-workers-installed')?say('대기 승객 지원으로 설치','Installed with waiting crew'):say('설치 완료','Installed'):say('미설치','Not installed')});
 facts.push({label:say('충돌 기록','Collision record'),value:s.metrics.collisions+say('회 · 피해 합계 ',' contacts · total damage ')+s.metrics.damage.toFixed(1)});
 facts.push({label:say('종료 시 장착','Loadout at finish'),value:v.equipment.map(id=>t[id]).join(' / ')||say('없음','None')});
 let advice;
 if(!won&&reason==='fuel')advice=s.voyage.version>=3&&!a.salvaged&&salvageSite(s).reward==='fuel'?say('같은 조건에서 다시 도전한다면 G로 연료 인양을 먼저 확인하세요.','For a same-condition retry, use G to locate the fuel recovery first.'):say('다음 출항 준비에서 연료를 확보하고, 과출력을 필요한 구간에 나눠 쓰세요.','Take fuel at departure and reserve overdrive for the sections that need it.');
 else if(!won&&reason==='flood')advice=drain===0?say('I에서 배수 담당을 배치하세요. 다음 구간의 추가 누수도 감당해야 합니다.','Assign pumping crew with I; allow for the extra leak on the next leg.'):say('배수만으로 버티기 어렵다면 부품을 확보하고 I에서 수리 담당으로 누수원을 줄이세요.','If pumping cannot keep up, obtain repair parts and assign repairs with I to reduce the leak.');
 else if(!won&&reason==='passenger-sunk')advice=v.parts>0?say('구조선 곁에서 멈추고 F를 4초 유지해 먼저 봉합하세요.','Stop beside the rescue vessel and hold F for four seconds to patch it first.'):say('다음에는 봉합용 부품 1개를 남겨두세요. 선체 수리 담당도 같은 부품을 사용합니다.','Keep one repair part for the rescue hull next time; tug repairs use the same supply.');
 else if(!won)advice=say('같은 조건에서 충돌 구간을 다시 연습하세요. 회전 전에 감속하고 긴 선미가 도는 공간을 남겨두세요.','Practice the collision section under the same conditions. Slow before turning and leave room for the long stern.');
 else if(next)advice=say('다음 구간에서도 손상과 장비가 이어집니다. 늘어난 누수에 맞춰 배수·수리를 준비하세요.','Damage and equipment carry forward. Prepare pumping or repairs for the increased leak.');
 else advice=say('같은 항해를 다른 작업 순서나 장비 조합으로 다시 시도할 수 있습니다.','Try another voyage with a different work order or equipment combination.');
 return {title:won?say('이번 구간의 선택','This leg’s choices'):failure,won,facts,advice,readings:[{label:say('남은 연료','Fuel remaining'),value:v.version>=2?Math.floor(v.fuel):'—'},{label:say('남은 부품','Parts remaining'),value:v.parts},{label:say('예인정 침수','Tug flooding'),value:Math.floor(v.flood)+'%'}],transfer:next?{fuel:next.fuel,parts:next.parts,fuelAdded:Math.max(0,next.fuel-v.fuel),partsAdded:Math.max(0,next.parts-v.parts),leak:next.leak,leakAdded:next.leak-v.leak}:null,drain,leak:v.leak};
}
export function debriefMarkup(s,next,language){
 const d=voyageDebrief(s,next,language);if(!d)return '';const en=language==='en';
 return '<section class="voyage-debrief" data-reason="'+esc(s.mission.reason)+'"><h3>'+esc(d.title)+'</h3><dl class="debrief-readings">'+d.readings.map(r=>'<div><dt>'+esc(r.label)+'</dt><dd>'+esc(r.value)+'</dd></div>').join('')+'</dl>'+(d.transfer?'<p class="debrief-transfer">'+(en?'Next leg: fuel ':'다음 구간: 연료 ')+d.transfer.fuel.toFixed(1)+' (+'+d.transfer.fuelAdded.toFixed(1)+') · '+(en?'parts ':'부품 ')+d.transfer.parts+' (+'+d.transfer.partsAdded+') · '+(en?'leak ':'누수 ')+d.transfer.leak.toFixed(2)+'/s (+'+d.transfer.leakAdded.toFixed(2)+')</p>':'')+'<p class="debrief-advice">'+esc(d.advice)+'</p><details><summary>'+(en?'Work record and loadout':'작업 기록과 장비 보기')+'</summary><dl>'+d.facts.map(r=>'<div><dt>'+esc(r.label)+'</dt><dd>'+esc(r.value)+'</dd></div>').join('')+'<div><dt>'+(en?'Leak / pumping at finish':'종료 시 누수 / 배수')+'</dt><dd>'+d.leak.toFixed(2)+' / '+d.drain.toFixed(2)+'</dd></div></dl></details></section>';
}
