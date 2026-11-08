// Snow: as you breathe in, snow falls and swirls over the part of the bar the
// breath reaches, in a cold blue night, and a soft snowdrift builds up along
// the ground with a few sparkles. As you breathe out the snowfall fades back
// and the drift settles down. Beyond the breath it's dark and still.
Scene.register('snow', {
  draw(ctx, s) {
    const { L, T, dt, time, memory: m } = s;
    // A small patch of snow stays on screen when the breath is empty, so it
    // turns straight round into the next inhale. Only during a real hold at
    // empty does it slide away, and it slides back as the inhale starts.
    const POOL = 15;
    const resting = s.level < 0.0005;
    m.away ??= 0;
    m.away += ((resting ? 1 : 0) - m.away) * Math.min(1, dt * (resting ? 2 : 6));
    const front = POOL + s.front * (1 - POOL / L) - smoothstep(m.away) * (POOL + Math.max(30, T * 0.6));
    const breath = { ...s, front };
    if (m.L !== L || m.T !== T) {
      const rnd = seeded(101);
      m.L = L; m.T = T;
      m.flakes = Array.from({ length: Math.round(L / 6) }, () => ({
        u: rnd() * L, offset: rnd(), speed: 0.12 + rnd() * 0.18, sway: 3 + rnd() * 6,
        phase: rnd() * TAU, big: rnd() < 0.22, size: 0.7 + rnd() * 0.6,
      }));
      m.sparkles = Array.from({ length: Math.round(L / 40) }, () => ({ u: rnd() * L, phase: rnd() * TAU }));
    }

    // Cold night sky over the snowing part, with a softly faded top.
    if (front + T * 0.6 > 0) {
      const sky = ctx.createLinearGradient(0, 0, front + T, 0);
      sky.addColorStop(0, 'rgba(40, 70, 120, 0.4)');
      sky.addColorStop(Math.max(0, Math.min(1, front / (front + T))), 'rgba(60, 100, 160, 0.4)');
      sky.addColorStop(1, 'rgba(60, 100, 160, 0)');
      ctx.fillStyle = sky;
      ctx.fill(dome(s, front + T * 0.6, T, 0.04));
      fadeTop(ctx, s, 0.5);
    }

    // Falling flakes: small dots and bigger six-armed stars, drifting sideways
    // as they fall. They show where the breath is and fade out beyond it.
    const LEVELS = 4;
    const dots = buckets(LEVELS), stars = buckets(LEVELS);
    for (const f of m.flakes) {
      const on = activeAt(f.u, breath, 50);
      if (on < 0.03) continue;
      const g = Math.min(LEVELS - 1, Math.round(on * (LEVELS - 1)));
      const fall = (f.offset + time * f.speed) % 1;           // 0 → 1 from top to ground
      const v = T * (1.05 - fall * 1.05);
      const u = f.u + Math.sin(time * 0.9 + f.phase + fall * 4) * f.sway;
      if (f.big) {
        const r = 3.2 * f.size, spin = time * 0.5 + f.phase;
        for (let i = 0; i < 3; i++) {
          const a = spin + (i * Math.PI) / 3;
          stars[g].moveTo(u - Math.cos(a) * r, v - Math.sin(a) * r);
          stars[g].lineTo(u + Math.cos(a) * r, v + Math.sin(a) * r);
        }
      } else {
        const r = 1.1 * f.size;
        dots[g].moveTo(u + r, v); dots[g].arc(u, v, r, 0, TAU);
      }
    }
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    for (let g = 0; g < LEVELS; g++) {
      ctx.globalAlpha = 0.2 + 0.8 * (g / (LEVELS - 1));
      ctx.fillStyle = '#f2f7ff'; ctx.fill(dots[g]);
      ctx.strokeStyle = '#ffffff'; ctx.stroke(stars[g]);
    }
    ctx.globalAlpha = 1;

    // Snowdrift: a soft white mound along the ground that builds up with the
    // breath, highest well behind the front.
    const drift = new Path2D();
    drift.moveTo(0, 0);
    for (let u = 0; u <= Math.min(L, front + 60); u += 5) {
      const h = T * (0.19 + 0.07 * Math.sin(u / 37) + 0.03 * Math.sin(u / 11)) * activeAt(u, breath, 60);
      drift.lineTo(u, h);
    }
    drift.lineTo(Math.min(L, front + 60), 0);
    drift.closePath();
    const snowFill = ctx.createLinearGradient(0, 0, 0, T * 0.3);
    snowFill.addColorStop(0, 'rgba(200, 215, 240, 0.95)');
    snowFill.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
    ctx.fillStyle = snowFill;
    ctx.fill(drift);
    // A few sparkles twinkling on the drift.
    ctx.fillStyle = '#ffffff';
    for (const sp of m.sparkles) {
      const on = activeAt(sp.u, breath, 60);
      const tw = Math.max(0, Math.sin(time * 3 + sp.phase));
      if (on < 0.5 || tw < 0.7) continue;
      ctx.globalAlpha = (tw - 0.7) / 0.3;
      ctx.beginPath(); ctx.arc(sp.u, T * 0.16, 1.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
});
