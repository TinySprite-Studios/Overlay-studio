# Project extension hook

Put a file named `tss-project.mjs` in your project folder and Studio's runner loads it when you press Run overlay. Project-only features (for example Sprite care) live there, not in Studio. With no file, nothing extra runs. A hook that throws is logged to the Console and never stops the runner.

```js
export default async function setup(api) {
  // api.root, api.userId, api.login
  // api.read(name) / api.save(name, value)  - small JSON files kept per project
  // api.emit(eventName, data)               - send a server-sent event to overlay pages on /events
  // api.twitch(endpoint)                    - call the Twitch Helix API, e.g. 'streams?user_id=...'
  // api.log(...)                            - print to the Studio Console
  return {
    subscriptions: [['stream.online', '1']],  // extra EventSub types to listen for
    initial: () => [['care', state]],          // events sent to each overlay page when it connects
    onEvent(type, event, metadata) {           // every Twitch event; return 'handled' to stop Studio processing it
    }
  };
}
```
