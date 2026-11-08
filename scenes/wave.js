// Wave: the sea seen from the side, with nothing drawn beyond the water.
// - The water's surface is never straight: swells roll along it to the front.
// - At the front a wave keeps breaking: it builds, curls over with a little
//   spray, collapses, and runs ahead as a thin film of foam.
// - While the water drains away (exhale) the waves calm down and the front
//   slopes down to the screen's edge.
// Always in sea colors: deep blue far out, lighter turquoise towards the shore.
Scene.register('wave', {
  draw(ctx, s) {
    const { L, T, dt, time, velocity, memory: m } = s;
    m.calm ??= 0; m.spray ??= []; m.bubbles ??= [];
    // The sea's colors along the bar: deep at the start, lighter near the shore.
    const sea = (alpha, upTo = L) => {
      const g = ctx.createLinearGradient(0, 0, Math.max(upTo, 1), 0);
      g.addColorStop(0, `rgba(8, 46, 96, ${alpha})`);
      g.addColorStop(0.55, `rgba(18, 104, 168, ${alpha})`);
      g.addColorStop(0.9, `rgba(46, 168, 205, ${alpha})`);
      g.addColorStop(1, `rgba(120, 215, 230, ${alpha})`);
      return g;
    };
    if (!m.streaks) {
      const rnd = seeded(97);
      // Foam lines lying along the surface, drifting slowly with the swells.
      m.streaks = Array.from({ length: 22 }, () => ({ x: rnd(), depth: 0.06 + rnd() * 0.16, len: 30 + rnd() * 50 }));
    }

    // Calm down while the water drains away; liven up when it comes back in.
    m.calm += ((velocity < -5 ? 1 : 0) - m.calm) * Math.min(1, dt * 2);
    const calm = m.calm;

    // How far the water runs ahead of the breath: a thin film of foam, then
    // the slope down to the edge.
    const cycle = (time / 3) % 1;
    const swash = (10 + 11 * (1 + Math.cos(TAU * cycle))) * (1 - calm);
    const taper = 18 + 40 * calm;
    // A small pool of water stays on screen when the breath is empty, clear of
    // rounded screen corners, so the wave turns straight round into the next
    // inhale. Only during a real hold at empty does it slide away, and it
    // slides back as the inhale starts.
    const POOL = 5;
    const resting = s.level < 0.0005;
    m.away ??= 0;
    m.away += ((resting ? 1 : 0) - m.away) * Math.min(1, dt * (resting ? 2 : 6));
    const front = POOL + s.front * (1 - POOL / L) - smoothstep(m.away) * (POOL + swash + taper);

    // The water surface: swells rolling towards the front (+u).
    const swell = (u) =>
      0.13 * Math.sin(TAU * (u / 190 - time * 0.32)) +
      0.08 * Math.sin(TAU * (u / 87 - time * 0.55) + 1.3) +
      0.045 * Math.sin(TAU * (u / 37 - time * 0.9) + 2.1);
    const calmness = 0.35 + 0.65 * (1 - calm);
    // The breaking wave near the front: builds up, curls and collapses every ~3 s.
    const zone = Math.max(30, Math.min(front, Math.max(60, Math.min(150, T * 3))));
    const breaker = Math.sin(Math.PI * cycle) * (1 - calm * 0.8); // 0 → 1 → 0
    // Sized so the highest swell and crest together, with their foam, fit in the bar.
    const surface = (u) => {
      let h = 0.45 + 0.85 * swell(u) * calmness;
      const x = (u - (front - zone)) / zone; // 0 at start of the break zone, 1 at the front
      if (x > 0) h += 0.3 * breaker * Math.pow(smoothstep(x / 0.85), 1.6);
      return h * (T - 4);
    };

    const pts = [];
    for (let u = 0; u < front; u += 3) pts.push([u, surface(u)]);
    const crestH = surface(front);

    // The front: while the wave breaks, the crest curls forward and drops;
    // otherwise (and especially while draining) it slopes down to the edge.
    const lip = zone * 0.18 * breaker;
    const dropV = crestH * (1 - 0.45 * breaker);
    const end = front + swash + taper;
    if (end < 0.5) return; // fully off the screen
    const frontEdge = (path) => {
      path.lineTo(front, crestH);
      path.quadraticCurveTo(front + lip, crestH, front + lip * 0.6, dropV);
      path.bezierCurveTo(front + lip * 0.4 + taper * 0.3, dropV * 0.45, end - taper * 0.5, T * 0.04, end, 0);
    };

    const water = new Path2D();
    water.moveTo(0, 0);
    for (const [u, v] of pts) water.lineTo(u, v);
    frontEdge(water);
    water.closePath();

    // Body: the water's colors, darker in the deep, lighter towards the surface.
    ctx.fillStyle = sea(0.92, front + 40);
    ctx.fill(water);
    const depth = ctx.createLinearGradient(0, 0, 0, T);
    depth.addColorStop(0, 'rgba(0,0,0,0.28)');
    depth.addColorStop(0.6, 'rgba(0,0,0,0)');
    depth.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.fillStyle = depth;
    ctx.fill(water);
    // Shallower, lighter water through the break zone.
    const shallow = ctx.createLinearGradient(Math.max(0, front - zone), 0, end, 0);
    shallow.addColorStop(0, 'rgba(255,255,255,0)');
    shallow.addColorStop(1, 'rgba(255,255,255,0.3)');
    ctx.fillStyle = shallow;
    ctx.fill(water);
    // A touch of sea-green through the water.
    ctx.fillStyle = 'rgba(0, 150, 160, 0.14)';
    ctx.fill(water);

    // Foam inside the water (kept within the water's shape).
    ctx.save();
    ctx.clip(water);
    // Whitewater churning behind the breaking crest.
    const churn = ctx.createRadialGradient(front - zone * 0.25, crestH * 0.75, 0, front - zone * 0.25, crestH * 0.75, zone * 0.7);
    churn.addColorStop(0, `rgba(255,255,255,${(0.15 + 0.35 * breaker * (1 - calm)).toFixed(2)})`);
    churn.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = churn;
    ctx.fillRect(Math.max(0, front - zone * 1.2), 0, zone * 1.6, T);
    // Streaks of foam drifting towards the shore.
    // Each foam line has its own fixed place along the sea and drifts slowly
    // and steadily towards the shore (independent of how far the water
    // reaches, so lines never jump). Lines fade in where they start and fade
    // out as they reach the end of their journey, instead of popping.
    ctx.lineWidth = 1.2;
    const journey = L + 120;
    for (const st of m.streaks) {
      const start = ((st.x * journey + time * 30) % journey) - 60;
      if (start > front) continue; // not in the water: the water's shape hides it anyway
      const life = (start + 60) / journey; // 0 → 1 over its journey
      const fade = Math.min(1, life * 8, (1 - life) * 8);
      ctx.strokeStyle = `rgba(255,255,255,${(0.16 * fade).toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const u = start + (i / 8) * st.len;
        const v = surface(Math.max(0, Math.min(front, u))) - T * st.depth;
        i ? ctx.lineTo(u, v) : ctx.moveTo(u, v);
      }
      ctx.stroke();
    }
    // Bubbles in the wash at the front.
    if (dt > 0 && calm < 0.8) {
      if (Math.random() < 0.6) m.bubbles.push({ u: front - Math.random() * zone * 0.6 + swash * Math.random(), v: Math.random() * crestH * 0.8, r: 0.6 + Math.random() * 1.1, life: 0.4 + Math.random() * 0.5 });
    }
    m.bubbles = m.bubbles.filter((b) => (b.life -= dt) > 0);
    const bubbles = new Path2D();
    for (const b of m.bubbles) { b.v += dt * 6; bubbles.moveTo(b.u + b.r, b.v); bubbles.arc(b.u, b.v, b.r, 0, TAU); }
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fill(bubbles);
    ctx.restore();

    // Foam on the surface: one smooth white line along the whole surface
    // (the froth below adds brighter foam on the crests).
    const surfaceLine = new Path2D();
    pts.forEach(([u, v], i) => (i ? surfaceLine.lineTo(u, v) : surfaceLine.moveTo(u, v)));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke(surfaceLine);
    // Bubbly froth along the higher parts of the surface.
    const froth = new Path2D();
    for (let i = 0; i < pts.length; i += 3) {
      const [u, v] = pts[i];
      const high = Math.max(0, (v / T - 0.5) / 0.45);
      if (high < 0.15) continue;
      const r = 0.8 + 1.8 * high * (0.6 + 0.4 * Math.sin(u * 0.15 + time * 0.8));
      froth.moveTo(u + r, v - r * 0.6); froth.arc(u, v - r * 0.6, r, 0, TAU);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill(froth);
    // The breaking crest and the swash are white water.
    ctx.strokeStyle = `rgba(255,255,255,${(0.55 + 0.4 * breaker).toFixed(2)})`;
    ctx.lineWidth = 2.5 + 2 * breaker;
    ctx.beginPath();
    ctx.moveTo(front - 6, surface(front - 6));
    frontEdge(ctx);
    ctx.stroke();

    // Spray thrown up as the wave breaks.
    if (dt > 0 && breaker > 0.6 && calm < 0.5 && Math.random() < dt * 25) {
      // Thrown only as high as still fits in the bar (it rises dv² / (2 × gravity)).
      const rise = Math.sqrt(2 * 140 * Math.max(0, T - 3 - crestH));
      m.spray.push({ u: front + lip * 0.5, v: crestH, du: 20 + Math.random() * 50, dv: rise * (0.5 + Math.random() * 0.5), life: 0.7 });
    }
    m.spray = m.spray.filter((p) => (p.life -= dt) > 0);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const p of m.spray) {
      p.u += p.du * dt; p.v += p.dv * dt; p.dv -= 140 * dt; // gravity pulls back towards the sea floor
      if (p.v < 0 || p.v > T) continue;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.beginPath(); ctx.arc(p.u, p.v, 1.4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
});
