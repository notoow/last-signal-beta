const unitQuad={points:[0,0,1,0,1,1,0,1]};
export function installShoreWater(scene,image,id='shore-water'){
  // Canvas pattern rendering samples the authored level directly. Whole-image
  // mip averaging broadens the fine broken wavelets at this camera scale.
  scene.atlas(id,image,{repeat:true,mipmaps:false});
  const base=id+':base';scene.pixels(base,1,1,new Uint8Array([9,45,56,255]));scene.layer(base,base,[unitQuad]);
  scene.layer(id,id,[{...unitQuad,opacity:.68}]);
  return {
    order:[base,id],
    views(frame,time,reduced=false){
      const unit=frame.pixelsPerMetre,motion=reduced?0:time,periodX=18*unit,periodY=periodX*image.height/image.width;
      const x=frame.ox+Math.sin(motion*.14)*unit*.055,y=frame.oy+Math.sin(motion*.11)*unit*.025;
      const camera=[frame.width,0,0,0,frame.height,0,0,0,1];
      return {[base]:{camera},[id]:{camera,uvTransform:[frame.width/periodX,frame.height/periodY,-x/periodX,-y/periodY]}};
    },
    dispose(){scene.removeLayer(base);scene.removeLayer(id);scene.removeAtlas(base);scene.removeAtlas(id);}
  };
}
