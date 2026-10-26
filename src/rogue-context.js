import {berthReadiness,shoreSearchStatus,bossLinkCandidate} from './rogue-core.js';
import {rescueStatus} from './shore-rescue.js';
import {visibleAt,visibleSurvey,surveyedAt,surveyGrid,newSurvey} from './rogue-vision.js';
import {campStatus} from './voyage-daylight.js';
import {shoreRanges} from './shore-scale.js';
import {salvageStatus,winchBurstReady,winchStoreReady,winchLaunchReady} from './rogue-salvage.js';
import {usesSluice} from './sluice-counterplay.js';
import {usesLighthouse} from './lighthouse-counterplay.js';
import {harborDestination,rigRecoveryBerth,knownBerth} from './harbor-plan.js';
import {gullRecovery,gullHornStatus} from './shore-encounters.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const action=(id,code,labelKo,labelEn,enabled=true,hold=false,progress=0)=>({id,code,labelKo,labelEn,enabled,hold,progress});
// One persistent control slot. Its label changes with the action the same B
// input will perform, while real water/charge and expiry stay visible.
export function rogueSpecialAction(s){
  if(!s||s.status!=='playing'||s.mode!=='sailing'||s.pendingGear||s.pendingCache||s.salvage?.pending||s.build==='standard')return null;
  const rig=salvageStatus(s),m=s.salvage;
  const make=(phase,ko,en,enabled,value,labelKo,labelEn,threshold,detailKo,detailEn)=>({
    ...action('build','KeyB',ko,en,enabled),phase,build:s.build,detailKo,detailEn,
    meter:{value,max:100,threshold,labelKo,labelEn},
    storedSeconds:s.build==='winch'&&s.boss.hook<0?m?.window||0:0,
    cooldown:m?.cooldown||0
  });
  if(s.build==='bilge'){
    const installed=!!m?.rank,jet=s.valve&&rig.phase==='ready';
    const phase=jet?'jet':s.valve?'close':'open';
    const detail=!installed?(rigRecoveryBerth(s)?['분사 장치 미장착 · M 해도','Jet rig missing · M Chart']:['기본 밸브만 사용 · 분사 장치 없음','Intake only · no jet rig']):
      !s.valve?['물을 받으면 추진력 증가','Fill for stronger thrust']:
      jet?['앞으로 분사 · 연료 2','Forward jet · 2 fuel']:
      s.flood<20?['침수 20%에서 분사 가능','Jet needs 20% water']:
      rig.phase==='cooldown'?[`분사 재사용 ${m.cooldown.toFixed(1)}초`,`Jet cooldown ${m.cooldown.toFixed(1)}s`]:
      rig.phase==='fuel'?['분사 연료 2 초과 필요','Jet needs >2 fuel']:
      rig.phase==='skill'?['선장 기술 종료 후 분사','Jet after captain skill']:['밸브를 닫으면 침수 정지','Close to stop filling'];
    return make(phase,jet?'배수 분사':s.valve?'밸브 닫기':'밸브 열기',jet?'Water jet':s.valve?'Close valve':'Open valve',true,s.flood,'침수','Flood',installed?20:null,...detail);
  }
  if(s.boss.hook<0){
    if(!m?.rank)return make('hook','축력 당김','Winch pull',false,s.charge,'축력','Charge',35,
      '고리 연결 후 당김 · 저장 장치 미장착','Hook to pull · storage rig missing');
    const ready=winchLaunchReady(s),stored=(m?.charge||0)>=35&&(m?.window||0)>0;
    const detail=ready?['저장한 줄 방향으로 발진 · 연료 2','Launch along stored line · 2 fuel']:
      stored&&rig.phase==='fuel'?['연료 2 초과 필요','Needs >2 fuel']:
      stored&&rig.phase==='skill'?['선장 기술 종료 대기','Wait for captain skill']:
      rig.phase==='cooldown'?[`재사용 ${m.cooldown.toFixed(1)}초`,`Cooldown ${m.cooldown.toFixed(1)}s`]:
      ['고리 연결 → 당겨 축력 모으기','Hook a drive, then pull to charge'];
    return make(ready?'launch':stored?'blocked':'hook','저장 발진','Stored launch',ready,m?.charge||0,'저장 축력','Stored charge',35,...detail);
  }
  const launch=usesSluice(s)||usesLighthouse(s),ready=winchBurstReady(s);
  const detail=ready?launch?['줄을 놓고 발진 · 연료 3','Release and launch · 3 fuel']:
    s.fuel<=3?['구동부 당김 · 남은 연료 소진','Pull drive · spends remaining fuel']:['구동부 당김 · 연료 3','Pull drive · 3 fuel']:
    launch&&s.fuel<=3?['연료 3 초과 필요','Needs >3 fuel']:
    !launch&&s.boss.phase!=='recover'?['고리 노출 대기','Wait for drive exposure']:
    s.boss.tension<=.1?['줄을 더 팽팽하게 당기기','Pull the line taut']:['축력 35에서 사용','Needs 35 charge'];
  return make(ready?(launch?'burst':'pull'):'charge',launch?'줄 놓고 발진':'축력 당김',launch?'Release launch':'Winch pull',ready,s.charge,'축력','Line charge',35,...detail);
}
// Read-only affordances. Inputs still pass through interact/tickRun; no UI can
// award an item, snap a hull, reveal an enemy, or suppress the attack control.
export function rogueContextActions(s){
  const result={primary:null,secondary:[],transit:[],response:null,attack:null,special:rogueSpecialAction(s)};
  if(!s||s.status!=='playing'||s.pendingGear||s.pendingCache||s.salvage?.pending)return result;
  const horn=s.mode==='sailing'&&!s.person?gullHornStatus(s):null;
  if(horn)result.response={...action('horn','KeyQ','경적','Horn'),amount:horn.amount,count:horn.count};
  if(s.person){
    result.attack=action('attack','Space','공격','Attack',true,true);
    const b=s.map.berths.find(b=>b.id===s.mooring),search=shoreSearchStatus(s),rescue=rescueStatus(s),scrap=gullRecovery(s);
    if(scrap)result.primary=action('scrap','KeyF','고철 회수','Recover scrap',scrap.available);
    else if(search?.berth){
      result.primary=action('search','KeyF',search.choiceMode?'수색':'보급 회수',search.choiceMode?'Search':'Supplies',!['choice','hit'].includes(search.blocked),true,search.progress/search.required);
      if(!search.choiceMode)result.secondary.push(action('equipment','KeyR','장비 회수','Equipment',result.primary.enabled,true,result.primary.progress));
    }
    if(b&&distance(s.person,b.landing)<shoreRanges(s).boarding){
      const together=rescue?.ready,alone=rescue?.active&&rescue.discovered;
      const board=action('board','KeyE',together?'함께 승선':alone?'혼자 승선':'승선',together?'Board together':alone?'Board alone':'Board');
      result.transit.push(board);
    }
    if(rescue?.near&&!rescue.boarding&&!result.transit.length){
      const escort=action('rescue','KeyE',rescue.stage==='following'?'기다려':'따라와',rescue.stage==='following'?'Wait':'Follow');
      if(result.primary)result.secondary.push(escort);else result.primary=escort;
    }
    return result;
  }
  if(s.mode==='moored'){
    result.transit.push(action('land','KeyE','하선','Go ashore'),action('unmoor','KeyQ','출항','Cast off'));
    const camp=campStatus(s);
    if(camp?.night){
      const reasons={ready:['아침까지 휴식 · 연료 8 · 선원 체력 +15','Rest until dawn · 8 fuel · crew +15'],resting:['난로 준비 중 · 출항하면 취소','Lighting stove · casting off cancels'],spent:['이 부두에서는 이미 쉬었습니다','Already rested at this quay'],danger:['위험이 가까워 쉴 수 없습니다','Danger nearby'],fuel:['휴식 연료가 부족합니다','Not enough fuel to rest'],choice:['선택을 먼저 마치세요','Finish the current choice']};
      const [detailKo,detailEn]=reasons[camp.reason]||reasons.ready;
      result.transit.push({...action('rest','KeyL',camp.reason==='resting'?'난로 준비':'휴식 −8',camp.reason==='resting'?'Lighting stove':'Rest −8',camp.available,false,camp.progress),detailKo,detailEn,reason:camp.reason});
    }
    return result;
  }
  if(s.boss.hook>=0){
    const store=winchStoreReady(s);
    result.primary=action('unhook','KeyE',store?'놓고 축력 저장':'줄 풀기',store?'Release & store':'Release line');return result;
  }
  if(bossLinkCandidate(s)>=0){result.primary=action('link','KeyE',s.depth===2?'중계기 연결':'고리 연결',s.depth===2?'Link relay':'Hook drive');return result;}
  const b=[...s.map.berths,...(s.boss.cleared?[s.map.exit]:[])].filter(b=>visibleAt(s,b)).sort((a,b)=>distance(s.boat,a)-distance(s.boat,b))[0];
  if(b){const ready=berthReadiness(s,b);if(ready.near)result.primary=action('moor','KeyE',b===s.map.exit?'탈출 접안':'접안',b===s.map.exit?'Exit berth':'Moor',ready.ready);}
  return result;
}
export function rogueMinimap(s){
  if(!s)return null;
  const grid=surveyGrid(s.map);
  const known=p=>s.harborIntel?knownBerth(s,p):surveyedAt(s,p);
  const player=s.person||s.boat,rescue=rescueStatus(s),destination=harborDestination(s);
  // Send remembered terrain, not a complete map hidden only by a paint layer.
  // Current sight still controls actors; leaving a cell never erases its land.
  const tiles=s.map.tiles?.map((tile,i)=>!s.survey||surveyedAt(s,{
    x:(i%s.map.cols+.5)*s.map.width/s.map.cols,
    y:(Math.floor(i/s.map.cols)+.5)*s.map.height/s.map.rows
  })?tile:0)||[];
  return {width:s.map.width,height:s.map.height,cols:s.map.cols,rows:s.map.rows,tiles,
    islands:s.map.tiles?[]:s.map.islands.map(p=>({x:p.x,y:p.y,w:p.w,h:p.h})),mode:s.mode,
    target:destination?{x:destination.point.x,y:destination.point.y}:null,
    survey:s.survey?(s.survey.length===grid.cols*grid.rows?s.survey.slice():newSurvey(s.map)):null,visible:visibleSurvey(s),surveyCols:grid.cols,surveyCell:grid.cell,
    player:{x:player.x,y:player.y,angle:player.angle},boat:{x:s.boat.x,y:s.boat.y},
    berths:s.map.berths.filter(known).map(b=>({x:b.x,y:b.y,claimed:s.claimed.includes(b.id)})),
    rescue:rescue?.active&&rescue.discovered&&visibleAt(s,rescue.point)?{x:rescue.point.x,y:rescue.point.y,stage:rescue.stage,blocked:rescue.blocked}:null,
    stashes:s.combat?.enemies.filter(e=>e.kind==='gull'&&e.stash>0&&visibleAt(s,{x:e.homeX,y:e.homeY})).map(e=>({x:e.homeX,y:e.homeY,amount:e.stash}))||[],
    enemies:s.combat?.enemies.filter(e=>e.hp>0&&visibleAt(s,e)).map(e=>({x:e.x,y:e.y,kind:e.kind,asleep:!!e.asleep}))||[]};
}
