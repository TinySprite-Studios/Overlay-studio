(() => {
 window.TSSCare={connect(events){
  const hud=document.getElementById('tss-care');
  if(!hud)return;
  events.addEventListener('care',event=>{
   try{
    const state=JSON.parse(event.data);
    for(const key of ['health','food','drink','happiness']){
     const value=Math.max(0,Math.min(100,Number(state[key])||0));
     const meter=document.getElementById('care-'+key);meter.value=value;
     document.getElementById('care-'+key+'-value').textContent=value+'/100';
     meter.classList.toggle('low',value<=20);
    }
    document.getElementById('care-notice').textContent=String(state.notice||'');
    document.getElementById('care-status').textContent=state.running?'LIVE CARE':'PAUSED';
   }catch(_){}
  });
 }};
})();
