import {gameArt} from './game-art.js';
import {Renderer} from './render.js';
import {WIDTH,HEIGHT,inTriangle} from './core.js';
import {HARBOR,netTargets,machineCycle} from './rescue-core.js';
const TAU=Math.PI*2;
export class HarborRenderer extends Renderer{
  resize(){super.resize();const top=76,bottom=this.w<=1050?86:76,available=this.h-top-bottom;this.scale=Math.min(this.w/WIDTH,available/HEIGHT);this.ox=(this.w-WIDTH*this.scale)/2;this.oy=top+(available-HEIGHT*this.scale)/2;}
  worldFont(size,weight=''){return (weight?weight+' ':'')+Math.max(size,10/(this.scale||1))+'px Pretendard';}
  background(time,worldWater=false){
    const c=this.c;c.setTransform(this.dpr,0,0,this.dpr,0,0);
    const g=c.createLinearGradient(0,0,this.w,this.h);g.addColorStop(0,'#142a2b');g.addColorStop(.55,'#29423f');g.addColorStop(1,'#101f24');c.fillStyle=g;c.fillRect(0,0,this.w,this.h);
    if(worldWater)return;
    c.save();c.translate(this.ox||0,this.oy||0);c.scale(this.scale||1,this.scale||1);gameArt.water(c,WIDTH,HEIGHT,time);c.restore();
  }
  block(w,index,sign){
    if(gameArt.wall(this.c,w)){if(sign)this.label?.(sign,w.x+w.w/2,w.y+25);return;}
    const c=this.c,roofBottom=w.y+w.h-35,ridge=w.y+(w.h-35)*.36;
    // Broad roof planes and a submerged vertical quay face establish volume first.
    c.fillStyle='#06181b77';this.poly([{x:w.x+8,y:w.y+22},{x:w.x+w.w+17,y:w.y+22},{x:w.x+w.w+17,y:w.y+w.h+24},{x:w.x+8,y:w.y+w.h+24}]);c.fill();
    c.fillStyle='#66756c';this.poly([{x:w.x,y:w.y+8},{x:w.x+w.w,y:w.y+8},{x:w.x+w.w-12,y:ridge},{x:w.x+12,y:ridge}]);c.fill();
    c.fillStyle='#425b54';this.poly([{x:w.x+12,y:ridge},{x:w.x+w.w-12,y:ridge},{x:w.x+w.w,y:roofBottom},{x:w.x,y:roofBottom}]);c.fill();
    c.strokeStyle='#a1aa9166';c.lineWidth=2;c.beginPath();c.moveTo(w.x+12,ridge);c.lineTo(w.x+w.w-12,ridge);c.stroke();
    for(let x=w.x+30;x<w.x+w.w-15;x+=52){c.strokeStyle='#223f394b';c.lineWidth=1;c.beginPath();c.moveTo(x,w.y+10);c.lineTo(x+4,ridge);c.lineTo(x+14,roofBottom);c.stroke();}
    c.fillStyle='#737768';c.fillRect(w.x,roofBottom,w.w,28);
    c.fillStyle='#283f39';c.fillRect(w.x,roofBottom+24,w.w,14);
    c.fillStyle='#1a3432';c.fillRect(w.x-1,roofBottom+33,w.w+2,9);
    const n=Math.max(2,Math.floor(w.w/105)),doorW=(w.w-35)/n*.7;
    for(let i=0;i<n;i++){const x=w.x+18+i*(w.w-35)/n;c.fillStyle='#273d35';c.fillRect(x,roofBottom+6,doorW,20);c.fillStyle='#ada77c';c.fillRect(x,roofBottom+4,doorW,3);c.fillStyle='#112c2b';c.fillRect(x+4,roofBottom+10,doorW-8,19);}
    c.fillStyle='#bec0a3';c.font=this.worldFont(12,'bold');c.textAlign='left';c.fillText(sign??['HAEMUN / TRANSIT','OPERATIONS','LOCK CONTROL','WORKSHOP','PUMP HOUSE','WEST WALL','EAST WALL'][index],w.x+21,ridge-8);
    if(index<5){c.fillStyle='#889282';c.fillRect(w.x+w.w*.61,ridge+14,w.w*.21,22);c.fillStyle='#2c4a44';c.fillRect(w.x+w.w*.61+4,ridge+17,w.w*.21-8,16);}
    for(let x=w.x+15;x<w.x+w.w;x+=87){c.fillStyle='#152b27';c.fillRect(x,roofBottom+29,7,20);}
    // Only local disturbed reflections, rather than horizontal hatch lines.
    const t=this.clock||0;
    for(let i=0;i<14;i++){const x=w.x+((i*73+index*31)%(Math.max(20,w.w-24)))+12,y=w.y+w.h+9+(i%4)*7;
      c.strokeStyle=i%4===0?'#d1b97630':'#8ca59018';c.lineWidth=2;c.beginPath();c.moveTo(x+Math.sin(t*1.4+i)*5,y);c.quadraticCurveTo(x+8,y+Math.sin(t*2+i)*3,x+18+Math.cos(t+i)*4,y+1);c.stroke();}
  }
  serviceBoom(w,index){
    const c=this.c;c.fillStyle='#132d2b88';c.fillRect(w.x,w.y+12,w.w,w.h-10);
    c.fillStyle='#424c3e';c.fillRect(w.x,w.y+22,w.w,25);
    for(let x=w.x;x<w.x+w.w;x+=25){c.fillStyle=(x%50)?'#b8a871':'#344236';c.fillRect(x,w.y+25,12,19);}
    c.fillStyle='#1b312c';this.circle(w.x+9,w.y+34,13);c.fill();this.circle(w.x+w.w-9,w.y+34,13);c.fill();
    c.textAlign='center';c.font=this.worldFont(11);c.fillStyle='#c6ba91';c.fillText(index===5?'SERVICE BOOM / W':'SERVICE BOOM / E',w.x+w.w/2,w.y+10);c.textAlign='left';
  }
  landmarks(s,time,l){
    const c=this.c;
    // Pier 7: narrow stairway, submerged lower deck, dry service platform and work light.
    c.fillStyle='#0b2427aa';c.fillRect(304,301,124,138);
    c.fillStyle='#64716a';c.fillRect(323,244,38,76);
    for(let y=249;y<320;y+=10){c.strokeStyle='#c0bc98';c.lineWidth=2;c.beginPath();c.moveTo(326,y);c.lineTo(359,y);c.stroke();}
    c.fillStyle='#788072';c.fillRect(316,319,98,94);
    c.fillStyle='#414f46';c.fillRect(321,324,88,84);
    for(let x=323;x<410;x+=14){c.strokeStyle='#9b99774f';c.lineWidth=2;c.beginPath();c.moveTo(x,326);c.lineTo(x,408);c.stroke();}
    c.strokeStyle='#d1c19a';c.lineWidth=3;c.beginPath();c.moveTo(316,405);c.lineTo(316,319);c.lineTo(414,319);c.lineTo(414,405);c.stroke();
    for(const x of [317,412])for(let y=326;y<415;y+=30){c.fillStyle='#112824';c.fillRect(x-3,y,6,15);}
    c.fillStyle='#152a27';c.fillRect(324,332,21,34);c.fillStyle='#ae874e';c.fillRect(325,332,20,6);
    c.strokeStyle='#cabd86';c.lineWidth=2;c.beginPath();c.moveTo(339,324);c.lineTo(341,286);c.lineTo(385,286);c.stroke();
    const glow=c.createRadialGradient(385,296,2,385,296,105);glow.addColorStop(0,'#f3bd5f32');glow.addColorStop(1,'#f3bd5f00');c.fillStyle=glow;this.circle(385,296,105);c.fill();c.fillStyle='#e9bb69';c.fillRect(379,289,15,6);
    c.strokeStyle='#b2ba9666';for(let i=0;i<6;i++){const x=350+Math.sin(time+i*7)*17;c.beginPath();c.moveTo(x,426+i*8);c.quadraticCurveTo(x+8,424+i*8,x+20+Math.sin(time*2+i)*6,427+i*8);c.stroke();}
    c.save();c.translate(215,447);c.rotate(-.12);c.fillStyle='#a5a283';c.fillRect(-48,-12,96,25);c.fillStyle='#1e3c38';c.fillRect(-44,-7,88,15);c.fillStyle='#d2c392';c.font=this.worldFont(14,'bold');c.textAlign='center';c.fillText('PIER 07',0,5);c.restore();
    // East lock room: raised booth, window, lower flood door, hanging gauge.
    c.fillStyle='#192e2baa';c.fillRect(1165,305,152,135);c.fillStyle='#9a9e85';c.fillRect(1181,313,116,98);
    c.fillStyle='#425b54';c.fillRect(1188,322,102,79);c.fillStyle='#69796a';c.fillRect(1172,298,137,19);
    c.fillStyle='#b8ac75';c.fillRect(1210,331,51,42);c.fillStyle='#192f2d';c.fillRect(1217,338,37,28);
    c.fillStyle='#233e36';c.fillRect(1204,378,63,40);c.strokeStyle='#72887a';c.lineWidth=2;c.strokeRect(1204,378,63,40);
    c.strokeStyle='#b4b599';c.lineWidth=3;c.beginPath();c.moveTo(1172,422);c.lineTo(1308,422);c.moveTo(1172,403);c.lineTo(1172,435);c.moveTo(1308,403);c.lineTo(1308,435);c.stroke();
    c.fillStyle='#d2c5a0';c.fillRect(1318,334,10,96);for(let y=339;y<430;y+=11){c.fillStyle=y>395?'#b45940':'#3f554b';c.fillRect(1318,y,7,3);}
    c.fillStyle='#254c4966';c.fillRect(1180,402,116,27);
    c.strokeStyle='#c4caaa44';for(let i=0;i<6;i++){const x=1205+Math.sin(time+i)*20;c.beginPath();c.moveTo(x,436+i*6);c.quadraticCurveTo(x+8,434+i*6,x+30,437+i*6);c.stroke();}
    // Safe outer route and shorter working channel are marked, not hidden puzzles.
    c.textAlign='center';c.font=this.worldFont(11);c.fillStyle='#c5c9aa';c.fillText(l.outerRoute,54,650);c.fillText(l.cableRoute,563,615);
    c.strokeStyle='#adc4ad55';c.lineWidth=2;c.setLineDash([4,8]);c.beginPath();c.moveTo(70,750);c.lineTo(55,650);c.lineTo(55,380);c.stroke();c.setLineDash([]);
    for(const y of [645,660,675]){c.beginPath();c.moveTo(45,y);c.lineTo(54,y-8);c.lineTo(63,y);c.stroke();}
    if(s.player&&s.mission.repairBoost){
      const p=s.player,a=s.mission.heading+Math.PI,v={x:Math.cos(a),y:Math.sin(a)};c.strokeStyle='#d8c794aa';c.lineWidth=2;c.setLineDash([5,6]);c.beginPath();c.moveTo(p.x+v.x*35,p.y+v.y*35);c.lineTo(p.x+v.x*100,p.y+v.y*100);c.stroke();c.setLineDash([]);
      c.beginPath();c.moveTo(p.x+v.x*85-v.y*7,p.y+v.y*85+v.x*7);c.lineTo(p.x+v.x*100,p.y+v.y*100);c.lineTo(p.x+v.x*85+v.y*7,p.y+v.y*85-v.x*7);c.stroke();
    }
    c.textAlign='left';
  }
  drawBerth(s,time,l){
    const c=this.c;
    // A fixed timber finger pier, mooring bollards and rubber fenders make arrival a place.
    c.fillStyle='#091d205f';c.fillRect(847,887,103,135);c.fillStyle='#716e55';c.fillRect(858,888,75,115);
    for(let y=893;y<1000;y+=13){c.strokeStyle='#a7986a';c.lineWidth=2;c.beginPath();c.moveTo(862,y);c.lineTo(929,y);c.stroke();}
    c.fillStyle='#334b41';c.fillRect(900,867,59,35);c.fillStyle='#c5b37a';c.fillRect(906,874,47,12);
    c.textAlign='center';c.fillStyle='#273c32';c.font=this.worldFont(12,'bold');c.fillText('09 / HOME',930,884);
    for(const y of [909,950,990]){c.fillStyle='#152522';this.circle(856,y,10);c.fill();c.strokeStyle='#718075';c.lineWidth=3;this.circle(856,y,7);c.stroke();c.fillStyle='#b3a16c';this.circle(881,y-4,5);c.fill();}
    c.strokeStyle='#ddd0a65d';c.lineWidth=2;c.beginPath();c.moveTo(787,968);c.lineTo(881,986);c.stroke();
    const g=c.createRadialGradient(908,894,2,908,894,115);g.addColorStop(0,'#e5b46425');g.addColorStop(1,'#e5b46400');c.fillStyle=g;this.circle(908,894,115);c.fill();
    c.strokeStyle='#d9c38566';c.lineWidth=1.5;c.beginPath();c.moveTo(764,881);c.lineTo(748,881);c.lineTo(748,963);c.lineTo(764,963);c.stroke();
    c.fillStyle='#dcc69c';c.font=this.worldFont(12);c.fillText(l.dock,797,983);c.textAlign='left';
  }
  drawEnvironment(s,time,l){
    const c=this.c,m=s.mission;if(!m)return;
    HARBOR.buildings.forEach((w,i)=>{if(i===5&&m.sideChannels?.includes('west')||i===6&&m.sideChannels?.includes('east'))return;if(i<5)this.block(w,i);else this.serviceBoom(w,i);});
    for(const side of m.sideChannels||[]){const x=side==='west'?590:1010;c.strokeStyle='#bccbab77';c.lineWidth=2;for(let y=675;y<735;y+=25){c.beginPath();c.moveTo(x-12,y);c.lineTo(x,y+10);c.lineTo(x+12,y);c.stroke();}}
    this.landmarks(s,time,l);
    // Submerged bus: a recognizable destination rather than an abstract pickup.
    c.save();c.translate(800,265);c.rotate(-.08);
    c.fillStyle='#091a1b66';c.fillRect(-88,-20,180,55);c.fillStyle='#b1ac83';c.fillRect(-90,-32,180,50);c.fillStyle='#4e6760';c.fillRect(-84,-26,167,23);
    for(let i=0;i<7;i++){c.fillStyle='#173435';c.fillRect(-77+i*23,-23,17,17);}
    c.fillStyle='#d2c18c';c.fillRect(-94,-16,5,13);c.fillRect(90,-16,5,13);c.fillStyle='#173b394d';c.fillRect(-100,2,210,33);c.restore();
    // Mooring lane and channel lights.
    for(const x of [625,975])for(let y=750;y<970;y+=45){c.fillStyle='#d5ba764d';this.circle(x,y,3);c.fill();}
    const g=HARBOR.gate;
    if(!m.gateOpen){
      c.fillStyle='#424f47';c.fillRect(g.x,g.y,g.w,g.h);
      for(let x=g.x;x<g.x+g.w;x+=20){c.fillStyle=(x/20)%2?'#c4ac6e':'#27352f';c.fillRect(x,g.y+4,10,g.h-8);}
      c.fillStyle='#e5aa70';this.circle(g.x+g.w/2,g.y+g.h/2,7);c.fill();
    }else{
      c.strokeStyle='#c4d3b67d';c.lineWidth=3;
      for(let y=g.y-20;y<g.y+g.h+20;y+=28){c.beginPath();c.moveTo(785,y);c.lineTo(800,y+12);c.lineTo(815,y);c.stroke();}
    }
    c.fillStyle=m.gateOpen?'#d4d8b8':'#d6b683';c.textAlign='center';c.font=this.worldFont(12);c.fillText(m.gateOpen?l.gateOpen:l.gateClosed,800,654);
    for(const w of m.wrecks){
      if(!w.intact)continue;
      c.save();c.translate(w.x+w.w/2,w.y+w.h/2);c.rotate(Math.sin(time*.6+w.x)*.014);
      c.fillStyle=w.heavy?'#73766b':'#5b6257';c.fillRect(-w.w/2,-w.h/2,w.w,w.h);c.strokeStyle='#a79568';c.lineWidth=2;c.strokeRect(-w.w/2+4,-w.h/2+4,w.w-8,w.h-8);
      for(let x=-w.w/2+14;x<w.w/2;x+=25){c.strokeStyle='#253735';c.beginPath();c.moveTo(x,-w.h/2+6);c.lineTo(x,w.h/2-6);c.stroke();}
      c.restore();
      if(w.heavy){c.fillStyle='#d6bd83';c.font=this.worldFont(12);c.fillText(l.floatingPlate,w.x+w.w/2,w.y-12);}
    }
    const dock=HARBOR.extraction;
    
    this.drawBerth(s,time,l);
    if(m.recordEnabled!==false&&!m.recoveredBox){c.fillStyle='#b7b49a';c.fillRect(m.box.x-12,m.box.y-8,24,16);c.strokeStyle='#e1ca8d';c.strokeRect(m.box.x-15,m.box.y-11,30,22);c.font=this.worldFont(11);c.fillStyle='#c4c4a7';c.fillText(l.record,m.box.x,m.box.y+32);}
    // Faded route annotations and cranes tie all mechanics to the harbor.
    c.fillStyle='#d9d0aa75';c.font=this.worldFont(18,'bold');c.fillText(l.workshop,215,299);c.fillText(l.gatehouse,1240,275);
    for(const p of [{x:310,y:315},{x:1290,y:310}]){c.strokeStyle='#879083';c.lineWidth=6;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-62);c.lineTo(p.x+70,p.y-62);c.stroke();c.strokeStyle='#bcbba2';c.lineWidth=1.5;c.beginPath();c.moveTo(p.x+60,p.y-60);c.lineTo(p.x+60,p.y+18);c.stroke();}
    c.textAlign='left';
  }
  drawHazard(e,p,time,preview){
    const c=this.c,winch=e.machine==='winch',cycle=machineCycle(e,this.state?.time||0);
    c.save();c.translate(e.x,e.y);
    if(winch){
      const a=e.baseAngle||0,reach=e.reach||195;
      // A fixed swept sector flashes before the cable moves; it never tracks the boat.
      c.fillStyle=cycle.mode==='warning'?'#d6ae6230':cycle.mode==='active'?'#b7634326':'#b8bb9803';
      c.beginPath();c.moveTo(0,0);c.arc(0,0,reach,a-1.05,a+1.05);c.closePath();c.fill();
      c.strokeStyle=cycle.mode==='warning'?'#e9c980':cycle.mode==='active'?'#afad7350':'#afad7312';c.lineWidth=1.5;c.setLineDash([6,8]);c.beginPath();c.arc(0,0,reach,a-1.05,a+1.05);c.stroke();c.setLineDash([]);
      c.strokeStyle=cycle.mode==='active'?'#e9b29a':'#9eae94';c.lineWidth=cycle.mode==='active'?5:3;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(cycle.angle)*reach,Math.sin(cycle.angle)*reach);c.stroke();
      c.save();c.rotate(cycle.angle);c.fillStyle='#a0a18a';c.fillRect(reach-9,-8,16,16);c.strokeStyle='#3c4c42';c.strokeRect(reach-9,-8,16,16);c.restore();
      c.fillStyle='#2a3932';c.fillRect(-30,-26,60,52);c.fillStyle='#b2ac88';c.fillRect(-24,-20,48,40);
      for(let i=-21;i<23;i+=14){c.fillStyle='#7b4a37';c.fillRect(i,-20,7,6);c.fillRect(i,14,7,6);}
      c.fillStyle='#2d443b';this.circle(0,0,16);c.fill();c.strokeStyle='#c0bb92';c.lineWidth=4;this.circle(0,0,10);c.stroke();
      c.fillStyle=cycle.mode==='warning'?'#ecc476':cycle.mode==='active'?'#ce6c4a':'#89a792';this.circle(22,-19,5);c.fill();
      c.textAlign='center';c.font=this.worldFont(10);c.fillStyle='#d5c89f';c.fillText(this.text[cycle.mode==='bound'?'cableBound':cycle.mode==='warning'?'cableWarning':cycle.mode==='active'?'cableActive':'cableRest'],0,-35);
    }else{
      // Toothed industrial cutting head on an anchored square pontoon.
      c.fillStyle='#243b37';c.fillRect(-27,-27,54,54);c.strokeStyle='#8e987e';c.lineWidth=2;c.strokeRect(-27,-27,54,54);
      c.strokeStyle='#566854';c.lineWidth=2;c.beginPath();c.moveTo(-27,-27);c.lineTo(-45,-40);c.moveTo(27,27);c.lineTo(41,40);c.stroke();
      c.rotate(e.restrained>0?0:time*1.5+e.phase);c.fillStyle='#9b8d73';
      const teeth=Array.from({length:24},(_,i)=>({x:Math.cos(i*Math.PI/12)*(i%2?19:29),y:Math.sin(i*Math.PI/12)*(i%2?19:29)}));this.poly(teeth);c.fill();c.strokeStyle='#d0c5a4';c.lineWidth=1;c.stroke();
      c.fillStyle='#5d3c2e';this.circle(0,0,15);c.fill();c.fillStyle='#d5ad63';this.circle(0,0,5);c.fill();
    }
    c.restore();
    if(e.restrained>0){c.strokeStyle='#dfcf8d';c.lineWidth=2;this.circle(e.x,e.y,e.r+13);c.stroke();}
    if(preview&&inTriangle(e,...preview)){c.strokeStyle=this.previewColor;c.lineWidth=2;this.circle(e.x,e.y,e.r+14);c.stroke();}
  }
  ship(x,y,angle,color,size=1){
    const c=this.c;angle=this.state?.mission?.heading??angle;
    c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
    c.strokeStyle='#b1c5af33';c.lineWidth=2;
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(-36-i*14,-8-i*5);c.quadraticCurveTo(-47-i*13,0,-36-i*14,8+i*5);c.stroke();}
    c.fillStyle='#172927';c.strokeStyle='#b5b18e';c.lineWidth=3;
    this.poly([{x:32,y:0},{x:19,y:-15},{x:-25,y:-16},{x:-30,y:-9},{x:-30,y:9},{x:-25,y:16},{x:19,y:15}]);c.fill();c.stroke();
    c.fillStyle='#ccb67a';c.fillRect(0,-11,15,22);c.fillStyle='#345957';c.fillRect(3,-8,8,16);
    c.fillStyle='#667166';c.fillRect(-24,-12,20,24);c.strokeStyle='#b5a77c';c.lineWidth=2;this.circle(-14,0,6);c.stroke();
    c.strokeStyle='#d2cab1';c.lineWidth=1;c.beginPath();c.moveTo(3,-11);c.lineTo(-4,-25);c.stroke();
    c.fillStyle='#efd1a0';c.fillRect(24,-4,5,8);
    if(this.state?.mission.people.some(p=>p.state==='aboard')){c.fillStyle='#d7ae66';this.circle(-7,10,4);c.fill();}
    c.restore();
  }
  drawOverlays(s,time,l){
    const c=this.c,m=s.mission;if(!m)return;c.textAlign='center';
    for(const p of m.people){
      if(p.state==='aboard'||p.state==='rescued')continue;
      if(p.state==='shelter'){c.fillStyle='#949b86';c.fillRect(p.x-16,p.y-17,32,27);c.fillStyle='#cfbf83';c.fillRect(p.x-5,p.y-13,10,6);}
      else{
        const glow=c.createRadialGradient(p.x,p.y,3,p.x,p.y,90);glow.addColorStop(0,'#e3bf702f');glow.addColorStop(1,'#e3bf7000');c.fillStyle=glow;this.circle(p.x,p.y,90);c.fill();
        c.fillStyle=p.id==='engineer'?'#e5bd65':'#bcc4ae';this.circle(p.x,p.y-12,6);c.fill();c.fillStyle=p.id==='engineer'?'#c59343':'#516b61';c.fillRect(p.x-7,p.y-5,14,20);c.fillStyle='#c8bba0';c.fillRect(p.x-7,p.y+1,14,3);c.fillStyle='#493b2f';c.fillRect(p.x-8,p.y-18,16,4);c.strokeStyle=p.id==='engineer'?'#cfa353':'#8faba0';c.lineWidth=4;c.beginPath();c.moveTo(p.x-6,p.y);c.lineTo(p.x-15,p.y-13+Math.sin(time*3)*3);c.moveTo(p.x-3,p.y+14);c.lineTo(p.x-6,p.y+22);c.moveTo(p.x+3,p.y+14);c.lineTo(p.x+6,p.y+22);c.stroke();
        c.strokeStyle='#dfc38388';c.lineWidth=1.5;this.circle(p.x,p.y,43+Math.sin(time*2)*3);c.stroke();
      }
      c.fillStyle='#eadfc0';c.font=this.worldFont(16,'bold');c.fillText(l[p.id],p.x,p.y-44);c.fillStyle='#c5bf9c';c.font=this.worldFont(11);c.fillText(p.state==='shelter'?l.shelter:l.waiting,p.x,p.y+44);
    }
    for(const f of m.fields){this.poly(f.points);c.fillStyle='#d6bd7520';c.fill();c.strokeStyle='#d6bc78';c.lineWidth=3;c.stroke();for(const id of f.people){const p=m.people.find(p=>p.id===id);if(p){c.strokeStyle='#f0d49e';this.circle(p.x,p.y,12+(1-f.life/.8)*35);c.stroke();}}}
    if(m.returnHold>0){c.strokeStyle='#ddc689';c.lineWidth=5;c.beginPath();c.arc(HARBOR.extraction.x,HARBOR.extraction.y,90,-Math.PI/2,-Math.PI/2+TAU*m.returnHold/1.3);c.stroke();}
    // Fine rain remains readable, with no full-screen flashing.
    c.strokeStyle='#c2d0b71b';c.lineWidth=1;
    for(let i=0;i<100;i++){const x=(i*157+s.time*25)%WIDTH,y=(i*389+s.time*190)%HEIGHT;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+15);c.stroke();}
    c.textAlign='left';
  }
  draw(s,time,l,presentation){
    this.state=s;this.text=l;
    const kind=s.anchors.length===2?netTargets(s,[...s.anchors,s.player]).kind:'cut';
    this.previewColor=kind==='rescue'?'#e6cf94cc':'#d6b1a0bb';this.previewFill=kind==='rescue'?'#cfb4721b':'#b17d6c12';
    super.draw(s,time,l);
    const p=presentation?.waypoint;if(p&&s.status==='playing'){const c=this.c;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);const x=p.x*this.scale+this.ox,y=p.y*this.scale+this.oy;c.strokeStyle='#ffdb8f';c.lineWidth=2;c.beginPath();c.arc(x,y,23,0,Math.PI*2);c.stroke();c.fillStyle='#ffe1a2';c.font='12px Pretendard';c.textAlign='center';c.fillText(p.label,Math.max(130,Math.min(this.w-130,x)),Math.max(150,y-34));c.restore();}

  }
  menu(time,l){
    this.state=null;this.text=l;this.clock=time;this.background(time);
    const c=this.c;c.save();const scale=Math.min(this.w/1600,this.h/1000)*1.06;c.translate(this.w*.48,this.h*.12);c.scale(scale,scale);
    const fake={mission:{gateOpen:false,wrecks:[],people:[],box:{x:800,y:300},recordEnabled:false,recoveredBox:false}};this.drawEnvironment(fake,time,l);
    this.ship(360,620,-1.7,'',2);c.fillStyle='#d8b96b';this.circle(365,365,7);c.fill();
    c.strokeStyle='#d6bf7855';c.lineWidth=2;for(let i=0;i<3;i++){this.circle(365,365,30+((time*20+i*30)%90));c.stroke();}
    c.restore();
    const shade=c.createLinearGradient(0,0,this.w,0);shade.addColorStop(0,'#0e2023f5');shade.addColorStop(.4,'#102527e0');shade.addColorStop(.72,'#10252711');shade.addColorStop(1,'#10252700');c.fillStyle=shade;c.fillRect(0,0,this.w,this.h);
    c.strokeStyle='#c1cdb31d';for(let i=0;i<80;i++){const x=(i*187+time*12)%this.w,y=(i*263+time*120)%this.h;c.beginPath();c.moveTo(x,y);c.lineTo(x-6,y+19);c.stroke();}
  }
}

