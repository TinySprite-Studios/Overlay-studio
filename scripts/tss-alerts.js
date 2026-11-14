// Optional shared events for any scene. Remove this script for a fully custom runtime.
(() => {
 const settings=window.OVERLAY_CONFIG?.alerts||{};
 const style=document.createElement('style');style.textContent='#studio-alert{position:fixed;z-index:100;left:10%;right:10%;top:15%;padding:24px;text-align:center;background:#10121aee;border:2px solid var(--accent,#e34855);border-radius:16px;color:white;font:600 clamp(20px,3vw,56px) Segoe UI,sans-serif}#studio-alert[hidden]{display:none}';document.head.append(style);
 const panel=document.createElement('div');panel.id='studio-alert';panel.hidden=true;panel.setAttribute('role','status');document.body.append(panel);
 const labels={follow:'New follower',sub:'Subscription',cheer:'New bits',donation:'New donation'};
 const queue=[];let busy=false;
 function play(){if(busy||!queue.length)return;busy=true;const alert=queue.shift();panel.textContent=labels[alert.kind]+' · '+alert.name+(alert.detail?' · '+alert.detail:'');panel.hidden=false;setTimeout(()=>{panel.hidden=true;busy=false;play();},Math.max(1,Math.min(30,Number(settings.holdSeconds)||5))*1000);}
 window.TSSAlerts={enqueue(alert){if(settings.enabled===false||!alert||!labels[alert.kind]||typeof alert.name!=='string')return;queue.push({kind:alert.kind,name:alert.name.slice(0,150),detail:String(alert.detail||'').slice(0,150)});play();}};
 const events=new EventSource('/events');window.TSSPaint?.connect(events);
 events.addEventListener('alert',event=>{try{window.TSSAlerts.enqueue(JSON.parse(event.data));}catch{}});
})();
