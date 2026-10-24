// A ten-minute day belongs to this voyage. Rest advances only the sky clock:
// it cannot reset encounters, refill equipment or replay cache rewards.
export const DAY_SECONDS=600,REST_FUEL=8,REST_SECONDS=3;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const newDaylight=()=>({offset:0,camps:[],rest:null});
export function daylight(s){
  const phase=((8/24+(s.time+(s.daylight?.offset||0))/DAY_SECONDS)%1+1)%1;
  const light=clamp((Math.sin((phase-.25)*Math.PI*2)+.2)/.55,0,1);
  const hour=Math.floor(phase*24),minute=Math.floor((phase*24-hour)*60);
  return {phase,light,night:light<.25,period:light<.25?'night':light<.9?(phase>.5?'dusk':'dawn'):'day',
    clock:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,sight:.58+.42*light};
}
function unsafe(s){
  return s.boss.active&&!s.boss.cleared||s.tow?.connected&&!s.tow.anchor||
    s.combat?.enemies.some(e=>e.hp>0&&Math.hypot(e.x-s.boat.x,e.y-s.boat.y)<(e.alert||e.phase==='warn'?120:60)&&!e.asleep);
}
export function campStatus(s){
  if(!s.daylight||s.mode!=='moored'||s.status!=='playing')return null;
  const sky=daylight(s),key=s.depth+':'+s.mooring;
  const reason=s.daylight.rest?'resting':s.pendingCache||s.pendingGear||s.salvage?.pending?'choice':
    s.daylight.camps.includes(key)?'spent':!sky.night?'day':unsafe(s)?'danger':s.fuel<=REST_FUEL?'fuel':'ready';
  return {reason,available:reason==='ready',fuel:REST_FUEL,progress:s.daylight.rest?1-s.daylight.rest.left/REST_SECONDS:0,
    key,night:sky.night};
}
export function startCamp(s){
  const c=campStatus(s);if(!c?.available)return false;
  s.daylight.rest={left:REST_SECONDS,key:c.key};s.radio={text:'Park: 선실 난로를 켤게. 불침번을 서며 날이 밝기를 기다리자. 연료 8이 필요해.',left:5};return true;
}
export function tickDaylight(s,dt){
  const env=s.daylight;if(!env)return;
  const now=daylight(s),before=daylight({...s,time:s.time-dt});
  if(now.period!==before.period&&now.period==='dusk')s.radio={text:'Park: 해가 지고 있어. 어두워지면 시야가 줄어들어. 안전한 부두에 대면 난로를 켜고 쉴 수 있어.',left:7};
  if(env.rest){
    if(s.mode!=='moored'||unsafe(s)||s.fuel<=REST_FUEL||s.status!=='playing'){
      env.rest=null;s.radio={text:'Park: 쉴 수 없어. 주변을 확인해.',left:4};return;
    }
    env.rest.left=Math.max(0,env.rest.left-dt);
    if(env.rest.left===0){
      const phase=daylight(s).phase,wait=((6.5/24-phase+1)%1)*DAY_SECONDS;
      env.offset+=wait;env.camps.push(env.rest.key);env.rest=null;
      s.fuel-=REST_FUEL;s.crewHp=Math.min(100,s.crewHp+15);
      s.radio={text:'Park: 날이 밝았어. 연료 8을 썼고 선원 체력 15를 회복했어. 다시 출항하자.',left:7};
    }
  }
}
export function validDaylight(s){
  const d=s.daylight;if(d===null)return true;
  if(!d||!Number.isFinite(d.offset)||d.offset<0||d.offset>6000||!Array.isArray(d.camps)||d.camps.length>9||new Set(d.camps).size!==d.camps.length)return false;
  if(d.camps.some(k=>!/^([0-2]):rogue-yard-[0-2]$/.test(k)||Number(k[0])>s.depth))return false;
  return d.rest===null||s.mode==='moored'&&d.rest?.key===s.depth+':'+s.mooring&&!d.camps.includes(d.rest.key)&&Number.isFinite(d.rest.left)&&d.rest.left>=0&&d.rest.left<=REST_SECONDS;
}
