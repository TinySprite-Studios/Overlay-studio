const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const scopes = 'moderator:read:followers channel:read:subscriptions bits:read channel:read:redemptions';
const providers = [
  {id:'streamelements', name:'StreamElements', native:true, dashboard:'https://streamelements.com/dashboard/account/channels', tokenLabel:'JWT token'},
  {id:'streamlabs', name:'Streamlabs', native:true, dashboard:'https://streamlabs.com/dashboard#/settings/api-settings', tokenLabel:'Socket API token'},
  {id:'kofi', name:'Ko-fi', dashboard:'https://ko-fi.com/manage/streamalerts'},
  {id:'buymeacoffee', name:'Buy Me a Coffee', dashboard:'https://buymeacoffee.com/dashboard'},
  {id:'donationalerts', name:'DonationAlerts', dashboard:'https://www.donationalerts.com/dashboard'},
  {id:'tipeeestream', name:'TipeeeStream', dashboard:'https://www.tipeeestream.com/dashboard/'},
  {id:'tiltify', name:'Tiltify', dashboard:'https://tiltify.com/dashboard'},
  {id:'extralife', name:'Extra Life', dashboard:'https://www.extra-life.org/'},
  {id:'fourthwall', name:'Fourthwall', dashboard:'https://fourthwall.com/'},
  {id:'streamloots', name:'Streamloots', dashboard:'https://www.streamloots.com/'},
  {id:'patreon', name:'Patreon', dashboard:'https://www.patreon.com/'},
  {id:'paypal', name:'PayPal', dashboard:'https://www.paypal.com/'},
  {id:'other', name:'Other platform', dashboard:null}
];
function httpsURL(value) {
  if (!value) return '';
  let url;
  try {url = new URL(String(value).trim());} catch {throw Error('Enter a complete HTTPS link.');}
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 4096) throw Error('Use an HTTPS link without a username or password.');
  return url.href;
}
function createConnections({directory, encryption, fetcher = fetch, openBrowser, send = () => {}, defaultClientId = '', pollDelay = 5000, verifyStreamlabs}) {
  let pending;
  const statuses = new Map();
  const projectKey = root => crypto.createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex');
  const filename = root => path.join(directory, projectKey(root), 'connections.bin');
  function read(root) {
    if (!fs.existsSync(filename(root))) return {donations:{}};
    try {return JSON.parse(encryption.decryptString(fs.readFileSync(filename(root))));}
    catch {throw Error('Saved connections could not be opened for this Windows account.');}
  }
  function write(root, data) {
    if (!encryption.isEncryptionAvailable()) throw Error('Windows credential encryption is unavailable. Connections were not saved.');
    const file = filename(root);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file + '.tmp', encryption.encryptString(JSON.stringify(data)));
    fs.renameSync(file + '.tmp', file);
  }
  function state(root) {
    const data = read(root), flow = pending?.root === root ? pending.public : null;
    return {root, providers, clientId:data.twitch?.clientId || defaultClientId,
      twitch:{connected:!!data.twitch?.access_token, login:data.twitch?.login || '', pending:flow,
        status:statuses.get(root)?.twitch || (data.twitch?.access_token ? 'Saved connection. Run overlay to receive events.' : 'Not connected')},
      donations:Object.entries(data.donations || {}).map(([id, value]) => ({id, mode:value.mode, link:value.link,
        hasToken:!!value.token, hasOverlay:!!value.overlay, account:value.account || '',
        status:statuses.get(root)?.[id] || (value.mode === 'native' ? 'Verified and saved. Run overlay to listen.' : value.mode === 'browser' ? 'Browser alert URL saved. Add it as a separate OBS Browser Source.' : 'Donation link saved. Live alerts are not connected.')}))};
  }
  function publish(root) {send({type:'connections', ...state(root)});}
  function runtimeStatus(root, provider, message) {
    if (!['twitch', 'streamelements', 'streamlabs'].includes(provider)) return;
    statuses.set(root, {...statuses.get(root), [provider]:message});publish(root);
  }
  async function request(url, options = {}) {
    const response = await fetcher(url, {...options, signal:options.signal || AbortSignal.timeout(15000)});
    let data = {};try {data = await response.json();} catch {}
    if (!response.ok) {
      const error = Error('Connection request failed (' + response.status + ').');
      error.status = response.status;error.code = String(data.message || data.error || '');throw error;
    }
    return data;
  }
  async function validate(credentials) {
    const identity = await request('https://id.twitch.tv/oauth2/validate', {headers:{Authorization:'OAuth '+credentials.access_token}});
    if (identity.client_id !== credentials.clientId || !identity.user_id || scopes.split(' ').some(scope => !identity.scopes?.includes(scope))) throw Error('Twitch did not grant the required channel permissions. Reconnect and approve them.');
    return identity;
  }
  function cancel() {
    if (!pending) return;
    const flow = pending;pending = null;flow.controller.abort();flow.wake?.();publish(flow.root);
  }
  async function connect(root, clientId) {
    clientId = String(clientId || defaultClientId).trim();
    if (!/^[a-z0-9]{8,128}$/i.test(clientId)) throw Error('A public Twitch application Client ID is needed. Open the Twitch app setup section.');
    cancel();
    const flow = {root, controller:new AbortController(), public:{status:'Preparing Twitch sign-in...'}};
    pending = flow;
    try {
      const device = await request('https://id.twitch.tv/oauth2/device', {method:'POST', body:new URLSearchParams({client_id:clientId, scopes}), signal:AbortSignal.any([flow.controller.signal,AbortSignal.timeout(15000)])});
      if (pending !== flow) return state(root);
      const url = new URL(device.verification_uri);
      if (url.protocol !== 'https:' || !['www.twitch.tv','twitch.tv','id.twitch.tv'].includes(url.hostname)) throw Error('Twitch returned an unexpected sign-in address.');
      flow.public = {code:String(device.user_code), expiresAt:Date.now() + Number(device.expires_in)*1000, status:'Approve the connection in your browser.'};
      flow.url = url.href;
      await openBrowser(flow.url);
      publish(root);
      void poll(flow, clientId, device);
      return state(root);
    } catch (error) {if (pending === flow) pending = null;throw error;}
  }
  async function poll(flow, clientId, device) {
    let delay = Math.max(pollDelay, Number(device.interval || 5)*1000);
    try {
      while (pending === flow && Date.now() < flow.public.expiresAt) {
        await new Promise(resolve => {const timer=setTimeout(resolve,delay);timer.unref?.();flow.wake=()=>{clearTimeout(timer);resolve();};});
        if (pending !== flow) return;
        try {
          const tokens = await request('https://id.twitch.tv/oauth2/token', {method:'POST', body:new URLSearchParams({client_id:clientId,device_code:device.device_code,scopes,grant_type:'urn:ietf:params:oauth:grant-type:device_code'}),signal:AbortSignal.any([flow.controller.signal,AbortSignal.timeout(15000)])});
          const credentials = {clientId, ...tokens};
          const identity = await validate(credentials);
          if (pending !== flow) return;
          const data = read(flow.root);
          // A different Twitch account must reconnect channel-specific donation tokens.
          if ((data.twitch?.userId || data.previousUserId) && (data.twitch?.userId || data.previousUserId) !== identity.user_id) {
            for (const [id,value] of Object.entries(data.donations)) if(value.mode === 'native') {
              if(value.link)data.donations[id]={mode:'link',link:value.link};
              else delete data.donations[id];
            }
          }
          data.twitch = {...credentials,login:identity.login,userId:identity.user_id};
          write(flow.root,data);pending=null;statuses.delete(flow.root);runtimeStatus(flow.root,'twitch','Connected as '+identity.login);return;
        } catch (error) {
          if (/authorization_pending/i.test(error.code)) continue;
          if (/slow_down/i.test(error.code)) {delay+=5000;continue;}
          throw Error('Twitch sign-in was declined or failed. Try connecting again.');
        }
      }
      if (pending === flow) throw Error('Twitch sign-in expired. Try connecting again.');
    } catch (error) {
      if (pending !== flow) return;
      pending=null;runtimeStatus(flow.root,'twitch',error.message);
    }
  }
  async function check(root) {
    const data=read(root);
    if (!data.twitch?.access_token) return state(root);
    try {
      let identity;
      try {identity=await validate(data.twitch);} catch(error) {
        if(error.status!==401)throw error;
        const tokens=await request('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:data.twitch.clientId,grant_type:'refresh_token',refresh_token:data.twitch.refresh_token})});
        data.twitch={...data.twitch,...tokens};identity=await validate(data.twitch);
      }
      data.twitch={...data.twitch,login:identity.login,userId:identity.user_id};write(root,data);
      runtimeStatus(root,'twitch','Connected as '+identity.login);
    } catch {runtimeStatus(root,'twitch','Could not verify Twitch. Check your connection or reconnect your account.');}
    return state(root);
  }
  async function saveDonation(root, input) {
    const provider=providers.find(provider=>provider.id===input.id);
    if(!provider)throw Error('Choose a donation platform.');
    if(!['link','browser','native'].includes(input.mode) || (input.mode==='native'&&!provider.native))throw Error('Choose a supported connection method.');
    const data=read(root), previous=data.donations[input.id] || {};
    const value={mode:input.mode,link:httpsURL(input.link),overlay:'',token:'',account:''};
    if(value.mode==='link'&&!value.link)throw Error('Enter your donation-page link.');
    if(value.mode==='browser') {
      value.overlay=httpsURL(input.overlay || previous.overlay);
      if(!value.overlay)throw Error('Paste the alert Browser Source URL from your provider.');
    }
    if(value.mode==='native') {
      value.token=String(input.token || previous.token || '').trim();
      if(!value.token || value.token.length>8192)throw Error('Enter the provider connection token.');
      if(input.id==='streamelements') {
        if(!data.twitch?.userId)throw Error('Connect Twitch first so we can check the donation channel matches.');
        const channel=await request('https://api.streamelements.com/kappa/v2/channels/me',{headers:{Authorization:'Bearer '+value.token}});
        if(channel.provider!=='twitch'||String(channel.providerId)!==data.twitch.userId)throw Error('Use the StreamElements account belonging to this project\'s Twitch channel.');
        value.account=String(channel.username || channel.displayName || channel._id);
      } else {
        if(verifyStreamlabs)await verifyStreamlabs(value.token);
        else await (await import('../scripts/tss-streamlabs.mjs')).checkToken(value.token);
      }
    }
    data.donations[input.id]=value;write(root,data);
    const status=statuses.get(root);if(status)delete status[input.id];
    return state(root);
  }
  function disconnect(root, provider) {
    const data=read(root);
    if(provider==='twitch') {cancel();data.previousUserId=data.twitch?.userId || data.previousUserId;delete data.twitch;}
    else if(providers.some(value=>value.id===provider))delete data.donations[provider];
    else throw Error('Unknown connection.');
    const status=statuses.get(root);if(status)delete status[provider];write(root,data);return state(root);
  }
  return {state,read,connect,cancel,check,saveDonation,disconnect,runtimeStatus,
    configured:root=>fs.existsSync(filename(root)),
    runtimeFolder:root=>path.join(directory,projectKey(root),'runtime'),
    reopen:async root=>{if(pending?.root!==root||!pending.url)throw Error('Start Twitch sign-in first.');await openBrowser(pending.url);},
    saveTokens(root,tokens) {const data=read(root);if(data.twitch?.clientId===tokens.clientId){data.twitch={...data.twitch,...tokens};write(root,data);}}
  };
}
module.exports = {createConnections, providers, scopes, httpsURL};
