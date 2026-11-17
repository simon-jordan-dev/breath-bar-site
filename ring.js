// The Ring at the mouse cursor, drawn on a canvas and centred on the pointer's tip.
// Four looks: Glow (a soft arc that fills as you breathe in), Halo (a soft ring that
// swells and settles), Beads (twelve dots that light in turn) and Wave (water that
// fills the ring, with rippling edges, bubbles and spray).
const Ring = (() => {
  const canvas = document.getElementById('cursor-ring');
  const ctx = canvas.getContext('2d');
  const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de'];
  const PADDING = 12; // room inside the window for the glow and the water's thickness
  const BEADS = 12;
  let size = 0;
  let look = 'glow';
  let colors = ['#3b82f6'];

  function configure(s, drawingSize) {
    size = drawingSize;
    look = s.ringStyle ?? 'glow';
    const mode = s.colorMode ?? 'single';
    colors = mode === 'rainbow' ? RAINBOW : mode === 'gradient' ? [s.color, s.color2 ?? s.color] : [s.color];
  }

  // The color at a point along the ring, 0 to 1 from the top: one color, or a blend.
  function colorAt(f) {
    if (colors.length === 1) return colors[0];
    const x = Math.min(colors.length - 1.001, f * (colors.length - 1));
    const i = Math.floor(x);
    return mixColor(colors[i], colors[i + 1], x - i); // mixColor comes from scene.js
  }

  // Lighter during holds, so you can tell a hold from the slow end of a breath.
  const lift = (hex, hold) => (hold > 0.004 ? mixColor(hex, '#ffffff', hold * 0.45) : hex);

  function glow(level, hold, X, Y, R) {
    const start = -Math.PI / 2, end = start + level * Math.PI * 2;
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    ctx.shadowBlur = 12 + hold * 8;
    // One stroke for one color; short pieces for a blend, so it runs round the ring.
    const pieces = colors.length === 1 ? 1 : Math.max(1, Math.ceil(level * 48));
    for (let i = 0; i < pieces; i++) {
      const a0 = start + (end - start) * (i / pieces), a1 = start + (end - start) * ((i + 1) / pieces) + (pieces > 1 ? 0.02 : 0);
      const color = lift(colorAt(level * (i + 0.5) / pieces), hold);
      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(X, Y, R, a0, a1);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function halo(level, hold, X, Y, R) {
    const r = R * (0.55 + 0.45 * level), soft = 10;
    const color = lift(colorAt(level), hold);
    const g = ctx.createRadialGradient(X, Y, Math.max(0, r - soft), X, Y, r + soft);
    g.addColorStop(0, withAlpha(color, 0));
    g.addColorStop(0.5, withAlpha(color, 0.8));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X, Y, r + soft, 0, Math.PI * 2);
    ctx.arc(X, Y, Math.max(0, r - soft), 0, Math.PI * 2, true);
    ctx.fill();
  }

  function beads(level, hold, X, Y, R) {
    for (let i = 0; i < BEADS; i++) {
      const a = -Math.PI / 2 + (i / BEADS) * Math.PI * 2;
      const on = Math.min(1, Math.max(0, level * BEADS - i));
      ctx.beginPath();
      ctx.arc(X + Math.cos(a) * R, Y + Math.sin(a) * R, 3 + 2 * on, 0, Math.PI * 2);
      ctx.fillStyle = on > 0 ? withAlpha(lift(colorAt(i / BEADS), hold), 0.3 + 0.7 * on) : 'rgba(255, 255, 255, 0.14)';
      ctx.fill();
    }
  }

  // Water in the ring's band, rising with the breath: its edges ripple, bubbles rise
  // through it and spray lifts off the surface. Its own colors, like the Wave scene.
  const BAND = 9;
  const RIPPLE = 1.5;     // how far the edges move in and out, px
  const BUBBLES = 10;
  const SPRAY = 8;
  const TWO_PI = Math.PI * 2;
  const ripple = (a, t) => RIPPLE * (Math.sin(a * 7 + t * 2.6) * 0.6 + Math.sin(a * 11 - t * 1.9) * 0.4);
  const random = (i) => { const f = Math.sin(i * 12.9898) * 43758.5453; return f - Math.floor(f); };

  function rippledBand(X, Y, R, t) {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TWO_PI, r = R + BAND / 2 + ripple(a, t);
      ctx.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r);
    }
    for (let i = 96; i >= 0; i--) {
      const a = (i / 96) * TWO_PI, r = R - BAND / 2 - ripple(a + 1.3, t * 1.1);
      ctx.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function wave(level, hold, X, Y, R, t) {
    const surface = (x) => Math.sin(x * 0.09 + t * 2.2) * 3 + Math.sin(x * 0.05 - t * 1.4) * 2;
    const bottom = Y + R + BAND / 2 + RIPPLE, top = bottom - (2 * R + BAND + 2 * RIPPLE) * level;
    const left = X - R - BAND, right = X + R + BAND;
    const surfacePath = () => {
      ctx.beginPath();
      for (let x = left; x <= right; x += 2) ctx.lineTo(x, top + surface(x));
    };
    ctx.save();
    rippledBand(X, Y, R, t);
    ctx.clip();
    surfacePath();
    ctx.lineTo(right, bottom + 2);
    ctx.lineTo(left, bottom + 2);
    ctx.closePath();
    const water = ctx.createLinearGradient(0, top, 0, bottom);
    water.addColorStop(0, lift('#7cd4f7', hold));
    water.addColorStop(0.4, lift('#1c8fd6', hold));
    water.addColorStop(1, '#0b3e73');
    ctx.fillStyle = water;
    ctx.fill();
    // Bubbles rise up the band on both sides, wobbling, and vanish at the surface.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < BUBBLES; i++) {
      const rise = (t * (0.3 + random(i) * 0.4) + random(i + 50)) % 1;
      const y = bottom - rise * (2 * R + BAND);
      if (y < top + surface(X) + 2) continue;
      const side = i % 2 ? 1 : -1;
      const across = Math.sqrt(Math.max(0, R * R - (y - Y) ** 2)) + (random(i + 99) - 0.5) * BAND * 0.6;
      ctx.beginPath();
      ctx.arc(X + side * across + Math.sin(t * 3 + i) * 1.5, y, 1.1, 0, TWO_PI);
      ctx.stroke();
    }
    surfacePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // Spray lifts off where the surface crosses the band, while the water is moving.
    if (level < 0.03 || level > 0.97) return;
    const dy = top - Y, half = Math.sqrt(Math.max(0, (R + BAND / 2) ** 2 - dy * dy));
    const inner = Math.sqrt(Math.max(0, (R - BAND / 2) ** 2 - dy * dy));
    for (let i = 0; i < SPRAY; i++) {
      const life = (t * 1.5 + i * 0.37) % 1;
      const x = X + (i % 2 ? 1 : -1) * (inner + random(i + 7) * (half - inner));
      ctx.beginPath();
      ctx.arc(x, top + surface(x) - life * 8, 1.1 * (1 - life), 0, TWO_PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - life)})`;
      ctx.fill();
    }
  }

  const LOOKS = { glow, halo, beads, wave };

  function draw(level, hold, nowMs) {
    const scale = window.devicePixelRatio || 1;
    const pixels = Math.round(canvas.clientWidth * scale);
    if (canvas.width !== pixels) canvas.width = canvas.height = pixels;
    const side = canvas.clientWidth;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, side, side);
    const X = side / 2, Y = side / 2, R = Math.max(6, size / 2 - PADDING);
    (LOOKS[look] ?? glow)(level, hold, X, Y, R, nowMs / 1000);
  }

  return { configure, draw };
})();
