// ---------- Where the downloads and Pro live ----------
// Fill these in before launch (see README.md). Until then those buttons say they
// open at launch, rather than going nowhere.
const LINKS = {
  windows: 'https://github.com/simon-jordan-dev/breath-bar-site/releases/latest/download/Breath-Bar-Setup.exe', // always the newest installer (see the app's README)
  android: '', // the Google Play listing
  pro: '',     // the Lemon Squeezy checkout link for Pro
};

const $ = (id) => document.getElementById(id);

// ---------- The breath: the same rhythm and curve as the app (bar.js) ----------
const TECHNIQUES = {
  resonance: { name: 'Resonance breathing', why: 'Slow, even and easy to keep up with.', phases: [{ type: 'inhale', seconds: 5.5, to: 1 }, { type: 'exhale', seconds: 5.5, to: 0 }] },
  box: { name: 'Box breathing', why: 'Four equal counts that give your attention something steady to follow.', phases: [{ type: 'inhale', seconds: 4, to: 1 }, { type: 'hold', seconds: 4 }, { type: 'exhale', seconds: 4, to: 0 }, { type: 'hold', seconds: 4 }] },
  sigh: { name: 'Double sigh', why: 'A double inhale, then a long, slow exhale.', phases: [{ type: 'inhale', seconds: 2.5, to: 0.8 }, { type: 'inhale', seconds: 1, to: 1 }, { type: 'exhale', seconds: 6.5, to: 0 }] },
  478: { name: '4-7-8 breathing', why: 'A long hold and a long exhale, often used for winding down.', phases: [{ type: 'inhale', seconds: 4, to: 1 }, { type: 'hold', seconds: 7 }, { type: 'exhale', seconds: 8, to: 0 }] },
};
const FIRST_BREATH = [{ type: 'inhale', seconds: 5.5, to: 1 }, { type: 'exhale', seconds: 5.5, to: 0 }];
const SLOWDOWN = { inhale: 5, exhale: 6 };
const CUES = { inhale: 'Breathe in', hold: 'Hold', exhale: 'Breathe out' };
const TILE_WORDS = { inhale: 'In', hold: 'Hold', exhale: 'Out' };
const GLIDE_SECONDS = 0.6; // after switching technique, glide to the new place in the breath

let phases = TECHNIQUES.resonance.phases;
let startedAt = performance.now();
let level = 0, gap = 0, lastFrame = performance.now();
let style = 'solid';

function ease(p, k) {
  const progress = (x) => 1 - Math.exp(-k * x) * (1 + k * x);
  return progress(p) / progress(1);
}

function breathAt(seconds, list = phases) {
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

// scene.js asks this of the bar's color.
function isBright(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3;
}

const stillMotion = matchMedia('(prefers-reduced-motion: reduce)');
const BAR_COLOR = '#3b82f6';
let shownCue = '';

function draw(state, dt) {
  $('bar-fill').style.transform = `scaleY(${level.toFixed(4)})`;
  $('mini-fill').style.transform = `scaleY(${level.toFixed(4)})`;
  if (style !== 'solid') Scene.draw(level, state.glow, dt);
  const cue = CUES[state.type];
  if (cue !== shownCue) $('cue').textContent = shownCue = cue;
  [...$('tiles').children].forEach((tile, i) => tile.classList.toggle('now', i === state.index));
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  gap *= Math.exp(-dt / GLIDE_SECONDS);
  const state = breathAt((now - startedAt) / 1000);
  level = Math.min(1, Math.max(0, state.level + gap));
  draw(state, dt);
  drawFirstBreath(now);
  requestAnimationFrame(frame);
}

// With reduced motion, hold the bar still at a part-full resting place.
function startMotion() {
  if (stillMotion.matches) {
    level = 0.6;
    draw({ glow: 0, type: 'inhale', index: 0 }, 0);
    $('cue').hidden = true;
    return;
  }
  requestAnimationFrame(frame);
}

// ---------- One guided breath ----------
let fbStartedAt = null; // while it's breathing
let fbFinished = false; // narrowed into the bar, which keeps breathing

function startFirstBreath() {
  fbFinished = false;
  $('first-breath').hidden = false;
  $('fb-fill').classList.remove('thin');
  $('fb-cue').hidden = false;
  $('fb-reveal').hidden = true;
  $('fb-skip').hidden = false;
  document.body.style.overflow = 'hidden';
  $('fb-skip').focus({ preventScroll: true });
  if (stillMotion.matches) return finishFirstBreath();
  fbStartedAt = performance.now();
}

function finishFirstBreath() {
  fbFinished = true;
  $('fb-fill').classList.add('thin');
  if (stillMotion.matches) $('fb-fill').style.transform = 'scaleY(0.6)';
  $('fb-cue').hidden = true;
  $('fb-skip').hidden = true;
  $('fb-reveal').hidden = false;
  $('fb-get').focus({ preventScroll: true });
}

function closeFirstBreath() {
  fbStartedAt = null;
  $('first-breath').hidden = true;
  document.body.style.overflow = '';
}

function drawFirstBreath(now) {
  if (fbStartedAt === null) return;
  const seconds = (now - fbStartedAt) / 1000;
  const total = FIRST_BREATH.reduce((sum, ph) => sum + ph.seconds, 0);
  if (seconds >= total && !fbFinished) finishFirstBreath();
  const state = breathAt(seconds, FIRST_BREATH);
  $('fb-fill').style.transform = `scaleY(${state.level.toFixed(4)})`;
  const cue = CUES[state.type];
  if (!fbFinished && $('fb-cue').textContent !== cue) $('fb-cue').textContent = cue;
}

function goToDownload() {
  closeFirstBreath();
  $('download').scrollIntoView({ block: 'center' });
  $('download').focus({ preventScroll: true });
}

$('try-breath').addEventListener('click', startFirstBreath);
$('fb-again').addEventListener('click', startFirstBreath);
$('fb-skip').addEventListener('click', closeFirstBreath);
$('fb-get').addEventListener('click', goToDownload);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('first-breath').hidden) closeFirstBreath(); });

// ---------- What brings you here: the answer changes the bar on this page ----------
let current = 'resonance';

function showTechnique(id) {
  const t = TECHNIQUES[id];
  current = id;
  const before = level;
  phases = t.phases;
  startedAt = performance.now();
  gap = stillMotion.matches ? 0 : before - breathAt(0).level;
  $('suggest-name').textContent = t.name;
  $('suggest-why').textContent = t.why;
  $('tiles').replaceChildren(...phases.map((ph) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.append(String(ph.seconds));
    const word = document.createElement('small');
    word.textContent = TILE_WORDS[ph.type];
    tile.append(word);
    return tile;
  }));
  const cycle = phases.reduce((sum, ph) => sum + ph.seconds, 0);
  $('timing').textContent = `About ${(60 / cycle).toFixed(1)} breaths a minute`;
}

// Picked goals, in the order they appear. The first decides; any others are one tap away.
function pickedButtons() { return [...$('goals').children].filter((b) => b.getAttribute('aria-pressed') === 'true'); }

function showAnswers() {
  const picked = pickedButtons();
  const ids = [...new Set(picked.map((b) => b.dataset.technique))];
  if (!ids.includes(current)) showTechnique(ids[0] ?? 'resonance');
  const rest = ids.filter((id) => id !== current);
  $('others').hidden = !rest.length;
  $('others').replaceChildren('Also a match:', ...rest.map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = TECHNIQUES[id].name;
    b.addEventListener('click', () => { showTechnique(id); showAnswers(); });
    return b;
  }));
}

for (const b of $('goals').children) {
  b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    showAnswers();
  });
}

// ---------- Choosing a look ----------
function setStyle(next) {
  style = next;
  const scene = style !== 'solid';
  $('bar').hidden = scene;
  $('scene').hidden = !scene;
  if (scene) Scene.configure({ style, edge: 'right', color: BAR_COLOR, colorMode: 'single' });
  if (stillMotion.matches) draw({ glow: 0, type: 'inhale', index: 0 }, 0.016);
}

for (const b of $('styles').children) {
  b.addEventListener('click', () => {
    for (const other of $('styles').children) other.classList.toggle('on', other === b);
    setStyle(b.dataset.style);
  });
}

// ---------- The real clip, when there is one ----------
$('clip').addEventListener('loadeddata', () => {
  $('clip').hidden = false;
  $('mock').hidden = true;
});
$('clip').addEventListener('error', () => $('clip').remove());

// ---------- Downloads and Pro ----------
let toastTimer = null;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

// On an Android phone, the Android button comes first and stands out.
if (/Android/i.test(navigator.userAgent)) {
  const row = document.querySelector('.get-row'), store = row.querySelector('.store');
  store.className = 'download';
  row.querySelector('#download').className = 'store';
  row.prepend(store);
}

const NOT_YET = { windows: 'The Windows download opens at launch.', android: 'Android is coming soon.', pro: 'Pro goes on sale very soon. The free app has everything you need to start.' };
for (const link of document.querySelectorAll('[data-get]')) {
  const url = LINKS[link.dataset.get];
  if (url) link.href = url;
  else link.addEventListener('click', (e) => { e.preventDefault(); toast(NOT_YET[link.dataset.get]); });
}

showTechnique('resonance');
startMotion();
