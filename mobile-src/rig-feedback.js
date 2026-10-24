// Resolved machinery actions, kept outside saves. Rendering and restoring a
// voyage cannot manufacture or replay a successful action.
const actions=new WeakMap();
const cues={
  'winch-pull':'anchor','winch-store':'connect','winch-launch':'dash',
  'line-launch':'dash','bilge-jet':'dash','brake-launch':'dash',
  'valve-open':'circuit','valve-close':'circuit'
};
const point=p=>Object.freeze({x:p.x,y:p.y});
export function publishRigAction(s,result){
  if(!s?.boat||!Object.hasOwn(cues,result.kind))return;
  const previous=actions.get(s),id=(previous?.id??0)+1;
  const event={...result,id,time:s.time,depth:s.depth,build:s.build,point:point(s.boat),
    life:result.kind.startsWith('valve-')?1:1.6};
  if(result.vector)event.vector=point(result.vector);
  if(result.partPoint)event.partPoint=point(result.partPoint);
  actions.set(s,{id,event:Object.freeze(event)});
}
export const rigActionSequence=s=>actions.get(s)?.id??0;
export function clearRigAction(s){
  const current=actions.get(s);if(current)actions.set(s,{id:current.id,event:null});
}
export function recentRigAction(s){
  const event=actions.get(s)?.event,age=event?s.time-event.time:Infinity;
  return event&&s.status==='playing'&&s.mode==='sailing'&&event.depth===s.depth&&age>=0&&age<event.life?
    Object.freeze({...event,age}):null;
}
// Caller captures the sequence before a real input/tick and asks once after it.
// The input's sound is therefore not replayed by the following render tick.
export function rigActionCue(s,previous){
  const event=recentRigAction(s);return event&&event.id>previous?cues[event.kind]:null;
}
