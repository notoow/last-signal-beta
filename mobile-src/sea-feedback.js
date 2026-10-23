import {towFlows,towWalls,towBodies} from './tow-core.js';
import {stormState} from './expedition.js';
import {gameArt} from './game-art.js';
const inside=(p,r)=>p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h;
const picture=name=>{if(typeof Image==='undefined')return null;const im=new Image();im.src='assets/vfx/'+name+'.png';return im;};
const foam=picture('foam'),spray=picture('spray');
export function seaTelemetry(s){
 const gust=stormState(s),flows=towFlows(s),current=flows.filter(f=>inside(s.boat,f)).reduce((a,f)=>({x:a.x+f.ax,y:a.y+f.ay}),{x:0,y:0});
 return {gust,exposed:!!gust&&gust.active&&inside(s.boat,gust),wind:gust?.active?Math.hypot(gust.ax,gust.ay):0,current,currentStrength:Math.hypot(current.x,current.y),boost:!!s.voyage?.situation?.boosting,charge:s.voyage?.situation?.charge??0};
}
export function instrumentsMarkup(s,language){
 const t=seaTelemetry(s),ko=language!=='en',g=t.gust;if(!g)return '';
 const arrow=(x,y,color)=>'<path d="M-17 0H17M8-7L17 0L8 7" fill="none" stroke="'+color+'" stroke-width="3" transform="translate(32 32) rotate('+Math.atan2(y,x)*180/Math.PI+')"/>';
 return '<div class="sea-instruments" aria-label="'+(ko?'풍향·해류 계기':'Wind and current instruments')+'"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#132b2b" stroke="#a6b9ad"/><text x="32" y="13" text-anchor="middle" fill="#ebd9b0" font-size="10">N</text>'+arrow(g.ax,g.ay,g.active?'#f2c879':'#7b918a')+'</svg><div><b>'+(ko?'풍압 ':'Wind force ')+Math.round(t.wind)+' / 48</b><span>'+(g.ax>0?(ko?'동쪽으로 →':'Eastward →'):(ko?'서쪽으로 ←':'Westward ←'))+' · '+(t.exposed?(ko?'현재 영향':'Exposed'):g.active?(ko?'구역 밖':'Outside zone'):g.warning?(ko?'곧 돌풍':'Incoming'):(ko?'소강':'Lull'))+'</span></div><div class="current-reading"><b>'+(ko?'선체 위치 해류':'Current at hull')+'</b><span>'+(t.currentStrength?direction(t.current.x,t.current.y)+' '+Math.round(t.currentStrength):(ko?'흐름 없음':'No flow'))+'</span></div><div class="drive-reading '+(t.boost?'firing':'')+'"><b>'+(t.boost?(ko?'과출력 가동':'OVERDRIVE'):'SHIFT')+' · '+Math.floor(t.charge)+'%</b><meter min="0" max="100" value="'+t.charge+'" aria-label="'+(ko?'부스터 충전':'Drive charge')+'"></meter></div></div>';
}
function direction(x,y){return Math.abs(x)>Math.abs(y)?(x>0?'→':'←'):(y>0?'↓':'↑');}
export function drawSeaFeedback(s){
 const c=this.c,walls=towWalls(s),time=this.reduce?0:s.time;
 c.save();
 for(const w of walls)gameArt.dressing(c,w,time,s.power,walls);
 for(const f of towFlows(s)){
  const mag=Math.hypot(f.ax,f.ay);if(!mag)continue;const dx=f.ax/mag,dy=f.ay/mag;
  // Thin advected ribbons follow the real force vector, clipped clear of solid quay geometry.
  c.save();c.beginPath();c.rect(f.x,f.y,f.w,f.h);c.clip();c.beginPath();c.rect(f.x,f.y,f.w,f.h);for(const w of walls)c.rect(w.x-2,w.y-2,w.w+4,w.h+4);c.clip('evenodd');
  for(let i=0;i<56;i++){
   const x=f.x+((i*97+time*dx*mag*.85)%f.w+f.w)%f.w,y=f.y+((i*61+time*dy*mag*.85)%f.h+f.h)%f.h;
   const length=12+(i%4)*4,sway=Math.sin(time*.8+i)*2;
   c.strokeStyle=i%5?'#8fbab458':'#c7d8c980';c.lineWidth=i%5?1:1.5;c.beginPath();c.moveTo(x-dx*length,y-dy*length);c.quadraticCurveTo(x-dy*sway,y+dx*sway,x+dx*length,y+dy*length);c.stroke();
   if(i%11===0){c.strokeStyle='#b8d8cb80';c.beginPath();c.moveTo(x+dx*5-dy*3,y+dy*5+dx*3);c.lineTo(x+dx*10,y+dy*10);c.lineTo(x+dx*5+dy*3,y+dy*5-dx*3);c.stroke();}
  }
  c.restore();
 }
 // A thin moving contact line seats the quay in the water without oversized foam sprites.
 for(const w of walls){for(let x=w.x+7;x<w.x+w.w-8;x+=29){const y=w.y+w.h+3+Math.sin(time*.8+x*.03)*1.2;if(walls.some(other=>other!==w&&x>other.x&&x<other.x+other.w&&y>other.y&&y<other.y+other.h))continue;c.strokeStyle='#b4d2c42b';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+6,y+1.5,x+14,y-.5);c.stroke();}}
 // Wakes use each hull's actual speed and beam, so parked boats do not paint giant surf.
 for(const body of [s.boat,...towBodies(s)]){
  const speed=Math.hypot(body.vx,body.vy);if(speed<4)continue;const dx=body.vx/speed,dy=body.vy/speed,length=Math.min(body.length*1.3,speed*.65),beam=body.width*.45;
  c.save();c.strokeStyle='#abc8bc55';c.lineWidth=1.2;
  for(let side of [-1,1]){c.beginPath();for(let i=0;i<=9;i++){const p=i/9,x=body.x-dx*(body.length*.4+p*length)-dy*side*(beam+p*beam*.7),y=body.y-dy*(body.length*.4+p*length)+dx*side*(beam+p*beam*.7);if(!i)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
  c.restore();
 }
 const b=s.boat,boost=!!s.voyage?.situation?.boosting;
 if(boost){
  c.save();c.translate(b.x,b.y);c.rotate(b.angle);
  for(let i=0;i<(this.reduce?5:18);i++){const p=(i/18+time*1.8)%1,x=-20-p*45,y=Math.sin(i*7)*p*7,size=6+p*14;c.globalAlpha=(1-p)*.9;if(foam?.complete&&foam.naturalWidth)c.drawImage(foam,x-size/2,y-size/3,size,size*.65);}
  c.globalAlpha=.8;if(spray?.complete&&spray.naturalWidth)c.drawImage(spray,-48,-12,28,24);c.restore();
  c.strokeStyle='#ecd49b';c.lineWidth=1.5/this.scale;c.beginPath();c.arc(b.x,b.y,42,Math.PI*.15,Math.PI*.15+Math.PI*1.7*(s.voyage.situation.charge/100));c.stroke();
 }
 c.restore();
}
