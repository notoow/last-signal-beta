// Image geometry adapter for the existing actor painters. It records authored
// crops/pivots and transforms without rasterizing another per-frame canvas.
// Labels remain separate for the UI overlay. Shadows are supplied separately.
export class ShoreSpriteRecorder{
  constructor(){this.images=[];this.labels=[];this.matrix=new DOMMatrix();this.globalAlpha=1;this.imageSmoothingEnabled=true;this.stack=[];this.clips=null;this.path=[];}
  save(){this.stack.push({matrix:DOMMatrix.fromMatrix(this.matrix),alpha:this.globalAlpha,smoothing:this.imageSmoothingEnabled,clips:this.clips,font:this.font,fillStyle:this.fillStyle,textAlign:this.textAlign,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth});}
  restore(){const saved=this.stack.pop();if(!saved)throw Error('Unbalanced sprite restore');Object.assign(this,{matrix:saved.matrix,globalAlpha:saved.alpha,imageSmoothingEnabled:saved.smoothing,clips:saved.clips,font:saved.font,fillStyle:saved.fillStyle,textAlign:saved.textAlign,strokeStyle:saved.strokeStyle,lineWidth:saved.lineWidth});}
  translate(x,y){this.matrix.translateSelf(x,y);}
  scale(x,y){this.matrix.scaleSelf(x,y);}
  rotate(radians){this.matrix.rotateSelf(radians*180/Math.PI);}
  getTransform(){return DOMMatrix.fromMatrix(this.matrix);}
  beginPath(){this.path=[];this.pen=null;}
  arc(x,y,r,start,end,anticlockwise=false){
    if(anticlockwise||r<0)throw Error('Unsupported arc');
    this.path.push({arc:{x,y,r,start,end:Math.min(end,start+Math.PI*2)}});
  }
  ellipse(x,y,rx,ry,rotation,start,end,anticlockwise=false){
    if(anticlockwise||rx<0||ry<0||end-start<Math.PI*2)throw Error('Only full shadow ellipses supported');
    this.path.push({ellipse:{x,y,rx,ry,rotation}});
  }
  fill(){
    for(const part of this.path){
      if(!part.ellipse)throw Error('Unsupported fill path');
      const {x,y,rx,ry,rotation}=part.ellipse,cos=Math.cos(rotation),sin=Math.sin(rotation);
      const point=a=>({x:x+Math.cos(a)*rx*cos-Math.sin(a)*ry*sin,y:y+Math.cos(a)*rx*sin+Math.sin(a)*ry*cos});
      // A fixed mesh keeps the authored ellipse stable through camera changes.
      // Adjacent triangle fans batch into one draw with no overlapping alpha.
      for(let i=0;i<48;i++){
        const a=point(i*Math.PI/24),b=point((i+1)*Math.PI/24);
        const points=[{x,y},a,b,b].flatMap(p=>{const q=this.matrix.transformPoint(p);return [q.x,q.y];});
        this.images.push({color:this.fillStyle,points,opacity:this.globalAlpha});
      }
    }
  }
  moveTo(x,y){this.pen={x,y};}
  lineTo(x,y){if(!this.pen)throw Error('Line without origin');this.path.push({line:[this.pen,{x,y}]});this.pen={x,y};}
  stroke(){
    for(const part of this.path){
      if(part.ellipse){
        const {x,y,rx,ry,rotation}=part.ellipse,half=(this.lineWidth||1)/2,cos=Math.cos(rotation),sin=Math.sin(rotation);
        const vertex=(a,side)=>{
          const nx=Math.cos(a)/Math.max(rx,1e-9),ny=Math.sin(a)/Math.max(ry,1e-9),length=Math.hypot(nx,ny);
          const px=Math.cos(a)*rx+side*half*nx/length,py=Math.sin(a)*ry+side*half*ny/length;
          return this.matrix.transformPoint({x:x+px*cos-py*sin,y:y+px*sin+py*cos});
        };
        for(let i=0;i<64;i++){
          const a=i*Math.PI/32,b=(i+1)*Math.PI/32;
          this.images.push({color:this.strokeStyle,points:[vertex(a,1),vertex(b,1),vertex(b,-1),vertex(a,-1)].flatMap(p=>[p.x,p.y]),opacity:this.globalAlpha});
        }
        continue;
      }
      if(part.arc){
        const {x,y,r,start,end}=part.arc,half=(this.lineWidth||1)/2;
        const steps=Math.max(1,Math.ceil(Math.abs(end-start)*Math.max(8,r)));
        for(let i=0;i<steps;i++){
          const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;
          const points=[[a,r+half],[b,r+half],[b,Math.max(0,r-half)],[a,Math.max(0,r-half)]].flatMap(([angle,radius])=>{
            const p=this.matrix.transformPoint({x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius});return [p.x,p.y];
          });
          this.images.push({color:this.strokeStyle,points,opacity:this.globalAlpha});
        }
        continue;
      }
      if(!part.line)throw Error('Unsupported stroke path');
      const [a,b]=part.line,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
      const k=(this.lineWidth||1)/2/length,nx=-dy*k,ny=dx*k;
      const points=[[a.x+nx,a.y+ny],[b.x+nx,b.y+ny],[b.x-nx,b.y-ny],[a.x-nx,a.y-ny]].flatMap(([x,y])=>{const p=this.matrix.transformPoint({x,y});return [p.x,p.y];});
      this.images.push({color:this.strokeStyle,points,opacity:this.globalAlpha});
    }
  }
  rect(x,y,w,h){this.path.push({x,y,w,h,matrix:DOMMatrix.fromMatrix(this.matrix)});}
  clip(){if(this.clips)throw Error('Nested sprite clipping needs an explicit adapter');this.clips=this.path.slice();}
  fillText(text,x,y){const p=this.matrix.transformPoint({x,y});this.labels.push({text,x:p.x,y:p.y,font:this.font,color:this.fillStyle,align:this.textAlign,opacity:this.globalAlpha});}
  fillRect(x,y,w,h){this.images.push({color:this.fillStyle,points:this.points(x,y,w,h),opacity:this.globalAlpha});}
  points(x,y,w,h){return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].flatMap(([x,y])=>{const p=this.matrix.transformPoint({x,y});return [p.x,p.y];});}
  drawImage(image,...args){
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
    let sx=0,sy=0,sw=iw,sh=ih,dx,dy,dw,dh;
    if(args.length===2){[dx,dy]=args;dw=iw;dh=ih;}
    else if(args.length===4)[dx,dy,dw,dh]=args;
    else if(args.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=args;
    else throw Error('Unsupported sprite image arguments');
    if(!(sw>0&&sh>0&&dw>0&&dh>0))throw Error('Invalid sprite image extent');
    const emit=(x,y,w,h)=>{
      const x0=sx+(x-dx)/dw*sw,y0=sy+(y-dy)/dh*sh;
      this.images.push({image,points:this.points(x,y,w,h),uv:[x0/iw,y0/ih,(x0+w/dw*sw)/iw,(y0+h/dh*sh)/ih],opacity:this.globalAlpha});
    };
    if(!this.clips){emit(dx,dy,dw,dh);return;}
    for(const clip of this.clips){
      if(['a','b','c','d','e','f'].some(k=>Math.abs(clip.matrix[k]-this.matrix[k])>1e-8))throw Error('Sprite clip transform changed');
      const x=Math.max(dx,clip.x),y=Math.max(dy,clip.y),right=Math.min(dx+dw,clip.x+clip.w),bottom=Math.min(dy+dh,clip.y+clip.h);
      if(right>x&&bottom>y)emit(x,y,right-x,bottom-y);
    }
  }
}
