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
  if (!definitions.length) return event;
  const match = definitions.find(item => normalize(item.name) === title ||
    (item.name === item.canonical && item.aliases?.some(alias => normalize(alias) === title)));
  return {...event, [field]: {...event[field], title: match?.canonical || ''}};
}
