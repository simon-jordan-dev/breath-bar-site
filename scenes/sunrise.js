// Sunrise over the sea. Breathing in, the sun rises out of the water at the
// front of the bar: the sky behind it glows from deep blue through rose to
// gold, soft rays of light fan out, a glittering path of light lies on the
// water and a few clouds catch pink light. Breathing out, it sinks back into
// the sea. Ahead of the sun it's still night: dark water and a few stars.
Scene.register('sunrise', {
  draw(ctx, s) {
    const { L, T, time, level, memory: m } = s;
    const horizon = T * 0.3; // the sea below, the sky above
    const reach = T * 3.5;   // how far ahead of the sun its light fades out
    // When the breath is empty the sun sits at the edge, ready for the next
    // inhale. Only during a real hold at empty does it slide away, light and all.
    const front = s.front - awayAt(s) * reach;
    if (m.L !== L || m.T !== T) {
      const rnd = seeded(37);
      m.L = L; m.T = T;
      m.stars = Array.from({ length: Math.round(L / 14) }, () => ({ u: rnd() * L, v: horizon + T * (0.12 + rnd() * 0.55), phase: rnd() * TAU, r: 0.5 + rnd() * 0.8 }));
      m.glints = Array.from({ length: Math.round(L / 5) }, () => ({ u: rnd() * L, v: rnd() * horizon * 0.9, phase: rnd() * TAU, w: 1.5 + rnd() * 3 }));
      m.clouds = Array.from({ length: Math.round(L / (T * 2.2)) + 1 }, () => ({ u: rnd() * L, v: horizon + T * (0.3 + rnd() * 0.3), w: T * (0.8 + rnd() * 1.2), h: T * (0.05 + rnd() * 0.05) }));
    }
    const lightAt = (u) => smoothstep(1 - (u - front) / reach); // 1 behind the sun → 0 ahead

    // Night: dark sea and sky over the whole bar.
    ctx.fillStyle = 'rgba(10, 16, 40, 0.55)';
    ctx.fillRect(0, horizon, L, T - horizon);
    ctx.fillStyle = 'rgba(6, 14, 30, 0.7)';
    ctx.fillRect(0, 0, L, horizon);
    ctx.fillStyle = '#fff6dc';
    for (const st of m.stars) {
      const dark = 1 - lightAt(st.u);
      if (dark < 0.05) continue;
      ctx.globalAlpha = dark * (0.4 + 0.45 * Math.sin(time * 2 + st.phase));
      ctx.beginPath(); ctx.arc(st.u, st.v, st.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const end = front + reach;
    if (end < 0.5) { fadeTop(ctx, s, 0.55); return; }

    // Dawn sky behind the sun: deep blue far behind, rose, then gold near the
    // sun, fading softly into night ahead of it. Warmer the higher it rises.
    const at = (u) => Math.min(1, Math.max(0, u / end));
    const sky = ctx.createLinearGradient(0, 0, end, 0);
    sky.addColorStop(0, 'rgba(40, 60, 120, 0.7)');
    sky.addColorStop(at(front * 0.55), `rgba(200, 110, 140, ${0.55 + 0.25 * level})`);
    sky.addColorStop(at(front * 0.9), `rgba(255, 170, 110, ${0.7 + 0.25 * level})`);
    sky.addColorStop(at(front + reach * 0.3), 'rgba(255, 150, 110, 0.35)');
    sky.addColorStop(1, 'rgba(255, 150, 110, 0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, horizon, end, T - horizon);
    // The sea reflects a darker version of the sky.
    const water = ctx.createLinearGradient(0, 0, end, 0);
    water.addColorStop(0, 'rgba(20, 40, 80, 0.75)');
    water.addColorStop(at(front), 'rgba(150, 80, 90, 0.7)');
    water.addColorStop(1, 'rgba(150, 80, 90, 0)');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, end, horizon);

    // The sun, half out of the water at the start and climbing as you breathe in.
    const sunV = horizon + T * 0.42 * level;
    const r = T * 0.16;
    // Soft rays fanning out from the sun, slowly turning.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.rect(0, horizon, L, T); ctx.clip();
    const rayLen = T * 2.4;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.08 + (i / 8) * 0.84) + Math.sin(time * 0.25 + i) * 0.04;
      const spread = 0.05;
      ctx.fillStyle = `rgba(255, 210, 150, ${(0.06 + 0.05 * Math.sin(time * 0.8 + i * 1.7)).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(front, sunV);
      ctx.lineTo(front + Math.cos(a - spread) * rayLen, sunV + Math.sin(a - spread) * rayLen);
      ctx.lineTo(front + Math.cos(a + spread) * rayLen, sunV + Math.sin(a + spread) * rayLen);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(front, sunV);
      ctx.lineTo(front - Math.cos(a - spread) * rayLen, sunV + Math.sin(a - spread) * rayLen);
      ctx.lineTo(front - Math.cos(a + spread) * rayLen, sunV + Math.sin(a + spread) * rayLen);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const halo = ctx.createRadialGradient(front, sunV, r * 0.6, front, sunV, r * 5);
    halo.addColorStop(0, 'rgba(255, 225, 160, 0.8)');
    halo.addColorStop(1, 'rgba(255, 225, 160, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(front, sunV, r * 5, 0, TAU); ctx.fill();
    // Sun disc (only the part above the water shows).
    ctx.save();
    ctx.beginPath(); ctx.rect(0, horizon, L, T); ctx.clip();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(front, sunV, r, 0, TAU); ctx.fill();
    ctx.restore();

    // Clouds catching pink light near the sun.
    for (const c of m.clouds) {
      const lit = lightAt(c.u);
      if (lit < 0.05) continue;
      ctx.fillStyle = `rgba(255, 170, 175, ${(0.45 * lit).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(c.u, c.v, c.w / 2, c.h, 0, 0, TAU); ctx.fill();
    }

    // Glittering path of light on the water, strongest right below the sun.
    ctx.fillStyle = 'rgba(255, 225, 170, 1)';
    for (const g of m.glints) {
      const near = Math.max(0, 1 - Math.abs(g.u - front) / (T * (1.2 + 1.5 * level)));
      if (near <= 0) continue;
      const tw = 0.5 + 0.5 * Math.sin(time * 4 + g.phase);
      ctx.globalAlpha = near * tw * 0.8;
      ctx.fillRect(g.u - g.w / 2, g.v, g.w, 1);
    }
    ctx.globalAlpha = 1;

    // Soft top edge: the sky fades out towards the inner edge.
    fadeTop(ctx, s, 0.55);
  },
});
