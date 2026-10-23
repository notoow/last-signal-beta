// Ground coordinates remain authoritative simulation coordinates. Painted
// upright sprites use their projected foot anchor, never this matrix twice.
export const IDENTITY_PROJECTION=Object.freeze({xx:1,xy:0,yx:0,yy:1});
export const HARBOR_PROJECTION=Object.freeze({xx:1,xy:-.6,yx:156/788,yy:.4266});
export function project(frame,p,z=0){
  const m=frame.projection||IDENTITY_PROJECTION;
  return {x:(m.xx*p.x+m.xy*p.y)*frame.scale+frame.ox,
    y:(m.yx*p.x+m.yy*p.y-z)*frame.scale+frame.oy};
}
export function groundVector(projection,v){
  const m=projection||IDENTITY_PROJECTION,d=m.xx*m.yy-m.xy*m.yx;
  if(!Number.isFinite(d)||Math.abs(d)<1e-10)throw Error('Invalid ground projection');
  return {x:(m.yy*v.x-m.xy*v.y)/d,y:(m.xx*v.y-m.yx*v.x)/d};
}
export function unproject(frame,p,z=0){
  return groundVector(frame.projection,{x:(p.x-frame.ox)/frame.scale,y:(p.y-frame.oy)/frame.scale+z});
}
// Movement keys and the floating joystick express screen directions. Preserve
// input magnitude while changing the direction once at the app/core boundary.
export function screenVectorToWorld(frame,v){
  const length=Math.min(1,Math.hypot(v.x,v.y));
  if(!length)return {x:0,y:0};
  const q=groundVector(frame?.projection,v),n=Math.hypot(q.x,q.y);
  return {x:q.x/n*length,y:q.y/n*length};
}
export function projectedBounds(frame,points){
  const q=points.map(p=>project(frame,p)),xs=q.map(p=>p.x),ys=q.map(p=>p.y);
  const x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
