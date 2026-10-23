import {waterAt} from './rogue-map.js';
import {usesDredger,craneLockTime} from './dredger-counterplay.js';
import {usesSluice,SLUICE,sluiceExposed} from './sluice-counterplay.js';
import {usesLighthouse,lighthouseSight,LIGHTHOUSE} from './lighthouse-counterplay.js';

export const CAPTAIN_SKILLS={
  woo:{name:'비상 버팀',cooldown:24,duration:2.6,boost:15,fuel:1,
    instruction:'G · 강하게 감속하며 버티기 / 다시 G로 해제',
    effect:'2.6초간 버팀 장치를 가동하고 받는 선체 피해를 75% 줄입니다.',
    risk:'고속에서는 제동 거리가 생깁니다. 추진 입력 불가 · 부스터 15 · 연료 1 소모.'},
  park:{name:'횡추진',cooldown:12,duration:.28,boost:25,fuel:1,
    instruction:'방향키 + G · 선수 방향을 유지하며 옆으로 회피',
    effect:'짧게 옆으로 밀어 공격 범위를 벗어납니다.',
    risk:'충돌·공격 피해는 그대로. 부스터 25 · 연료 1 소모.'},
  han:{name:'미끼 부표',cooldown:25,duration:4,boost:0,fuel:2,
    instruction:'공격 예고 중 방향키 + G · 조준 유도',
    effect:'던진 부표가 조준을 끌어갑니다. 조준이 고정되면 빠져나오세요.',
    risk:'조준이 고정된 뒤에는 사용 불가. 연료 2 소모.'},
  jeong:{name:'구동부 결박',cooldown:22,duration:3,boost:20,fuel:2,
    instruction:'고리에 연결하고 줄을 팽팽히 당기며 G',
    effect:'장력을 유지하는 동안 최대 3초간 고리 노출 시간을 붙잡습니다.',
    risk:'줄이 느슨해지거나 끊어지면 즉시 종료. 부스터 20 · 연료 2 소모.'}
};
export const newSkillState=()=>({cooldown:0,left:0,uses:0,vector:null,decoy:null});
const length=(x,y)=>Math.hypot(x,y);
export function skillStatus(s){
  const spec=CAPTAIN_SKILLS[s.captain],a=s.skill;
  const result=(ready,reason)=>({ready,reason,...spec});
  if(s.status!=='playing')return result(false,'항해 종료');
  if(s.pendingGear)return result(false,'장비 선택 중');
  if(s.mode!=='sailing')return result(false,'운항 중 사용');
  if(a.left>0)return result(false,s.captain==='woo'?'G · 버팀 해제':'사용 중');
  if(a.cooldown>0)return result(false,Math.ceil(a.cooldown)+'초 후');
  if(s.boost<spec.boost)return result(false,'부스터 '+spec.boost+' 필요');
  if(s.fuel<=spec.fuel)return result(false,'연료 여유 필요');
  if(s.captain==='han'&&(!s.boss.active||s.boss.cleared||s.boss.phase!=='warn'||!usesLighthouse(s)&&s.boss.timer<=(usesDredger(s)?craneLockTime(s):usesSluice(s)?SLUICE.lockTime:1.2)))return result(false,usesLighthouse(s)?'탐조등 탐색 중 사용':'공격 예고 초반에 사용');
  if(s.captain==='jeong'&&(!(usesLighthouse(s)?s.boss.phase==='warn':usesSluice(s)?sluiceExposed(s):s.boss.phase==='recover')||s.boss.hook<0||s.boss.tension<.35))return result(false,usesLighthouse(s)?'탐색 중 · 케이블 연결 · 장력 35% 필요':usesSluice(s)?'방류 중 · 고리 연결 · 장력 35% 필요':'고리 연결 · 장력 35% 필요');
  return result(true,'준비');
}
export function activateCaptainSkill(s,input={}){
  const a=s.skill,spec=CAPTAIN_SKILLS[s.captain],b=s.boat;
  if(s.captain==='woo'&&a.left>0&&s.status==='playing'&&s.mode==='sailing'){
    a.left=0;s.radio={text:'Woo: 버팀 해제. 다시 움직인다.',left:3};return true;
  }
  const status=skillStatus(s);
  if(!status.ready){s.radio={text:(usesLighthouse(s)&&s.captain==='jeong'?'탐조등 붙잡기':spec.name)+' · '+status.reason,left:2};return false;}
  let x=Number.isFinite(input.x)?input.x:0,y=Number.isFinite(input.y)?input.y:0;
  const mag=length(x,y);if(mag){x/=mag;y/=mag;}else{x=Math.cos(b.angle);y=Math.sin(b.angle);}
  if(s.captain==='han'){
    const target={x:b.x+x*180,y:b.y+y*180};
    if(!waterAt(s.map,target,12)){s.radio={text:'Han: 부표를 던질 수 있는 수면을 골라.',left:3};return false;}
    if(usesLighthouse(s)&&(Math.hypot(target.x-s.map.boss.x,target.y-s.map.boss.y)>LIGHTHOUSE.range||!lighthouseSight(s,target))){
      s.radio={text:'Han: 탐조등에 보이는 수면으로 부표를 던져야 해.',left:3};return false;
    }
    a.decoy=target;
  }
  if(s.captain==='park'){
    const side=mag?Math.sign(Math.cos(b.angle)*y-Math.sin(b.angle)*x)||-1:-1;
    a.vector={x:-Math.sin(b.angle)*side||0,y:Math.cos(b.angle)*side||0};
  }
  a.left=spec.duration;a.cooldown=spec.cooldown;a.uses++;
  s.boost-=spec.boost;s.fuel-=spec.fuel;
  s.radio={text:{
    woo:'Woo: 버팀 장치 가동! 속도부터 죽인다.',
    park:'Park: 옆으로 빠진다. 선수는 그대로!',
    han:'Han: 부표 쪽으로 시선 돌렸어. 지금 벗어나!',
    jeong:usesLighthouse(s)?'Jeong: 중계기로 회전 잠갔어! 줄이 느슨해지기 전에 송신해!':usesSluice(s)?'Jeong: 방류를 붙잡았어! 줄이 느슨해지지 않게 버텨!':'Jeong: 구동부 잡았어! 줄 늘어지지 않게 계속 당겨!'
  }[s.captain],left:4};
  return true;
}
export function advanceSkill(s,dt){
  const a=s.skill,wasActive=a.left>0;
  a.cooldown=Math.max(0,a.cooldown-dt);a.left=Math.max(0,a.left-dt);
  if(wasActive&&!a.left){
    if(s.captain==='park'){s.boat.vx*=.15;s.boat.vy*=.15;}
    a.vector=null;a.decoy=null;
  }
}
export function validateSkill(s,finite){
  const a=s.skill,spec=CAPTAIN_SKILLS[s.captain];
  if(!a||!finite(a.cooldown,0,spec.cooldown)||!finite(a.left,0,spec.duration)||!Number.isInteger(a.uses)||!finite(a.uses,0,1e6))return false;
  if(a.vector!==null&&(s.captain!=='park'||!finite(a.vector.x,-1,1)||!finite(a.vector.y,-1,1)||Math.abs(length(a.vector.x,a.vector.y)-1)>.001))return false;
  if(a.decoy!==null&&(s.captain!=='han'||!finite(a.decoy.x,0,s.map.width)||!finite(a.decoy.y,0,s.map.height)))return false;
  if(a.left>0&&s.captain==='park'&&!a.vector||a.left>0&&s.captain==='han'&&!a.decoy)return false;
  return true;
}
