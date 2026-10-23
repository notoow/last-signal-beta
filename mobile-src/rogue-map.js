// Original harbor: topology -> channel carving -> terrain -> validation.
// Frozen v1 preserves underway saves. No third-party generation code is included.
import {generateHarbor as legacyHarbor,validateMap as legacyValidate,waterAt as legacyWater} from './rogue-map-v1.js';
export {DEPTHS,random,inside} from './rogue-map-v1.js';
import {random,inside} from './rogue-map-v1.js';
export const GENERATOR_VERSION=2;
export const TILE=40;
export const LAND={water:0,quay:1,brick:2,deck:3,rock:4};
export const shoreBuildings=r=>r.buildings||[{kind:'hut',x:r.x+r.w-130,y:r.y+20,w:112,h:125}];
export function tileAt(map,x,y){
  return x<0||y<0||x>=map.cols||y>=map.rows?LAND.rock:map.tiles[y*map.cols+x];
}
// N/E/S/W exposure. Adjacent land never receives an internal seawall.
export function shoreMask(map,x,y){
  if(!tileAt(map,x,y))return 0;
  return [[0,-1],[1,0],[0,1],[-1,0]].reduce((mask,[dx,dy],i)=>mask|(!tileAt(map,x+dx,y+dy)?1<<i:0),0);
}
export function waterAt(map,p,radius=0){
  if(map.version===1)return legacyWater(map,p,radius);
  if(p.x<radius||p.y<radius||p.x>map.width-radius||p.y>map.height-radius)return false;
  for(let y=Math.floor((p.y-radius)/TILE);y<=Math.floor((p.y+radius)/TILE);y++){
    for(let x=Math.floor((p.x-radius)/TILE);x<=Math.floor((p.x+radius)/TILE);x++){
      if(!tileAt(map,x,y))continue;
      const dx=Math.max(x*TILE-p.x,0,p.x-(x+1)*TILE),dy=Math.max(y*TILE-p.y,0,p.y-(y+1)*TILE);
      if(dx*dx+dy*dy<=radius*radius)return false;
    }
  }
  return true;
}
export function walkableAt(map,p,radius=9){
  if(p.x<radius||p.y<radius||p.x>map.width-radius||p.y>map.height-radius)return false;
  if(map.version===1)return map.islands.some(r=>inside(p,r,-radius)&&!shoreBuildings(r).some(b=>inside(p,b,radius)));
  for(let y=Math.floor((p.y-radius)/TILE);y<=Math.floor((p.y+radius)/TILE);y++)
    for(let x=Math.floor((p.x-radius)/TILE);x<=Math.floor((p.x+radius)/TILE);x++)
      if(!tileAt(map,x,y))return false;
  return !map.props.some(b=>inside(p,b,radius))&&!map.islands.some(r=>shoreBuildings(r).some(b=>inside(p,b,radius)));
}
function candidate(seed,depth,attempt){
  const rng=random(seed^Math.imul(depth+1,0x9e3779b9)^Math.imul(attempt,0x85ebca6b));
  const content=random(seed^Math.imul(depth+17,0x27d4eb2d));
  const pick=(min,n)=>min+Math.floor(rng()*n)*TILE;
  const map={version:2,seed,depth,attempt,width:3400,height:1800,cols:85,rows:45,
    spawn:{x:180,y:900},boss:{x:2810,y:900},exit:{x:3260,y:900,angle:Math.PI/2},
    current:{x:(rng()-.5)*15,y:(rng()-.5)*12},secret:content()<.3,
    islands:[],berths:[],tiles:Array(85*45).fill(1),nodes:[],edges:[],props:[]};
  const node=(id,x,y,role='channel')=>{const n={id,x,y,role};map.nodes.push(n);return n;};
  const start=node('arrival',180,900,'arrival'),gate=node('sea-gate',2180,900,'gate');
  const main=[0,1,2].map(i=>node('basin-'+i,pick(600+i*560,3),pick(1000,5),'service'));
  const upper=[0,1,2].map(i=>node('outer-'+i,main[i].x,pick(400,2),'outer'));
  const edge=(a,b,width,role)=>map.edges.push({from:a.id,to:b.id,width,role,points:[{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y}]});
  // Two routes around a working waterfront plus a crosscut and optional southern loop.
  edge(start,main[0],360,'working');
  edge(main[0],main[1],320,'working');edge(main[1],main[2],320,'working');edge(main[2],gate,360,'working');
  edge(start,upper[0],280,'outer');
  map.edges.at(-1).points=[{x:start.x,y:start.y},{x:start.x,y:upper[0].y},{x:upper[0].x,y:upper[0].y}];
  edge(upper[0],upper[1],280,'outer');edge(upper[1],upper[2],280,'outer');edge(upper[2],gate,280,'outer');
  const cross=Math.floor(rng()*2);
  const crossA=node('cross-south',main[cross].x+320,main[cross].y);
  const crossB=node('cross-north',crossA.x,upper[cross].y);
  edge(main[cross],crossA,320,'working');edge(upper[cross],crossB,280,'outer');
  edge(crossA,crossB,240,'shortcut');
  map.topology=rng()<.5?'southern-loop':'service-inlet';
  const lower=node('south-water',main[1].x,pick(1480,3),'inlet');
  edge(main[1],lower,320,'inlet');
  if(map.topology==='southern-loop')edge(lower,main[2],280,'outer');
  function carveCircle(cx,cy,r){
    for(let y=Math.max(2,Math.floor((cy-r)/TILE));y<Math.min(map.rows-2,Math.ceil((cy+r)/TILE));y++)
      for(let x=Math.max(2,Math.floor((cx-r)/TILE));x<Math.min(map.cols-2,Math.ceil((cx+r)/TILE));x++)
        if(Math.hypot((x+.5)*TILE-cx,(y+.5)*TILE-cy)<r)map.tiles[y*map.cols+x]=0;
  }
  for(const e of map.edges)for(let j=1;j<e.points.length;j++){
    const a=e.points[j-1],b=e.points[j],len=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(len/20));
    for(let k=0;k<=steps;k++)carveCircle(a.x+(b.x-a.x)*k/steps,a.y+(b.y-a.y)*k/steps,e.width/2);
  }
  for(const n of main)carveCircle(n.x,n.y,300);
  // Keep room to dodge and pull away from the machine. Land frames the arena.
  for(let y=5;y<40;y++)for(let x=56;x<84;x++)map.tiles[y*85+x]=0;
  carveCircle(2180,900,300);carveCircle(2110,500,170);carveCircle(2070,350,160);
  const fill=(r,value)=>{for(let y=Math.floor(r.y/TILE);y<(r.y+r.h)/TILE;y++)for(let x=Math.floor(r.x/TILE);x<(r.x+r.w)/TILE;x++)map.tiles[y*85+x]=value;};
  const rewards=['motor','pump','winch','tank','plating','turbine'];
  main.forEach((n,i)=>{
    const w=pick(280,2),h=pick(240,3),x=Math.floor((n.x-w/2)/TILE)*TILE,y=n.y-160-h;
    const r={id:'rogue-yard-'+i,x,y,w,h,role:['equipment','fuel','repair'][i],equipment:rewards[Math.floor(content()*rewards.length)]};
    r.buildings=i===0?[{kind:'warehouse',x:x+24,y:y+16,w:144,h:84},
      {kind:'bench',x:x+w-104,y:y+100,w:80,h:90}]:
      [{kind:i===1?'pump':'shelter',x:x+w-130,y:y+20,w:112,h:125},
      {kind:i===1?'fuel':'fish',x:x+w-100,y:y+h-88,w:74,h:52}];
    fill(r,1);map.islands.push(r);
    map.berths.push({id:r.id,island:i,x:x+w/2,y:y+h+44,angle:0,
      landing:{x:x+w/2,y:y+h-25},loot:{x:x+w*.28,y:y+Math.max(i===0?126:0,h*.45)}});
  });
  fill({x:3360,y:680,w:40,h:440},1);
  if(depth===2&&map.secret){
    const r={id:'test-observation',x:2000,y:80,w:160,h:80,role:'observation'};
    fill(r,1);map.islands.push(r);
  }
  // Independent decoration stream cannot perturb geometry or rewards.
  const decor=random(seed^Math.imul(depth+9,0x165667b1));
  for(let y=0;y<45;y++)for(let x=0;x<85;x++){
    const k=y*85+x;if(!map.tiles[k])continue;
    if(x<2||y<2||y>42||x>82)map.tiles[k]=4;
    else if(y>32&&x<55)map.tiles[k]=4;
    else if(x>24&&x<48&&y>13&&y<31)map.tiles[k]=2;
  }
  for(const r of map.islands)fill(r,1);
  for(let y=100;y<1720;y+=120)for(let x=280;x<3200;x+=180){
    if(decor()<.22)continue;
    const kind=decor()<.8?'warehouse':'crates';
    const p={kind,x:x+(decor()<.5?0:20),y,w:kind==='warehouse'?144:32,h:kind==='warehouse'?84:27};
    if(map.islands.some(r=>p.x<r.x+r.w+12&&p.x+p.w>r.x-12&&p.y<r.y+r.h+12&&p.y+p.h>r.y-12))continue;
    let fits=true;
    for(let ty=Math.floor((p.y-8)/40);ty<=Math.floor((p.y+p.h+8)/40);ty++)for(let tx=Math.floor((p.x-8)/40);tx<=Math.floor((p.x+p.w+8)/40);tx++)if(![1,2].includes(tileAt(map,tx,ty)))fits=false;
    if(fits)map.props.push(p);
  }
  // Quayside cranes occur only on land facing a usable channel, at a fixed physical scale.
  for(let y=3;y<map.rows-4;y++)for(let x=4;x<map.cols-4;x++){
    if((x*7+y*11+seed)%19!==0||shoreMask(map,x,y)!==4)continue;
    const p={kind:'crane',x:x*TILE-24,y:y*TILE-50,w:64,h:68};
    if(map.islands.some(r=>inside({x:p.x+32,y:p.y+34},r,45)))continue;
    if([[-1,0],[0,0],[-1,-1],[0,-1]].every(([dx,dy])=>tileAt(map,x+dx,y+dy)))map.props.push(p);
  }
  return map;
}
export function validateMap(map){
  if(map.version===1)return legacyValidate(map);
  const radius=78,errors=[],nx=map.cols,ny=map.rows;
  const cell=p=>({x:Math.floor(p.x/TILE),y:Math.floor(p.y/TILE)});
  const start=cell(map.spawn),seen=new Set(),queue=[];
  const add=(x,y)=>{
    const k=y*nx+x;
    if(x<0||y<0||x>=nx||y>=ny||seen.has(k)||!waterAt(map,{x:(x+.5)*TILE,y:(y+.5)*TILE},radius))return;
    seen.add(k);queue.push({x,y});
  };
  add(start.x,start.y);
  for(let i=0;i<queue.length;i++){const {x,y}=queue[i];for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])add(x+dx,y+dy);}
  const reachable=p=>{const q=cell(p);return seen.has(q.y*nx+q.x);};
  if(!reachable(map.boss)||!reachable(map.exit))errors.push('main route');
  if(map.nodes.filter(n=>n.role==='outer'||n.role==='inlet').some(n=>!reachable(n)))errors.push('alternate route');
  for(const b of map.berths){
    const r=map.islands[b.island];
    if(!r||!inside(b.landing,r,-10)||!inside(b.loot,r,-10))errors.push('shore access');
    const walk=[b.landing,{x:b.loot.x,y:b.landing.y},b.loot];
    for(let i=1;i<walk.length;i++){
      const a=walk[i-1],p=walk[i],n=Math.ceil(Math.hypot(p.x-a.x,p.y-a.y)/8);
      for(let k=0;k<=n;k++)if(!walkableAt(map,{x:a.x+(p.x-a.x)*k/n,y:a.y+(p.y-a.y)*k/n}))errors.push('blocked salvage path');
    }
    if(!reachable({x:b.x,y:b.y+100}))errors.push('berth access');
    for(const dx of[-100,0,100])if(!waterAt(map,{x:b.x+dx,y:b.y},24))errors.push('berth clearance');
  }
  return {ok:!errors.length,errors,reachableCells:seen.size,clearanceRadius:radius};
}
export function generateHarbor(seed,depth=0,version=GENERATOR_VERSION){
  if(version===1)return legacyHarbor(seed,depth);
  if(version!==2||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(depth)||depth<0||depth>2)throw Error('Invalid harbor seed/depth/version');
  for(let attempt=0;attempt<8;attempt++){const map=candidate(seed,depth,attempt);if(validateMap(map).ok)return map;}
  for(let attempt=0;attempt<8;attempt++){
    const fallback=candidate(0,depth,attempt);
    if(validateMap(fallback).ok){fallback.seed=seed;fallback.fallback=true;return fallback;}
  }
  throw Error('Fallback harbor failed validation');
}
