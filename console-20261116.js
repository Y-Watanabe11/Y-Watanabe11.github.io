/* Lab console · a small terminal easter egg.
   Open with the ` key or the floating ">_ console" button. Built entirely in JS,
   so visitors without JS never see a broken control. */
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollBehavior = () => (reducedMotion.matches ? "auto" : "smooth");

  // ---------- DOM ----------
  const launch = document.createElement("button");
  launch.type = "button";
  launch.className = "term-launch";
  launch.setAttribute("aria-expanded", "false");
  launch.setAttribute("aria-controls", "lab-console");
  launch.innerHTML = '<b aria-hidden="true">&gt;_</b> console <kbd aria-hidden="true">`</kbd>';
  launch.setAttribute("aria-label", "Open the lab console");

  const term = document.createElement("div");
  term.className = "term";
  term.id = "lab-console";
  term.hidden = true;
  term.setAttribute("role", "dialog");
  term.setAttribute("aria-label", "Lab console");
  term.innerHTML = `
    <div class="term-bar">
      <span class="term-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="term-title">visitor@yw-lab: ~</span>
      <button class="term-close" type="button" aria-label="Close console">×</button>
    </div>
    <div class="term-out" role="log" aria-live="polite"></div>
    <form class="term-form" autocomplete="off">
      <label class="term-prompt" for="term-input">~ $</label>
      <input class="term-input" id="term-input" type="text" spellcheck="false" autocapitalize="off" autocorrect="off" enterkeyhint="send" aria-label="Console command">
    </form>`;
  document.body.append(launch, term);

  const outEl = term.querySelector(".term-out");
  const form = term.querySelector(".term-form");
  const input = term.querySelector(".term-input");
  const closeButton = term.querySelector(".term-close");

  // ---------- Output helpers (never inject user text as HTML) ----------
  const print = (parts, cls) => {
    const p = document.createElement("p");
    if (cls) p.className = cls;
    for (const part of [].concat(parts)) {
      if (typeof part === "string") p.append(part);
      else if (part.href) {
        const a = document.createElement("a");
        a.href = part.href;
        a.textContent = part.text;
        if (/^https?:/.test(part.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        p.append(a);
      } else {
        const span = document.createElement("span");
        span.className = part.cls || "";
        span.textContent = part.text;
        p.append(span);
      }
    }
    outEl.append(p);
    outEl.scrollTop = outEl.scrollHeight;
  };
  const lines = (arr, cls) => arr.forEach(l => print(l, cls));
  const go = selector => document.querySelector(selector)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });

  // ---------- Content ----------
  const LINKS = {
    github: "https://github.com/Y-Watanabe11",
    linkedin: "https://www.linkedin.com/in/yuuki-watanabe-51b71733a/",
    medium: "https://medium.com/@watanabe42463",
    qiita: "https://qiita.com/Y-Watanabe11",
    note: "https://note.com/y_watanabe_11",
    satori: "research/satori.html",
    xrism: "research/xrism.html",
    lunar: "research/lunar-riches.html"
  };
  const SECTIONS = { home: "#home", research: "#research", projects: "#projects", lab: "#lab", about: "#about", contact: "#contact" };
  const FACTS = [
    "XRISM's Resolve microcalorimeter runs at about 50 mK, colder than deep space itself.",
    "A silicon photomultiplier (SiPM) can register a single photon.",
    "Light from the Moon takes about 1.28 seconds to reach Earth.",
    "Most of the ordinary matter in a galaxy cluster is not in the galaxies, but in hot X-ray-emitting gas between them.",
    "Fe Kα fluorescence sits near 6.4 keV, a favourite fingerprint of X-ray astronomers.",
    "The Moon has no global magnetic field, so energetic particles reach its surface almost unimpeded.",
    "X-rays don't reflect off normal mirrors; X-ray telescopes use grazing-incidence optics.",
    "A good analog front-end is mostly about noise: every electron counts."
  ];
  const BANNER = [
    "__   __ __        __",
    "\\ \\ / / \\ \\      / /",
    " \\ V /   \\ \\ /\\ / / ",
    "  | |     \\ V  V /  ",
    "  |_|      \\_/\\_/   "
  ];

  const toggleCard = (cardSel, label) => {
    const button = document.querySelector(`${cardSel} .circuit-toggle`);
    if (!button) return print("Instrument offline.", "t-err");
    go(cardSel);
    button.click();
    print(`${label}: ${button.getAttribute("aria-pressed") === "true" ? "ON" : "OFF"}`, "t-warm");
  };

  const COMMANDS = {
    help: { desc: "list commands", run: () => {
      const rows = Object.entries(COMMANDS).filter(([, c]) => c.desc).map(([name, c]) => `  ${name.padEnd(10)} ${c.desc}`);
      lines(["Available commands:", ...rows], "t-dim");
      print("Tip: ↑/↓ for history, Tab to complete. Some commands are not listed. 👀", "t-dim");
    } },
    whoami: { desc: "who is this person?", run: () => lines([
      "Yuuki Watanabe — master's student, Tokyo University of Science.",
      "Physics × engineering: radiation detectors, analog ASICs,",
      "X-ray astronomy and scientific computing."
    ]) },
    ls: { desc: "list files", run: () => print([{ text: "research/  projects/  lab/  ", cls: "t-warm" }, "about.txt  contact.txt"]) },
    cat: { run: args => {
      const f = args[0];
      if (!f) return print("usage: cat <file>", "t-err");
      if (f === "about.txt") return COMMANDS.whoami.run();
      if (f === "contact.txt") return COMMANDS.contact.run();
      if (SECTIONS[f.replace(/\/$/, "")]) return print(`cat: ${f}: Is a directory (try: cd ${f})`, "t-err");
      print(`cat: ${f}: No such file`, "t-err");
    } },
    cd: { desc: "go to a section", run: args => {
      const target = (args[0] || "home").replace(/\/$/, "").replace(/^~$/, "home");
      if (!SECTIONS[target]) return print(`cd: ${target}: No such directory. Try: ${Object.keys(SECTIONS).join(", ")}`, "t-err");
      go(SECTIONS[target]);
      print(`→ ${SECTIONS[target]}`, "t-dim");
    } },
    research: { desc: "list research", run: () => {
      print([{ text: "01 SATORI       ", cls: "t-warm" }, "Analog ASIC for SiPM readout  ", { href: LINKS.satori, text: "open ↗" }]);
      print([{ text: "02 XRISM        ", cls: "t-warm" }, "High-resolution X-ray spectroscopy  ", { href: LINKS.xrism, text: "open ↗" }]);
      print([{ text: "03 Lunar-RICHeS ", cls: "t-warm" }, "Particle detectors for the Moon  ", { href: LINKS.lunar, text: "open ↗" }]);
    } },
    projects: { desc: "software & builds", run: () => {
      print(["• Randomness Beyond Histograms  ", { href: "https://github.com/Y-Watanabe11/randomness-beyond-histograms", text: "github ↗" }]);
      print(["• Everything else  ", { href: LINKS.github, text: "github.com/Y-Watanabe11 ↗" }]);
    } },
    contact: { desc: "where to find me", run: () => {
      for (const k of ["github", "linkedin", "medium", "qiita", "note"]) print([`  ${k.padEnd(9)}`, { href: LINKS[k], text: LINKS[k].replace(/^https:\/\/(www\.)?/, "") }]);
    } },
    open: { desc: "open satori|xrism|lunar|github|…", run: args => {
      const k = (args[0] || "").toLowerCase();
      if (!LINKS[k]) return print(`open: try one of ${Object.keys(LINKS).join(", ")}`, "t-err");
      print(`Opening ${k}…`, "t-dim");
      if (/^https?:/.test(LINKS[k])) window.open(LINKS[k], "_blank", "noopener");
      else window.location.href = LINKS[k];
    } },
    play: { desc: "start the photon game", run: () => {
      print("Booking telescope time… good luck. 🔭", "t-warm");
      window.dispatchEvent(new CustomEvent("lab:start"));
      window.setTimeout(close, 250);
    } },
    power: { desc: "power the SATORI chip", run: () => toggleCard(".satori-card", "SATORI readout") },
    observe: { desc: "point XRISM", run: () => toggleCard(".xrism-card", "XRISM observation") },
    track: { desc: "track lunar particles", run: () => toggleCard(".lunar-card", "Particle tracking") },
    fact: { desc: "a random science fact", run: () => print(`✳ ${FACTS[Math.floor(Math.random() * FACTS.length)]}`, "t-warm") },
    ping: { desc: "ping moon|mars", run: async args => {
      const host = (args[0] || "moon").toLowerCase();
      if (host === "moon") {
        print("PING moon (384,400 km): 56 data bytes", "t-dim");
        busy = true;
        await new Promise(r => window.setTimeout(r, 2564));
        busy = false;
        print("64 bytes from moon: icmp_seq=0 ttl=64 time=2564 ms", "t-warm");
        print("(that's the speed of light, round trip. Not my Wi-Fi.)", "t-dim");
      } else if (host === "mars") {
        print("PING mars (55–400 million km): 56 data bytes", "t-dim");
        print("Request timeout. Round trip is 6–44 minutes. Try again after lunch.", "t-err");
      } else if (host === "sun") {
        print("ping: sun: too hot to handle", "t-err");
      } else {
        print(`ping: ${host}: unknown celestial body`, "t-err");
      }
    } },
    date: { run: () => print(`${new Date().toString()} (Earth time)`) },
    pwd: { run: () => print("/home/visitor/universe/local-group/milky-way/sol/earth") },
    echo: { run: (args, raw) => print(raw.replace(/^echo\s?/, "")) },
    history: { run: () => history.forEach((h, i) => print(`  ${String(i + 1).padStart(3)}  ${h}`, "t-dim")) },
    coffee: { run: () => lines(["    ( (", "     ) )", "  ........", "  |      |]", "  \\      /", "   `----'", "Fuel for late-night data reduction ☕"], "t-art") },
    sudo: { run: args => {
      const what = args.join(" ").toLowerCase();
      if (/hire/.test(what)) {
        print("[sudo] password for visitor: ********", "t-dim");
        print("Access granted. Excellent decision. Routing you to contact…", "t-warm");
        go("#contact");
      } else {
        print("visitor is not in the sudoers file. This incident will be reported to the PI.", "t-err");
      }
    } },
    rm: { run: () => print("rm: cannot remove '/': the universe is read-only", "t-err") },
    vim: { run: () => print("You are now trapped in vim. Just kidding — try 'exit'.", "t-dim") },
    hello: { run: () => print("Hello, human. 👋 Thanks for poking around.") },
    clear: { desc: "clear screen", run: () => { outEl.textContent = ""; } },
    exit: { desc: "close console", run: () => close() }
  };
  COMMANDS.hi = COMMANDS.hello;
  COMMANDS.man = COMMANDS.help;
  COMMANDS["?"] = COMMANDS.help;
  COMMANDS.quit = COMMANDS.exit;

  // ---------- Behaviour ----------
  const history = [];
  let historyIndex = 0, greeted = false, busy = false, lastFocus = null;

  const run = raw => {
    const trimmed = raw.trim();
    print(trimmed, "t-cmd");
    if (!trimmed) return;
    history.push(trimmed);
    historyIndex = history.length;
    const [name, ...args] = trimmed.split(/\s+/);
    const cmd = COMMANDS[name.toLowerCase()];
    if (!cmd) return print(`command not found: ${name}. Type 'help'.`, "t-err");
    try { cmd.run(args, trimmed); } catch { print("segfault in the space-time continuum. Please retry.", "t-err"); }
  };

  function open() {
    if (!term.hidden) return input.focus();
    lastFocus = document.activeElement;
    term.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    if (!greeted) {
      greeted = true;
      lines(BANNER, "t-art");
      print("Welcome to the lab console. Type 'help' to begin, or try 'play'.", "t-dim");
    }
    input.focus();
  }
  function close() {
    if (term.hidden) return;
    term.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    const back = lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : launch;
    back.focus({ preventScroll: true });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (busy) return;
    const value = input.value;
    input.value = "";
    run(value);
  });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
    } else if (e.key === "ArrowDown" && history.length) {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || "";
    } else if (e.key === "Tab") {
      const v = input.value.trim().toLowerCase();
      if (!v || v.includes(" ")) return;
      const matches = Object.keys(COMMANDS).filter(c => c.startsWith(v) && COMMANDS[c].desc);
      e.preventDefault();
      if (matches.length === 1) input.value = `${matches[0]} `;
      else if (matches.length > 1) print(matches.join("  "), "t-dim");
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      outEl.textContent = "";
    }
  });
  term.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); close(); } });
  outEl.addEventListener("click", () => { if (!window.getSelection()?.toString()) input.focus(); });
  closeButton.addEventListener("click", close);
  launch.addEventListener("click", open);

  document.addEventListener("keydown", e => {
    if (e.key !== "`" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t !== input && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    term.hidden ? open() : close();
  });

  // A hello for the people who open devtools first.
  console.log("%c✳ Hi, curious engineer.", "color:#a4eee0;font:600 14px sans-serif", "\nPress ` on the page to open the lab console.");
})();
