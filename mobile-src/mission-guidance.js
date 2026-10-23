import {dockingGuidance} from './docking-guidance.js';
import {piloting} from './piloting.js';
import {expeditionGuidance} from './expedition-guidance.js';
import {fieldGuidance} from './field-guidance.js';
import {marketGuidance} from './market-guidance.js';
import {storyOutcomeKeys} from './voyage-story.js';
import {triangleArea,inTriangle} from './core.js';
import {HARBOR,netTargets,guidance} from './rescue-core.js';
import {towCutPreview,towWorkBenefits,towFollowingFlow,towAssistState,towContext,towDockStatus} from './tow-core.js';
import {towMission,towBody,towTarget,towAction,bodyMoorings,bodyDock} from './tow-core.js';
import {getTowMission} from './tow-missions.js';
import {textFor} from './rescue-locale.js';
const fill=(s,values)=>s.replace(/\{(\w+)\}/g,(_,k)=>String(values[k]??''));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// One pure state-to-presentation boundary for goals, hints, actions and transitions.
// The UI and renderers consume this result; they must not invent competing goals.
function baseGuidance({state:s=null,campaign={crew:[]},screen='play',language='ko'}={}){
 const t=textFor(language),m=s?.mission,crew=campaign.crew||[],isTow=s?.kind==='tow';
 const recordEnabled=!!(!isTow&&m?.recordEnabled===true),recordAvailable=recordEnabled&&!m.recoveredBox;
 const towManual=s?isTow:crew.length>0;
 const netTimer=s?.status==='playing'&&s.anchors.length?{seconds:Math.max(0,Math.ceil(s.anchorLife)),urgent:s.anchorLife<=5,label:fill(t.netRemaining,{seconds:Math.max(0,Math.ceil(s.anchorLife))}),note:!isTow&&s.circuits===0?t.netLearningNote:t.netPauseNote,warning:t.netUrgent}:null;
 const base={rigging:isTow?(s.connected?fill(t.ropeControl,{percent:Math.round((s.ropeLength-62)/68*100)}):t.ropeDisconnected):'',netTimer,phase:'cabin',goal:'',hint:'',action:'',title:'',body:[],nextTitle:campaign.busRescued?t.towRecord:t.towBusCall,dockChecks:[],recordEnabled,recordAvailable,manual:towManual?[...t.towGuide,t.ropeGuide,t.recruitGuide]:[...t.guide,...(recordEnabled?[t.legacyRecordGuide]:[])]};
 const out=(phase,values={})=>({...base,phase,...values,hint:(values.hint||'')+(netTimer?.urgent?' · '+netTimer.warning:'')});
 if(screen==='missions')return out('mission-board',{title:t.missionBoard,goal:t.missionBoardNote,action:t.missionSelect});
 if(screen==='chapter')return out('chapter-complete',{title:t.chapterComplete,goal:t.chapterComplete,body:[t.chapterBody],hint:t.chapterReplayNote,action:t.chapterReplay});
 if(screen==='towBrief'){const def=getTowMission(campaign.selectedMissionId||'bus07'),k=def.textKeys;return out(def.id==='bus07'?'bus-briefing':'content-briefing',{title:t[k.title],summary:t.missionSummaries[def.id],goal:t[k.brief],body:[t[k.brief],t[k.power]],story:def.id==='landing'?{title:t.landingStoryTitle,body:t.landingStoryBody,note:t.landingStoryNote,image:'assets/art/dawn-rescue-v1.png'}:null,routeOptions:def.id==='bus07'?[{title:t.routeInnerTitle,body:t.routeInnerBody,note:t[crew.includes('operator')?'routeWooReady':'routeWooMissing']},{title:t.routeOuterTitle,body:t.routeOuterBody},{title:t.routeManualTitle,body:t.routeManualBody}]:[1,2].map(i=>({title:t[def.id+'WorkTitle'+i],body:t[def.id+'WorkBody'+i]})),hint:t.towControls,action:t[k.launch||(def.id==='market'?'marketLaunch':'towLaunch')],manual:def.id==='bus07'?[...t.towGuide]:contentManual(t,def)});}
 if(screen==='brief')return out('rescue-briefing',{title:t.missionTitle,summary:t.missionSummaries.rescue,goal:t.missionLead,body:[t.missionLead,t.firstNetGuide],hint:t.controls,action:t.launch});
 if(!s)return out('cabin',{title:t.title,goal:campaign.busRescued?t.chapterComplete:crew.length?t.towBusCall:t.start});
 if(isTow&&s.missionId!=='bus07'&&s.status!=='lost')return fieldGuidance(s,marketGuidance(s,contentGuidance(s,t,out),language),language);
 if(s.status==='won')return isTow?out('chapter-arrival',{title:t.towComplete,goal:t.towPassengersAshore,body:[[t.towOutcome,...storyOutcomeKeys(s).map(k=>t[k])].join(' '),t.towRecord],action:t.chapterDone}):out('rescue-complete',{title:t.rescuedTitle,goal:t.rescueReturned,body:[t.rescueReturned],hint:t.towBusCall,action:t.next});
 if(s.status==='lost')return out(isTow?'tow-failed':'rescue-failed',{title:isTow?t.towFailed:t.failedTitle,goal:isTow?t.towFailedBody:t.failedBody,body:[isTow?t.towFailedBody:t.failedBody],action:t.retry});
 if(isTow){
  const remaining=s.moorings.filter(v=>!v.cut).length,context=towContext(s),nearDock=s.bus.x>1180,dock=towDockStatus(s),assist=towAssistState(s);
  const phase=remaining?'tow-unmooring':s.dockLatched?(assist==='braking'?'tow-dock-braking':'tow-dock-aligning'):s.bus.x>1250?(s.connected?'tow-dock-manual':'tow-dock-coasting'):s.connected?'towing':'tow-disconnected';
  const goal=remaining===2?t.towGoalUnmoor:remaining===1?t.towGoalPivot:s.dockLatched?(assist==='braking'?t.towDockBraking:t.towGoalDockAssist):s.bus.x>1250?t.towGoalDockManual:!s.connected?t.towGoalConnect:s.layout==='full'&&s.bus.x<1210?(towFollowingFlow(s)&&s.power?t.towGoalFollowing:t.towGoalCross):t.towGoalTow;
  const spec=s.anchors.length===2?towCutPreview(s,[...s.anchors,s.boat]):null;
  const targets=spec?[...spec.moorings.map(id=>t[id==='bow'?'towBowLine':'towSternLine']),...(spec.winch?[t.towMergeWinch]:[])]:[];
  let hint=spec?(spec.valid?t.closeHint+' · '+t.towNetResult+': '+(targets.join(' + ')||t.towNetNone)+' · '+(spec.power?t.towNetPower:t.towNetPreserved):t.tooSmall):s.anchors.length?t.towTurnHint:context==='sluice'?(!s.power?t.towCurrentOff:s.flowProfile==='channel'?t[towFollowingFlow(s)?'towSwitchCross':'towSwitchFollowing']:t.towGateHint):s.connected?(!s.power&&nearDock?t.towCoastHint:s.crew.includes('engineer')?t.towSteeringJian:t.towSteeringJeongho):nearDock?t.towDetachedDockHint:remaining===0?t.towConnectHint:t.towNetHint;
  const dockChecks=nearDock?[['hull','towHullIn','towHullOut'],['heading','towHeadingIn','towHeadingOut'],['still','towStill',Math.abs(s.bus.omega)>=.12?'towRotating':'towMoving']].map(([id,a,b])=>({id,met:dock[id],text:t[dock[id]?a:b]})):[];
  const gateState=s.layout==='full'?t[!s.power?'towCurrentOff':towFollowingFlow(s)?'towFollowingState':s.flowProfile==='legacy'&&s.pumpDirection===-1?'towLegacyReverse':'towCrossState']:'';
  if(towFollowingFlow(s)&&s.power&&s.connected&&!s.anchors.length&&s.bus.y>680&&s.bus.y<870&&s.bus.x<720)hint=t.towFollowingExit;
  return fieldGuidance(s,out(phase,{gateState,title:t.towTitle,goal,hint,action:t['towAction'+context[0].toUpperCase()+context.slice(1)],dockChecks,preview:spec}),language);
 }
 const target=m.people.find(p=>p.state==='waiting'),aboard=m.people.some(p=>p.state==='aboard'),ready=aboard||m.target==='record'&&m.recoveredBox;
 const lifting=m.fields.flatMap(f=>f.life>0?f.people:[]).filter(id=>m.people.some(p=>p.id===id&&p.state==='waiting'));
 const goal=target?(target.id==='operator'?t.goalOperator:t.goalEngineer):recordAvailable?t.goalRecord:t.goalDock;
 const action=s.anchors.length?t.rescueCancelAction:t.rescueMoveAction;
 if(lifting.length)return out('rescue-lifting',{goal:fill(t.rescueLifting,{name:[...new Set(lifting)].map(id=>t[id]).join(', ')}),hint:t.rescueLiftingHint,action});
 if(ready&&dist(s.player,HARBOR.extraction)<HARBOR.extraction.r)return out('rescue-docking',{goal:t.rescueDocking,hint:t.rescueDockingHint,action:t.rescueHoldAction});
 if(s.anchors.length===2){
  const points=[...s.anchors,s.player],valid=triangleArea(...points)>=2200,preview=netTargets(s,points);
  const names=preview.people.map(p=>t[p.id]);
  const record=recordAvailable&&preview.kind==='cut'&&inTriangle(m.box,...points);
  const items=preview.kind==='rescue'?[t.rescue+' '+names.join(', '),...(preview.enemies.length?[fill(t.rescueBoundCount,{count:preview.enemies.length})]:[])]:[...(preview.enemies.length?[fill(t.rescueMachineCount,{count:preview.enemies.length})]:[]),...(preview.wrecks.length?[fill(t.rescueWreckCount,{count:preview.wrecks.length})]:[]),...(record?[t.rescueRecordTarget]:[])];
  const hint=!valid?t.rescueTooNarrow:items.length?t.closeHint+' · '+t.preview+': '+items.join(' · '):t.rescueEmptyPreview;
  return out('rescue-net-preview',{goal,hint,action,preview:{valid,items,record}});
 }
 if(s.anchors.length===1)return out('rescue-net-first',{goal,hint:t.turnHint,action});
 if(aboard&&m.repairPending>0)return out('rescue-boarding',{goal:t.goalRepair,hint:recordAvailable?t.homeRecordOption:t.homeHint,action});
 if(ready){
  const nearPlate=m.repairBoost&&m.wrecks.some(w=>w.heavy&&w.intact&&dist(s.player,{x:w.x+w.w/2,y:w.y+w.h/2})<230);
  if(nearPlate)return out('rescue-return-obstacle',{goal:t.goalReverse,hint:t.reverseHint,action:t.rescueReverseAction});
  if(m.target==='operator'&&s.player.y<760)return out('rescue-return-gate',{goal:t.goalGate,hint:recordAvailable?t.homeRecordOption:t.homeHint,action});
  return out('rescue-return',{goal:t.goalDock,hint:recordAvailable?t.homeRecordOption:t.homeHint,action});
 }
 if(recordAvailable&&m.target==='record')return out('legacy-record',{goal:t.goalRecord,hint:t.legacyRecordGuide,action:t.rescueDropAction});
 const context=guidance(s),hint=t[{travel:'travelHint',lift:'liftHint',winch:'winchHint',cutter:'cutterHint'}[context]]||t.travelHint;
 return out(context==='lift'?'rescue-approach':'rescue-travel',{goal,hint,action:context==='lift'?t.rescueDropAction:t.rescueMoveAction});
}

function contentGuidance(s,t,out){
 const def=towMission(s),k=def.textKeys,action=towAction(s),last=towTarget(s);
 const b=s.connected?last:towBody(s,action.bodyId)||(last!==s.bus&&bodyDock(s,last)&&!s.secured.includes(last.id)&&Math.hypot(last.x-s.boat.x,last.y-s.boat.y)<450?last:s.bus);
 const extra=b!==s.bus,remaining=bodyMoorings(s,b).filter(m=>!m.cut).length,berth=(bodyDock(s,b)||def.world).berth,nearDock=!!bodyDock(s,b)&&Math.hypot(b.x-(berth.x+berth.w/2),b.y-(berth.y+berth.h/2))<350,assist=towAssistState(s,b),dock=towDockStatus(s,b),latched=extra?s.cargoLatches[b.id]:s.dockLatched;
 const installed=(def.goalRequires||[]).every(id=>s.secured.includes(id)),held=s.temporaryMoorings.some(m=>m.bodyId==='bus');
 if(s.status==='won')return out('content-arrival',{title:t[k.arrival],goal:t.contentPeopleAshore,body:[[def.id==='landing'&&s.checkpoints.includes('landing-workers-installed')?t.landingWorkersOutcome:def.id==='landing'&&s.checkpoints.includes('landing-direct-installed')?t.landingDirectOutcome:t[k.outcome||'marketOutcome'],...storyOutcomeKeys(s).map(key=>t[key])].join(' '),t[k.record]],action:def.id==='landing'?t.chapterDone:t.missionBoard});
 const spec=s.anchors.length===2?towCutPreview(s,[...s.anchors,s.boat]):null,targets=spec?.moorings.map(id=>{const m=def.moorings.find(m=>m.id===id);return t[m.nameKey||(m.bodyId==='ice'?'marketIceLine':'marketPassengerLine')];})||[];
 let goal;
 if(held&&!extra)goal=def.manualSluice?t.sluiceHeld:t[installed?'landingHeldReady':'landingHeld'];
 else if(remaining)goal=t[k.unmoor||'marketUnmoor'];
 else if(!extra&&nearDock&&!installed)goal=t.landingMissing;
 else if(latched)goal=assist==='braking'?t.contentDockBraking:t.contentDockAligning;
 else if(nearDock)goal=t.towGoalDockManual;
 else if(s.connected)goal=extra?t[k.extraTow||'marketTowIce']:t[k.tow||'marketTowPassenger'];
 else goal=def.id==='landing'&&installed?t.landingReady:t[k.choose||'marketChoose'];
 const work=towWorkBenefits(s);let gateState=def.manualSluice?t[!s.power?'sluiceOff':s.pumpDirection===1?'sluiceDischargeState':'sluiceReliefState']:'';if(work.sluiceBypass)gateState=t.sluiceBypassReady;if(work.marketGenerator)gateState=t.marketAuxReady;if(work.landingCrew)gateState=t.landingCrewReady;else if(def.id==='landing'&&s.workProfile==='infrastructure')gateState=t[!s.power?'landingTransferOff':s.pumpDirection===1?'landingTransferCross':'landingTransferFollowing'];
 let hint;
 if(spec)hint=spec.valid?t.closeHint+' · '+t.towNetResult+': '+(targets.join(' + ')||t.towNetNone)+' · '+(spec.power?t[work.marketGenerator?'marketNetAux':work.landingCrew?'landingNetCrew':'towNetPower']:t.towNetPreserved):t.tooSmall;
 else if(s.anchors.length)hint=t.towTurnHint;
 else if(action.kind==='sluice')hint=def.manualSluice?t.sluiceControlHint:t.towGateHint;
 else if(action.kind==='unmoor')hint=t.contentReleaseHint;
 else if(held&&!extra)hint=def.manualSluice?t.sluiceHeldHint:t.landingGuide;
 else if(remaining)hint=t[k.cutHint||'marketCutHint'];
 else if(nearDock)hint=s.connected?t.contentCoastHint:t.contentDetachedHint;
 else if(extra)hint=t[k.extraHint||'marketIceHint'];
 else hint=s.connected?t[k.routeHint||'marketRouteHint']:t.towConnectHint;
 if(!spec&&!s.anchors.length&&s.workProfile==='infrastructure'){if(work.sluiceBypass&&s.connected&&!nearDock)hint=t.sluiceBypassHint;if(work.landingCrew&&extra&&!nearDock)hint=t.landingCrewHint;if(work.marketGenerator&&s.connected&&!extra&&!nearDock)hint=t.marketAuxHint;}
 if(def.id==='landing'&&s.workProfile==='infrastructure'&&!spec&&!s.anchors.length){if(action.kind==='sluice')hint=t.landingTransferControl;else if(s.connected&&!nearDock&&s.power&&s.pumpDirection===1&&!remaining)hint=t.landingTransferHint;}
 const checks=nearDock?[['hull','towHullIn','towHullOut'],['heading','towHeadingIn','towHeadingOut'],['still','towStill',Math.abs(b.omega)>=.12?'towRotating':'towMoving']].map(([id,a,b])=>({id,met:dock[id],text:t[dock[id]?a:b]})):[];
 if(nearDock&&!extra&&def.goalRequires?.length)checks.push({id:'landing',met:installed,text:t[installed?'landingCheckReady':'landingCheckMissing']});
 return out(def.id+'-'+(remaining?'unmooring':s.connected?'towing':'disconnected'),{title:t[k.title],goal,hint,action:action.kind==='sluice'&&def.manualSluice?t[s.power?'sluiceAction':'sluiceActionUnpowered']:t['towAction'+action.kind[0].toUpperCase()+action.kind.slice(1)],dockChecks:checks,manual:contentManual(t,def),preview:spec,gateState,focusBodyId:extra?b.id:'bus'});
}
function contentManual(t,def){const k=def.textKeys;return [t[k.guide||'marketRouteGuide'],t[k.cutHint||'marketCutHint'],t.towGuide[1],t.towGuide[2],t.contentInertiaGuide,t.contentTowGuide,def.manualSluice?t.sluiceControlGuide:t.towGuide[5],t.towGuide[6],t.towGuide[7]];}

export function missionGuidance(options={}){
 const s=options.state,base=baseGuidance(options),g=!options.screen||options.screen==='play'?dockingGuidance(s,expeditionGuidance(s,base,options.language,options.detour),options.language):base;
 if(s?.kind==='tow')return {...g,manual:[...g.manual,options.language==='en'?'Hold C with movement for 35% throttle. Cargo and currents keep moving; fuel still burns. C overrides Shift; Space keeps emergency reverse.':'이동하면서 C를 누르면 추진 속도가 35%로 낮아집니다. 끌고 있는 배의 관성과 해류는 남고 연료도 소모됩니다. C는 Shift보다 우선하며 Space 긴급 후진은 그대로 작동합니다.'],pilot:piloting(s,{precision:options.precision===true&&(!options.screen||options.screen==='play')},options.language)};
 if(!s||s.status!=='playing'||options.screen&&options.screen!=='play')return g;
 const en=options.language==='en',ready=s.mission.people.some(p=>p.state==='aboard'),target=s.mission.people.find(p=>p.state==='waiting');
 const p=ready?HARBOR.extraction:target;
 if(!p)return g;
 return {...g,learningStage:ready?'rescue-home':'rescue-person',waypoint:{x:p.x,y:p.y,label:ready?(en?'Home berth · Stop here':'귀항 부두 · 멈춰서 내리기'):(en?'Q · Enclose the person':'Q · 사람을 부표로 감싸기'),kind:ready?'berth':'person'}};
}
