// Small world labels retain their raster until text/style changes. Screen-space
// font size is preserved independently of the world camera zoom.
export class ShoreTextCache{
  constructor(){this.entries=new Map();}
  commands(labels){return labels.map(label=>{
    const key=JSON.stringify([label.text,label.font,label.color,label.align]);
    let item=this.entries.get(key);
    if(!item){
      const image=document.createElement('canvas'),c=image.getContext('2d');
      c.font=label.font;c.textAlign=label.align||'start';
      const m=c.measureText(label.text),left=Math.ceil(m.actualBoundingBoxLeft)+2;
      const top=Math.ceil(m.actualBoundingBoxAscent)+2;
      image.width=Math.max(1,left+Math.ceil(m.actualBoundingBoxRight)+2);
      image.height=Math.max(1,top+Math.ceil(m.actualBoundingBoxDescent)+2);
      c.font=label.font;c.textAlign=label.align||'start';c.fillStyle=label.color;
      c.fillText(label.text,left,top);item={image,left,top};this.entries.set(key,item);
    }
    const {image,left,top}=item,x=label.x-left,y=label.y-top;
    return {image,points:[x,y,x+image.width,y,x+image.width,y+image.height,x,y+image.height],opacity:label.opacity??1};
  });}
  clear(){this.entries.clear();}
}
