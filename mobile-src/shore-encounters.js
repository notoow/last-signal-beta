import {walkableAt,shoreBuildings,shoreSolid} from './rogue-map.js';
import {shoreWaypoint} from './shore-navigation.js';
import {recordHit} from './rogue-voyage-record.js';
import {publishImpact} from './rogue-impact.js';
import {crewEffects} from './crew-upgrades.js';
import {shoreScale,crewRadius,HUMAN_SCALE,humanShore,shoreRanges} from './shore-scale.js';

export const FAUNA={
  rat:{name:'시궁쥐',hp:20,speed:73,radius:7,reach:23,notice:115,windup:.38,recovery:.7,damage:6},
  dog:{name:'들개',hp:42,speed:86,radius:10,reach:36,notice:180,windup:.55,recovery:1.1,damage:13},
  crab:{name:'대왕 게',hp:85,speed:34,radius:17,reach:60,notice:165,windup:.9,recovery:1.6,damage:24},
  gull:{name:'약탈 갈매기',hp:18,speed:113,radius:9,reach:32,notice:330,windup:.7,recovery:1.8,damage:5}
};
const humanFauna=Object.fromEntries(Object.entries(FAUNA).map(([id,spec])=>[id,{...spec,
  ...Object.fromEntries(['speed','radius','reach','notice'].map(k=>[k,spec[k]*HUMAN_SCALE]))}]));
export const fauna=(s,id)=>humanShore(s)?humanFauna[id]:FAUNA[id];
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
  const length=dist(a,b),n=Math.max(1,Math.ceil(length/(map.version>=4?1:8))),pad=map.version>=4?.25:2;
  let candidates=null;
  if(map.version>=4){
    // Preserve the exact fine samples and collision predicate. Only discard
    // solids whose padded bounds cannot meet this ray. Without this broad
    // phase, surveying open sea repeats every distant building at every metre.
    const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
    candidates=[...(map.props||[]),...map.islands.flatMap(shoreBuildings)].filter(r=>{
      const minX=r.footprint?Math.min(...r.footprint.map(p=>p.x)):r.x,maxX=r.footprint?Math.max(...r.footprint.map(p=>p.x)):r.x+r.w;
      const minY=r.footprint?Math.min(...r.footprint.map(p=>p.y)):r.y,maxY=r.footprint?Math.max(...r.footprint.map(p=>p.y)):r.y+r.h;
      return maxX+pad>=left&&minX-pad<=right&&maxY+pad>=top&&minY-pad<=bottom;
    });
    if(!candidates.length)return true;
  }
  for(let i=1;i<n;i++){
    const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};
    if(candidates?candidates.some(r=>shoreSolid(p,r,pad)):
      map.props?.some(r=>shoreSolid(p,r,pad))||map.islands.some(r=>shoreBuildings(r).some(r=>shoreSolid(p,r,pad))))return false;
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
      const yard=s.map.islands[b.island],spec=fauna(s,kind);
      const p=place(s.map,s.generator>=4?{x:b.loot.x-16-j*14,y:b.loot.y+12+j*3}:s.generator>=3?{x:yard.x+42+j*68,y:yard.y+yard.h-70-(j%2)*60}:
        {x:b.loot.x+65+j*29,y:Math.max(b.loot.y+30,yard.y+173)},spec.radius);
      if(!p)return;
      enemies.push({...p,id:i+'-'+j,kind,homeX:p.x,homeY:p.y,angle:0,hp:spec.hp,phase:'idle',left:0,hit:0,stride:0,moving:false,stolen:0,dead:0,alert:false,
        stash:0,...(s.generator>=3?{asleep:kind!=='gull'&&(s.seed+i+j)%3===0,awareness:0}: {})});
    });
  });
  if(s.generator>=3){
    // Dock fauna also live in side alleys without loot. An independent seed
    // stream chooses homes; opening a cache neither spawns nor wakes them.
    const props=s.map.props.filter(p=>p.kind==='warehouse');
    for(let i=0;i<4&&props.length;i++){
      const r=props[((s.seed>>>0)+i*19+s.depth*7)%props.length],kind=i%2?'rat':'dog',spec=fauna(s,kind);
      const p=place(s.map,{x:r.x+r.w/2,y:r.y+r.h+34},spec.radius);
      if(!p||s.map.berths.some(b=>dist(p,b.loot)<125)||enemies.some(e=>dist(e,p)<60))continue;
      enemies.push({...p,id:'alley-'+i,kind,homeX:p.x,homeY:p.y,angle:Math.PI/2,hp:spec.hp,phase:'idle',left:0,hit:0,stride:0,moving:false,stolen:0,stash:0,dead:0,alert:false,asleep:i%2===0,awareness:0});
    }
  }
  return {ammo,enemies,shots:[],effects:[],cooldown:0,action:null,hit:0,stride:0,moving:false,shotId:0,hitId:0,killId:0};
}
function effect(s,x,y,kind){s.combat.effects.push({x,y,kind,left:.3});}
// A thief carries only loose throwables. A hit or close horn makes it release
// them; an escaped load remains at its shore home, including after its death.
function releaseScrap(s,e){
  const held=e.stolen;if(!held)return 0;
  const returned=Math.min(held,12-s.combat.ammo);
  s.combat.ammo+=returned;e.stolen=0;e.stash=(e.stash||0)+held-returned;
  s.radio={text:`Woo: 고철 ${returned}개 되찾았어!${held>returned?' 나머지는 둥지에 남아 있어.':''}`,left:4};
  effect(s,e.x,e.y,'shell');return returned;
}
export function startleGulls(s){
  if(!s.combat)return false;const p=s.person||s.boat;let caught=false;
  for(const e of s.combat.enemies)if(e.kind==='gull'&&e.hp>0&&e.stolen>0&&dist(e,p)<(s.person?70*shoreScale(s):110)&&sightLine(s.map,p,e)){
    releaseScrap(s,e);e.phase='recover';e.left=6;e.alert=false;caught=true;
  }return caught;
}
export function gullRecovery(s){
  if(!s.person||!s.combat)return null;
  const e=s.combat.enemies.filter(e=>e.kind==='gull'&&(e.stash||0)>0&&dist(s.person,{x:e.homeX,y:e.homeY})<Math.max(shoreRanges(s).search,12*shoreScale(s))&&sightLine(s.map,s.person,{x:e.homeX,y:e.homeY}))
    .sort((a,b)=>dist(s.person,{x:a.homeX,y:a.homeY})-dist(s.person,{x:b.homeX,y:b.homeY}))[0];
  return e?{id:e.id,point:{x:e.homeX,y:e.homeY},amount:e.stash,available:s.combat.ammo<12&&!s.combat.action&&s.combat.hit===0}:null;
}
export function recoverGullScrap(s){
  const r=gullRecovery(s);if(!r?.available)return false;
  const e=s.combat.enemies.find(e=>e.id===r.id),amount=Math.min(e.stash,12-s.combat.ammo);
  e.stash-=amount;s.combat.ammo+=amount;s.radio={text:`Woo: 둥지에서 고철 ${amount}개 회수했어.`,left:4};return true;
}
function hurtEnemy(s,e,n,angle){
  if(e.hp<=0)return;
  const armor=e.kind==='crab'&&e.phase!=='recover'? .3:1;
  e.hp=Math.max(0,e.hp-n*armor);e.hit=.22;s.combat.hitId++;
  if('asleep'in e){e.asleep=false;e.awareness=.3;e.alert=true;}
  effect(s,e.x,e.y,armor<1?'shell':'hit');
  if(e.kind==='gull'&&e.stolen)releaseScrap(s,e);
  // A crab telegraph is committed: poking its shell cannot cancel its attack.
  if(e.kind!=='crab'){e.phase='recover';e.left=.5;}
  const push=16*shoreScale(s),p={x:e.x+Math.cos(angle)*push,y:e.y+Math.sin(angle)*push};
  if((e.kind!=='crab'||e.phase==='recover')&&(e.kind==='gull'||walkableAt(s.map,p,fauna(s,e.kind).radius))){e.x=p.x;e.y=p.y;}
  if(!e.hp){e.dead=.65;s.combat.ammo=Math.min(12,s.combat.ammo+e.stolen);e.stolen=0;s.combat.killId++;effect(s,e.x,e.y,'defeat');}
}
export function shoreAttack(s,kind='ranged',aim=null){
  const c=s.combat;if(!c||c.cooldown>0||s.status!=='playing'||s.pendingGear)return false;
  const p=s.person||s.boat;
  if(kind==='melee'&&!s.person)return false;
  let angle=p.angle||0;
  if(aim&&Number.isFinite(aim.x)&&Number.isFinite(aim.y))angle=Math.atan2(aim.y-p.y,aim.x-p.x);
  else if(kind==='ranged'){
    const target=c.enemies.filter(e=>e.hp>0&&dist(e,p)<(s.person?210:320)*shoreScale(s)&&sightLine(s.map,p,e)).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(target)angle=Math.atan2(target.y-p.y,target.x-p.x);
  }
  if(s.person)s.person.angle=angle;
  if(kind==='ranged'){
    if(!c.ammo){effect(s,p.x,p.y,'empty');return false;}
    c.ammo--;c.cooldown=.65;c.shotId++;
    c.shots.push({x:p.x,y:p.y,vx:Math.cos(angle)*390*shoreScale(s),vy:Math.sin(angle)*390*shoreScale(s),left:s.person?.55:.84});
  }else c.cooldown=.52;
  c.action={kind,angle,left:kind==='melee'?.42:.32,done:false};s.work=0;
  s.noise={x:p.x,y:p.y,left:1.6};
  return true;
}
function moveEnemy(s,e,target,velocity,dt,route=true){
  if(route&&e.kind!=='gull'){
    target=shoreWaypoint(s.map,e,target,fauna(s,e.kind).radius,s.time);
    if(!target)return;
  }
  const d=dist(e,target);if(d<2*shoreScale(s))return;
  const v=Math.min(d,velocity*dt),dx=(target.x-e.x)/d*v,dy=(target.y-e.y)/d*v;
  const before={x:e.x,y:e.y};e.angle=Math.atan2(dy,dx);
  if(e.kind==='gull'){e.x+=dx;e.y+=dy;}
  else{
    if(walkableAt(s.map,{x:e.x+dx,y:e.y},fauna(s,e.kind).radius))e.x+=dx;
    if(walkableAt(s.map,{x:e.x,y:e.y+dy},fauna(s,e.kind).radius))e.y+=dy;
  }
  const moved=dist(e,before);e.stride+=moved;e.moving=moved>.01;
}
function enemyHit(s,e){
  const c=s.combat,spec=fauna(s,e.kind),p=s.person||s.boat;
  if(dist(e,p)>spec.reach+(s.person?6*shoreScale(s):s.boat.width/2)||Math.abs(diff(Math.atan2(p.y-e.y,p.x-e.x),e.angle))>1.05||!sightLine(s.map,e,p))return;
  if(s.person){
    if(c.hit>0)return;
    const before=s.crewHp;
    s.crewHp=Math.max(0,s.crewHp-spec.damage*crewEffects(s).damage);c.hit=.65;s.work=0;c.action=null;c.hitId++;
    recordHit(s,'crew',e.kind,before);
    const push=13*shoreScale(s),away={x:p.x+Math.cos(e.angle)*push,y:p.y+Math.sin(e.angle)*push};
    if(walkableAt(s.map,away,crewRadius(s))){p.x=away.x;p.y=away.y;}
    if(!s.crewHp){s.status='lost';s.reason=spec.name+'의 공격으로 선원이 쓰러졌다';}
  }else if(e.kind==='gull'){
    if(s.boat.inv>0)return;
    if(c.ammo>0&&(e.stash||0)<4){const stolen=Math.min(2,c.ammo,4-(e.stash||0));c.ammo-=stolen;e.stolen+=stolen;
      publishImpact(s,{target:'scrap',source:'gull',amount:stolen,remaining:c.ammo});
      s.radio={text:'Park: 갈매기가 고철을 물었어! 가까울 때 Q 경적, 아니면 투척! 놓쳐도 부두 둥지에서 되찾을 수 있어.',left:7};}
    s.boat.inv=.8;c.hitId++;
  }
  effect(s,p.x,p.y,'hurt');
}
export function tickEncounter(s,input,dt){
  const c=s.combat;if(!c)return;const unit=shoreScale(s);
  c.cooldown=Math.max(0,c.cooldown-dt);c.hit=Math.max(0,c.hit-dt);
  for(const fx of c.effects)fx.left-=dt;c.effects=c.effects.filter(f=>f.left>0);
  if(input.melee&&s.person)shoreAttack(s,'melee');
  if(input.ranged)shoreAttack(s,'ranged');
  if(c.action){
    c.action.left-=dt;
    if(c.action.kind==='melee'&&!c.action.done&&c.action.left<.26&&s.person){
      c.action.done=true;
      for(const e of c.enemies)if(e.hp>0&&dist(e,s.person)<54*unit+fauna(s,e.kind).radius&&Math.abs(diff(Math.atan2(e.y-s.person.y,e.x-s.person.x),c.action.angle))<1&&sightLine(s.map,s.person,e))hurtEnemy(s,e,crewEffects(s).melee,c.action.angle);
    }
    if(c.action.left<=0)c.action=null;
  }
  for(const shot of c.shots){
    const old={x:shot.x,y:shot.y};shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.left-=dt;
    if(!sightLine(s.map,old,shot)){shot.left=0;effect(s,shot.x,shot.y,'shell');continue;}
    const e=c.enemies.find(e=>e.hp>0&&dist(e,shot)<fauna(s,e.kind).radius+5*unit);
    if(e){hurtEnemy(s,e,20,Math.atan2(shot.vy,shot.vx));shot.left=0;}
  }
  c.shots=c.shots.filter(p=>p.left>0);
  for(const e of c.enemies){
    e.moving=false;
    if(e.hp<=0){e.dead=Math.max(0,e.dead-dt);continue;}
    e.hit=Math.max(0,e.hit-dt);if(e.hit>0&&e.kind!=='crab')continue;
    const spec=fauna(s,e.kind),p=s.person||s.boat,home={x:e.homeX,y:e.homeY};
    if(!s.person&&e.kind!=='gull'){e.alert=false;e.phase='idle';continue;}
    if(e.phase==='warn'){
      e.left-=dt;
      if(e.left<=0){e.phase='strike';e.left=.18;enemyHit(s,e);}
      continue;
    }
    if(e.phase==='strike'||e.phase==='recover'){
      if(e.phase==='strike'&&(e.kind==='dog'||e.kind==='gull'))moveEnemy(s,e,{x:e.x+Math.cos(e.angle)*50*unit,y:e.y+Math.sin(e.angle)*50*unit},100*unit,dt,false);
      e.left-=dt;if(e.left<=0){if(e.phase==='strike'){e.phase='recover';e.left=spec.recovery;}else e.phase='idle';}
      continue;
    }
    const away=dist(e,home)>560*unit||e.stolen>0||(e.kind==='gull'&&((e.stash||0)>=4||!s.person&&c.ammo===0));
    if(e.asleep){
      const heard=s.noise?.left>0&&dist(e,s.noise)<145*unit&&sightLine(s.map,e,s.noise);
      const close=dist(e,p)<(input.boost&&c.moving?100:42)*unit&&sightLine(s.map,e,p);
      if(!heard&&!close){e.alert=false;continue;}
      e.asleep=false;e.awareness=0;
    }
    // Attack noise at the player must not act as a decoy and suppress bites.
    // Only a can thrown away from the player draws attention elsewhere.
    const lure=s.noise?.left>0&&dist(e,s.noise)<200*unit&&dist(p,s.noise)>48*unit&&e.kind!=='gull';
    const perceived=(dist(e,p)<(e.alert?spec.notice+75*unit:spec.notice))&&sightLine(s.map,e,p)&&!away;
    if('awareness'in e)e.awareness=perceived?Math.min(.3,e.awareness+dt):0;
    const canSee=perceived&&(!('awareness'in e)||e.alert||e.awareness>=.3||dist(e,p)<spec.reach+8*unit);
    const target=away?home:lure?s.noise:canSee?p:home;
    e.alert=canSee;
    if(e.stolen&&dist(e,home)<24*unit){e.stash=(e.stash||0)+e.stolen;e.stolen=0;e.phase='recover';e.left=6;
      s.radio={text:'Park: 고철을 부두 둥지에 내려놨어. 상륙해서 회수할 수 있어.',left:5};continue;}
    if(canSee&&!lure&&dist(e,p)<spec.reach+(s.person?0:s.boat.width/2)){
      e.phase='warn';e.left=spec.windup;e.angle=Math.atan2(p.y-e.y,p.x-e.x);continue;
    }
    moveEnemy(s,e,target,spec.speed*(canSee||lure||away?1:.35),dt);
    // Small packs occupy space instead of collapsing into a single sprite.
    for(const other of c.enemies){
      if(other===e||other.hp<=0||other.kind==='gull'||e.kind==='gull')continue;
      const d=dist(e,other),space=spec.radius+fauna(s,other.kind).radius;
      if(d>0&&d<space){
        const p={x:e.x+(e.x-other.x)/d*25*unit*dt,y:e.y+(e.y-other.y)/d*25*unit*dt};
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
  if(!Array.isArray(c.enemies)||c.enemies.length>(s.generator>=3?13:9)||new Set(c.enemies.map(e=>e.id)).size!==c.enemies.length)return false;
  if(c.enemies.some(e=>('asleep'in e)&&(typeof e.asleep!=='boolean'||!finite(e.awareness,0,.3))))return false;
  if(c.enemies.some(e=>!Number.isInteger(e.stash)||!finite(e.stash,0,16)||(e.kind!=='gull'&&e.stash!==0)))return false;
  if(c.enemies.some(e=>!FAUNA[e.kind]||typeof e.id!=='string'||!['idle','warn','strike','recover'].includes(e.phase)||!finite(e.hp,0,FAUNA[e.kind].hp)||!finite(e.x,0,3400)||!finite(e.y,0,1800)||!finite(e.homeX,0,3400)||!finite(e.homeY,0,1800)||!finite(e.angle,-Math.PI,Math.PI)||!finite(e.left,-.02,6)||!finite(e.hit,0,.23)||!finite(e.stride,0,1e9)||!finite(e.dead,0,.66)||!Number.isInteger(e.stolen)||!finite(e.stolen,0,12)||typeof e.moving!=='boolean'||typeof e.alert!=='boolean'||(e.kind!=='gull'&&!walkableAt(s.map,e,0))))return false;
  if(!Array.isArray(c.shots)||c.shots.length>4||c.shots.some(p=>!finite(p.x,-400,3800)||!finite(p.y,-400,2200)||!finite(p.vx,-390,390)||!finite(p.vy,-390,390)||!finite(p.left,0,.85)))return false;
  return Array.isArray(c.effects)&&c.effects.length<=40&&c.effects.every(f=>finite(f.x,-400,3800)&&finite(f.y,-400,2200)&&finite(f.left,0,.31)&&['empty','shell','hit','hurt','defeat'].includes(f.kind));
}
