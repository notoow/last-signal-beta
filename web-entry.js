
if(matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0 && Math.min(screen.width,screen.height)<1000){
  const css=document.createElement('link');css.rel='stylesheet';css.href='mobile.css';
  await new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=reject;document.head.append(css);});
  await import('./mobile.js');
}else{await import('./src/rescue-app.js');}
