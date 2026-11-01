// Scene-specific controls. Studio's visual settings edit config.js separately.
window.TSS_OFFICE = {
  // Live, anonymous, read-only Twitch connection. No tokens are stored in this scene.
  twitchChannel: 'johnmcklean',
  maxMessages: 32,
  showEmotes: true,
  // The artwork is mapped in its original pixel coordinates. Each quad is TL, TR, BR, BL.
  artwork: {width:1672,height:941},
  screenSize: {width:960,height:540},
  // Keep the chat screen behind John's head and shoulder in the typing artwork.
  screenMasks: {
    chat: [[486,326],[707,325],[706,497],[548,491],[538,477],[526,458],[512,441],[496,424],[479,410],[455,398],[463,386],[473,365],[478,346]]
  },
  screens: {
    chat: [[415,327],[707,325],[706,497],[414,488]],
    discord: [[723,323],[1029,310],[1030,511],[722,499]],
    starting: [[1046,308],[1370,282],[1371,537],[1046,513]]
  }
};
