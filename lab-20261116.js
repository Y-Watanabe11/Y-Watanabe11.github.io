/* The Lab · "Catch a photon"
   A toy X-ray observation: photons fall from a drifting galaxy cluster, the
   player steers a detector, every catch is binned by energy, and an Fe Kα line
   at 6.4 keV slowly rises above a thermal continuum. No dependencies. */
(() => {
  "use strict";

  const root = document.querySelector(".lab-section");
  if (!root) return;

  const stage = root.querySelector(".lab-stage");
  const canvas = root.querySelector("#lab-canvas");
  const spec = root.querySelector("#lab-spectrum");
  const ctx = canvas.getContext("2d");
  const sctx = spec.getContext("2d");
  if (!ctx || !sctx) return;

  const overlay = root.querySelector(".lab-overlay");
  const overlayKicker = overlay.querySelector(".lab-overlay-kicker");
  const overlayTier = overlay.querySelector(".lab-overlay-tier");
  const overlayTitle = overlay.querySelector(".lab-overlay-title");
  const overlayText = overlay.querySelector(".lab-overlay-text");
  const startButton = overlay.querySelector(".lab-start");
  const out = name => root.querySelector(`[data-lab="${name}"]`);
  const hud = { time: out("time"), cr: out("cr"), photons: out("photons"), sigma: out("sigma"), best: out("best") };
  const meterFill = root.querySelector(".lab-meter-fill");
  const log = root.querySelector(".lab-log");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---------- Physics of the toy ----------
  const DURATION = 30;           // seconds of "exposure"
  const E_MIN = 2, E_MAX = 10;   // keV
  const BIN = 0.1, NBINS = 80;
  const KT = 4;                  // continuum temperature, keV
  const LINE_E = 6.4, LINE_SIGMA = 0.09, LINE_FRACTION = 0.16;
  const LINE_BINS = [42, 45];    // 6.2 – 6.6 keV
  const SIDE_BINS = [[35, 41], [46, 50]]; // 5.5 – 6.2 and 6.6 – 7.1 keV
  const DEAD_TIME = 0.7;

  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  const sampleEnergy = () => {
    if (Math.random() < LINE_FRACTION) return LINE_E + gauss() * LINE_SIGMA;
    const span = 1 - Math.exp(-(E_MAX - E_MIN) / KT);
    return E_MIN - KT * Math.log(1 - Math.random() * span);
  };
  const binOf = e => Math.max(0, Math.min(NBINS - 1, Math.floor((e - E_MIN) / BIN + 1e-9)));
  const hue = e => 215 - ((Math.max(E_MIN, Math.min(E_MAX, e)) - E_MIN) / (E_MAX - E_MIN)) * 195;
  const sumBins = (h, a, b) => { let s = 0; for (let i = a; i <= b; i++) s += h[i]; return s; };

  const hist = new Uint16Array(NBINS);
  const significance = () => {
    const n = sumBins(hist, LINE_BINS[0], LINE_BINS[1]);
    const sideCount = SIDE_BINS.reduce((s, [a, b]) => s + sumBins(hist, a, b), 0);
    const sideWidth = SIDE_BINS.reduce((s, [a, b]) => s + (b - a + 1), 0);
    const bkg = (sideCount / sideWidth) * (LINE_BINS[1] - LINE_BINS[0] + 1);
    // A toy, slightly conservative estimate: Poisson noise of the background plus half the line counts.
    return Math.max(0, (n - bkg) / Math.sqrt(bkg + 0.5 * n + 1));
  };

  // ---------- Persistent best score (per viewer convenience only) ----------
  const BEST_KEY = "yw-lab-best-sigma";
  let best = 0;
  try { best = parseFloat(localStorage.getItem(BEST_KEY)) || 0; } catch { best = 0; }
  const saveBest = v => { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage unavailable */ } };

  // ---------- State ----------
  let W = 0, H = 0, dpr = 1, stars = [];
  const game = {
    mode: "idle",        // idle | running | done
    t: 0, ambient: 0,
    emitDebt: 0, rayDebt: 0,
    photons: [], rays: [], sparks: [], labels: [],
    caught: 0, crHits: 0, dead: 0,
    detX: 0, targetX: 0, keys: { left: false, right: false }, keyHold: 0,
    sigma: 0, shake: 0
  };

  const detWidth = () => Math.max(64, Math.min(124, W * 0.15));
  const detY = () => H - Math.max(30, H * 0.085);
  const sourcePos = t => ({
    x: W / 2 + Math.sin(t * 0.47) * W * 0.3 + Math.sin(t * 1.23 + 1) * W * 0.06,
    y: Math.max(54, H * 0.14)
  });

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(W * H / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.85, r: rand(.4, 1.4), a: rand(.15, .7), p: rand(0, 6.28) }));
    if (!game.detX) game.detX = game.targetX = W / 2;
    game.detX = Math.min(game.detX, W); game.targetX = Math.min(game.targetX, W);

    const srect = spec.getBoundingClientRect();
    spec.width = Math.round(srect.width * dpr); spec.height = Math.round(srect.height * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpectrum();
    if (!loopId) drawScene();
  };

  // ---------- Spawning ----------
  const emitPhoton = (t, live) => {
    const s = sourcePos(t);
    const speed = H * rand(0.62, 0.78);
    game.photons.push({ x: s.x + rand(-6, 6), y: s.y, vx: rand(-1, 1) * W * 0.11, vy: speed, live });
  };
  const emitRay = () => {
    const fromLeft = Math.random() < 0.5;
    const x = rand(W * 0.05, W * 0.95);
    const angle = rand(0.12, 0.42) * (fromLeft ? 1 : -1);
    const speed = H * 1.9;
    game.rays.push({ x, y: -30, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed });
  };
  const burst = (x, y, e, n) => {
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 1.05, Math.PI * 1.95), v = rand(40, 150);
      game.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.35, .7), max: .7, h: e == null ? 12 : hue(e) });
    }
  };

  // ---------- Update ----------
  const update = dt => {
    const running = game.mode === "running";
    if (running) game.t += dt; else game.ambient += dt;
    const t = running ? game.t : game.ambient;

    // Detector control
    const dw = detWidth();
    const keyDirection = (game.keys.right ? 1 : 0) - (game.keys.left ? 1 : 0);
    if (running && keyDirection) {
      // Starts precise, speeds up while held: small taps nudge, long presses sweep.
      game.keyHold += dt;
      const speed = W * (0.55 + Math.min(1, game.keyHold / 0.35) * 0.75);
      game.targetX += keyDirection * speed * dt;
    } else {
      game.keyHold = 0;
    }
    if (!running) game.targetX = sourcePos(t + 0.9).x; // the idle demo follows the source lazily
    game.targetX = Math.max(dw / 2, Math.min(W - dw / 2, game.targetX));
    // While playing the detector sits (almost) exactly where you point; the idle demo drifts lazily.
    game.detX += (game.targetX - game.detX) * (1 - Math.exp(-dt * (running ? 60 : 3)));
    game.dead = Math.max(0, game.dead - dt);
    game.shake = Math.max(0, game.shake - dt);
    stage.classList.toggle("is-dead", running && game.dead > 0);

    // Emission
    const progress = running ? Math.min(1, game.t / DURATION) : 0.2;
    game.emitDebt += dt * (running ? 5.5 + 5 * progress : 3.2);
    while (game.emitDebt >= 1) { game.emitDebt -= 1; emitPhoton(t, running); }
    if (running) {
      game.rayDebt += dt * (0.8 + 1.1 * progress);
      while (game.rayDebt >= 1) { game.rayDebt -= 1; emitRay(); }
    }

    const CATCH_MARGIN = 6; // forgiving edges: a photon grazing the frame still counts
    const dy = detY(), left = game.detX - dw / 2 - CATCH_MARGIN, right = game.detX + dw / 2 + CATCH_MARGIN;

    // Photons
    for (let i = game.photons.length - 1; i >= 0; i--) {
      const p = game.photons[i];
      const prevY = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (prevY < dy && p.y >= dy && p.x > left && p.x < right) {
        if (!p.live || !running) { burst(p.x, dy, 4 + Math.random() * 4, 3); game.photons.splice(i, 1); continue; }
        if (game.dead > 0) continue; // blind: it passes straight through
        const e = sampleEnergy();
        hist[binOf(e)]++;
        game.caught++;
        burst(p.x, dy, e, 7);
        const inLine = Math.abs(e - LINE_E) < 0.2;
        game.labels.push({ x: p.x, y: dy - 14, text: `${e.toFixed(2)} keV${inLine ? " ★" : ""}`, life: .8, h: hue(e), strong: inLine });
        game.photons.splice(i, 1);
        onCatch();
        continue;
      }
      if (p.y > H + 10) game.photons.splice(i, 1);
    }

    // Cosmic rays
    for (let i = game.rays.length - 1; i >= 0; i--) {
      const r = game.rays[i];
      const prevY = r.y, prevX = r.x;
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (running && prevY < dy && r.y >= dy) {
        const xAt = prevX + (r.x - prevX) * ((dy - prevY) / (r.y - prevY));
        if (xAt > left && xAt < right) {
          game.crHits++;
          hist[binOf(rand(E_MIN, E_MAX))]++; // a cosmic ray deposits a junk event
          game.dead = DEAD_TIME;
          game.shake = reducedMotion.matches ? 0 : 0.25;
          burst(xAt, dy, null, 12);
          game.labels.push({ x: xAt, y: dy - 14, text: "COSMIC RAY", life: .9, h: 12, strong: true });
          onCatch();
          game.rays.splice(i, 1);
          continue;
        }
      }
      if (r.y > H + 60 || r.x < -60 || r.x > W + 60) game.rays.splice(i, 1);
    }

    for (let i = game.sparks.length - 1; i >= 0; i--) {
      const s = game.sparks[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt;
      if (s.life <= 0) game.sparks.splice(i, 1);
    }
    for (let i = game.labels.length - 1; i >= 0; i--) {
      const l = game.labels[i];
      l.life -= dt; l.y -= 28 * dt;
      if (l.life <= 0) game.labels.splice(i, 1);
    }

    if (running) {
      const left = Math.max(0, DURATION - game.t);
      const text = left.toFixed(1);
      if (hud.time.textContent !== text) hud.time.textContent = text;
      if (left <= 0) finish();
    }
  };

  // ---------- Drawing ----------
  const drawScene = () => {
    const running = game.mode === "running";
    const t = running ? game.t : game.ambient;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (game.shake > 0) ctx.translate(rand(-3, 3) * game.shake * 4, rand(-2, 2) * game.shake * 4);

    // Stars
    for (const s of stars) {
      ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(t * 1.3 + s.p));
      ctx.fillStyle = "#cfe3f5";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Source: a hot galaxy cluster
    const s = sourcePos(t);
    const pulse = 1 + 0.06 * Math.sin(t * 3.1);
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 46 * pulse);
    g.addColorStop(0, "rgba(255,240,214,.95)");
    g.addColorStop(.18, "rgba(255,200,142,.6)");
    g.addColorStop(.5, "rgba(170,184,255,.18)");
    g.addColorStop(1, "rgba(170,184,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, 46 * pulse, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#fff6e6";
    for (const [ox, oy, r] of [[0, 0, 3.2], [-11, 5, 1.6], [9, -6, 1.8], [14, 7, 1.2], [-6, -10, 1.1]]) {
      ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, r, 0, 6.283); ctx.fill();
    }
    ctx.font = "700 9px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "rgba(183,204,220,.75)";
    ctx.textAlign = "center";
    ctx.fillText("GALAXY CLUSTER · kT ≈ 4 keV", s.x, s.y + 40);

    // Photons
    for (const p of game.photons) {
      const len = 0.035;
      const grad = ctx.createLinearGradient(p.x - p.vx * len, p.y - p.vy * len, p.x, p.y);
      grad.addColorStop(0, "rgba(164,238,224,0)");
      grad.addColorStop(1, p.live ? "rgba(214,255,247,.95)" : "rgba(214,255,247,.45)");
      ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x - p.vx * len, p.y - p.vy * len); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = p.live ? "#f2fffc" : "rgba(242,255,252,.5)";
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.1, 0, 6.283); ctx.fill();
    }

    // Cosmic rays
    for (const r of game.rays) {
      const len = 0.05;
      const grad = ctx.createLinearGradient(r.x - r.vx * len, r.y - r.vy * len, r.x, r.y);
      grad.addColorStop(0, "rgba(255,138,112,0)");
      grad.addColorStop(1, "rgba(255,170,130,1)");
      ctx.strokeStyle = grad; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(r.x - r.vx * len, r.y - r.vy * len); ctx.lineTo(r.x, r.y); ctx.stroke();
    }

    // Detector: a small pixel array on a cold stage
    const dw = detWidth(), dy = detY(), x0 = game.detX - dw / 2;
    const dead = running && game.dead > 0;
    ctx.fillStyle = dead ? "rgba(255,138,112,.16)" : "rgba(164,238,224,.08)";
    ctx.beginPath(); ctx.ellipse(game.detX, dy + 4, dw * 0.75, 14, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#142d49";
    ctx.strokeStyle = dead ? "#ff9c86" : "#a4f4e6";
    ctx.lineWidth = 1.5;
    roundRect(x0, dy, dw, 14, 4); ctx.fill(); ctx.stroke();
    const cells = 6, gap = 2, cw = (dw - 8 - gap * (cells - 1)) / cells;
    for (let i = 0; i < cells; i++) {
      ctx.fillStyle = dead ? "rgba(255,156,134,.55)" : `rgba(164,238,224,${0.35 + 0.25 * Math.sin(t * 4 + i)})`;
      ctx.fillRect(x0 + 4 + i * (cw + gap), dy + 4, cw, 6);
    }
    ctx.strokeStyle = "rgba(181,210,247,.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(game.detX, dy + 14); ctx.lineTo(game.detX, H); ctx.stroke();
    ctx.fillStyle = "rgba(183,204,220,.7)"; ctx.textAlign = "center";
    ctx.fillText(dead ? "RECOVERING…" : "DETECTOR · 50 mK", game.detX, dy + 28);

    // Sparks and labels
    for (const sp of game.sparks) {
      ctx.globalAlpha = Math.max(0, sp.life / sp.max);
      ctx.fillStyle = `hsl(${sp.h} 90% 72%)`;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 1.8, 0, 6.283); ctx.fill();
    }
    ctx.font = "700 10px 'Space Grotesk', sans-serif";
    for (const l of game.labels) {
      ctx.globalAlpha = Math.max(0, Math.min(1, l.life / 0.5));
      ctx.fillStyle = l.strong ? `hsl(${l.h} 95% 76%)` : "rgba(214,232,245,.8)";
      ctx.fillText(l.text, l.x, l.y);
    }
    ctx.restore();
  };

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawSpectrum() {
    const w = spec.width / dpr, h = spec.height / dpr;
    if (!w || !h) return;
    sctx.clearRect(0, 0, w, h);
    let max = 0;
    for (let i = 0; i < NBINS; i++) max = Math.max(max, hist[i]);
    const top = Math.max(6, max * 1.18);
    const bw = w / NBINS;

    // Line marker
    const lx = ((LINE_E - E_MIN) / (E_MAX - E_MIN)) * w;
    const lit = game.sigma >= 3;
    sctx.strokeStyle = lit ? "rgba(255,200,142,.9)" : "rgba(255,200,142,.35)";
    sctx.setLineDash([3, 4]); sctx.lineWidth = 1;
    sctx.beginPath(); sctx.moveTo(lx, 14); sctx.lineTo(lx, h); sctx.stroke();
    sctx.setLineDash([]);
    sctx.font = "700 9px 'Space Grotesk', sans-serif";
    sctx.fillStyle = lit ? "#ffc88e" : "rgba(255,200,142,.55)";
    sctx.textAlign = "center";
    sctx.fillText(lit ? "Fe Kα DETECTED" : "Fe Kα ?", lx, 10);

    if (!max) {
      sctx.fillStyle = "rgba(142,162,187,.7)";
      sctx.fillText("NO COUNTS YET", w / 2, h / 2 + 4);
      return;
    }
    for (let i = 0; i < NBINS; i++) {
      if (!hist[i]) continue;
      const bh = (hist[i] / top) * (h - 18);
      sctx.fillStyle = `hsl(${hue(E_MIN + (i + 0.5) * BIN)} 80% ${i >= LINE_BINS[0] && i <= LINE_BINS[1] && lit ? 74 : 64}%)`;
      sctx.fillRect(i * bw + 0.5, h - bh, Math.max(1, bw - 1), bh);
    }
    // Expected continuum shape, scaled to the counts so far
    const cont = game.caught * (1 - LINE_FRACTION);
    if (cont > 10) {
      const norm = cont * BIN / (KT * (1 - Math.exp(-(E_MAX - E_MIN) / KT)));
      sctx.strokeStyle = "rgba(214,232,245,.45)"; sctx.lineWidth = 1.2;
      sctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const e = E_MIN + (i / 60) * (E_MAX - E_MIN);
        const y = h - (norm * Math.exp(-(e - E_MIN) / KT) / top) * (h - 18);
        const x = ((e - E_MIN) / (E_MAX - E_MIN)) * w;
        i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
      }
      sctx.stroke();
    }
  }

  // ---------- Readout ----------
  let lastMilestone = 0;
  function onCatch() {
    game.sigma = significance();
    hud.photons.textContent = String(game.caught);
    hud.sigma.textContent = `${game.sigma.toFixed(1)}σ`;
    hud.cr.textContent = String(game.crHits);
    meterFill.style.width = `${Math.min(100, (game.sigma / 6) * 100).toFixed(1)}%`;
    drawSpectrum();
    const milestone = game.sigma >= 5 ? 5 : game.sigma >= 3 ? 3 : 0;
    if (milestone > lastMilestone) {
      lastMilestone = milestone;
      log.innerHTML = milestone === 5
        ? "<strong>5σ!</strong> That's a discovery-level line. Keep collecting to sharpen it."
        : "<strong>3σ</strong> — evidence of a line near 6.4 keV. Is it real? Keep observing.";
    }
  }

  const resetReadout = () => {
    hist.fill(0);
    Object.assign(game, { t: 0, emitDebt: 0, rayDebt: 0, caught: 0, crHits: 0, dead: 0, sigma: 0, shake: 0 });
    game.photons.length = 0; game.rays.length = 0; game.sparks.length = 0; game.labels.length = 0;
    lastMilestone = 0;
    hud.time.textContent = DURATION.toFixed(1);
    hud.photons.textContent = "0"; hud.sigma.textContent = "0.0σ"; hud.cr.textContent = "0";
    meterFill.style.width = "0%";
    drawSpectrum();
  };
  hud.best.textContent = best ? `${best.toFixed(1)}σ` : "—";

  function start() {
    resetReadout();
    game.mode = "running";
    releaseKeys();
    stage.classList.add("is-running");
    overlay.hidden = true;
    log.textContent = "Shutter open. Photons arriving…";
    canvas.focus({ preventScroll: true });
    ensureLoop();
  }

  function finish() {
    game.mode = "done";
    stage.classList.remove("is-running", "is-dead");
    const sigma = Math.round(significance() * 10) / 10; // tier on the value we display
    const isBest = sigma > best + 0.005;
    if (isBest) { best = sigma; saveBest(best); hud.best.textContent = `${best.toFixed(1)}σ`; }

    const tier = sigma >= 5
      ? { color: "#ffc88e", title: "Discovery. Hot iron, confirmed.", text: "You caught Fe Kα at 6.4 keV: X-rays from iron in plasma at tens of millions of kelvin, filling the space between galaxies." }
      : sigma >= 3
        ? { color: "#a4eee0", title: "Evidence — but the referee wants more.", text: "There is a bump near 6.4 keV, but not quite 5σ. Real observatories solve this with longer exposures and better energy resolution." }
        : { color: "#aab8ff", title: "Mostly continuum. Apply for more time.", text: "The line is in there, but buried in noise. Stay under the source and dodge cosmic rays to beat the background." };

    overlayKicker.textContent = `RESULT · ${game.caught} PHOTONS · ${game.crHits} COSMIC RAYS${isBest ? " · NEW BEST" : ""}`;
    overlayTier.hidden = false;
    overlayTier.textContent = `${sigma.toFixed(1)}σ`;
    overlayTier.style.setProperty("--tier-color", tier.color);
    overlayTitle.textContent = tier.title;
    overlayText.textContent = tier.text;
    startButton.firstChild.textContent = "Observe again ";
    overlay.hidden = false;
    log.textContent = `Observation complete: ${sigma.toFixed(1)}σ line significance from ${game.caught} photons.`;
    startButton.focus({ preventScroll: true });
  }

  // ---------- Loop (runs only while visible, or while playing) ----------
  let loopId = 0, last = 0, visible = false;
  const frame = now => {
    loopId = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    update(dt);
    drawScene();
    if (game.mode === "running" || (visible && !reducedMotion.matches && !document.hidden)) ensureLoop();
    else last = 0;
  };
  function ensureLoop() { if (!loopId) loopId = window.requestAnimationFrame(frame); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
      if (visible) ensureLoop();
    }, { threshold: 0.05 }).observe(stage);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && visible) ensureLoop(); });

  // ---------- Input ----------
  // The pointer is tracked on the whole window while playing, so the detector
  // keeps following even when the cursor slips outside the field (it sits right
  // at the bottom edge, so that happens a lot).
  const pointerTo = event => {
    const rect = canvas.getBoundingClientRect();
    game.targetX = event.clientX - rect.left;
  };
  window.addEventListener("pointermove", e => { if (game.mode === "running") pointerTo(e); }, { passive: true });
  canvas.addEventListener("pointerdown", e => {
    if (game.mode !== "running") return;
    pointerTo(e);
    if (e.pointerType !== "mouse") canvas.setPointerCapture?.(e.pointerId);
  });

  // Keys work anywhere on the page while an observation is running, not only
  // when the canvas has focus. Typing in a field (e.g. the console) is left alone.
  const keyDir = key => (key === "ArrowLeft" || key === "a" || key === "A") ? "left"
    : (key === "ArrowRight" || key === "d" || key === "D") ? "right" : null;
  const isTyping = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const releaseKeys = () => { game.keys.left = game.keys.right = false; };
  document.addEventListener("keydown", e => {
    if (game.mode !== "running" || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const dir = keyDir(e.key);
    if (!dir) return;
    // A quick tap still moves: key down/up can both land before the next frame.
    if (!e.repeat) game.targetX += (dir === "right" ? 1 : -1) * W * 0.035;
    game.keys[dir] = true;
    e.preventDefault(); // keep arrows from scrolling the page mid-game
  });
  document.addEventListener("keyup", e => { const dir = keyDir(e.key); if (dir) game.keys[dir] = false; });
  window.addEventListener("blur", releaseKeys);
  canvas.addEventListener("keydown", e => {
    if ((e.key === " " || e.key === "Enter") && game.mode !== "running") { e.preventDefault(); start(); }
  });

  startButton.addEventListener("click", start);
  window.addEventListener("lab:start", () => {
    root.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
    window.setTimeout(start, reducedMotion.matches ? 0 : 650);
  });

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);
  resize();
})();
