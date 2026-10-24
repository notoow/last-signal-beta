import {usesDredger,recentDredgerBreaks} from './dredger-counterplay.js';
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

// An actual break owns its short local motion. Nothing is inferred from a
// missing rope, a zero-health save, the next selected target or a render tick.
export function dredgerBreakMotion(s,{reduced=false,overview=false,scale=1}={}){
  if(reduced||overview)return [];
  const pixel=1/Math.max(.55,Number.isFinite(scale)?scale:1);
  const smooth=t=>t*t*(3-2*t);
  return recentDredgerBreaks(s).filter(e=>e.age<.64).map(e=>{
    const pull=e.age<.1?1-(1-e.age/.1)**3:e.age<.2?1:1-smooth(Math.min(1,(e.age-.2)/.44));
    const peak={x:e.vector.x*13*pixel,y:(e.cause==='crane'?2:e.vector.y*13-5)*pixel,
      angle:e.cause==='crane'?.1:e.vector.x<0?-.24:.24,squash:e.cause==='crane'?.62:.84};
    return {id:e.id,index:e.index,cause:e.cause,point:e.point,vector:e.vector,age:e.age,
      x:peak.x*pull,y:peak.y*pull,angle:peak.angle*pull,
      squash:1+(peak.squash-1)*pull,cable:e.cause==='crane'?0:Math.max(0,1-e.age/.24),pixel,peak};
  });
}
