// Generic scene accent override. Scenes opt in by using the --accent CSS variable.
(() => {
 window.TSSPaint={connect(events){
  const style=document.documentElement.style,original=style.getPropertyValue('--accent');let expiry,cycle;
  const restore=()=>{clearTimeout(expiry);clearTimeout(cycle);if(original)style.setProperty('--accent',original);else style.removeProperty('--accent');};
  const apply=state=>{
   restore();const active=state?.active;
   if(!active||!/^#[0-9a-f]{6}$/i.test(active.hex)||!Number.isFinite(active.endsAt)||active.endsAt<=Date.now())return;
   style.setProperty('--accent',active.hex);
   if(active.colour==='rgb'){
    const tick=()=>{if(Date.now()>=active.endsAt){restore();return;}style.setProperty('--accent',`hsl(${(Date.now()%8000)/8000*360},90%,65%)`);cycle=setTimeout(tick,80);};tick();
   }
   expiry=setTimeout(restore,Math.min(2147483647,active.endsAt-Date.now()));
  };
  events.addEventListener('paint',event=>{try{apply(JSON.parse(event.data));}catch{}});
 }};
})();
