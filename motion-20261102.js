/* Homepage Motion Controller · progressive enhancement
   No external dependencies. Decorative motion never blocks page navigation. */
(() => {
  "use strict";

  const header = document.querySelector(".site-header");
  const progress = document.querySelector(".motion-progress");
  const hero = document.querySelector(".hero");
  const illustration = document.querySelector(".visual-panel");
  const cards = [...document.querySelectorAll(".research-card")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  // Update the scroll indicator and header from one animation frame.
  let scrollFrame = 0;
  const paintScroll = () => {
    scrollFrame = 0;
    const scrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const fraction = scrollable ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    if (progress) progress.style.transform = `scaleX(${fraction.toFixed(4)})`;
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 42);
  };
  const requestScrollPaint = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(paintScroll);
  };
  window.addEventListener("scroll", requestScrollPaint, { passive: true });
  window.addEventListener("resize", requestScrollPaint, { passive: true });
  requestScrollPaint();

  // Reveal only elements located below the initial viewport.
  // No JS or no IntersectionObserver = all content remains readable.
  const revealTargets = [
    ...document.querySelectorAll(
      ".section-heading, .research-card, .project-row, .about-lead, .about-copy, .contact-panel"
    )
  ];
  const revealObserver = (!reducedMotion.matches && "IntersectionObserver" in window)
    ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove("motion-pending");
          entry.target.classList.add("motion-visible");
          revealObserver.unobserve(entry.target);
        }
      }, { rootMargin: "0px 0px -7% 0px", threshold: 0.04 })
    : null;

  for (const element of revealTargets) {
    if (!revealObserver) continue;
    element.classList.add("motion-entrance");
    const group = element.classList.contains("research-card")
      ? cards.indexOf(element)
      : element.classList.contains("project-row")
        ? [...element.parentElement.children].indexOf(element)
        : 0;
    element.style.setProperty("--reveal-delay", `${Math.min(group, 3) * 90}ms`);
    const bounds = element.getBoundingClientRect();
    if (bounds.top > window.innerHeight * 0.88) {
      element.classList.add("motion-pending");
      revealObserver.observe(element);
    } else {
      element.classList.add("motion-visible");
    }
  }

  const clearPending = () => {
    for (const item of revealTargets) {
      item.classList.remove("motion-pending");
      item.classList.add("motion-visible");
    }
  };

  // Mouse parallax only on precise-pointer devices.
  // The existing interactive buttons inside cards remain native click targets.
  let heroFrame = 0;
  const handleHeroPointer = event => {
    if (reducedMotion.matches || !finePointer.matches || !hero) return;
    const rect = hero.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    if (heroFrame) window.cancelAnimationFrame(heroFrame);
    heroFrame = window.requestAnimationFrame(() => {
      heroFrame = 0;
      hero.style.setProperty("--hero-pointer-x", `${(x * 100).toFixed(2)}%`);
      hero.style.setProperty("--hero-pointer-y", `${(y * 100).toFixed(2)}%`);
      if (illustration) {
        illustration.style.setProperty("--parallax-x", `${((x - .5) * 11).toFixed(2)}px`);
        illustration.style.setProperty("--parallax-y", `${((y - .5) * 9).toFixed(2)}px`);
      }
    });
  };
  if (hero) {
    hero.addEventListener("pointermove", handleHeroPointer, { passive: true });
    hero.addEventListener("pointerleave", () => {
      if (heroFrame) window.cancelAnimationFrame(heroFrame);
      heroFrame = 0;
      hero.style.removeProperty("--hero-pointer-x");
      hero.style.removeProperty("--hero-pointer-y");
      if (illustration) {
        illustration.style.setProperty("--parallax-x", "0px");
        illustration.style.setProperty("--parallax-y", "0px");
      }
    }, { passive: true });
  }

  const configureCardMotion = () => {
    const enabled = finePointer.matches && !reducedMotion.matches;
    for (const card of cards) {
      card.classList.toggle("motion-tilt", enabled);
      if (!enabled) {
        for (const key of ["--tilt-x", "--tilt-y", "--card-glow-x", "--card-glow-y"]) {
          card.style.removeProperty(key);
        }
      }
    }
  };

  for (const card of cards) {
    let pendingFrame = 0;
    card.addEventListener("pointermove", event => {
      if (!card.classList.contains("motion-tilt")) return;
      const rect = card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = 0;
        card.style.setProperty("--tilt-x", `${((.5 - y) * 4).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${((x - .5) * 5.5).toFixed(2)}deg`);
        card.style.setProperty("--card-glow-x", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--card-glow-y", `${(y * 100).toFixed(1)}%`);
      });
    }, { passive: true });
    card.addEventListener("pointerleave", () => {
      if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--card-glow-x", "50%");
      card.style.setProperty("--card-glow-y", "20%");
    }, { passive: true });
  }
  configureCardMotion();

  // Accessibility settings may change while the page is open.
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) clearPending();
    configureCardMotion();
  });
  finePointer.addEventListener("change", configureCardMotion);
})();
