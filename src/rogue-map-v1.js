// Original modular harbor generator. No third-party generation code is included.
export const GENERATOR_VERSION = 1;
export const DEPTHS = [
  {name:'폐항',boss:'폭주 준설선',arrival:'Woo: 명부에는 전원 대피했다고 적혀 있어. 그런데 아직 누가 무전을 보내고 있어.',discovery:'Park: 이 명부, 선착장 하나가 통째로 빠졌어. 수문 관리소의 원본과 맞춰 보자.'},
  {name:'방조 수로',boss:'수문지기',arrival:'Park: 수문이 구조선까지 밀어내고 있어. 비상 해제 명령이 여기서 끊겼어.',discovery:'Woo: 해제 명령의 수신처는 바깥 등대선이야. 항구 전체가 그 응답을 기다리고 있어.'},
  {name:'등대 해역',boss:'등대지기',arrival:'Woo: 같은 목소리, 같은 잡음이야. 조난 무전이 계속 반복되고 있어.',discovery:'Park: 사람이 남았다는 명부를 보내자. 등대에 직접 접안해야 이 반복을 멈출 수 있어.'}
];
export function random(seed) {
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
}
export const inside=(p,r,pad=0)=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;
export function waterAt(map,p,radius=0) {
  return p.x>=radius&&p.y>=radius&&p.x<=map.width-radius&&p.y<=map.height-radius&&!map.islands.some(r=>inside(p,r,radius));
}
function candidate(seed,depth,attempt) {
  const rng=random(seed^Math.imul(depth+1,0x9e3779b9)^Math.imul(attempt,0x85ebca6b));
  // Independent content stream: visual/content edits never perturb navigable geometry.
  const loot=random(seed^Math.imul(depth+17,0x27d4eb2d));
  const map={version:GENERATOR_VERSION,seed:seed>>>0,depth,attempt,width:3400,height:1800,
    spawn:{x:180,y:900},boss:{x:2810,y:900},exit:{x:3260,y:900,angle:Math.PI/2},
    islands:[],berths:[],current:{x:(rng()-.5)*15,y:(rng()-.5)*12},secret:loot()<.3};
  const rewards=['motor','pump','winch','tank','plating','turbine'];
  for(let i=0;i<3;i++){
    const w=250+Math.floor(rng()*100),h=310+Math.floor(rng()*190);
    const x=460+i*540+Math.floor(rng()*90),y=480+Math.floor(rng()*330);
    const id='rogue-yard-'+i;
    const island={id,x,y,w,h,role:i===0?'equipment':i===1?'fuel':'repair',
      equipment:rewards[Math.floor(loot()*rewards.length)]};
    map.islands.push(island);
    map.berths.push({id,island:i,x:x+w/2,y:y+h+44,angle:0,
      landing:{x:x+w/2,y:y+h-25},loot:{x:x+w*.28,y:y+h*.45}});
    // Detached upper piers change shortcut shape without sealing the outer loop.
    if(rng()>.35)map.islands.push({id:'pier-'+i,x:x+40,y:110,w:120+Math.floor(rng()*80),h:130+Math.floor(rng()*80),role:'scenery'});
  }
  // Resolve island indices after optional scenery was inserted.
  for(const berth of map.berths)berth.island=map.islands.findIndex(i=>i.id===berth.id);
  if(depth===2&&map.secret)map.islands.push({id:'test-observation',x:2020,y:100,w:120,h:80,role:'observation'});
  return map;
}
export function validateMap(map) {
  const errors=[],radius=78,step=40,nx=Math.ceil(map.width/step),ny=Math.ceil(map.height/step);
  const key=(x,y)=>y*nx+x,nearest=p=>({x:Math.round(p.x/step),y:Math.round(p.y/step)});
  const start=nearest(map.spawn),seen=new Set([key(start.x,start.y)]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=p.x+dx,y=p.y+dy,k=key(x,y);
      if(x<0||y<0||x>=nx||y>=ny||seen.has(k)||!waterAt(map,{x:x*step,y:y*step},radius))continue;
      seen.add(k);queue.push({x,y});
    }
  }
  const reachable=p=>{const q=nearest(p);return seen.has(key(q.x,q.y));};
  if(!reachable(map.boss)||!reachable(map.exit))errors.push('main route');
  if(!reachable({x:2000,y:350})||!reachable({x:2000,y:1450}))errors.push('alternate route');
  for(const b of map.berths){
    const r=map.islands[b.island];
    if(!r||!inside(b.landing,r,-10)||!inside(b.loot,r,-10))errors.push('shore access');
    if(!reachable({x:b.x,y:b.y+100}))errors.push('berth access');
    // Full hull at berth and parallel approach/turning pocket for a long tow.
    for(const dx of [-100,0,100])if(!waterAt(map,{x:b.x+dx,y:b.y},24))errors.push('berth clearance');
  }
  return {ok:errors.length===0,errors,reachableCells:seen.size,clearanceRadius:radius};
}
export function generateHarbor(seed,depth=0) {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(depth)||depth<0||depth>2)throw Error('Invalid harbor seed/depth');
  for(let attempt=0;attempt<8;attempt++){const map=candidate(seed,depth,attempt);if(validateMap(map).ok)return map;}
  const fallback=candidate(0,depth,0);
  fallback.seed=seed;fallback.fallback=true;
  if(!validateMap(fallback).ok)throw Error('Fallback harbor failed validation');
  return fallback;
}
