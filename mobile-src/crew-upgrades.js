// Run-scoped disciplines. Legacy saves retain their original offers/effects.
export const CREW_MODEL='disciplines-v1';
export const CREW_RULES=Object.freeze({breakerCooldown:6,quietNotice:.7,ammoCapacity:12});
export const CREW_UPGRADES=Object.freeze({
 grip:{name:'강철 손아귀',en:'Iron grip',step:8,limit:3},
 shot:{name:'고철 탄띠',en:'Scrap bandolier',step:4,limit:3},
 stride:{name:'갑판 발놀림',en:'Deck footwork',step:12,limit:3},
 guard:{name:'충격 안감',en:'Padded vest',step:15,limit:3}
});
export const crewRank=(s,id)=>s.crewUpgrades?.filter(x=>x===id).length||0;
export function crewEffects(s){
 const grip=crewRank(s,'grip'),shot=crewRank(s,'shot'),stride=crewRank(s,'stride'),modern=s.crewModel===CREW_MODEL;
 return {melee:24+grip*8,speed:1+stride*.12,damage:1-crewRank(s,'guard')*.15,
  ranged:20+(modern?shot*4:0),meleeArc:modern&&grip>=2?1.35:1,
  breakGuard:modern&&grip===3,pierce:modern&&shot>=2?1:0,
  killRefund:modern&&shot===3?1:0,quietWalk:modern&&stride>=2,
  ambush:modern&&stride===3?1.75:1};
}
function legacyOffer(s,site){
 const ids=['grip','stride','guard'],roll=(s.seed+Math.imul(s.depth+1,31)+site*17)>>>0;
 const learned=ids.filter(id=>crewRank(s,id)>0&&crewRank(s,id)<3).sort((a,b)=>crewRank(s,b)-crewRank(s,a));
 return learned[0]||ids.map((_,i)=>ids[(roll+i)%ids.length]).find(id=>crewRank(s,id)<3)||null;
}
export function crewOffers(s,site){
 if(!Array.isArray(s.crewUpgrades))return [];
 if(s.crewModel!==CREW_MODEL){const id=legacyOffer(s,site);return id?[id]:[];}
 const learned=Object.keys(CREW_UPGRADES).filter(id=>crewRank(s,id)>0&&crewRank(s,id)<3)
  .sort((a,b)=>crewRank(s,b)-crewRank(s,a));
 return [...new Set([...learned,'grip','shot','stride'])].filter(id=>crewRank(s,id)<3).slice(0,3);
}
export const crewOffer=(s,site)=>crewOffers(s,site)[0]||null;
export function noticeRadius(s,enemy,spec,input={}){
 // Quiet steps help approach an unaware animal; they never erase pursuit.
 const quiet=crewEffects(s).quietWalk&&s.person&&!enemy.alert&&!input.boost&&!(s.noise?.left>0);
 return spec.notice*(quiet?CREW_RULES.quietNotice:1);
}
export function crewCurrentStat(s,id){
 if(!Object.hasOwn(CREW_UPGRADES,id)||id==='shot'&&s.crewModel!==CREW_MODEL)return null;
 const fx=crewEffects(s),key={grip:'meleeDamage',shot:'rangedDamage',stride:'speedBonus',guard:'damageReduction'}[id];
 const value=id==='grip'?fx.melee:id==='shot'?fx.ranged:id==='stride'?(fx.speed-1)*100:(1-fx.damage)*100;
 return {key,value:+value.toFixed(2),unit:['grip','shot'].includes(id)?'':'%'};
}
export function crewUpgradePreview(s,id){
 if(!Object.hasOwn(CREW_UPGRADES,id)||!Array.isArray(s.crewUpgrades)||id==='shot'&&s.crewModel!==CREW_MODEL)return null;
 const rank=crewRank(s,id);if(rank>=3)return null;
 const before=crewEffects(s),after=crewEffects({...s,crewUpgrades:[...s.crewUpgrades,id]});
 const stat=crewCurrentStat(s,id),nextStat=crewCurrentStat({...s,crewUpgrades:[...s.crewUpgrades,id]},id);
 const unlocks=[];
 if(after.meleeArc>before.meleeArc)unlocks.push({id:'wideSwing',value:after.meleeArc/before.meleeArc,conditions:['melee']});
 if(after.breakGuard&&!before.breakGuard)unlocks.push({id:'guardBreak',value:CREW_RULES.breakerCooldown,conditions:['melee','crabWarning','cooldownReady']});
 if(after.pierce>before.pierce)unlocks.push({id:'pierce',value:after.pierce,conditions:['ranged','wallsBlock','uniqueTargets']});
 if(after.killRefund>before.killRefund)unlocks.push({id:'killRefund',value:after.killRefund,conditions:['rangedKill','ammoCapacity12']});
 if(after.quietWalk&&!before.quietWalk)unlocks.push({id:'quietWalk',value:CREW_RULES.quietNotice,conditions:['unalerted','notSprinting','notNoisy']});
 if(after.ambush>before.ambush)unlocks.push({id:'ambush',value:after.ambush,conditions:['unalertedAtLaunch']});
 return {rank,nextRank:rank+1,stat:{key:stat.key,before:stat.value,after:nextStat.value,unit:stat.unit},unlocks};
}
export function validCrewUpgrades(s){
 const modern=s.crewModel===CREW_MODEL;
 return s.crewUpgrades===null||Array.isArray(s.crewUpgrades)&&s.crewUpgrades.length<=(modern?12:9)&&
  s.crewUpgrades.every(id=>Object.hasOwn(CREW_UPGRADES,id)&&(modern||id!=='shot'))&&
  Object.keys(CREW_UPGRADES).every(id=>crewRank(s,id)<=3);
}
// Attack-local rules: no cooldown or enemy-state mutation happens in previews.
export function attackModifiers(s,{kind,enemyKind,phase,alert,asleep}){
 const fx=crewEffects(s),ambush=asleep||!alert;
 return {damage:(kind==='melee'?fx.melee:fx.ranged)*(ambush?fx.ambush:1),
  breakGuard:kind==='melee'&&enemyKind==='crab'&&phase==='warn'&&fx.breakGuard&&(s.combat?.breakerCooldown??0)<=0,
  pierce:kind==='ranged'?fx.pierce:0,refund:kind==='ranged'?fx.killRefund:0};
}
