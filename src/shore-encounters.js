import {walkableAt,shoreBuildings,inside} from './rogue-map.js';

export const FAUNA={
  rat:{name:'시궁쥐',hp:20,speed:73,radius:7,reach:23,notice:115,windup:.38,recovery:.7,damage:6},
  dog:{name:'들개',hp:42,speed:86,radius:10,reach:36,notice:180,windup:.55,recovery:1.1,damage:13},
  crab:{name:'대왕 게',hp:85,speed:34,radius:17,reach:60,notice:165,windup:.9,recovery:1.6,damage:24},
  gull:{name:'약탈 갈매기',hp:18,speed:113,radius:9,reach:32,notice:330,windup:.7,recovery:1.8,damage:5}
};
export const SHORE_SITES=['폐선 수리장','연료 하역장','어시장 나루'];
export const FLOOR_TOOLS=[
  {id:'ratchet',name:'역회전 멈춤쇠',effect:'기계선 고리 노출 +3초',clue:'멈춤쇠가 남아 있대. 정비 기록을 찾으면 구동부를 더 오래 멈출 수 있어.'},
  {id:'baffle',name:'접이식 방류판',effect:'Space 제동 중 흡입·방류 밀침 −75%, 기계선 피해 −40%',clue:'방류판이 남아 있어. 장착하고 제동하면 급류 속에서 버틸 수 있어.'},
  {id:'shutter',name:'차광 신호기',effect:'등대의 추적 조준을 예고 시작 때 고정',clue:'등대 작업자의 차광 신호기가 있어. 빛이 따라오는 걸 끊을 수 있어.'}
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const diff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const toolBerth=s=>s.map.berths[((s.seed^Math.imul(s.depth+1,2654435761))>>>0)%s.map.berths.length];
export const hasTool=(s,id)=>s.tools?.includes(id);
export function sightLine(map,a,b){
  const length=dist(a,b),n=Math.max(1,Math.ceil(length/8));
  for(let i=1;i<n;i++){
    const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};
    if(map.props?.some(r=>inside(p,r,2))||map.islands.some(r=>shoreBuildings(r).some(r=>inside(p,r,2))))return false;
  }return true;
}
function place(map,origin,radius){
  for(let r=0;r<=120;r+=12)for(let i=0;i<12;i++){
    const p={x:origin.x+Math.cos(i*Math.PI/6)*r,y:origin.y+Math.sin(i*Math.PI/6)*r};
    if(walkableAt(map,p,radius))return p;
  }
  return null;
}
export function newEncounter(s,ammo=12){
  const enemies=[];
  s.map.berths.forEach((b,i)=>{
    const kinds=i===0?['rat','rat']:i===1?['dog','crab']:['gull','gull','rat'];
    kinds.forEach((kind,j)=>{
      const spec=FAUNA[kind],p=place(s.map,{x:b.loot.x+65+j*29,y:Math.max(b.loot.y+30,s.map.islands[b.island].y+173)},spec.radius);
      if(!p)return;
      enemies.push({...p,id:i+'-'+j,kind,homeX:p.x,homeY:p.y,angle:0,hp:spec.hp,phase:'idle',left:0,hit:0,stride:0,moving:false,stolen:0,dead:0,alert:false});
    });
  });
  return {ammo,enemies,shots:[],effects:[],cooldown:0,action:null,hit:0,stride:0,moving:false,shotId:0,hitId:0,killId:0};
}
function effect(s,x,y,kind){s.combat.effects.push({x,y,kind,left:.3});}
function hurtEnemy(s,e,n,angle){
  if(e.hp<=0)return;
  const armor=e.kind==='crab'&&e.phase!=='recover'? .3:1;
  e.hp=Math.max(0,e.hp-n*armor);e.hit=.22;s.combat.hitId++;
  effect(s,e.x,e.y,armor<1?'shell':'hit');
  // A crab telegraph is committed: poking its shell cannot cancel its attack.
  if(e.kind!=='crab'){e.phase='recover';e.left=.5;}
  const p={x:e.x+Math.cos(angle)*16,y:e.y+Math.sin(angle)*16};
  if((e.kind!=='crab'||e.phase==='recover')&&(e.kind==='gull'||walkableAt(s.map,p,FAUNA[e.kind].radius))){e.x=p.x;e.y=p.y;}
  if(!e.hp){e.dead=.65;s.combat.ammo=Math.min(12,s.combat.ammo+e.stolen);e.stolen=0;s.combat.killId++;effect(s,e.x,e.y,'defeat');}
}
export function shoreAttack(s,kind='ranged',aim=null){
  const c=s.combat;if(!c||c.cooldown>0||s.status!=='playing'||s.pendingGear)return false;
  const p=s.person||s.boat;
  if(kind==='melee'&&!s.person)return false;
  let angle=p.angle||0;
  if(aim&&Number.isFinite(aim.x)&&Number.isFinite(aim.y))angle=Math.atan2(aim.y-p.y,aim.x-p.x);
  else if(kind==='ranged'){
    const target=c.enemies.filter(e=>e.hp>0&&dist(e,p)<(s.person?210:320)&&sightLine(s.map,p,e)).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(target)angle=Math.atan2(target.y-p.y,target.x-p.x);
  }
  if(s.person)s.person.angle=angle;
  if(kind==='ranged'){
    if(!c.ammo){effect(s,p.x,p.y,'empty');return false;}
    c.ammo--;c.cooldown=.65;c.shotId++;
    c.shots.push({x:p.x,y:p.y,vx:Math.cos(angle)*390,vy:Math.sin(angle)*390,left:s.person?.55:.84});
  }else c.cooldown=.52;
  c.action={kind,angle,left:kind==='melee'?.42:.32,done:false};s.work=0;
  s.noise={x:p.x,y:p.y,left:1.6};
  return true;
}
function moveEnemy(s,e,target,velocity,dt){
  const d=dist(e,target);if(d<2)return;
  const v=Math.min(d,velocity*dt),dx=(target.x-e.x)/d*v,dy=(target.y-e.y)/d*v;
  const before={x:e.x,y:e.y};e.angle=Math.atan2(dy,dx);
  if(e.kind==='gull'){e.x+=dx;e.y+=dy;}
  else{
    if(walkableAt(s.map,{x:e.x+dx,y:e.y},FAUNA[e.kind].radius))e.x+=dx;
    if(walkableAt(s.map,{x:e.x,y:e.y+dy},FAUNA[e.kind].radius))e.y+=dy;
  }
  const moved=dist(e,before);e.stride+=moved;e.moving=moved>.01;
}
function enemyHit(s,e){
  const c=s.combat,spec=FAUNA[e.kind],p=s.person||s.boat;
  if(dist(e,p)>spec.reach+(s.person?6:s.boat.width/2)||Math.abs(diff(Math.atan2(p.y-e.y,p.x-e.x),e.angle))>1.05||!sightLine(s.map,e,p))return;
  if(s.person){
    if(c.hit>0)return;
    s.crewHp=Math.max(0,s.crewHp-spec.damage);c.hit=.65;s.work=0;c.action=null;c.hitId++;
    const away={x:p.x+Math.cos(e.angle)*13,y:p.y+Math.sin(e.angle)*13};
    if(walkableAt(s.map,away)){p.x=away.x;p.y=away.y;}
    if(!s.crewHp){s.status='lost';s.reason=spec.name+'의 공격으로 선원이 쓰러졌다';}
  }else if(e.kind==='gull'){
    if(s.boat.inv>0)return;
    if(c.ammo>0){const stolen=Math.min(2,c.ammo);c.ammo-=stolen;e.stolen+=stolen;}
    else{s.hp=Math.max(0,s.hp-3);if(!s.hp){s.status='lost';s.reason='갈매기 습격으로 손상된 선체가 침몰했다';}}
    s.boat.inv=.8;c.hitId++;
  }
  effect(s,p.x,p.y,'hurt');
}
export function tickEncounter(s,input,dt){
  const c=s.combat;if(!c)return;
  c.cooldown=Math.max(0,c.cooldown-dt);c.hit=Math.max(0,c.hit-dt);
  for(const fx of c.effects)fx.left-=dt;c.effects=c.effects.filter(f=>f.left>0);
  if(input.melee&&s.person)shoreAttack(s,'melee');
  if(input.ranged)shoreAttack(s,'ranged');
  if(c.action){
    c.action.left-=dt;
    if(c.action.kind==='melee'&&!c.action.done&&c.action.left<.26&&s.person){
      c.action.done=true;
      for(const e of c.enemies)if(e.hp>0&&dist(e,s.person)<54+FAUNA[e.kind].radius&&Math.abs(diff(Math.atan2(e.y-s.person.y,e.x-s.person.x),c.action.angle))<1&&sightLine(s.map,s.person,e))hurtEnemy(s,e,24,c.action.angle);
    }
    if(c.action.left<=0)c.action=null;
  }
  for(const shot of c.shots){
    const old={x:shot.x,y:shot.y};shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.left-=dt;
    if(!sightLine(s.map,old,shot)){shot.left=0;effect(s,shot.x,shot.y,'shell');continue;}
    const e=c.enemies.find(e=>e.hp>0&&dist(e,shot)<FAUNA[e.kind].radius+5);
    if(e){hurtEnemy(s,e,20,Math.atan2(shot.vy,shot.vx));shot.left=0;}
  }
  c.shots=c.shots.filter(p=>p.left>0);
  for(const e of c.enemies){
    e.moving=false;
    if(e.hp<=0){e.dead=Math.max(0,e.dead-dt);continue;}
    e.hit=Math.max(0,e.hit-dt);if(e.hit>0&&e.kind!=='crab')continue;
    const spec=FAUNA[e.kind],p=s.person||s.boat,home={x:e.homeX,y:e.homeY};
    if(!s.person&&e.kind!=='gull'){e.alert=false;e.phase='idle';continue;}
    if(e.phase==='warn'){
      e.left-=dt;
      if(e.left<=0){e.phase='strike';e.left=.18;enemyHit(s,e);}
      continue;
    }
    if(e.phase==='strike'||e.phase==='recover'){
      if(e.phase==='strike'&&(e.kind==='dog'||e.kind==='gull'))moveEnemy(s,e,{x:e.x+Math.cos(e.angle)*50,y:e.y+Math.sin(e.angle)*50},100,dt);
      e.left-=dt;if(e.left<=0){if(e.phase==='strike'){e.phase='recover';e.left=spec.recovery;}else e.phase='idle';}
      continue;
    }
    const away=dist(e,home)>560||e.stolen>0;
    // Attack noise at the player must not act as a decoy and suppress bites.
    // Only a can thrown away from the player draws attention elsewhere.
    const lure=s.noise?.left>0&&dist(e,s.noise)<200&&dist(p,s.noise)>48&&e.kind!=='gull';
    const canSee=(dist(e,p)<(e.alert?spec.notice+100:spec.notice))&&sightLine(s.map,e,p)&&!away;
    const target=away?home:lure?s.noise:canSee?p:home;
    e.alert=canSee;
    if(e.stolen&&dist(e,home)<24){e.stolen=0;e.phase='recover';e.left=6;continue;}
    if(canSee&&!lure&&dist(e,p)<spec.reach+(s.person?0:s.boat.width/2)){
      e.phase='warn';e.left=spec.windup;e.angle=Math.atan2(p.y-e.y,p.x-e.x);continue;
    }
    moveEnemy(s,e,target,spec.speed*(canSee||lure||away?1:.35),dt);
    // Small packs occupy space instead of collapsing into a single sprite.
    for(const other of c.enemies){
      if(other===e||other.hp<=0||other.kind==='gull'||e.kind==='gull')continue;
      const d=dist(e,other),space=spec.radius+FAUNA[other.kind].radius;
      if(d>0&&d<space){
        const p={x:e.x+(e.x-other.x)/d*25*dt,y:e.y+(e.y-other.y)/d*25*dt};
        if(walkableAt(s.map,p,spec.radius)){e.x=p.x;e.y=p.y;}
      }
    }
  }
}
export function validateEncounter(s,finite){
  const c=s.combat;if(c===null)return Array.isArray(s.tools)&&s.tools.length===0;
  if(!Array.isArray(s.tools)||new Set(s.tools).size!==s.tools.length||s.tools.some(id=>!FLOOR_TOOLS.some((t,i)=>t.id===id&&i<=s.depth)))return false;
  if(!c||!Number.isInteger(c.ammo)||!finite(c.ammo,0,12)||!finite(c.cooldown,0,.66)||!finite(c.hit,0,.66)||!finite(c.stride,0,1e9)||typeof c.moving!=='boolean')return false;
  if(!['shotId','hitId','killId'].every(k=>Number.isInteger(c[k])&&finite(c[k],0,1e9)))return false;
  if(c.action&&(!['melee','ranged'].includes(c.action.kind)||!finite(c.action.angle,-Math.PI,Math.PI)||!finite(c.action.left,0,.43)||typeof c.action.done!=='boolean'))return false;
  if(!Array.isArray(c.enemies)||c.enemies.length>9||new Set(c.enemies.map(e=>e.id)).size!==c.enemies.length)return false;
  if(c.enemies.some(e=>!FAUNA[e.kind]||typeof e.id!=='string'||!['idle','warn','strike','recover'].includes(e.phase)||!finite(e.hp,0,FAUNA[e.kind].hp)||!finite(e.x,0,3400)||!finite(e.y,0,1800)||!finite(e.homeX,0,3400)||!finite(e.homeY,0,1800)||!finite(e.angle,-Math.PI,Math.PI)||!finite(e.left,-.02,6)||!finite(e.hit,0,.23)||!finite(e.stride,0,1e9)||!finite(e.dead,0,.66)||!Number.isInteger(e.stolen)||!finite(e.stolen,0,12)||typeof e.moving!=='boolean'||typeof e.alert!=='boolean'||(e.kind!=='gull'&&!walkableAt(s.map,e,0))))return false;
  if(!Array.isArray(c.shots)||c.shots.length>4||c.shots.some(p=>!finite(p.x,-400,3800)||!finite(p.y,-400,2200)||!finite(p.vx,-390,390)||!finite(p.vy,-390,390)||!finite(p.left,0,.85)))return false;
  return Array.isArray(c.effects)&&c.effects.length<=40&&c.effects.every(f=>finite(f.x,-400,3800)&&finite(f.y,-400,2200)&&finite(f.left,0,.31)&&['empty','shell','hit','hurt','defeat'].includes(f.kind));
}
