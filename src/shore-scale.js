// 72-world-unit working tug = 15 metres. Ground physics and rendered actors
// share this scale on the new quay profile; underway older saves retain theirs.
export const WORLD_UNITS_PER_METRE=4.8;
export const CREW_HEIGHT=1.7*WORLD_UNITS_PER_METRE;
export const HUMAN_SCALE=CREW_HEIGHT/55;
export const humanShore=s=>s.generator>=4||(s.generator===undefined&&s.version>=4&&Array.isArray(s.tiles));
export const shoreScale=s=>humanShore(s)?HUMAN_SCALE:1;
// Readable SD artwork: visual size only, never collision or interaction range.
export const humanVisualScale=s=>humanShore(s)?40/25.5:1;
export const crewRadius=s=>humanShore(s)?.22*WORLD_UNITS_PER_METRE:9;
const METRE_RANGES=Object.freeze({search:1.3*WORLD_UNITS_PER_METRE,boarding:1.5*WORLD_UNITS_PER_METRE});
const LEGACY_RANGES=Object.freeze({search:32,boarding:36});
export const shoreRanges=s=>humanShore(s)?METRE_RANGES:LEGACY_RANGES;
// Locomotion tempo follows the readable SD actors, independently of foot scale.
export const crewSpeed=(s,sprint=false)=>humanShore(s)?(sprint?12:9)*WORLD_UNITS_PER_METRE:sprint?100:58;
// The mobile stick already has a radial deadzone. Small intentional drags should
// walk rather than crawl; keyboard/full deflection and legacy runs stay bounded.
export const crewEffort=(s,magnitude)=>humanShore(s)?Math.sqrt(Math.min(1,Math.max(0,magnitude))):Math.min(1,Math.max(0,magnitude));
