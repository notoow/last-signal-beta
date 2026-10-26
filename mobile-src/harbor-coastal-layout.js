// Development-only connected coast. Keep ground assets and arena dimensions fixed.
import {shoreRoute} from './shore-navigation.js';
import {waterAt,shoreBuildings} from './rogue-map.js';

// Omitting a graph edge is insufficient: overlapping basins can reopen it.
function hasClosedDirectPassage(map, profile) {
 if (profile === 0) return true;
 const from = map.nodes.find(n => n.id === (profile === 1 ? 'basin-1' : 'basin-0'));
 const to = map.nodes.find(n => n.id === (profile === 1 ? 'sea-gate' : 'basin-1'));
 for (let i = 0; i <= 100; i++) {
  const t = i / 100;
  if (!waterAt(map, {x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t}, 70)) return true;
 }
 return false;
}
function channelsRemainOpen(map) {
 for(const edge of map.edges)for(let j=1;j<edge.points.length;j++){
  const a=edge.points[j-1],b=edge.points[j];
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/10));
  for(let i=0;i<=steps;i++)if(!waterAt(map,{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},70))return false;
 }
 return true;
}
function move(o,dx,dy){if(!o||typeof o!=='object')return;if(typeof o.x==='number')o.x+=dx;if(typeof o.y==='number')o.y+=dy;for(const v of Object.values(o))if(typeof v==='object')move(v,dx,dy);}
function packed(original,seed,attempt=0){const profile=seed%3;const m=structuredClone(original),oldWidth=m.width,oldGate=m.nodes.find(n=>n.id==='sea-gate').x,gateX=oldGate+Math.round((1520-oldGate)/40)*40,shift=gateX-oldGate,slots=[[{x:480,y:880},{x:1000,y:720},{x:760,y:1360}],[{x:480,y:960},{x:1040,y:800},{x:760,y:1360}],[{x:480,y:800},{x:1000,y:880},{x:840,y:1320}]][profile];
 let state=(seed^Math.imul(attempt+1,0x9e3779b1))>>>0;
 const offset=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return((state>>>0)%3-1)*40;};
 for(const p of slots){p.x+=offset();p.y+=offset();}
 const props=[];
 m.berths.forEach((b,i)=>{const r=m.islands[b.island],old={...r},p=slots[i],dx=p.x-b.x,dy=p.y-160-(r.y+r.h);for(const prop of m.props)if(prop.berth===b.id||(prop.x>=old.x&&prop.x<old.x+old.w&&prop.y>=old.y&&prop.y<old.y+old.h)){move(prop,dx,dy);props.push(prop);}move(r,dx,dy);move(b,dx,dy);});m.props=props;
 move(m.boss,shift,0);move(m.exit,shift,0);move(m.landmarks,shift,0);m.arenaShiftX=(m.arenaShiftX||0)+shift;m.width+=shift;m.cols=m.width/40;m.tiles=Array(m.cols*m.rows).fill(4);
 m.nodes=[{id:'arrival',...m.spawn},...slots.map((p,i)=>({id:'basin-'+i,...p})),...slots.map((p,i)=>({id:'outer-'+i,x:p.x,y:280})),{id:'sea-gate',x:gateX,y:900}];m.edges=[];
 const edge=(a,b,points)=>m.edges.push({from:a,to:b,width:400,role:'working',points:points||[m.nodes.find(n=>n.id===a),m.nodes.find(n=>n.id===b)]});
 edge('arrival','basin-0');if(profile!==2)edge('basin-0','basin-1');edge('basin-0','basin-2',[slots[0],{x:400,y:1120},{x:400,y:1360},slots[2]]);if(profile!==1)edge('basin-1','sea-gate');edge('basin-2','sea-gate',[slots[2],{x:1120,y:1360},{x:1320,y:1120},{x:gateX,y:900}]);
 if(profile!==1){edge('arrival','outer-0',[m.spawn,{x:180,y:280},m.nodes.find(n=>n.id==='outer-0')]);edge('outer-0','outer-1');edge('outer-1','sea-gate',[m.nodes.find(n=>n.id==='outer-1'),{x:1440,y:280},{x:gateX,y:900}]);}
 m.edges=m.edges.filter(e=>!e.from.startsWith('outer')&&!e.to.startsWith('outer'));m.nodes=m.nodes.filter(n=>!n.id.startsWith('outer'));
 // Carving is local: do not scan the whole sea for every channel sample.
 const carve=(p,r)=>{
  const left=Math.max(2,Math.floor((p.x-r)/40)),right=Math.min(m.cols-2,Math.ceil((p.x+r)/40));
  const top=Math.max(2,Math.floor((p.y-r)/40)),bottom=Math.min(m.rows-2,Math.ceil((p.y+r)/40));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)
   if(Math.hypot((x+.5)*40-p.x,(y+.5)*40-p.y)<r)m.tiles[y*m.cols+x]=0;
 };
 for(const e of m.edges)for(let j=1;j<e.points.length;j++){const a=e.points[j-1],b=e.points[j],n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/20);for(let k=0;k<=n;k++)carve({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n},e.width/2);}
 for(const p of slots)carve(p,280);
 for(let y=5;y<40;y++)for(let x=Math.floor((gateX+40)/40);x<m.cols-1;x++)m.tiles[y*m.cols+x]=0;
 if(profile===2)for(let y=600/40;y<1080/40;y++)for(let x=680/40;x<760/40;x++)m.tiles[y*m.cols+x]=4;
 for(const [i,r]of m.islands.entries()){
  // Leave the northern cross-channel clear above the southern working quay.
  const extension=i===2?[80,0,0][profile]:i===1?80:160;r.y-=extension;r.h+=extension;
  if(extension>=80)for(const dx of [16,100])m.props.push({kind:'warehouse',visual:'warehouse',x:r.x+dx,y:r.y+16,w:38.4,h:20.784});
 }
 const fillRock=(x,y,w,h)=>{for(let ty=y/40;ty<(y+h)/40;ty++)for(let tx=x/40;tx<(x+w)/40;tx++)m.tiles[ty*m.cols+tx]=4;};
 fillRock(80,80,1280,160);
 for(const r of m.islands.slice(0,2))fillRock(r.x-40,240,r.w+80,Math.max(0,r.y-240));
 // Keep the southern working island accessible; no unvalidated land spur.
 for(const b of m.berths){
  const r=m.islands[b.island];if(r.h<=120)continue;
  const x=r.x+80,y=r.y+64;b.loot={x,y};b.searchPoint={x,y:y+4.08};
  const chest=m.props.find(p=>p.kind==='cache'&&p.berth===b.id);
  if(!chest)throw Error('Missing relocated chest');
  chest.x=x-2.16;chest.y=y-2.4;
 }
 // Divide the long rear apron with full-size working buildings. Keep the
 // central passage open and preserve the artwork's physical footprint.
 for(const r of m.islands){
  if(r.h<240)continue;
  for(const dx of [16,100]){
   const b={kind:'warehouse',visual:'warehouse',x:r.x+dx,y:r.y+100,w:38.4,h:20.784};
   const occupied=[...m.props,...m.islands.flatMap(shoreBuildings)];
   if(!occupied.some(o=>b.x<o.x+o.w+6&&b.x+b.w>o.x-6&&b.y<o.y+o.h+6&&b.y+b.h>o.y-6))m.props.push(b);
  }
 }
 for(const r of m.islands)for(let y=r.y/40;y<(r.y+r.h)/40;y++)for(let x=r.x/40;x<(r.x+r.w)/40;x++)m.tiles[y*m.cols+x]=1;
 m.cliffs=m.tiles.map(t=>t===4?1:0);m.topology='coast-'+profile+'-'+slots.map(p=>p.x+','+p.y).join('|');m.coastAttempt=attempt;return {m,oldWidth};}

export function generateSeededCoast(original,seed,validate){
 for(let attempt=0;attempt<16;attempt++){
  const {m}=packed(original,seed,attempt);if(!validate(m).ok)continue;
  if(!hasClosedDirectPassage(m,seed%3))continue;
  if(!channelsRemainOpen(m))continue;
  if(!m.berths.every(b=>shoreRoute(m,b.landing,b.searchPoint,1.056)&&(!b.rescuePoint||shoreRoute(m,b.landing,b.rescuePoint,1.056))))continue;
  return m;
 }
 throw Error('No connected coast for '+seed);
}
