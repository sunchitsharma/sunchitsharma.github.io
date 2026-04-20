/* ===========================================================
   Sunchit Sharma — scroll-driven canvas hero + scene reveals
=============================================================*/

(() => {
  'use strict';

  const FRAME_COUNT = 240;
  const FRAME_PATH = (i) => `assets/img/hero/ezgif-frame-${String(i).padStart(3, '0')}.jpg`;

  // Canvas & scroll state
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  const heroSection = document.querySelector('.hero');
  const overlays = document.querySelectorAll('.hero-phase');
  const scrollHint = document.querySelector('.hero-scroll-hint');
  const preloader = document.getElementById('preloader');
  const preFill = document.getElementById('preloader-fill');
  const prePct = document.getElementById('preloader-pct');

  const images = new Array(FRAME_COUNT);
  let currentFrame = -1;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let rafPending = false;
  let targetProgress = 0;
  let smoothProgress = 0;

  // Year
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- Canvas sizing (HiDPI) ---------- */
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasWidth = w;
    canvasHeight = h;
    currentFrame = -1; // force re-draw
    renderFrame(getFrameForProgress(smoothProgress));
  }

  /* ---------- Draw frame, cover-fit, cinematic ---------- */
  function drawCover(img) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;

    // Crop out "Veo" watermark in bottom-right corner of source.
    const cropBottom = Math.floor(ih * 0.08);
    const srcW = iw;
    const srcH = ih - cropBottom;

    const cw = canvasWidth;
    const ch = canvasHeight;

    const isMobile = cw < 760;
    const imgRatio = srcW / srcH;
    const canvasRatio = cw / ch;

    let dw, dh, dx, dy;

    if (isMobile) {
      // cover
      if (imgRatio > canvasRatio) {
        dh = ch; dw = ch * imgRatio;
      } else {
        dw = cw; dh = cw / imgRatio;
      }
    } else {
      // contain - portrait centered with breathing room
      const scale = Math.min(cw / srcW, ch / srcH) * 0.95;
      dw = srcW * scale;
      dh = srcH * scale;
    }
    dx = (cw - dw) / 2;
    dy = (ch - dh) / 2;

    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, dw, dh);

    // subtle radial vignette to blend edges on desktop (source-over with alpha)
    if (!isMobile) {
      const grd = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
      grd.addColorStop(0, 'rgba(5,6,10,0)');
      grd.addColorStop(1, 'rgba(5,6,10,0.55)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  function renderFrame(i) {
    if (i === currentFrame) return;
    const img = images[i];
    if (!img || !img.complete || !img.naturalWidth) {
      // fall back to nearest ready frame
      for (let d = 1; d < FRAME_COUNT; d++) {
        const a = images[i - d]; const b = images[i + d];
        if (a && a.complete && a.naturalWidth) { drawCover(a); break; }
        if (b && b.complete && b.naturalWidth) { drawCover(b); break; }
      }
      return;
    }
    drawCover(img);
    currentFrame = i;
  }

  /* ---------- Scroll -> frame mapping ---------- */
  function getProgress() {
    const rect = heroSection.getBoundingClientRect();
    const total = heroSection.offsetHeight - window.innerHeight;
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    return total > 0 ? scrolled / total : 0;
  }

  function getFrameForProgress(p) {
    return Math.max(0, Math.min(FRAME_COUNT - 1, Math.floor(p * FRAME_COUNT)));
  }

  /* ---------- Overlay phases ----------
     Map scroll progress ranges to which overlay is visible. */
  const PHASES = [
    { key: 'intro', start: 0.00, end: 0.10 },
    { key: 'p1',    start: 0.14, end: 0.32 },
    { key: 'p2',    start: 0.40, end: 0.60 },
    { key: 'p3',    start: 0.66, end: 0.82 },
    { key: 'final', start: 0.86, end: 1.01 },
  ];

  function updateOverlays(p) {
    PHASES.forEach(ph => {
      const el = document.querySelector(`.hero-phase[data-phase="${ph.key}"]`);
      if (!el) return;
      const visible = p >= ph.start && p <= ph.end;
      el.classList.toggle('is-in', visible);
    });
    if (scrollHint) scrollHint.classList.toggle('is-hidden', p > 0.04);
  }

  /* ---------- rAF smoothing loop ---------- */
  function tick() {
    smoothProgress += (targetProgress - smoothProgress) * 0.18;
    const frame = getFrameForProgress(smoothProgress);
    renderFrame(frame);
    updateOverlays(smoothProgress);

    if (Math.abs(targetProgress - smoothProgress) > 0.0002) {
      requestAnimationFrame(tick);
    } else {
      rafPending = false;
    }
  }
  function onScroll() {
    targetProgress = getProgress();
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(tick);
    }
  }

  /* ---------- Preloader ---------- */
  function preload() {
    let loaded = 0;
    // First and last frames prioritised so hero paints immediately.
    const priority = [0, FRAME_COUNT - 1, Math.floor(FRAME_COUNT / 2)];
    const rest = [];
    for (let i = 0; i < FRAME_COUNT; i++) if (!priority.includes(i)) rest.push(i);
    const order = priority.concat(rest);

    return new Promise(resolve => {
      let firstPainted = false;

      order.forEach(i => {
        const img = new Image();
        img.decoding = 'async';
        img.loading = 'eager';
        img.src = FRAME_PATH(i + 1);
        images[i] = img;

        const done = () => {
          loaded++;
          const pct = Math.round((loaded / FRAME_COUNT) * 100);
          if (preFill) preFill.style.width = pct + '%';
          if (prePct) prePct.textContent = pct;

          if (!firstPainted && images[0] && images[0].complete && images[0].naturalWidth) {
            firstPainted = true;
            renderFrame(0);
          }
          if (loaded === FRAME_COUNT) resolve();
        };
        img.onload = done;
        img.onerror = done; // tolerate missing frames
      });
    });
  }

  /* ---------- Section reveal-on-scroll ---------- */
  function initReveal() {
    const targets = document.querySelectorAll(
      '.section .display, .section .eyebrow, .intro-grid > *, .work-list > *, .timeline-item, .awards-grid > *, .contact-sub, .contact-actions'
    );
    targets.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = ((i % 6) * 60) + 'ms';
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach(el => io.observe(el));
  }

  /* ---------- Boot ---------- */
  function boot() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // Paint frame 0 immediately so hero isn't black.
    const first = images[0];
    if (first && first.complete) renderFrame(0);

    // Kick one cycle.
    targetProgress = getProgress();
    requestAnimationFrame(tick);
    updateOverlays(targetProgress);
  }

  // Start preload immediately, render what we can, reveal page when >= 35% loaded.
  preload();
  // Show page as soon as the first frame is ready — don't wait for all 240.
  const waitForStart = setInterval(() => {
    if (images[0] && images[0].complete && images[0].naturalWidth) {
      clearInterval(waitForStart);
      boot();
      initReveal();
      // smoothly hide preloader
      setTimeout(() => {
        if (preloader) preloader.classList.add('done');
      }, 400);
    }
  }, 50);

  /* ---------- Smooth anchor scroll offset (nav) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

})();
