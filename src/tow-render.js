import {drawSeaFeedback} from './sea-feedback.js';
import {drawPrecision} from './piloting.js';
import {drawMarketGuide,drawMarketPointer} from './market-guidance.js';
import {gameArt} from './game-art.js';
import {workSprite,workRope,workBuoy} from './harbor-work-art.js';
import {PAINTS} from './voyage.js';
import {drawContentMission} from './tow-content-render.js';
import {HarborRenderer} from './harbor-render.js';
import {playCamera,edgeMarker} from './rogue-camera.js';
import {minimapLayout} from './hud-layout.js';
import {TOW_WORLD,TOW_CROSSING,towMission,bodyPoint,hullPoints,towWalls,towCutPreview,pumpPhase,towFollowingFlow,towAssistState,mergePhase,towContext,towDockStatus} from './tow-core.js';
const TAU=Math.PI*2;
export class TowRenderer extends HarborRenderer{
 constructor(canvas){super(canvas);this.camera=null;this.mapOpen=false;}
 frameCamera(s,world,partner){
  const frame=playCamera({width:this.w,height:this.h,world,focus:s.boat,partner:s.connected?partner:null,kind:s.voyage?'voyage':'tow',
   options:this.cameraSettings,overview:this.mapOpen,previous:!this.reduce&&this.camera?this.cameraFrame:null,dt:Math.max(0,Math.min(.1,s.time-(this.cameraTime??s.time))),
   occupied:this.hudRects?[...this.hudRects,...(!this.mapOpen&&minimapLayout(this.w,this.h,world)?[minimapLayout(this.w,this.h,world).occupied]:[])]:null});
  this.cameraFrame=frame;this.camera=frame.camera;this.cameraTime=s.time;this.scale=frame.scale;this.ox=frame.ox;this.oy=frame.oy;
 }
 towPointer(s,partner){
  if(this.mapOpen||!s.connected)return;
  const mark=edgeMarker(this.cameraFrame,partner);if(!mark)return;
  const c=this.c;c.save();c.translate(mark.x,mark.y);c.rotate(mark.angle);c.fillStyle='#bdd7ca';c.beginPath();c.moveTo(12,0);c.lineTo(-7,-7);c.lineTo(-7,7);c.closePath();c.fill();c.restore();
  c.save();c.font='600 12px Pretendard';c.textAlign='center';c.fillStyle='#bdd7ca';c.fillText(this.language==='en'?'Towed vessel':'견인선',Math.max(74,Math.min(this.w-74,mark.x)),mark.y-18);c.restore();
 }
 label(text,x,y,color='#d9cfad',size=13){const c=this.c,t=c.getTransform(),scale=Math.hypot(t.a,t.b)/this.dpr;c.fillStyle=color;c.font=(Math.max(11,Math.min(22,size))/(scale||1))+'px Pretendard';c.textAlign='center';c.fillText(text,x,y);c.textAlign='left';}
 draw(s,time,l,presentation){
  if(s.missionId&&s.missionId!=='bus07')return drawContentMission.call(this,s,time,l,presentation);
  this.clock=time;this.state=null;this.text=l;this.background(time,true);const c=this.c,a=s.boat,b=s.bus;
  this.frameCamera(s,TOW_WORLD,b);
  c.save();c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);
  if(this.shake>0&&!this.reduce){c.translate(Math.sin(time*80)*this.shake,Math.cos(time*70)*this.shake);this.shake*=.88;}
  gameArt.water(c,TOW_WORLD.width,TOW_WORLD.height,this.reduce?0:s.time);
  for(const [i,w]of towWalls(s).entries()){if(w.id==='north-yard')this.yard(w);else if(w.id==='work-pontoon')this.pontoon(w);else this.block(w,i%5);}
  // Submerged common power conduit links the exact two devices affected by a broad cut.
  c.strokeStyle=s.power?'#d4ae6070':'#5c706144';c.lineWidth=3;c.setLineDash([8,6]);
  c.beginPath();c.moveTo(448,423);c.lineTo(580,423);c.lineTo(580,720);c.lineTo(1300,720);c.lineTo(1300,870);c.lineTo(1528,870);c.stroke();if(s.layout==='full'){c.beginPath();c.moveTo(580,423);c.lineTo(650,423);c.lineTo(650,465);c.stroke();}c.setLineDash([]);
  c.strokeStyle='#bea97c55';c.lineWidth=2;
  for(const m of s.moorings){
   const p=bodyPoint(b,m.localX);workRope(c,m,m.cut?{x:m.x+(p.x-m.x)*.2,y:m.y+(p.y-m.y)*.2}:p,.2,3.8,!m.cut);
   workSprite(c,'cleat',m.x,m.y,24,21,0,!m.cut);
   this.label(l[m.id==='bow'?'towBowLine':'towSternLine']+(m.cut?' ✓':''),m.x,m.y-19,m.cut?'#879384':'#e0c790',11);
  }
  workSprite(c,'power',448,423,36,40,0,s.power);
  this.label(l.towPowerBox,448,461,'#d7c593',12);
  this.label(l.towYard,285,237,'#ded0a8',19);
  // C: the bus silhouette itself, not a circular dwell indicator, defines the berth.
  const g=TOW_WORLD.berth;
  c.fillStyle='#c2b16b0c';c.fillRect(g.x,g.y,g.w,g.h);c.strokeStyle='#cbb57855';c.lineWidth=2;c.setLineDash([10,8]);c.strokeRect(g.x,g.y,g.w,g.h);c.setLineDash([]);
  c.save();c.translate(1456,870);c.strokeStyle='#c0bd8866';c.lineWidth=2;c.beginPath();c.roundRect(-72,-30,144,60,28);c.stroke();c.beginPath();c.moveTo(30,-7);c.lineTo(45,0);c.lineTo(30,7);c.stroke();c.restore();
  workSprite(c,'dock',1608,877,155,76,Math.PI/2);
  workSprite(c,'winch',1528,870,38,30,0,s.power);
  this.label(l.towSafePier,1450,777,'#e0cd98',18);if(s.status==='playing')this.label(s.dockLatched?(towAssistState(s)==='braking'?l.towWinchBrake:l.towWinchAlign):s.power?l.towDockPowered:l.towDockManual,1450,960,'#c5c6a1',12);
  if(s.dockLatched)workRope(c,{x:1528,y:870},bodyPoint(b,72),.8);
  if(s.layout==='full')this.crossing(s,time,l);
  drawSeaFeedback.call(this,s);
  // Net preview makes both target inclusion and the linked consequence visible.
  if(s.anchors.length){
   const points=[...s.anchors,a],spec=s.anchors.length===2?towCutPreview(s,points):null;
   this.poly(points,s.anchors.length===2);c.fillStyle=spec?.power?'#d2876228':'#cbbb8420';c.strokeStyle=spec?.power?'#e2a17d':'#d6c18a';c.lineWidth=2;c.setLineDash([7,6]);if(s.anchors.length===2)c.fill();c.stroke();c.setLineDash([]);
   if(spec?.winch){const f=TOW_CROSSING.debris;c.strokeStyle='#e4a47c';c.lineWidth=3;c.setLineDash([7,5]);c.strokeRect(f.x,f.y,f.w,f.h);c.setLineDash([]);this.label(l.towFallPreview,f.x+f.w/2,f.y-13,'#e4b88d',11);}
   if(spec?.power){c.strokeStyle='#efae82';c.lineWidth=3;c.strokeRect(429,402,38,43);}
   for(const [i,p] of s.anchors.entries())workBuoy(c,p,this.reduce?0:time,i);
  }
  for(const e of s.effects)if(e.type==='net'){c.save();c.globalAlpha=e.life/e.max;this.poly(e.points);c.strokeStyle='#e0c68c';c.lineWidth=4;c.stroke();c.restore();}
  if(s.connected)workRope(c,bodyPoint(a,-24),bodyPoint(b,72),s.ropeTension,3.5+s.ropeTension);

  if(s.status==='playing'&&s.connected&&!s.power&&b.x>1180&&Math.abs(b.omega)>.045){
   const prediction=b.angle+b.omega/1.4;c.save();c.translate(b.x,b.y);c.rotate(prediction);c.strokeStyle='#c4dbcb99';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.roundRect(-72,-30,144,60,28);c.stroke();c.beginPath();c.moveTo(74,0);c.lineTo(108,0);c.lineTo(99,-6);c.moveTo(108,0);c.lineTo(99,6);c.stroke();c.setLineDash([]);c.restore();
  }

  this.bus(b,time,s);drawPrecision(c,a,presentation.pilot);this.tug(a,this.paint);if(s.status==='won')this.arrival(s,time,l);
  const ring=bodyPoint(b,72);c.strokeStyle='#e6ca83';c.lineWidth=2;this.circle(ring.x,ring.y,7);c.stroke();
  const d=Math.hypot(a.x-ring.x,a.y-ring.y);if(s.connected||d<130)this.label(presentation?.action||'',a.x,a.y+48,'#e6d4a2',12);
  if(s.status==='playing'&&!s.connected&&d>=130)this.label(l.towBowHook,ring.x+10,ring.y-36,'#d7c491',11);
  for(let i=0;i<60;i++){const x=(i*157+s.time*20)%TOW_WORLD.width,y=(i*389+s.time*130)%TOW_WORLD.height;c.strokeStyle='#c7d5bd13';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+12);c.stroke();}
  drawMarketGuide.call(this,s,presentation);c.restore();if(!this.mapOpen)drawMarketPointer.call(this,s,presentation);this.towPointer(s,b);if(!this.mapOpen)this.minimap(s,l,presentation);
 }
 tug(b,paint){
  if(gameArt.boat(this.c,b,'tug',paint))return;
  const c=this.c;c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.fillStyle=PAINTS[paint]||'#213b34';c.strokeStyle='#c8bd93';c.lineWidth=2.5;c.beginPath();c.roundRect(-24,-12,48,24,10);c.fill();c.stroke();c.fillStyle='#d1b976';c.fillRect(1,-9,13,18);c.fillStyle='#395b53';c.fillRect(4,-6,7,12);c.fillStyle='#647062';c.fillRect(-20,-8,16,16);c.strokeStyle='#c8b780';this.circle(-12,0,5);c.stroke();c.restore();
 }
 bus(b,time,s){
  if(gameArt.boat(this.c,b,'bus'))return;
  const c=this.c;c.save();c.translate(b.x,b.y);c.rotate(b.angle);
  c.fillStyle='#111f1e70';c.beginPath();c.roundRect(-72+7,-30+8,144,60,28);c.fill();
  c.fillStyle='#c1b990';c.strokeStyle='#384b41';c.lineWidth=3;c.beginPath();c.roundRect(-72,-30,144,60,28);c.fill();c.stroke();
  c.fillStyle='#657767';c.fillRect(-46,-23,92,46);c.fillStyle='#c9bc8b';c.fillRect(-40,-14,78,28);
  for(let i=0;i<5;i++){const x=-43+i*18;for(const y of [-22,14]){c.fillStyle='#193b36';c.fillRect(x,y,13,8);}}
  c.fillStyle='#234139';c.beginPath();c.roundRect(43,-21,19,42,7);c.fill();c.strokeStyle='#a3a687';c.lineWidth=2;c.beginPath();c.moveTo(53,-18);c.lineTo(53,18);c.stroke();
  if(s.status!=='won'){c.fillStyle='#d9bc89';this.circle(22,-24,4.5);c.fill();c.fillStyle='#c88d54';c.fillRect(17,-22,10,10);c.strokeStyle='#c88d54';c.lineWidth=3.5;c.lineCap='round';c.beginPath();c.moveTo(25,-18);c.lineTo(32,-32+Math.sin(time*3)*3);c.stroke();c.fillStyle='#ead0a2';this.circle(32,-32+Math.sin(time*3)*3,3);c.fill();for(const x of [-33,-8]){c.fillStyle='#c9bd92';this.circle(x,19,3.5);c.fill();c.fillStyle='#6f9385';c.fillRect(x-4,21,8,7);}}
  c.fillStyle='#425847';c.font='bold 15px Pretendard';c.textAlign='center';c.fillText(towMission(s).visual.mark,0,5);c.textAlign='left';
  for(const x of [-42,0,42])for(const y of [-29,29]){c.fillStyle='#20372e';c.beginPath();c.ellipse(x,y,8,4,0,0,TAU);c.fill();}
  c.restore();
 }
 crossing(s,time,l){
  const c=this.c,phase=pumpPhase(s),gate=mergePhase(s);
  c.fillStyle=phase==='warning'?'#d6aa6319':phase==='active'?'#92b1a413':'#80988405';
  
  this.label(towFollowingFlow(s)&&s.power?l.towFollowingState:l['towPump'+phase[0].toUpperCase()+phase.slice(1)],620,405,'#d3bf8c',12);
  c.strokeStyle='#b3a26c';c.lineWidth=8;c.beginPath();c.moveTo(685,520);c.lineTo(685,465);c.lineTo(650,465);c.stroke();
  workSprite(c,'power',650,465,35,36,0,s.power);this.label(s.crew.includes('operator')?l.towSluice:l.towPumpStation,685,440,'#d3bf8c',11);
  this.label(l.towInnerRoute,618,805,'#b7b697',11);this.label(l.towOuterRoute,1095,312,'#b7b697',12);
  // No decorative dots: navigation markers must represent actual goals or work.
  const {x,y}=TOW_CROSSING.winch;workSprite(c,'winch',x,y,46,38,0,!s.mergeWinchCut);
  this.label(l.towMergeWinch,x,y-37,'#c5b68a',12);
  c.strokeStyle=gate==='closed'?'#db9874':gate==='warning'?'#e8c07d':'#a7b29466';c.lineWidth=gate==='closed'?8:3;c.setLineDash(gate==='warning'?[9,7]:[]);
  c.beginPath();c.moveTo(1200,712);c.lineTo(gate==='closed'||gate==='warning'?1200:1173,gate==='closed'||gate==='warning'?910:743);c.stroke();c.setLineDash([]);
  const labels={priority:l.towWinchPriority,open:l.towWinchOpen,warning:l.towWinchWarning,closed:l.towWinchClosed,held:l.towWinchHeld,cut:l.towWinchCut};
  this.label(labels[gate],1245,691,gate==='warning'?'#eac88f':'#c5b68a',11);
  workSprite(c,'cleat',1200,909,22,17);
  if(s.boom)workSprite(c,'barrier',s.boom.x+s.boom.w/2,s.boom.y+s.boom.h/2,s.boom.w,s.boom.h);
 }

 yard(w){
  if(gameArt.wall(this.c,w))return;
  const c=this.c;c.fillStyle='#091b1e55';c.fillRect(w.x+12,w.y+18,w.w,w.h);
  c.fillStyle='#32483f';c.fillRect(w.x,w.y,w.w,w.h);
  c.fillStyle='#566657';c.fillRect(w.x+8,w.y+65,w.w-16,w.h-73);
  for(let y=w.y+72;y<w.y+w.h-8;y+=18){c.strokeStyle='#a2ad8422';c.lineWidth=1;c.beginPath();c.moveTo(w.x+8,y);c.lineTo(w.x+w.w-8,y);c.stroke();}
  c.fillStyle='#617265';c.beginPath();c.moveTo(w.x-4,w.y);c.lineTo(w.x+w.w+7,w.y);c.lineTo(w.x+w.w-1,w.y+65);c.lineTo(w.x+5,w.y+65);c.closePath();c.fill();
  c.strokeStyle='#b6b28b55';c.lineWidth=2;for(let x=w.x+35;x<w.x+w.w;x+=64){c.beginPath();c.moveTo(x,w.y+4);c.lineTo(x+2,w.y+62);c.stroke();}
  for(const x of [w.x+12,w.x+220,w.x+w.w-18]){c.fillStyle='#253d35';c.fillRect(x,w.y+63,12,w.h-63);c.fillStyle='#899477';c.fillRect(x+2,w.y+65,3,w.h-67);}
  c.fillStyle='#293f35';c.fillRect(w.x+50,w.y+108,144,37);c.fillStyle='#a29b74';c.fillRect(w.x+48,w.y+105,148,7);
  c.fillStyle='#202f2c';c.beginPath();c.roundRect(w.x+93,w.y+79,57,24,7);c.fill();c.strokeStyle='#81907a';c.lineWidth=3;this.circle(w.x+119,w.y+92,12);c.stroke();c.strokeStyle='#cbb276';c.lineWidth=3;c.beginPath();c.moveTo(w.x+105,w.y+66);c.lineTo(w.x+105,w.y+81);c.stroke();
  c.fillStyle='#b6a469';c.fillRect(w.x+35,w.y+64,170,6);c.fillStyle='#d5c28e';c.fillRect(w.x+40,w.y+70,10,5);
  // Waiting bench, folded evacuation blanket, damp tracks and an abandoned lifejacket.
  c.fillStyle='#20352f';c.fillRect(461,171,118,9);c.fillStyle='#a39b72';c.fillRect(462,154,116,17);c.fillStyle='#b0a67c';c.fillRect(465,148,112,5);for(const x of [470,569]){c.fillStyle='#283d31';c.fillRect(x,170,5,16);}
  c.fillStyle='#c68e59';c.beginPath();c.roundRect(490,150,22,23,4);c.fill();c.fillStyle='#33493d';c.fillRect(499,148,4,16);c.fillStyle='#c4c5a1';c.fillRect(535,157,25,10);
  c.fillStyle='#adc2b019';for(let i=0;i<8;i++){c.beginPath();c.ellipse(440+i*17,191+(i%2)*6,4,7,.3,0,TAU);c.fill();}
  c.strokeStyle='#d7c49077';c.lineWidth=2;c.beginPath();c.moveTo(560,196);c.lineTo(601,196);c.lineTo(592,190);c.moveTo(601,196);c.lineTo(592,202);c.stroke();
  c.fillStyle='#c5bf96';c.fillRect(345,116,65,27);c.fillStyle='#385044';c.font='9px Pretendard';c.fillText('EVACUATED',350,133);c.strokeStyle='#bca978';c.lineWidth=2;c.beginPath();c.moveTo(345,116);c.lineTo(410,143);c.stroke();
  c.fillStyle='#c1b68b';c.fillRect(521,213,47,6);for(let i=0;i<4;i++){c.fillStyle=['#969777','#778b74','#607f70','#42675e'][i];c.fillRect(526,221+i*5,37,4);}
  this.label('07 / '+this.text.towMaintenance,288,84,'#d7c9a1',16);
 }
 pontoon(w){
  if(gameArt.wall(this.c,w))return;
  const c=this.c;c.fillStyle='#102a2780';c.fillRect(w.x+4,w.y+6,w.w,w.h);c.fillStyle='#8f8863';c.fillRect(w.x,w.y,w.w,w.h);
  for(let y=w.y+3;y<w.y+w.h;y+=7){c.strokeStyle='#b9a877';c.lineWidth=1.5;c.beginPath();c.moveTo(w.x+3,y);c.lineTo(w.x+w.w-3,y);c.stroke();}
  for(const x of [w.x+4,w.x+w.w-4])for(const y of [w.y+4,w.y+w.h-4]){c.fillStyle='#354936';this.circle(x,y,5);c.fill();}
  c.strokeStyle='#c5b685';c.lineWidth=2;c.beginPath();c.moveTo(w.x+w.w-16,w.y+w.h-2);c.lineTo(w.x+w.w-16,w.y+w.h+12);c.moveTo(w.x+w.w-7,w.y+w.h-2);c.lineTo(w.x+w.w-7,w.y+w.h+12);c.moveTo(w.x+w.w-16,w.y+w.h+6);c.lineTo(w.x+w.w-7,w.y+w.h+6);c.stroke();
 }
 person(x,y,time,jacket='#ca955c',wave=false){
  const c=this.c;c.save();c.translate(x,y);c.fillStyle='#0a221d55';c.beginPath();c.ellipse(1,12,10,4,0,0,TAU);c.fill();
  c.strokeStyle='#304237';c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(-3,7);c.lineTo(-5,13);c.moveTo(3,7);c.lineTo(5,13);c.stroke();
  c.fillStyle=jacket;c.beginPath();c.roundRect(-7,-7,14,17,4);c.fill();c.fillStyle='#dbc59a';this.circle(0,-12,5);c.fill();c.fillStyle='#42534a';c.beginPath();c.arc(0,-13,5,Math.PI,TAU);c.fill();
  c.strokeStyle=jacket;c.lineWidth=4;c.beginPath();c.moveTo(-5,-4);c.lineTo(-10,2);c.moveTo(5,-4);c.lineTo(wave?12:10,wave?-14+Math.sin(time*3)*3:2);c.stroke();c.fillStyle='#decba0';this.circle(wave?12:10,wave?-14+Math.sin(time*3)*3:2,2.7);c.fill();c.restore();
 }
 arrival(s,time,l){
  const c=this.c;workSprite(c,'gangway',1561,870,90,29);
  this.person(1600,845,time,'#cf9a59',true);this.person(1626,870,time,'#7b998a');this.person(1603,899,time,'#c9c4a2');
  c.strokeStyle='#d1c7a045';c.lineWidth=3;c.setLineDash([3,7]);c.beginPath();c.moveTo(1538,870);c.lineTo(1588,870);c.lineTo(1596,853);c.stroke();c.setLineDash([]);
 }

 minimap(s,l,presentation){
  const mini=minimapLayout(this.w,this.h,TOW_WORLD);if(!mini)return;
  const c=this.c;c.setTransform(this.dpr,0,0,this.dpr,0,0);const {w,h,x,y,scale}=mini;
  c.fillStyle='#102b2be8';c.fillRect(x-12,y-25,w+24,h+42);c.strokeStyle='#a8b48d45';c.strokeRect(x-12,y-25,w+24,h+42);
  c.save();c.translate(x,y);c.scale(scale,scale);for(const r of towWalls(s)){c.fillStyle='#64776b';c.fillRect(r.x,r.y,r.w,r.h);}
  c.fillStyle='#d6be83';this.circle(s.boat.x,s.boat.y,24);c.fill();c.fillStyle='#e4dab7';this.circle(s.bus.x,s.bus.y,35);c.fill();c.strokeStyle='#cfb36e';c.lineWidth=12;c.strokeRect(TOW_WORLD.berth.x,TOW_WORLD.berth.y,TOW_WORLD.berth.w,TOW_WORLD.berth.h);drawMarketGuide.call(this,s,presentation,true);c.restore();
  c.fillStyle='#c5c1a0';c.font='10px Pretendard';c.textAlign='center';c.fillText(l.towMiniMap,x+w/2,y-10);c.textAlign='left';
 }
}
