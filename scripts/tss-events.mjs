import fs from 'node:fs';
import path from 'node:path';

const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const matchesName = (item, title) => normalize(item.name) === normalize(title) ||
  (item.name === item.canonical && item.aliases?.some(alias => normalize(alias) === normalize(title)));

export function bindPowerUps(settings, powerUps, bindings = {}) {
  const next = {...bindings};
  for (const definition of settings.events || []) {
    if (definition.trigger !== 'bits' || Object.hasOwn(definition, 'twitchId') || next[definition.id]) continue;
    const matches = powerUps.filter(powerUp => powerUp.id && matchesName(definition, powerUp.title));
    if (matches.length === 1 && !Object.values(next).includes(matches[0].id)) next[definition.id] = matches[0].id;
  }
  return next;
}

export function withPowerUpBindings(settings, bindings) {
  return {...settings, events: (settings.events || []).map(event => event.trigger === 'bits'
    ? {...event, twitchId: event.twitchId ?? bindings[event.id]} : event)};
}

const matchesReward = (definition, event, reward) =>
  (!definition.twitchBroadcasterId || definition.twitchBroadcasterId === event.broadcaster_user_id) &&
  (definition.twitchId ? definition.twitchId === reward?.id : matchesName(definition, reward?.title));

export function eventSettings(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'tss-events.json'), 'utf8')); }
  catch { return {events: [], colours: {}}; }
}

// Keep handler IDs stable while streamers rename their Twitch rewards.
export function routeEvent(event, settings) {
  const field = event.custom_power_up ? 'custom_power_up' : 'reward';
  const trigger = field === 'reward' ? 'points' : 'bits';
  const definitions = (settings.events || []).filter(item => item.trigger === trigger);
  const match = definitions.find(item => matchesReward(item, event, event[field]));
  return {...event, [field]: {...event[field], title: match?.canonical || ''}};
}

// Project event IDs and values are shared by live delivery and Studio previews.
export function projectEvents(type, event, settings) {
  const trigger = type === 'channel.channel_points_custom_reward_redemption.add' ? 'points' :
    type === 'channel.custom_power_up_redemption.add' ? 'bits' : type;
  if (event.status === 'canceled') return [];
  return (settings.events || []).filter(definition => definition.trigger === trigger &&
    (!['points', 'bits'].includes(trigger) || matchesReward(definition, event, event.custom_power_up || event.reward)))
    .map(definition => ({id:definition.id, name:event.user_name || event.user_login || '',
      values:Object.fromEntries((definition.fields || []).map(field => [field.key, definition.values?.[field.key] ?? field.default ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : '')])), event}));
}
