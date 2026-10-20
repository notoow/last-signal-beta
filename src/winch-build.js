// A towline build: tension is the resource; B releases stored pull into the selected hull.
export const winchBuild=v=>v?.version>=6&&v.build==='winch';
export function resetWinch(v){v.winchCharge=0;v.winchCooldown=0;v.winchBody=null;}
export function validWinch(v,s){if(v.version<6)return true;return Number.isFinite(v.winchCharge)&&v.winchCharge>=0&&v.winchCharge<=100&&Number.isFinite(v.winchCooldown)&&v.winchCooldown>=0&&v.winchCooldown<=2&&(v.winchBody===null||[s.bus,...s.cargo].some(b=>(b===s.bus?'bus':b.id)===v.winchBody))&&(winchBuild(v)||v.winchCharge===0&&v.winchCooldown===0&&v.winchBody===null);}
export function winchLimit(v){return v.equipment.includes('tools')?.97:.9;}
export function winchState(s){const v=s.voyage;if(!winchBuild(v))return 'none';if(!s.connected)return 'disconnected';if(s.ropeTension>=winchLimit(v))return 'overload';if(s.ropeTension<.15)return 'slack';if(v.winchCooldown>0)return 'cooldown';return v.winchCharge>=(v.specialization==='harpoon'?60:35)?'ready':'winding';}
export function tickWinch(s,b,movable,dt,input={}){
 const v=s.voyage;if(!winchBuild(v)||v.phase!=='sailing'||s.status!=='playing')return;
 v.winchCooldown=Math.max(0,v.winchCooldown-dt);
 const id=s.connectedBodyId||'bus';if(!s.connected||v.winchBody!==id){v.winchCharge=0;v.winchBody=s.connected?id:null;}
 if(!s.connected||!movable)return;
 if(s.ropeTension>=winchLimit(v)){v.winchCharge=Math.max(0,v.winchCharge-40*dt);return;}
 if(s.ropeTension<.15||input.boost){v.winchCharge=Math.max(0,v.winchCharge-(input.boost?20:12)*dt);return;}
 if(v.winchCooldown<=0&&Math.hypot(input.x||0,input.y||0)>.1&&Math.hypot(b.vx,b.vy)>10)v.winchCharge=Math.min(100,v.winchCharge+22*(.5+s.ropeTension)*(v.equipment.includes('battery')?1.5:1)*dt);
}
export function releaseWinch(s,b,movable){
 const v=s.voyage;if(!winchBuild(v)||s.status!=='playing'||v.phase!=='sailing'||!movable||winchState(s)!=='ready'||v.winchBody!==(s.connectedBodyId||'bus'))return false;
 const heavy=v.specialization==='harpoon',rapid=v.specialization==='ratchet',cost=heavy?5:rapid?2:3;if(v.fuel<cost)return false;
 const used=rapid?Math.min(45,v.winchCharge):v.winchCharge,dx=s.boat.x-b.x,dy=s.boat.y-b.y,d=Math.hypot(dx,dy);if(d<40)return false;
 const nx=dx/d,ny=dy/d,k=(48+used*.9)*(heavy?1.5:1),rx=Math.cos(b.angle)*b.length/2,ry=Math.sin(b.angle)*b.length/2,inertia=b.mass*(b.length*b.length+b.width*b.width)/12;
 b.vx+=nx*k;b.vy+=ny*k;b.omega=Math.max(-1.5,Math.min(1.5,b.omega+(rx*ny-ry*nx)*k*b.mass/inertia));
 const recoil=k*b.mass/s.boat.mass*(v.equipment.includes('tools')?.06:.12)*(heavy?1.7:1);s.boat.vx-=nx*recoil;s.boat.vy-=ny*recoil;
 v.winchCharge=Math.max(0,v.winchCharge-used);v.winchCooldown=heavy?1.4:rapid?.35:1;v.fuel-=cost;s.events.push({type:'winchRelease',used,pull:k,fuel:cost});if(v.fuel<=0){s.status='lost';s.mission.reason='fuel';s.events.push({type:'end'});}return true;
}
export function winchChoices(v,language){if(v.version<6)return '';const en=language==='en';return v.leg===0?'<button data-build="winch" aria-pressed="'+winchBuild(v)+'"><strong>'+(en?'Spring winch':'축력 윈치선')+'</strong><span>'+(en?'Tow at 15–90% tension to store pull. B releases into the hull (3 fuel). Z shortens / X pays out line. Slack, detachment and Shift lose charge. Engine thrust −20%. Battery charges faster; tools control overload/recoil.':'장력 15–90%로 견인해 힘 저장. B로 선체를 당깁니다(연료 3). Z 줄 감기 / X 풀기. 느슨한 줄·분리·Shift는 축력 손실. 기관 추진 −20%. 축전지는 축력 가속, 공구는 과부하·반동 완화.')+'</span></button>':winchBuild(v)&&v.specialization==='none'?'<div class="build-options">'+[['harpoon',en?'Heavy haul':'일격 견인',en?'Pull ×1.5, charge 60+, 5 fuel, stronger recoil.':'당김 ×1.5 · 축력 60 이상 · 연료 5 · 반동 증가.'],['ratchet',en?'Ratchet chain':'연속 래칫',en?'Spend up to 45 charge per pull, retain the rest; 2 fuel and shorter cooldown.':'한 번에 축력 최대 45 사용, 잔량 유지 · 연료 2 · 짧은 재사용 시간.']].map(([id,title,note])=>'<button data-specialization="'+id+'"><strong>'+title+'</strong><span>'+note+'</span></button>').join('')+'</div>':'';}
export function winchHud(s,language){if(!winchBuild(s.voyage))return '';const en=language==='en',v=s.voyage,state=winchState(s),states=en?{disconnected:'E · connect a free hull',overload:'Overload: losing charge · X pays out line / ease throttle',slack:'Slack: losing charge · Z reels in / tow away',cooldown:'Winch resetting',winding:'Tow with steady tension · release Shift',ready:'B · release stored pull'}:{disconnected:'E로 풀린 선체에 연결',overload:'과부하 · 축력 손실 · X로 줄 풀기 / 감속',slack:'느슨함 · 축력 손실 · Z로 감기 / 견인',cooldown:'윈치 복귀 중',winding:'장력을 유지하며 견인 · Shift 해제',ready:'B · 모은 힘으로 선체 당기기'},cost=v.specialization==='harpoon'?5:v.specialization==='ratchet'?2:3;return '<div class="winch-build" data-winch-state="'+state+'"><b>'+(en?'SPRING WINCH':'축력 윈치선')+'</b> '+Math.floor(v.winchCharge)+' / 100 <progress max="100" value="'+v.winchCharge+'" aria-label="'+(en?'Stored pull':'저장 축력')+'"></progress><span>'+(en?'Tension ':'줄 장력 ')+Math.round(s.ropeTension*100)+'% · '+(en?'B costs ':'B 연료 ')+cost+'</span><small>'+(v.fuel<cost?(en?'Not enough fuel to release':'당김에 필요한 연료 부족'):states[state])+'</small></div>';}
