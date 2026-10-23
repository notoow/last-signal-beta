// Voyage-only equipment worn by the person. No account-level power or rerolls.
export const CREW_UPGRADES=Object.freeze({
  grip:{name:'강철 손아귀',en:'Iron grip',step:8,limit:3},
  stride:{name:'갑판 발놀림',en:'Deck footwork',step:12,limit:3},
  guard:{name:'충격 안감',en:'Padded vest',step:15,limit:3}
});
export const crewRank=(s,id)=>s.crewUpgrades?.filter(x=>x===id).length||0;
export const crewEffects=s=>({melee:24+crewRank(s,'grip')*8,speed:1+crewRank(s,'stride')*.12,
  damage:1-crewRank(s,'guard')*.15});
export function crewOffer(s,site){
  if(!Array.isArray(s.crewUpgrades))return null;
  const ids=Object.keys(CREW_UPGRADES),roll=(s.seed+Math.imul(s.depth+1,31)+site*17)>>>0;
  // A learned discipline returns at later caches, allowing a committed build.
  const learned=ids.filter(id=>crewRank(s,id)>0&&crewRank(s,id)<3).sort((a,b)=>crewRank(s,b)-crewRank(s,a));
  return learned[0]||ids.map((_,i)=>ids[(roll+i)%ids.length]).find(id=>crewRank(s,id)<3)||null;
}
export function validCrewUpgrades(s){
  return s.crewUpgrades===null||Array.isArray(s.crewUpgrades)&&s.crewUpgrades.length<=9&&
    s.crewUpgrades.every(id=>Object.hasOwn(CREW_UPGRADES,id))&&Object.keys(CREW_UPGRADES).every(id=>crewRank(s,id)<=3);
}
