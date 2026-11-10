# Channel-points emoji template

A transparent overlay that rains emojis when a viewer redeems a linked channel-point reward. Works with landscape and portrait browser sources.

## Try it in Studio

1. Copy this entire folder somewhere you keep overlay projects, then use **Import overlay project** to open the copy.
2. In Twitch, create a custom channel-point reward such as **Send emojis**, with your chosen cost. Viewer text is not needed.
3. Connect Twitch in Studio **Settings**. Use **Refresh Twitch rewards** if you created the reward after connecting.
4. In **Events → Send emojis → Twitch reward**, select your reward. Choose the emojis, count and duration, then click **Apply changes**.
5. In Workspace, select `index.html` and **Offline** preview. Click the **Send emojis** test button. The transparent screen is empty until triggered.
6. Add this overlay's Studio OBS URL as a Browser Source above your camera/game, using your canvas dimensions. Keep Studio open and click **Run overlay** for live redemptions.

## How the files fit together

- `tss-events.json` declares the `send-emoji` event, its channel-points trigger and editable controls.
- `index.html` and `style.css` provide the transparent overlay.
- `emoji.js` listens to `/events` and handles `project-event` messages with `id: "send-emoji"`. Studio supplies `values.emojis`, `values.count` and `values.duration` in both previews and live events.

Studio saves the selected Twitch reward's ID and channel ID when you apply the settings. Do not hard-code its title or someone else's reward ID. Renaming the Twitch reward keeps the link; deleting and recreating it requires selecting the new reward.

To add this effect to an existing project, merge the event into its existing `events` array and include the emoji container, CSS and JavaScript in its overlay. Keep the event ID in the JSON and JavaScript identical. Do not replace the project's other event definitions.

For a Bits Power-up variant, change the event's `trigger` from `points` to `bits`, then choose a Bits Power-up in Studio. The overlay JavaScript stays the same.
