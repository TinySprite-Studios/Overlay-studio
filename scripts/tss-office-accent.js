// Select green lighting in the artwork, preserving texture and other colours.
(() => {
  const artwork = document.querySelector('.office-art');
  if (!artwork) return;
  const root = document.documentElement;
  const events = new EventSource('/events');
  window.TSSPaint.connect(events);
  const canvas = document.createElement('canvas');
  canvas.className = 'office-art office-accent';
  canvas.setAttribute('aria-hidden', 'true');
  artwork.after(canvas);
  const context = canvas.getContext('2d', {willReadFrequently:true});
  let pixels;
  const selected = [];
  // Wall sign, sprite, PC, keyboard and chair stitching; exclude the plants.
  const regions = [[.50,0,.85,.32],[.30,.10,.39,.28],[.78,.24,1,.78],
    [.35,.57,.80,.78],[0,.30,.15,.94]];
  function prepare() {
    canvas.width = artwork.naturalWidth; canvas.height = artwork.naturalHeight;
    context.drawImage(artwork, 0, 0);
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const x = (index / 4 % canvas.width) / canvas.width;
      const y = Math.floor(index / 4 / canvas.width) / canvas.height;
      const [red, green, blue] = pixels.data.subarray(index, index + 3);
      const strength = Math.max(0, Math.min(1, (green - Math.max(red, blue) - 10) / 35));
      pixels.data[index + 3] = regions.some(([left, top, right, bottom]) => x >= left && x <= right && y >= top && y <= bottom) ? Math.round(strength * 255) : 0;
      if (pixels.data[index + 3]) {
        const max = Math.max(red, green, blue) / 255, min = Math.min(red, green, blue) / 255;
        const lightness = (max + min) / 2;
        selected.push([index, (max - min) / (1 - Math.abs(2 * lightness - 1)), lightness]);
      }
    }
    context.putImageData(pixels, 0, 0);
    recolour();
  }
  const swatch = document.createElement('canvas').getContext('2d', {willReadFrequently:true});
  function recolour() {
    if (!pixels) return;
    swatch.fillStyle = getComputedStyle(root).getPropertyValue('--accent').trim();
    swatch.fillRect(0, 0, 1, 1);
    const [r, g, b] = [...swatch.getImageData(0, 0, 1, 1).data].map(value => value / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    const hue = !delta ? 0 : 60 * (max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4);
    const lightness = (max + min) / 2;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
    for (const [index, originalSaturation, originalLightness] of selected) {
      const level = Math.min(.98, originalLightness * lightness / .6);
      const chroma = (1 - Math.abs(2 * level - 1)) * saturation * originalSaturation;
      const secondary = chroma * (1 - Math.abs(hue / 60 % 2 - 1));
      const rgb = hue < 60 ? [chroma, secondary, 0] : hue < 120 ? [secondary, chroma, 0] :
        hue < 180 ? [0, chroma, secondary] : hue < 240 ? [0, secondary, chroma] :
        hue < 300 ? [secondary, 0, chroma] : [chroma, 0, secondary];
      for (let channel = 0; channel < 3; channel++) pixels.data[index + channel] = Math.round((rgb[channel] + level - chroma / 2) * 255);
    }
    context.putImageData(pixels, 0, 0);
  }
  if (artwork.complete && artwork.naturalWidth) prepare();
  else artwork.addEventListener('load', prepare, {once:true});
  new MutationObserver(recolour).observe(root, {attributes:true, attributeFilter:['style']});
  window.addEventListener('pagehide', () => events.close(), {once:true});
})();
