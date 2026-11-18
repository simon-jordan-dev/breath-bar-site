// ---------- Where the downloads and Pro live ----------
// Fill these in before launch (see README.md). Until then those buttons say they
// open at launch, rather than going nowhere.
const LINKS = {
  windows: 'https://github.com/simon-jordan-dev/breath-bar-site/releases/latest/download/Breath-Bar-Setup.exe', // always the newest installer (see the app's README)
  android: '', // the Google Play listing
};
// Pro is sold through our key service (the breath-bar-keys project), which opens
// Stripe Checkout for the chosen plan. Turn this on once Stripe is live.
const PRO_ON_SALE = true;
const KEYS_API = 'https://api.breathbar.app';
for (const plan of ['monthly', 'yearly', 'lifetime']) LINKS[`pro-${plan}`] = PRO_ON_SALE ? `${KEYS_API}/buy?plan=${plan}` : '';

const NOT_YET = {
  windows: 'The Windows download opens at launch.',
  android: 'Mac, iPhone and Android versions are coming soon.',
  pro: 'Pro goes on sale very soon. The free app has everything you need to start.',
};

// scene.js asks this of the bar's color.
function isBright(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3;
}

const Breath = (() => {
  // The app's six techniques (techniques.json).
  const TECHNIQUES = {
    resonance: { name: 'Resonance breathing', short: 'Resonance', why: 'Smooth, slow and even, with no holds.', phases: [{ type: 'inhale', seconds: 5.5, to: 1 }, { type: 'exhale', seconds: 5.5, to: 0 }] },
    box: { name: 'Box breathing', short: 'Box', why: 'Equal in, hold, out, hold. Steady and focusing.', phases: [{ type: 'inhale', seconds: 4, to: 1 }, { type: 'hold', seconds: 4 }, { type: 'exhale', seconds: 4, to: 0 }, { type: 'hold', seconds: 4 }] },
    triangle: { name: 'Triangle breathing', short: 'Triangle', why: 'Equal in, out and hold. Short and simple.', phases: [{ type: 'inhale', seconds: 4, to: 1 }, { type: 'exhale', seconds: 4, to: 0 }, { type: 'hold', seconds: 4 }] },
    478: { name: '4-7-8 breathing', short: '4-7-8', why: 'A long hold and a long breath out, for winding down.', phases: [{ type: 'inhale', seconds: 4, to: 1 }, { type: 'hold', seconds: 7 }, { type: 'exhale', seconds: 8, to: 0 }] },
    sigh: { name: 'Double sigh', short: 'Double sigh', why: 'A double breath in, then a long, slow breath out.', phases: [{ type: 'inhale', seconds: 2.5, to: 0.75 }, { type: 'inhale', seconds: 1, to: 1 }, { type: 'exhale', seconds: 6.5, to: 0 }] },
    exhale: { name: 'Long exhale', short: 'Long exhale', why: 'Breathe out longer than you breathe in.', phases: [{ type: 'inhale', seconds: 4, to: 1 }, { type: 'exhale', seconds: 7, to: 0 }] },
  };
  const SLOWDOWN = { inhale: 5, exhale: 6 };
  const CUES = { inhale: 'Breathe in', hold: 'Hold', exhale: 'Breathe out' };
  const WORDS = { inhale: 'In', hold: 'Hold', exhale: 'Out' };
  const GLIDE_SECONDS = 0.6; // after switching technique, glide to the new place in the breath
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = 'resonance';
  let phases = TECHNIQUES.resonance.phases;
  let startedAt = performance.now();
  let level = 0, gap = 0, lastFrame = performance.now();
  let style = 'solid';
  let sceneSet = { edge: 'right', color: '#3b82f6' };
  let once = null; // { phases, done }: one pass through, then back to the technique
  const listeners = [];
  const hasScene = () => typeof Scene !== 'undefined'; // scene.js is optional
  const state = { level: 0, glow: 0, type: 'inhale', index: 0, cue: CUES.inhale, dt: 0, technique: current, seconds: 0 };

  function ease(p, k) {
    const progress = (x) => 1 - Math.exp(-k * x) * (1 + k * x);
    return progress(p) / progress(1);
  }

  function at(seconds, list = phases) {
    const cycle = list.reduce((sum, ph) => sum + ph.seconds, 0);
    let t = seconds % cycle;
    let now = 0;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].to !== undefined) { now = list[i].to; break; }
    for (let i = 0; i < list.length; i++) {
      const ph = list[i];
      if (t < ph.seconds) {
        const p = t / ph.seconds;
        if (ph.type === 'hold') return { level: now, glow: Math.sin(Math.PI * p), type: ph.type, index: i };
        return { level: now + (ph.to - now) * ease(p, SLOWDOWN[ph.type]), glow: 0, type: ph.type, index: i };
      }
      t -= ph.seconds;
      now = ph.to ?? now;
    }
    return { level: now, glow: 0, type: list[0].type, index: 0 };
  }

  const all = (sel) => [...document.querySelectorAll(sel)];
  let fills = [], levels = [], cues = [], tiles = [];
  function collect() {
    fills = all('[data-fill]');
    levels = all('[data-level]');
    cues = all('[data-cue]');
    tiles = all('[data-tech="tiles"]');
  }

  function paint() {
    const l = state.level.toFixed(4);
    for (const el of fills) el.style.transform = el.dataset.fill === 'x' ? `scaleX(${l})` : `scaleY(${l})`;
    for (const el of levels) el.style.setProperty('--level', l);
    for (const el of cues) if (el.textContent !== state.cue) el.textContent = state.cue;
    for (const row of tiles) [...row.children].forEach((tile, i) => tile.classList.toggle('now', i === state.index));
    // One bad frame (say, the canvas measured 0 while the page was hidden) mustn't stop the loop.
    if (style !== 'solid' && hasScene()) { try { Scene.draw(state.level, state.glow, state.dt); } catch (e) { console.warn(e); } }
    for (const fn of listeners) fn(state);
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    gap *= Math.exp(-dt / GLIDE_SECONDS);
    const seconds = (now - startedAt) / 1000;
    let s;
    if (once) {
      const total = once.phases.reduce((sum, ph) => sum + ph.seconds, 0);
      if (seconds >= total) {
        const done = once.done;
        once = null;
        startedAt = now;
        gap = 0;
        s = at(0);
        done?.();
      } else s = at(seconds, once.phases);
    } else s = at(seconds);
    Object.assign(state, s, { level: Math.min(1, Math.max(0, s.level + gap)), cue: CUES[s.type], dt, technique: current, seconds });
    paint();
    requestAnimationFrame(frame);
  }

  function describe() {
    const t = TECHNIQUES[current];
    const cycle = t.phases.reduce((sum, ph) => sum + ph.seconds, 0);
    const text = {
      name: t.name,
      short: t.short,
      why: t.why,
      timing: t.phases.map((ph) => ph.seconds).join(' · '),
      rate: `About ${(60 / cycle).toFixed(1)} breaths a minute`,
    };
    for (const el of all('[data-tech]')) {
      if (el.dataset.tech === 'tiles') {
        el.replaceChildren(...t.phases.map((ph) => {
          const tile = document.createElement('div');
          tile.className = 'tile';
          tile.append(String(ph.seconds));
          const word = document.createElement('small');
          word.textContent = WORDS[ph.type];
          tile.append(word);
          return tile;
        }));
      } else if (text[el.dataset.tech] !== undefined) el.textContent = text[el.dataset.tech];
    }
    for (const b of all('[data-technique]')) {
      const on = b.dataset.technique === current;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  function use(id) {
    if (!TECHNIQUES[id] || (id === current && !once)) return describe();
    const before = state.level;
    current = id;
    phases = TECHNIQUES[id].phases;
    once = null;
    startedAt = performance.now();
    gap = still ? 0 : before - at(0).level;
    describe();
  }

  // One pass through `list` from empty (a guided first breath), then carry on.
  function playOnce(list, done) {
    once = { phases: list, done };
    startedAt = performance.now();
    gap = 0;
    if (still) { once = null; done?.(); }
  }

  // The look: 'solid', or a scene drawn on <canvas id="scene">.
  function look(next, settings = {}) {
    style = next;
    sceneSet = { ...sceneSet, ...settings };
    const scene = style !== 'solid' && hasScene();
    for (const el of all('[data-solid]')) el.hidden = !!scene;
    const canvas = document.getElementById('scene');
    if (canvas) canvas.hidden = !scene;
    if (scene) Scene.configure({ style, edge: sceneSet.edge, color: sceneSet.color, colorMode: sceneSet.colorMode ?? 'single', color2: sceneSet.color2 });
    for (const b of all('[data-style]')) b.classList.toggle('on', b.dataset.style === style);
  }

  function start() {
    collect();
    describe();
    for (const b of all('[data-technique]')) b.addEventListener('click', () => use(b.dataset.technique));
    for (const b of all('[data-style]')) b.addEventListener('click', () => look(b.dataset.style));
    if (still) {
      // Reduced motion: hold the bar still at a part-full resting place.
      Object.assign(state, { level: 0.6, glow: 0, type: 'inhale', index: 0, cue: '', dt: 0.016 });
      paint();
      for (const el of cues) el.hidden = true;
      return;
    }
    requestAnimationFrame(frame);
  }

  return { TECHNIQUES, CUES, state, still, on: (fn) => listeners.push(fn), use, playOnce, look, collect, describe, start, at, get current() { return current; } };
})();

// ---------- Downloads and Pro ----------
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3500);
}
for (const link of document.querySelectorAll('[data-get]')) {
  const url = LINKS[link.dataset.get];
  if (url) link.href = url;
  else link.addEventListener('click', (e) => { e.preventDefault(); toast(NOT_YET[link.dataset.get.split('-')[0]]); });
}

// On a phone, where the Windows download is no use, the coming-soon button comes first.
if (/Android|iPhone/i.test(navigator.userAgent)) {
  const row = document.querySelector('.get-row'), [win, soon] = row.children;
  win.className = 'btn ghost';
  soon.className = 'btn';
  row.prepend(soon);
}

// ---------- This page ----------
// The plain Blue and Rainbow bars are drawn on the same canvas as the scenes, so
// on iPhone they reach the bottom of the screen just like the scenes do.
const PLAIN_RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de'];
function plainBar(rainbow) {
  return {
    draw(ctx, s) {
      const w = Math.round(s.T * 0.4); // 24 px of the 60 px edge on computers, 16 of 40 on phones
      const k = 0.6 / 0.7;            // the plain bars are a little more see-through than scenes
      let paint = 'rgb(91, 140, 255)';
      if (rainbow) {
        paint = ctx.createLinearGradient(0, 0, s.L, 0);
        PLAIN_RAINBOW.forEach((c, i) => paint.addColorStop(i / (PLAIN_RAINBOW.length - 1), c));
      }
      ctx.fillStyle = paint;
      ctx.globalAlpha = (rainbow ? 0.22 : 0.16) * k;
      ctx.fillRect(0, 0, s.L, w);
      ctx.globalAlpha = k;
      ctx.fillRect(0, 0, s.front, w);
      ctx.globalAlpha = 1;
    },
  };
}
Scene.register('plain-blue', plainBar(false));
Scene.register('plain-rainbow', plainBar(true));

Breath.look('wave', { edge: 'right', color: '#5b8cff' });

// Copy the page-edge scene into the mock's bar every frame, at the same
// proportions, so the desk shows exactly what the page edge shows.
const desk = document.querySelector('.desk'), edge = document.querySelector('.edge.thin');
function setBar(mode) {
  desk.dataset.bar = mode;
  edge.classList.toggle('rainbow', mode === 'rainbow');
  for (const b of document.querySelectorAll('[data-plain]')) b.classList.toggle('on', b.dataset.plain === mode);
  if (mode !== 'cursor') stopRing();
}

// Cursor mode: the app's ring (ring.js) follows the pointer while one of the ring
// pills is picked, and the page edge goes empty, as in the app.
const ring = document.getElementById('cursor-ring');
let ringOn = false, pointer = null;
function stopRing() {
  ringOn = false;
  ring.hidden = true;
  for (const b of document.querySelectorAll('[data-cursor]')) b.classList.remove('on');
}
function placeRing() {
  if (!pointer) return;
  ring.style.transform = `translate(${pointer.x - 70}px, ${pointer.y - 70}px)`;
}
// Follow the pointer as closely as the browser allows: the faster raw updates where
// there are any, and the browser's prediction of where the pointer is heading.
function follow(e) {
  if (e.pointerType !== 'mouse') return;
  const ahead = e.getPredictedEvents?.().at(-1) ?? e;
  pointer = { x: ahead.clientX, y: ahead.clientY };
  if (ringOn) { ring.hidden = false; placeRing(); }
}
addEventListener('onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove', follow, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { if (ringOn) ring.hidden = true; });
// Only Wave loads with the page. The other scenes and the ring load when the visitor
// gets near the bar picker, or at the latest when they tap a pill.
const loaded = {};
function load(src) {
  return (loaded[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.append(s);
  }));
}
const EXTRA = { aurora: 'scenes/aurora.js', grass: 'scenes/grass.js', sunrise: 'scenes/sunrise.js', snow: 'scenes/snow.js' };
const loadExtras = () => Promise.all([...Object.values(EXTRA), 'ring.js'].map(load)).catch(() => {});
new IntersectionObserver((entries, watcher) => {
  if (entries.some((e) => e.isIntersecting)) { loadExtras(); watcher.disconnect(); }
}, { rootMargin: '400px' }).observe(document.querySelector('.pick'));
for (const b of document.querySelectorAll('[data-style]')) {
  const src = EXTRA[b.dataset.style];
  if (!src) continue;
  b.addEventListener('click', () => {
    if (Scene.has(b.dataset.style)) return;
    load(src).then(() => { if (b.classList.contains('on')) Breath.look(b.dataset.style); });
  });
}

for (const b of document.querySelectorAll('[data-cursor]')) {
  b.addEventListener('click', async (e) => {
    await load('ring.js');
    Breath.look('none'); // an empty page edge
    const edgeCanvas = document.getElementById('scene'), g = edgeCanvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, edgeCanvas.width, edgeCanvas.height);
    setBar('cursor');
    // As set in the app: Size 100 (the drawing is the size plus 32, as in main.js), and
    // 70% transparency for the rainbow ring, 60% for the wave.
    Ring.configure({ ringStyle: b.dataset.cursor, colorMode: b.dataset.cursor === 'glow' ? 'rainbow' : 'single', color: '#5b8cff' }, 132);
    ring.style.opacity = b.dataset.cursor === 'glow' ? 0.3 : 0.4;
    ringOn = true;
    for (const other of document.querySelectorAll('[data-cursor]')) other.classList.toggle('on', other === b);
    pointer = pointer ?? { x: e.clientX, y: e.clientY };
    ring.hidden = false;
    placeRing();
  });
}
Breath.on((s) => { if (ringOn) Ring.draw(s.level, s.glow, performance.now()); });
for (const b of document.querySelectorAll('[data-plain]')) b.addEventListener('click', () => { Breath.look('plain-' + b.dataset.plain); setBar(b.dataset.plain); });
for (const b of document.querySelectorAll('[data-style]')) b.addEventListener('click', () => setBar('scene'));

// Any blue-warning link on the page opens the folded steps.
for (const a of document.querySelectorAll('a[href="#first-run-warning"]')) a.addEventListener('click', () => { document.getElementById('first-run-warning').open = true; });

(() => {
  const src = document.getElementById('scene'), dst = document.getElementById('desk-scene');
  const ctx = dst.getContext('2d');
  function frame() {
    requestAnimationFrame(frame);
    if (desk.dataset.bar !== 'scene') return;
    const h = dst.clientHeight, sh = src.clientHeight;
    if (h && sh && src.width && src.height) {
      const w = Math.max(6, Math.round(src.clientWidth * h / sh));
      if (dst.style.width !== w + 'px') { dst.style.width = w + 'px'; desk.style.setProperty('--scene-bar', w + 'px'); }
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (dst.width !== Math.round(w * dpr) || dst.height !== Math.round(h * dpr)) { dst.width = Math.round(w * dpr); dst.height = Math.round(h * dpr); }
      ctx.clearRect(0, 0, dst.width, dst.height);
      ctx.drawImage(src, 0, 0, dst.width, dst.height);
    }
  }
  requestAnimationFrame(frame);
})();


// The label beside the bar fades once the visitor scrolls past the top.
const barLabel = document.getElementById('bar-label');
addEventListener('scroll', () => barLabel.classList.toggle('gone', scrollY > 120), { passive: true });

// ---------- Anonymous visit statistics ----------
// A few counts sent to PostHog (EU), the same service the app uses: the visit,
// which parts of the page were seen, and which buttons were clicked. No cookies
// and nothing stored in the browser: the ID is random and lasts only for this
// page view, so visits can't be linked to each other or to a person.
// Only breathbar.app sends; a copy opened anywhere else just logs to the console.
const Stats = (() => {
  const LIVE = location.hostname === 'breathbar.app';
  const HOST = 'https://eu.i.posthog.com';
  const TOKEN = 'phc_wonXbJTvvXBJkvp2oKBV9q5SaPYxGVdZEYV2rhEF5m9g'; // the project's public key
  const id = 'visit-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const started = performance.now();
  const query = new URLSearchParams(location.search);
  let referrer = '';
  try { referrer = document.referrer ? new URL(document.referrer).hostname : ''; } catch {}
  const common = {
    $lib: 'breath-bar-site',
    $process_person_profile: false,
    $current_url: location.origin + location.pathname,
    $pathname: location.pathname,
    $referring_domain: referrer || '$direct',
    $screen_width: screen.width,
    $viewport_width: innerWidth,
    $device_type: /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
    language: navigator.language,
    utm_source: query.get('utm_source') || undefined,
    utm_medium: query.get('utm_medium') || undefined,
    utm_campaign: query.get('utm_campaign') || undefined,
  };
  function send(event, props = {}) {
    const item = { event, distinct_id: id, timestamp: new Date().toISOString(), properties: { ...common, ...props } };
    if (!LIVE) { console.log('[stats]', event, props); return; }
    try {
      fetch(HOST + '/batch/', {
        method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ api_key: TOKEN, batch: [item] }),
      }).catch(() => {});
    } catch {}
  }

  // Sections seen, once each.
  const seen = new Set();
  const watch = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const name = e.target.dataset.section;
      if (e.isIntersecting && !seen.has(name)) { seen.add(name); send('section_seen', { section: name }); }
    }
  }, { threshold: 0.4 });
  for (const el of document.querySelectorAll('[data-section]')) watch.observe(el);

  // How far down the page they got, and for how long, when they leave.
  let deepest = 0;
  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0) deepest = Math.max(deepest, Math.round(scrollY / max * 100));
  }, { passive: true });
  let left = false;
  function leave() {
    if (left) return;
    left = true;
    send('$pageleave', { scrolled_percent: deepest, seconds_on_page: Math.round((performance.now() - started) / 1000) });
  }
  addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });

  send('$pageview');
  return { send };
})();

// Clicks on the download, coming-soon and buy buttons, and on the bar picker.
for (const link of document.querySelectorAll('[data-get]')) {
  link.addEventListener('click', () => {
    const where = link.closest('[data-section]')?.dataset.section ?? 'page';
    const get = link.dataset.get;
    if (get === 'windows') Stats.send('download_clicked', { where });
    else if (get === 'android') Stats.send('coming_soon_clicked', { where });
    else Stats.send('buy_clicked', { where, plan: get });
  });
}
for (const b of document.querySelectorAll('.looks button')) {
  b.addEventListener('click', () => Stats.send('bar_picked', { bar: b.dataset.plain ?? b.dataset.style }));
}

// Always open at the top (Safari otherwise puts a reloaded page back where it was),
// unless the link points at a part of the page.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash === '#more') history.replaceState(null, '', location.pathname + location.search);
const toTop = () => { if (!location.hash) scrollTo(0, 0); };
toTop();
addEventListener('load', toTop);
addEventListener('pageshow', toTop);
for (const a of document.querySelectorAll('a[href="#more"]')) {
  a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('more').scrollIntoView({ behavior: 'smooth' }); });
}

Breath.start();
