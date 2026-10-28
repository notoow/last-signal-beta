// GPU-only contour composition. Targets stay on the GPU; there is no readback.
export class ShoreGpuOutline{
  constructor(scene){
    this.scene=scene;this.reset=()=>{this.program=null;this.buffer=null;};
    scene.canvas.addEventListener('webglcontextrestored',this.reset);this.reset();
  }
  initialize(){
    const g=this.scene.gl,webgl2=this.scene.webgl2;
    let vertex='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    let fragment=`precision highp float;
uniform sampler2D actorMask;uniform vec2 size;uniform vec2 stepSize;uniform vec3 tint;uniform float detail;
float actor(vec2 p){if(p.x<0.||p.y<0.||p.x>1.||p.y>1.)return 0.;return step(96./255.,texture2D(actorMask,p).a);}
void main(){vec2 uv=gl_FragCoord.xy/size;
float center=actor(uv);
float interior=actor(uv+vec2(stepSize.x,0.))*actor(uv-vec2(stepSize.x,0.))*actor(uv+vec2(0.,stepSize.y))*actor(uv-vec2(0.,stepSize.y));
float alpha=center*mix(235./255.,mix(.32,.85,detail),interior);
vec4 source=texture2D(actorMask,uv);vec3 ink=mix(tint,source.rgb/max(source.a,.001),detail*interior);gl_FragColor=vec4(ink*alpha,alpha);}`;
    if(webgl2){vertex='#version 300 es\n'+vertex.replace('attribute ','in ');fragment='#version 300 es\n'+fragment.replace('precision highp float;','precision highp float;out vec4 color;').replaceAll('texture2D(','texture(').replace('gl_FragColor','color');}
    const compile=(type,source)=>{const shader=g.createShader(type);g.shaderSource(shader,source);g.compileShader(shader);if(!g.getShaderParameter(shader,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(shader));return shader;};
    const vs=compile(g.VERTEX_SHADER,vertex),fs=compile(g.FRAGMENT_SHADER,fragment),program=g.createProgram();
    g.attachShader(program,vs);g.attachShader(program,fs);g.linkProgram(program);g.deleteShader(vs);g.deleteShader(fs);
    if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));
    this.program=program;this.locations=Object.fromEntries(['actorMask','size','stepSize','tint','detail'].map(k=>[k,g.getUniformLocation(program,k)]));
    this.position=g.getAttribLocation(program,'p');this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
    g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),g.STATIC_DRAW);
  }
  draw(actorId,{width,height,detail=0,tint=[.72,.88,.82]}){
    const scene=this.scene;if(scene.lost)return false;
    const actor=scene.targets.get(actorId);
    if(!actor?.handle)throw Error('Outline masks unavailable');
    if(!this.program)this.initialize();const g=scene.gl;
    g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,scene.canvas.width,scene.canvas.height);g.useProgram(this.program);
    g.uniform3f(this.locations.tint,...tint);g.uniform1f(this.locations.detail,detail);
    g.uniform2f(this.locations.size,scene.canvas.width,scene.canvas.height);g.uniform2f(this.locations.stepSize,1/width,1/height);
    for(const [i,target,name]of [[0,actor,'actorMask']]){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,target.handle);g.uniform1i(this.locations[name],i);}
    for(const location of scene.attributes)g.disableVertexAttribArray(location);
    g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.enableVertexAttribArray(this.position);g.vertexAttribPointer(this.position,2,g.FLOAT,false,0,0);
    g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);g.drawArrays(g.TRIANGLES,0,6);scene.stats.drawCalls++;
    g.activeTexture(g.TEXTURE0);return true;
  }
  dispose(){const g=this.scene.gl;if(!this.scene.lost){if(this.program)g.deleteProgram(this.program);if(this.buffer)g.deleteBuffer(this.buffer);}this.scene.canvas.removeEventListener('webglcontextrestored',this.reset);this.reset();}
}
