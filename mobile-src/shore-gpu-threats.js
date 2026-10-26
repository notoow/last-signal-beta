import {quayThreats} from './quay-view.js';
import {ShoreSpriteRecorder} from './shore-sprite-recorder.js';

export function recordQuayThreats(s,frame){
  const recorder=new ShoreSpriteRecorder(),m=frame.projection;
  for(const threat of quayThreats(s)){
    recorder.save();
    recorder.matrix.multiplySelf(new DOMMatrix([frame.scale*m.xx,frame.scale*m.yx,frame.scale*m.xy,frame.scale*m.yy,frame.ox,frame.oy]));
    recorder.translate(threat.x,threat.y);recorder.rotate(threat.angle);
    const vertex=a=>({x:Math.cos(a)*threat.radius,y:Math.sin(a)*threat.radius});
    for(let i=0;i<32;i++){
      const a=vertex(-1.05+2.1*i/32),b=vertex(-1.05+2.1*(i+1)/32);
      const points=[{x:0,y:0},a,b,b].flatMap(p=>{const q=recorder.matrix.transformPoint(p);return [q.x,q.y];});
      recorder.images.push({color:'#e16c3444',points,opacity:1});
    }
    recorder.strokeStyle='#ffd28a';recorder.lineWidth=1.2/frame.scale;
    recorder.beginPath();recorder.arc(0,0,threat.radius,-1.05,1.05);recorder.stroke();
    recorder.beginPath();const a=vertex(-1.05),b=vertex(1.05);
    recorder.moveTo(a.x,a.y);recorder.lineTo(0,0);recorder.lineTo(b.x,b.y);recorder.stroke();
    recorder.restore();
  }
  return recorder.images;
}
