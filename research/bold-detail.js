/* Bold Lab detail-page progressive enhancements, no dependencies. */
(() => {
  "use strict";
  document.getElementById("year").textContent = new Date().getFullYear();

  const body = document.body;
  const art = document.querySelector(".r-hero-art");
  const control = document.querySelector(".lab-art-control");
  const status = document.querySelector(".lab-art-caption");
  const progress = document.querySelector(".lab-detail-progress");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const precision = window.matchMedia("(hover: hover) and (pointer: fine)");
  let active = false;

  const updateControl = () => {
    if (!control || !art) return;
    art.classList.toggle("lab-active", active);
    control.setAttribute("aria-pressed", String(active));
    control.setAttribute("aria-label", active
      ? "Reduce the illustration animation"
      : "Intensify the illustration animation");
    if (status) status.textContent = active ? "INTERACTIVE VISUAL / FOCUS MODE" : "INTERACTIVE VISUAL / IDLE";
  };
  control?.addEventListener("click", () => {
    active = !active;
    updateControl();
  });
  updateControl();

  let scrollFrame = 0;
  const drawProgress = () => {
    scrollFrame = 0;
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const fraction = max ? Math.min(1,Math.max(0,scrollY/max)) : 0;
    if (progress) progress.style.transform = `scaleX(${fraction.toFixed(4)})`;
  };
  window.addEventListener("scroll", () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(drawProgress);
  }, {passive:true});
  window.addEventListener("resize", drawProgress, {passive:true});
  drawProgress();

  // Defer only safely below-viewport sections. All content is visible without JS.
  const targets = [...document.querySelectorAll(".r-section .r-heading, .r-section .r-prose, .r-info-strip, .r-step, .r-feature-panel, .r-resource-row, .r-next")];
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    body.classList.add("has-story");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("lab-visible");
        observer.unobserve(entry.target);
      }
    }, {threshold:.04,rootMargin:"0px 0px -6% 0px"});
    for (const el of targets) {
      el.classList.add("lab-reveal-ready");
      if (el.getBoundingClientRect().top < innerHeight*.91 || el.getBoundingClientRect().bottom < 0) {
        el.classList.add("lab-visible");
      } else observer.observe(el);
    }
    reduceMotion.addEventListener?.("change", () => {
      if (reduceMotion.matches) for(const el of targets) el.classList.add("lab-visible");
    });
  }

  // Small, contained artwork parallax for mouse/trackpad users.
  let pointerFrame = 0;
  if (art) {
    art.addEventListener("pointermove", event => {
      if (!precision.matches || reduceMotion.matches) return;
      const rect = art.getBoundingClientRect();
      const x = (event.clientX - rect.left)/rect.width-.5;
      const y = (event.clientY - rect.top)/rect.height-.5;
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        art.style.setProperty("--detail-x", `${(x*13).toFixed(2)}px`);
        art.style.setProperty("--detail-y", `${(y*12).toFixed(2)}px`);
      });
    }, {passive:true});
    art.addEventListener("pointerleave", () => {
      if(pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame=0;
      art.style.setProperty("--detail-x","0px");
      art.style.setProperty("--detail-y","0px");
    }, {passive:true});
  }
})();
