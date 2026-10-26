// Original harbor: topology -> channel carving -> terrain -> validation.
// Frozen v1 preserves underway saves. No third-party generation code is included.
import {generateHarbor as legacyHarbor,validateMap as legacyValidate,waterAt as legacyWater} from './rogue-map-v1.js';
import {generateHarbor as harborV2} from './rogue-map-v2.js';
export {DEPTHS,random,inside} from './rogue-map-v1.js';
import {random,inside} from './rogue-map-v1.js';
import {WORLD_UNITS_PER_METRE as METRE,crewRadius} from './shore-scale.js';
import {branchGraph} from './harbor-branch-graph.js';
import {placeShoreSearch} from './shore-search-layout.js';
import {compactHarbor} from './compact-harbor.js';
import {shoreRoute} from './shore-navigation.js';
import {applyLayout} from './shore-layouts.js';
import {layoutOrder} from './shore-sites.js';
export const GENERATOR_VERSION=9;
export const TILE=40;
export const LAND={water:0,quay:1,brick:2,deck:3,rock:4};
export const shoreBuildings=r=>r.buildings||[{kind:'hut',x:r.x+r.w-130,y:r.y+20,w:112,h:125}];
export function shoreSolid(p,box,radius=0){
  if(!box.footprint)return inside(p,box,radius);
  const points=box.footprint;let contained=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=radius)return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)contained=!contained;
  }return contained;
}
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
  return !map.props.some(b=>shoreSolid(p,b,radius))&&!map.islands.some(r=>shoreBuildings(r).some(b=>shoreSolid(p,b,radius)));
}
function candidate(seed,depth,attempt,exploration=false,branching=false){
  const rng=random(seed^Math.imul(depth+1,0x9e3779b9)^Math.imul(attempt,0x85ebca6b)^(exploration?0x34e817a9:0));
  const content=random(seed^Math.imul(depth+17,0x27d4eb2d));
  const pick=(min,n)=>min+Math.floor(rng()*n)*TILE;
  const map={version:3,seed,depth,attempt,width:3400,height:1800,cols:85,rows:45,
    spawn:{x:180,y:900},boss:{x:2810,y:900},exit:{x:3260,y:900,angle:Math.PI/2},
    current:{x:(rng()-.5)*15,y:(rng()-.5)*12},secret:content()<.3,
    islands:[],berths:[],tiles:Array(85*45).fill(1),nodes:[],edges:[],props:[]};
  const node=(id,x,y,role='channel')=>{const n={id,x,y,role};map.nodes.push(n);return n;};
  const start=node('arrival',map.spawn.x,map.spawn.y,'arrival'),gate=node('sea-gate',2180,900,'gate');
  const bands=[760,1000,1240];
  if(branching)for(let i=2;i>0;i--){const j=Math.floor(rng()*(i+1));[bands[i],bands[j]]=[bands[j],bands[i]];}
  const main=[0,1,2].map(i=>node('basin-'+i,pick(branching?520+i*640:600+i*560,branching?2:3),pick(exploration?960:1000,branching?3:exploration?10:5),'service'));
  if(branching)main.forEach((n,i)=>n.y=bands[i]+pick(0,2));
  const upper=[0,1,2].map(i=>node('outer-'+i,main[i].x+(branching?320:0),pick(branching?200:exploration?280:400,branching?2:exploration?6:2),'outer'));
  const edge=(a,b,width,role)=>map.edges.push({from:a.id,to:b.id,width,role,points:[{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y}]});
  // Two routes around a working waterfront plus a crosscut and optional southern loop.
  edge(start,main[0],360,'working');
  if(exploration)map.edges.at(-1).points=[start,{x:start.x,y:main[0].y},main[0]];
  edge(main[0],main[1],320,'working');edge(main[1],main[2],320,'working');edge(main[2],gate,360,'working');
  edge(start,upper[0],280,'outer');
  map.edges.at(-1).points=[{x:start.x,y:start.y},{x:start.x,y:upper[0].y},{x:upper[0].x,y:upper[0].y}];
  edge(upper[0],upper[1],280,'outer');edge(upper[1],upper[2],280,'outer');edge(upper[2],gate,280,'outer');
  const cross=Math.floor(rng()*2);
  const crossA=node('cross-south',main[cross].x+320,main[cross].y);
  const crossB=node('cross-north',crossA.x,upper[cross].y);
  edge(main[cross],crossA,320,'working');edge(upper[cross],crossB,280,'outer');
  edge(crossA,crossB,240,'shortcut');
  if(exploration){
    // Vary actual connections, not the decorative tile seed. A second crosscut
    // can form a ladder; otherwise a long dogleg makes a distinct outer loop.
    const other=1-cross,x=main[other].x+320;
    if(rng()<.55){
      const a=node('second-south',x,main[other].y),b=node('second-north',x,upper[other].y);
      edge(main[other],a,320,'working');edge(upper[other],b,280,'outer');edge(a,b,280,'shortcut');
    }else{
      const e=map.edges.find(e=>e.from==='outer-1'&&e.to==='outer-2');
      const y=pick(160,3);e.points=[upper[1],{x:upper[1].x,y},{x:upper[2].x,y},upper[2]];
    }
    // Alternating elbows change which shore blocks direct passage to a berth.
    for(const e of map.edges.filter(e=>e.role==='working'&&e.from.startsWith('basin-')&&e.to.startsWith('basin-'))){
      if(rng()<.5){const a=map.nodes.find(n=>n.id===e.from),b=map.nodes.find(n=>n.id===e.to),x=Math.floor((a.x+b.x)/80)*40;
        e.points=[a,{x,y:a.y},{x,y:b.y},b];}
    }
  }
  map.topology=rng()<.5?'southern-loop':'service-inlet';
  const lower=node('south-water',main[1].x,pick(1480,3),'inlet');
  edge(main[1],lower,320,'inlet');
  if(map.topology==='southern-loop')edge(lower,main[2],280,'outer');
  if(exploration)map.topology=[map.topology,map.nodes.some(n=>n.id==='second-south')?'ladder':'dogleg',...main.map(n=>n.y),...upper.map(n=>n.y)].join('-');
  if(exploration)for(const e of map.edges)if(e.role==='working')e.width=e.from==='arrival'?560:400;
  if(branching){
    Object.assign(map,branchGraph(map.nodes,rng));
    // A navigable seaward trunk serves branching service basins. Closed
    // inner links force a real trip around the projecting breakwaters.
    const south=main.map((n,i)=>node('south-'+i,n.x,1560,'inlet'));
    main.forEach((n,i)=>edge(n,south[i],400,'inlet'));
    edge(south[0],south[1],400,'outer');edge(south[1],south[2],400,'outer');
  }
  function carveCircle(cx,cy,r){
    for(let y=Math.max(2,Math.floor((cy-r)/TILE));y<Math.min(map.rows-2,Math.ceil((cy+r)/TILE));y++)
      for(let x=Math.max(2,Math.floor((cx-r)/TILE));x<Math.min(map.cols-2,Math.ceil((cx+r)/TILE));x++)
        if(Math.hypot((x+.5)*TILE-cx,(y+.5)*TILE-cy)<r)map.tiles[y*map.cols+x]=0;
  }
  for(const e of map.edges)for(let j=1;j<e.points.length;j++){
    const a=e.points[j-1],b=e.points[j],len=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(len/20));
    for(let k=0;k<=steps;k++)carveCircle(a.x+(b.x-a.x)*k/steps,a.y+(b.y-a.y)*k/steps,e.width/2);
  }
  for(const n of main)carveCircle(n.x,n.y,branching?260:exploration?340:300);
  // Keep room to dodge and pull away from the machine. Land frames the arena.
  for(let y=5;y<40;y++)for(let x=56;x<84;x++)map.tiles[y*85+x]=0;
  carveCircle(2180,900,300);carveCircle(2110,500,170);carveCircle(2070,350,160);
  const fill=(r,value)=>{for(let y=Math.floor(r.y/TILE);y<(r.y+r.h)/TILE;y++)for(let x=Math.floor(r.x/TILE);x<(r.x+r.w)/TILE;x++)map.tiles[y*85+x]=value;};
  const rewards=['motor','pump','winch','tank','plating','turbine'];
  main.forEach((n,i)=>{
    const w=branching?pick(240,3):pick(280,2),h=branching?n.y-160-pick(360,4):pick(240,exploration?4:3),x=Math.floor((n.x-w/2)/TILE)*TILE,y=n.y-160-h;
    const r={id:'rogue-yard-'+i,x,y,w,h,role:['equipment','fuel','repair'][i],equipment:rewards[Math.floor(content()*rewards.length)]};
    r.buildings=i===0?[{kind:'warehouse',x:x+24,y:y+16,w:144,h:84},
      {kind:'bench',x:x+w-88,y:y+156,w:64,h:44}]:
      [{kind:i===1?'pump':'shelter',x:x+w-144,y:y+24,w:112,h:96},
      {kind:i===1?'fuel':'fish',x:x+w-90,y:y+h-64,w:64,h:44}];
    fill(r,1);map.islands.push(r);
    if(branching&&i===(seed+depth)%3){
      // Retain a substantial inland connection rather than carving each
      // waterfront district into a floating rectangular platform.
      fill({x:r.x,y:80,w:r.w,h:r.y-80},1);
    }
    map.berths.push({id:r.id,island:i,x:x+w/2,y:y+h+44,angle:0,
      landing:{x:x+w/2,y:y+h-25},loot:{x:x+w*.28,y:y+Math.max(i===0?126:0,h*.45)}});
  });
  if(exploration){
    // Each quay has a real turning/departure apron for a tug AND its tow.
    // Do not rely on a center-point flood fill to certify a long convoy.
    for(const b of map.berths){
      const basin=main[b.island],edge=map.islands[b.island].y+map.islands[b.island].h;
      fill({x:Math.floor((b.x-(branching?260:300))/40)*40,y:edge,w:branching?560:640,h:basin.y+200-edge},0);
    }
  }
  if(branching)for(let i=0;i<2;i++){
    const a=main[i],b=main[i+1];
    if(map.edges.some(e=>e.from===a.id&&e.to===b.id))continue;
    // A missing connection must survive overlapping basin/apron carving.
    // A land tongue separates the service waters; upper channels remain
    // available only if the completed physical-layout validator accepts them.
    const x=Math.floor((a.x+b.x)/80)*40,y=Math.floor((Math.min(a.y,b.y)-120)/40)*40;
    fill({x,y,w:80,h:1320-y},1);
  }
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
  // At least 60 world units between warehouse footprints: the 18-wide actor
  // can pass with finger-steering margin instead of threading a visual seam.
  for(let y=100;y<1720;y+=156)for(let x=280;x<3200;x+=224){
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
    const shoreRadius=map.version>=4?crewRadius(map):9,pad=map.version>=4?shoreRadius:10;
    if(!r||!inside(b.landing,r,-pad)||!inside(b.loot,r,-pad))errors.push('shore access');
    const endpoint=b.searchPoint||b.loot;
    const walk=[b.landing,{x:endpoint.x,y:b.landing.y},endpoint];
    if(map.version>=7&&!shoreRoute(map,b.landing,endpoint,shoreRadius))errors.push('blocked salvage path');
    for(let i=1;map.version<7&&i<walk.length;i++){
      const a=walk[i-1],p=walk[i],n=Math.ceil(Math.hypot(p.x-a.x,p.y-a.y)/8);
      for(let k=0;k<=n;k++)if(!walkableAt(map,{x:a.x+(p.x-a.x)*k/n,y:a.y+(p.y-a.y)*k/n},shoreRadius))errors.push('blocked salvage path');
    }
    if(!reachable({x:b.x,y:b.y+100}))errors.push('berth access');
    for(const dx of[-100,0,100])if(!waterAt(map,{x:b.x+dx,y:b.y},24))errors.push('berth clearance');
  }
  if(map.version>=5){
    // A conservative turning envelope for the longest tug + line + supply
    // boat. Validate the channel graph again after filling real shore solids.
    const visited=new Set(),todo=[],addWide=(x,y)=>{
      const k=y*nx+x;if(x<0||x>=nx||y<0||y>=ny||visited.has(k)||!waterAt(map,{x:(x+.5)*TILE,y:(y+.5)*TILE},132))return;
      visited.add(k);todo.push({x,y});
    };
    addWide(Math.floor((map.spawn.x+70)/TILE),Math.floor(map.spawn.y/TILE));
    for(let i=0;i<todo.length;i++)for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      if(map.version>=6&&!waterAt(map,{x:(todo[i].x+.5+dx/2)*TILE,y:(todo[i].y+.5+dy/2)*TILE},132))continue;
      addWide(todo[i].x+dx,todo[i].y+dy);
    }
    const goals=[...map.berths.map(b=>({x:b.x-90,y:map.nodes.find(n=>n.id==='basin-'+b.island).y})),map.boss,{x:map.exit.x-160,y:map.exit.y-90}];
    if(goals.some(p=>!visited.has(Math.floor(p.y/TILE)*nx+Math.floor(p.x/TILE))))errors.push('convoy turning route');
    if(map.version>=6)for(const p of [{x:map.spawn.x+70,y:map.spawn.y},...goals]){
      const grid={x:(Math.floor(p.x/TILE)+.5)*TILE,y:(Math.floor(p.y/TILE)+.5)*TILE};
      for(let i=0;i<=4;i++)if(!waterAt(map,{x:p.x+(grid.x-p.x)*i/4,y:p.y+(grid.y-p.y)*i/4},132)){errors.push('exact convoy approach');break;}
    }
  }
  return {ok:!errors.length,errors,reachableCells:seen.size,clearanceRadius:radius};
}
export function generateHarbor(seed,depth=0,version=GENERATOR_VERSION){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(depth)||depth<0||depth>2)throw Error('Invalid harbor seed/depth/version');
  if(version===9){
    const map=generateHarbor(seed,depth,8),order=layoutOrder(seed,depth);
    map.berths.forEach((b,i)=>{b.layout=order[i];b.rescuePoint=applyLayout(map,b,order[i]).rescue;});
    map.version=9;
    const check=validateMap(map);
    if(!check.ok)throw Error('Varied shore failed validation: '+check.errors.join(', '));
    return map;
  }
  if(version===8){
    const map=compactHarbor(generateHarbor(seed,depth,7),seed);
    const check=validateMap(map);
    if(!check.ok)throw Error('Compact harbor failed validation: '+check.errors.join(', '));
    return map;
  }
  if(version===1)return legacyHarbor(seed,depth);
  if(version===2)return harborV2(seed,depth,2);
  if(version===4)return humanHarbor(seed,depth);
  if(version===6)return generateBranchingHarbor(seed,depth);
  if(version===7){
    const map=generateBranchingHarbor(seed,depth);map.version=7;
    placeShoreSearch(map,seed,depth);
    const validation=validateMap(map);
    if(!validation.ok)throw Error('Search harbor failed validation: '+validation.errors.join(', '));
    return map;
  }
  if(version===5){
    for(let attempt=0;attempt<32;attempt++){
      const map=candidate(seed,depth,attempt,true);
      if(!validateMap(map).ok)continue;
      try{return humanHarbor(seed,depth,map,5);}catch{/* retry a complete connected layout */}
    }
    // Deterministic safe fallback, still using the new graph family.
    for(let attempt=0;attempt<32;attempt++){
      const map=candidate(0,depth,attempt,true);if(!validateMap(map).ok)continue;
      try{const safe=humanHarbor(seed,depth,map,5);safe.seed=seed;safe.fallback=true;return safe;}catch{}
    }
    throw Error('Exploration harbor failed validation');
  }
  if(version!==3||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(depth)||depth<0||depth>2)throw Error('Invalid harbor seed/depth/version');
  for(let attempt=0;attempt<8;attempt++){const map=candidate(seed,depth,attempt);if(validateMap(map).ok)return map;}
  for(let attempt=0;attempt<8;attempt++){
    const fallback=candidate(0,depth,attempt);
    if(validateMap(fallback).ok){fallback.seed=seed;fallback.fallback=true;return fallback;}
  }
  throw Error('Fallback harbor failed validation');
}

// Generation6 keeps its own seeded placement; saved generations1–5 retain
// their previous geometry. Changing released placement requires a new version.
export function generateBranchingHarbor(seed,depth=0){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(depth)||depth<0||depth>2)throw Error('Invalid harbor seed/depth');
  const failures={};
  for(let attempt=0;attempt<64;attempt++){
    const map=candidate(seed,depth,attempt,true,true);map.version=6;
    const validation=validateMap(map);
    if(!validation.ok){for(const reason of new Set(validation.errors))failures[reason]=(failures[reason]||0)+1;continue;}
    try{return humanHarbor(seed,depth,map,6);}catch(error){failures[error.message]=(failures[error.message]||0)+1;}
  }
  throw Error('Branching harbor failed validation: '+seed+'/'+depth+' '+JSON.stringify(failures));
}

// New voyages use the integrated shore profile. Saved generators1/2/3 keep
// their terrain. Reuse sea topology; replacement solids are actual geometry.
function humanHarbor(seed,depth,source=null,version=4){
  const map=source||generateHarbor(seed,depth,3);map.version=version;
  for(const b of map.berths){
    const r=map.islands[b.island],edge=r.y+r.h;
    // Step onto clear quay beside the bow, away from the tall wheelhouse.
    // The ladder mount is the shoreline; the feet stop safely inland.
    b.y=edge+28;b.ladder={x:b.x+26,y:edge};b.landing={x:b.ladder.x,y:edge-6};
    b.loot={x:b.x+55,y:edge-42};
    b.searchPoint={x:b.loot.x,y:b.loot.y+.85*METRE};
    const building=(visual,x,y)=>({kind:'warehouse',visual,x,y,w:8*METRE,h:4.33*METRE});
    r.buildings=[building('workshop',b.loot.x-4*METRE,b.loot.y-3-4.33*METRE),
      building('warehouse',b.x-65,edge-52-4.33*METRE),
      {kind:'bench',visual:'supplies',x:b.x+10,y:edge-78,w:1.5*METRE,h:METRE}];
  }
  // Every solid in this presentation profile has a corresponding painted
  // footprint. Unconverted decorative crane blockers are not hidden walls.
  map.props=map.props.filter(p=>p.kind!=='crane').map(p=>p.kind==='warehouse'?{...p,visual:'warehouse',x:p.x+p.w/2-4*METRE,
    y:p.y+p.h-4.33*METRE,w:8*METRE,h:4.33*METRE}:{...p,visual:'supplies',w:1.5*METRE,h:METRE});
  for(const box of [...map.islands.flatMap(shoreBuildings),...map.props])if(box.visual==='supplies'){
    const anchor={x:box.x+box.w/2,y:box.y+box.h};
    box.footprint=[[-1.16944,-.28575],[-.20954,.09253],[.35324,-.38516],[.34323,-1.09128],[-1.20166,-1.22633],[-1.28968,-.63005]]
      .map(([x,y])=>({x:anchor.x+x*METRE,y:anchor.y+y*METRE}));
  }
  // A closed or emptied crate remains a real object. Search from its open
  // apron instead of allowing the captain to stand inside the painted box.
  for(const b of map.berths)map.props.push({kind:'cache',visual:'cache',berth:b.id,
    x:b.loot.x-.45*METRE,y:b.loot.y-.5*METRE,w:.9*METRE,h:.5*METRE});
  const result=validateMap(map);if(!result.ok)throw Error('Human quay profile failed validation: '+result.errors.join(', '));
  return map;
}
