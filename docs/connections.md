# Streaming connections

Open your project, then Settings. Connections are saved separately for each project on this Windows account. Copying or exporting a project does not include its account credentials.

## Twitch

Click **Connect Twitch**, approve access in your browser using the displayed code, then return to Studio. Overlay Studio includes its public Twitch application Client ID; streamers do not need to register their own application. The optional Twitch app setup section allows developers to use another public Client ID. No client secret is required.

Click **Run overlay** to receive follows, subscriptions, bits and channel-point events. **Check connection** verifies your saved login while the runner is stopped. Stop the runner before changing connections. Signing in to a different Twitch account removes native donation tokens associated with the previous account.

## Donations

Choose a platform and one of these connection methods:

- **Project alerts:** StreamElements and Streamlabs feed donations into the project's existing alert events and latest-donator widgets. StreamElements requires the JWT token from channel account settings and must match the connected Twitch account. Streamlabs requires the Socket API token from Settings > API Settings > API Tokens. Save, then run the overlay.
- **OBS browser alerts:** Paste the provider's private alert/widget URL. After saving, click **Copy OBS alert URL** and add a separate Browser Source in OBS. Configure and test it on the provider's dashboard. This uses the provider's visuals; it does not feed Studio's custom project alerts or donation widgets.
- **Donation link only:** Save a public donation-page link to copy and share. A donation-page link alone cannot receive live donation notifications.

The platform list includes Ko-fi, Buy Me a Coffee, DonationAlerts, TipeeeStream, Tiltify, Extra Life, Fourthwall, Streamloots, Patreon and PayPal. Use Other platform for another service. Browser alerts work only when that service supplies a compatible OBS widget URL; otherwise save its donation link or connect it through a supported alert provider.

Private tokens and browser URLs are encrypted with Windows account protection outside the project. Saved secret fields stay blank; leave them blank to keep the existing value. Disconnect removes the saved connection from Studio. To revoke Twitch permission entirely, remove Overlay Studio from your Twitch account's Connections page.

Projects using the older console setup continue to use that runner until a connection is saved in Settings. Settings connections use Studio's bundled helper and private project-specific runtime storage without replacing project code.
