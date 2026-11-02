/* Bold portfolio / progressive motion.
   Semantic HTML and all links remain functional without this file. */
(() => {
  "use strict";

  const body = document.body;
  const progress = document.querySelector(".scroll-progress");
  const nav = document.querySelector(".site-nav");
  const motionButton = document.querySelector(".motion-switch");
  const motionLabel = motionButton?.querySelector(".motion-switch-label");
  const heroVisual = document.querySelector(".hero-visual");
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const precisionQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  document.getElementById("year").textContent = new Date().getFullYear();

  let manuallyPaused = false;
  const isMotionReduced = () => reduceQuery.matches || manuallyPaused;
  const updateMotion = () => {
    const paused = isMotionReduced();
    body.classList.toggle("motion-off", paused);
    if (motionButton) {
      motionButton.setAttribute("aria-pressed", String(paused));
      motionButton.setAttribute("aria-label", paused ? "Resume decorative animation" : "Pause decorative animation");
      motionButton.title = reduceQuery.matches
        ? "Your device requests reduced motion"
        : paused ? "Resume animation" : "Pause animation";
      if (motionLabel) motionLabel.textContent = paused ? "MOTION OFF" : "PAUSE MOTION";
      motionButton.disabled = reduceQuery.matches;
      if (reduceQuery.matches) motionButton.setAttribute("aria-label", "Decorative animation reduced by system preference");
    }
    if (paused) {
      for (const el of document.querySelectorAll("[data-reveal].reveal-ready")) {
        el.classList.add("is-visible");
      }
      if (heroVisual) {
        heroVisual.style.setProperty("--parallax-x", "0px");
        heroVisual.style.setProperty("--parallax-y", "0px");
      }
    }
  };
  motionButton?.addEventListener("click", () => {
    if (reduceQuery.matches) return;
    manuallyPaused = !manuallyPaused;
    updateMotion();
  });
  reduceQuery.addEventListener?.("change", updateMotion);
  updateMotion();

  // A single passive scroll listener updates header and reading progress.
  let scrollFrame = 0;
  const drawScroll = () => {
    scrollFrame = 0;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const percent = maxScroll ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
    if (progress) progress.style.transform = `scaleX(${percent.toFixed(4)})`;
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 48);
  };
  const requestDraw = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(drawScroll);
  };
  window.addEventListener("scroll", requestDraw, { passive: true });
  window.addEventListener("resize", requestDraw, { passive: true });
  drawScroll();

  // Observers only delay genuinely below-fold items. No flash of missing copy
  // without JavaScript, on initial hash navigation, or for reduced motion users.
  const revealTargets = [...document.querySelectorAll("[data-reveal]")];
  if ("IntersectionObserver" in window && !reduceQuery.matches) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: .07, rootMargin: "0px 0px -5% 0px" });

    body.classList.add("has-motion");
    for (const element of revealTargets) {
      element.classList.add("reveal-ready");
      const bounds = element.getBoundingClientRect();
      if (bounds.top < window.innerHeight * .94 || bounds.bottom < 0 || isMotionReduced()) {
        element.classList.add("is-visible");
      } else {
        observer.observe(element);
      }
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        for (const el of revealTargets) {
          if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-visible");
        }
      }
    });
  }

  // Subtle pointer parallax, at most one layout-independent frame per input.
  let pointerFrame = 0;
  const clearHero = () => {
    if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    heroVisual?.style.setProperty("--parallax-x", "0px");
    heroVisual?.style.setProperty("--parallax-y", "0px");
  };
  if (heroVisual) {
    heroVisual.addEventListener("pointermove", event => {
      if (!precisionQuery.matches || isMotionReduced()) return;
      const rect = heroVisual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0;
        heroVisual.style.setProperty("--parallax-x", `${(x * 17).toFixed(2)}px`);
        heroVisual.style.setProperty("--parallax-y", `${(y * 15).toFixed(2)}px`);
      });
    }, { passive: true });
    heroVisual.addEventListener("pointerleave", clearHero, { passive: true });
  }

  // Spotlight gradient follows each project only on precise pointer devices.
  for (const card of document.querySelectorAll("[data-glow]")) {
    let frame = 0;
    card.addEventListener("pointermove", event => {
      if (!precisionQuery.matches || isMotionReduced()) return;
      const visual = card.querySelector(".case-visual");
      if (!visual) return;
      const bounds = visual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width * 100;
      const y = (event.clientY - bounds.top) / bounds.height * 100;
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        visual.style.setProperty("--gx", `${Math.max(0,Math.min(100,x)).toFixed(1)}%`);
        visual.style.setProperty("--gy", `${Math.max(0,Math.min(100,y)).toFixed(1)}%`);
      });
    }, { passive: true });
    card.addEventListener("pointerleave", () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      const visual = card.querySelector(".case-visual");
      visual?.style.setProperty("--gx", "50%");
      visual?.style.setProperty("--gy", "40%");
    }, { passive: true });
  }
})();
