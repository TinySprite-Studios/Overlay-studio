GAMING OFFICE · JOHN McKLEAN

Open TinySprite Overlay Studio, select this project, then choose:
Scenes > Gaming Office · John McKlean

OBS Browser Source (with Studio running on its normal port):
http://127.0.0.1:8791/scenes/tss_gamers-office/index.html
Width: 1920   Height: 1080   Recommended browser-source frame rate: 30 FPS
Studio must stay open. This scene's public Twitch chat does not require the Twitch runner.

MONITORS
Left: Live, read-only Twitch chat for johnmcklean. Messages appear as viewers send them;
old chat history is not replayed. A quiet channel shows a connected/waiting state.
It reconnects automatically and removes messages when Twitch sends moderation events.
No credentials, OAuth tokens, or ability to post chat are included in this scene.
Middle: A looping, blurred Discord-style conversation made entirely of abstract shapes.
It never connects to Discord and never loads private messages.
Right: Animated Streaming Starting Soon display with optional countdown.
Other animation: subtle keyboard/wall/Sprite illumination and rotating fan highlights.

CUSTOMISE
Use Studio scene settings to edit the title, subtitle and countdown. Countdown is off
by default so the scene never promises an arbitrary start time. Enable it by setting
seconds, and use OBS's refresh-on-scene-activation option if it should restart each visit.
Turn off the Animate setting to stop decorative motion; live chat keeps working.
The Twitch channel is in office-settings.js > twitchChannel.
Screen perspective calibration is also in office-settings.js. Keep the artwork's
aspect ratio and monitor positions if replacing it. This custom scene uses its own
art direction; the generic style/background/logo controls do not restyle the room.

FILES
index.html / style.css / scene.js: composed scene and animation.
chat.mjs: public read-only Twitch connection, emotes and moderation handling.
geometry.mjs: exact four-corner monitor perspective mapping.
config.js / scene.json: TinySprite Studio settings and scene registration.
office-settings.js: channel, message limits and monitor calibration.
../../assets/tss_gamers_office_typing.png: current artwork with John facing the monitors,
both hands typing on the keyboard (1672 x 941). The original artwork is retained separately.
The chat-screen mask follows his foreground head and shoulder to preserve depth.
ARTWORK-PROMPT.txt: full generation prompt and reference roles.
ARTWORK-TYPING-PROMPT.txt: the built-in image edit prompt for the typing pose.

Artwork generated with the built-in OpenAI image-generation tool using the provided
John_McKlean_3.webp, TSS logo, and existing Sprite design. Animated screen contents
are rendered as HTML/CSS/JavaScript, not baked into the picture.

Twitch connection references:
https://dev.twitch.tv/docs/chat/irc/
https://discuss.dev.twitch.com/t/twitch-tv-web-browser-chat/6186
