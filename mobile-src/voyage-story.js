// Narrative reads physical state. It never changes objectives, physics or rewards.
export const STORY_RADIO_BY_MISSION=Object.freeze({
 bus07:['storyBusInner','storyBusOuter','storyBusDark'],
 market:['storyMarketGenerator','storyMarketDark','storyMarketReleased'],
 sluice:['storySluiceBypass','storySluiceDark','storySluiceDischarge'],
 landing:['storyLandingPassengers','storyLandingPontoon','storyLandingWorkers','storyLandingAlone']
});
export const STORY_RADIO_IDS=Object.values(STORY_RADIO_BY_MISSION).flat();
const has=(s,id)=>s.mission.radioLog.some(e=>e.id===id);
const moored=(s,bodyId,stationId)=>s.workProfile==='infrastructure'&&s.temporaryMoorings.some(m=>m.bodyId===bodyId&&m.stationId===stationId);
export function storyRadioRelevant(s,id){
 if(!STORY_RADIO_IDS.includes(id))return true;
 if(s?.kind!=='tow'||s.status!=='playing'||!STORY_RADIO_BY_MISSION[s.missionId].includes(id))return false;
 const generator=moored(s,'ice','ice-pocket');
 const conditions={
  storyBusInner:s.route==='inner',storyBusOuter:s.route==='outer',storyBusDark:!s.power,
  storyMarketGenerator:generator,storyMarketDark:!s.power&&!generator,storyMarketReleased:!s.power&&!generator,
  storySluiceBypass:s.bypassOpen,storySluiceDark:!s.power,storySluiceDischarge:s.power&&s.pumpDirection===1&&!s.bypassOpen,
  storyLandingPassengers:!s.secured.includes('pontoon')&&s.connected&&s.connectedBodyId==='bus',
  storyLandingPontoon:!s.secured.includes('pontoon')&&s.connected&&s.connectedBodyId==='pontoon',
  storyLandingWorkers:s.checkpoints.includes('landing-workers-installed'),storyLandingAlone:s.checkpoints.includes('landing-direct-installed')
 };
 return !!conditions[id];
}
export function nextStoryRadio(s){
 if(s?.kind!=='tow'||s.status!=='playing'||s.time<8||s.voyage?.phase==='refit')return null;
 const recent=s.mission.radioLog.filter(e=>STORY_RADIO_IDS.includes(e.id));
 if(recent.length&&s.time-recent.at(-1).time<14)return null;
 const unheard=(id,condition)=>condition&&!has(s,id)?id:null;
 if(s.missionId==='bus07')return unheard('storyBusDark',!s.power)||
  unheard('storyBusInner',s.route==='inner'&&!has(s,'storyBusOuter'))||unheard('storyBusOuter',s.route==='outer'&&!has(s,'storyBusInner'));
 if(s.missionId==='market'){
  const generator=moored(s,'ice','ice-pocket');
  return unheard('storyMarketReleased',!s.power&&!generator&&has(s,'storyMarketGenerator'))||
   unheard('storyMarketGenerator',generator)||unheard('storyMarketDark',!s.power&&!generator&&!has(s,'storyMarketReleased'));
 }
 if(s.missionId==='sluice')return unheard('storySluiceDark',!s.power)||
  unheard('storySluiceBypass',s.bypassOpen)||
  unheard('storySluiceDischarge',s.power&&s.pumpDirection===1&&s.connected&&s.connectedBodyId==='bus'&&s.route!=='unselected'&&!s.bypassOpen);
 if(s.missionId==='landing'){
  if(s.secured.includes('pontoon'))return unheard('storyLandingWorkers',s.checkpoints.includes('landing-workers-installed'))||unheard('storyLandingAlone',s.checkpoints.includes('landing-direct-installed'));
  if(has(s,'storyLandingPassengers')||has(s,'storyLandingPontoon'))return null;
  return unheard('storyLandingPassengers',s.connected&&s.connectedBodyId==='bus')||unheard('storyLandingPontoon',s.connected&&s.connectedBodyId==='pontoon');
 }
 return null;
}
// Outcome must remain correct even if a busy radio prevented the optional line.
export function storyOutcomeKeys(s){
 if(s?.kind!=='tow'||s.status!=='won')return [];
 if(s.missionId==='bus07')return [...(s.route==='outer'?['storyResultBusOuter']:s.route==='inner'?['storyResultBusInner']:[]),s.power?'storyResultPowered':'storyResultManual'];
 if(s.missionId==='market')return [moored(s,'ice','ice-pocket')?'storyResultMarketGenerator':!s.power?'storyResultMarketManual':'storyResultMarketMain'];
 if(s.missionId==='sluice')return [s.bypassOpen?'storyResultSluiceOpen':'storyResultSluiceClosed',s.power?'storyResultPowered':'storyResultManual'];
 if(s.missionId==='landing')return [s.power?'storyResultLandingLit':'storyResultLandingDark'];
 return [];
}
