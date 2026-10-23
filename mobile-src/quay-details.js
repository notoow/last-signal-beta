const atlas=new Image();atlas.src='assets/art/working-quay-v2.png';
export const quayFrames={
  bench:[20,70,380,440],fish:[410,80,365,430],fuel:[798,90,335,410],
  shelter:[1153,70,372,438],puddle:[15,568,380,410],salt:[395,555,325,425],
  seawall:[724,580,559,365],anchor:[1288,526,232,430]
};
export const quayReady=()=>atlas.complete&&atlas.naturalWidth>0;
export function quaySprite(c,kind,x,y,w,h){
  if(!quayReady()||!quayFrames[kind])return false;
  c.drawImage(atlas,...quayFrames[kind],x,y,w,h);return true;
}
