// 72-world-unit working tug = 15 metres. Ground physics and rendered actors
// share this scale on the new quay profile; underway older saves retain theirs.
export const WORLD_UNITS_PER_METRE=4.8;
export const CREW_HEIGHT=1.7*WORLD_UNITS_PER_METRE;
export const HUMAN_SCALE=CREW_HEIGHT/55;
export const humanShore=s=>s.generator===4||(s.generator===undefined&&s.version===4&&Array.isArray(s.tiles));
export const shoreScale=s=>humanShore(s)?HUMAN_SCALE:1;
export const crewRadius=s=>humanShore(s)?.22*WORLD_UNITS_PER_METRE:9;
const METRE_RANGES=Object.freeze({search:1.3*WORLD_UNITS_PER_METRE,boarding:1.5*WORLD_UNITS_PER_METRE});
const LEGACY_RANGES=Object.freeze({search:32,boarding:36});
export const shoreRanges=s=>humanShore(s)?METRE_RANGES:LEGACY_RANGES;
export const crewSpeed=(s,sprint=false)=>humanShore(s)?(sprint?3.5:2.2)*WORLD_UNITS_PER_METRE:sprint?100:58;
