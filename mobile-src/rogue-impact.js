// Short-lived receipts of resolved losses. Never serialize these or reconstruct
// them from a voyage log: loading a save must not play an old hit again.
const impacts=new WeakMap();
const LIFE=2.2;
const gateCauses={
  ko:{opened:'잠금판 돌파',pier:'수문 기둥 충돌',closed:'닫힌 잠금판 충돌',angle:'선수 정렬 실패',slow:'돌파 속도 부족'},
  en:{opened:'Gate breached',pier:'Gate pier collision',closed:'Closed gate impact',angle:'Bow misaligned',slow:'Too slow to breach'}
};
// Both live feedback and saved history describe the resolved contact, rather
// than suggesting that the current itself dealt the collision damage.
export function gateImpactText(contact,language='ko'){
  const causes=gateCauses[language==='en'?'en':'ko'];
  return Object.hasOwn(causes,contact)?causes[contact]:(language==='en'?'Gate impact':'수문 충돌');
}
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
