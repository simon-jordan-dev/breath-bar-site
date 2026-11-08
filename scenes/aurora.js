// Aurora: soft curtains of light, with no background behind them. As you
// breathe in they billow up and ripple along the bar; as you breathe out they
// fade and settle. Beyond the breath only a faint shimmer stays.
Scene.register('aurora', {
  draw(ctx, s) {
    const { L, T, time, memory: m } = s;
    if (m.T !== T) {
      m.T = T;
      // One color ramp across the bar: green at the base, teal, then violet
      // tips that fade away (so the top is soft, never a hard line).
      m.ramp = ctx.createLinearGradient(0, 0, 0, T * 0.85);
      m.ramp.addColorStop(0, 'rgba(60, 255, 150, 0.0)');
      m.ramp.addColorStop(0.1, 'rgba(60, 255, 150, 0.9)');
      m.ramp.addColorStop(0.5, 'rgba(40, 220, 200, 0.6)');
      m.ramp.addColorStop(0.8, 'rgba(170, 110, 255, 0.35)');
      m.ramp.addColorStop(1, 'rgba(170, 110, 255, 0.0)');
    }

    // Curtains: narrow strips whose height and brightness ripple along the
    // bar, like folds of light, with rounded tops. Drawn additively so
    // overlaps glow.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = m.ramp;
    const step = 5;
    for (let u = 0; u < L; u += step) {
      const on = activeAt(u, s, 90);
      if (on < 0.01 && Math.sin(u * 0.37 + time) < 0.6) continue; // sparse shimmer beyond the breath
      const fold = 0.5 + 0.5 * Math.sin(u / 23 + time * 1.3) * Math.sin(u / 61 - time * 0.7);
      const height = T * 0.85 * (0.15 + 0.85 * on) * (0.55 + 0.45 * fold);
      ctx.globalAlpha = 0.05 + 0.7 * on * (0.4 + 0.6 * fold);
      ctx.beginPath();
      ctx.moveTo(u, 0);
      ctx.lineTo(u, height - step);
      ctx.quadraticCurveTo(u + step / 2, height + step, u + step + 0.6, height - step);
      ctx.lineTo(u + step + 0.6, 0);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
});
