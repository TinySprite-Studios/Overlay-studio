# Overlay Studio

A workspace for building your own browser-source scenes and overlays. New projects include generic Starting Soon, Be Right Back, Stream Ending, Just Chatting, and Live Overlay templates. Blank Canvas is available from Create scene. No personal scenes or channel artwork are bundled.

Developer mode starts off. Turn it on to browse source files and edit HTML, CSS and JavaScript. Turning it off offers Save, Discard or Cancel for unsaved code. Scene settings, previews, alerts and colour overrides remain available in either mode. Logs and setup prompts live in the Console tab; its unread counter keeps you informed while working elsewhere. Updates are in the bottom-left sidebar.

## Scenes and vertical output

Use Scenes to create, customise, duplicate or delete scenes. Import images and videos into assets, then choose them in Scene settings. Apply changes updates scene.json and config.js without replacing your custom HTML or CSS.

Create vertical copy makes a separate 1080 ? 1920 scene with its own OBS URL:

- Responsive layout reflows Studio templates. For custom scenes, supply portrait CSS and read the layout setting or viewport aspect ratio.
- Fit keeps the full original canvas visible with space above and below; no cropping.
- Fill scales the original canvas to cover the portrait frame, cropping the sides.

Fit/Fill copies retain their original content in portrait-source.html and original settings in portrait-source-config.js. Edit those files to customise the preserved content; wrapper settings do not restyle its content. Relative references to config.js and scene.json are rewritten for the copied source. Custom scripts using dynamically constructed paths may need manual adjustment. Background images use cover cropping in responsive templates; preview the result and adjust composition as needed. This creates browser scenes, not rendered video files or automatic uploads to social platforms.

The canvas selector changes preview dimensions; Create vertical copy creates a saved output. Use Copy OBS URL and set your OBS browser source to the displayed dimensions. Studio serves scenes on port 8791 while open. Offline preview and alert testing require no sign-in.

## Generic events

Connect your Twitch account and donation platforms in Settings, then click Run overlay. See [Streaming connections](connections.md) for setup and platform support. Shared scripts/tss-alerts.js displays a neutral alert card and scripts/tss-paint.js changes --accent. Remove these script tags for a fully custom event runtime. Listen to /events with EventSource to build your own widgets. Live colour override requires the helper. Sprite care and character-specific behaviours are not included.

Credentials remain outside the project. Existing saved projects are never overwritten by an app update; create a new project to get the clean templates. Copy project and Export project preserve your own files. Deleting a scene moves it to the Recycle Bin.

## Development

Use start-studio.cmd or npm run studio with Node.js 22+. Source folders: studio/ is the app, studio/tests/ contains checks, scenes/ contains generic templates, scripts/ contains reusable helpers, overlays/ contains preview pages, and assets/branding/ contains app branding. Run npm run preview for the standalone offline playground.

Build with npm run build:studio. Releases use a new version in package.json and package-lock.json plus a matching Git tag. Install the Windows setup executable for automatic updates; portable executables are updated manually.
