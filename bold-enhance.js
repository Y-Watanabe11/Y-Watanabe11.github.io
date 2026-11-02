/* Bold lab / research visual controls. No effect on research page navigation. */
(() => {
  "use strict";
  const labels = {
    satori: { on: "SIGNAL PATH / ACTIVE", off: "SIGNAL PATH / IDLE", start: "Activate the SATORI signal visualization", stop: "Stop the SATORI signal visualization" },
    xrism: { on: "SCAN MODE / ACTIVE", off: "SCAN MODE / IDLE", start: "Start the XRISM X-ray scan visualization", stop: "Stop the XRISM X-ray scan visualization" },
    lunar: { on: "TRACK MODE / ACTIVE", off: "TRACK MODE / IDLE", start: "Trace lunar particle paths", stop: "Stop tracing lunar particle paths" }
  };
  const toggles = [...document.querySelectorAll("[data-case-control]")];
  const motionButton = document.querySelector(".motion-switch");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const updateButton = (button) => {
    const key = button.dataset.caseControl;
    const preset = labels[key];
    const card = button.closest(".work-case");
    if (!preset || !card) return;
    const active = card.classList.contains("is-active");
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? preset.stop : preset.start);
    const mode = card.querySelector(".case-mode");
    if (mode) {
      const paused = document.body.classList.contains("motion-off") || reducedMotion.matches;
      mode.textContent = active ? (paused ? preset.on + " · STATIC" : preset.on) : preset.off;
    }
  };

  for (const button of toggles) {
    updateButton(button);
    button.addEventListener("click", () => {
      const card = button.closest(".work-case");
      if (!card) return;
      card.classList.toggle("is-active");
      updateButton(button);
    });
  }

  // The existing global pause switch owns the motion state. We only update the
  // visible labels after it changes; active states remain selectable.
  motionButton?.addEventListener("click", () => {
    for (const button of toggles) updateButton(button);
  });
  reducedMotion.addEventListener?.("change", () => {
    for (const button of toggles) updateButton(button);
  });

  // Suppress unused animation work when all visualizations are off or scrolled away.
  // Existing CSS continues to support interaction even without JavaScript.
})();
