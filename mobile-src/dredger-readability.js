import {usesDredger} from './dredger-counterplay.js';
import {dredgerTarget,dredgerThreat,dredgerPartName} from './dredger-target.js';

// Presentation only. Selection and connection eligibility belong to the
// shared target query; labels never grant an interaction or alter a save.
export function dredgerReadability(s,language='ko'){
  if(!usesDredger(s))return null;
  const b=s.boss,en=language==='en',selected=dredgerTarget(s),threat=dredgerThreat(s);
  const states=en?{destroyed:'Destroyed',connected:'Connected',exposed:'Exposed',active:'Active'}:
    {destroyed:'파괴됨',connected:'연결 중',exposed:'노출',active:'가동'};
  const parts=b.parts.map((hp,index)=>{
    const state=hp<=0?'destroyed':b.hook===index?'connected':b.active&&!b.cleared&&b.phase==='recover'?'exposed':'active';
    return {index,name:dredgerPartName(index,language),state,status:states[state],
      color:state==='destroyed'?'#9bada2':state==='connected'?'#8de1e3':state==='exposed'?'#f6dda2':'#c4c9bf'};
  });
  return {parts,threat,target:selected&&!threat?{...selected,name:parts[selected.index].name,color:parts[selected.index].color}:null};
}
