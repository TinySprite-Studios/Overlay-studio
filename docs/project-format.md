# Project files

Import a project folder with **Open**, or create an empty project. Developer mode edits only that folder. Projects can be copied or exported with their code, settings and assets.

New projects contain `tss-events.json`, `scenes/` and `assets/`. The events file starts with empty definitions. Existing files are never replaced during import.

## Events

Define events in `tss-events.json`:

```json
{
  "version": 1,
  "events": [{
    "id": "confetti",
    "name": "Celebrate",
    "trigger": "points",
    "fields": [
      {"key": "amount", "label": "Confetti amount", "type": "number", "default": 50, "min": 1, "max": 200},
      {"key": "colour", "label": "Colour", "type": "color", "default": "#ff4488"}
    ],
    "values": {},
    "testData": {"event": {"user_input": "Hello!"}}
  }],
  "colours": {},
  "sounds": {}
}
```

`points` and `bits` match a Twitch reward or power-up name. The built-in Twitch helper also supports `channel.follow`, `channel.subscribe`, `channel.subscription.message` and `channel.cheer`. Other integrations can send the same event envelope from their own connection. A definition does not add new Twitch subscriptions or authentication scopes.

Scene JavaScript receives live events and Studio test events using:

```js
const events = new EventSource('/events');
events.addEventListener('project-event', message => {
  const {id, name, values, event} = JSON.parse(message.data);
  if (id === 'confetti') celebrate(values.amount, values.colour);
});
```

Studio provides a test button for each event. `testData` supplies sample payload properties; `id`, `name` and `values` come from the definition and current saved settings. Live payloads include the original Twitch event as `event`. Changes are picked up without restarting the helper.

Optional sound keys are `follow`, `sub`, `cheer`, and `donation`, each with `{"file":"assets/sound.mp3","volume":100}`. Only declared sounds appear in new-format projects. Legacy projects retain their existing sound controls.

## Scenes

Each scene uses `scenes/tss_scene-name/index.html` and `scene.json`, plus its own JavaScript, CSS and assets as needed:

```json
{
  "type": "custom",
  "name": "My scene",
  "layout": "horizontal",
  "fields": [
    {"key": "heading", "label": "Heading", "type": "text", "default": "Welcome"},
    {"key": "showChat", "label": "Show chat", "type": "boolean", "default": true},
    {"key": "position", "label": "Position", "type": "select", "options": ["left", "right"], "default": "left"}
  ],
  "values": {}
}
```

Use a normal HTML document with a `<head>` element. Studio supplies `window.TSS_SCENE` and `window.TSS_EVENTS` before scene scripts run, in both preview and OBS output. Read settings from `window.TSS_SCENE.values`. Saving settings updates `scene.json` and generates `config.js`; include `config.js` for use outside Studio. Scene HTML, CSS and scripts are preserved. Refresh an already loaded OBS source after changing settings.

Both events and scenes use `fields` and `values`. Supported types: `text`, `textarea`, `number`, `boolean`, `color`, `select`. Fields accept `label`, `description`, `default`, and `required`; numbers accept `min`, `max`, `step`; text accepts `maxLength`. Select options are strings or `{ "label": "Left side", "value": "left" }` objects. Keys must be unique identifiers starting with a letter. Built-in scenes can also declare additional fields.
