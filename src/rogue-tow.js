import {waterAt} from './rogue-map.js';
import {waterMotion,waterVelocity,driftBody} from './ship-motion.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const towBow=t=>({x:t.x+Math.cos(t.angle)*t.length/2,y:t.y+Math.sin(t.angle)*t.length/2});
export const tugStern=b=>({x:b.x-Math.cos(b.angle)*b.length/2,y:b.y-Math.sin(b.angle)*b.length/2});
export function towClear(map,t){
  return [-1,0,1].every(i=>waterAt(map,{x:t.x+Math.cos(t.angle)*i*(t.length-t.width)/2,y:t.y+Math.sin(t.angle)*i*(t.length-t.width)/2},t.width/2));
}
export function newRogueTow(s){
  const t={x:380,y:990,angle:Math.PI,vx:0,vy:0,length:94,width:34,hp:80,inv:0,connected:false,anchor:{x:380,y:990,angle:Math.PI},tension:0,delivered:false};
  // The guaranteed arrival channel is broad; verify the chosen full hull.
  if(!towClear(s.map,t)){t.x=300;t.y=900;t.anchor={x:t.x,y:t.y,angle:t.angle};}
  return t;
}
export function towControl(s,action){
  const t=s.tow;if(!t||t.hp<=0||t.delivered||s.mode==='ashore'||s.status!=='playing')return {ok:false,reason:'승선 후 조작'};
  const near=dist(s.boat,towBow(t))<155;
  if(action==='tow'){
    if(t.connected){t.connected=false;t.tension=0;return {ok:true,reason:t.anchor?'견인줄 분리 · 보급정 닻 내림':'견인줄 분리 · 보급정 표류 중'};}
    if(!near)return {ok:false,reason:'보급정 선수 가까이 접근'};
    if(s.boss.hook>=0)return {ok:false,reason:'기계선 견인줄을 먼저 분리'};
    t.connected=true;return {ok:true,reason:t.anchor?'견인줄 연결 · H로 보급정 닻 올리기':'보급정 연결 · 탈출 부두까지 견인'};
  }
  if(!near&&!t.connected)return {ok:false,reason:'보급정 선수 가까이 접근'};
  if(t.anchor){t.anchor=null;return {ok:true,reason:'보급정 닻 올림 · 해류와 견인에 따라 이동'};}
  if(Math.hypot(t.vx,t.vy)>16)return {ok:false,reason:'보급정을 충분히 감속한 뒤 H'};
  t.anchor={x:t.x,y:t.y,angle:t.angle};t.vx=0;t.vy=0;
  return {ok:true,reason:'보급정 닻 내림 · 하선 중에도 고정'};
}
export function tickRogueTow(s,dt){
  const t=s.tow;if(!t||t.hp<=0||t.delivered)return;
  t.inv=Math.max(0,t.inv-dt);
  const old={x:t.x,y:t.y,angle:t.angle};
  let ax=waterMotion(s)?0:s.map.current.x,ay=waterMotion(s)?0:s.map.current.y;t.tension=0;
  if(t.connected){
    const stern=tugStern(s.boat),bow=towBow(t),d=dist(stern,bow)||1,nx=(stern.x-bow.x)/d,ny=(stern.y-bow.y)/d;
    const force=clamp((d-85)*5+((s.boat.vx-t.vx)*nx+(s.boat.vy-t.vy)*ny)*3,0,190);
    t.tension=force/190;ax+=nx*force/1.7;ay+=ny*force/1.7;
    if(s.mode==='sailing'){s.boat.vx-=nx*force*dt*.5;s.boat.vy-=ny*force*dt*.5;}
    if(!t.anchor&&force>1)t.angle=wrap(t.angle+clamp(wrap(Math.atan2(ny,nx)-t.angle),-1.1*dt,1.1*dt));
    if(d>310){t.connected=false;t.tension=0;s.radio={text:'Park: 견인줄이 빠졌어. 보급정 선수로 돌아가서 T로 다시 연결해.',left:7};}
  }
  if(t.anchor){Object.assign(t,t.anchor);t.vx=0;t.vy=0;}
  else{
    if(waterMotion(s)){driftBody(t,waterVelocity(s),1.7,dt);t.vx+=ax*dt;t.vy+=ay*dt;}
    else{t.vx+=(ax-t.vx*.75)*dt;t.vy+=(ay-t.vy*1.1)*dt;}
    t.x+=t.vx*dt;t.y+=t.vy*dt;
  }
  if(!t.anchor&&!towClear(s.map,t)){
    const impact=Math.hypot(t.vx,t.vy);Object.assign(t,old);t.vx*=-.15;t.vy*=-.15;
    if(impact>28&&!t.inv){t.hp=Math.max(0,t.hp-(impact-20)*.18);t.inv=.8;}
  }
  // Approximate three-disc contacts agree with the visible hull dimensions.
  for(const i of [-1,0,1])for(const j of [-1,0,1]){
    const b=s.boat,p={x:t.x+Math.cos(t.angle)*i*(t.length-t.width)/2,y:t.y+Math.sin(t.angle)*i*(t.length-t.width)/2};
    const q={x:b.x+Math.cos(b.angle)*j*(b.length-b.width)/2,y:b.y+Math.sin(b.angle)*j*(b.length-b.width)/2},d=dist(q,p),r=(b.width+t.width)/2;
    if(d>0&&d<r){
      const nx=(q.x-p.x)/d,ny=(q.y-p.y)/d,shift=r-d;
      const next={...t,x:t.x-nx*shift,y:t.y-ny*shift};
      if(!t.anchor&&towClear(s.map,next)){t.x=next.x;t.y=next.y;}
      else if(s.mode==='sailing'){
        const moved={...b,x:b.x+nx*shift,y:b.y+ny*shift};
        if(towClear(s.map,moved)){b.x=moved.x;b.y=moved.y;}
        const approach=b.vx*nx+b.vy*ny;
        if(approach<0){b.vx-=nx*approach;b.vy-=ny*approach;}
      }
    }
  }
  if(!t.hp){t.connected=false;t.anchor=null;s.radio={text:'Park: 보급정이 침몰했어. 남은 배로 항해를 이어가야 해.',left:7};}
}
export function deliverRogueTow(s){
  const t=s.tow;
  if(!t||t.delivered||t.hp<=0||dist(t,s.map.exit)>230||Math.hypot(t.vx,t.vy)>25)return false;
  t.delivered=true;t.connected=false;return true;
}
export function validRogueTow(t,finite,map){
  return t===null||!!t&&finite(t.x,0,map.width)&&finite(t.y,0,map.height)&&finite(t.angle,-Math.PI,Math.PI)&&finite(t.vx,-2000,2000)&&finite(t.vy,-2000,2000)&&t.length===94&&t.width===34&&finite(t.hp,0,80)&&finite(t.inv,0,.81)&&typeof t.connected==='boolean'&&typeof t.delivered==='boolean'&&finite(t.tension,0,1)&&
    (t.anchor===null||finite(t.anchor?.x,0,map.width)&&finite(t.anchor?.y,0,map.height)&&finite(t.anchor?.angle,-Math.PI,Math.PI)&&dist(t,t.anchor)<.01&&Math.abs(t.angle-t.anchor.angle)<.01&&t.vx===0&&t.vy===0);
}
