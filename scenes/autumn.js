// Autumn: eight scenes, picked from the Autumn button's menu. This file has
// what they share (leaf shapes, where the breath reaches, a soft backdrop)
// and the Leaf pile; the others are in scenes/autumn-*.js.
const Autumn = (() => {
  const LEAF_COLORS = ['#e8622a', '#f0a030', '#c8321e', '#f2c94c', '#b5481c', '#d9502a', '#e98a2c'];
  const VEIN = 'rgba(70, 25, 8, 0.5)';

  // Leaf shapes, drawn around (0, 0) with size s, the stem towards +y:
  // plain, maple, oak, birch, ginkgo, willow.
  const SHAPES = [
    (c, s) => {
      c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(0, -s * 0.75, s, 0); c.quadraticCurveTo(0, s * 0.75, -s, 0); c.fill();
      c.beginPath(); c.moveTo(-s, 0); c.lineTo(s, 0); c.stroke();
    },
    (c, s) => {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.42 : s * (i === 0 ? 1.05 : 0.9);
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, -s * 0.8); c.lineTo(0, s * 1.2); c.stroke();
    },
    (c, s) => {
      const edge = (i) => Math.sin((i / 8) * Math.PI) * s * 0.55 * (i % 2 ? 1 : 0.72);
      c.beginPath(); c.moveTo(0, -s * 1.1);
      for (let i = 0; i <= 8; i++) c.lineTo(edge(i), -s * 1.1 + i * s * 0.27);
      for (let i = 8; i >= 0; i--) c.lineTo(-edge(i), -s * 1.1 + i * s * 0.27);
      c.fill();
      c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s * 1.3); c.stroke();
    },
    (c, s) => {
      c.beginPath(); c.moveTo(0, -s);
      c.bezierCurveTo(s * 0.7, -s * 0.6, s * 0.6, s * 0.4, 0, s * 0.9);
      c.bezierCurveTo(-s * 0.6, s * 0.4, -s * 0.7, -s * 0.6, 0, -s);
      c.fill();
      c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s * 1.2); c.stroke();
    },
    (c, s) => {
      c.beginPath(); c.moveTo(0, s * 0.9); c.lineTo(-s * 0.95, -s * 0.35);
      c.quadraticCurveTo(-s * 0.5, -s * 0.85, -s * 0.06, -s * 0.5); c.lineTo(0, -s * 0.35); c.lineTo(s * 0.06, -s * 0.5);
      c.quadraticCurveTo(s * 0.5, -s * 0.85, s * 0.95, -s * 0.35); c.closePath(); c.fill();
    },
    (c, s) => {
      c.beginPath(); c.moveTo(-s * 1.3, 0); c.quadraticCurveTo(0, -s * 0.35, s * 1.3, 0); c.quadraticCurveTo(0, s * 0.35, -s * 1.3, 0); c.fill();
    },
  ];

  function leaf(ctx, u, v, size, turn, color, shape, alpha = 1) {
    ctx.save();
    ctx.translate(u, v);
    ctx.rotate(turn);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = VEIN;
    ctx.lineWidth = 0.5;
    SHAPES[shape](ctx, size);
    ctx.restore();
  }

  // Where the breath reaches. Like Snow, a little stays on screen when the
  // breath is empty, and it only slides away during a real hold at empty.
  const POOL = 15;
  const frontOf = (s) => POOL + s.front * (1 - POOL / s.L) - awayAt(s) * (POOL + Math.max(30, s.T * 0.6));

  // Leaves and other details are made for a bar about 56px wide: this shrinks
  // them on thinner bars, but not so far that they vanish.
  const sizeOf = (s) => Math.min(1, Math.max(0.45, s.T / 30));

  // A soft background from the ground to a little beyond `front`: `stops` are
  // [0–1, color] along it. Fades towards the bar's inner edge.
  function backdrop(ctx, s, front, stops, from = 0.8) {
    const reach = front + s.T * 0.6;
    if (reach <= 0) return;
    const g = ctx.createLinearGradient(0, 0, reach, 0);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fill(dome(s, reach, s.T, 0.04));
    fadeTop(ctx, s, from);
  }

  return { LEAF_COLORS, SHAPES, leaf, frontOf, sizeOf, backdrop };
})();

// Leaf pile: a pile of fallen leaves at dusk, lit from behind by a warm glow. As
// you breathe in, the pile grows along the bar and leaves drift down onto it.
// As you breathe out, the wind lifts leaves off its top and blows them away.
(() => {
  const { LEAF_COLORS, SHAPES, leaf } = Autumn;
  const LEAVES_PER_PX = 1 / 40; // how densely the pile is packed

  // The pile's leaves are drawn once into an image the length of the bar; each
  // frame shows the part the breath has reached.
  function build(m, L, T) {
    const rnd = seeded(211);
    m.L = L; m.T = T;
    const [canvas, c] = offscreen(L, T);
    const count = Math.round(L * T * LEAVES_PER_PX);
    for (let i = 0; i < count; i++) {
      const color = mixColor(LEAF_COLORS[i % LEAF_COLORS.length], rnd() < 0.5 ? '#000000' : '#ffffff', rnd() * 0.22);
      leaf(c, rnd() * L, rnd() * T, 2.6 + rnd() * 2.6, rnd() * TAU, color, Math.floor(rnd() * SHAPES.length));
    }
    m.pile = canvas;
    m.falling = Array.from({ length: Math.max(3, Math.round(T / 11)) }, (_, i) => ({
      u: Infinity, v: 0, speed: 26 + rnd() * 18, phase: rnd() * TAU, shape: i % SHAPES.length,
      color: mixColor(LEAF_COLORS[i % LEAF_COLORS.length], '#000000', 0.45),
    }));
    m.blown = Array.from({ length: Math.max(4, Math.round(T / 5)) }, (_, i) => ({
      life: 0, shape: i % SHAPES.length, color: LEAF_COLORS[i % LEAF_COLORS.length],
    }));
    m.fallOn = 1;
  }

  Scene.register('autumn-pile', {
    draw(ctx, s) {
      const { L, T, dt, time, memory: m } = s;
      if (m.L !== L || m.T !== T) build(m, L, T);
      const front = Autumn.frontOf(s);
      const top = (v) => front - 3 - Math.sin(v * 0.35) * 2.2 - Math.sin(v * 0.9);

      // Dusk sky over the pile, orange near the ground and purple further out,
      // with a warm glow behind the pile's top.
      if (front + T * 0.6 > 0) {
        const reach = front + T * 0.6;
        const sky = ctx.createLinearGradient(0, 0, reach, 0);
        sky.addColorStop(0, 'rgba(168, 70, 31, 0.8)');
        sky.addColorStop(Math.max(0, Math.min(1, front / reach)), 'rgba(106, 44, 42, 0.75)');
        sky.addColorStop(1, 'rgba(42, 24, 48, 0)');
        ctx.fillStyle = sky;
        ctx.fill(dome(s, reach, T, 0.04));
        const glow = ctx.createRadialGradient(front, T / 2, 2, front, T / 2, Math.max(T, 40) * 0.9);
        glow.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
        glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
        ctx.fillStyle = glow;
        ctx.fill(dome(s, reach, T, 0.04));
        fadeTop(ctx, s, 0.8);
      }

      // The pile: leaves up to its bumpy top, darker deep down and lit near the top.
      if (front > -6) {
        const pile = new Path2D();
        pile.moveTo(0, 0);
        for (let v = 0; v <= T; v += 2) pile.lineTo(Math.max(0, top(v)), v);
        pile.lineTo(0, T);
        pile.closePath();
        ctx.save();
        ctx.clip(pile);
        ctx.fillStyle = '#3a1408';
        ctx.fillRect(0, 0, Math.max(0, front), T);
        ctx.drawImage(m.pile, 0, 0);
        const shade = ctx.createLinearGradient(front, 0, Math.max(0, front - 240), 0);
        shade.addColorStop(0, 'rgba(255, 180, 90, 0.18)');
        shade.addColorStop(0.1, 'rgba(40, 10, 4, 0)');
        shade.addColorStop(1, 'rgba(40, 10, 4, 0.55)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, Math.max(0, front), T);
        ctx.restore();
        // A warm rim of light along the top.
        ctx.beginPath();
        for (let v = 0; v <= T; v += 2) ctx.lineTo(top(v), v);
        ctx.strokeStyle = 'rgba(255, 200, 110, 0.75)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      // Breathing in (or holding): leaves drift down onto the pile, dark against the glow.
      const exhaling = s.velocity < -1;
      m.fallOn += ((exhaling ? 0 : 1) - m.fallOn) * Math.min(1, dt * 4);
      for (const f of m.falling) {
        f.u -= f.speed * dt;
        if (f.u <= front || f.u > front + 200) { // landed, or left far behind: start again above
          f.u = front + 40 + Math.random() * 120;
          f.v = Math.random() * T;
        }
        if (m.fallOn < 0.02) continue;
        const appear = Math.min(1, (front + 160 - f.u) / 40);
        const v = f.v + Math.sin(time * 2 + f.phase) * Math.min(6, T * 0.15);
        leaf(ctx, f.u, v, 4, Math.sin(time * 2.5 + f.phase) * 0.9 + f.phase, f.color, f.shape, Math.max(0, appear) * m.fallOn);
      }

      // Breathing out: the wind lifts leaves off the top and blows them across.
      for (const b of m.blown) {
        if (b.life <= 0) {
          if (!exhaling || front < 4) continue;
          Object.assign(b, {
            u: front, v: Math.random() * T, du: 14 + Math.random() * 18,
            dv: (25 + Math.random() * 35) * Math.max(0.5, T / 56), turn: Math.random() * TAU, life: 0.8 + Math.random() * 0.6,
          });
        }
        b.life -= dt;
        b.u += b.du * dt;
        b.v = (((b.v + b.dv * dt) % T) + T) % T;
        b.du -= 22 * dt;
        b.turn += dt * 6;
        leaf(ctx, b.u, b.v, 3.6, b.turn, b.color, b.shape, Math.max(0, Math.min(1, b.life * 2)));
      }
    },
  });
})();
