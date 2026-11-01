# Add the Sprite update to your stream

## TinySprite Overlay Studio

Install `dist/TinySprite-Overlay-Studio-Setup-1.2.0.exe` to use the Windows desktop program with GitHub updates. The portable `dist/TinySprite-Overlay-Studio-1.2.0.exe` is also available, with manual updates. It includes its runtime. On first launch, it creates an editable overlay in `Documents/TinySprite Overlay Studio/My Overlay`. Existing projects and custom files are kept when you upgrade; close the previous Studio version before opening the new one.

- **New overlay project** creates a fresh project with five starter scenes in an empty folder. **Copy project** copies your current project; **Open** loads an existing overlay folder containing `start-twitch.cmd`.
- **Scenes** lets you create Starting Soon, BRB, Stream Ending, Just Chatting, Live Overlay and Blank Canvas scenes. For an existing project, click **Add starter pack** to import missing bundled Gaming Office scenes and assets, then add any missing scene types without replacing existing scenes or artwork.
- Select a scene to edit its headline, channel name, footer, colours, style, logo, background image/video, canvas orientation and countdown. **Apply changes** saves the settings. **Edit code** opens its HTML. Each scene has its own folder with HTML, CSS, JavaScript and settings; applying visual settings updates `config.js` and `scene.json`, preserving custom HTML/CSS.
- **Duplicate** copies the complete scene, including custom code. **Delete** moves its folder to the Windows Recycle Bin.
- Expand/collapse folders in the explorer. Its **New file** and **New folder** buttons accept nested paths. **Import assets** copies images, videos, audio and fonts into `assets` without replacing existing files. Click image/video/audio files to preview them.
- Select files in the explorer and edit them in the code editor. **Ctrl+S** saves and refreshes the preview. Files changed externally reload when there are no unsaved edits; conflicting saves are rejected.
- Tabs have **×** close buttons and **Ctrl+W** closes the active tab. Unsaved tabs offer Save, Discard or Cancel. **Save all** / **Ctrl+Shift+S** saves open edits.
- Choose horizontal or vertical preview. Offline previews and test alerts work without signing in. **All events** opens the existing offline playground inside the preview.
- **Enlarge** fills the Studio window with the preview. Use **Restore** or **Escape** to return.
- **Run overlay** saves pending edits, runs `start-twitch.cmd`, and opens the separate **Console** tab. Output keeps collecting while you edit, with an unread counter on the Console tab. Reply to setup prompts using the masked input beneath it.
- **Copy OBS URL** copies the address of the currently selected HTML scene. **OBS setup** shows the URL, dimensions and setup instructions. Studio serves all scene files at `http://127.0.0.1:8791/` while it stays open, even without Twitch sign-in. Live Twitch events are forwarded from the runner on port 8787. Existing OBS URLs using port 8787 still work with the runner.
- Countdown timers start when a scene loads. In OBS, enable **Refresh browser when scene becomes active** if you want the countdown to restart on each visit. Saving refreshes the Studio preview; refresh the OBS browser source to load changes there. Add cameras and chat separately in OBS.
- **Export project** saves a portable folder copy of your project, scenes and assets. It does not include Studio itself or account credentials stored outside the project. Open the exported folder with Studio on another computer and copy its OBS URLs there.
- **Stop** stops the command and its child processes. Closing Studio also stops its runner. Keep Studio open while streaming.

For development from this source folder, double-click `start-studio.cmd` (Node.js 22+ required). Run `npm run build:studio` to build the Windows installer and portable executable. The editor includes syntax highlighting, autocomplete, search, multiple file tabs, and undo/redo; it does not load VS Code extensions.

The app is currently unsigned. Twitch sign-in still uses the existing helper and stores account data locally as before. Studio has one active project: switching projects changes what its port 8791 URLs serve. Scenes are browser sources you add to OBS; Studio does not directly create or switch OBS scene collections.

## GitHub releases and app updates

The configured release repository is https://github.com/TinySprite-Studios/overlay-studio. Upload the source to this **public GitHub repository**, including the hidden `.github/workflows/release.yml` file. The workflow automatically uses that repository as the update source; no access tokens are shipped inside the app.

1. For each release, increase `version` in `package.json` and run `npm install --package-lock-only`. Commit both files along with your changes.
2. In GitHub Desktop, add a version tag to that commit, such as `v1.2.0`, and push the tag to GitHub. Use `vMAJOR.MINOR.PATCH`, matching `package.json`. Creating a tag locally does not start the workflow until it is pushed. You can also still create and publish a normal release manually on GitHub.
3. Wait for **Build Windows release** under Actions to finish. For a pushed tag, it automatically creates a release named exactly after the tag, generates release notes, attaches the Setup installer, portable executable, blockmap and `latest.yml`, then publishes it. The release stays a draft until uploads succeed. Keep all of these assets on the release. Updates become available after publication. Failed runs can be retried from Actions.
4. Users install **TinySprite-Overlay-Studio-Setup-VERSION.exe** once. Installed Studio checks on launch and every hour while open, shows an update notice, and offers **Download update**, followed by **Restart and install**. Users can also check manually. The restart prompts for unsaved changes and stops the runner/OBS server, so install between streams.

Existing portable copies and older versions without this feature need that one-time installer download. Portable builds continue to work but do not self-update. No notification is delivered while Studio is closed; it checks on the next launch. Draft releases and prereleases are excluded.

Updates replace Studio and its bundled templates. They preserve the selected project, local settings, credentials, and existing files in Documents or custom project folders. Existing projects are not overwritten with new template content; use **New overlay project** for the latest templates.

For a local build with updates enabled, set PowerShell `$env:GITHUB_REPOSITORY = 'your-account/your-repository'` before `npm run build:studio`. Without a repository, local builds have updates disabled. The GitHub workflow supplies this automatically. The app is unsigned; signing can be configured separately before public distribution.

## 1. Extract and start

1. Extract the ZIP into a new folder. Keep your old overlay folder as a backup.
2. If you customised your old `config.js` or added logo images, copy those into the new folder.
3. Close your old Twitch overlay helper.
4. Double-click **start-twitch.cmd** in the new folder. Keep that window open while streaming.
5. It uses your existing sign-in on the same Windows account. If prompted, sign in with your streaming Twitch account. Do not copy or change API credentials.

If Windows says Node is missing, install the LTS version from [nodejs.org](https://nodejs.org/en/download), then try again.

## 2. Set your OBS Browser Source

Turn **Local file** off and use:

| Layout | URL | Width | Height |
| --- | --- | --- | --- |
| Horizontal | `http://127.0.0.1:8787/overlays/overlay-horizontal.html` | 1920 | 1080 |
| Vertical | `http://127.0.0.1:8787/overlays/overlay-vertical.html` | 1080 | 1920 |

If you already use that URL, just refresh the OBS source after starting the new helper. Keep it above your gameplay source.

## 3. Add these Twitch channel-point rewards

In your Twitch Creator Dashboard, open Channel Points and add or edit these custom rewards. Use these exact names and choose your own point costs.

| Reward name | Require viewer text? |
| --- | --- |
| **Summon Sprite** | Yes, to show their message. Only the first 100 characters appear. |
| **Feed Sprite** | No |
| **Hydrate Sprite** | No |
| **Throw a Tomato** | No |
| **Paint the Stream** | Yes |

An existing **Summon TinySprite** reward also works; you do not need both.

For the paint reward, tell viewers to enter: **red, orange, yellow, green, blue, purple, pink, cyan, white, or rgb for rainbow**.

Set a one-minute cooldown on visual rewards to avoid long queues. Handle completed redemptions as you normally would; the helper does not mark them complete automatically.

## Bits Power-up: one-hour overlay colour

Create a Custom Power-up named exactly **Paint the stream! PRO** in Twitch's Power-ups & Channel Points dashboard. Set the cost to **100 Bits** (or your preferred price).

Turn **Require Viewer to Enter Text** on. Viewers enter **red, orange, yellow, green, blue, purple, pink, cyan, white, or rgb for rainbow**, exactly like the channel-points reward. `rainbow` also works. Empty or unknown colours use purple.

Each redemption gets one full hour. Colour redemptions queue in order alongside Paint the Stream, so an existing colour finishes first. Timers survive helper restarts and continue counting while offline. When the queue ends, the original overlay colours return. The helper does not automatically mark redemptions fulfilled.

Restart the helper from this updated project (Stop then Run overlay in Studio, or restart `start-twitch.cmd`) and refresh your OBS browser sources. The Power-up must also be created/saved in Twitch; editing these files does not create it there.

## 4. Test it

- For a practice run without Twitch, double-click **start-offline-preview.cmd** and open **http://127.0.0.1:8790/**. Use its buttons to test everything.
- For the live setup, redeem each reward and check it appears in OBS. These redemptions spend real points.
- Sprite's care bars fill automatically at the start of each new stream.
- Keep **start-twitch.cmd** running whenever you stream.

If you need to go back, close the new helper, start the old one from your backup folder, and refresh OBS.

## Manually force an overlay colour

In Studio, use **LIVE COLOUR OVERRIDE** below the preview. Choose a colour, enter the duration in **minutes** (1?1440; default 60), then click **Force colour**. Start **Run overlay** first and finish sign-in. This affects the live overlay and switches the preview to Live. Existing colour redemptions pause and resume with their remaining time afterwards. Applying again replaces the current manual override and starts a new timer. The override survives helper restarts.


Project folders: assets/ contains artwork and branding; overlays/ contains browser source pages; scripts/ contains overlay behaviour and Twitch helpers; scenes/ contains standalone scene packages; studio/ contains the desktop app and studio/tests/ its checks. Launch shortcuts and shared config.js stay at the project root.

Developer mode starts off on every launch. Streamer mode keeps overlay previews, scene settings, test alerts, colour overrides, and the console available while hiding the file explorer and code editor. Use the Developer mode button to reveal code tools. Switching it off prompts you to save or discard unsaved code, or cancel the switch.
