const legacy=Object.freeze({net:Object.freeze({x:2110,y:500}),debris:Object.freeze({x:2070,y:350}),testSite:Object.freeze({x:2080,y:190})});
export function harborLandmark(map,id){if(!Object.hasOwn(legacy,id))throw Error('Unknown harbor landmark');return map.landmarks?.[id]??legacy[id];}
// The compact generator translates the complete boss arena without scaling it.
// Earlier saved generators have no offset and retain their original coordinates.
export const harborArenaX=(s,x)=>x+(s?.map?.arenaShiftX||0);
export const harborArenaPoint=(s,p)=>p?{...p,x:harborArenaX(s,p.x)}:p;
