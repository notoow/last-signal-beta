import {random} from './rogue-map-v1.js';
const names={service:['폐선 수리장','Salvage yard'],cargo:['화물 하역장','Cargo wharf'],shelter:['피난 나루','Refuge landing']};
const legacy={ko:['폐선 수리장','연료 하역장','어시장 나루'],en:['Salvage yard','Fuel wharf','Fish-market landing']};
export function layoutOrder(seed,depth){
 const rng=random((seed^Math.imul(depth+1,0x9e3779b9)^0x715a4e31)>>>0),kinds=['service','cargo','shelter'];
 for(let i=kinds.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
 return kinds;
}
// Display callers must still gate undiscovered sites. Receipts use event depth,
// so previous-region names need neither current map nor terrain regeneration.
export function shoreSiteName(s,site,language='ko',depth=s.depth){
 site=typeof site==='number'?site:site.island;
 if(!Number.isInteger(site)||site<0||site>2)throw Error('Invalid site');
 return s.generator>=9?names[layoutOrder(s.seed,depth)[site]][language==='en'?1:0]:legacy[language==='en'?'en':'ko'][site];
}

export const ALL_SHORE_NAMES=[...new Set([...legacy.ko,...Object.values(names).map(n=>n[0])])];
export const SHORE_NAME_TRANSLATIONS=Object.fromEntries(Object.values(names));
