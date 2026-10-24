const QUARTER=Math.PI/2;
export const CREW_CYCLE=48;
// Screen-space cardinals, with eight degrees of overlap on either side of
// a diagonal. Small thumb-angle changes cannot alternate two whole rows.
export function crewFacing(angle,previous){
  if(!Number.isFinite(angle))return previous??0;
  if(Number.isInteger(previous)){
    const d=Math.atan2(Math.sin(angle-previous*QUARTER),Math.cos(angle-previous*QUARTER));
    if(Math.abs(d)<=QUARTER/2+8*Math.PI/180)return previous;
  }
  return ((Math.round(angle/QUARTER)%4)+4)%4;
}
// Presentation state only: physics stride still measures every travelled unit.
// Hidden walking phases must not expire during an attack/hit/search and flash
// for a single frame when locomotion becomes visible again.
export function crewWalkCycle({angle,stride=0,moving=false,hit=0,action=null,searching=false},previous){
  const facing=action||hit?previous?.facing??crewFacing(angle):crewFacing(angle,previous?.facing);
  const walking=Boolean(moving&&!hit&&!action&&!searching);
  let phase=previous?.phase??0;
  const distance=previous?stride-previous.stride:0;
  if(distance<0)phase=0;
  if(walking){
    const continuous=previous?.walking&&previous.facing===facing&&distance>=0;
    if(continuous)phase=(phase+distance)%CREW_CYCLE;
    else{
      const contact=facing%2===0?CREW_CYCLE/2:CREW_CYCLE/4;
      phase=Math.floor(phase/contact)*contact;
    }
  }
  return {facing,stride,phase,walking};
}
export function crewPose(angle,moving,stride,hit,action,searching,facing=crewFacing(angle)){
  if(hit>0)return {row:0,col:3,flip:false};
  if(action)return {row:2,col:action.left>(action.kind==='melee'?.26:.19)?2:3,flip:Math.cos(action.angle)<0};
  if(searching)return {row:1,col:3,flip:false};
  const row=facing===3?1:facing===1?0:2,step=Math.floor(stride/(CREW_CYCLE/4))%4;
  // Side art has two poses, front/rear four. They share one walking cycle;
  // two side poses must not play twice as fast as the four front/rear poses.
  return {row,col:moving?(row===2?Math.floor(step/2):[1,0,2,0][step]):0,flip:facing===2};
}
