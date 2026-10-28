// Swept flight step: the collision owner supplies radii and walls.
// Only the projectile is updated here; damage/refunds belong to the game core.
export function advanceShot(shot,dt,enemies,radius,pathClear,onHit){
 const travel=Math.max(0,Math.min(dt,shot.left));
 if(!travel)return {blocked:false,hits:shot.hitIds||[]};
 const from={x:shot.x,y:shot.y},to={x:shot.x+shot.vx*travel,y:shot.y+shot.vy*travel};
 const dx=to.x-from.x,dy=to.y-from.y,a=dx*dx+dy*dy;
 shot.left=Math.max(0,shot.left-dt);const excluded=new Set(shot.hitIds||[]),contacts=[];
 for(const enemy of enemies){
  if(enemy.hp<=0||excluded.has(enemy.id))continue;
  const x=from.x-enemy.x,y=from.y-enemy.y,r=radius(enemy),c=x*x+y*y-r*r;
  let t=0;
  if(c>0){if(!a)continue;const b=2*(x*dx+y*dy),discriminant=b*b-4*a*c;if(discriminant<0)continue;
   t=(-b-Math.sqrt(discriminant))/(2*a);if(t<0||t>1)continue;}
  contacts.push({enemy,t,x:from.x+dx*t,y:from.y+dy*t});
 }
 contacts.sort((a,b)=>a.t-b.t||a.enemy.id.localeCompare(b.enemy.id));
 for(const contact of contacts){
  if(!pathClear(from,contact)){shot.left=0;return {blocked:true,hits:[...excluded]};}
  shot.x=contact.x;shot.y=contact.y;excluded.add(contact.enemy.id);shot.hitIds=[...excluded];
  onHit(contact.enemy,contact);
  if(!(shot.pierces>0)){shot.left=0;return {blocked:false,hits:[...excluded]};}
  shot.pierces--;
 }
 if(!pathClear(from,to)){shot.left=0;return {blocked:true,hits:[...excluded]};}
 shot.x=to.x;shot.y=to.y;return {blocked:false,hits:[...excluded]};
}
