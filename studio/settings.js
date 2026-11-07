/* Project connection settings. Secrets are never returned to the renderer. */
(() => {
  let current, projectRoot, edited=false, busy=false, selected='streamelements';
  const error = message => {$('connection-error').textContent=message;};
  window.connectionSettingsDirty=()=>edited;
  window.connectionSettingsBusy=()=>busy;
  window.connectionProjectChanged=root=>{
    if(root===projectRoot)return;
    projectRoot=root;current=null;edited=false;selected='streamelements';
    $('donation-form').reset();$('donation-token').value='';$('donation-overlay').value='';error('');
    if(view==='settings')void load();
  };
  function updateMode() {
    const provider=current?.providers.find(value=>value.id===$('donation-provider').value);
    const mode=$('donation-mode').value;
    $('donation-token-label').hidden=mode!=='native';
    $('donation-overlay-label').hidden=mode!=='browser';
    $('donation-token-title').textContent=provider?.tokenLabel || 'Connection token';
    $('donation-dashboard').disabled=!provider?.dashboard || busy;
    $('donation-help').textContent=mode==='native'
      ? provider?.id==='streamelements' ? 'In StreamElements, open your channel account settings and show the JWT token. Studio verifies that it belongs to your connected Twitch channel. Run overlay after saving.' : 'In Streamlabs, open Settings > API Settings > API Tokens and copy the Socket API token. This feeds donations into your project alerts. Run overlay after saving.'
      : mode==='browser' ? 'Paste an alert/widget Browser Source URL, not the public donation page. After saving, copy it into a separate OBS Browser Source and use the provider dashboard to test it. These alerts use the provider’s visuals and do not update the project’s custom donation widgets.'
      : 'Stores a link you can copy and share with viewers. This does not connect live donation alerts.';
  }
  function fillDonation(id=selected) {
    if(!current)return;
    selected=id;
    $('donation-provider').value=id;
    const provider=current.providers.find(value=>value.id===id);
    const saved=current.donations.find(value=>value.id===id);
    const native=$('donation-mode').querySelector('[value=native]');native.disabled=!provider.native;native.hidden=!provider.native;
    $('donation-mode').value=saved?.mode || (provider.native?'native':'browser');
    $('donation-link').value=saved?.link || '';
    $('donation-token').value='';$('donation-overlay').value='';
    $('donation-token').placeholder=saved?.hasToken?'Token saved; leave blank to keep it':'Paste your '+(provider.tokenLabel || 'connection token');
    $('donation-overlay').placeholder=saved?.hasOverlay?'Alert URL saved; leave blank to keep it':'Paste your provider’s alert Browser Source URL';
    edited=false;updateMode();
  }
  function button(label, callback) {
    const element=document.createElement('button');element.type='button';element.textContent=label;
    element.onclick=()=>Promise.resolve().then(callback).catch(err=>error(err.message));return element;
  }
  function render(data) {
    if(data.root!==state?.root)return;
    current=data;
    $('connection-project').textContent=state.name;
    $('twitch-status').textContent=data.twitch.status;
    $('twitch-connect').textContent=data.twitch.connected?'Reconnect Twitch':'Connect Twitch';
    $('twitch-connect').disabled=busy||!!data.twitch.pending;
    $('twitch-check').disabled=busy||!data.twitch.connected||!!data.twitch.pending;
    $('twitch-disconnect').disabled=busy||!data.twitch.connected;
    $('twitch-pending').hidden=!data.twitch.pending;
    $('twitch-code').textContent=data.twitch.pending?.code || '';
    $('twitch-expiry').textContent=data.twitch.pending?.expiresAt?'Complete sign-in before '+new Date(data.twitch.pending.expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'.':'';
    $('saved-connections').replaceChildren();
    for(const saved of data.donations) {
      const provider=data.providers.find(value=>value.id===saved.id);
      const card=document.createElement('div');card.className='saved-connection';
      const title=document.createElement('strong');title.textContent=provider.name;
      const status=document.createElement('p');status.textContent=saved.status;
      card.append(title,status);
      if(saved.link)card.append(button('Copy donation link',async()=>{await call('connection-link',saved.id,'link');notice('Donation link copied');}));
      if(saved.hasOverlay)card.append(button('Copy OBS alert URL',async()=>{await call('connection-link',saved.id,'overlay');notice('Paste this URL into a separate OBS Browser Source.');}));
      card.append(button('Edit',async()=>{if(await settle()){fillDonation(saved.id);$('donation-form').scrollIntoView({block:'nearest'});}}));
      card.append(button('Disconnect',()=>perform(()=>call('connection-disconnect',saved.id),true)));
      $('saved-connections').append(card);
    }
  }
  async function load() {
    try {
      const requestedRoot=state.root;
      const data=await call('connections-state');
      if(state.root!==requestedRoot)return;
      render(data);
      if(!edited) {
        $('twitch-client-id').value=data.clientId;
        $('twitch-app-setup').open=!data.clientId;
        $('donation-provider').replaceChildren(...data.providers.map(provider=>new Option(provider.name,provider.id)));
        fillDonation();
      }
    } catch(err){error(err.message);}
  }
  async function perform(operation, refill=false) {
    if(busy)return;
    busy=true;error('');
    for(const element of $('settings-panel').querySelectorAll('button,input,select'))element.disabled=true;
    try {
      const data=await operation();
      if(data?.root===state.root){render(data);if(refill)fillDonation();}
      return data;
    } catch(err){error(err.message);throw err;}
    finally {
      busy=false;
      for(const element of $('settings-panel').querySelectorAll('button,input,select'))element.disabled=false;
      if(current){render(current);updateMode();}
    }
  }
  window.saveConnectionSettings=async()=>{
    if(!edited)return;
    if(!$('donation-form').reportValidity())throw Error('Enter a valid donation-page link.');
    await perform(()=>call('connection-save',{id:$('donation-provider').value,mode:$('donation-mode').value,
      link:$('donation-link').value,token:$('donation-token').value,overlay:$('donation-overlay').value}),true);
    notice('Connection saved for '+state.name);
  };
  async function settle() {
    if(!edited)return true;
    const choice=await call('resolve-close','donation connection settings');
    if(choice===2)return false;
    if(choice===0)await window.saveConnectionSettings();
    return true;
  }
  window.openConnectionSettings=()=>{void load();};
  $('donation-form').oninput=()=>{edited=true;};
  $('donation-form').onsubmit=event=>{event.preventDefault();window.saveConnectionSettings().catch(err=>error(err.message));};
  $('donation-mode').onchange=()=>{edited=true;updateMode();};
  $('donation-provider').onchange=async()=>{
    const requested=$('donation-provider').value;$('donation-provider').value=selected;
    try{if(await settle())fillDonation(requested);}catch(err){error(err.message);}
  };
  $('donation-provider').oninput=event=>event.stopPropagation();
  action('donation-dashboard',()=>call('connection-dashboard',$('donation-provider').value));
  action('twitch-developer',()=>call('twitch-developer'));
  action('twitch-connect',()=>perform(()=>call('twitch-connect',$('twitch-client-id').value)));
  action('twitch-check',()=>perform(()=>call('connections-check')));
  action('twitch-disconnect',()=>perform(()=>call('connection-disconnect','twitch')));
  action('twitch-browser',()=>call('twitch-browser'));
  action('twitch-cancel',()=>perform(()=>call('twitch-cancel')));
  window.studio.on(message=>{if(message.type==='connections')render(message);});
})();
