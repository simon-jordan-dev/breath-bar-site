// Grass: fine, wispy blades along the bar in a mix of dark greens. As you breathe
// in, grass appears where the breath reaches, leans and sways softly; beyond
// it there's nothing. Breathing out, the blades ease back and fade away.
//
// The blades are only about a pixel wide, so they're drawn at twice the size and
// scaled down, which smooths their edges. Only blades the breath has reached are drawn.
Scene.register('grass', {
  draw(ctx, s) {
    const { L, T, time, memory: m } = s;
    const LEVELS = 16, SCALE = 2; // enough levels that blades change smoothly, not in steps
    // Each blade is one of these greens: [at rest, fully reached].
    const GREENS = [
      ['#0d2410', '#3d8a3a'], // deep green
      ['#222a0c', '#7a8a2a'], // olive
      ['#0c2620', '#2e8466'], // blue-green
      ['#1a300d', '#69a032'], // yellow-green
    ];
    // Darker at the root and a little lighter at the tip, so the grass stands out from the screen edge.
    const shaded = (c, color) => {
      const g = c.createLinearGradient(0, 0, 0, T);
      g.addColorStop(0, mixColor(color, '#050c05', 0.5));
      g.addColorStop(0.6, color);
      g.addColorStop(1, mixColor(color, '#e8ffb0', 0.15));
      return g;
    };
    const blade = (p, b, lean) => {
      const tipU = b.u + Math.sin(lean) * b.h, tipV = Math.cos(lean) * b.h;
      const midU = b.u + Math.sin(lean * 0.45) * b.h * 0.55, midV = Math.cos(lean * 0.45) * b.h * 0.55;
      p.moveTo(b.u - b.w / 2, 0);
      p.quadraticCurveTo(midU - b.w * 0.3, midV, tipU, tipV);
      p.quadraticCurveTo(midU + b.w * 0.3, midV, b.u + b.w / 2, 0);
      p.closePath();
    };

    if (m.L !== L || m.T !== T) {
      const rnd = seeded(61);
      m.L = L; m.T = T;
      m.blades = [];
      for (let u = rnd(); u < L; u += 0.8 + rnd() * 1.2) {
        m.blades.push({
          u,
          h: T * (0.6 + rnd() * 0.4),
          w: 1.1 + rnd() * 0.8,          // width at the root
          lean: (rnd() - 0.5) * 0.3,     // its natural angle
          phase: rnd() * TAU,
          green: Math.floor(rnd() * GREENS.length),
          ragged: (rnd() - 0.5) * 14, // shows a little before or after its neighbours, so the edge isn't a straight line
        });
      }
      m.bend = new Float32Array(m.blades.length);
      m.shown = new Float32Array(m.blades.length);
      // The big canvas the blades are drawn on before scaling down.
      [m.big, m.bctx] = offscreen(L * SCALE, T * SCALE);
    }

    // Each blade shows as soon as the breath reaches it, over a short, crisp edge; only
    // its lean eases along behind. Find how far the grass reaches.
    const k = Math.min(1, s.dt * 4);
    let reach = 0;
    m.blades.forEach((b, i) => {
      m.shown[i] = activeAt(b.u + b.ragged, s, 16);
      m.bend[i] += (m.shown[i] - m.bend[i]) * k;
      if (m.shown[i] > 0.01) reach = b.u + b.h;
    });
    const to = Math.min(L, Math.ceil(reach));
    if (to <= 0) return;

    // Blades grouped by green and by how far they're reached, each group filled once.
    const big = m.bctx;
    big.setTransform(1, 0, 0, 1, 0, 0);
    big.clearRect(0, 0, to * SCALE, T * SCALE);
    big.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    const groups = GREENS.map(() => buckets(LEVELS));
    m.blades.forEach((b, i) => {
      const w = m.bend[i], shown = m.shown[i];
      if (shown <= 0.01) return;
      const lean = b.lean + w * 0.2 + w * 0.18 * Math.sin(time * 1.6 + b.phase) + w * 0.04 * Math.sin(time * 1.1 + b.phase);
      blade(groups[b.green][Math.round(shown * (LEVELS - 1))], b, lean);
    });
    groups.forEach((levels, g) => levels.forEach((path, j) => {
      const lit = j / (LEVELS - 1);
      big.globalAlpha = lit;
      big.fillStyle = shaded(big, mixColor(GREENS[g][0], GREENS[g][1], lit));
      big.fill(path);
    }));
    big.globalAlpha = 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(m.big, 0, 0, to * SCALE, T * SCALE, 0, 0, to, T);
  },
});
