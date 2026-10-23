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
export function crewPose(angle,moving,stride,hit,action,searching,facing=crewFacing(angle)){
  if(hit>0)return {row:0,col:3,flip:false};
  if(action)return {row:2,col:action.left>(action.kind==='melee'?.26:.19)?2:3,flip:Math.cos(action.angle)<0};
  if(searching)return {row:1,col:3,flip:false};
  const row=facing===3?1:facing===1?0:2,step=Math.floor(stride/(CREW_CYCLE/4))%4;
  // Side art has two poses, front/rear four. They share one walking cycle;
  // two side poses must not play twice as fast as the four front/rear poses.
  return {row,col:moving?(row===2?Math.floor(step/2):[1,0,2,0][step]):0,flip:facing===2};
}
