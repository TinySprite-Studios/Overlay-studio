// Public Twitch IRC read-only client. Never sends chat messages or uses OAuth tokens.
export function parseIRC(line) {
  let rest=line,tags={},prefix='';
  if(rest.startsWith('@')){const end=rest.indexOf(' ');if(end<0)return null;for(const item of rest.slice(1,end).split(';')){const split=item.indexOf('=');const key=split<0?item:item.slice(0,split);const value=split<0?'':item.slice(split+1);tags[key]=value.replace(/\\([s:nr\\])/g,(_m,c)=>({s:' ',':':';',n:'\n',r:'\r','\\':'\\'}[c]));}rest=rest.slice(end+1);}
  if(rest.startsWith(':')){const end=rest.indexOf(' ');if(end<0)return null;prefix=rest.slice(1,end);rest=rest.slice(end+1);}
  const trailing=rest.indexOf(' :');let params=trailing>=0?rest.slice(0,trailing).split(/ +/):rest.split(/ +/);if(trailing>=0)params.push(rest.slice(trailing+2));
  const command=params.shift();return command?{tags,prefix,command,params}:null;
}
export function messageFromIRC(message) {
  if(message.command!=='PRIVMSG'||message.params.length<2)return null;
  let text=message.params[1],action=false;if(text.startsWith('\u0001ACTION ')&&text.endsWith('\u0001')){action=true;text=text.slice(8,-1);}
  const login=message.prefix.split('!')[0].toLowerCase();
  return {id:message.tags.id||'',user:login,name:(message.tags['display-name']||login).slice(0,60),colour:/^#[0-9a-f]{6}$/i.test(message.tags.color)?message.tags.color:'#8cdbb2',text:text.slice(0,1000),emotes:action?'':message.tags.emotes||'',badges:message.tags.badges||'',action};
}
export function emoteParts(text,emotes) {
  const characters=Array.from(text),ranges=[];
  for(const item of emotes.split('/')){const [id,positions]=item.split(':');if(!id||!positions||!/^[a-zA-Z0-9_-]+$/.test(id))continue;
    for(const position of positions.split(',')){const match=/^(\d+)-(\d+)$/.exec(position);if(!match)continue;const start=Number(match[1]),end=Number(match[2]);if(start<=end&&end<characters.length)ranges.push({start,end,id});}}
  ranges.sort((a,b)=>a.start-b.start);let cursor=0;const parts=[];
  for(const range of ranges){if(range.start<cursor)continue;if(range.start>cursor)parts.push({text:characters.slice(cursor,range.start).join('')});parts.push({text:characters.slice(range.start,range.end+1).join(''),emote:range.id});cursor=range.end+1;}
  if(cursor<characters.length)parts.push({text:characters.slice(cursor).join('')});return parts;
}
export function connectTwitch(channel,handlers={},WebSocketClass=globalThis.WebSocket) {
  if(!/^[a-z0-9_]{3,25}$/.test(channel))throw Error('Set twitchChannel to your Twitch username in office-settings.js.');
  let socket,stopped=false,retryTimer,heartbeat,attempt=0,buffer='',lastTraffic=0,joined=false;
  const setStatus=(state,detail)=>handlers.status?.(state,detail);
  function connect(){
    if(stopped)return;joined=false;buffer='';setStatus('connecting','Joining #'+channel);
    try{socket=new WebSocketClass('wss://irc-ws.chat.twitch.tv:443');}catch{schedule();return;}
    socket.onopen=()=>{
      lastTraffic=Date.now();const guest='justinfan'+Math.floor(1000000+Math.random()*8999999);
      // Separate IRC commands in individual WebSocket frames; Twitch expects this handshake order.
      for(const command of ['PASS SCHMOOPIIE','NICK '+guest,'CAP REQ :twitch.tv/tags twitch.tv/commands','JOIN #'+channel])socket.send(command+'\r\n');
      clearInterval(heartbeat);heartbeat=setInterval(()=>{if(Date.now()-lastTraffic>90000){socket.close();return;}if(socket.readyState===1)socket.send('PING :tss-office\r\n');},30000);
    };
    socket.onmessage=event=>{
      lastTraffic=Date.now();buffer+=String(event.data);if(buffer.length>65536){socket.close();return;}
      const lines=buffer.split('\r\n');buffer=lines.pop();
      for(const line of lines){const message=parseIRC(line);if(!message)continue;
        if(message.command==='PING'){socket.send('PONG :'+message.params.at(-1)+'\r\n');continue;}
        if(message.command==='366'||message.command==='ROOMSTATE'){joined=true;attempt=0;setStatus('connected','Connected to #'+channel);}
        if(message.command==='PRIVMSG'&&message.params[0]?.toLowerCase()==='#'+channel){const chat=messageFromIRC(message);if(chat)handlers.message?.(chat);}
        if(message.command==='CLEARMSG')handlers.remove?.(message.tags['target-msg-id']);
        if(message.command==='CLEARCHAT')handlers.clear?.(message.params[1]?.toLowerCase()||null);
        if(message.command==='RECONNECT'){socket.close();}
        if(message.command==='NOTICE'&&/authentication|login|banned|suspended|no permission/i.test(message.params.at(-1)||'')){setStatus('retrying','Twitch chat unavailable; reconnecting');socket.close();}
      }
    };
    socket.onerror=()=>setStatus('retrying','Connection interrupted');
    socket.onclose=()=>{clearInterval(heartbeat);if(!stopped)schedule();};
    // A connection may open without successfully joining; do not leave a false connected indicator.
    const joinDeadline=setTimeout(()=>{if(!joined&&socket?.readyState<2)socket.close();},20000);
    const previousClose=socket.onclose;socket.onclose=event=>{clearTimeout(joinDeadline);previousClose(event);};
  }
  function schedule(){if(stopped)return;clearTimeout(retryTimer);const delay=Math.min(30000,1500*2**Math.min(attempt++,5));setStatus('retrying','Reconnecting to Twitch…');retryTimer=setTimeout(connect,delay);}
  connect();return {stop(){stopped=true;clearTimeout(retryTimer);clearInterval(heartbeat);socket?.close();}};
}
