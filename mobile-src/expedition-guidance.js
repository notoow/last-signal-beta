import {salvageSite,salvagePreview,workTarget} from './expedition.js';
import {expeditionText,recoveryLabel} from './expedition-view.js';
export function expeditionGuidance(s,g,language='ko',detour=false){
 if(!(s?.voyage?.version>=3)||s.status!=='playing'||s.voyage.phase!=='sailing')return g;
 const en=language==='en',t=expeditionText(language),a=s.voyage.situation,preview=salvagePreview(s),site=salvageSite(s),patch=a.contract==='leaking'&&!a.patched;
 const mode=detour&&preview?'salvage':patch&&s.voyage.parts>0?'patch':'rescue';
 const navigation={mode,canDetour:!!preview,atRisk:patch,seconds:patch?Math.ceil(s.bus.hp/.45):null};
 if(mode==='rescue'||s.anchors.length)return {...g,navigation};
 const target=mode==='patch'?s.bus:site,near=workTarget(s)===mode,slow=Math.hypot(s.boat.vx,s.boat.vy)<22;
 const label=mode==='patch'?t.patch:recoveryLabel(s,language);
 const action=near?(mode==='patch'&&!s.voyage.parts?t.noParts:!slow?t.slow:t.working+' · 4s'):(en?'WASD · Approach marked work site':'WASD · 표시된 작업 지점으로');
 return {...g,navigation,learningStage:'expedition-'+mode,learningRadio:null,waypoint:{x:target.x,y:target.y,label:label+' · F',kind:mode},pocketGhost:null,dockChecks:[],action,hint:mode==='patch'?(en?'Stop beside the rescue vessel and hold F to seal its leak.':'구조선 곁에 멈추고 F를 유지해 누수를 막으세요.'):(en?'Optional recovery. Hold F when stopped; G returns to the rescue target.':'선택 인양입니다. 멈춘 뒤 F 유지 · G로 구조 표식 복귀.')};
}
