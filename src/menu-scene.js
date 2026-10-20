import {paintedTug} from './game-art.js';
// Illustrated layers are independent of mission geometry and never receive game input.
export class MenuScene {
 constructor(canvas){
  this.canvas=canvas;this.c=canvas.getContext('2d');this.pointer={x:0,y:0};this.position={x:0,y:0};this.time=0;this.previous=0;
  this.background=new Image();this.background.src='assets/art/menu-harbor-v1.png';
  this.tug=new Image();this.tug.src='assets/art/menu-tug-v1.png';
 }
 point(x,y){this.pointer={x:Math.max(-1,Math.min(1,x/innerWidth*2-1)),y:Math.max(-1,Math.min(1,y/innerHeight*2-1))};}
 reset(){this.pointer={x:0,y:0};}
 draw(now,{reduced=false,active=true,paint='harbor'}={}){
  const c=this.c,w=innerWidth,h=innerHeight,dpr=this.canvas.width/w,dt=Math.min(.05,Math.max(0,now-this.previous));this.previous=now;
  const moving=active&&!reduced&&!document.hidden;
  if(moving)this.time+=dt;const t=reduced?0:this.time;
  const target=moving?this.pointer:{x:0,y:0},blend=reduced?1:1-Math.exp(-dt*4);
  this.position.x+=(target.x-this.position.x)*blend;this.position.y+=(target.y-this.position.y)*blend;const p=this.position;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#0c2533';c.fillRect(0,0,w,h);
  if(this.background.complete&&this.background.naturalWidth){const scale=Math.max(w/this.background.width,h/this.background.height)*1.05,bw=this.background.width*scale,bh=this.background.height*scale;c.drawImage(this.background,(w-bw)/2-p.x*8,(h-bh)/2-p.y*5,bw,bh);}
  // Fine sea reflections move independently of the painted distant horizon.
  this.waves(t,w,h,.57,.81,45,.10);
  const fog=c.createLinearGradient(0,h*.36,0,h*.63);fog.addColorStop(0,'#b6cfdb00');fog.addColorStop(.55,'#b6cfdb16');fog.addColorStop(1,'#b6cfdb00');
  c.save();c.translate(Math.sin(t*.13)*18-p.x*14,0);c.fillStyle=fog;c.fillRect(-25,h*.36,w+50,h*.27);c.restore();
  // A warm search beam sweeps slowly over the water, never flashes.
  const bx=w*.93-p.x*8,by=h*.235-p.y*5,angle=2.95+Math.sin(t*.16)*.18;
  c.save();c.translate(bx,by);c.rotate(angle);const beam=c.createLinearGradient(0,0,w*.43,0);beam.addColorStop(0,'#ffe1a321');beam.addColorStop(1,'#ffe1a300');c.fillStyle=beam;c.beginPath();c.moveTo(0,0);c.lineTo(w*.43,-h*.055);c.lineTo(w*.43,h*.055);c.closePath();c.fill();c.restore();
  // Separate transparent tug: nearer parallax and a small wave-driven roll.
  const tw=Math.min(w*.55,h*1.05),th=tw/(this.tug.naturalWidth/this.tug.naturalHeight||1.8),tx=w*.75-p.x*25,ty=h*.74-p.y*14+Math.sin(t*1.05)*h*.004;
  c.save();c.translate(tx,ty);c.rotate(Math.sin(t*.82)*.009);if(this.tug.complete&&this.tug.naturalWidth)c.drawImage(paintedTug(this.tug,paint),-tw/2,-th/2,tw,th);c.restore();
  this.waves(t,w,h,.86,1.05,34,.18);
  // Foreground mist and vignetting separate the interactive menu from the harbor.
  const shade=c.createRadialGradient(w*.2,h*.72,0,w*.2,h*.72,w*.5);shade.addColorStop(0,'#061a2b90');shade.addColorStop(1,'#061a2b00');c.fillStyle=shade;c.fillRect(0,0,w,h);
  const lower=c.createLinearGradient(0,h*.7,0,h);lower.addColorStop(0,'#07171f00');lower.addColorStop(1,'#07171fc9');c.fillStyle=lower;c.fillRect(0,h*.7,w,h*.3);
 }
 waves(t,w,h,top,bottom,count,alpha){
  const c=this.c;c.save();c.lineCap='round';
  for(let i=0;i<count;i++){const depth=(i%9)/9,y=h*(top+(bottom-top)*depth)+Math.sin(t*.7+i*2.3)*3,x=((i*.61803398875*w+t*(7+depth*15))%(w*1.18))-w*.09,len=(12+depth*50)*(w/1400);c.strokeStyle=`rgba(172,205,215,${alpha*(.3+(i%4)/4)})`;c.lineWidth=.6+depth*1.5;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+len*.45,y-2-depth*3,x+len,y);c.stroke();}c.restore();
 }
}
