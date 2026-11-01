// config.js
window.OVERLAY_CONFIG = {
  // Logo path relative to overlays/border.html, e.g. "../assets/my-logo.png".
  // Leave blank to show TSS. A missing image also falls back to TSS.
  logo: {
    src: "../assets/tss_blue_128.png",
    alt: "TinySprite logo",
  },

  // Live notifications unfold beneath the centre logo.
  alerts: {
    enabled: true,
    holdSeconds: 5,
  },

  // Each canvas can show different boxes and use different label text.
  layouts: {
    horizontal: {
      boxes: {
        tss: true,
        camera: false,
        donator: true,
        follower: true,
        cheerer: true,
        subscriber: true,
      },
      labels: {
        donator:   { enabled: true, text: "Recent Donator" },
        follower:  { enabled: true, text: "Recent Follower" },
        cheerer:   { enabled: true, text: "Recent Cheerer" },
        subscriber:{ enabled: true, text: "Recent Subscriber" },
      },
    },

    vertical: {
      boxes: {
        tss: false,
        camera: false,
        donator: false,
        follower: false,
        cheerer: false,
        subscriber: false,
      },
      labels: {
        donator:   { enabled: false, text: "Recent Donator" },
        follower:  { enabled: false, text: "Recent Follower" },
        cheerer:   { enabled: false, text: "Recent Cheerer" },
        subscriber:{ enabled: false, text: "Recent Subscriber" },
      },
    },
  },

  // Colors / styling
  theme: {
    frameLight: "#37ff7d",
    frameGlow: "rgba(55,255,125,0.55)",

    chaser1: "#0a4a1d",
    chaser2: "#0f7a33",
    chaserGlow: "rgba(15,122,51,0.55)",

    boxBg: "rgba(0,0,0,0.35)",
    boxBorder: "rgba(55,255,125,0.45)",
    boxText: "rgba(255,255,255,0.90)",
    boxSub: "rgba(255,255,255,0.65)",

    plateBg: "rgba(0,0,0,0.55)",
    plateRed: "#ff2a2a",
    plateRedGlow: "rgba(255,42,42,0.55)",
  },

  // Speeds / sizing
  motion: {
    speedSeconds: 7,   // border chaser speed
  }
};
