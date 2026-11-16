// Served to OBS scene pages by Studio. Browsers allow only ~6 open connections per address,
// and OBS keeps every scene loaded. Without this, a few scenes holding /events streams
// starve other pages of connections and they stay black while the runner is active.
// So: one shared /events stream per page, open only while OBS says the page is visible.
(() => {
  const Native = window.EventSource;
  if (!Native || window.__tssSse) return;
  window.__tssSse = true;
  const clients = new Set(), types = new Set(['open', 'error', 'message']), forwarded = new Set();
  let source = null, visible = true, started = false;

  const forward = type => event => {
    for (const client of clients) {
      client.dispatchEvent(type === 'open' || type === 'error' ? new Event(type)
        : new MessageEvent(type, {data: event.data, lastEventId: event.lastEventId, origin: event.origin}));
    }
  };
  function watch(type) {
    types.add(type);
    if (source && !forwarded.has(type)) { forwarded.add(type); source.addEventListener(type, forward(type)); }
  }
  function sync() {
    const wanted = started && visible && clients.size > 0;
    if (wanted && !source) {
      source = new Native('/events');
      forwarded.clear();
      for (const type of types) watch(type);
    } else if (!wanted && source) { source.close(); source = null; forwarded.clear(); }
  }
  // Give OBS a moment to report a hidden scene before connecting at all.
  setTimeout(() => { started = true; sync(); }, 1000);
  addEventListener('obsSourceVisibleChanged', event => {
    if (typeof event.detail?.visible !== 'boolean') return;
    visible = event.detail.visible; started = true; sync();
  });
  addEventListener('pagehide', () => { clients.clear(); sync(); });

  class Shared extends EventTarget {
    constructor() { super(); clients.add(this); this.closed = false; sync(); }
    get readyState() { return this.closed ? 2 : source ? source.readyState : 0; }
    get url() { return location.origin + '/events'; }
    get withCredentials() { return false; }
    addEventListener(type, ...rest) { super.addEventListener(type, ...rest); watch(type); }
    close() { this.closed = true; clients.delete(this); sync(); }
  }
  for (const name of ['open', 'error', 'message']) {
    Object.defineProperty(Shared.prototype, 'on' + name, {
      get() { return this['_on' + name] || null; },
      set(handler) {
        if (this['_on' + name]) this.removeEventListener(name, this['_on' + name]);
        this['_on' + name] = handler;
        if (handler) this.addEventListener(name, handler);
      }
    });
  }
  function EventSourceShim(url, init) {
    return new URL(String(url), location.href).pathname === '/events' ? new Shared() : new Native(url, init);
  }
  EventSourceShim.CONNECTING = 0; EventSourceShim.OPEN = 1; EventSourceShim.CLOSED = 2;
  EventSourceShim.prototype = Native.prototype;
  window.EventSource = EventSourceShim;
})();
