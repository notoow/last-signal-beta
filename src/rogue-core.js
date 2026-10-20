import {generateHarbor,GENERATOR_VERSION,DEPTHS,inside,waterAt,shoreBuildings,walkableAt} from './rogue-map.js';
import {newSkillState,activateCaptainSkill,advanceSkill,validateSkill} from './captain-skills.js';
import {CAPTAIN_VESSELS} from './captain-vessels.js';
import {newEncounter,tickEncounter,shoreAttack,validateEncounter,toolBerth,FLOOR_TOOLS,SHORE_SITES,hasTool} from './shore-encounters.js';
import {newSurvey,updateSurvey,validSurvey} from './rogue-vision.js';
import {newRogueTow,towControl,tickRogueTow,deliverRogueTow,validRogueTow} from './rogue-tow.js';
import {WATER_PROFILE,waterMotion,stepShipMotion,releaseShipAssist} from './ship-motion.js';
import {dockStatus,dockHint} from './docking-readiness.js';
export const RUN_VERSION=5;
export const CAPTAINS={
  woo:{name:'Woo',hp:120,boost:60,fuel:1,thrust:1,pull:1,note:'내구 120 · 부스터 60'},
  park:{name:'Park',hp:90,boost:110,fuel:1,thrust:1,pull:1,note:'내구 90 · 부스터 110'},
  han:{name:'Han',hp:100,boost:75,fuel:.75,thrust:.9,pull:1,note:'연료 소모 −25% · 추진력 −10%'},
  jeong:{name:'Jeong',hp:105,boost:70,fuel:1,thrust:.9,pull:1.2,note:'견인 전달 +20% · 추진력 −10%'}
};
export const BUILDS={standard:'표준선',bilge:'침수 발전선',winch:'축력 윈치선'};
export const GEAR={motor:'개량 추진기',pump:'배수 펌프',winch:'강화 견인줄',tank:'보조 연료통',plating:'충격 격벽',turbine:'침수 터빈'};
export const SAVE_KEY='lastsignal.rogue.v1';
const SHORE_RANGE={search:32,boarding:36};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const level=(s,id)=>s.equipment.filter(x=>x===id).length;
export const maxHp=s=>CAPTAINS[s.captain].hp+level(s,'plating')*15;
export const maxFuel=s=>140+level(s,'tank')*30;
export const speed=b=>Math.hypot(b.vx,b.vy);
function say(s,id,text,brief=text){if(s.log.some(l=>l.id===id))return;s.log.push({id,text,time:s.time,depth:s.depth});s.radio={text:brief,left:7};}
function floor(s){
  if(s.skill){s.skill.left=0;s.skill.vector=null;s.skill.decoy=null;}
  s.map=generateHarbor(s.seed,s.depth,s.generator);
  const hull=CAPTAIN_VESSELS[s.captain];
  s.boat={x:s.map.spawn.x,y:s.map.spawn.y,angle:0,omega:0,vx:0,vy:0,length:hull.length,width:hull.width,inv:0};
  s.mode='sailing';s.mooring=null;s.person=null;s.claimed=[];s.work=0;s.noise=null;s.secretFound=false;
  s.dogs=s.map.berths.slice(1).map(b=>{
    const x=b.loot.x+80,y=s.generator===1?b.loot.y+20:Math.max(b.loot.y+40,s.map.islands[b.island].y+175);
    return {x,y,homeX:x,homeY:y,island:b.island,alert:0,bite:0};
  });
  if(s.combat!==null)s.combat=newEncounter(s,s.combat?.ammo??12);
  s.survey=s.combat?newSurvey():null;
  s.tow=s.combat&&s.generator===2?newRogueTow(s):null;
  s.boss={active:false,cleared:false,phase:'idle',timer:0,cycle:0,aim:0,parts:Array(s.depth===0?2:3).fill(30),hook:-1,rest:70,tension:0};
  s.charge=0;s.valve=false;s.netResolved=false;s.netChoice=null;
  say(s,'arrival-'+s.depth,DEPTHS[s.depth].arrival);
  updateSurvey(s);
  if(s.combat)say(s,'counter-clue-'+s.depth,'Park: '+SHORE_SITES[toolBerth(s).island]+'에 '+FLOOR_TOOLS[s.depth].clue);
}
export function createRun(seed,captain='woo',build='standard',paint='harbor'){
  if(!Object.hasOwn(CAPTAINS,captain)||!Object.hasOwn(BUILDS,build)||!['harbor','ochre','red'].includes(paint))throw Error('Unknown loadout');
  const s={version:RUN_VERSION,physicsProfile:WATER_PROFILE,generator:GENERATOR_VERSION,seed,depth:0,captain,build,paint,
    status:'playing',time:0,fuel:140,hp:CAPTAINS[captain].hp,boost:CAPTAINS[captain].boost,
    flood:0,valve:false,charge:0,crewHp:100,equipment:[],pendingGear:null,log:[],radio:null,reason:'',debris:false,netChoices:[],skill:newSkillState(),tools:[],combat:undefined};
  floor(s);return s;
}
export function hullPoints(b){
  const end=(b.length-b.width)/2;
  return [-end,0,end].map(d=>({x:b.x+Math.cos(b.angle)*d,y:b.y+Math.sin(b.angle)*d}));
}
function hullClear(s,b){return hullPoints(b).every(p=>waterAt(s.map,p,b.width/2));}
export const berthReadiness=(s,b)=>dockStatus({boat:s.boat,berth:b,sailing:s.mode==='sailing',clear:hullClear(s,s.boat),spinningMatters:waterMotion(s)});
export const berthReady=(s,b)=>berthReadiness(s,b).ready;
export function partPosition(s,i){
  const count=s.boss.parts.length,a=Math.PI+(i-(count-1)/2)*.7;
  return {x:s.map.boss.x+Math.cos(a)*190,y:s.map.boss.y+Math.sin(a)*190};
}
export function objective(s){
  if(s.status==='lost')return {text:s.reason,target:null};
  if(s.status==='won')return {text:'세 계층 돌파 · 마지막 신호를 전달했다',target:null};
  if(s.mode==='ashore'){
    const b=s.map.berths.find(b=>!s.claimed.includes(b.id)&&distance(s.person,b.loot)<100)||s.map.berths.find(b=>b.id===s.mooring);
    const cache=s.map.berths.find(x=>!s.claimed.includes(x.id)&&distance(s.person,x.loot)<SHORE_RANGE.search);
    const home=s.map.berths.find(x=>x.id===s.mooring);
    let action=s.combat?'Space 근접 · V 투척 · Q 유인':'Q 유인';
    if(cache){
      const island=s.map.islands[cache.island],gear=GEAR[island.equipment];
      action=island.role==='equipment'?'F / R '+gear+' 회수 · 길게 누르기':
        'F '+(island.role==='fuel'?'연료 보충':'선체 수리')+' · R '+gear+' 회수 · 길게 누르기';
    }else if(distance(s.person,home.landing)<SHORE_RANGE.boarding)action='E 재승선';
    return s.claimed.includes(b.id)?{text:'배로 돌아가기',target:b.landing,action}:{text:'부두 수색',target:b.loot,action};
  }
  if(s.mode==='moored')return {text:'E · 하선 / Q · 계류 해제',target:s.map.berths.find(b=>b.id===s.mooring)};
  if(s.boss.cleared){
    const docking=berthReadiness(s,s.map.exit);
    return {text:docking.near?dockHint(docking,'ko',true):'탈출 부두에 세로로 천천히 접안 · E',target:s.map.exit};
  }
  if(s.boss.active){
    if(s.boss.hook>=0)return {text:'고리에서 멀어지며 견인 · 줄이 붉어지면 E로 놓기',target:partPosition(s,s.boss.hook)};
    if(s.boss.phase==='recover')return {text:'노출된 구동 고리에 접근 · E로 연결',target:partPosition(s,s.boss.parts.findIndex(h=>h>0))};
    return {text:s.depth===0?'흡입류·크레인 예고 밖으로 이동':s.depth===1?'방류 예고 띠에서 벗어나기':'탐조등이 멈추면 빛 밖으로 회피',target:null};
  }
  const nearby=s.map.berths.find(b=>!s.claimed.includes(b.id)&&distance(s.boat,b)<130);
  if(nearby)return {text:dockHint(berthReadiness(s,nearby)),target:nearby};
  const special=s.combat&&!hasTool(s,FLOOR_TOOLS[s.depth].id)?toolBerth(s):null;
  const berth=special||s.map.berths.find(b=>!s.claimed.includes(b.id));
  if(special)return {text:SHORE_SITES[special.island]+' 수색 · '+FLOOR_TOOLS[s.depth].name+' 확보 / 기존 장비로 돌파도 가능',target:special};
  return {text:berth?'부두에 평행하게 감속 · E 계류 / 장비 없이 보스 진입도 가능':'바깥 해역의 기계선을 정지시켜 탈출로 열기',target:berth||s.map.boss};
}
function damage(s,n,reason){
  if(s.boat.inv>0||s.status!=='playing')return;
  const brace=s.captain==='woo'&&s.skill.left>0?.25:1;
  s.hp=Math.max(0,s.hp-n*brace/(1+level(s,'plating')*.15));s.boat.inv=.8;
  if(s.hp<=0){s.status='lost';s.reason=reason;}
}
export function interact(s,action,input={}){
  if(s.status!=='playing')return false;
  if(action==='tow'||action==='cargoAnchor'){
    const result=towControl(s,action);s.radio={text:result.reason,left:5};return result.ok;
  }
  if(action==='ranged'||action==='melee')return shoreAttack(s,action,input.aim);
  if(action==='captain')return activateCaptainSkill(s,input);
  const b=s.boat;
  if(action==='special'){
    if(s.build==='bilge'){s.valve=!s.valve;return true;}
    if(s.build==='winch'&&s.charge>=35&&s.boss.hook>=0&&s.boss.phase==='recover'&&s.boss.tension>.1){
      const p=partPosition(s,s.boss.hook),d=distance(b,p)||1;
      b.vx+=(b.x-p.x)/d*120;b.vy+=(b.y-p.y)/d*120;
      s.boss.parts[s.boss.hook]=Math.max(0,s.boss.parts[s.boss.hook]-s.charge*.22);
      s.charge=0;s.fuel=Math.max(0,s.fuel-3);return true;
    }return false;
  }
  if(action==='horn'){
    if(s.mode==='moored'){s.mode='sailing';s.mooring=null;return true;}
    const origin=s.person||b;
    s.noise={x:origin.x+Math.cos(origin.angle||0)*90,y:origin.y+Math.sin(origin.angle||0)*90,left:5};
    return true;
  }
  if(action==='cutnet'&&s.mode==='sailing'&&distance(b,{x:2110,y:500})<95&&!s.netResolved){
    s.netResolved=true;s.netChoice='cut';s.netChoices.push('cut');s.debris=true;
    say(s,'net-cut-'+s.depth,'Park: 줄은 끊었어. 풀린 그물이 바깥 수로로 떠내려가고 있어.');return true;
  }
  if(action!=='interact')return false;
  if(s.mode==='ashore'){
    const berth=s.map.berths.find(x=>x.id===s.mooring);
    if(distance(s.person,berth.landing)<SHORE_RANGE.boarding){s.person=null;s.mode='moored';return true;}
    return false;
  }
  if(s.mode==='moored'){
    const berth=s.map.berths.find(x=>x.id===s.mooring);s.person={...berth.landing,angle:-Math.PI/2};s.mode='ashore';
    say(s,'shore-'+s.depth,s.combat?'Park: Space로 갈고리를 휘두르고, V나 클릭으로 고철을 던져. 게가 집게를 들면 뒤로 빠져. Q 깡통으로 짐승을 유인할 수도 있어.':'Park: 상자를 확인해. 발소리가 크면 들개가 따라올 거야. Q로 빈 깡통을 던져 시선을 돌릴 수 있어.','Park: 상자를 확인해. 짐승이 몰려오면 배로 돌아와.');
    if(s.tow?.connected&&!s.tow.anchor)s.radio={text:'Park: 보급정 닻을 안 내렸어. 우리 배만 계류돼 있어. 떠밀리기 전에 다시 타서 H로 닻을 내려.',left:7};
    return true;
  }
  if(s.boss.hook>=0){s.boss.hook=-1;s.charge=0;return true;}
  if(s.depth===2&&s.map.secret&&distance(b,{x:2080,y:190})<90&&!s.secretFound){
    s.secretFound=true;say(s,'test-site','Woo: 「백야 해상 핵실험 관측소 — 영구 폐쇄」… 실험 날짜는 지워졌는데, 바다 시료 채취표는 아직 여기 있네.');return true;
  }
  if(s.boss.cleared&&berthReady(s,s.map.exit)){
    if(deliverRogueTow(s)){
      s.fuel=Math.min(maxFuel(s),s.fuel+20);s.crewHp=Math.min(100,s.crewHp+20);
      say(s,'supply-delivered-'+s.depth,'Woo: 보급정까지 돌아왔어. 남은 연료와 구급품을 나눠 받았어.');
    }
    if(s.depth===2){s.status='won';say(s,'ending','Park: 명부 전송됐어. 이제 등대가 돌아오는 배를 비춰. 아직 사람은 남아 있어.');}
    else{s.depth++;s.fuel=Math.min(maxFuel(s),s.fuel+30);s.hp=Math.min(maxHp(s),s.hp+18);s.flood=Math.max(0,s.flood-15);floor(s);}
    return true;
  }
  if(s.boss.phase==='recover'&&!s.tow?.connected){
    const id=s.boss.parts.findIndex((h,i)=>h>0&&distance(b,partPosition(s,i))<105);
    if(id>=0){s.boss.hook=id;s.boss.rest=clamp(distance(b,partPosition(s,id)),45,95);return true;}
  }
  const berth=s.map.berths.find(x=>berthReady(s,x));
  if(berth){
    releaseShipAssist(s);s.mooring=berth.id;s.mode='moored';
    Object.assign(b,{x:berth.x,y:berth.y,angle:berth.angle,omega:0,vx:0,vy:0});return true;
  }
  return false;
}
function reward(s,berth,equipment){
  const island=s.map.islands[berth.island];
  let foundTool=null;
  if(s.combat){
    s.combat.ammo=Math.min(12,s.combat.ammo+4);
    if(berth.id===toolBerth(s).id&&!hasTool(s,FLOOR_TOOLS[s.depth].id)){
      foundTool=FLOOR_TOOLS[s.depth];s.tools.push(foundTool.id);
    }
  }
  if(equipment||island.role==='equipment'){
    if(s.equipment.length>=6)s.pendingGear=island.equipment;
    else s.equipment.push(island.equipment);
    say(s,'loot-'+s.depth+'-'+berth.id,'Woo: '+GEAR[island.equipment]+' 회수. 같은 장비도 중첩해서 실을 수 있어.');
  }else if(island.role==='fuel')s.fuel=Math.min(maxFuel(s),s.fuel+45);
  else{s.hp=Math.min(maxHp(s),s.hp+35);s.flood=Math.max(0,s.flood-20);}
  s.claimed.push(berth.id);s.work=0;
  say(s,'discovery-'+s.depth,DEPTHS[s.depth].discovery);
  if(foundTool)say(s,'tool-'+s.depth,'Park: '+foundTool.name+' 찾았어. '+foundTool.effect+'. 다음 층에도 가져갈 수 있어.');
}
export function resolveGear(s,index=null){
  if(!s.pendingGear)return false;
  if(index===null)s.fuel=Math.min(maxFuel(s),s.fuel+15);
  else if(Number.isInteger(index)&&index>=0&&index<s.equipment.length)s.equipment[index]=s.pendingGear;
  else return false;
  s.pendingGear=null;s.fuel=Math.min(s.fuel,maxFuel(s));s.hp=Math.min(s.hp,maxHp(s));return true;
}
function shore(s,input,dt){
  const p=s.person,berth=s.map.berths.find(b=>b.id===s.mooring),island=s.map.islands[berth.island];
  const old={...p},buildings=shoreBuildings(island);
  const mag=Math.hypot(input.x||0,input.y||0),fast=input.boost;
  if(mag){p.angle=Math.atan2(input.y,input.x);const v=(fast?100:58)*(s.combat?.action?.kind==='melee'?.55:1);
    if(s.generator===1){
      p.x=clamp(p.x+input.x/mag*v*dt,island.x+12,island.x+island.w-12);
      p.y=clamp(p.y+input.y/mag*v*dt,island.y+12,island.y+island.h-12);
      if(buildings.some(building=>inside(p,building,9))){p.x=old.x;p.y=old.y;}
    }else{
      const nx=p.x+input.x/mag*v*dt,ny=p.y+input.y/mag*v*dt;
      if(walkableAt(s.map,{x:nx,y:p.y}))p.x=nx;
      if(walkableAt(s.map,{x:p.x,y:ny}))p.y=ny;
    }
  }
  if(s.combat){const traveled=distance(p,old);s.combat.moving=traveled>.01;s.combat.stride+=traveled;}
  for(const dog of s.combat?[]:s.dogs){
    if(s.generator===1&&dog.island!==berth.island)continue;
    if(s.generator!==1&&distance(dog,p)>400&&!(s.noise?.left>0&&distance(dog,s.noise)<230))continue;
    dog.bite=Math.max(0,dog.bite-dt);
    const sight=s.generator===1||Array.from({length:8},(_,i)=>({x:dog.x+(p.x-dog.x)*(i+1)/9,y:dog.y+(p.y-dog.y)*(i+1)/9})).every(q=>walkableAt(s.map,q,1));
    const heard=distance(dog,p)<(fast&&mag?200:95)&&sight;
    const noiseHeard=s.noise?.left>0&&(s.generator===1||distance(dog,s.noise)<230);
    const target=noiseHeard?s.noise:heard?p:{x:dog.homeX+Math.sin(s.time*.5)*35,y:dog.homeY};
    dog.alert=heard||noiseHeard?1:0;
    const d=distance(dog,target),v=dog.alert?77:28;
    if(d>3){
      const nx=dog.x+(target.x-dog.x)/d*v*dt,ny=dog.y+(target.y-dog.y)/d*v*dt;
      if(s.generator===1){dog.x=clamp(nx,island.x+10,island.x+island.w-10);dog.y=clamp(ny,island.y+10,island.y+island.h-10);}
      else{if(walkableAt(s.map,{x:nx,y:dog.y},7))dog.x=nx;if(walkableAt(s.map,{x:dog.x,y:ny},7))dog.y=ny;}
    }
    if(distance(dog,p)<20&&!dog.bite){s.crewHp=Math.max(0,s.crewHp-12);dog.bite=1.6;s.work=0;if(!s.crewHp){s.status='lost';s.reason='육상에서 선원이 쓰러졌다';}}
  }
  const found=s.map.berths.find(b=>!s.claimed.includes(b.id)&&distance(p,b.loot)<SHORE_RANGE.search);
  if(found&&(input.recover||input.equipment)&&(!s.combat||(!s.combat.hit&&!s.combat.action))){
    s.work+=dt;if(s.work>=1.8)reward(s,found,!!input.equipment);
  }else s.work=0;
}
export function bossAttack(s){
  const b=s.boss,origin=s.map.boss,a=angleDiff(Math.atan2(s.boat.y-origin.y,s.boat.x-origin.x),b.aim),d=distance(s.boat,origin);
  if(b.phase!=='attack')return false;
  if(s.depth===0)return d<360&&Math.abs(a)<.46;
  if(s.depth===1)return Math.abs(s.boat.y-(origin.y+Math.sin(b.aim)*220))<70&&s.boat.x>2220;
  return d<620&&Math.abs(a)<.23;
}
function bossTick(s,dt){
  const b=s.boss,p=s.map.boss,boat=s.boat;
  if(b.cleared)return;
  if(!b.active&&boat.x>2210){b.active=true;b.phase='warn';b.timer=2.8;b.aim=Math.atan2(boat.y-p.y,boat.x-p.x);
    say(s,'boss-'+s.depth,s.depth===0?'Woo: 크레인이 멈춘 뒤에 구동 고리가 드러나. 고리를 걸고 바깥으로 당겨!':s.depth===1?'Park: 방류 전에 수면에 띠가 보여. 물살이 멎으면 터빈 고리를 당기자.':'Woo: 빛이 우리를 쫓아와. 조준이 멈추면 벗어나. 발전기 고리는 충전하는 동안 노출돼.');}
  if(!b.active)return;
  if(b.parts.every(h=>h<=0)){
    b.cleared=true;b.hook=-1;b.tension=0;s.charge=0;
    say(s,'boss-clear-'+s.depth,'Park: 구동부가 멈췄어. 탈출 부두에 접안하면 다음 항로로 이어져.');return;
  }
  // Jeong earns extra pulling time only while physically holding a taut line.
  const a=s.skill,held=s.captain==='jeong'&&a.left>0&&b.hook>=0&&b.tension>=.25&&b.phase==='recover';
  if(s.captain==='jeong'&&a.left>0&&!held)a.left=0;
  if(!held)b.timer-=dt;const broken=b.parts.filter(h=>h<=0).length;
  const target=a.left>0&&a.decoy?a.decoy:boat;
  if(b.phase==='warn'&&b.timer>1.2&&(s.depth===2||a.decoy)&&!(s.depth===2&&hasTool(s,'shutter')))b.aim=Math.atan2(target.y-p.y,target.x-p.x);
  if(b.timer<=0){
    if(b.phase==='warn'){b.phase='attack';b.timer=2.8+broken*.4;}
    else if(b.phase==='attack'){b.phase='recover';b.timer=7-broken*.4+(hasTool(s,'ratchet')?3:0);}
    else{b.phase='warn';b.timer=2.8-broken*.3;b.hook=-1;s.charge=0;b.cycle++;b.aim=Math.atan2(target.y-p.y,target.x-p.x);}
  }
  if(b.phase==='attack'){
    const shield=s.shielded;
    if(s.depth===0){const d=distance(boat,p)||1;if(d<620){const force=(35+broken*13)*(shield?.25:1);boat.vx+=(p.x-boat.x)/d*force*dt;boat.vy+=(p.y-boat.y)/d*force*dt;}}
    if(bossAttack(s)){damage(s,(18+s.depth*4)*(shield?.6:1),'기계선의 공격으로 선체가 파손됐다');if(s.depth===1)boat.vx-=150*(shield?.25:1)*dt;}
  }
  if(b.hook>=0){
    const anchor=partPosition(s,b.hook),d=distance(boat,anchor)||1,dx=(boat.x-anchor.x)/d,dy=(boat.y-anchor.y)/d;
    b.tension=clamp((d-b.rest)/85,0,1);
    const outward=boat.vx*dx+boat.vy*dy;
    boat.vx-=dx*b.tension*45*dt;boat.vy-=dy*b.tension*45*dt;
    if(b.tension>.15&&outward>4)b.parts[b.hook]=Math.max(0,b.parts[b.hook]-outward*.3*b.tension*(1+level(s,'winch')*.3)*CAPTAINS[s.captain].pull*dt);
    if(s.build==='winch')s.charge=clamp(s.charge+(b.tension>.15?65:-12)*dt,0,100);
    if(d>260||b.parts[b.hook]<=0){b.hook=-1;s.charge=0;b.tension=0;}
  }else b.tension=0;
}
export function tickRun(s,input,elapsed){
  if(s.status!=='playing'||s.pendingGear)return;
  input={...input,x:Number.isFinite(input.x)?clamp(input.x,-1,1):0,y:Number.isFinite(input.y)?clamp(input.y,-1,1):0};
  let left=clamp(elapsed,0,.1);
  while(left>0){const dt=Math.min(left,1/120);left-=dt;step(s,input,dt);}
  updateSurvey(s);
}
function step(s,input,dt){
  if(s.status!=='playing')return;
  s.time+=dt;s.boat.inv=Math.max(0,s.boat.inv-dt);
  advanceSkill(s,dt);
  if(s.radio)s.radio.left=Math.max(0,s.radio.left-dt);
  if(s.noise)s.noise.left=Math.max(0,s.noise.left-dt);
  tickRogueTow(s,dt);
  tickEncounter(s,input,dt);
  if(s.status!=='playing')return;
  if(s.mode==='ashore'){shore(s,input,dt);return;}
  if(s.mode==='moored')return;
  const braced=s.captain==='woo'&&s.skill.left>0,dashing=s.captain==='park'&&s.skill.left>0;
  const b=s.boat,mag=braced||dashing?0:Math.hypot(input.x||0,input.y||0);
  let boost=!!input.boost&&mag>0&&s.boost>0,fuelRate=.025+(mag?.13:0)+(boost?.24:0);
  const old={...b},brake=!!input.brake,precision=!!input.precision;
  const bilge=s.build==='bilge'?(.85+Math.min(s.flood,55)*(.018+level(s,'turbine')*.004)):1;
  const motor=(1+level(s,'motor')*.12)*CAPTAINS[s.captain].thrust;
  if(waterMotion(s)){
    const motion=stepShipMotion(s,input,dt,bilge*motor);boost=motion.boosting;fuelRate=motion.fuelRate;
  }else{
   if(mag){
    const a=Math.atan2(input.y,input.x);
    const turn=CAPTAIN_VESSELS[s.captain].turn;
    b.angle+=clamp(angleDiff(a,b.angle),-turn*dt,turn*dt);
    // Reverse thrust while the requested direction is behind the bow lets a
    // skipper back out of a quay instead of powering farther into it.
    const alignment=Math.cos(angleDiff(a,b.angle));
    const thrust=(boost?220:precision?40:110)*alignment;
    // The helm turns first; thrust follows the bow. Inertia makes wide turns real.
    b.vx+=Math.cos(b.angle)*thrust*bilge*motor*dt;
    b.vy+=Math.sin(b.angle)*thrust*bilge*motor*dt;
  }
  // Real ambient drift also affects the player; neutral input does not target zero world velocity.
  b.vx+=(s.map.current.x-b.vx*(brake?4:precision?1.6:.85))*dt;
  b.vy+=(s.map.current.y-b.vy*(brake?4:precision?1.6:.85))*dt;
  }
  s.boost=clamp(s.boost+(boost?-23:8+level(s,'turbine')*2)*dt,0,CAPTAINS[s.captain].boost);
  s.fuel=Math.max(0,s.fuel-fuelRate*CAPTAINS[s.captain].fuel*dt);
  if(s.build==='bilge'){
    s.flood=clamp(s.flood+(s.valve?2.4:-.3-level(s,'pump')*.7)*dt,0,100);
    if(s.flood>=100){s.status='lost';s.reason='밸브를 닫지 못해 침몰했다';}
  }
  if(s.fuel<=0){s.status='lost';s.reason='연료가 소진되어 항해를 잃었다';return;}
  s.shielded=hasTool(s,'baffle')&&brake;
  bossTick(s,dt);
  if(braced&&!waterMotion(s)){b.vx=0;b.vy=0;}
  if(dashing){b.vx=s.skill.vector.x*290;b.vy=s.skill.vector.y*290;}
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  const bossCollision=!s.boss.cleared&&[-110,0,110].some(dx=>distance(b,{x:s.map.boss.x+dx,y:s.map.boss.y})<58);
  if(!hullClear(s,b)||bossCollision){const impact=speed(b);Object.assign(b,{x:old.x,y:old.y,angle:old.angle,omega:0,vx:-b.vx*.18,vy:-b.vy*.18});if(impact>38)damage(s,(impact-25)*.15,'충돌로 선체가 파손됐다');}
  // Cutting is fast; loose nets impede the next layer's northern shortcut.
  if(s.debris&&s.depth>0&&distance(b,{x:2070,y:350})<100){b.vx*=Math.exp(-2*dt);b.vy*=Math.exp(-2*dt);s.fuel=Math.max(0,s.fuel-.3*dt);}
  if(!s.netResolved&&distance(b,{x:2110,y:500})<70){b.vx*=Math.exp(-2.3*dt);b.vy*=Math.exp(-2.3*dt);}
  if(!s.netResolved&&distance(b,{x:2110,y:500})<95&&input.recover&&speed(b)<25){
    s.work+=dt;if(s.work>=3){s.netResolved=true;s.netChoice='recovered';s.netChoices.push('recovered');s.debris=false;s.fuel=Math.max(0,s.fuel-2);s.work=0;say(s,'net-recover-'+s.depth,'Woo: 폐어망은 선미에 실었어. 다음 수로까지 떠내려갈 일은 없겠네.');}
  }else s.work=0;
}
export function encodeRun(s){return JSON.stringify(s);}
export function restoreRun(raw){
  try{
    if(typeof raw!=='string'||raw.length>160000)return null;
    const s=JSON.parse(raw),finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
    if(![1,2,3,4,RUN_VERSION].includes(s.version)||![1,GENERATOR_VERSION].includes(s.generator)||!Number.isInteger(s.seed)||!finite(s.seed,0,0xffffffff)||!Number.isInteger(s.depth)||!finite(s.depth,0,2))return null;
    const oldHull=s.version<3;
    if(s.version<5){s.physicsProfile='legacy';if(s.boat)s.boat.omega=0;}
    if(!['legacy',WATER_PROFILE].includes(s.physicsProfile))return null;
    if(!Object.hasOwn(CAPTAINS,s.captain)||!Object.hasOwn(BUILDS,s.build)||!['harbor','ochre','red'].includes(s.paint)||!['playing','won','lost'].includes(s.status))return null;
    if(!Array.isArray(s.equipment)||s.equipment.length>6||s.equipment.some(g=>!Object.hasOwn(GEAR,g)))return null;
    if(s.pendingGear!==null&&(!Object.hasOwn(GEAR,s.pendingGear)||s.equipment.length!==6))return null;
    if(!finite(s.hp,0,maxHp(s))||!finite(s.crewHp,0,100)||!finite(s.fuel,0,maxFuel(s))||!finite(s.boost,0,CAPTAINS[s.captain].boost)||!finite(s.flood,0,100)||!finite(s.charge,0,100)||!finite(s.time,0,1e7))return null;
    s.map=generateHarbor(s.seed,s.depth,s.generator);
    if(s.version===1)s.skill=newSkillState();
    if(s.version<4){s.combat=null;s.tools=[];s.survey=null;s.tow=null;}
    s.version=RUN_VERSION;
    if(!validateEncounter(s,finite)||!validSurvey(s.survey)||!validRogueTow(s.tow,finite,s.map))return null;
    if(!validateSkill(s,finite))return null;
    const b=s.boat;if(!b||!finite(b.x,0,s.map.width)||!finite(b.y,0,s.map.height)||!finite(b.vx,-2000,2000)||!finite(b.vy,-2000,2000)||!finite(b.angle,-1e7,1e7)||!finite(b.inv,0,2))return null;
    if(!finite(b.omega,-20,20))return null;
    const hull=CAPTAIN_VESSELS[s.captain];b.length=hull.length;b.width=hull.width;
    if(!['sailing','moored','ashore'].includes(s.mode))return null;
    if(s.mode!=='sailing'&&!s.map.berths.some(b=>b.id===s.mooring))return null;
    // Fixed mooring cannot preserve a pre-landing turn for the next departure.
    if(s.mode!=='sailing')b.omega=0;
    if(s.mode==='ashore'&&(!s.person||!finite(s.person.x,0,3400)||!finite(s.person.y,0,1800)||!finite(s.person.angle,-1e7,1e7)||(s.generator===1?!inside(s.person,s.map.islands[s.map.berths.find(b=>b.id===s.mooring).island]):!walkableAt(s.map,s.person,0))))return null;
    if(!Array.isArray(s.claimed)||new Set(s.claimed).size!==s.claimed.length||s.claimed.some(id=>!s.map.berths.some(b=>b.id===id)))return null;
    const boss=s.boss;if(!boss||!['idle','warn','attack','recover'].includes(boss.phase)||!Array.isArray(boss.parts)||boss.parts.length!==(s.depth===0?2:3)||boss.parts.some(h=>!finite(h,0,30))||!Number.isInteger(boss.hook)||boss.hook< -1||boss.hook>=boss.parts.length||!finite(boss.timer,-.1,10)||!finite(boss.aim,-Math.PI,Math.PI)||!finite(boss.rest,45,95)||!finite(boss.tension,0,1)||!finite(boss.cycle,0,1e6)||typeof boss.active!=='boolean'||typeof boss.cleared!=='boolean')return null;
    if(!Array.isArray(s.dogs)||s.dogs.length!==2||s.dogs.some(d=>![d.x,d.y,d.homeX,d.homeY,d.island,d.alert,d.bite].every(Number.isFinite)||!s.map.islands[d.island]||(s.generator===1?!inside(d,s.map.islands[d.island]):!walkableAt(s.map,d,0))))return null;
    if(!Array.isArray(s.log)||s.log.length>80||s.log.some(l=>typeof l.id!=='string'||typeof l.text!=='string'||l.text.length>500||!finite(l.time,0,s.time)||!finite(l.depth,0,2)))return null;
    if(typeof s.valve!=='boolean'||typeof s.debris!=='boolean'||typeof s.secretFound!=='boolean'||typeof s.netResolved!=='boolean'||!finite(s.work,0,3)||!Array.isArray(s.netChoices)||s.netChoices.length>3||s.netChoices.some(x=>!['cut','recovered'].includes(x)))return null;
    if(s.noise&&(!finite(s.noise.x,-100,3500)||!finite(s.noise.y,-100,1900)||!finite(s.noise.left,0,5)))return null;
    if(s.radio&&(typeof s.radio.text!=='string'||s.radio.text.length>500||!finite(s.radio.left,0,7)))return null;
    if(typeof s.reason!=='string'||s.reason.length>200)return null;
    // Older runs used a single 64x28 hull. Expand into adjacent water rather
    // than leave a resumed wider vessel trapped inside a quay; never refill it.
    if(oldHull&&!hullClear(s,b)){
      const origin={x:b.x,y:b.y};let found=false;
      for(let r=2;r<=48&&!found;r+=2)for(let i=0;i<16&&!found;i++){
        b.x=origin.x+Math.cos(i*Math.PI/8)*r;b.y=origin.y+Math.sin(i*Math.PI/8)*r;
        found=hullClear(s,b);
      }
      if(!found)return null;
      b.vx=0;b.vy=0;
    }
    return s;
  }catch{return null;}
}
