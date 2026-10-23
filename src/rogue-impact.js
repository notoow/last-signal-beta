// Short-lived receipts of resolved losses. Never serialize these or reconstruct
// them from a voyage log: loading a save must not play an old hit again.
const impacts=new WeakMap();
const LIFE=2.2;
export function publishImpact(s,{target,source,amount,remaining,contact=null}){
  if(!Number.isFinite(amount)||amount<=0)return;
  const p=target==='crew'?s.person:s.boat;
  if(!p)return;
  const id=(impacts.get(s)?.id??0)+1;
  impacts.set(s,Object.freeze({id,time:s.time,depth:s.depth,target,source,contact,amount,remaining,
    point:Object.freeze({x:p.x,y:p.y})}));
}
export const impactSequence=s=>impacts.get(s)?.id??0;
export function recentImpact(s){
  const hit=impacts.get(s),age=hit?s.time-hit.time:Infinity;
  return hit&&hit.depth===s.depth&&age>=0&&age<LIFE?Object.freeze({...hit,age,life:LIFE}):null;
}
