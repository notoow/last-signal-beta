// Resolve a small steering step against a seawall. A capsule's centre may move
// only by the distance swept by its rotating end centres. This is contact
// correction, not a side thruster, depenetration of bad saves or a new velocity.
export function terrainTurnPose(base,angle,terrainClear,poseClear){
  const delta=Math.atan2(Math.sin(angle-base.angle),Math.cos(angle-base.angle));
  if(!Number.isFinite(delta)||Math.abs(delta)>.04)return null;
  const end={...base,angle:base.angle+delta};
  if(poseClear(end))return end;
  if(Math.abs(delta)<1e-8||terrainClear(end)||!poseClear(base))return null;
  const sweep=Math.max(0,base.length-base.width)*Math.abs(Math.sin(delta/2));
  if(sweep<1e-8)return null;
  const limit=sweep+1e-5;
  let best=null;
  for(const [nx,ny] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const at=d=>({...end,x:base.x+nx*d,y:base.y+ny*d});
    // Every sub-pose uses the full existing terrain AND machinery predicates.
    const clear=d=>{
      for(let i=1;i<=4;i++){
        const t=i/4;
        if(!poseClear({...base,x:base.x+nx*d*t,y:base.y+ny*d*t,angle:base.angle+delta*t}))return false;
      }
      return true;
    };
    if(!clear(limit))continue;
    let lo=0,hi=limit;
    for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(clear(mid))hi=mid;else lo=mid;}
    if(!best||hi<best.distance)best={pose:at(hi),distance:hi};
  }
  return best?.pose??null;
}
