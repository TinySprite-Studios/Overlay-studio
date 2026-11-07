import fs from 'node:fs';
import path from 'node:path';

export function eventSettings(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'tss-events.json'), 'utf8')); }
  catch { return {events: [], colours: {}}; }
}

// Keep handler IDs stable while streamers rename their Twitch rewards.
export function routeEvent(event, settings) {
  const field = event.custom_power_up ? 'custom_power_up' : 'reward';
  const trigger = field === 'reward' ? 'points' : 'bits';
  const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const title = normalize(event[field]?.title);
  const definitions = (settings.events || []).filter(item => item.trigger === trigger);
  const match = definitions.find(item => normalize(item.name) === title ||
    (item.name === item.canonical && item.aliases?.some(alias => normalize(alias) === title)));
  return {...event, [field]: {...event[field], title: match?.canonical || ''}};
}

// Project event IDs and values are shared by live delivery and Studio previews.
export function projectEvents(type, event, settings) {
  const trigger = type === 'channel.channel_points_custom_reward_redemption.add' ? 'points' :
    type === 'channel.custom_power_up_redemption.add' ? 'bits' : type;
  const title = String(event.reward?.title || event.custom_power_up?.title || '').trim().toLowerCase();
  if (event.status === 'canceled') return [];
  return (settings.events || []).filter(definition => definition.trigger === trigger &&
    (!['points', 'bits'].includes(trigger) || String(definition.name).trim().toLowerCase() === title))
    .map(definition => ({id:definition.id, name:event.user_name || event.user_login || '',
      values:Object.fromEntries((definition.fields || []).map(field => [field.key, definition.values?.[field.key] ?? field.default ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : '')])), event}));
}
