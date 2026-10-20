export const WIDTH = 1600, HEIGHT = 1000, SAVE_VERSION = 2;
const TAU=Math.PI*2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const UPGRADES = [
  { id: 'amplifier', family: 'circuit', max: 5 },
  { id: 'capacitor', family: 'circuit', max: 4 },
  { id: 'frost', family: 'frost', max: 4 },
  { id: 'shatter', family: 'frost', max: 3 },
  { id: 'echo', family: 'circuit', max: 3 },
  { id: 'magnet', family: 'salvage', max: 4 },
  { id: 'salvager', family: 'salvage', max: 3 },
  { id: 'repair', family: 'salvage', max: 4 },
  { id: 'pulse', family: 'weapon', max: 5 },
  { id: 'split', family: 'weapon', max: 3 },
  { id: 'overclock', family: 'weapon', max: 4 },
  { id: 'thruster', family: 'motion', max: 4 },
  { id: 'wake', family: 'motion', max: 4 },
  { id: 'hull', family: 'motion', max: 4 },
  { id: 'resonance', family: 'circuit', max: 3 },
];
export function random(s) {
  s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function triangleArea(a, b, c) { return Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2; }
export function inTriangle(p, a, b, c) {
  if (triangleArea(a,b,c) < 1) return false;
  const sign = (p, a, b) => (p.x-b.x)*(a.y-b.y)-(a.x-b.x)*(p.y-b.y);
  const x=sign(p,a,b), y=sign(p,b,c), z=sign(p,c,a);
  return !((x<0||y<0||z<0) && (x>0||y>0||z>0));
}
export function segmentDistance(p,a,b) {
  const d=(b.x-a.x)**2+(b.y-a.y)**2;
  const t=d?clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d,0,1):0;
  return Math.hypot(p.x-a.x-t*(b.x-a.x),p.y-a.y-t*(b.y-a.y));
}
export function stats(s) {
  const u=s.upgrades, n=id=>u[id]||0;
  return {
    speed:(s.ship==='courier'?235:205)*(1+n('thruster')*.09),
    maxHp:(s.ship==='bastion'?150:100)+n('hull')*25,
    maxEnergy:100+n('capacitor')*22,
    regen:20+n('capacitor')*4,
    damage:90*(s.ship==='weaver'?1.18:1)*(1+n('amplifier')*.32),
    fire:(s.mission?1.1:.68)/(1+n('overclock')*.22), bullet:(s.mission?6:13)+n('pulse')*6,
    magnet:72+n('magnet')*42,
    dash:Math.max(1.2,3.1-n('thruster')*.32),
  };
}
export function createRun(seed=Date.now(),mode='voyage',ship='weaver') {
  const s={version:SAVE_VERSION,tutorialStep:-1,seed:seed>>>0,rng:seed>>>0,mode,ship,status:'playing',time:0,
    player:{x:WIDTH/2,y:HEIGHT/2,hp:ship==='bastion'?150:100,energy:100,dx:1,dy:0,inv:1,dash:0,dashTime:0,fire:0},
    enemies:[],shots:[],hazards:[],pickups:[],anchors:[],effects:[],events:[],upgrades:{},
    xp:0,level:1,nextXp:12,draft:[],pendingLevels:0,spawnIn:1.2,bossesSpawned:0,bossesKilled:0,
    kills:0,circuits:0,bestCircuit:0,damageCircuit:0,damageCannon:0,damageDash:0,score:0,combo:0,comboTime:0,anchorCooldown:0,anchorLife:0,id:1};
  return s;
}
export const LESSON_POINTS=[{x:520,y:720},{x:1080,y:720},{x:800,y:280}];
export function createLesson(seed,mode,ship) {
  const s=createRun(seed,mode,ship);s.tutorialStep=0;s.spawnIn=999;
  Object.assign(s.player,LESSON_POINTS[0]);
  for(const pos of [{x:760,y:550},{x:840,y:550},{x:800,y:450}]) {
    const e=spawnEnemy(s,'drone',pos);Object.assign(e,{practice:true,hp:1,maxHp:1,speed:0,damage:0,xp:0});
  }
  return s;
}
export function synergies(s) {
  const u=s.upgrades,result=[];
  if(u.amplifier>=2&&u.capacitor>=2)result.push('wideband');
  if(u.frost>=2&&u.shatter>=1)result.push('cryobloom');
  if(u.salvager>=2&&u.repair>=2)result.push('reclaimer');
  return result;
}
const emit=(s,type,extra={})=>s.events.push({type,...extra});
function effect(s,e) { if(s.effects.length<220) s.effects.push(e); }
export function placeAnchor(s,resolver=null) {
  if(s.status!=='playing'||s.anchorCooldown>0) return false;
  const p=s.player;
  const cost=s.mission?14:22;
  if(p.energy<cost) {emit(s,'lowEnergy'); return false;}
  const a={x:p.x,y:p.y};
  if(s.anchors.length && length(a,s.anchors.at(-1))<52) {emit(s,'tooClose');return false;}
  if(s.anchors.length===2 && triangleArea(...s.anchors,a)<2200) {emit(s,'tooSmall');return false;}
  p.energy-=cost; s.anchorCooldown=.22;
  if(!s.anchors.length)s.anchorLife=15;
  s.anchors.push(a);if(s.tutorialStep>=0)s.tutorialStep=s.anchors.length;emit(s,'anchor');
  if(s.anchors.length===3) {
    const points=s.anchors.map(p=>({...p})); s.anchors=[];
    if(resolver)resolver(s,points);else circuit(s,points,false);
    if(!resolver&&s.upgrades.echo) effect(s,{type:'echo',points,life:1.0,max:1.0,power:.25+s.upgrades.echo*.15});
    if(s.tutorialStep>=0){if(s.kills>0){s.status='lessonComplete';s.tutorialStep=3;}else s.tutorialStep=0;}
  }
  return true;
}
export function cancelAnchors(s) { s.anchors=[];s.anchorLife=0;if(s.tutorialStep>=0)s.tutorialStep=0; }
export function circuit(s,points,isEcho,power=1) {
  const area=triangleArea(...points), st=stats(s);
  const active=synergies(s);
  const damage=st.damage*(1+Math.min(area/180000,.9))*power*(active.includes('wideband')&&area>=90000?1.35:1);
  let hits=0;
  for(const e of s.enemies) {
    if(e.hp<=0)continue;
    if(inTriangle(e,...points)||points.some((p,i)=>segmentDistance(e,p,points[(i+1)%3])<e.r+10)) {
      hits++;
      const frozen=e.slow>0;
      hit(s,e,damage*(frozen?1+(s.upgrades.shatter||0)*.45:1));
      if(frozen&&e.hp<=0&&active.includes('cryobloom')){
        for(const o of s.enemies)if(o!==e&&o.hp>0&&length(o,e)<150){hit(s,o,damage*.35);o.slow=Math.max(o.slow,2);}
        effect(s,{type:'frostburst',x:e.x,y:e.y,life:.5,max:.5,r:150});
      }
      if(s.upgrades.frost)e.slow=2+s.upgrades.frost;
      if(s.upgrades.resonance) {
        for(const o of s.enemies) if(o!==e && o.hp>0&&length(o,e)<115) hit(s,o,damage*.12*s.upgrades.resonance);
      }
    }
  }
  if(!isEcho) {
    if(active.includes('reclaimer')&&area<60000)s.player.energy=Math.min(st.maxEnergy,s.player.energy+22);
    s.circuits++; s.bestCircuit=Math.max(s.bestCircuit,hits);
    s.combo=s.comboTime>0?s.combo+1:1;s.comboTime=7;
    s.score+=Math.round(area/500)+hits*35*Math.min(s.combo,5);
    if(s.upgrades.salvager)payout(s,(points[0].x+points[1].x+points[2].x)/3,(points[0].y+points[1].y+points[2].y)/3,s.upgrades.salvager*2);
    if(s.upgrades.repair)s.player.hp=Math.min(st.maxHp,s.player.hp+Math.min(hits,6)*s.upgrades.repair*.8);
  }
  effect(s,{type:'circuit',points,life:.65,max:.65,hits,echo:isEcho});
  emit(s,'circuit',{hits,area,echo:isEcho});
  reap(s);
}
export function dash(s) {
  if(s.status!=='playing'||s.player.dash>0)return false;
  s.player.dash=stats(s).dash;s.player.dashTime=.2;s.player.inv=.4;emit(s,'dash');return true;
}
export function spawnEnemy(s,kind='drone',position) {
  if(s.enemies.length>=180)return;
  const side=Math.floor(random(s)*4), v=random(s);
  let x=side<2?(side===0?30:WIDTH-30):70+v*(WIDTH-140);
  let y=side>=2?(side===2?30:HEIGHT-30):70+v*(HEIGHT-140);
  if(position){x=position.x;y=position.y;}
  const scale=1+s.time/(s.mode==='sprint'?260:1050);
  const base={drone:[28,18,66,9,3],hunter:[53,22,89,13,5],shooter:[55,23,45,12,6],charger:[90,26,59,17,9],boss:[750+350*s.bossesSpawned,61,29,22,75]}[kind];
  const e={id:s.id++,kind,x,y,hp:base[0]*scale,maxHp:base[0]*scale,r:base[1],speed:base[2],damage:base[3],xp:base[4],slow:0,
    timer:kind==='boss'?3:.5+random(s)*2,flash:0,charge:0,dx:0,dy:0,phase:random(s)*Math.PI*2,tier:kind==='boss'?clamp(s.bossesSpawned,0,3):0,pattern:0,practice:false};
  s.enemies.push(e);return e;
}
function hit(s,e,amount,source='Circuit') { if(e.hp<=0||e.restrained>0&&source==='Cannon')return;if(e.kind==='boss'&&e.tier===1&&source==='Cannon')amount*=.45;s['damage'+source]+=Math.min(e.hp,amount);e.hp-=amount;e.flash=.12;if(e.hp<=0)effect(s,{type:'burst',x:e.x,y:e.y,life:.35,max:.35,r:e.r,kind:e.kind}); }
function payout(s,x,y,value) {
  if(value<=0)return;
  if(s.pickups.length>=250) {s.pickups[0].value+=value;return;}
  s.pickups.push({x,y,value});
}
function reap(s) {
  const dead=s.enemies.filter(e=>e.hp<=0);
  for(const e of dead) {
    s.kills++;s.score+=e.kind==='boss'?1500:10;
    payout(s,e.x,e.y,e.xp);
    if(e.kind==='boss') {
      s.bossesKilled++;s.player.hp=Math.min(stats(s).maxHp,s.player.hp+30);
      s.player.energy=stats(s).maxEnergy;
      emit(s,'bossDown');
    }
  }
  s.enemies=s.enemies.filter(e=>e.hp>0);
}
export function addXp(s,value) {
  s.xp+=value;
  while(s.xp>=s.nextXp) {s.xp-=s.nextXp;s.level++;s.nextXp=Math.round(s.nextXp*1.16+6);s.pendingLevels++;}
  if(s.pendingLevels>0 && s.status==='playing') makeDraft(s);
}
function makeDraft(s) {
  const pool=UPGRADES.filter(u=>(s.upgrades[u.id]||0)<u.max).map(u=>u.id);
  s.draft=[];
  while(pool.length&&s.draft.length<3)s.draft.push(pool.splice(Math.floor(random(s)*pool.length),1)[0]);
  if(!s.draft.length) {s.pendingLevels=0; s.player.hp=Math.min(stats(s).maxHp,s.player.hp+30);return;}
  s.status='draft';emit(s,'level');
}
export function chooseUpgrade(s,id) {
  if(s.status!=='draft'||!s.draft.includes(id))return false;
  s.upgrades[id]=(s.upgrades[id]||0)+1;s.pendingLevels--;
  if(id==='hull')s.player.hp+=25;
  if(id==='capacitor')s.player.energy+=22;
  s.draft=[];s.status='playing';emit(s,'upgrade');
  if(s.pendingLevels>0)makeDraft(s);
  return true;
}
export function damagePlayer(s,amount) {
  const p=s.player;if(p.inv>0)return;
  p.hp=Math.max(0,p.hp-amount);p.inv=.75;emit(s,'hurt');
  if(p.hp<=0){s.status='lost';emit(s,'end');}
}
function shoot(s,e,angle,speed=170) {
  if(s.hazards.length<260)s.hazards.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:7,r:6,damage:e.damage});
}
export function update(s,dt,input={}) {
  if(s.status!=='playing')return;
  dt=clamp(Number.isFinite(dt)?dt:0,0,.05);
  const p=s.player,st=stats(s),duration=s.mode==='sprint'?180:720;
  s.time+=dt;s.anchorCooldown=Math.max(0,s.anchorCooldown-dt);s.comboTime=Math.max(0,s.comboTime-dt);
  if(s.anchors.length&&s.tutorialStep<0){s.anchorLife=Math.max(0,s.anchorLife-dt);if(s.anchorLife<=0){s.anchors=[];emit(s,'expired');}}
  p.inv=Math.max(0,p.inv-dt);p.dash=Math.max(0,p.dash-dt);p.dashTime=Math.max(0,p.dashTime-dt);
  p.energy=Math.min(st.maxEnergy,p.energy+st.regen*dt);
  let dx=clamp(input.x||0,-1,1),dy=clamp(input.y||0,-1,1),mag=Math.hypot(dx,dy);
  if(mag>1){dx/=mag;dy/=mag;}
  if(mag>.1){p.dx=dx/(Math.hypot(dx,dy)||1);p.dy=dy/(Math.hypot(dx,dy)||1);}
  const old={x:p.x,y:p.y};
  if(p.dashTime>0) {dx=p.dx*4.5;dy=p.dy*4.5;effect(s,{type:'wake',x:p.x,y:p.y,angle:Math.atan2(p.dy,p.dx),life:.3,max:.3});}
  const moveScale=clamp(input.moveScale??1,0,1);
  p.x=clamp(p.x+dx*st.speed*dt*moveScale,24,WIDTH-24);p.y=clamp(p.y+dy*st.speed*dt*moveScale,24,HEIGHT-24);
  if(s.tutorialStep>=0){p.energy=st.maxEnergy;s.effects=s.effects.filter(e=>(e.life-=dt)>0);return;}
  if(p.dashTime>0&&s.upgrades.wake)for(const e of s.enemies)if(segmentDistance(e,old,p)<e.r+30)hit(s,e,dt*(120+s.upgrades.wake*90),'Dash');
  // Fixed sector beats make a voyage legible. Enemy positions and upgrade drafts are seeded.
  const bossTimes=s.mode==='sprint'?[45,90,135,165]:[180,360,540,690];
  if(!s.mission&&s.bossesSpawned<4&&s.time>=bossTimes[s.bossesSpawned]) {spawnEnemy(s,'boss');s.bossesSpawned++;emit(s,'boss');}
  s.spawnIn-=dt;
  if(!s.mission&&s.spawnIn<=0) {
    const progress=s.time/duration;
    s.spawnIn=Math.max(.3,1.2-progress*.9);
    const roll=random(s), kind=progress>.12&&roll<.16?'shooter':progress>.22&&roll<.30?'charger':progress>.07&&roll<.56?'hunter':'drone';
    spawnEnemy(s,kind);
    if(progress>.5&&random(s)<.35)spawnEnemy(s,'drone');
  }
  p.fire-=dt;
  if(p.fire<=0&&!s.mission) {
    const targets=s.enemies.filter(e=>length(p,e)<540).sort((a,b)=>length(p,a)-length(p,b));
    if(targets.length) {
      p.fire=st.fire;const n=1+(s.upgrades.split||0);
      for(let i=0;i<n;i++) {
        const e=targets[i%targets.length], angle=Math.atan2(e.y-p.y,e.x-p.x)+(i>=targets.length?(i-(n-1)/2)*.08:0);
        if(s.shots.length<180)s.shots.push({x:p.x,y:p.y,vx:Math.cos(angle)*680,vy:Math.sin(angle)*680,life:.85,damage:st.bullet});
      }
      emit(s,'shot');
    }
  }
  for(const e of s.enemies) {
    if(s.mission)continue;
    e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);e.timer-=dt;
    const angle=Math.atan2(p.y-e.y,p.x-e.x),dist=length(p,e);
    let speed=e.restrained>0?0:e.speed*(e.slow>0?.38:1),a=angle;
    if(e.kind==='shooter') {
      if(dist<340)speed=-speed*.75;
      if(e.timer<=0){shoot(s,e,angle);e.timer=2.8;}
    }
    if(e.kind==='charger') {
      if(e.timer<.65&&e.timer>0)speed=0;
      if(e.timer<=0){e.dx=Math.cos(angle);e.dy=Math.sin(angle);e.charge=.65;e.timer=3.7;emit(s,'charge');}
      if(e.charge>0){e.charge-=dt;speed=400;a=Math.atan2(e.dy,e.dx);}
    }
    if(e.kind==='boss') {
      const enraged=e.hp<e.maxHp*.5;
      if(dist<220)speed=0;
      if(e.tier===2) {
        if(e.timer<.8&&e.timer>0)speed=0;
        if(e.charge>0){e.charge-=dt;speed=340;a=Math.atan2(e.dy,e.dx);}
      }
      if(e.timer<=0) {
        e.pattern++;
        if(e.tier===0) {
          // Surveyor: aimed fans with safe space on either side.
          for(let i=-2;i<=2;i++)shoot(s,e,angle+i*.19,enraged?205:175);
          e.timer=enraged?2:2.8;
        } else if(e.tier===1) {
          // Bastion: rotating escape gap. Circuits bypass cannon armor.
          const count=14,gap=e.pattern%count;
          for(let i=0;i<count;i++)if(i!==gap&&i!==(gap+1)%count)shoot(s,e,i*TAU/count+e.phase,135);
          e.timer=enraged?2.2:3;
        } else if(e.tier===2) {
          // Spear: telegraphed body dash and perpendicular projectile wake.
          e.dx=Math.cos(angle);e.dy=Math.sin(angle);e.charge=.7;
          for(const offset of [-Math.PI/2,Math.PI/2])for(let i=-1;i<=1;i++)shoot(s,e,angle+offset+i*.2,150);
          e.timer=enraged?2.4:3.4;
        } else {
          // Heart: four-arm spiral reverses after half health.
          e.phase+=(enraged?-.31:.25);
          for(let i=0;i<4;i++)shoot(s,e,e.phase+i*Math.PI/2,enraged?155:125);
          if(e.pattern%8===0)for(let i=-1;i<=1;i++)shoot(s,e,angle+i*.14,195);
          e.timer=enraged?.5:.72;
        }
        emit(s,'bossPulse');
      }
    }
    e.x=clamp(e.x+Math.cos(a)*speed*dt,e.r,WIDTH-e.r);e.y=clamp(e.y+Math.sin(a)*speed*dt,e.r,HEIGHT-e.r);
    if(e.hp>0&&!(e.restrained>0)&&length(e,p)<e.r+13)damagePlayer(s,e.damage);
  }
  for(const b of s.shots) {
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    for(const e of s.enemies)if(e.hp>0&&b.life>0&&length(e,b)<e.r+5){hit(s,e,b.damage,'Cannon');b.life=0;break;}
  }
  for(const b of s.hazards) {b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(length(b,p)<b.r+12){damagePlayer(s,b.damage);b.life=0;}}
  s.shots=s.shots.filter(b=>b.life>0);
  s.hazards=s.hazards.filter(b=>b.life>0&&b.x>-10&&b.x<WIDTH+10&&b.y>-10&&b.y<HEIGHT+10);
  reap(s);
  let gained=0;
  s.pickups=s.pickups.filter(g=>{
    const d=length(g,p);
    if(d<st.magnet){const sp=260+Math.max(0,st.magnet-d)*3;g.x+=(p.x-g.x)/(d||1)*Math.min(d,sp*dt);g.y+=(p.y-g.y)/(d||1)*Math.min(d,sp*dt);}
    if(length(g,p)<24){gained+=g.value;return false;}return true;
  });
  for(const e of [...s.effects]) {e.life-=dt;if(e.type==='echo'&&e.life<=0)circuit(s,e.points,true,e.power);}
  s.effects=s.effects.filter(e=>e.life>0);
  if(!s.mission&&s.time>=duration&&s.bossesKilled>=4&&s.status==='playing'){s.status='won';s.score+=5000;emit(s,'end');}
  if(gained&&s.status==='playing'){addXp(s,gained);emit(s,'pickup');}
  if(s.events.length>80)s.events.splice(0,s.events.length-80);
}
export function serialize(s) {
  return JSON.stringify({...s,effects:[],events:[]});
}
export function restore(raw) {
  try {
    if(typeof raw!=='string'||raw.length>1500000)return null;
    const s=JSON.parse(raw);
    if(s.version===1){s.version=2;s.tutorialStep=-1;for(const e of s.enemies||[])Object.assign(e,{tier:e.kind==='boss'?clamp(s.bossesKilled,0,3):0,pattern:0,practice:false});}
    if(s.version!==SAVE_VERSION||!['playing','draft'].includes(s.status)||!['voyage','sprint'].includes(s.mode)||!['weaver','courier','bastion'].includes(s.ship))return null;
    const finiteTree=o=>typeof o==='number'?Number.isFinite(o):Array.isArray(o)?o.every(finiteTree):o&&typeof o==='object'?Object.values(o).every(finiteTree):true;
    if(!finiteTree(s)||!s.player||s.player.hp<=0||!s.upgrades||!Array.isArray(s.draft))return null;
    const template=createRun();
    for(const [key,value] of Object.entries(template)) {
      if(typeof value==='number'&&(typeof s[key]!=='number'||(key!=='tutorialStep'&&s[key]<0)))return null;
      if(Array.isArray(value)&&!Array.isArray(s[key]))return null;
    }
    for(const key of Object.keys(template.player))if(typeof s.player[key]!=='number')return null;
    if(!Number.isInteger(s.tutorialStep)||s.tutorialStep < -1||s.tutorialStep>3)return null;
    if(s.player.x<0||s.player.x>WIDTH||s.player.y<0||s.player.y>HEIGHT||s.time>7200||s.level>200||s.nextXp<1||s.bossesSpawned>4||s.bossesKilled>4||s.bossesKilled>s.bossesSpawned)return null;
    for(const [id,n] of Object.entries(s.upgrades)){const u=UPGRADES.find(u=>u.id===id);if(!u||!Number.isInteger(n)||n<0||n>u.max)return null;}
    if(s.draft.some(id=>!UPGRADES.find(u=>u.id===id))||new Set(s.draft).size!==s.draft.length)return null;
    if(s.status==='draft'&&(s.draft.length<1||s.draft.length>3||s.pendingLevels<1))return null;
    if(s.enemies.length>180||s.shots.length>180||s.hazards.length>260||s.pickups.length>250||s.anchors.length>2)return null;
    const fields={enemies:['id','x','y','hp','maxHp','r','speed','damage','xp','slow','timer','flash','charge','dx','dy','phase','tier','pattern'],shots:['x','y','vx','vy','life','damage'],hazards:['x','y','vx','vy','life','r','damage'],pickups:['x','y','value'],anchors:['x','y']};
    for(const [name,keys] of Object.entries(fields))for(const item of s[name])if(!item||keys.some(k=>typeof item[k]!=='number'))return null;
    if(s.enemies.some(e=>!['drone','hunter','shooter','charger','boss'].includes(e.kind)||e.hp<=0||e.r<=0||e.maxHp<=0||!Number.isInteger(e.tier)||e.tier<0||e.tier>3||typeof e.practice!=='boolean'))return null;
    s.player.hp=clamp(s.player.hp,1,stats(s).maxHp);s.player.energy=clamp(s.player.energy,0,stats(s).maxEnergy);
    s.effects=[];s.events=[];return s;
  }catch{return null;}
}
