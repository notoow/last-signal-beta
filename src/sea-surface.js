// Presentation only. Restrained waterline motion never moves physical collision bodies.
export function floatPose(b,time=0,anchored=false){
  const phase=time*.85+b.x*.007+b.y*.003;
  return {...b,y:b.y+Math.sin(phase)*(anchored?.32:.58),angle:b.angle+Math.sin(phase*.79)*.003};
}
export function drawWake(c,b,time=0,reduced=false){
  const speed=Math.hypot(b.vx||0,b.vy||0),power=Math.min(1,Math.max(0,(speed-5)/100));
  c.save();c.translate(b.x,b.y);c.rotate(b.angle);
  // Only a small waterline shimmer at rest; foam builds with actual speed.
  c.lineWidth=.8;c.strokeStyle='#b3d3cf';c.globalAlpha=.08+power*.08;
  for(const side of [-1,1]){
    c.beginPath();c.moveTo(-b.length*.3,side*b.width*.54);
    c.quadraticCurveTo(b.length*.35,side*b.width*.61,b.length*.52,side*b.width*.18);c.stroke();
  }
  if(power>0){
    for(let i=0;i<5;i++){
      const age=(i/5+(reduced?0:time*.48))%1,back=b.length*.43+age*(22+speed*.48),spread=b.width*.35+age*(10+speed*.11);
      c.globalAlpha=(1-age)*power*.22;c.lineWidth=1.2-age*.7;
      for(const side of [-1,1]){
        c.beginPath();c.moveTo(-back+8,side*(spread-2));c.quadraticCurveTo(-back,side*spread,-back-8,side*(spread+1));c.stroke();
      }
    }
  }
  c.restore();
}
