import {connectTwitch,emoteParts} from './chat.mjs';
import {perspectiveMatrix} from './geometry.mjs';
const c=window.TSS_SCENE,settings=window.TSS_OFFICE,$=id=>document.getElementById(id);
document.title=c.name;document.body.classList.toggle('no-motion',c.animate===false);
const scene=$('office');
function resize(){const scale=Math.min(innerWidth/settings.artwork.width,innerHeight/settings.artwork.height);scene.style.setProperty('--office-scale',scale);}
window.addEventListener('resize',resize);resize();
for(const [name,corners]of Object.entries(settings.screens)){
  const matrix=perspectiveMatrix(settings.screenSize.width,settings.screenSize.height,corners),monitor=$(name+'-monitor');
  monitor.style.transform='matrix3d('+matrix.join(',')+')';
  if(settings.screenMasks?.[name]){
    const points=settings.screenMasks[name].map(([x,y])=>{
      const a=matrix[0]-x*matrix[3],b=matrix[4]-x*matrix[7],c=matrix[1]-y*matrix[3],d=matrix[5]-y*matrix[7],u=x-matrix[12],v=y-matrix[13],det=a*d-b*c;
      return ((u*d-b*v)/det)+'px '+((a*v-u*c)/det)+'px';
    });
    monitor.style.clipPath='polygon('+points.join(',')+')';
  }
}
// Build abstract message silhouettes. No real Discord text or accounts are accessed.
const colours=['#748cba','#bf7d94','#77ac99','#b3a074','#9789c2','#7c9eae','#9bba91','#ba9090'];
const fragment=document.createDocumentFragment();
for(let i=0;i<12;i++){const row=document.createElement('div');row.className='discord-row';row.setAttribute('aria-hidden','true');row.style.setProperty('--avatar',colours[i%colours.length]);row.style.setProperty('--name-width',(70+(i*31)%90)+'px');row.style.setProperty('--line-width',(48+(i*17)%44)+'%');row.style.setProperty('--short-width',(22+(i*13)%40)+'%');
  const avatar=document.createElement('div');avatar.className='discord-avatar';const bubble=document.createElement('div');bubble.className='discord-bubble';for(const className of ['discord-name','discord-line','discord-line short']){const bar=document.createElement('div');bar.className=className;bubble.append(bar);}row.append(avatar,bubble);fragment.append(row);}
const track=$('discord-track');track.append(fragment);for(const row of [...track.children])track.append(row.cloneNode(true));
const title=c.title||'Streaming Starting Soon';$('start-title').replaceChildren();
if(/starting soon/i.test(title)){const lead=document.createTextNode(title.replace(/starting soon/i,'').trim()||'Streaming');const strong=document.createElement('strong');strong.textContent='Starting Soon';$('start-title').append(lead,strong);}else{$('start-title').textContent=title;}
$('start-subtitle').textContent=c.subtitle||'';$('channel-name').textContent=(c.channel||'JOHN McKLEAN').toUpperCase();
const countdown=Math.max(0,Number(c.countdown)||0),end=Date.now()+countdown*1000;
function clock(){const now=Date.now();$('start-clock').textContent=new Date(now).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(countdown){$('countdown').hidden=false;const left=Math.max(0,Math.ceil((end-now)/1000));$('countdown').textContent=left?String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0'):(c.countdownEnd||'Stand by…');}}
clock();const clockTimer=setInterval(clock,1000);
const fans=[[1430,395,40,45],[1495,406,24,31],[1617,354,29,46],[1619,464,30,47],[1618,569,29,47]];
for(const [x,y,rx,ry]of fans){const fan=document.createElement('div');fan.className='fan';Object.assign(fan.style,{left:x-rx+'px',top:y-ry+'px',width:rx*2+'px',height:ry*2+'px'});const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');const group=document.createElementNS(ns,'g');group.classList.add('blades');for(let i=0;i<7;i++){const blade=document.createElementNS(ns,'path');blade.setAttribute('d','M50 44 Q36 19 54 5 Q76 18 57 45 Z');blade.setAttribute('fill','#5aff9b');blade.setAttribute('transform','rotate('+i*360/7+' 50 50)');group.append(blade);}svg.append(group);fan.append(svg);$('fan-effects').append(fan);}

const art=document.querySelector('.office-art');
art.src='../../'+c.background;
function panel(id,eyebrow,heading,detail,footer){
  document.querySelector('#'+id+' .screen-inner').innerHTML='<div class="pause-panel"><div class="panel-eyebrow"></div><h2></h2><p></p><div class="panel-meter"><i></i></div><footer></footer></div>';
  const panel=document.querySelector('#'+id+' .pause-panel');
  for(const [selector,text] of [['.panel-eyebrow',eyebrow],['h2',heading],['p',detail],['footer',footer]])panel.querySelector(selector).textContent=text;
}
panel('chat-monitor','JOHN McKLEAN','GG, EVERYONE','Thanks for hanging out.','SEE YOU NEXT STREAM');
panel('discord-monitor','TSS ? SESSION COMPLETE','SIGNING OFF','Another one in the books.','TinySprite is putting the pixels to bed.');
document.querySelector('#start-title').innerHTML='';const heading=document.createElement('strong');heading.textContent=c.title;document.querySelector('#start-title').append(heading);
window.addEventListener('pagehide',()=>clearInterval(clockTimer),{once:true});
