// ---------- Where the downloads and Pro live ----------
// Fill these in before launch (see README.md). Until then those buttons say they
// open at launch, rather than going nowhere.
const LINKS = {
  windows: 'https://github.com/simon-jordan-dev/breath-bar-site/releases/latest/download/Breath-Bar-Setup.exe', // always the newest installer (see the app's README)
  android: '', // the Google Play listing
  pro: '',     // the Stripe checkout for Pro, once it's live
};

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
Breath.look('wave', { edge: 'right', color: '#5b8cff' });

// Copy the page-edge scene into the mock's bar every frame, at the same
// proportions, so the desk shows exactly what the page edge shows.
const desk = document.querySelector('.desk'), edge = document.querySelector('.edge.thin');
function setBar(mode) {
  desk.dataset.bar = mode;
  edge.classList.toggle('rainbow', mode === 'rainbow');
  for (const b of document.querySelectorAll('[data-plain]')) b.classList.toggle('on', b.dataset.plain === mode);
}
for (const b of document.querySelectorAll('[data-plain]')) b.addEventListener('click', () => { Breath.look('solid'); setBar(b.dataset.plain); });
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

const CAPTIONS = {
  write: 'Your clicks go straight through the bar, so it never blocks a scrollbar or a button.',
  code: 'It sits at the edge of your vision. Glance over between thoughts, and ignore it when you\'re deep in something.',
  call: 'In a call, you still see the bar. The people you share your screen with don\'t.',
};
for (const b of document.querySelectorAll('.tabs button')) {
  b.addEventListener('click', () => {
    for (const other of document.querySelectorAll('.tabs button')) other.classList.toggle('on', other === b);
    for (const set of document.querySelectorAll('.scene-set')) set.classList.toggle('on', set.dataset.set === b.dataset.set);
    document.getElementById('caption').textContent = CAPTIONS[b.dataset.set];
  });
}

const REPLIES = {
  short: '<b>That\'s the usual one.</b> Look at the bar on the right and match it: in as it rises, out as it falls. Three breaths is enough to feel the difference in pace.',
  held: '<b>Very common while reading or typing.</b> Let it go, then follow the bar on the right: in as it rises, out as it falls.',
  fine: '<b>Nice.</b> The hard part is keeping that pace once you\'re busy again. That\'s what the bar on the right is for: it stays there so you don\'t have to remember.',
  unsure: '<b>Fair enough, almost nobody does.</b> Watch the bar on the right for a moment and breathe with it: in as it rises, out as it falls.',
};
for (const b of document.querySelectorAll('.answers button')) {
  b.addEventListener('click', () => {
    for (const other of document.querySelectorAll('.answers button')) other.classList.toggle('on', other === b);
    document.getElementById('reply').innerHTML = REPLIES[b.dataset.a];
  });
}

Breath.start();
