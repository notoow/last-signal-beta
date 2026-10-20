// Rewards are derived from validated progress: no currency, timers, or duplicate grants.
export const MEMORY_CARDS=Object.freeze([
 {id:'engineer',art:'jian',title:'memoryJian',requirement:'memoryNeedJian'},
 {id:'operator',art:'jeongho',title:'memoryJeongho',requirement:'memoryNeedJeongho'},
 {id:'bus07',art:'homecoming',title:'memoryBus',requirement:'memoryNeedBus'},
 {id:'market',art:'market',title:'memoryMarket',requirement:'memoryNeedMarket'},
 {id:'sluice',art:'sluice',title:'memorySluice',requirement:'memoryNeedSluice'},
 {id:'landing',art:'landing',title:'memoryLanding',requirement:'memoryNeedLanding'}
].map(Object.freeze));
export function memories(campaign){return MEMORY_CARDS.map(c=>({...c,earned:c.id==='engineer'||c.id==='operator'?campaign.crew.includes(c.id):(campaign.progress[c.id]?.completions||0)>0,clean:campaign.progress[c.id]?.bestCleanTime!=null}));}
export function earnedMemories(before,after){const old=new Set(memories(before).filter(c=>c.earned).map(c=>c.id));return memories(after).filter(c=>c.earned&&!old.has(c.id));}
export function voyageMilestones(s){
 if(!s)return [];
 if(s.kind==='tow')return [
  ['rewardFirstCut',s.moorings.some(m=>m.cut)],
  ['rewardFreed',s.moorings.every(m=>m.cut)],
  ['rewardConnected',s.metrics.connects>0],
  ['rewardMoored',s.metrics.temporaryMoorings>0],
  ['rewardInstalled',s.secured.length>0]
 ].filter(([,done])=>done).map(([key])=>key);
 return [
  ['rewardNet',s.circuits>0],
  ['rewardPath',s.mission.clearedWrecks>0],
  ['rewardAboard',s.mission.people.some(p=>['aboard','rescued'].includes(p.state))]
 ].filter(([,done])=>done).map(([key])=>key);
}
export function createRewardTracker(s){return new Set(voyageMilestones(s));}
export function collectVoyageRewards(tracker,s){const fresh=voyageMilestones(s).filter(k=>!tracker.has(k));fresh.forEach(k=>tracker.add(k));return fresh;}
