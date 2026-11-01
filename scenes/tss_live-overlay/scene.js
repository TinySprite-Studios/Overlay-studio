(() => {
const c=window.TSS_SCENE;const el=id=>document.getElementById(id);
document.title=c.name;document.body.className='type-'+c.type+' style-'+c.style+(c.layout==='vertical'||innerHeight>innerWidth?' vertical':'')+(c.animate?'':' no-motion');
document.documentElement.style.setProperty('--accent',c.accent);document.documentElement.style.setProperty('--base',c.base);
for(const key of ['title','subtitle','channel','social'])el(key).textContent=c[key];
el('status').textContent=({starting:'GOING LIVE',brb:'ON A BREAK',ending:'OFFLINE',chatting:'LIVE CONVERSATION',live:'LIVE',blank:''})[c.type];
el('eyebrow').textContent=({starting:'The next chapter',brb:'Back in a moment',ending:'Until next time',chatting:'Welcome in',live:'',blank:''})[c.type];
const asset=value=>'../../'+value.split('/').map(encodeURIComponent).join('/');
if(c.logo && /^assets\//.test(c.logo)){el('logo').src=asset(c.logo);el('logo').hidden=false;el('logo').onerror=()=>el('logo').hidden=true;}
if(c.background){if(/\.(mp4|webm)$/i.test(c.background)){const video=document.createElement('video');video.src=asset(c.background);video.muted=true;video.autoplay=true;video.loop=true;video.playsInline=true;el('background').append(video);}else{el('background').style.backgroundImage='url('+JSON.stringify(asset(c.background))+')';}}
document.querySelector('.shade').style.opacity=c.overlay/100;
const end=Date.now()+c.countdown*1000;function tick(){el('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(!c.countdown)return;const remaining=Math.max(0,Math.ceil((end-Date.now())/1000));el('countdown').textContent=remaining?String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'):c.countdownEnd;el('countdown').classList.toggle('finished',!remaining);}tick();setInterval(tick,250);
})();
