import {tickWinch,releaseWinch} from './winch-build.js';
import {precisionActive,PRECISION_SPEED} from './piloting.js';
import {startSituation,stormState} from './expedition.js';
import {STORY_RADIO_BY_MISSION} from './voyage-story.js';
import {tickVoyage,propulsion,validVoyage} from './voyage.js';
// Lightweight planar towing: forces, inertia, three-point hull contacts and recoverable joints.
import {inTriangle,triangleArea,clamp} from './core.js';
import {towMission,getTowMission,DEFAULT_TOW_MISSION} from './tow-missions.js';
export {towMission} from './tow-missions.js';
export const TOW_WORLD=getTowMission(DEFAULT_TOW_MISSION).world;
export const TOW_CROSSING=getTowMission(DEFAULT_TOW_MISSION).crossing;
const angleWrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),cross=(a,b)=>a.x*b.y-a.y*b.x;
const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const emit=(s,type,extra={})=>s.events.push({type,...extra});
export function bodyPoint(b,x,y=0){const r=rotate(x,y,b.angle);return {x:b.x+r.x,y:b.y+r.y};}
export function hullPoints(b){const d=b.length/2-b.width/2;return [-d,0,d].map(x=>({...bodyPoint(b,x),r:b.width/2,localX:x}));}
export function createTow(seed=20261006,crew=['engineer'],layout='ac',missionId=DEFAULT_TOW_MISSION){
 const def=getTowMission(missionId);if(!def||!def.layouts.includes(layout))throw new RangeError('Unknown towing mission or layout');
 const bus={...def.spawn.bus,vx:0,vy:0,omega:0,hp:100,inv:0},boat={...def.spawn.boat,vx:0,vy:0,omega:0,hp:100,inv:0,burst:0,burstLeft:0};
 const cargo=(def.cargo||[]).map(b=>({...b,vx:0,vy:0,omega:0,hp:100,inv:0}));
 return {kind:'tow',version:11,workProfile:'infrastructure',bypassOpen:false,flowProfile:'channel',missionId,missionRevision:def.revision,attemptId:0,mapMigration:false,status:'playing',seed,time:0,layout,boat,bus,cargo,connectedBodyId:'bus',temporaryMoorings:[],secured:[],cargoLatches:{},power:true,connected:false,ropeLength:84,ropeTension:0,dockLatched:false,anchors:[],anchorLife:0,anchorCooldown:0,energy:100,
 moorings:def.moorings.map(m=>{const b=m.bodyId&&m.bodyId!=='bus'?cargo.find(b=>b.id===m.bodyId):bus;return {id:m.id,...(m.bodyId?{bodyId:m.bodyId}:{}),x:m.x,y:m.y,cut:false,pin:bodyPoint(b,m.end*b.length/2),localX:m.end*b.length/2};}),
 powerBox:{...def.powerBox},initialBus:{x:bus.x,y:bus.y,angle:bus.angle},crew:[...new Set(crew.filter(x=>['engineer','operator'].includes(x)))],
 mission:{radioLog:[],people:[],reason:null},metrics:{nets:0,connects:0,disconnects:0,collisions:0,damage:0,powerCut:false,firstMooring:null,maxRopeTension:0},events:[],effects:[],route:'unselected',pumpDirection:1,mergeWinchCut:false,mergeHeld:false,boom:null,checkpoints:[],lastPumpPhase:'warning',lastMergePhase:'open'};
}
export function towBodies(s){return [s.bus,...(s.cargo||[])];}
export function towBodyId(s,b){return b===s.bus?'bus':b.id;}
export function towBody(s,id='bus'){return id==='bus'?s.bus:s.cargo?.find(b=>b.id===id);}
export function towTarget(s){return towBody(s,s.connectedBodyId||'bus')||s.bus;}
export function bodyMoorings(s,b){const id=towBodyId(s,b);return s.moorings.filter(m=>(m.bodyId||'bus')===id);}
export function bodyMovable(s,b){const id=towBodyId(s,b);return bodyMoorings(s,b).every(m=>m.cut)&&!s.temporaryMoorings?.some(m=>m.bodyId===id)&&!s.secured?.includes(id);}
export function bodyDock(s,b=s.bus){return b===s.bus?towMission(s).world:(towMission(s).cargo||[]).find(d=>d.id===b.id)?.dock;}
export function towWorkBenefits(s){const enabled=s.workProfile==='infrastructure',moored=Array.isArray(s.temporaryMoorings)?s.temporaryMoorings:[];return {marketGenerator:enabled&&s.missionId==='market'&&moored.some(m=>m.bodyId==='ice'&&m.stationId==='ice-pocket'),landingCrew:enabled&&s.missionId==='landing'&&moored.some(m=>m.bodyId==='bus'&&m.stationId==='holding-pocket'),sluiceBypass:enabled&&s.missionId==='sluice'&&s.bypassOpen===true};}
export function towDockPowered(s,b=s.bus){const work=towWorkBenefits(s);return s.power||b===s.bus&&work.marketGenerator||b.id==='pontoon'&&work.landingCrew;}
function releaseUnpoweredLatches(s){for(const b of towBodies(s))if(!towDockPowered(s,b))latch(s,b,false);}
function latched(s,b){return b===s.bus?s.dockLatched:s.cargoLatches[b.id]===true;}
function latch(s,b,value){if(b===s.bus)s.dockLatched=value;else if(bodyDock(s,b))s.cargoLatches[b.id]=value;else delete s.cargoLatches[b.id];}
export function towPumpVector(s){return s.flowProfile==='channel'&&s.pumpDirection===-1?{ax:0,ay:32,torque:0}:{ax:s.pumpDirection*26,ay:0,torque:s.pumpDirection*.09};}
export function towFollowingFlow(s){return s.missionId===DEFAULT_TOW_MISSION&&s.flowProfile==='channel'&&s.pumpDirection===-1;}
export function towFlows(s){const def=towMission(s),flows=s.workProfile==='infrastructure'&&def.workFlows?def.workFlows:def.flows;if(!s.power||s.layout!=='full')return [];return flows?flows.map(f=>f.states?{...f,...f.states[String(s.pumpDirection)]}:{...f,ax:f.ax*(f.controlled?s.pumpDirection:1),ay:f.ay*(f.controlled?s.pumpDirection:1),torque:f.torque*(f.controlled?s.pumpDirection:1)}):pumpPhase(s)==='active'?[{...def.crossing.flow,...towPumpVector(s)}]:[];}
export function temporaryMooringStatus(s,b,station){const bow=bodyPoint(b,b.length/2),zone=station.zone;return {near:distance(bow,station)<180&&distance(s.boat,bow)<150,hull:hullPoints(b).every(p=>p.x-p.r>=zone.x&&p.x+p.r<=zone.x+zone.w&&p.y-p.r>=zone.y&&p.y+p.r<=zone.y+zone.h),still:Math.hypot(b.vx,b.vy)<12&&Math.abs(b.omega)<.12,heading:Math.abs(angleWrap(b.angle-station.angle))<.35,bow:distance(bow,station)<85};}
export function towAction(s){
 if(s.anchors.length)return {kind:'cancel'};
 for(const m of s.temporaryMoorings||[]){const b=towBody(s,m.bodyId);if(!s.connected&&distance(s.boat,bodyPoint(b,b.length/2))<130)return {kind:'unmoor',bodyId:m.bodyId,stationId:m.stationId};}
 if(s.connected){const b=towTarget(s),id=towBodyId(s,b);for(const station of towMission(s).stations||[]){if(!station.allowed.includes(id)||s.temporaryMoorings.some(m=>m.stationId===station.id)||!bodyMoorings(s,b).every(m=>m.cut))continue;const v=temporaryMooringStatus(s,b,station);if(v.near)return {kind:!v.still?'moorFast':!v.heading?'moorHeading':!v.hull||!v.bow?'moorBow':'moor',bodyId:id,stationId:station.id};}}
 const sluice=towMission(s).crossing.sluice;if(s.layout==='full'&&sluice&&(s.crew.includes('operator')||towMission(s).manualSluice||s.workProfile==='infrastructure'&&towMission(s).workManualSluice)&&distance(s.boat,sluice)<60)return {kind:'sluice'};
 if(s.connected)return {kind:'detach',bodyId:s.connectedBodyId||'bus'};
 const near=towBodies(s).filter(b=>!s.secured?.includes(towBodyId(s,b))).map(b=>({b,d:distance(s.boat,bodyPoint(b,b.length/2))})).sort((a,b)=>a.d-b.d)[0];
 return near&&near.d<130?{kind:'connect',bodyId:towBodyId(s,near.b)}:{kind:'approach'};
}
export function towCutPreview(s,points){
 const moorings=s.moorings.filter(m=>!m.cut&&inTriangle(m,...points)),power=s.power&&inTriangle(s.powerBox,...points);
 const winch=s.layout==='full'&&towMission(s).crossing.merge!==false&&!s.mergeWinchCut&&inTriangle(towMission(s).crossing.winch,...points);
 return {moorings:moorings.map(m=>m.id),power,winch,valid:triangleArea(...points)>=1600};
}
export function placeTowBuoy(s){
 if(s.status!=='playing'||s.anchorCooldown>0)return false;
 const point={x:s.boat.x,y:s.boat.y};
 if(s.anchors.some(p=>distance(p,point)<36)){emit(s,'tooClose');return false;}
 if(s.energy<12){emit(s,'lowEnergy');return false;}
 if(s.anchors.length===2&&!towCutPreview(s,[...s.anchors,point]).valid){emit(s,'tooSmall');return false;}
 s.anchors.push(point);s.anchorLife=24;s.anchorCooldown=.14;s.energy-=12;emit(s,'anchor');
 if(s.anchors.length===3){
  const points=s.anchors,spec=towCutPreview(s,points);s.anchors=[];s.metrics.nets++;
  for(const m of s.moorings)if(spec.moorings.includes(m.id)){m.cut=true;if(!s.metrics.firstMooring)s.metrics.firstMooring=m.id;}
  if(spec.power){s.power=false;s.metrics.powerCut=true;s.dockLatched=false;s.cargoLatches={};emit(s,'radio',{id:'towPowerCut'});}
  else if(spec.moorings.length){if(towMission(s).cutRadioByBody){for(const [bodyId,id]of Object.entries(towMission(s).cutRadioByBody))if(s.moorings.some(m=>m.bodyId===bodyId&&spec.moorings.includes(m.id)))emit(s,'radio',{id});}else if(s.missionId==='market')for(const id of ['bus','ice']){if(s.moorings.some(m=>m.bodyId===id&&spec.moorings.includes(m.id)))emit(s,'radio',{id:id==='bus'?'marketPassengerFree':'marketIceFree'});}else emit(s,'radio',{id:s.moorings.every(m=>m.cut)?towMission(s).cutRadio?.free||'towFree':towMission(s).cutRadio?.one||'towOneLine'});}
  if(spec.winch){s.mergeWinchCut=true;s.boom={...towMission(s).crossing.debris};emit(s,'radio',{id:'towBoomDown'});}
  s.effects.push({type:'net',points,life:.6,max:.6});emit(s,'circuit');
 }
 return true;
}
export function towContext(s){return towAction(s).kind;}
export function towInteract(s){
 if(s.status!=='playing')return false;
 const action=towAction(s);
 if(action.kind==='cancel'){s.anchors=[];return true;}
 if(action.kind==='unmoor'){s.temporaryMoorings=s.temporaryMoorings.filter(m=>m.bodyId!==action.bodyId);s.connectedBodyId=action.bodyId;releaseUnpoweredLatches(s);emit(s,'unmoored');if(s.workProfile==='infrastructure'&&['market','landing'].includes(s.missionId))emit(s,'radio',{id:'workSupportReleased'});return true;}
 if(action.kind.startsWith('moor')){
  if(action.kind!=='moor'){s.connected=false;s.metrics.disconnects++;s.ropeTension=0;emit(s,'radio',{id:'towDetached'});emit(s,action.kind);return true;}
  const b=towBody(s,action.bodyId);s.temporaryMoorings.push({bodyId:action.bodyId,stationId:action.stationId,pose:{x:b.x,y:b.y,angle:b.angle}});b.vx=0;b.vy=0;b.omega=0;latch(s,b,false);s.connected=false;s.ropeTension=0;s.metrics.disconnects++;s.metrics.temporaryMoorings=(s.metrics.temporaryMoorings||0)+1;emit(s,'moored');const work=towWorkBenefits(s);if(work.marketGenerator||work.landingCrew)emit(s,'radio',{id:work.marketGenerator?'marketGeneratorConnected':'landingCrewRigged'});return true;
 }
 if(action.kind==='sluice'){s.pumpDirection*=-1;if(s.workProfile==='infrastructure'&&s.missionId==='sluice'&&s.power&&s.pumpDirection===-1&&!s.bypassOpen){s.bypassOpen=true;emit(s,'radio',{id:'sluiceBypassOpened'});}emit(s,'radio',{id:towMission(s).gateRadio?.[String(s.pumpDirection)]||(s.missionId===DEFAULT_TOW_MISSION&&s.flowProfile==='channel'?(s.pumpDirection===-1?'towFollowingSet':'towCrossSet'):'towGateChanged')});return true;}
 if(action.kind==='detach'){s.connected=false;s.metrics.disconnects++;s.ropeTension=0;emit(s,'radio',{id:'towDetached'});return true;}
 if(action.kind==='connect'){
  const b=towBody(s,action.bodyId),ring=bodyPoint(b,b.length/2),stern=bodyPoint(s.boat,-s.boat.length/2);
  s.connected=true;s.connectedBodyId=action.bodyId;s.ropeLength=clamp(distance(stern,ring),62,130);s.metrics.connects++;emit(s,'radio',{id:'towConnected'});return true;
 }
 emit(s,'towTooFar');return false;
}
export function towReverse(s){
 if(!s.crew.includes('engineer')){emit(s,'needsEngineer');return false;}
 if(s.boat.burst>0)return false;s.boat.burst=3;s.boat.burstLeft=.4;emit(s,'dash');return true;
}
export function towWalls(s){
 const walls=towMission(s).world.walls.flatMap(w=>towWorkBenefits(s).sluiceBypass&&w.id==='south-breakwater'?[{...w,w:140},{...w,id:'south-breakwater-east',x:1360,w:50}]:[w]);
 if(s.layout==='full'){
  walls.push(...towMission(s).crossingWalls);
  if(towMission(s).crossing.merge!==false&&mergePhase(s)==='closed')walls.push(towMission(s).crossing.cable);
  if(s.boom)walls.push(s.boom);
 }
 return walls;
}
function contact(point,w){
 const x=clamp(point.x,w.x,w.x+w.w),y=clamp(point.y,w.y,w.y+w.h),dx=point.x-x,dy=point.y-y,d=Math.hypot(dx,dy);
 if(d>=point.r)return null;
 if(d>.001)return {nx:dx/d,ny:dy/d,depth:point.r-d};
 const edges=[{nx:-1,ny:0,depth:point.x-w.x+point.r},{nx:1,ny:0,depth:w.x+w.w-point.x+point.r},{nx:0,ny:-1,depth:point.y-w.y+point.r},{nx:0,ny:1,depth:w.y+w.h-point.y+point.r}];
 return edges.sort((a,b)=>a.depth-b.depth)[0];
}
function damage(s,b,speed){
 if(speed<35||b.inv>0)return;
 const amount=Math.min(20,Math.max(2,(speed-25)*.12));b.hp=Math.max(0,b.hp-amount);b.inv=.7;s.metrics.collisions++;s.metrics.damage+=amount;emit(s,'hurt');
 if(b.hp<=0){s.status='lost';s.mission.reason='disabled';}
}
function resolveWalls(s,b){
 for(let pass=0;pass<3;pass++){
  let found=false;
  for(const p of hullPoints(b)){
   for(const w of towWalls(s)){
    const hit=contact(p,w);if(!hit)continue;found=true;
    const normalSpeed=b.vx*hit.nx+b.vy*hit.ny;
    if(normalSpeed<0){damage(s,b,-normalSpeed);b.vx-=hit.nx*normalSpeed*1.12;b.vy-=hit.ny*normalSpeed*1.12;}
    b.x+=hit.nx*(hit.depth+.02);b.y+=hit.ny*(hit.depth+.02);
    const local=rotate(p.localX,0,b.angle);b.omega+=clamp(cross(local,{x:hit.nx,y:hit.ny})*.0004*hit.depth,-.04,.04);
   }
  }
  if(!found)break;
 }
 const radius=b.length/2;b.x=clamp(b.x,radius+8,towMission(s).world.width-radius-8);b.y=clamp(b.y,radius+8,towMission(s).world.height-radius-8);
}

function resolvePair(s,a,b,tug=true){
 const busMovable=bodyMovable(s,b),aMovable=tug||bodyMovable(s,a);if(!busMovable&&!aMovable)return;
 for(let pass=0;pass<3;pass++){
  let changed=false;
  for(const p of hullPoints(a)){
   for(const q of hullPoints(b)){
    const dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy),overlap=p.r+q.r-d;
    if(overlap<=0)continue;const nx=d?dx/d:1,ny=d?dy/d:0,share=!aMovable?0:!busMovable?1:tug?.82:b.mass/(a.mass+b.mass);
    a.x+=nx*overlap*share;a.y+=ny*overlap*share;if(busMovable){b.x-=nx*overlap*(1-share);b.y-=ny*overlap*(1-share);}
    const v=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(v<0){damage(s,a,-v);damage(s,b,-v);a.vx-=nx*v*share;a.vy-=ny*v*share;if(busMovable){b.vx+=nx*v*(1-share);b.vy+=ny*v*(1-share);}}
    changed=true;break;
   }if(changed)break;
  }if(!changed)break;
 }
}
function limitTowline(s){
 if(!s.connected)return;const a=s.boat,b=towTarget(s),p=bodyPoint(a,-a.length/2),q=bodyPoint(b,b.length/2),d=distance(p,q),max=s.ropeLength+65;
 if(d<=max)return;const nx=(p.x-q.x)/d,ny=(p.y-q.y)/d,excess=d-max,movable=bodyMovable(s,b),share=movable?.82:1;
 a.x-=nx*excess*share;a.y-=ny*excess*share;if(movable){b.x+=nx*excess*(1-share);b.y+=ny*excess*(1-share);}
 const v=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(v>0){a.vx-=nx*v*share;a.vy-=ny*v*share;if(movable){b.vx+=nx*v*(1-share);b.vy+=ny*v*(1-share);}}
}
function solveMoorings(s,b){
 const id=towBodyId(s,b),temporary=s.temporaryMoorings.find(m=>m.bodyId===id);if(temporary){Object.assign(b,temporary.pose,{vx:0,vy:0,omega:0});return;}if(s.secured.includes(id)){b.vx=0;b.vy=0;b.omega=0;return;}
 const remaining=bodyMoorings(s,b).filter(m=>!m.cut);
 if(remaining.length===2){Object.assign(b,b===s.bus?s.initialBus:(towMission(s).cargo||[]).find(d=>d.id===id),{vx:0,vy:0,omega:0});return;}
 if(remaining.length===1){
  const m=remaining[0],r=rotate(m.localX,0,b.angle);b.x=m.pin.x-r.x;b.y=m.pin.y-r.y;b.vx=b.omega*r.y;b.vy=-b.omega*r.x;
 }
}
export function towDockStatus(s,b=s.bus){const g=bodyDock(s,b)?.berth;if(!g)return {hull:false,still:false,heading:false};return {hull:hullPoints(b).every(p=>p.x-p.r>=g.x&&p.x+p.r<=g.x+g.w&&p.y-p.r>=g.y&&p.y+p.r<=g.y+g.h),still:Math.hypot(b.vx,b.vy)<12&&Math.abs(b.omega)<.12,heading:Math.abs(angleWrap(b.angle-g.angle))<.22};}
export function towDockReady(s,b=s.bus){const d=towDockStatus(s,b);return bodyMovable(s,b)&&d.hull&&d.still&&d.heading;}
export function towAssistState(s,b=s.bus){
 if(!towDockPowered(s,b)||!latched(s,b)||!bodyDock(s,b))return 'off';
 const others=[s.boat,...towBodies(s).filter(v=>v!==b)],gap=Math.min(...others.flatMap(a=>hullPoints(a).flatMap(p=>hullPoints(b).map(q=>Math.hypot(p.x-q.x,p.y-q.y)-p.r-q.r))));
 return s.connected&&towTarget(s)===b||gap<65?'braking':'aligning';
}
export function mergePhase(s){if(towMission(s).crossing.merge===false)return 'open';if(s.mergeWinchCut)return 'cut';if(towFollowingFlow(s)&&s.power)return 'priority';const t=s.time%8;return t<4.4?'open':t<6?'warning':s.mergeHeld?'held':'closed';}
function updateCrossing(s){
 const phase=pumpPhase(s),raw=s.time%8;
 if(phase!==s.lastPumpPhase&&phase==='warning')emit(s,'pumpWarning');s.lastPumpPhase=phase;
 const cable=towMission(s).crossing.cable;
 const overlaps=!!cable&&[...towBodies(s),s.boat].some(b=>hullPoints(b).some(p=>Math.abs(p.x-(cable.x+cable.w/2))<p.r+14&&p.y+p.r>cable.y&&p.y-p.r<cable.y+cable.h));
 if(raw<6)s.mergeHeld=false;else if((s.lastMergePhase==='warning'||s.lastMergePhase==='priority'||s.mergeHeld)&&overlaps)s.mergeHeld=true;else s.mergeHeld=false;
 const gate=mergePhase(s);if(gate!==s.lastMergePhase&&gate==='warning')emit(s,'winchWarning');s.lastMergePhase=gate;
 if(s.route==='unselected'){const regions=towMission(s).routeRegions;if(s.bus.y>regions.inner.minY&&s.bus.x<regions.inner.maxX)s.route='inner';else if(s.bus.x>regions.outer.minX&&s.bus.y<regions.outer.maxY)s.route='outer';}
}
export function pumpPhase(s){const t=s.time%6;return !s.power?'off':towMission(s).crossing.mode==='steady'||towFollowingFlow(s)?'active':t<1.4?'warning':t<3.8?'active':'rest';}
function substep(s,dt,input){
 const tug=s.boat;s.time+=dt;
 // Hand winch: bounded, gradual adjustment; no teleport or instant tension reset.
 if(s.connected&&Number.isFinite(input.reel))s.ropeLength=clamp(s.ropeLength+clamp(input.reel,-1,1)*24*dt,62,130);if(s.layout==='full')updateCrossing(s);
 for(const body of [tug,...towBodies(s)])body.inv=Math.max(0,body.inv-dt);
 tug.burst=Math.max(0,tug.burst-dt);tug.burstLeft=Math.max(0,tug.burstLeft-dt);
 let x=clamp(input.x||0,-1,1),y=clamp(input.y||0,-1,1),mag=Math.hypot(x,y);if(mag>1){x/=mag;y/=mag;}
 if(tug.burstLeft>0){x=-Math.cos(tug.angle);y=-Math.sin(tug.angle);}
 else if(mag>.1){const desired=Math.atan2(y,x);tug.angle=angleWrap(tug.angle+clamp(angleWrap(desired-tug.angle),-(s.voyage&&!Object.values(s.voyage.assignments).includes('helm')?2.6:4)*dt,(s.voyage&&!Object.values(s.voyage.assignments).includes('helm')?2.6:4)*dt));}
 const speed=(tug.burstLeft>0?180:s.connected?132:155)*propulsion(s,input)*(precisionActive(s,input)?PRECISION_SPEED:1);
 tug.vx+=clamp((x*speed-tug.vx)*3,-410,410)*dt;tug.vy+=clamp((y*speed-tug.vy)*3,-410,410)*dt;
 const gust=stormState(s);if(gust?.active&&tug.x>gust.x&&tug.x<gust.x+gust.w&&tug.y>gust.y&&tug.y<gust.y+gust.h){tug.vx+=gust.ax*dt;tug.vy+=gust.ay*dt;}
 for(const b of towBodies(s)){
 if(s.secured.includes(towBodyId(s,b)))continue;
 let ax=0,ay=0,torque=0;
 if(s.connected&&towTarget(s)===b){
  const tip=bodyPoint(b,b.length/2),stern=bodyPoint(tug,-tug.length/2),delta={x:stern.x-tip.x,y:stern.y-tip.y},d=Math.hypot(delta.x,delta.y),n={x:delta.x/(d||1),y:delta.y/(d||1)},r=rotate(b.length/2,0,b.angle);
  const pointVelocity={x:b.vx-b.omega*r.y,y:b.vy+b.omega*r.x},separation=(tug.vx-pointVelocity.x)*n.x+(tug.vy-pointVelocity.y)*n.y;
  const shock=tug.burstLeft>0&&s.crew.includes('engineer');
  const force=clamp((d-s.ropeLength)*14+separation*8,0,shock?230:550);
  s.ropeTension=force/550;s.metrics.maxRopeTension=Math.max(s.metrics.maxRopeTension,s.ropeTension);
  ax+=n.x*force/b.mass;ay+=n.y*force/b.mass;torque+=cross(r,{x:n.x*force,y:n.y*force})/(b.mass*(b.length*b.length+b.width*b.width)/12);
  tug.vx-=n.x*force/tug.mass*dt;tug.vy-=n.y*force/tug.mass*dt;
 }else if(!s.connected)s.ropeTension=0;
 for(const flow of towFlows(s))if(b.x>flow.x&&b.x<flow.x+flow.w&&b.y>flow.y&&b.y<flow.y+flow.h){ax+=flow.ax;ay+=flow.ay;torque+=flow.torque;}
 if(gust?.active&&bodyMovable(s,b)&&b.x>gust.x&&b.x<gust.x+gust.w&&b.y>gust.y&&b.y<gust.y+gust.h){ax+=gust.ax;ay+=gust.ay;torque+=gust.torque;}
 const bow=bodyPoint(b,b.length/2),dock=bodyDock(s,b);
 if(towDockPowered(s,b)&&dock&&bodyMovable(s,b)){
  if(distance(bow,dock.winch)<230&&!s.checkpoints.includes('dock-warning')){s.checkpoints.push('dock-warning');emit(s,'radio',{id:'towDockApproach'});}
  if(!latched(s,b)&&distance(bow,dock.winch)<130){latch(s,b,true);emit(s,'radio',{id:'towDockCaught'});}
 }
 if(towAssistState(s,b)==='braking'){
  // The powered winch may arrest momentum, but never pulls into an attached/nearby tug.
  ax-=b.vx*3.5;ay-=b.vy*3.5;torque-=b.omega*3;
 }else if(towAssistState(s,b)==='aligning'){
  const dockAngle=dock.berth.angle,target={x:dock.winch.x-b.length/2*Math.cos(dockAngle),y:dock.winch.y-b.length/2*Math.sin(dockAngle)};
  ax+=clamp((target.x-b.x)*1.5-b.vx*1.8,-75,75);ay+=clamp((target.y-b.y)*1.8-b.vy*2,-90,90);
  torque+=angleWrap(dockAngle-b.angle)*4-b.omega*2.2;
 }
 const dir={x:Math.cos(b.angle),y:Math.sin(b.angle)},forward=b.vx*dir.x+b.vy*dir.y,side=-b.vx*dir.y+b.vy*dir.x;
 ax-=dir.x*forward*.45-dir.y*side*3.3;ay-=dir.y*forward*.45+dir.x*side*3.3;
 b.vx+=ax*dt;b.vy+=ay*dt;b.omega=clamp((b.omega+torque*dt)*Math.exp(-1.4*dt),-1.5,1.5);
 b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle=angleWrap(b.angle+b.omega*dt);
 }
 tickWinch(s,towTarget(s),bodyMovable(s,towTarget(s)),dt,input);
 tug.x+=tug.vx*dt;tug.y+=tug.vy*dt;for(const b of towBodies(s))solveMoorings(s,b);limitTowline(s);
 for(const b of towBodies(s))resolvePair(s,tug,b);const bodies=towBodies(s);for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)resolvePair(s,bodies[i],bodies[j],false);
 for(const b of bodies)resolveWalls(s,b);resolveWalls(s,tug);
 for(const b of s.cargo)if(towDockReady(s,b)){s.secured.push(b.id);b.vx=0;b.vy=0;b.omega=0;if(s.connected&&towTarget(s)===b){s.connected=false;s.ropeTension=0;s.metrics.disconnects++;}emit(s,'cargoSecured',{bodyId:b.id});if(s.missionId==='landing'&&s.workProfile==='infrastructure'&&b.id==='pontoon'){const helped=towWorkBenefits(s).landingCrew;s.checkpoints.push(helped?'landing-workers-installed':'landing-direct-installed');emit(s,'radio',{id:helped?'landingCrewInstalled':'landingDirectInstalled'});}}
 if(towDockReady(s)&&(towMission(s).goalRequires||[]).every(id=>s.secured.includes(id))){s.status='won';s.mission.reason='bus-safe';s.bus.vx=0;s.bus.vy=0;s.bus.omega=0;emit(s,'radio',{id:'towDisembark'});emit(s,'end');}
}
export function towWinchRelease(s){return releaseWinch(s,towTarget(s),bodyMovable(s,towTarget(s)));}
export function updateTow(s,dt,input={}){
 if(s.status!=='playing'||s.voyage?.phase==='refit')return;startSituation(s);dt=clamp(Number.isFinite(dt)?dt:0,0,.05);const count=Math.max(1,Math.ceil(dt/(1/120))),h=dt/count;
 for(let i=0;i<count&&s.status==='playing';i++)substep(s,h,input);
 s.anchorCooldown=Math.max(0,s.anchorCooldown-dt);s.energy=Math.min(100,s.energy+(s.voyage?.equipment.includes('battery')?30:18)*dt);
 if(s.anchors.length){s.anchorLife-=dt;if(s.anchorLife<=0){s.anchors=[];emit(s,'expired');}}
 tickVoyage(s,dt,input);
 for(const e of s.effects)e.life-=dt;s.effects=s.effects.filter(e=>e.life>0);
 if(s.events.length>60)s.events.splice(0,s.events.length-60);
}

function migrateTowLayout(s){
 const free=(b,dx=0,dy=0)=>hullPoints({...b,x:b.x+dx,y:b.y+dy}).every(p=>p.x-p.r>=8&&p.x+p.r<=towMission(s).world.width-8&&p.y-p.r>=8&&p.y+p.r<=towMission(s).world.height-8&&towWalls(s).every(w=>!contact(p,w)));
 const freeBus=s.moorings.every(m=>m.cut);
 if(!freeBus&&!free(s.bus)){Object.assign(s.bus,s.initialBus,{vx:0,vy:0,omega:0});s.mapMigration=true;}
 const bodies=freeBus?[s.boat,s.bus]:[s.boat];if(bodies.every(b=>free(b)))return;
 for(let radius=10;radius<=600;radius+=10)for(let i=0;i<32;i++){
  const dx=Math.cos(i*Math.PI/16)*radius,dy=Math.sin(i*Math.PI/16)*radius;
  if(!bodies.every(b=>free(b,dx,dy)))continue;
  for(const b of bodies){b.x+=dx;b.y+=dy;b.vx=0;b.vy=0;b.omega=0;}
  if(!freeBus&&s.connected){s.connected=false;s.metrics.disconnects++;}
  s.mapMigration=true;return;
 }
 // Last-resort safe yard keeps equipment choices and permanent crew, rather than losing the save.
 Object.assign(s.bus,s.initialBus,{vx:0,vy:0,omega:0});Object.assign(s.boat,{...towMission(s).recoveryBoat,vx:0,vy:0,omega:0});s.connected=false;s.mapMigration=true;
}

export function restoreTow(raw){
 try{
  if(typeof raw!=='string'||raw.length>140000)return null;const s=JSON.parse(raw),finite=(o,keys)=>o&&keys.every(k=>Number.isFinite(o[k])),range=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
  if(s.kind!=='tow'||![1,2,3,4,5,6,7,8,9,10,11].includes(s.version)||s.status!=='playing'||!range(s.time,0,36000)||!Number.isSafeInteger(s.seed))return null;
  if(s.version<3){if(s.missionId!==undefined&&s.missionId!==DEFAULT_TOW_MISSION)return null;s.missionId=DEFAULT_TOW_MISSION;s.missionRevision=1;}
  if(s.version<4){if(s.missionId!==DEFAULT_TOW_MISSION)return null;s.cargo=[];s.connectedBodyId='bus';s.temporaryMoorings=[];s.secured=[];s.cargoLatches={};}
  if(s.version<6){s.workProfile='legacy';s.bypassOpen=false;}if(!['legacy','infrastructure'].includes(s.workProfile)||typeof s.bypassOpen!=='boolean'||s.bypassOpen&&(s.workProfile!=='infrastructure'||s.missionId!=='sluice'))return null;
  if(s.version<5)s.flowProfile='legacy';if(!['legacy','channel'].includes(s.flowProfile))return null;
  s.attemptId??=0;if(!Number.isSafeInteger(s.attemptId)||s.attemptId<0||s.attemptId>=Number.MAX_SAFE_INTEGER-1)return null;
  const def=getTowMission(s.missionId);if(!def||s.missionRevision!==def.revision||!def.layouts.includes(s.layout))return null;
  const validBody=(b,shape)=>finite(b,['x','y','vx','vy','angle','omega','length','width','mass','hp','inv'])&&range(b.x,0,def.world.width)&&range(b.y,0,def.world.height)&&range(b.hp,.00001,100)&&range(b.inv,0,.7)&&Math.abs(b.vx)<=1500&&Math.abs(b.vy)<=1500&&Math.abs(b.omega)<=4&&Math.abs(b.angle)<=1000000&&['length','width','mass'].every(k=>b[k]===shape[k]);
  if(!validBody(s.boat,def.spawn.boat)||!validBody(s.bus,def.spawn.bus)||!Array.isArray(s.cargo)||s.cargo.length!==(def.cargo||[]).length||s.cargo.some((b,i)=>b?.id!==def.cargo[i].id||!validBody(b,def.cargo[i])))return null;
  if(!range(s.boat.burst,0,3)||!range(s.boat.burstLeft,0,.4))return null;
  if(!['power','connected','dockLatched','mergeWinchCut'].every(k=>typeof s[k]==='boolean')||!Array.isArray(s.crew)||s.crew.length>2||new Set(s.crew).size!==s.crew.length||s.crew.some(v=>!['engineer','operator'].includes(v)))return null;
  if(!towDockPowered(s)&&s.dockLatched||!towBody(s,s.connectedBodyId)||!s.cargoLatches||Array.isArray(s.cargoLatches)||typeof s.cargoLatches!=='object'||Object.entries(s.cargoLatches).some(([id,v])=>!def.cargo?.some(b=>b.id===id&&b.dock)||typeof v!=='boolean'||v&&!towDockPowered(s,towBody(s,id))))return null;
  if(s.voyage!==undefined&&(s.version<7||!validVoyage(s.voyage,s)))return null;
  const base=createTow(s.seed,s.crew,s.layout,s.missionId);
  if(!finite(s.powerBox,['x','y'])||s.powerBox.x!==def.powerBox.x||s.powerBox.y!==def.powerBox.y||!finite(s.initialBus,['x','y','angle'])||s.initialBus.x!==def.spawn.bus.x||s.initialBus.y!==def.spawn.bus.y||s.initialBus.angle!==def.spawn.bus.angle)return null;
  if(!Array.isArray(s.moorings)||s.moorings.length!==base.moorings.length||s.moorings.some((m,i)=>!m||m.id!==base.moorings[i].id||(m.bodyId||'bus')!==(base.moorings[i].bodyId||'bus')||typeof m.cut!=='boolean'||!finite(m,['x','y','localX'])||!finite(m.pin,['x','y'])||['x','y','localX'].some(k=>m[k]!==base.moorings[i][k])||Math.abs(m.pin.x-base.moorings[i].pin.x)>1e-6||Math.abs(m.pin.y-base.moorings[i].pin.y)>1e-6))return null;
  if(!Array.isArray(s.temporaryMoorings)||s.temporaryMoorings.length>(def.stations||[]).length||new Set(s.temporaryMoorings.map(m=>m.bodyId)).size!==s.temporaryMoorings.length||new Set(s.temporaryMoorings.map(m=>m.stationId)).size!==s.temporaryMoorings.length)return null;
  for(const m of s.temporaryMoorings){
   const b=towBody(s,m.bodyId),station=def.stations?.find(t=>t.id===m.stationId);if(!b||!station||!station.allowed.includes(m.bodyId)||!finite(m.pose,['x','y','angle'])||['x','y','angle'].some(k=>Math.abs(m.pose[k]-b[k])>1e-6)||!bodyMoorings(s,b).every(m=>m.cut)||s.connected&&s.connectedBodyId===m.bodyId||latched(s,b))return null;
   const v=temporaryMooringStatus(s,b,station);if(!v.hull||!v.heading||!v.bow||!v.still)return null;
  }
  if(!Array.isArray(s.secured)||new Set(s.secured).size!==s.secured.length||s.secured.some(id=>!def.cargo?.some(b=>b.id===id&&b.dock)||s.connected&&s.connectedBodyId===id||s.temporaryMoorings.some(m=>m.bodyId===id)))return null;
  for(const id of s.secured){const b=towBody(s,id),d=towDockStatus(s,b);if(!bodyMoorings(s,b).every(m=>m.cut)||!d.hull||!d.heading||!d.still)return null;}
  if(!Array.isArray(s.anchors)||s.anchors.length>2||s.anchors.some(p=>!finite(p,['x','y'])||!range(p.x,0,def.world.width)||!range(p.y,0,def.world.height)))return null;
  const ids=[...STORY_RADIO_BY_MISSION[s.missionId],'towPassengersEngineer','towPassengersOperator','towPowerCut','towFree','towOneLine','towDetached','towConnected','towDisembark','towBoomDown','marketGeneratorConnected','landingCrewRigged','workSupportReleased','sluiceBypassOpened','landingCrewInstalled','landingDirectInstalled','towFollowingSet','towCrossSet','towGateChanged','towDockApproach','towDockCaught',...(def.radioIds||[])];
  if(!s.mission||!Array.isArray(s.mission.people)||s.mission.people.length||s.mission.reason!==null||!Array.isArray(s.mission.radioLog)||s.mission.radioLog.length>ids.length||s.mission.radioLog.some(e=>!e||!ids.includes(e.id)||!range(e.time,0,s.time+.1)))return null;
  if(!finite(s.metrics,['nets','connects','disconnects','collisions','damage','maxRopeTension'])||['nets','connects','disconnects','collisions'].some(k=>!Number.isInteger(s.metrics[k])||!range(s.metrics[k],0,100000))||!range(s.metrics.damage,0,1000)||!range(s.metrics.maxRopeTension,0,1)||typeof s.metrics.powerCut!=='boolean'||![null,...def.moorings.map(m=>m.id)].includes(s.metrics.firstMooring)||s.metrics.temporaryMoorings!==undefined&&(!Number.isInteger(s.metrics.temporaryMoorings)||!range(s.metrics.temporaryMoorings,0,100000)))return null;
  if(!range(s.ropeLength,62,130)||!range(s.ropeTension,0,1)||!range(s.anchorLife,-.05,24)||!range(s.anchorCooldown,0,.14)||!range(s.energy,0,100)||![1,-1].includes(s.pumpDirection))return null;
  if(!['unselected','inner','outer'].includes(s.route)||!Array.isArray(s.checkpoints)||s.checkpoints.some(v=>!['dock-warning','landing-workers-installed','landing-direct-installed'].includes(v))||new Set(s.checkpoints).size!==s.checkpoints.length||s.checkpoints.length>2||s.checkpoints.filter(v=>v.startsWith('landing-')).length>1||s.checkpoints.some(v=>v.startsWith('landing-'))&&(s.missionId!=='landing'||s.workProfile!=='infrastructure'||!s.secured.includes('pontoon')))return null;
  if(s.mergeWinchCut){if(!def.crossing.debris||!s.boom||Object.keys(def.crossing.debris).some(k=>s.boom[k]!==def.crossing.debris[k]))return null;}else if(s.boom!==null)return null;
  s.mergeHeld??=false;if(typeof s.mergeHeld!=='boolean')return null;s.lastPumpPhase??=pumpPhase(s);s.lastMergePhase??=mergePhase(s);
  if(!['off','warning','active','rest'].includes(s.lastPumpPhase)||!['cut','open','priority','warning','closed','held'].includes(s.lastMergePhase))return null;
  s.boat.angle=angleWrap(s.boat.angle);for(const b of towBodies(s))b.angle=angleWrap(b.angle);
  s.mapMigration??=false;if(typeof s.mapMigration!=='boolean')return null;if(s.version===1)migrateTowLayout(s);s.version=11;s.effects=[];s.events=[];return s;
 }catch{return null;}
}
