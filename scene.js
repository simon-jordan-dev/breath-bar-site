// Scene engine: draws the animated nature scenes (Wave, Grass, Seeds, …).
// Each scene lives in scenes/<name>.js and registers itself with
// Scene.register(id, { draw(ctx, s) }).
//
// Scenes draw in "bar coordinates" so they work on every edge:
//   u runs along the bar, from 0 (where it starts filling) to s.L,
//   v runs across it, from 0 (the screen edge, "the ground") to s.T.
// The breath sets s.front = s.level * s.L: how far along the scene is "active".
const Scene = (() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de'];
  const scenes = {};

  let current = null;  // id of the scene being shown
  let cfg = { edge: 'right', colors: ['#3b82f6', '#3b82f6'], tint: '#ffffff' };
  let time = 0;        // seconds of motion
  let lastLevel = 0;
  let memory = {};     // per-scene state that lasts between frames (particles etc.)

  function register(id, scene) { scenes[id] = scene; }
  const has = (id) => id in scenes;

  function configure(s) {
    const mode = s.colorMode ?? 'single';
    if (s.style !== current) memory = {};
    current = has(s.style) ? s.style : null;
    cfg = {
      edge: s.edge,
      colors: mode === 'rainbow' ? RAINBOW : mode === 'gradient' ? [s.color, s.color2 ?? s.color] : [s.color, s.color],
      tint: mode === 'rainbow' ? '#ffffff' : (isBright(s.color) ? '#000000' : '#ffffff'),
    };
  }

  // Match the canvas to its on-screen size and map bar coordinates to pixels.
  // Scenes are drawn at standard resolution even on high-resolution screens
  // (and scaled up): they're soft anyway, and it saves a lot of CPU.
  function setup() {
    const dpr = 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    switch (cfg.edge) {
      case 'top':    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return [w, h];                 // u→x, v→down
      case 'bottom': ctx.setTransform(dpr, 0, 0, -dpr, 0, h * dpr); return [w, h];         // u→x, v→up
      case 'left':   ctx.setTransform(0, -dpr, dpr, 0, 0, h * dpr); return [h, w];         // u→up, v→right
      case 'right':
      default:       ctx.setTransform(0, -dpr, -dpr, 0, w * dpr, h * dpr); return [h, w]; // u→up, v→left
    }
  }

  function draw(level, glow, dt) {
    if (!current) return;
    const [L, T] = setup();
    time += dt;
    const velocity = dt > 0 ? (level - lastLevel) * L / dt : 0; // px per second, + = filling
    lastLevel = level;
    const s = {
      L, T, level, glow, dt, time, velocity,
      front: level * L,
      colors: cfg.colors,
      paint: (alpha) => paint(L, alpha),
      memory,
    };
    ctx.save();
    scenes[current].draw(ctx, s);
    ctx.restore();

    // Hold cue for every scene: tint whatever the scene drew, swelling during holds.
    if (glow > 0.004) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = withAlpha(cfg.tint, glow * 0.4);
      ctx.fillRect(-10, -10, L + 20, T + 20);
      ctx.restore();
    }
  }

  // The user's colors along the bar (used by the Wave).
  function paint(L, alpha) {
    const g = ctx.createLinearGradient(0, 0, L, 0);
    cfg.colors.forEach((c, i) => g.addColorStop(i / (cfg.colors.length - 1), withAlpha(c, alpha)));
    return g;
  }

  return { register, has, configure, draw };
})();

// ---------- Helpers shared by the scenes ----------

const TAU = Math.PI * 2;
const smoothstep = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;

function withAlpha(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Mix two hex colors: t = 0 gives a, t = 1 gives b. Returns a hex color, so
// results can be mixed again.
function mixColor(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (x, y) => Math.round(lerp(x, y, t)).toString(16).padStart(2, '0');
  return `#${ch(p >> 16 & 255, q >> 16 & 255)}${ch(p >> 8 & 255, q >> 8 & 255)}${ch(p & 255, q & 255)}`;
}

// Repeatable "random" numbers, so a scene's layout is the same every frame.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How "inside the breath" position u is: 1 well behind the front, 0 beyond
// it, with a soft edge of the given width.
const activeAt = (u, s, soft = 40) => smoothstep((s.front - u) / soft + 0.5);

// How far a scene has slid away (0–1). It stays at 0 when a breath simply turns
// round, and only rises during a real hold at empty, sliding back on the inhale.
function awayAt(s) {
  const m = s.memory, resting = s.level < 0.0005;
  m.away ??= 0;
  m.away += ((resting ? 1 : 0) - m.away) * Math.min(1, s.dt * (resting ? 2 : 6));
  return smoothstep(m.away);
}

// Fade out everything drawn so far towards the scene's top (inner) edge, so it
// has no hard straight line there. `from` = where the fade starts (0–1 of T).
function fadeTop(ctx, s, from = 0.55) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createLinearGradient(0, 0, 0, s.T);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(from, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-10, -10, s.L + 20, s.T + 20);
  ctx.restore();
}

// A soft, rounded background shape from the start of the bar up to `until`:
// height `h` with a gently wavy top, ending in a rounded curve instead of a
// straight vertical edge. Fill it with any color or gradient.
function dome(s, until, h, wave = 0.08) {
  const p = new Path2D();
  const r = Math.min(h * 1.2, Math.max(until, 1));
  p.moveTo(0, 0);
  for (let u = 0; u <= until - r; u += 8) p.lineTo(u, h * (1 + wave * Math.sin(u / 60 + s.time * 0.4)));
  p.bezierCurveTo(until - r * 0.3, h, until, h * 0.55, until + r * 0.25, 0);
  p.closePath();
  return p;
}

// An off-screen canvas, for drawing something once and reusing it as an
// image every frame (much cheaper than redrawing many shapes).
function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')];
}

// Collect shapes by color so each color is set only once per frame
// (changing colors for every small shape is slow).
function buckets(n) {
  return Array.from({ length: n }, () => new Path2D());
}
