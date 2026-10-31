// main.js - orchestrator for THE RULES ARE LYING

import { createAudio } from "./audio.js";
import { createDirector } from "./director.js";
import { createGallery } from "./gallery.js";
import { mountCostume } from "./rooms.js";
import { createBehavior } from "./behavior.js";
import { createNotebook } from "./notebook.js";

const tallyEl  = document.getElementById("tally");
const ticksEl  = document.getElementById("ticks");
const hintEl   = document.getElementById("hint");
const titleEl  = document.getElementById("title");
const beginBtn = document.getElementById("begin");
const flashEl  = document.getElementById("flash");
const tearEl   = document.getElementById("tear");
const stageEl  = document.getElementById("stage");
const osEl     = document.getElementById("os");
const world    = document.getElementById("world");

const audio    = createAudio();
const director = createDirector();
const behavior = createBehavior();
const notebook = createNotebook();

let mode      = "title";
let shifting  = false;
let room      = null;
let nearDoor  = null;
let parasite  = null;
let doorTimer = 0;

// ── Notebook setup ────────────────────────────────────────────────────────────
notebook.mount(document.body);

// Notebook toggle button (shown after generation 2)
const notebookBtn = document.createElement("button");
notebookBtn.type = "button";
notebookBtn.className = "notebook-btn";
notebookBtn.setAttribute("aria-label", "toggle notebook");
notebookBtn.textContent = "notebook";
notebookBtn.hidden = true;
notebookBtn.addEventListener("click", () => notebook.toggle());
document.body.append(notebookBtn);

// ── Gallery ───────────────────────────────────────────────────────────────────
const gallery = createGallery(world, enterDoor);

// ── Master reveal overlay ─────────────────────────────────────────────────────
const masterReveal = document.createElement("div");
masterReveal.className = "master-reveal";
masterReveal.hidden = true;
masterReveal.innerHTML = `
  <div class="master-reveal__inner">
    <p class="master-reveal__text">The Master Rule:</p>
    <p class="master-reveal__body">Whatever you believe the rules are, the game has been trying to prove you wrong.<br><br>You have been playing.<br>So has it.</p>
    <button type="button" class="master-reveal__btn">begin again</button>
  </div>
`;
document.body.append(masterReveal);
masterReveal.querySelector(".master-reveal__btn").addEventListener("click", () => {
  masterReveal.hidden = true;
  masterReveal.classList.remove("master-reveal--visible");
  // restart
  director.boot();
  behavior.generation = 0;
  behavior.jumpCount = 0;
  behavior.leftBias = 0;
  behavior._leftMoves = 0;
  behavior._rightMoves = 0;
  setScore(0);
  showGallery();
});

// ─────────────────────────────────────────────────────────────────────────────

function renderTicks() {
  const n = Math.min(14, director.generation + 1);
  ticksEl.innerHTML = "";
  for (let i = 0; i < n; i += 1) {
    const dot = document.createElement("span");
    if (i <= director.generation) dot.classList.add("on");
    ticksEl.appendChild(dot);
  }
}

function setScore(n) {
  tallyEl.textContent = String(n);
  tallyEl.classList.remove("pop");
  void tallyEl.offsetWidth;
  tallyEl.classList.add("pop");
}

function flash(kind) {
  flashEl.className = `flash ${kind}`;
  flashEl.addEventListener("animationend", () => {
    flashEl.className = "flash";
  }, { once: true });
}

function showHint(text, duration = 2800) {
  hintEl.textContent = text;
  if (duration > 0) {
    setTimeout(() => {
      if (hintEl.textContent === text) hintEl.textContent = "";
    }, duration);
  }
}

function doorsFor(script) {
  if (director.generation === 0) {
    return [{ label: script.doorLabel, costume: script.costume, glow: 0xe8d5a3 }];
  }
  const decoys = [
    { label: "SNAKE",            costume: script.costume, glow: 0x7ec8c8 },
    { label: "HELP",             costume: script.costume, glow: 0xe07a5f },
    { label: script.doorLabel,   costume: script.costume, glow: 0xc9a0dc },
  ];
  decoys.forEach((d, i) => {
    if (i > 0 && Math.random() < 0.4) d.label = script.lie.slice(0, 12).toUpperCase();
  });
  return decoys.slice(0, 1 + (director.generation % 3));
}

function showGallery() {
  mode = "gallery";
  gallery.enable(true);
  gallery.reset();
  gallery.setDoors(doorsFor(director.script));
  stageEl.hidden = true;
  osEl.hidden = true;
  hintEl.textContent = director.generation === 0 ? "walk in" : "";
  audio.setDrone(director.script.drone);
  renderTicks();

  // Show notebook button after gen 2
  if (director.generation >= 2) {
    notebookBtn.hidden = false;
  }

  // Mark notebook outdated every 4 rounds
  if (director.generation > 0 && director.generation % 4 === 0) {
    notebook.markOutdated();
  }
}

function enterDoor(spec) {
  if (shifting || mode === "room") return;

  // Track which side the door is on for behavioral analysis
  // gallery doors are arranged left-to-right; use spec index if available
  if (spec._index !== undefined) {
    behavior.record(spec._index === 0 ? "enter-left" : "enter-right");
  }

  audio.blip(420);
  openCostume(spec.costume || director.script.costume);
}

function openCostume(name) {
  gallery.enable(false);
  mode = "room";
  hintEl.textContent = "";
  if (room) room.unmount();
  const script = { ...director.script, costume: name };
  room = mountCostume(name, stageEl, osEl, script, handle);
  if (script.infect === "popup" && name !== "desktop") {
    osEl.hidden = false;
    parasite = mountCostume("desktop", stageEl, osEl, script, handle);
    stageEl.hidden = false;
  }

  // Show invert hint
  if (script.invert) {
    setTimeout(() => showHint("something shifted"), 600);
  }
}

function handle(event) {
  if (shifting || mode === "title") return;
  const result = director.note(event);
  if (event.type === "score" || event.type === "brick") audio.blip(500 + (event.value || 0) * 40);
  if (event.type === "die" || event.type === "miss") audio.thud();
  if (result) resolve(result);
}

function resolve(kind) {
  if (shifting) return;
  shifting = true;
  tearEl.classList.add("on");

  if (kind === "master-win") {
    audio.shift(true);
    flash("warm");
    window.setTimeout(() => {
      tearEl.classList.remove("on");
      if (room) { room.unmount(); room = null; }
      if (parasite) { parasite.unmount(); parasite = null; }
      shifting = false;
      showMasterReveal();
    }, 760);
    return;
  }

  if (kind === "rewrite") {
    // Rule mutated mid-round
    showHint("the rules just changed");
    notebook.spook();
  }

  audio.shift(kind === "win");
  flash(kind === "win" ? "warm" : "cold");
  if (kind === "win") setScore(director.solved + 1);

  window.setTimeout(() => {
    tearEl.classList.remove("on");
    if (room) { room.unmount(); room = null; }
    if (parasite) { parasite.unmount(); parasite = null; }
    const nextScript = director.advance(kind);
    behavior.recordWin(nextScript?.win?.kind || null);
    gallery.calm();
    shifting = false;
    showGallery();
  }, 760);
}

function showMasterReveal() {
  director.advance("master-win");
  masterReveal.hidden = false;
  // Force reflow then add visible class for CSS transition
  void masterReveal.offsetWidth;
  masterReveal.classList.add("master-reveal--visible");
}

function begin() {
  audio.resume();
  titleEl.classList.add("gone");
  director.boot();
  setScore(0);
  showGallery();
}

beginBtn.addEventListener("click", begin);
window.addEventListener("keydown", (e) => {
  if (!titleEl.classList.contains("gone") && (e.key === "Enter" || e.key === " ")) {
    begin();
    return;
  }
  if (mode === "gallery") {
    if (e.key === "Enter" || e.key === "e" || e.key === "E") {
      gallery.enterNearest();
    }
    // Track jumps in gallery
    if (e.key === " ") {
      behavior.record("gallery-jump");
    }
  }
});

// ── Main loop ─────────────────────────────────────────────────────────────────
let last = performance.now();
let prevYaw = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (mode === "gallery") {
    const door = gallery.tick(dt);
    nearDoor = door;

    // Track gallery camera yaw for behavioral analysis
    if (gallery.getYaw) {
      const yaw = gallery.getYaw();
      const delta = yaw - prevYaw;
      if (Math.abs(delta) > 0.01) {
        behavior.record(delta < 0 ? "gallery-left" : "gallery-right");
      }
      prevYaw = yaw;
    }

    if (door && !shifting) {
      doorTimer += dt;
      hintEl.textContent = "enter";
      if (doorTimer > 0.4) {
        doorTimer = 0;
        enterDoor(door);
      }
    } else {
      doorTimer = 0;
      if (mode === "gallery") hintEl.textContent = director.generation === 0 ? "walk in" : "";
    }
  } else if (mode === "title") {
    gallery.tick(dt);
  } else {
    gallery.tick(dt);
    room?.tick?.(dt);
    parasite?.tick?.(dt);
    const idle = director.tickIdle(dt);
    if (idle) resolve(idle);
  }

  if (shifting) gallery.glitchHue(now / 1000);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
