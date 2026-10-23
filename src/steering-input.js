const movementKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
const zero=()=>({x:0,y:0});
const bounded=(x,y)=>{
  if(!Number.isFinite(x)||!Number.isFinite(y))return zero();
  const length=Math.hypot(x,y),scale=Math.max(1,length);
  return {x:x/scale,y:y/scale};
};

// A circular deadzone retains the dragged angle. Outside it, the remaining
// radius maps continuously to engine effort rather than eight digital keys.
export function joystickVector(x,y,deadzone=.18){
  if(!Number.isFinite(x)||!Number.isFinite(y))return zero();
  const length=Math.hypot(x,y);
  if(length<=deadzone)return zero();
  const strength=Math.min(1,(length-deadzone)/(1-deadzone));
  return {x:x/length*strength,y:y/length*strength};
}

export function steeringInput(keys,{target,game,active,signal}){
  let touch=zero();
  const keyboardHeld=()=>movementKeys.some(k=>keys.has(k));
  const keyboard=()=>({x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),
    y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)});
  target.addEventListener('lastsignal:steer',event=>{
    if(event.detail?.game!==game)return;
    touch=active()&&!keyboardHeld()?bounded(event.detail.x,event.detail.y):zero();
  },{signal});
  return {
    read(){
      if(!active()){touch=zero();return zero();}
      // Keyboard input wins without adding a second acceleration vector.
      // After key release, a fresh stick movement is required to steer again.
      if(keyboardHeld()){touch=zero();return keyboard();}
      return {...touch};
    },
    clear(){touch=zero();}
  };
}
