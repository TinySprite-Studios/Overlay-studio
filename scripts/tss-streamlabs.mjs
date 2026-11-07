// Streamlabs documents Socket.IO 2 / Engine.IO 3 over WebSocket.
export function openSocket(token, {Socket = WebSocket, ready = () => {}, event = () => {}, closed = () => {}, error = () => {}} = {}) {
  const socket = new Socket('wss://sockets.streamlabs.com/socket.io/?EIO=3&transport=websocket&token='+encodeURIComponent(token));
  let pingTimer, pongTimer, connected=false;
  const timeout=setTimeout(()=>{error();socket.close();},15000);
  socket.onmessage = ({data}) => {
    try {
      const packet=String(data);
      if(packet.startsWith('0')) {
        const handshake=JSON.parse(packet.slice(1));
        pingTimer=setInterval(()=>{
          if(socket.readyState!==1)return;
          socket.send('2');
          pongTimer=setTimeout(()=>socket.close(),Math.max(1000,Number(handshake.pingTimeout)||20000));
        },Math.max(1000,Number(handshake.pingInterval)||25000));
      } else if(packet==='3')clearTimeout(pongTimer);
      else if(packet==='2')socket.send('3');
      else if(packet==='40') {clearTimeout(timeout);if(!connected){connected=true;ready();}}
      else if(packet.startsWith('44')) {error();socket.close();}
      else if(packet.startsWith('42')) {
        const [type,payload]=JSON.parse(packet.slice(2));
        if(type==='event')event(payload);
      }
    } catch {error();socket.close();}
  };
  socket.onerror=()=>error();
  socket.onclose=()=>{clearTimeout(timeout);clearInterval(pingTimer);clearTimeout(pongTimer);closed();};
  return ()=>{clearTimeout(timeout);clearInterval(pingTimer);clearTimeout(pongTimer);socket.onclose=null;socket.close();};
}
export function checkToken(token, options = {}) {
  return new Promise((resolve,reject)=>{
    let stop;
    const fail=()=>{stop?.();reject(Error('Streamlabs could not authenticate. Check the Socket API token and your connection.'));};
    stop=openSocket(token,{...options,ready:()=>{stop();resolve();},error:fail,closed:fail});
  });
}
export function donationEvents(payload) {
  if(payload?.type!=='donation'||payload.for||!Array.isArray(payload.message))return [];
  return payload.message.filter(value=>typeof value.name==='string'&&Number(value.amount)>0&&Number.isFinite(Number(value.amount)))
    .map(value=>({id:String(value.id || value._id || payload.event_id || ''),type:'tip',createdAt:new Date().toISOString(),
      data:{name:value.name,amount:Number(value.amount),currency:String(value.currency || '')}}));
}
export function connectStreamlabs(token, {donation, status = () => {}, Socket = WebSocket}) {
  let stopped=false,retryTimer,stopSocket,attempts=0;
  const seen=new Set();
  function open() {
    if(stopped)return;
    status('Connecting to Streamlabs...');
    stopSocket=openSocket(token,{Socket,
      ready:()=>{attempts=0;status('Connected: listening for donations.');},
      error:()=>status('Streamlabs connection failed. Check the token or network.'),
      event:payload=>{for(const event of donationEvents(payload)) {
        if(event.id&&seen.has(event.id))continue;
        if(event.id)seen.add(event.id);
        if(seen.size>1000)seen.delete(seen.values().next().value);
        donation(event);
      }},
      closed:()=>{if(!stopped){status('Streamlabs disconnected. Retrying...');retryTimer=setTimeout(open,Math.min(60000,2000*2**attempts++));}}
    });
  }
  open();return ()=>{stopped=true;clearTimeout(retryTimer);stopSocket?.();};
}
