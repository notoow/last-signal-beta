// Retained atlas/quad backend for the shore renderer migration. Not selected by
// the live game until scene composition, occlusion and mobile parity are checked.
// Independent implementation of persistent geometry + explicit dirty updates.
const VERTEX=`attribute vec2 position;attribute vec2 uv;attribute float opacity;
uniform vec2 viewport;uniform mat3 camera;uniform vec4 uvTransform;varying vec2 tex;varying float alpha;
void main(){vec3 p=camera*vec3(position,1.);gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);tex=uv*uvTransform.xy+uvTransform.zw;alpha=opacity;}`;
const FRAGMENT=`precision mediump float;uniform sampler2D atlas;uniform sampler2D coverMask;
uniform float alphaCutoff;uniform float useCover;uniform vec2 pixelSize;varying vec2 tex;varying float alpha;
void main(){vec4 ink=texture2D(atlas,tex)*alpha;
if(useCover>0.5&&texture2D(coverMask,gl_FragCoord.xy/pixelSize).a>=0.5)discard;
if(alphaCutoff>0.){if(ink.a<alphaCutoff)discard;ink=vec4(1.);}
gl_FragColor=ink;}`;
const FLOATS=30,BYTES=FLOATS*4;
const identity=[1,0,0,0,1,0,0,0,1];

function writeQuad(data,index,q){
  const {points,uv=[0,0,1,1],opacity=1}=q;
  if(points?.length!==8||![4,8].includes(uv.length)||![...points,...uv,opacity].every(Number.isFinite)||opacity<0||opacity>1)
    throw Error('Invalid shore quad');
  const tex=uv.length===8?uv:[uv[0],uv[1],uv[2],uv[1],uv[2],uv[3],uv[0],uv[3]];
  let offset=index*FLOATS;
  for(const corner of [0,1,2,0,2,3]){
    data[offset++]=points[corner*2];data[offset++]=points[corner*2+1];
    data[offset++]=tex[corner*2];data[offset++]=tex[corner*2+1];data[offset++]=opacity;
  }
}

export class ShoreGpuScene{
  constructor(canvas){
    this.canvas=canvas;this.textures=new Map();this.layers=new Map();this.targets=new Map();this.lost=false;this.disposed=false;
    this.stats={textureUploads:0,texturePatches:0,bufferUploads:0,uploadedBytes:0,drawCalls:0};
    const options={alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false};
    this.gl=canvas.getContext('webgl2',options);this.webgl2=!!this.gl;
    if(!this.gl)this.gl=canvas.getContext('webgl',options);
    if(!this.gl)throw Error('Shore GPU renderer unavailable');
    this.onLost=event=>{event.preventDefault();this.lost=true;};
    this.onRestored=()=>{
      this.lost=false;this.initialize();
      for(const texture of this.textures.values())texture.handle=null;
      for(const layer of this.layers.values()){layer.handle=null;layer.start=0;layer.end=layer.count;}
      for(const target of this.targets.values()){target.handle=null;target.framebuffer=null;}
    };
    canvas.addEventListener('webglcontextlost',this.onLost);canvas.addEventListener('webglcontextrestored',this.onRestored);
    this.initialize();
  }
  initialize(){
    const g=this.gl,compile=(type,source)=>{
      const shader=g.createShader(type);g.shaderSource(shader,source);g.compileShader(shader);
      if(!g.getShaderParameter(shader,g.COMPILE_STATUS)){const message=g.getShaderInfoLog(shader);g.deleteShader(shader);throw Error(message);}
      return shader;
    };
    const vertexSource=this.webgl2?'#version 300 es\n'+VERTEX.replaceAll('attribute ','in ').replaceAll('varying ','out '):VERTEX;
    const fragmentSource=this.webgl2?'#version 300 es\n'+FRAGMENT.replace('precision mediump float;','precision mediump float;out vec4 color;').replaceAll('varying ','in ').replaceAll('texture2D(','texture(').replaceAll('gl_FragColor','color'):FRAGMENT;
    const vertex=compile(g.VERTEX_SHADER,vertexSource),fragment=compile(g.FRAGMENT_SHADER,fragmentSource),program=g.createProgram();
    g.attachShader(program,vertex);g.attachShader(program,fragment);g.linkProgram(program);g.deleteShader(vertex);g.deleteShader(fragment);
    if(!g.getProgramParameter(program,g.LINK_STATUS)){const message=g.getProgramInfoLog(program);g.deleteProgram(program);throw Error(message);}
    this.program=program;this.locations=Object.fromEntries(['viewport','camera','atlas','uvTransform','coverMask','alphaCutoff','useCover','pixelSize'].map(name=>[name,g.getUniformLocation(program,name)]));
    this.attributes=['position','uv','opacity'].map(name=>g.getAttribLocation(program,name));
    this.anisotropy=g.getExtension('EXT_texture_filter_anisotropic');
    g.disable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  }
  assertLive(){if(this.disposed)throw Error('Shore GPU scene disposed');}
  // Source canvas/image remains authoritative for context restoration. Mutating
  // a canvas requires an explicit new revision; animation UV changes do not.
  atlas(id,source,{revision=0,nearest=false,mipmaps=true,repeat=false}={}){
    this.assertLive();const old=this.textures.get(id);
    const w=source.naturalWidth||source.width,h=source.naturalHeight||source.height,pot=n=>n>0&&(n&(n-1))===0;
    if(old&&old.source===source&&old.revision===revision&&old.nearest===nearest&&old.mipmaps===mipmaps&&old.repeat===repeat)return;
    let uploadSource=source;
    if(repeat&&!this.webgl2&&(!pot(w)||!pot(h))){
      // WebGL1 requires power-of-two repeat textures. Normalize once per
      // source revision; UVs still describe the complete original image.
      const limit=2**Math.floor(Math.log2(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)));
      uploadSource=document.createElement('canvas');
      uploadSource.width=Math.min(limit,2**Math.ceil(Math.log2(w)));
      uploadSource.height=Math.min(limit,2**Math.ceil(Math.log2(h)));
      const c=uploadSource.getContext('2d');c.imageSmoothingEnabled=!nearest;
      c.drawImage(source,0,0,uploadSource.width,uploadSource.height);
    }
    if(old?.handle&&!this.lost)this.gl.deleteTexture(old.handle);
    this.textures.set(id,{source,uploadSource,revision,nearest,mipmaps,repeat,handle:null});
  }
  // Small premultiplied RGBA masks (fog/discovery), not framebuffer readbacks. Keep a CPU
  // copy so a restored GPU receives the current explored state, not old pixels.
  pixels(id,width,height,rgba){
    this.assertLive();
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4)throw Error('Invalid shore mask');
    const old=this.textures.get(id);if(old?.handle&&!this.lost)this.gl.deleteTexture(old.handle);
    this.textures.set(id,{width,height,rgba:new Uint8Array(rgba),nearest:true,handle:null,patches:[]});
  }
  patchPixels(id,x,y,width,height,rgba){
    this.assertLive();const texture=this.textures.get(id);
    if(!texture?.rgba||![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<1||height<1||x+width>texture.width||y+height>texture.height||rgba.length!==width*height*4)throw Error('Invalid shore mask patch');
    const copy=new Uint8Array(rgba);
    for(let row=0;row<height;row++)texture.rgba.set(copy.subarray(row*width*4,(row+1)*width*4),((y+row)*texture.width+x)*4);
    // Unuploaded/lost textures will use the authoritative full copy instead.
    if(texture.handle&&!this.lost)texture.patches.push({x,y,width,height,rgba:copy});
  }
  layer(id,atlas,quads){
    this.assertLive();if(!this.textures.has(atlas))throw Error('Missing shore atlas');
    const data=new Float32Array(quads.length*FLOATS);quads.forEach((q,i)=>writeQuad(data,i,q));
    this.removeLayer(id);this.layers.set(id,{atlas,data,count:quads.length,handle:null,start:0,end:quads.length});
  }
  quad(id,index,value){
    this.assertLive();const layer=this.layers.get(id);
    if(!layer||!Number.isInteger(index)||index<0||index>=layer.count)throw Error('Invalid shore quad index');
    writeQuad(layer.data,index,value);layer.start=Math.min(layer.start,index);layer.end=Math.max(layer.end,index+1);
  }
  removeLayer(id){
    const layer=this.layers.get(id);if(layer?.handle&&!this.lost)this.gl.deleteBuffer(layer.handle);this.layers.delete(id);
  }
  removeAtlas(id){
    if([...this.layers.values()].some(layer=>layer.atlas===id))throw Error('Shore atlas still in use');
    const texture=this.textures.get(id);if(texture?.handle&&!this.lost)this.gl.deleteTexture(texture.handle);this.textures.delete(id);
  }
  target(id,width,height){
    this.assertLive();if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid shore target size');
    let target=this.targets.get(id);
    if(target&&target.width===width&&target.height===height)return target;
    this.removeTarget(id);target={width,height,handle:null,framebuffer:null};this.targets.set(id,target);return target;
  }
  removeTarget(id){
    const target=this.targets.get(id);if(target&&!this.lost){if(target.handle)this.gl.deleteTexture(target.handle);if(target.framebuffer)this.gl.deleteFramebuffer(target.framebuffer);}
    this.targets.delete(id);
  }
  prepareTarget(target){
    if(target.handle)return;
    const g=this.gl;target.handle=g.createTexture();g.bindTexture(g.TEXTURE_2D,target.handle);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D,0,g.RGBA,target.width,target.height,0,g.RGBA,g.UNSIGNED_BYTE,null);
    target.framebuffer=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);
    g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,target.handle,0);
    if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Incomplete shore target');
  }
  draw({width=this.canvas.width,height=this.canvas.height,camera=identity,order=[...this.layers.keys()],layerViews={},target=null,alphaCutoff=0,clear=true}={}){
    this.assertLive();if(this.lost)return false;
    if(!Number.isFinite(width)||!Number.isFinite(height)||!(width>0&&height>0)||camera.length!==9||!camera.every(Number.isFinite))throw Error('Invalid shore camera');
    const g=this.gl,buffer=target===null?null:this.targets.get(target);
    if(target!==null&&!buffer)throw Error('Missing shore target');
    if(buffer)this.prepareTarget(buffer);
    g.bindFramebuffer(g.FRAMEBUFFER,buffer?.framebuffer||null);
    g.viewport(0,0,buffer?.width||this.canvas.width,buffer?.height||this.canvas.height);if(clear){g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);}
    g.useProgram(this.program);g.uniform2f(this.locations.viewport,width,height);g.uniformMatrix3fv(this.locations.camera,false,camera);
    g.activeTexture(g.TEXTURE0);g.uniform1i(this.locations.atlas,0);
    g.uniform1i(this.locations.coverMask,1);g.uniform1f(this.locations.alphaCutoff,alphaCutoff);
    g.uniform2f(this.locations.pixelSize,buffer?.width||this.canvas.width,buffer?.height||this.canvas.height);
    // Caller supplies painter order; never regroup transparent objects by
    // texture and accidentally move the captain in front of a building.
    for(const id of order){
      const layer=this.layers.get(id);if(!layer||!layer.count)continue;
      const cover=layer.occlusionMask?this.targets.get(layer.occlusionMask):null;
      g.uniform1f(this.locations.useCover,cover?.handle?1:0);
      g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,cover?.handle||null);g.activeTexture(g.TEXTURE0);
      const view=layerViews[id];
      g.uniformMatrix3fv(this.locations.camera,false,view?.camera||camera);
      g.uniform4fv(this.locations.uvTransform,view?.uvTransform||[1,1,0,0]);
      const texture=this.textures.get(layer.atlas);
      if(!texture.handle){
        texture.handle=g.createTexture();g.bindTexture(g.TEXTURE_2D,texture.handle);
        const filter=texture.nearest?g.NEAREST:g.LINEAR;
        g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);
        const wrap=texture.repeat?g.REPEAT:g.CLAMP_TO_EDGE;
        g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,wrap);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,wrap);
        if(texture.rgba){
          g.texImage2D(g.TEXTURE_2D,0,g.RGBA,texture.width,texture.height,0,g.RGBA,g.UNSIGNED_BYTE,texture.rgba);texture.patches.length=0;
        }else g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,texture.uploadSource);
        const width=texture.uploadSource?.naturalWidth||texture.uploadSource?.width,height=texture.uploadSource?.naturalHeight||texture.uploadSource?.height;
        const powerOfTwo=n=>n>0&&(n&(n-1))===0;
        // Large authored images need minification filtering. WebGL2 supports
        // NPOT atlases such as the 2048x768 wall without rescaling the source.
        if(texture.mipmaps&&!texture.nearest&&!texture.rgba&&(this.webgl2||powerOfTwo(width)&&powerOfTwo(height))){
          g.generateMipmap(g.TEXTURE_2D);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);
          if(this.anisotropy)g.texParameterf(g.TEXTURE_2D,this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
            Math.min(8,g.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        }
        this.stats.textureUploads++;
      }else g.bindTexture(g.TEXTURE_2D,texture.handle);
      for(const patch of texture.patches||[]){
        g.texSubImage2D(g.TEXTURE_2D,0,patch.x,patch.y,patch.width,patch.height,g.RGBA,g.UNSIGNED_BYTE,patch.rgba);this.stats.texturePatches++;
      }
      if(texture.patches)texture.patches.length=0;
      if(!layer.handle){
        layer.handle=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,layer.handle);g.bufferData(g.ARRAY_BUFFER,layer.data,g.DYNAMIC_DRAW);
        this.stats.bufferUploads++;this.stats.uploadedBytes+=layer.data.byteLength;
      }else{
        g.bindBuffer(g.ARRAY_BUFFER,layer.handle);
        if(layer.end>layer.start){
          const update=layer.data.subarray(layer.start*FLOATS,layer.end*FLOATS);
          g.bufferSubData(g.ARRAY_BUFFER,layer.start*BYTES,update);this.stats.bufferUploads++;this.stats.uploadedBytes+=update.byteLength;
        }
      }
      layer.start=layer.count;layer.end=0;
      this.attributes.forEach((location,i)=>{g.enableVertexAttribArray(location);g.vertexAttribPointer(location,i===2?1:2,g.FLOAT,false,20,i*8);});
      g.drawArrays(g.TRIANGLES,0,layer.count*6);this.stats.drawCalls++;
    }
    return true;
  }
  dispose(){
    if(this.disposed)return;
    for(const id of [...this.layers.keys()])this.removeLayer(id);
    for(const id of [...this.textures.keys()])this.removeAtlas(id);
    for(const id of [...this.targets.keys()])this.removeTarget(id);
    if(!this.lost)this.gl.deleteProgram(this.program);
    this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
    this.disposed=true;
  }
}
