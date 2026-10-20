import {towBody,towMission,towTarget} from './tow-core.js';
import {fuelUse,seaState} from './voyage.js';
import {bilgeBuild,buildThrust,pumpCharge,impactLeak} from './bilge-build.js';
import {winchBuild,winchState,winchLimit} from './winch-build.js';
import {shipWork} from './ship-work.js';
import {stormState,workTarget,gustRide,gustRideBonus} from './expedition.js';
import {recoveryLabel,expeditionText} from './expedition-view.js';
import {seaTelemetry} from './sea-feedback.js';
import {textFor} from './rescue-locale.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy={
 ko:{tug:'예인선',fuel:'연료',water:'침수',held:'유지',parts:'부품',tension:'장력',charge:'과출력',valveOpen:'밸브 열림 +2/초',valveClosed:'밸브 닫힘',dry:'건조 · 출력 감소',power:'출력 구간 20–50',heavy:'과침수 · 배수 필요',danger:'위험 · 즉시 배수',closeValve:'밸브 닫기 · 배수',pull:'축력',disconnected:'선체 연결 필요',overload:'과부하 · X 줄 풀기',slack:'느슨함 · Z 줄 감기',cooldown:'윈치 복귀 중',winding:'축력 충전 · Shift 해제',ready:'당김 준비',noFuel:'당김 연료 부족',fuelCost:'연료',repair:'수리',repairEmpty:'수리 중단 · 부품 없음',repairUnassigned:'수리 담당 없음 · I',seconds:'초',gust:'돌풍',gustNext:'다음 돌풍',gustSoon:'곧 돌풍',current:'해류',riding:'충전',patch:'구조선 봉합',recover:'회수',hold:'F 유지',slow:'감속 필요 · C',noParts:'봉합 부품 부족',partCost:'부품 1개',reset:'작업 중단',leaking:'구조선 누수',rescue:'구조선',buoys:'부표',precision:'정밀 조종',trackRecovery:'회수 표식',trackRescue:'구조 표식',details:'항해 정보',leg:'구간',record:'수신 기록',elapsed:'항해 시간',equipment:'장비',burn:'연료 소모',flow:'누수 / 배수',thrust:'핵심 추진 효과'},
 en:{tug:'Tug',fuel:'Fuel',water:'Flooding',held:'held',parts:'Parts',tension:'Tension',charge:'Drive',valveOpen:'Inlet open +2/s',valveClosed:'Inlet closed',dry:'Dry · reduced thrust',power:'Power band 20–50',heavy:'Heavy · pump water',danger:'Danger · pump now',closeValve:'Close inlet · pump',pull:'Stored pull',disconnected:'Connect a hull',overload:'Overload · X pay out',slack:'Slack · Z reel in',cooldown:'Winch resetting',winding:'Winding · release Shift',ready:'Pull ready',noFuel:'Not enough fuel to pull',fuelCost:'Fuel',repair:'Repair',repairEmpty:'Repair stopped · no parts',repairUnassigned:'Repair unassigned · I',seconds:'s',gust:'Gust',gustNext:'Next gust',gustSoon:'Gust incoming',current:'Current',riding:'Drive',patch:'Patch rescue hull',recover:'Recover',hold:'Hold F',slow:'Slow down · C',noParts:'Patch needs a part',partCost:'1 part',reset:'Work stopped',leaking:'Rescue hull leaking',rescue:'Rescue hull',buoys:'Buoys',precision:'Precision',trackRecovery:'Track recovery',trackRescue:'Track rescue',details:'Voyage details',leg:'Leg',record:'Radio log',elapsed:'Time underway',equipment:'Equipment',burn:'Fuel burn',flow:'Leak / pumping',thrust:'Core thrust effect'}
};
const metric=(id,label,value,extra={})=>({id,label,value,...extra});
const line=(id,text,extra={})=>({id,text,...extra});
const direction=(x,y)=>Math.abs(x)>=Math.abs(y)?(x<0?'←':'→'):(y<0?'↑':'↓');

export function fieldWorkSnapshot(s){
 const a=s.voyage?.situation;
 return a?{target:a.patch>0?'patch':a.salvage>0?'salvage':null,progress:Math.max(a.patch,a.salvage)}:null;
}
export function fieldWorkInterruption(before,s,input={}){
 if(!before?.target||before.progress<=0||s.status!=='playing'||s.voyage?.phase!=='sailing')return null;
 const a=s.voyage.situation,target=before.target;
 if(a[target]>0||a[target==='patch'?'patched':'salvaged'])return null;
 if(!input.work)return 'released';
 if(workTarget(s)!==target)return 'range';
 if(target==='patch'&&s.voyage.parts===0)return 'parts';
 if(Math.hypot(s.boat.vx,s.boat.vy)>=22)return 'speed';
 return null;
}
const interruptionText=(reason,en)=>({
 released:en?'F released · progress reset':'F 해제 · 작업 초기화',
 range:en?'Out of range · progress reset':'범위 이탈 · 작업 초기화',
 speed:en?'Too fast · progress reset':'속도 초과 · 작업 초기화',
 parts:en?'No repair part · progress reset':'부품 부족 · 작업 초기화'
}[reason]||'');

// Presentation only. Eligibility, amounts and progress come from the same state
// functions used by the simulation; the returned model never mutates a run.
export function compactTowHud(s,{language='ko',guidance,input={},interruption=null}={}){
 const lang=language==='en'?'en':'ko',t=copy[lang],labels=textFor(lang),v=s.voyage;
 if(!guidance)throw new TypeError('compactTowHud requires authoritative mission guidance');
 const def=towMission(s),target=s.connected?towTarget(s):towBody(s,guidance.focusBodyId)||towTarget(s);
 const leaking=!!(v?.version>=3&&v.situation.contract==='leaking'&&!v.situation.patched);
 const model={
  language:lang,phase:guidance.phase,goal:guidance.goal,mark:def.visual.mark,
  leg:v?`${t.leg} ${v.leg+1}/3`:'',metrics:[metric('hull',t.tug,Math.ceil(s.boat.hp),{max:100})],
  build:null,environment:[],risks:[],actions:[],work:null,
  docking:guidance.docking?{...guidance.docking}:null,
  dockChecks:guidance.dockChecks||[],
  routeHint:guidance.hint||'',radio:null
 };
 if(s.connected||leaking||guidance.dockChecks?.length){
  const body=s.connected?target:leaking?s.bus:target;
  const name=body===s.bus?labels[def.visual.busNameKey||(def.id==='market'?'marketPassenger':'towBusHull')]:labels[body.nameKey||'marketIce'];
  model.metrics.push(metric('target',name||t.rescue,Math.ceil(body.hp),{max:100,tone:leaking&&body===s.bus?'danger':'normal'}));
  if(leaking&&body!==s.bus)model.metrics.push(metric('rescue-hull',labels[def.visual.busNameKey||'marketPassenger']||t.rescue,Math.ceil(s.bus.hp),{max:100,tone:'danger'}));
 }
 if(s.connected)model.metrics.push(metric('tension',t.tension,`${Math.round(s.ropeTension*100)}%`));
 if(guidance.gateState||!s.power)model.environment.push(line('infrastructure',guidance.gateState||labels.towCurrentOff));
 if(v){
  const work=shipWork(s),waterTrend=work.trend==='held'?t.held:(work.net>0?'+':'−')+Math.abs(work.net).toFixed(2)+(lang==='en'?'/s':'/초');
  if(v.version>=2){const fuel=fuelUse(s,input);model.metrics.push(metric('fuel',t.fuel,Math.ceil(v.fuel),{rate:fuel.rate,boost:fuel.boost,tone:v.fuel<=45?'warning':'normal',note:v.fuel<=45?fuel.rate.toFixed(2)+(lang==='en'?'/s':'/초'):''}));}
  model.metrics.push(metric('water',t.water,`${Math.floor(v.flood)}%`,{note:waterTrend,trend:work.trend,tone:work.trend==='rising'?'warning':'normal'}));
  model.metrics.push(metric('parts',t.parts,v.parts));
  if(work.repair.status==='working')model.risks.push(line('repair',`${t.repair} ${work.repair.seconds.toFixed(1)}${t.seconds}`,{state:'working'}));
  else if(work.repair.status==='empty')model.risks.push(line('repair',t.repairEmpty,{tone:'warning',state:'empty'}));
  else if(work.repair.status==='unassigned')model.risks.push(line('repair',t.repairUnassigned,{tone:'warning',state:'unassigned'}));
  if(bilgeBuild(v)){
   const band=v.flood<20?'dry':v.flood<=50?'power':v.flood<75?'heavy':'danger';
   model.build={id:'bilge',key:'B',state:band,value:v.valve?t.valveOpen:t.valveClosed,
    note:band==='danger'&&v.valve?t.closeValve:t[band],tone:['heavy','danger'].includes(band)?'warning':'normal'};
  }else if(winchBuild(v)){
   const state=winchState(s),cost=v.specialization==='harpoon'?5:v.specialization==='ratchet'?2:3;
   model.build={id:'winch',key:'B',state,value:`${t.pull} ${Math.floor(v.winchCharge)}`,
    note:`${v.fuel<cost?t.noFuel:t[state]} · ${t.fuelCost} ${cost}`,tone:state==='overload'||v.fuel<cost?'warning':'normal'};
  }
  if(v.version>=3){
   model.actions.push(line('drive',`${t.charge} ${Math.floor(v.situation.charge)}%`,{key:'Shift',active:!!v.situation.boosting}));
   const gust=stormState(s),sea=seaTelemetry(s);
   model.environment.push(line('gust',`${t[gust.active?'gust':gust.warning?'gustSoon':'gustNext']} ${gust.seconds}${t.seconds} ${direction(gust.ax,gust.ay)}`,{tone:gust.active||gust.warning?'warning':'normal',state:gust.active?'active':gust.warning?'warning':'quiet',note:gust.active?(sea.exposed?(lang==='en'?'Exposed':'현재 영향'):(lang==='en'?'Outside zone':'구역 밖')):''}));
   if(sea.currentStrength)model.environment.push(line('current',`${t.current} ${direction(sea.current.x,sea.current.y)} ${Math.round(sea.currentStrength)}`));
   if(gustRide(s,input))model.environment.push(line('ride',`${t.riding} +${gustRideBonus(s,input)}/s`,{bonus:gustRideBonus(s,input),note:lang==='en'?'Shift · break away':'Shift · 탈출'}));
   if(leaking)model.risks.push(line('rescue-leak',`${t.leaking} · ${lang==='en'?'Leak-only':'누수만'} ${guidance.navigation?.seconds??Math.ceil(s.bus.hp/.45)}${t.seconds}`,{tone:'danger'}));
   const targetWork=workTarget(s);
   if(targetWork){
    const progress=targetWork==='patch'?v.situation.patch:v.situation.salvage;
    const status=targetWork==='patch'&&v.parts===0?'no-parts':Math.hypot(s.boat.vx,s.boat.vy)>=22?'moving':progress>0?'working':'ready';
    model.work={target:targetWork,status,progress,max:4,
     title:targetWork==='patch'?t.patch:recoveryLabel(s,lang),
     cost:targetWork==='patch'?t.partCost:'',
     action:status==='no-parts'?t.noParts:status==='moving'?t.slow:`${t.hold} · ${Math.max(0,Math.ceil((4-progress)*10)/10).toFixed(1)}${t.seconds}`,
     warning:status==='no-parts'||status==='moving'};
   }
   if(guidance.navigation?.canDetour)model.actions.push(line('navigation',guidance.navigation.mode==='salvage'?t.trackRescue:t.trackRecovery,{key:'G',state:guidance.navigation.mode}));
  }
 }
 // Net previews and expiry carry actionable consequences and must survive
 // shortening the ordinary route explanation.
 if(guidance.netTimer)model.risks.push(line('net-life',guidance.netTimer.label,{tone:guidance.netTimer.urgent?'danger':'normal'}));
 if(guidance.preview)model.risks.push(line('net-preview',guidance.hint));
 model.actions.unshift(line('context',guidance.action));
 if(interruption){const message=interruptionText(interruption,lang==='en');if(message)model.risks.push(line('work-interrupted',message,{tone:'warning',state:interruption}));}
 model.actions.push(line('buoys',`${t.buoys} ${s.anchors.length}/3`,{key:'Q'}));
 if(s.connected&&guidance.rigging)model.actions.push(line('rigging',lang==='en'?'Line length':'줄 조절',{key:'Z/X'}));
 if(guidance.pilot?.active)model.actions.push(line('precision',t.precision,{key:'C',active:true}));
 return model;
}

const keycap=key=>key?`<kbd>${escape(key)}</kbd>`:'';
const renderLine=item=>`<span${item.id==='context'?' class="tow-action-label"':''} data-hud-item="${escape(item.id)}" data-tone="${escape(item.tone||'normal')}"${item.state?` data-state="${escape(item.state)}"`:''}${item.active!==undefined?` data-active="${!!item.active}"`:''}${item.bonus!==undefined?` data-ride-bonus="${item.bonus}"`:''}>${keycap(item.key)}${escape(item.text)}${item.note?` <small>${escape(item.note)}</small>`:''}</span>`;
export function compactTowHudMarkup(model){
 const metrics=model.metrics.map(m=>`<div class="compact-metric" data-hud-metric="${escape(m.id)}" data-tone="${escape(m.tone||'normal')}"${m.trend?` data-trend="${m.trend}"`:''}${m.rate!==undefined?` data-fuel-rate="${m.rate}" data-fuel-boost="${!!m.boost}"`:''}><span>${escape(m.label)}</span><strong>${escape(m.value)}</strong>${m.note?`<small>${escape(m.note)}</small>`:''}</div>`).join('');
 const build=model.build?`<div class="compact-build" data-hud-build="${model.build.id}" data-build-state="${model.build.state}" data-tone="${model.build.tone}">${keycap(model.build.key)}<strong>${escape(model.build.value)}</strong><span>${escape(model.build.note)}</span></div>`:'';
 const work=model.work?`<div class="compact-work field-progress" data-work-state="${escape(model.work.status)}" data-field-work="${escape(model.work.target)}"><strong>${escape(model.work.title)}</strong>${model.work.cost?`<span>${escape(model.work.cost)}</span>`:''}<label>${escape(model.work.action)}<progress max="${model.work.max}" value="${model.work.progress}" aria-label="${escape(model.work.title)}"></progress></label></div>`:'';
 const checks=model.dockChecks.length?`<div class="compact-docking dock-feedback" data-dock-reason="${escape(model.docking?.reason||'')}">${model.docking?`<strong>${escape(model.docking.label)}</strong>`:''}<div class="dock-checks">${model.dockChecks.map(c=>`<span class="${c.met?'met':'unmet'}">${c.met?'✓':'○'} ${escape(c.text)}</span>`).join('')}</div></div>`:'';
 return `<div class="play-top compact-top"><div class="mission-objective"><small>${escape(model.leg||model.mark)}</small><strong>${escape(model.goal)}</strong></div></div>
 <div class="play-console compact-console"><div class="compact-metrics">${metrics}</div><div class="compact-conditions">${build}
 ${model.environment.length?`<div class="compact-environment">${model.environment.map(renderLine).join('')}</div>`:''}
 ${model.risks.length?`<div class="compact-risks">${model.risks.map(renderLine).join('')}</div>`:''}</div>
 ${work}${checks}<div class="compact-actions">${model.actions.filter(a=>!model.work||a.id!=='context').map(renderLine).join('')}</div></div>`;
}

// The detailed values remain keyboard-accessible in a paused screen. Apps must
// install this section in I/Esc before switching their live HUD to this view.
export function compactTowDetailsMarkup(s,{language='ko',input={},guidance}={}){
 const lang=language==='en'?'en':'ko',t=copy[lang],v=s.voyage,rows=[],tr=(ko,en)=>lang==='en'?en:ko;
 rows.push([t.elapsed,`${Math.floor(s.time/60)}:${String(Math.floor(s.time%60)).padStart(2,'0')}`]);
 rows.push([t.record,lang==='en'?'R while sailing':'항해 중 R']);
 if(guidance?.hint)rows.push([lang==='en'?'Route guidance':'경로 안내',guidance.hint]);
 if(guidance?.gateState)rows.push([lang==='en'?'Harbor infrastructure':'항만 시설',guidance.gateState]);
 if(s.connected&&guidance?.rigging)rows.push([lang==='en'?'Towline':'견인줄',guidance.rigging]);
 if(v){
  const work=shipWork(s);
  if(v.version>=2){
   const fuel=fuelUse(s,input);
   const sources=[fuel.active?(lang==='en'?'Underway':'이동 중'):(lang==='en'?'Idle engine':'공회전'),fuel.towing?(lang==='en'?'Towing':'예인'):'',fuel.motor?(lang==='en'?'Auxiliary drive':'보조 추진기'):'',fuel.boost?(lang==='en'?'Overdrive':'과출력'):''].filter(Boolean);
   rows.push([t.burn,`${fuel.rate.toFixed(2)}/s · ${sources.join(' + ')} · ${lang==='en'?'at pause':'정지 직전'}`]);
   const sea=seaState(v),name={calm:tr('잔잔한 바다','Calm sea'),headwind:tr('맞바람','Headwind'),rough:tr('거친 파도','Rough sea')}[sea.id];
   rows.push([tr('해상 예보','Sea forecast'),`${name} · ${tr('추진','Thrust')} ×${sea.speed} · ${t.fuel} ×${sea.fuel} · ${tr('충격 누수','Collision leak')} ×${sea.leak}`]);
  }
  if(v.version>=3){
   const x=expeditionText(lang),a=v.situation,sea=seaTelemetry(s),gust=sea.gust;
   rows.push([tr('구조 요청','Distress call'),x[a.contract]+' · '+x[a.contract+'Note']+' · '+(v.leg===2?tr('마지막 구조 → 항해 완료','Final rescue → complete the voyage'):x[a.contract+'Pay'])]);
   rows.push([tr('현장 작업','Field work'),x.controls+' · '+tr('F를 놓거나 범위를 벗어나거나 너무 빨라지면 작업을 처음부터 다시 합니다.','Releasing F, leaving range or moving too fast resets work progress.')]);
   rows.push([tr('현장 인양','Field recovery'),(a.salvaged?x.rescued:recoveryLabel(s,lang))+(v.version>=4?' · '+x.planNote+(a.salvagePlan==='module'?' · '+tr('교체 슬롯 ','Replacement slot ')+(a.salvageSlot+1):''):'')]);
   rows.push([tr('풍압 / 선체 위치 해류','Wind force / current at hull'),`${Math.round(sea.wind)} ${direction(gust.ax,gust.ay)} · ${sea.exposed?tr('현재 영향','Exposed'):tr('현재 영향 없음','Not exposed')} / ${Math.round(sea.currentStrength)} ${direction(sea.current.x,sea.current.y)}`]);
  }
  rows.push([t.flow,`${work.leak.toFixed(2)} / ${work.drain.toFixed(2)}`]);
  rows.push([tr('승무원 배치','Crew assignments'),Object.entries(v.assignments).map(([id,job])=>(id==='operator'?'Woo':'Park')+' · '+({helm:tr('조타','Helm'),engine:tr('기관 운전','Engine watch'),pump:tr('배수','Bilge pump'),repair:tr('선체 수리','Hull repair')}[job])).join(' / ')]);
  if(bilgeBuild(v)){
   rows.push([tr('침수 발전선 · B','Flood engine · B'),tr('흡수 밸브 +2/초. 침수 20–50 유지 → 밸브 닫기 → 배수하며 Shift. 침수 100이면 침몰.','Inlet +2/s. Keep 20–50 water → close inlet → pump and Shift. 100 water sinks.')]);
   rows.push([tr('특화 / 충격 누수','Specialization / collision leak'),(v.specialization==='pressure'?tr('압력 한계 돌파','Pressure redline'):v.specialization==='recycler'?tr('배수 순환 특화','Closed-loop recycler'):tr('미선택','Not chosen'))+' · ×'+impactLeak(v)]);
   rows.push([t.thrust,`×${buildThrust(v).toFixed(2)}`]);
   rows.push([lang==='en'?'Drive per water pumped':'배수 1당 충전',pumpCharge(v)]);
  }
  if(winchBuild(v)){
   const heavy=v.specialization==='harpoon',rapid=v.specialization==='ratchet';
   rows.push([tr('축력 윈치선 · B','Spring winch · B'),tr('장력을 유지하며 견인. Z 줄 감기 / X 풀기. 느슨함·분리·Shift는 축력 손실. 핵심 추진 ×0.8.','Tow with steady tension. Z reels in / X pays out. Slack, detachment and Shift lose charge. Core thrust ×0.8.')]);
   rows.push([tr('특화 / 당김 조건','Specialization / pull requirements'),`${heavy?tr('일격 견인','Heavy haul'):rapid?tr('연속 래칫','Ratchet chain'):tr('미선택','Not chosen')} · ${t.pull} ${heavy?60:35}+ · ${t.fuel} ${heavy?5:rapid?2:3}`]);
   rows.push([tr('당김 사용량','Pull consumption'),rapid?tr('최대 축력 45 사용, 잔량 유지','Spends up to 45 charge; keeps the rest'):heavy?tr('축력 전부 사용 · 당김 ×1.5 · 반동 증가','Spends all charge · pull ×1.5 · stronger recoil'):tr('축력 전부 사용','Spends all charge')]);
   rows.push([lang==='en'?'Overload tension':'과부하 장력',`${Math.round(winchLimit(v)*100)}%`]);
   rows.push([lang==='en'?'Stored-pull charge multiplier':'축력 충전 배율',v.equipment.includes('battery')?'×1.5':'×1']);
   rows.push([lang==='en'?'Recoil multiplier':'반동 배율',v.equipment.includes('tools')?'×0.5':'×1']);
  }
  rows.push([lang==='en'?'Next repair: hull / leak / parts':'다음 수리: 선체 / 누수 / 부품',`+${work.repair.hull.toFixed(1)} / −${work.repair.leak.toFixed(2)} / 1`]);
  rows.push([t.equipment,v.equipment.length?v.equipment.map(id=>({pump:lang==='en'?'Automatic pump':'자동 배수기',tools:lang==='en'?'Repair tools':'정비 공구',motor:lang==='en'?'Auxiliary drive':'보조 추진기',battery:lang==='en'?'Accumulator':'축전지',turbine:lang==='en'?'Bilge generator':'배수 발전기'}[id]||id)).join(' · '):'—']);
 }
 return `<details class="compact-hud-details"><summary>${escape(t.details)}</summary><dl>${rows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></details>`;
}
