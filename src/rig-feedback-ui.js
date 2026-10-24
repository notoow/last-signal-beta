import {recentRigAction} from './rig-feedback.js';
import {recentImpact} from './rogue-impact.js';
import {dredgerPartName,dredgerThreat} from './dredger-target.js';
import {usesSluice,sluiceStatus} from './sluice-counterplay.js';
import {usesLighthouse,lighthouseStatus} from './lighthouse-counterplay.js';

const amount=n=>n>0&&n<.1?'<0.1':String(Number(n.toFixed(1)));
// Only completed model events create receipts. Readiness, cooldowns, resource
// changes and later damage cannot manufacture or rewrite an outcome.
export function rigActionPresentation(s,language='ko'){
  const e=recentRigAction(s);if(!e||recentImpact(s))return null;
  const b=s.boss,sluice=usesSluice(s)?sluiceStatus(s):null,light=usesLighthouse(s)?lighthouseStatus(s):null;
  if(b.active&&!b.cleared&&(dredgerThreat(s)||b.phase==='attack'||
    sluice?.phase==='warn'&&sluice.locked||light?.phase==='warn'&&light.visible))return null;
  return formatRigAction(e,language);
}
function formatRigAction(e,language){
  const en=language==='en',result={id:e.id,kind:e.kind,age:e.age,life:e.life,part:null};
  if(e.kind==='winch-pull'){
    const name=dredgerPartName(e.index,language);
    const status=e.amount>0?(e.remaining===0?(en?'Pull · destroyed':'당김 · 파괴'):
      (en?'Pulled −':'당김 −')+amount(e.amount)):(en?'Pull · no damage':'당김 · 피해 없음');
    return {...result,text:name+(en?' · Winch pull':' · 축력 당김'),shortText:name+(en?' · Pulled':' · 당김'),
      part:{index:e.index,status,amount:e.amount,remaining:e.remaining}};
  }
  const copy={
    'winch-store':en?'Charge stored':'축력 저장 완료',
    'winch-launch':en?'Stored-line launch':'저장 방향으로 발진',
    'line-launch':en?'Line released · launch':'줄 해제 · 회피 발진',
    'bilge-jet':e.kind==='bilge-jet'?(en?`Water jet · drained ${amount(e.water)}%`:`배수 분사 · 침수 −${amount(e.water)}%`):'',
    'brake-launch':en?'Brake-charge launch':'축압 분사',
    'valve-open':en?'Valve opened':'밸브 열림',
    'valve-close':en?'Valve closed · no jet':'밸브 닫힘 · 분사 없음'
  }[e.kind];
  return copy?{...result,text:copy,shortText:e.kind==='bilge-jet'?(en?`Water jet · −${amount(e.water)}%`:`배수 분사 · −${amount(e.water)}%`):copy}:null;
}

// A short response at the control can coexist with the incoming-threat warning.
// It describes the resolved machinery action, never a successful dodge. Its age
// follows the original unsaved event, so repeated reads cannot queue or replay it.
export function rigControlPresentation(s,language='ko'){
  if(!s||s.pendingGear||s.pendingCache||s.salvage?.pending)return null;
  const e=recentRigAction(s);if(!e)return null;
  const life=Math.min(e.life,.8);if(e.age>=life)return null;
  const en=language==='en';let text,icon='winch',code='KeyB';
  switch(e.kind){
    case 'bilge-jet':
      text=en?`Drained −${amount(e.water)}%`:`배수 −${amount(e.water)}%`;icon='water';break;
    case 'winch-pull':
      if(!(e.amount>0))return null;
      text=e.remaining===0?(en?'Drive pulled free':'구동부 파괴'):(en?'Pulled −':'당김 −')+amount(e.amount);break;
    case 'winch-launch':text=en?'Stored launch':'축력 발진';break;
    case 'line-launch':text=en?'Line launch':'줄 해제 발진';break;
    case 'brake-launch':text=en?'Pressure launch':'축압 분사';icon='boost';code='Shift';break;
    default:return null;
  }
  return {id:e.id,kind:e.kind,age:e.age,life,code,icon,text,shortText:text};
}
