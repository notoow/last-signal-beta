import {WIDTH,HEIGHT,inTriangle,triangleArea,stats,LESSON_POINTS,synergies} from './core.js';
const TAU=Math.PI*2;
const palette={drone:'#edb27e',hunter:'#ff785e',shooter:'#be9af3',charger:'#ff566f',boss:'#ffbc86'};
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.shake=0;this.clock=0;this.reduce=false;this.resize();}
  resize(){
    this.dpr=Math.min(devicePixelRatio||1,2);this.w=innerWidth;this.h=innerHeight;
    this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
    this.scale=Math.min(this.w/WIDTH,(this.h-110)/HEIGHT);
    this.ox=(this.w-WIDTH*this.scale)/2;this.oy=76+(this.h-110-HEIGHT*this.scale)/2;
  }
  poly(points,close=true){const c=this.c;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));if(close)c.closePath();}
  circle(x,y,r){const c=this.c;c.beginPath();c.arc(x,y,r,0,TAU);}
  ship(x,y,a,color='#b6ffe9',size=1){
    const c=this.c;c.save();c.translate(x,y);c.rotate(a);c.scale(size,size);
    c.fillStyle=color;this.poly([{x:23,y:0},{x:-14,y:-13},{x:-7,y:0},{x:-14,y:13}]);c.fill();
    c.strokeStyle='#182f32';c.lineWidth=2;c.beginPath();c.moveTo(8,0);c.lineTo(-5,0);c.stroke();
    c.fillStyle='#59dbba';this.poly([{x:-15,y:-5},{x:-24-4*Math.sin(this.clock*25),y:0},{x:-15,y:5}]);c.fill();c.restore();
  }
  background(time,menu=false){
    const c=this.c;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#09171c';c.fillRect(0,0,this.w,this.h);
    const g=c.createRadialGradient(this.w*.68,this.h*.45,0,this.w*.68,this.h*.45,this.w*.65);
    g.addColorStop(0,'#12373c');g.addColorStop(.5,'#0d242b');g.addColorStop(1,'#09171c');c.fillStyle=g;c.fillRect(0,0,this.w,this.h);
    for(let i=0;i<115;i++){
      const x=((i*7919%1000)/1000*this.w-time*(menu?2:1)*(i%3+1)+this.w*100)%this.w,y=(i*3571%1000)/1000*this.h;
      c.fillStyle=i%5?'#55707788':'#c9ddd1aa';c.fillRect(x,y,i%5?.9:1.6,i%5?.9:1.6);
    }
  }
  menu(time){
    this.clock=time;this.background(time,true);const c=this.c;
    c.save();c.translate(this.w*.74,this.h*.5);const scale=Math.min(this.w/1400,this.h/850);c.scale(scale,scale);
    for(let i=0;i<4;i++){c.strokeStyle=`rgba(138,188,179,${.05+i*.015})`;c.lineWidth=1;this.circle(0,0,140+i*75);c.stroke();}
    c.rotate(-.12);const points=[{x:-175,y:150},{x:15,y:-225},{x:235,y:115}];
    const g=c.createLinearGradient(-100,-200,160,180);g.addColorStop(0,'#6fe9cc15');g.addColorStop(1,'#6fe9cc01');c.fillStyle=g;c.strokeStyle='#78e2c3';c.lineWidth=1.5;this.poly(points);c.fill();c.stroke();
    points.forEach((p,i)=>{c.fillStyle='#b7ffe6';this.circle(p.x,p.y,6);c.fill();c.strokeStyle='#78e2c355';this.circle(p.x,p.y,14+3*Math.sin(time*2+i));c.stroke();});
    for(let i=0;i<13;i++){
      const x=Math.sin(i*7+time*.025)*220,y=Math.cos(i*5+time*.02)*205;c.save();c.translate(x,y);c.rotate(time*.08+i);
      c.strokeStyle=i%3?'#e2ac8177':'#f9c191';c.lineWidth=1.5;this.poly([{x:0,y:-9},{x:8,y:5},{x:-8,y:5}]);c.stroke();c.restore();
    }
    const angle=time*.17,x=Math.cos(angle)*285,y=Math.sin(angle)*285;this.ship(x,y,angle+Math.PI/2,'#e1fff0',1.5);
    c.restore();
  }
  draw(s,time,text){
    this.clock=time;this.background(time);const c=this.c,p=s.player,st=stats(s);
    c.save();c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);
    if(this.shake>0&&!this.reduce){c.translate(Math.sin(time*123)*this.shake,Math.cos(time*91)*this.shake);this.shake*=.87;}
    c.strokeStyle=s.mission?'#a0ceb900':'#a0ceb90c';c.lineWidth=1;
    for(let x=0;x<=WIDTH;x+=80){c.beginPath();c.moveTo(x,0);c.lineTo(x,HEIGHT);c.stroke();}
    for(let y=0;y<=HEIGHT;y+=80){c.beginPath();c.moveTo(0,y);c.lineTo(WIDTH,y);c.stroke();}
    c.strokeStyle='#86c5b82a';c.strokeRect(0,0,WIDTH,HEIGHT);
    c.save();if(s.mission)c.globalAlpha=0;c.translate(WIDTH/2,HEIGHT/2);c.rotate(-.3);c.strokeStyle='#bbded808';this.circle(0,0,320);c.lineWidth=30;c.stroke();c.lineWidth=2;this.circle(0,0,360);c.stroke();c.restore();
    if(s.tutorialStep>=0){
      const guide=LESSON_POINTS[Math.min(s.anchors.length,2)];
      c.strokeStyle='#baf6d1';c.lineWidth=2;c.setLineDash([5,7]);this.circle(guide.x,guide.y,32+Math.sin(time*4)*4);c.stroke();c.setLineDash([]);
      c.fillStyle='#e1f4d3';c.textAlign='center';c.font='bold 18px Pretendard';c.fillText('Q',guide.x,guide.y+7);
      c.font='14px Pretendard';c.fillStyle='#bad1bc';c.fillText(text.lessonLabel,WIDTH/2,70);c.textAlign='left';
    }
    this.drawEnvironment?.(s,time,text);
    let preview=null;
    if(s.anchors.length){
      const points=[...s.anchors,p];this.poly(points,s.anchors.length===2);c.strokeStyle=this.previewColor||'#90eadba0';c.lineWidth=2;c.setLineDash([8,7]);c.stroke();c.setLineDash([]);
      if(s.anchors.length===2&&triangleArea(...points)>2200){preview=points;c.fillStyle=this.previewFill||'#7dffdb12';c.fill();}
      s.anchors.forEach((a,i)=>{
        c.strokeStyle=s.mission?'#e1c58c':'#a5ffe0';c.lineWidth=2;this.circle(a.x,a.y,13);c.stroke();c.fillStyle=s.mission?'#e1c58c':'#b6ffe9';this.circle(a.x,a.y,5);c.fill();
        c.font='bold 15px Pretendard';c.fillText(String(i+1),a.x+20,a.y-14);
      });
    }
    for(const g of s.pickups){c.save();c.translate(g.x,g.y);c.rotate(Math.PI/4);c.fillStyle='#88e1ad';c.fillRect(-3,-3,6,6);c.restore();}
    for(const e of s.effects){
      const alpha=e.life/e.max;c.save();c.globalAlpha=alpha;
      if(e.type==='wake')this.ship(e.x,e.y,e.angle,'#62dcbc',.8);
      if(e.type==='circuit'||e.type==='echo'){
        this.poly(e.points);c.fillStyle=s.mission?'#d3b98533':e.echo?'#bba7f33a':'#9fffe839';c.strokeStyle=s.mission?'#ead7ae':e.echo?'#bea4f5':'#c9fff2';c.lineWidth=e.type==='echo'?1:4;c.fill();c.stroke();
        if(e.type==='circuit'&&e.hits>0){const x=e.points.reduce((a,p)=>a+p.x,0)/3,y=e.points.reduce((a,p)=>a+p.y,0)/3;c.fillStyle='#dcfff1';c.font='bold 26px Pretendard';c.textAlign='center';c.fillText(`${text.close} ×${e.hits}`,x,y-30*(1-alpha));}
      }
      if(e.type==='frostburst'){c.strokeStyle='#b0e4ff';c.lineWidth=4;this.circle(e.x,e.y,e.r*(1-alpha));c.stroke();}
      if(e.type==='burst'){c.strokeStyle=palette[e.kind];c.lineWidth=2;this.circle(e.x,e.y,e.r+(1-alpha)*35);c.stroke();for(let i=0;i<6;i++){const a=i*TAU/6;c.fillStyle=palette[e.kind];c.fillRect(e.x+Math.cos(a)*(1-alpha)*60,e.y+Math.sin(a)*(1-alpha)*60,3,3);}}
      c.restore();
    }
    for(const e of s.enemies){
      if(this.drawHazard){this.drawHazard(e,p,time,preview);continue;}
      c.save();c.translate(e.x,e.y);const color=e.flash>0?'#fff5df':e.slow>0?'#a1dfff':palette[e.kind];
      if(preview&&inTriangle(e,...preview)){c.fillStyle='#e9fbd926';this.circle(0,0,e.r+9);c.fill();c.strokeStyle='#e5ffe8';c.lineWidth=1;this.circle(0,0,e.r+8);c.stroke();}
      c.rotate(e.kind==='boss'?time*.13:Math.atan2(p.y-e.y,p.x-e.x)+Math.PI/2);
      c.fillStyle='#182e32';c.strokeStyle=color;c.lineWidth=e.kind==='boss'?3:2;
      if(e.kind==='drone')this.poly([{x:0,y:-e.r},{x:e.r*.9,y:e.r*.7},{x:0,y:e.r*.3},{x:-e.r*.9,y:e.r*.7}]);
      else if(e.kind==='shooter'){c.beginPath();c.rect(-e.r*.7,-e.r*.7,e.r*1.4,e.r*1.4);}
      else {const n=e.kind==='boss'?[6,8,3,10][e.tier]:4;this.poly(Array.from({length:n},(_,i)=>({x:Math.sin(i*TAU/n)*e.r,y:Math.cos(i*TAU/n)*e.r})));}
      c.fill();c.stroke();c.fillStyle=color;this.circle(0,0,e.kind==='boss'?14:4);c.fill();
      if(e.kind==='boss'){
        c.strokeStyle=color+'55';this.circle(0,0,e.r+12+Math.sin(time*3)*4);c.stroke();
        c.rotate(-time*.35);c.lineWidth=1.5;
        for(let j=0;j<e.tier+2;j++){const angle=j*TAU/(e.tier+2);c.beginPath();c.moveTo(Math.cos(angle)*23,Math.sin(angle)*23);c.lineTo(Math.cos(angle)*45,Math.sin(angle)*45);c.stroke();}
        if(e.tier===1){c.strokeStyle='#97d7ff88';c.lineWidth=4;this.circle(0,0,e.r+17);c.stroke();}
      }
      c.restore();
      if(e.hp<e.maxHp){c.fillStyle='#0a151b';c.fillRect(e.x-e.r,e.y-e.r-12,e.r*2,4);c.fillStyle=color;c.fillRect(e.x-e.r,e.y-e.r-12,e.r*2*Math.max(0,e.hp/e.maxHp),4);}
      if((e.kind==='charger'||(e.kind==='boss'&&e.tier===2))&&e.timer<.8&&e.timer>0){c.strokeStyle='#ff847c88';c.setLineDash([10,10]);c.beginPath();c.moveTo(e.x,e.y);const a=Math.atan2(p.y-e.y,p.x-e.x);c.lineTo(e.x+Math.cos(a)*300,e.y+Math.sin(a)*300);c.stroke();c.setLineDash([]);}
    }
    c.lineWidth=3;c.strokeStyle='#daffe8';
    for(const b of s.shots){c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-b.vx*.018,b.y-b.vy*.018);c.stroke();}
    for(const b of s.hazards){c.fillStyle='#ff8873';this.circle(b.x,b.y,b.r);c.fill();c.strokeStyle='#ff887333';this.circle(b.x,b.y,b.r+4);c.stroke();}
    c.strokeStyle=s.mission?'#78ffd000':'#78ffd021';c.lineWidth=1;this.circle(p.x,p.y,st.magnet);c.stroke();
    if(p.inv>0){c.strokeStyle='#d2ffdfaa';c.lineWidth=2;this.circle(p.x,p.y,27);c.stroke();}
    this.ship(p.x,p.y,Math.atan2(p.dy,p.dx),p.inv>0&&Math.floor(time*14)%2?'#71b9a8':'#e1ffef');
    if(p.dash<=0&&!s.mission){c.strokeStyle='#b5ffe7';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,33,Math.PI*.25,Math.PI*.75);c.stroke();}
    this.drawOverlays?.(s,time,text);
    const active=synergies(s);if(active.length){c.font='14px Pretendard';c.fillStyle='#b7d2b9';c.fillText(active.map(k=>'◇ '+text.combos[k][0]).join('    '),24,HEIGHT-22);}
    c.restore();
  }
}
