// Cached painted material response. Adapted from the approved pass09 renderer.
// Geometry and lamp positions are supplied by the actual generated harbor.
function groundField(source){
  // Build one opaque world-sized field. Overlapping large source crops retain
  // painted wet/dry shapes while avoiding a repeated small puddle carpet.
  // The integer hash is fixed by patch coordinates, never time or camera.
  const field=document.createElement('canvas');field.width=1024;field.height=512;
  const c=field.getContext('2d');c.drawImage(source,0,0,field.width,field.height);
  const tile=document.createElement('canvas'),mask=document.createElement('canvas');tile.width=tile.height=mask.width=mask.height=320;
  const t=tile.getContext('2d'),m=mask.getContext('2d');
  const feather=axis=>{const g=m.createLinearGradient(0,0,axis?0:320,axis?320:0);g.addColorStop(0,'#fff0');g.addColorStop(.18,'#fff');g.addColorStop(.82,'#fff');g.addColorStop(1,'#fff0');m.fillStyle=g;m.fillRect(0,0,320,320);};
  feather(0);m.globalCompositeOperation='destination-in';feather(1);
  for(let row=-1;row<4;row++)for(let col=-1;col<6;col++){
    const seed=Math.imul(col+3,73856093)^Math.imul(row+3,19349663),bits=seed>>>0;
    const size=.8*Math.min(source.width,source.height),sx=((bits>>>3)%101)/100*(source.width-size),sy=((bits>>>12)%101)/100*(source.height-size);
    t.clearRect(0,0,320,320);t.save();t.translate(160,160);t.rotate((bits%4)*Math.PI/2);if(bits&16)t.scale(-1,1);t.drawImage(source,sx,sy,size,size,-160,-160,320,320);t.restore();
    t.save();t.globalCompositeOperation='destination-in';t.drawImage(mask,0,0);t.restore();
    c.drawImage(tile,col*224-48,row*224-48);
  }return field;
}
export function bakeQuayMaterial(source,wearArea,groundLights){
  const image=groundField(source);
  const surface=document.createElement('canvas'),sky=document.createElement('canvas'),warm=document.createElement('canvas'),sheen=document.createElement('canvas'),environment=document.createElement('canvas');
  surface.width=sky.width=warm.width=sheen.width=environment.width=image.width;surface.height=sky.height=warm.height=sheen.height=environment.height=image.height;
  const c=surface.getContext('2d',{willReadFrequently:true}),sc=sky.getContext('2d'),wc=warm.getContext('2d'),hc=sheen.getContext('2d'),ec=environment.getContext('2d');c.drawImage(image,0,0);
  // Derive a cool specular response from the artist-painted wet/blue material,
  // preserving its irregular shapes and dark breaks rather than adding noise.
  const pixels=c.getImageData(0,0,image.width,image.height),data=pixels.data,amber=wc.createImageData(image.width,image.height),body=c.getImageData(0,0,image.width,image.height),gloss=hc.createImageData(image.width,image.height),ambient=ec.createImageData(image.width,image.height);
  const luminance=new Float32Array(image.width*image.height),wetness=new Float32Array(image.width*image.height);
  for(let p=0;p<luminance.length;p++){luminance[p]=(data[p*4]+data[p*4+1]+data[p*4+2])/3;wetness[p]=Math.max(0,Math.min(1,(data[p*4+2]-data[p*4]+3)/20));}
  const sample=(x,y)=>luminance[Math.max(0,Math.min(image.height-1,y))*image.width+Math.max(0,Math.min(image.width-1,x))];
  const sampleWet=(x,y)=>wetness[Math.max(0,Math.min(image.height-1,y))*image.width+Math.max(0,Math.min(image.width-1,x))];
  for(let i=0;i<data.length;i+=4){
    const wet=Math.pow(Math.max(0,Math.min(1,(data[i+2]-data[i]-1)/18)),.7);
    const detail=Math.max(0,Math.min(1,((data[i]+data[i+1]+data[i+2])/3-45)/85));
    const x=wearArea.x+(i/4%image.width)/image.width*wearArea.w,y=wearArea.y+Math.floor(i/4/image.width)/image.height*wearArea.h;
    // Painted material supplies both large wet regions and fine roughness. A
    // local luminance response keeps dark gaps inside highlights; no random
    // screen-space noise or frame-dependent shimmer is added.
    const px=i/4%image.width,py=Math.floor(i/4/image.width);
    const local=(sample(px-7,py)+sample(px+7,py)+sample(px,py-11)+sample(px,py+11)+sample(px-19,py)+sample(px+19,py))/6;
    const grain=Math.pow(Math.max(0,Math.min(1,(luminance[i/4]-local+4)/14)),1.35);
    // A continuous damp substrate connects the reflected regions. Retain the
    // artist's cracks and roughness; darker wet recesses sit below fine glints.
    body.data[i]=data[i]*.7+4;
    body.data[i+1]=data[i+1]*.7+5;
    body.data[i+2]=data[i+2]*.72+7;
    gloss.data[i]=73+detail*20;gloss.data[i+1]=98+detail*24;gloss.data[i+2]=121+detail*26;
    gloss.data[i+3]=Math.round(data[i+3]*wet*.07*grain);
    const softWet=(sampleWet(px,py)+sampleWet(px-22,py)+sampleWet(px+22,py)+sampleWet(px,py-22)+sampleWet(px,py+22))/5;
    // Broad sky reflection follows the wet material, not a blue floor stripe.
    const skyBand=Math.exp(-Math.pow((x-5.2-y*.48)/6.8,2));
    const skyBreak=.32+.68*softWet;
    ambient.data[i]=72;ambient.data[i+1]=104;ambient.data[i+2]=132;
    ambient.data[i+3]=Math.round(data[i+3]*skyBand*.6*softWet*skyBreak);
    let light=0;for(const lamp of groundLights){
      const forward=y-lamp.y,front=Math.max(0,Math.min(1,(forward+.3)/.7));
      const d=Math.max(0,forward),dx=(x-lamp.x-d*.12)/(lamp.spread+d*.15);
      light+=lamp.power*front*Math.exp(-dx*dx)*Math.exp(-d/lamp.reach);
    }
    light=Math.min(1,light*1.4);
    amber.data[i]=245;amber.data[i+1]=166+detail*20;amber.data[i+2]=54+detail*12;
    // Rough dry fragments receive weak incident light too; otherwise only
    // isolated puddles light up and the doorway appears detached from the quay.
    const roughReceive=.38+.22*detail,wetReceive=.25*softWet+.12*grain*wet;
    const receivingGaps=.45+.55*detail;
    amber.data[i+3]=Math.round(data[i+3]*light*(roughReceive+wetReceive)*receivingGaps*1.75);
    const u=(i/4%image.width)/image.width,v=Math.floor(i/4/image.width)/image.height;
    const edge=Math.min(1,u*12,(1-u)*12,v*12,(1-v)*12);
    data[i]=80;data[i+1]=110;data[i+2]=140;data[i+3]=Math.round(data[i+3]*wet*edge*skyBand*.17*grain);
  }sc.putImageData(pixels,0,0);wc.putImageData(amber,0,0);c.putImageData(body,0,0);hc.putImageData(gloss,0,0);ec.putImageData(ambient,0,0);
  // Lamp falloff already bounds the response. A second ellipse would cut the
  // broad receiving surface back into isolated pools under each bright streak.
  const material={surface,sky,warm,sheen,environment};return material;
}
