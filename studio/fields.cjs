// Project-defined controls share one validation contract for events and scenes.
function values(fields = [], input = {}) {
  if (!Array.isArray(fields)) throw Error('Settings fields must be an array.');
  const result = {}, keys = new Set();
  for (const field of fields) {
    const {key, type = 'text'} = field;
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key) || keys.has(key)) throw Error('Each setting needs a unique key.');
    keys.add(key);
    let value = input[key] ?? field.default ?? (type === 'boolean' ? false : type === 'number' ? 0 : '');
    if (type === 'boolean') {
      if (typeof value !== 'boolean') throw Error(key + ' must be true or false.');
    } else if (type === 'number') {
      value = Number(value);
      if (!Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max)) throw Error(key + ' is outside its allowed range.');
    } else if (['text', 'textarea', 'color', 'select'].includes(type)) {
      value = String(value);
      if (field.required && !value.trim()) throw Error(key + ' is required.');
      if (value.length > (field.maxLength ?? 2000)) throw Error(key + ' is too long.');
      if (type === 'color' && !/^#[0-9a-f]{6}$/i.test(value)) throw Error(key + ' must be a hex colour.');
      if (type === 'select' && !field.options?.some(option => (typeof option === 'object' ? option.value : option) === value)) throw Error(key + ' needs a listed option.');
    } else throw Error('Unsupported setting type: ' + type);
    result[key] = value;
  }
  return result;
}
module.exports = {values};
