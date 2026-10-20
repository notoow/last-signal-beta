import {workSprite,workRope,workBuoy} from './harbor-work-art.js';
import {drawPrecision} from './piloting.js';
import {drawMarketGuide,drawMarketPointer} from './market-guidance.js';
import {drawSeaFeedback} from './sea-feedback.js';
import {minimapLayout} from './hud-layout.js';
import {edgeMarker} from './rogue-camera.js';
import {drawExpedition} from './expedition-view.js';
import {gameArt} from './game-art.js';
import {towMission,towBodies,towBody,towBodyId,towTarget,bodyPoint,towWalls,towFlows,towCutPreview,towAction,towWorkBenefits,towDockPowered,towAssistState} from './tow-core.js';
// Data-driven harbor presentation; the original bus07 art remains in TowRenderer.
export function drawContentMission(s,time,l,presentation){
 this.clock=time;this.state=null;this.text=l;this.background(time,true);
 const c=this.c,def=towMission(s),world=def.world,a=s.boat,b=s.connected?towTarget(s):a;
 this.frameCamera(s,world,b);
 c.save();c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);
 if(this.shake>0&&!this.reduce){c.translate(Math.sin(time*80)*this.shake,Math.cos(time*70)*this.shake);this.shake*=.88;}
 gameArt.water(c,world.width,world.height,this.reduce?0:s.time);
 for(const [i,w]of towWalls(s).entries()){
  if(gameArt.wall(c,w)){const label=w.id==='market-hall'?l.marketHall:w.id==='pump-yard'?l.sluiceYard:w.id==='west-quay'?l.marketGantry:null;if(label)this.label(label,w.x+w.w/2,w.y+30,'#f2ddad',18);continue;}
  if(w.h<85||w.w<85){c.fillStyle='#51695e';c.fillRect(w.x,w.y,w.w,w.h);c.strokeStyle='#b5b88e';c.lineWidth=2;c.strokeRect(w.x+2,w.y+2,w.w-4,w.h-4);}else this.block(w,i%5,'');
  if(w.id==='market-hall'){
   c.fillStyle='#61766a';c.fillRect(w.x+8,w.y+12,w.w-16,w.h-30);
   for(let x=w.x+15;x<w.x+w.w-25;x+=95){c.fillStyle='#b4aa82';c.fillRect(x,w.y+w.h-34,84,44);c.fillStyle='#8f6850';c.fillRect(x,w.y+w.h-34,42,44);c.fillStyle='#244b42';c.fillRect(x+8,w.y+w.h-23,68,15);}
   this.label(l.marketHall,w.x+w.w/2,w.y+58,'#e7d7ab',24);
   c.fillStyle='#9b9470';c.fillRect(w.x+72,w.y+78,110,70);c.strokeStyle='#d2c391';c.lineWidth=2;c.strokeRect(w.x+76,w.y+82,102,62);
   for(let i=0;i<5;i++){c.strokeStyle='#e4d8b188';c.beginPath();c.moveTo(w.x+85,w.y+95+i*9);c.lineTo(w.x+155-i*4,w.y+95+i*9);c.stroke();}
   this.label(l.marketNames,w.x+126,w.y+168,'#e9d6a0',11);
   c.fillStyle='#baad7b';c.fillRect(w.x+243,w.y+115,21,34);c.fillStyle='#7c8d6d';c.fillRect(w.x+274,w.y+129,23,18);
  }
  if(w.id==='pump-yard'){
   c.fillStyle='#657568';c.fillRect(w.x+18,w.y+22,w.w-36,w.h-42);this.label(l.sluiceYard,w.x+w.w/2,w.y+75,'#e1d4a8',25);
   c.fillStyle='#d1c8a0';c.fillRect(w.x+65,w.y+130,220,112);for(let r=0;r<7;r++){c.strokeStyle='#657468';c.lineWidth=1;c.beginPath();c.moveTo(w.x+76,w.y+146+r*12);c.lineTo(w.x+271,w.y+146+r*12);c.stroke();}
   this.label(l.sluiceRoster,w.x+178,w.y+268,'#decba0',12);c.fillStyle='#2c4a41';c.fillRect(w.x+w.w-52,w.y+30,24,w.h-60);c.strokeStyle='#d8c9a0';for(let r=0;r<17;r++){c.beginPath();c.moveTo(w.x+w.w-50,w.y+43+r*16);c.lineTo(w.x+w.w-35+(r%5===0?9:0),w.y+43+r*16);c.stroke();}this.label(l.sluiceLevel,w.x+w.w-75,w.y+w.h-12,'#dccb9a',10);
  }
  if(w.id==='control-jetty'){
   c.fillStyle='#777d65';c.fillRect(w.x+12,w.y+20,w.w-24,w.h-42);c.fillStyle='#a1a481';c.fillRect(w.x+33,w.y+50,85,72);c.fillStyle='#b58b5b';c.fillRect(w.x+66,w.y+47,37,21);c.strokeStyle='#d3c393';c.lineWidth=3;c.strokeRect(w.x+30,w.y+47,92,78);c.fillStyle='#233f38';c.fillRect(w.x+43,w.y+68,30,27);this.label(l.sluicePatchedHut,w.x+w.w/2,w.y+w.h+23,'#dbd2a5',11);
  }
  if(w.id==='west-quay'){
   c.fillStyle='#ad9868';c.fillRect(w.x+w.w-75,w.y+35,54,170);c.strokeStyle='#c4b180';c.lineWidth=7;c.beginPath();c.moveTo(w.x+w.w-47,w.y+62);c.lineTo(w.x+w.w+26,w.y+62);c.lineTo(w.x+w.w+26,w.y+108);c.stroke();
   this.label(l.marketGantry,w.x+w.w/2,w.y+120,'#d9c496',18);
  }
 }
 drawSeaFeedback.call(this,s);
 drawExpedition.call(this,s,this.language,false,presentation);
 const power=s.powerBox;c.strokeStyle=s.power?'#d2b36b70':'#66766650';c.lineWidth=3;c.setLineDash([8,8]);c.beginPath();c.moveTo(power.x,power.y);c.lineTo(world.winch.x,world.winch.y);c.stroke();c.setLineDash([]);
 workSprite(c,'power',power.x,power.y,36,40,0,s.power);this.label(l.towPowerBox,power.x,power.y+42,'#dfc897',12);
 for(const m of s.moorings){
  const body=towBody(s,m.bodyId||'bus'),p=bodyPoint(body,m.localX);workRope(c,m,m.cut?{x:m.x+(p.x-m.x)*.18,y:m.y+(p.y-m.y)*.18}:p,.2,3.8,!m.cut);workSprite(c,'cleat',m.x,m.y,24,21,0,!m.cut);this.label(l[def.moorings.find(d=>d.id===m.id).nameKey||(m.bodyId==='ice'?'marketIceLine':'marketPassengerLine')]+(m.cut?' ✓':''),m.x,m.y-23,'#ddc792',12);
 }
 const work=towWorkBenefits(s);if(s.missionId==='sluice'&&s.workProfile==='infrastructure'){c.strokeStyle=work.sluiceBypass?'#b9dc97':'#d7ad70';c.lineWidth=4;c.strokeRect(1196,1056,168,68);this.label(l[work.sluiceBypass?'sluiceBypassReady':'sluiceBypassClosed'],1280,1040,'#d8d9a0',12);}
 if(work.marketGenerator||work.landingCrew){const station=def.stations[0],winch=work.marketGenerator?world.winch:def.cargo.find(b=>b.id==='pontoon').dock.winch;c.strokeStyle='#afd5ad66';c.lineWidth=2;c.setLineDash([5,12]);c.beginPath();c.moveTo(station.x,station.y);c.lineTo(winch.x,winch.y);c.stroke();c.setLineDash([]);c.fillStyle='#b9d59b';c.fillRect(station.x-18,station.y-38,36,20);this.label(l[work.marketGenerator?'marketAuxReady':'landingCrewReady'],station.zone.x+station.zone.w/2,station.zone.y-28,'#d6e5b5',12);}
 const berth=world.berth;c.fillStyle='#d0bb7310';c.fillRect(berth.x,berth.y,berth.w,berth.h);c.strokeStyle='#d3bd7d';c.lineWidth=2;c.setLineDash([12,9]);c.strokeRect(berth.x,berth.y,berth.w,berth.h);c.setLineDash([]);
 c.save();c.translate(world.winch.x-s.bus.length/2*Math.cos(berth.angle),world.winch.y-s.bus.length/2*Math.sin(berth.angle));c.rotate(berth.angle);c.strokeStyle='#d7ca9777';c.beginPath();c.roundRect(-s.bus.length/2,-s.bus.width/2,s.bus.length,s.bus.width,26);c.stroke();c.beginPath();c.moveTo(15,-8);c.lineTo(35,0);c.lineTo(15,8);c.stroke();c.restore();
 workSprite(c,'winch',world.winch.x,world.winch.y,38,30,0,towDockPowered(s));this.label(l.towSafePier,berth.x+berth.w/2,berth.y-28,'#e1cf98',19);this.label(towDockPowered(s)?l.towDockPowered:l.towDockManual,berth.x+berth.w/2,berth.y+berth.h+30,'#c9c8a4',12);
 for(const cargo of def.cargo||[]){
  if(!cargo.dock)continue;
  const {berth:z,winch:w}=cargo.dock,secured=s.secured.includes(cargo.id);
  c.fillStyle=secured?'#b3db9b35':'#d0bb7310';c.fillRect(z.x,z.y,z.w,z.h);
  c.strokeStyle=secured?'#b3db9b':'#dec88b';c.lineWidth=2;c.setLineDash([10,7]);c.strokeRect(z.x,z.y,z.w,z.h);c.setLineDash([]);
  workSprite(c,'winch',w.x,w.y,34,28,0,towDockPowered(s,towBody(s,cargo.id)));
  this.label(l[cargo.dock.nameKey]+(secured?' ✓':''),z.x+z.w/2,z.y+z.h+25,'#e0d0a3',13);
  if(s.cargoLatches[cargo.id]){const b=towBody(s,cargo.id),tip=bodyPoint(b,b.length/2);c.beginPath();c.moveTo(w.x,w.y);c.lineTo(tip.x,tip.y);c.stroke();}
 }
 for(const station of def.stations||[]){
  const z=station.zone,moored=s.temporaryMoorings.find(m=>m.stationId===station.id);c.strokeStyle=moored?'#c8e0ad':'#aec493';c.lineWidth=2;c.setLineDash([5,8]);c.strokeRect(z.x,z.y,z.w,z.h);c.setLineDash([]);workSprite(c,'cleat',station.x,station.y,28,24);this.label(l[station.nameKey],z.x+z.w/2,z.y+z.h+24,'#d3dcac',13);
  c.save();c.translate(z.x+z.w/2,z.y+z.h/2);c.rotate(station.angle);c.strokeStyle='#b6cd9b';c.beginPath();c.moveTo(-25,0);c.lineTo(25,0);c.lineTo(15,-8);c.moveTo(25,0);c.lineTo(15,8);c.stroke();c.restore();
  if(moored){const body=towBody(s,moored.bodyId),p=bodyPoint(body,body.length/2);c.beginPath();c.moveTo(station.x,station.y);c.lineTo(p.x,p.y);c.stroke();}
 }
 const sluice=def.crossing.sluice;if(sluice){workSprite(c,'power',sluice.x,sluice.y,36,40,0,s.power);this.label(s.missionId==='landing'&&s.workProfile==='infrastructure'?l[!s.power?'landingTransferOff':s.pumpDirection===1?'landingTransferCross':'landingTransferFollowing']:l[def.visual.sluiceNameKey||'marketDrain']+(s.power?(s.pumpDirection===1?' ↓':' ↑'):' ×'),sluice.x,sluice.y-30,'#cecf9b',12);}
 if(s.anchors.length){
  const points=[...s.anchors,a],spec=s.anchors.length===2?towCutPreview(s,points):null;this.poly(points,s.anchors.length===2);c.fillStyle=spec?.power?'#d2876228':'#cbbb8420';c.strokeStyle=spec?.power?'#e2a17d':'#d6c18a';c.lineWidth=2;c.setLineDash([7,6]);if(s.anchors.length===2)c.fill();c.stroke();c.setLineDash([]);
  for(const [i,p] of s.anchors.entries())workBuoy(c,p,this.reduce?0:time,i);
 }
 for(const e of s.effects)if(e.type==='net'){c.save();c.globalAlpha=e.life/e.max;this.poly(e.points);c.strokeStyle='#e0c68c';c.lineWidth=4;c.stroke();c.restore();}
 if(s.connected){const q=bodyPoint(towTarget(s),towTarget(s).length/2),p=bodyPoint(a,-a.length/2);workRope(c,p,q,s.ropeTension,3.5+s.ropeTension);}
 if(s.dockLatched){const p=bodyPoint(s.bus,s.bus.length/2);workRope(c,world.winch,p,.8);}
 for(const body of towBodies(s)){
  if(body===s.bus){if(def.visual.cargo==='inspection')drawInspection.call(this,body,time,s);else this.bus(body,time,s);}
  else if(!gameArt.boat(c,body,body.visual||'pontoon')){c.save();c.translate(body.x,body.y);c.rotate(body.angle);c.fillStyle='#829b91';c.strokeStyle='#d1c9a4';c.lineWidth=3;c.beginPath();c.roundRect(-body.length/2,-body.width/2,body.length,body.width,12);c.fill();c.stroke();if(body.visual==='pontoon'){c.fillStyle='#b2a37d';c.fillRect(-body.length/2+8,-body.width/2+8,body.length-16,body.width-16);c.strokeStyle='#665f4b';for(let x=-body.length/2+14;x<body.length/2-8;x+=12){c.beginPath();c.moveTo(x,-body.width/2+8);c.lineTo(x,body.width/2-8);c.stroke();}}else for(let x=-45;x<45;x+=25)for(let y=-20;y<20;y+=22){c.fillStyle='#d3e0c8';c.fillRect(x,y,19,16);c.strokeStyle='#9ab8ab';c.lineWidth=1;c.strokeRect(x,y,19,16);}c.restore();}
  const p=bodyPoint(body,body.length/2);c.strokeStyle='#edd190';c.lineWidth=2;this.circle(p.x,p.y,8);c.stroke();
  const leaking=body===s.bus&&s.voyage?.version>=3&&s.voyage.situation.contract==='leaking'&&!s.voyage.situation.patched;
  if(!leaking)this.label(presentation.objectLabels?.[body===s.bus?'bus':body.id]||l[body===s.bus?def.visual.busNameKey||'marketPassenger':body.nameKey||'marketIce'],body.x,body.y-body.width/2-35,'#e1d7af',12);
 }
 drawMarketGuide.call(this,s,presentation);
 drawPrecision(c,a,presentation.pilot);this.tug(a,this.paint);const action=towAction(s);if(action.kind!=='approach')this.label(presentation.action,a.x,a.y+48,'#f1d9a1',12);
 if(s.status==='won'){const shore=def.visual.ashore||{x:1758,y:1120};workSprite(c,'gangway',(world.winch.x+shore.x)/2,world.winch.y,Math.abs(shore.x-world.winch.x)+10,28);this.person(shore.x,shore.y,time,'#bb9264',true);this.person(shore.x+20,shore.y+34,time,'#849b83');}
 c.restore();
 // Offscreen targets stay legible while the camera follows the tug.
 c.setTransform(this.dpr,0,0,this.dpr,0,0);
 if(this.mapOpen)return;
 drawMarketPointer.call(this,s,presentation);
 this.towPointer(s,b);
 if(s.status==='playing'&&!presentation.waypoint)for(const body of towBodies(s)){
  const marker=edgeMarker(this.cameraFrame,body,36);if(!marker)continue;
  const {x:px,y:py,angle}=marker;
  c.save();c.translate(px,py);c.rotate(angle);c.fillStyle=body===s.bus?'#ead39a':'#bbd5bc';c.beginPath();c.moveTo(13,0);c.lineTo(-5,-7);c.lineTo(-5,7);c.closePath();c.fill();c.restore();
  this.label(l[body===s.bus?def.visual.busNameKey||'marketPassenger':body.nameKey||'marketIce'],px,py+23,body===s.bus?'#ead39a':'#bbd5bc',12);
 }
 const mini=minimapLayout(this.w,this.h,world);if(!mini)return;
 c.setTransform(this.dpr,0,0,this.dpr,0,0);const {w,h,x,y,scale}=mini;
 c.fillStyle='#102b2bf0';c.fillRect(x-12,y-25,w+24,h+42);c.strokeStyle='#a8b48d45';c.strokeRect(x-12,y-25,w+24,h+42);c.save();c.translate(x,y);c.scale(scale,scale);
 drawExpedition.call(this,s,this.language,true);drawMarketGuide.call(this,s,presentation,true);for(const r of towWalls(s)){c.fillStyle='#64776b';c.fillRect(r.x,r.y,r.w,r.h);}for(const body of towBodies(s)){c.fillStyle=body===s.bus?'#eee0ba':'#a5c3b1';this.circle(body.x,body.y,32);c.fill();}c.fillStyle='#e0b96e';this.circle(a.x,a.y,24);c.fill();c.strokeStyle='#d8c18b';c.lineWidth=10;c.strokeRect(berth.x,berth.y,berth.w,berth.h);for(const station of def.stations||[]){c.strokeStyle='#b6ce9c';c.lineWidth=9;c.strokeRect(station.zone.x,station.zone.y,station.zone.w,station.zone.h);}if(def.manualSluice){c.fillStyle='#d5b96f';c.fillRect(def.crossing.sluice.x-24,def.crossing.sluice.y-24,48,48);}c.restore();this.label(l[def.textKeys.title],x+w/2,y-10,'#d6cbaa',11);this.label(l[def.visual.mapLegendKey||'marketMapLegend'],x+w/2,y+h+13,'#d6cbaa',10);
}

function drawInspection(body,time,state){
 if(gameArt.boat(this.c,body,'inspection'))return;
 const c=this.c;c.save();c.translate(body.x,body.y);c.rotate(body.angle);const len=body.length,width=body.width;
 c.fillStyle='#101f1c70';c.beginPath();c.roundRect(-len/2+6,-width/2+7,len,width,18);c.fill();c.fillStyle='#7d9587';c.strokeStyle='#d1c59c';c.lineWidth=3;c.beginPath();c.roundRect(-len/2,-width/2,len,width,18);c.fill();c.stroke();
 c.fillStyle='#aab18e';c.fillRect(12,-22,44,44);c.fillStyle='#29493e';c.fillRect(38,-16,13,32);c.fillStyle='#626c59';c.fillRect(-65,-20,62,40);
 for(const x of [-55,-28]){c.strokeStyle='#c4b57e';c.lineWidth=3;c.beginPath();c.arc(x,0,10,0,Math.PI*2);c.stroke();}
 c.strokeStyle='#d7c38e';c.lineWidth=3;c.beginPath();c.moveTo(55,0);c.lineTo(74,0);c.lineTo(67,-18);c.stroke();c.lineWidth=2;c.strokeRect(-75,-23,145,46);
 if(state.status!=='won'){for(const x of [-12,8]){c.fillStyle='#d6bf8c';this.circle(x,-17,4);c.fill();c.fillStyle='#cc905c';c.fillRect(x-4,-14,8,10);}}
 c.fillStyle='#243e33';c.font='bold 12px Pretendard';c.textAlign='center';c.fillText('03',26,5);c.restore();
}
