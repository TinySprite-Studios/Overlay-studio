import {connectStreamlabs} from './tss-streamlabs.mjs';
import {eventSettings, routeEvent, projectEvents, bindPowerUps, withPowerUpBindings} from './tss-events.mjs';
import { serveFile } from './public-files.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createPaintQueue, PAINT_REWARD, POWER_UP_REWARD, isColourPowerUp } from './tss-paint.mjs';

const studio = process.env.TSS_STUDIO_MANAGED ? await new Promise(resolve => process.once('message', resolve)) : null;
const root = process.env.TSS_PROJECT_ROOT || path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const connectionStatus = (provider, message) => process.send?.({type:'connection-status',provider,message});
const store = process.env.TSS_RUNTIME_STORE || path.join(process.env.LOCALAPPDATA || os.homedir(), 'TSS-Overlay');
fs.mkdirSync(store, { recursive: true });
const read = (name, fallback) => {
  if(studio && name==='credentials.json')return studio.twitch || {};
  if(studio && name.startsWith('streamelements-'))return {jwt:studio.donations?.streamelements?.mode==='native'?studio.donations.streamelements.token:''};
  try { return JSON.parse(fs.readFileSync(path.join(store, name))); } catch { return fallback; } };
const save = (name, value) => {
  if(studio && name==='credentials.json'){process.send?.({type:'credentials',credentials:value});return;}
  const dest = path.join(store, name);
  fs.writeFileSync(dest + '.tmp', JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(dest + '.tmp', dest);
};
const scopes = 'moderator:read:followers channel:read:subscriptions bits:read channel:read:redemptions';
let paint;
let credentials = read('credentials.json', {});
let activity = { follower: '', subscriber: '', cheerer: '', donator: '' };
let identity;
let powerUpBindings = {};
const liveEventSettings = () => withPowerUpBindings(eventSettings(root), powerUpBindings);
function rememberPowerUps(powerUps) {
  powerUpBindings = bindPowerUps(eventSettings(root), powerUps, powerUpBindings);
  const filename = `power-ups-${identity.user_id}.json`;
  save(filename, {...read(filename, {}), [root]: powerUpBindings});
}
const clients = new Set();
const publish = () => {
  save(`activity-${identity.user_id}.json`, activity);
  for (const client of clients) client.write(`data: ${JSON.stringify(activity)}\n\n`);
};
// Newest-first list of everything that happened, shown in Studio's Activity tab.
let feed = [];
const feedName = event => event.is_anonymous ? 'Anonymous' : event.user_name || event.from_broadcaster_user_name || '';
export function feedEntry(type, event, time = Date.now(), id = '') {
  const name = feedName(event);
  if (type === 'channel.follow') return name && {kind:'follow', name, detail:''};
  if (type === 'channel.subscribe') return name && {kind:'sub', name, detail:event.is_gift ? 'Received a gifted sub' : 'Subscribed'};
  if (type === 'channel.subscription.message') return name && {kind:'sub', name, detail:`Resubscribed, ${event.cumulative_months || 1} months`};
  if (type === 'channel.subscription.gift') return name && {kind:'gift', name, detail:`Gifted ${event.total || 1} sub${event.total > 1 ? 's' : ''}`};
  if (type === 'channel.cheer') return name && {kind:'cheer', name, detail:`${event.bits || 0} Bits`};
  if (type === 'channel.raid') return name && {kind:'raid', name, detail:`Raided with ${event.viewers || 0} viewers`};
  if (type === 'channel.custom_power_up_redemption.add' && event.status !== 'canceled') return name && {kind:'powerup', name, detail:event.custom_power_up?.title || 'Bits Power-up'};
  if (type === 'channel.channel_points_custom_reward_redemption.add' && event.status !== 'canceled') return name && {kind:'reward', name, detail:event.reward?.title || 'Channel point reward'};
  if (type === 'tip') { const alert = makeAlert('tip', event); return alert && {kind:'donation', name:alert.name, detail:alert.detail}; }
  return null;
}
function addFeed(type, event, time = Date.now(), id = '') {
  const entry = feedEntry(type, event);
  if (!entry) return;
  if (id && feed.some(item => item.id === id)) return;
  feed = [{id: id || `${time}-${Math.random().toString(36).slice(2, 8)}`, time, ...entry}, ...feed].slice(0, 200);
  try { save(`feed-${identity.user_id}.json`, feed); } catch {}
}
const notify = alert => {
  if (!alert) return;
  for (const client of clients) client.write(`event: alert\ndata: ${JSON.stringify(alert)}\n\n`);
};
export function makeAlert(type, event) {
  const kind = { 'channel.follow': 'follow', 'channel.subscribe': 'sub',
    'channel.subscription.message': 'sub', 'channel.cheer': 'cheer', tip: 'donation' }[type];
  if (!kind) return null;
  const name = kind === 'donation' ? applyDonation({}, event).donator
    : event.is_anonymous ? 'Anonymous' : event.user_name;
  if (!name) return null;
  let detail = '';
  if (kind === 'cheer' && Number(event.bits) > 0) detail = `${event.bits} Bits`;
  if (kind === 'sub') detail = event.is_gift ? 'Gifted subscription' :
    type === 'channel.subscription.message' ? `${event.cumulative_months || 1} months subscribed` : 'Welcome to the community';
  if (kind === 'donation') {
    const amount = Number(event.data?.amount);
    const currency = event.data?.currency;
    if (Number.isFinite(amount) && amount > 0) {
      try { detail = new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount); }
      catch { detail = String(amount); }
    }
  }
  return { kind, name: String(name), detail };
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(`Twitch ${response.status}: ${data.message || data.error || 'request failed'}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
const tokenRequest = params => request('https://id.twitch.tv/oauth2/token', {
  method: 'POST', body: new URLSearchParams({ client_id: credentials.clientId, ...params })
});
async function authorize() {
  if(studio)throw Error('Reconnect Twitch in Studio Settings before running the overlay.');
  const device = await request('https://id.twitch.tv/oauth2/device', {
    method: 'POST', body: new URLSearchParams({ client_id: credentials.clientId, scopes })
  });
  console.log('\nOpen this Twitch link and authorize with your STREAMING account:');
  console.log(device.verification_uri);
  console.log(`Code: ${device.user_code}`);
  const expires = Date.now() + device.expires_in * 1000;
  let delay = Math.max(5, device.interval || 5) * 1000;
  while (Date.now() < expires) {
    await pause(delay);
    try {
      const tokens = await tokenRequest({ device_code: device.device_code, scopes,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
      credentials = { clientId: credentials.clientId, ...tokens };
      save('credentials.json', credentials);
      return;
    } catch (error) {
      if (/authorization_pending/i.test(error.message)) continue;
      if (/slow_down/i.test(error.message)) { delay += 5000; continue; }
      throw error;
    }
  }
  throw new Error('Twitch authorization expired. Restart the helper to try again.');
}
let refreshing;
async function refresh() {
  if (!refreshing) refreshing = (async () => {
    const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token });
    credentials = { ...credentials, ...tokens };
    save('credentials.json', credentials);
  })().finally(() => { refreshing = undefined; });
  return refreshing;
}
async function validate() {
  return request('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${credentials.access_token}` }
  });
}
async function api(endpoint, options = {}, retry = true) {
  try {
    return await request('https://api.twitch.tv/helix/' + endpoint, {
      ...options, headers: { Authorization: `Bearer ${credentials.access_token}`,
        'Client-Id': credentials.clientId, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error.status === 401 && retry) { await refresh(); return api(endpoint, options, false); }
    throw error;
  }
}
const seen = new Set();
export function applyEvent(state, type, event) {
  if (type === 'channel.cheer') {
    const name = event.is_anonymous ? 'Anonymous' : event.user_name;
    return name ? { ...state, cheerer: name } : state;
  }
  // Bits spent on Power-ups count the same as cheers: both show as the recent bits name.
  if (type === 'channel.custom_power_up_redemption.add') {
    return event.status !== 'canceled' && typeof event.user_name === 'string' && event.user_name.trim() ? { ...state, cheerer: event.user_name } : state;
  }
  if (typeof event.user_name !== 'string' || !event.user_name.trim()) return state;
  if (type === 'channel.follow') return { ...state, follower: event.user_name };
  if (type === 'channel.subscribe' || type === 'channel.subscription.message') {
    return { ...state, subscriber: event.user_name };
  }
  return state;
}
export function applyDonation(state, event) {
  if (event?.type !== 'tip' || event.isMock || event.is_test || event.isTest) return state;
  const data = event.data || {};
  const name = data.displayName || data.username || data.name;
  return typeof name === 'string' && name.trim() ? { ...state, donator: name.trim() } : state;
}
export function importHistory(state, events) {
  let next = state;
  for (const event of [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
    if (event.isMock || event.is_test || event.isTest) continue;
    const key = { tip: 'donator', subscriber: 'subscriber', cheer: 'cheerer' }[event.type];
    const time = Date.parse(event.createdAt);
    if (!key || !Number.isFinite(time) || time <= (next._updated?.[key] || 0)) continue;
    if (key !== 'donator' && event.provider !== 'twitch') continue;
    const data = event.data || {};
    const name = data.isAnonymous || data.is_anonymous ? 'Anonymous' : data.displayName || data.username || data.name;
    if (typeof name !== 'string' || !name.trim()) continue;
    next = { ...next, [key]: name.trim(), _updated: { ...next._updated, [key]: time } };
  }
  return next;
}
export function importSession(state, session) {
  const data = session?.data || {};
  let next = state;
  for (const [type, key] of [['subscriber', 'subscriber'], ['cheer', 'cheerer'], ['tip', 'donator']]) {
    const recent = Array.isArray(data[type + '-recent']) ? data[type + '-recent'] : [];
    next = importHistory(next, recent.map(row => ({
      type, provider: 'twitch', createdAt: row.createdAt, data: row
    })));
    // Undated latest values may fill blanks, but must not replace saved live events.
    const name = data[type + '-latest']?.name;
    if (!next[key] && typeof name === 'string' && name.trim()) next = { ...next, [key]: name.trim() };
  }
  return next;
}
async function streamElementsApi(token, endpoint) {
  const response = await fetch('https://api.streamelements.com/kappa/v2/' + endpoint, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`StreamElements returned HTTP ${response.status}. Check your JWT token in setup-overlay.cmd.`);
  return response.json();
}
async function streamElementsChannel(token) {
  const channel = await streamElementsApi(token, 'channels/me');
  if (channel.provider !== 'twitch' || String(channel.providerId) !== identity.user_id) {
    throw new Error('Use the StreamElements JWT for the same Twitch channel as the overlay.');
  }
  return channel._id;
}
async function connectStreamElements() {
  const settings = read(`streamelements-${identity.user_id}.json`, {});
  if (!settings.jwt) {
    if(!studio)console.log('StreamElements is not configured. Run setup-overlay.cmd to connect donations and import recent activity.');
    return;
  }
  const channelId = await streamElementsChannel(settings.jwt);
  async function history() {
    try {
      const result = await streamElementsApi(settings.jwt, `activities/${encodeURIComponent(channelId)}?limit=100`);
      const rows = Array.isArray(result) ? result : result.activities || result.docs || result.data;
      if (!Array.isArray(rows)) throw new Error('Unexpected activity response');
      activity = importHistory(activity, rows);
      publish();
      console.log(`StreamElements activity feed returned ${rows.length} events.`);
    } catch (_) { console.error('StreamElements activity feed unavailable; checking saved session data.'); }
    try {
      const session = await streamElementsApi(settings.jwt, `sessions/${encodeURIComponent(channelId)}`);
      activity = importSession(activity, session);
      publish();
      for (const key of ['subscriber', 'cheerer', 'donator']) {
        console.log(`Latest ${key}: ${activity[key] || 'No saved name available from StreamElements'}`);
      }
    } catch (_) { console.error('StreamElements session data unavailable; keeping saved names.'); }
  }
  let attempts = 0;
  function open() {
    const socket = new WebSocket('wss://astro.streamelements.com/');
    const timeout = setTimeout(() => socket.close(), 20000);
    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'welcome') {
          clearTimeout(timeout);
          socket.send(JSON.stringify({ type: 'subscribe', nonce: 'tss-tips', data: {
            topic: 'channel.activities', room: channelId, token: settings.jwt, token_type: 'jwt'
          } }));
        } else if (message.type === 'response') {
          if (message.error) {connectionStatus('streamelements','Connection rejected. Reconnect StreamElements in Settings.');console.error('StreamElements subscription rejected. Check the connection token.');}
          else {
            attempts = 0;
            console.log('StreamElements connected: listening for donations.');
            connectionStatus('streamelements','Connected: listening for donations.');
            void history();
          }
        } else if (message.type === 'message' && message.topic === 'channel.activities') {
          const event = message.data;
          const time = Date.parse(event?.createdAt || message.ts);
          if (Number.isFinite(time) && time <= (activity._updated?.donator || 0)) return;
          const next = applyDonation(activity, event);
          if (next !== activity) {
            activity = { ...next, _updated: { ...next._updated, donator: Number.isFinite(time) ? time : Date.now() } };
            publish();
            addFeed('tip', event, Number.isFinite(time) ? time : Date.now(), event?._id || '');
            notify(makeAlert('tip', event));
          }
        } else if (message.type === 'reconnect') socket.close();
      } catch (_) { console.error('Could not process a StreamElements event.'); }
    };
    socket.onerror = () => {connectionStatus('streamelements','Connection interrupted. Retrying...');console.error('StreamElements connection interrupted; retrying.');};
    socket.onclose = () => {
      clearTimeout(timeout);
      setTimeout(open, Math.min(30000, 2000 * 2 ** Math.min(attempts++, 4)));
    };
  }
  open();
}
async function setup() {
  console.log('\nInitial names: enter the last known names from your activity history.');
  console.log('Enter keeps the saved value; a single - clears it. New live events replace these names.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  for (const key of ['subscriber', 'cheerer', 'donator']) {
    const answer = (await prompt.question(`Last ${key} [${activity[key] || 'blank'}]: `)).trim();
    if (answer) { activity[key] = answer === '-' ? '' : answer.slice(0, 150); activity._updated = { ...activity._updated, [key]: answer === '-' ? 0 : Date.now() }; }
  }
  prompt.close();
  const filename = `streamelements-${identity.user_id}.json`;
  const settings = read(filename, {});
  console.log('\nStreamElements dashboard > account > Channels > Show Secrets > JWT Token.');
  console.log('Paste locally below. Input is hidden. Enter keeps the token; - disconnects StreamElements.');
  const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const secretPrompt = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write('StreamElements JWT Token: ');
  const token = (await secretPrompt.question('')).trim();
  secretPrompt.close();
  console.log();
  if (token && token !== '-') await streamElementsChannel(token);
  if (token) settings.jwt = token === '-' ? '' : token;
  save(filename, settings);
  publish();
  console.log('Setup saved locally. Start start-twitch.cmd to run the overlay.');
}
// Optional project extension: <project>/tss-project.mjs. It keeps project-only features
// (such as sprite care) in the project, not in Studio. See docs/project-hook.md.
let hook = null;
const sseName = name => String(name).replace(/[^\w-]/g, '');
async function loadHook() {
  const file = path.join(root, 'tss-project.mjs');
  if (!fs.existsSync(file)) return;
  try {
    const module = await import(pathToFileURL(file).href + '?t=' + fs.statSync(file).mtimeMs);
    const setup = module.default || module.setup;
    if (typeof setup !== 'function') throw new Error('it must export a default function');
    hook = await setup({
      root, userId: identity.user_id, login: identity.login,
      read: name => read(`project-${name}-${identity.user_id}.json`, {}),
      save: (name, value) => save(`project-${name}-${identity.user_id}.json`, value),
      emit: (name, data) => { for (const client of clients) client.write(`event: ${sseName(name)}\ndata: ${JSON.stringify(data)}\n\n`); },
      twitch: endpoint => api(endpoint),
      log: (...parts) => console.log('[project]', ...parts)
    }) || null;
    console.log('Project extension loaded: tss-project.mjs');
  } catch (error) { hook = null; console.error('Project extension tss-project.mjs failed to load: ' + error.message); }
}
async function callHook(name, ...args) {
  try { return await hook?.[name]?.(...args); } catch (error) { console.error(`Project extension ${name}: ${error.message}`); }
}
let activeSocket;
function connect(url = 'wss://eventsub.wss.twitch.tv/ws', previous = null) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'wss:' || endpoint.hostname !== 'eventsub.wss.twitch.tv') throw new Error('Unexpected Twitch reconnect URL');
  const socket = new WebSocket(url);
  let watchdog, transferred = false, timeout = 20000;
  const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => socket.close(), timeout); };
  arm();
  socket.onmessage = async ({ data }) => {
    try {
      const message = JSON.parse(data);
      arm();
      const { metadata, payload } = message;
      if (metadata.message_type === 'session_welcome') {
        activeSocket = socket;
        connectionStatus('twitch','Connected as '+identity.login+'; listening for stream events.');
        timeout = ((payload.session.keepalive_timeout_seconds || 30) + 10) * 1000;
        arm();
        if (previous) { previous.close(); return; }
        for (const [type, version] of [['channel.follow','2'], ['channel.subscribe','1'], ['channel.subscription.message','1'], ['channel.cheer','1'], ['channel.subscription.gift','1'], ['channel.raid','1'], ...(hook?.subscriptions || []), ['channel.channel_points_custom_reward_redemption.add','1'], ['channel.custom_power_up_redemption.add','1']]) {
          try {
            await api('eventsub/subscriptions', { method: 'POST', body: JSON.stringify({
              type, version, condition: {
                ...(type === 'channel.raid' ? { to_broadcaster_user_id: identity.user_id } : { broadcaster_user_id: identity.user_id }),
                ...(type === 'channel.follow' ? { moderator_user_id: identity.user_id } : {}) },
              transport: { method: 'websocket', session_id: payload.session.id }
            }) });
            console.log(`Listening: ${type}`);
          } catch (error) { console.error(`${type}: ${error.message}. Restart after resolving this error.`); }
        }
      } else if (metadata.message_type === 'session_reconnect') {
        transferred = true;
        connect(payload.session.reconnect_url, socket);
      } else if (metadata.message_type === 'notification' && !seen.has(metadata.message_id)) {
        seen.add(metadata.message_id);
        if (seen.size > 1000) seen.delete(seen.values().next().value);
        console.log(`Twitch event: ${payload.subscription.type} from ${feedName(payload.event) || 'unknown'}`);
        addFeed(payload.subscription.type, payload.event, Date.parse(metadata.message_timestamp) || Date.now(), metadata.message_id);
        if (payload.event.custom_power_up) rememberPowerUps([payload.event.custom_power_up]);
        for (const data of projectEvents(payload.subscription.type, payload.event, liveEventSettings())) {
          for (const client of clients) client.write(`event: project-event\ndata: ${JSON.stringify(data)}\n\n`);
        }
        if (['channel.custom_power_up_redemption.add', 'channel.channel_points_custom_reward_redemption.add'].includes(payload.subscription.type)) {
          payload.event = routeEvent(payload.event, liveEventSettings());
        }
        if (hook && await callHook('onEvent', payload.subscription.type, payload.event, metadata) === 'handled') return;
        if (payload.subscription.type === 'channel.custom_power_up_redemption.add') {
          const event = payload.event;
          const bits = applyEvent(activity, payload.subscription.type, event);
          if (bits !== activity) {
            activity = { ...bits, _updated: { ...activity._updated, cheerer: Date.parse(metadata.message_timestamp) || Date.now() } };
            publish();
          }
          if (!isColourPowerUp(event) || event.status === 'canceled') return;
          if (paint.add(event)) console.log(`${event.custom_power_up.title}: colour change scheduled.`);
          return;
        }
        if (payload.subscription.type === 'channel.channel_points_custom_reward_redemption.add') {
          if (paint.add(payload.event)) console.log('Paint the Stream: colour change scheduled.');
          return;
        }
        const next = applyEvent(activity, payload.subscription.type, payload.event);
        const key = { 'channel.follow': 'follower', 'channel.subscribe': 'subscriber',
          'channel.subscription.message': 'subscriber', 'channel.cheer': 'cheerer' }[payload.subscription.type];
        if (next !== activity && key) next._updated = { ...activity._updated, [key]: Date.parse(metadata.message_timestamp) || Date.now() };
        activity = next;
        publish();
        notify(makeAlert(payload.subscription.type, payload.event));
      } else if (metadata.message_type === 'revocation') {
        console.error(`Twitch revoked ${payload.subscription.type}: ${payload.subscription.status}. Restart and reconnect your account.`);
      }
    } catch (error) { console.error(error.message); }
  };
  socket.onerror = () => console.error('Twitch socket interrupted; retrying when closed.');
  socket.onclose = () => {
    clearTimeout(watchdog);
    if (!transferred && (!activeSocket || activeSocket === socket || previous === activeSocket)) {
      if (previous) previous.close();
      activeSocket = null;
      setTimeout(() => connect(), 5000);
    }
  };
}
async function main() {
  // Do not change credentials or saved names underneath an already-running helper.
  await new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', () => reject(new Error('Close the running overlay helper first, then try again (port 8787 is in use).')));
    probe.listen(8787, '127.0.0.1', () => probe.close(resolve));
  });
  if (studio && !credentials.access_token) throw Error('Connect Twitch in Studio Settings first.');
  if (!credentials.clientId) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    credentials.clientId = (await prompt.question('Paste your Twitch PUBLIC application Client ID: ')).trim();
    prompt.close();
    if (!/^[a-z0-9]+$/i.test(credentials.clientId)) throw new Error('A valid Twitch Client ID is required.');
  }
  if (!credentials.access_token) await authorize();
  try { identity = await validate(); }
  catch (error) {
    if (error.status !== 401) throw error;
    try { await refresh(); } catch { await authorize(); }
    identity = await validate();
  }
  if (identity.client_id !== credentials.clientId || scopes.split(' ').some(scope => !identity.scopes.includes(scope))) {
    await authorize(); identity = await validate();
  }
  activity = { ...activity, ...read(`activity-${identity.user_id}.json`, {}) };
  feed = read(`feed-${identity.user_id}.json`, []);
  if (!Array.isArray(feed)) feed = [];
  if (studio) {
    // Projects connected in Studio use their own store; carry over names saved by the older helper.
    try {
      const old = JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA || os.homedir(), 'TSS-Overlay', `activity-${identity.user_id}.json`)));
      for (const key of ['follower', 'subscriber', 'cheerer', 'donator']) {
        if (!activity[key] && typeof old[key] === 'string' && old[key]) {
          activity[key] = old[key].slice(0, 150);
          activity._updated = { ...activity._updated, [key]: old._updated?.[key] || 1 };
        }
      }
    } catch {}
  }
  if (process.argv.includes('--setup')) { await setup(); return; }
  powerUpBindings = read(`power-ups-${identity.user_id}.json`, {})[root] || {};
  try {
    const result = await api(`bits/custom_power_ups?broadcaster_id=${identity.user_id}`);
    rememberPowerUps(result.data);
    console.log('Twitch Power-up IDs synced; linked events survive name changes.');
  } catch (error) { console.error(`Power-up sync failed: ${error.message}. Saved IDs remain active; unlinked events require matching names.`); }
  paint = createPaintQueue(read(`paint-${identity.user_id}.json`, {}), {
    settings: () => eventSettings(root),
    persist: state => save(`paint-${identity.user_id}.json`, state),
    publish: state => {
      for (const client of clients) client.write(`event: paint\ndata: ${JSON.stringify(state)}\n\n`);
    }
  });
  paint.tick();
  setInterval(() => paint.tick(), 250);
  console.log(`Channel points: listening for "${PAINT_REWARD}". Colours last 2 minutes; unknown colours use purple.`);
  console.log(`Bits Power-up: listening for "${POWER_UP_REWARD}". Each colour lasts 1 hour; queued in purchase order.`);
  console.log('Bits Power-up: PRO+24 lasts 24 hours; queued in purchase order.');
  if (!activity.subscriber || !activity.cheerer) {
    console.log('Previous subs/cheers cannot be retrieved chronologically from Twitch. Run setup-overlay.cmd to enter initial names, or wait for new events.');
  }
  try {
    const followers = await api(`channels/followers?broadcaster_id=${identity.user_id}&first=10`);
    activity.follower = followers.data[0]?.user_name || '';
    publish();
    for (const row of [...(followers.data || [])].reverse()) {
      if (!feed.length && row.user_name) addFeed('channel.follow', row, Date.parse(row.followed_at) || Date.now(), 'follow-' + row.user_id);
    }
  } catch (error) { console.error('Latest follower lookup: ' + error.message); }
  const server = http.createServer((req, res) => {
    if (req.headers.host === '127.0.0.1:8787' && req.method === 'POST' && req.url === '/control/paint') {
      if (req.headers.origin || req.headers['x-tss-control'] !== 'studio' || req.headers['content-type'] !== 'application/json') { res.writeHead(403).end(); return; }
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        try {
          const { colour, minutes } = JSON.parse(body);
          const state = paint.force(colour, minutes);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(state));
        } catch (error) { res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message })); }
      });
      return;
    }
    if (req.headers.host !== '127.0.0.1:8787' || req.method !== 'GET') { res.writeHead(403).end(); return; }
    const pathname = new URL(req.url, 'http://127.0.0.1:8787').pathname;
    if (pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(activity)}\n\n`);
      res.write(`event: paint\ndata: ${JSON.stringify(paint.tick())}\n\n`);
      try { for (const [name, data] of hook?.initial?.() || []) res.write(`event: ${sseName(name)}
data: ${JSON.stringify(data)}

`); } catch {}
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    serveFile(req,res,root);
  });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 8787 is in use. Close the other helper first.' : error.message); process.exit(1); });
  server.listen(8787, '127.0.0.1', () => console.log(`\nConnected as ${identity.login}.\nOBS Browser Source: http://127.0.0.1:8787/overlays/overlay-horizontal.html\nKeep this window open while streaming. Ctrl+C stops it.`));
  setInterval(() => { for (const client of clients) client.write(': keepalive\n\n'); }, 15000);
  setInterval(async () => {
    try { const status = await validate(); if (status.expires_in < 4000) await refresh(); }
    catch (error) {
      if (error.status === 401) {
        try { await refresh(); } catch { console.error('Twitch authorization expired. Restart to sign in again.'); activeSocket?.close(); process.exit(1); }
      } else console.error('Twitch validation temporarily unavailable.');
    }
  }, 55 * 60 * 1000);
  await loadHook();
  connect();
  void connectStreamElements().catch(error => {connectionStatus('streamelements','Could not connect. Check the saved token.');console.error(error.message);});
  const streamlabs=studio?.donations?.streamlabs;
  if(streamlabs?.mode==='native'&&streamlabs.token)connectStreamlabs(streamlabs.token,{
    status:message=>connectionStatus('streamlabs',message),
    donation:event=>{activity={...applyDonation(activity,event),_updated:{...activity._updated,donator:Date.now()}};publish();addFeed('tip',event);notify(makeAlert('tip',event));}
  });
  if(studio)process.on('disconnect',()=>process.exit(0));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
