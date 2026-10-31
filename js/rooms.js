// rooms.js - mini-game rooms

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function makeStage(root, title, onClose) {
  root.innerHTML = "";
  const wrap = el(`<div class="stage-inner" style="display:contents"></div>`);
  const bar = el(`<div class="bar"><span></span><button type="button" aria-label="close">×</button></div>`);
  bar.querySelector("span").textContent = title;
  bar.querySelector("button").addEventListener("click", () => onClose());
  const play = el(`<div class="play"></div>`);
  root.append(bar, play);
  return play;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAKE
// ─────────────────────────────────────────────────────────────────────────────
export function mountSnake(root, script, send) {
  const play = makeStage(root, script.lie, () => send({ type: "close", score: score }));
  const canvas = document.createElement("canvas");
  canvas.className = "pixel";
  play.append(canvas);
  const ctx = canvas.getContext("2d");
  const cols = 24;
  const rows = 16;
  let dir = { x: 1, y: 0 };
  let next = { x: 1, y: 0 };
  let snake = [
    { x: 6, y: 8 },
    { x: 5, y: 8 },
    { x: 4, y: 8 },
  ];
  let apple = { x: 14, y: 8 };
  let score = 0;
  let acc = 0;
  let dead = false;
  if (script.invert) dir = next = { x: -1, y: 0 };

  function placeApple() {
    apple = {
      x: (Math.random() * cols) | 0,
      y: (Math.random() * rows) | 0,
    };
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    const map =
      script.infect === "keys"
        ? { arrowup: [0, 1], arrowdown: [0, -1], arrowleft: [1, 0], arrowright: [-1, 0], w: [0, 1], s: [0, -1], a: [1, 0], d: [-1, 0] }
        : { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    if (!map[k]) return;
    send({ type: "input" });
    const [x, y] = map[k];
    if (x === -dir.x && y === -dir.y) return;
    next = { x, y };
  }
  window.addEventListener("keydown", onKey);

  return {
    tick(dt) {
      if (dead) return;
      acc += dt;
      const step = 0.13;
      if (acc < step) {
        draw();
        return;
      }
      acc -= step;
      dir = next;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows;
      const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) {
        dead = true;
        send({ type: "die" });
        draw();
        return;
      }
      snake.unshift(head);
      if (head.x === apple.x && head.y === apple.y) {
        score += 1;
        send({ type: "score", value: score });
        placeApple();
      } else snake.pop();
      draw();
    },
    unmount() {
      window.removeEventListener("keydown", onKey);
    },
  };

  function draw() {
    const w = (canvas.width = play.clientWidth * 2 || 800);
    const h = (canvas.height = play.clientHeight * 2 || 500);
    const tw = w / cols;
    const th = h / rows;
    ctx.fillStyle = "#07080a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(232,224,208,0.05)";
    for (let x = 0; x <= cols; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * tw, 0);
      ctx.lineTo(x * tw, h);
      ctx.stroke();
    }
    ctx.fillStyle = "#e07a5f";
    ctx.fillRect(apple.x * tw + 4, apple.y * th + 4, tw - 8, th - 8);
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#f4efe4" : "#cfc4b0";
      ctx.fillRect(s.x * tw + 3, s.y * th + 3, tw - 6, th - 6);
    });
    ctx.fillStyle = "#e8d5a3";
    ctx.font = "28px Outfit, sans-serif";
    ctx.fillText(String(score), 24, 40);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BREAKOUT
// ─────────────────────────────────────────────────────────────────────────────
export function mountBreakout(root, script, send) {
  const play = makeStage(root, script.lie, () => send({ type: "close" }));
  const canvas = document.createElement("canvas");
  canvas.className = "pixel";
  play.append(canvas);
  const ctx = canvas.getContext("2d");
  const bricks = [];
  const colors = ["#e8d5a3", "#7ec8c8", "#e07a5f", "#81b29a", "#c9a0dc"];
  let paddle = 0.5;
  let ball = { x: 0.5, y: 0.7, vx: 0.28, vy: -0.42 };
  let bricksHit = 0;
  let moved = false;
  const keys = new Set();

  function layout() {
    bricks.length = 0;
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        bricks.push({ c, r, live: true, color: colors[r] });
      }
    }
  }
  layout();

  function onKey(e) {
    keys.add(e.key.toLowerCase());
    send({ type: "input" });
  }
  function onUp(e) {
    keys.delete(e.key.toLowerCase());
  }
  play.addEventListener("mousemove", (e) => {
    const rect = play.getBoundingClientRect();
    paddle = (e.clientX - rect.left) / rect.width;
    moved = true;
    send({ type: "move" });
  });
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onUp);

  return {
    tick(dt) {
      const invert = script.invert || script.infect === "keys";
      let dx = 0;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (invert) dx *= -1;
      if (dx) {
        paddle += dx * dt * 0.7;
        moved = true;
        send({ type: "move" });
      }
      paddle = Math.max(0.08, Math.min(0.92, paddle));
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < 0.02 || ball.x > 0.98) ball.vx *= -1;
      if (ball.y < 0.02) ball.vy *= -1;
      if (ball.y > 0.9 && Math.abs(ball.x - paddle) < 0.1) {
        ball.vy = -Math.abs(ball.vy);
        ball.vx += (ball.x - paddle) * 1.4;
      }
      if (ball.y > 1.05) {
        send({ type: "miss", moved });
        ball = { x: 0.5, y: 0.7, vx: 0.28, vy: -0.42 };
      }
      bricks.forEach((b) => {
        if (!b.live) return;
        const x = (b.c + 0.5) / 9;
        const y = 0.12 + b.r * 0.07;
        if (Math.abs(ball.x - x) < 0.055 && Math.abs(ball.y - y) < 0.04) {
          b.live = false;
          ball.vy *= -1;
          bricksHit += 1;
          send({ type: "brick", value: bricksHit });
        }
      });
      draw();
    },
    unmount() {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    },
  };

  function draw() {
    const w = (canvas.width = play.clientWidth * 2 || 800);
    const h = (canvas.height = play.clientHeight * 2 || 500);
    ctx.fillStyle = "#08090c";
    ctx.fillRect(0, 0, w, h);
    bricks.forEach((b) => {
      if (!b.live) return;
      ctx.fillStyle = b.color;
      const bw = w / 9;
      ctx.fillRect(b.c * bw + 8, 40 + b.r * (h * 0.07), bw - 16, h * 0.045);
    });
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(paddle * w - 70, h * 0.9, 140, 16);
    ctx.beginPath();
    ctx.arc(ball.x * w, ball.y * h, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARD
// ─────────────────────────────────────────────────────────────────────────────
export function mountBoard(root, script, send) {
  const words = ["YOU", "WIN", "WAIT", "NOT", "THIS", "LIE", "OPEN", "GATE", "MOVE", "STOP", "RED", "KEY", "", "", "", "", "", "", "", "", "", "", "", "", ""];
  const play = makeStage(root, script.lie, () => send({ type: "close" }));
  const grid = el(`<div class="board"></div>`);
  play.append(grid);
  let held = -1;
  const tiles = words.map((word, i) => {
    const b = el(`<button type="button" class="tile${word ? "" : " blank"}" draggable="true"></button>`);
    b.textContent = word;
    b.addEventListener("click", () => {
      send({ type: "input" });
      if (word) send({ type: "tile", word });
    });
    b.addEventListener("dragstart", () => {
      held = i;
      b.classList.add("held");
    });
    b.addEventListener("dragend", () => b.classList.remove("held"));
    b.addEventListener("dragover", (e) => e.preventDefault());
    b.addEventListener("drop", () => {
      if (held < 0) return;
      const other = tiles[held];
      const tmp = b.textContent;
      b.textContent = other.textContent;
      other.textContent = tmp;
      b.classList.toggle("blank", !b.textContent);
      other.classList.toggle("blank", !other.textContent);
      send({ type: "input" });
      if (b.textContent) send({ type: "tile", word: b.textContent });
    });
    grid.append(b);
    return b;
  });
  return {
    tick() {},
    unmount() {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TERMINAL
// ─────────────────────────────────────────────────────────────────────────────
export function mountTerminal(root, script, send) {
  const play = makeStage(root, script.lie, () => send({ type: "close" }));
  const box = el(`<div class="term"><div class="log"></div><form><span>&gt;</span><input autocomplete="off" spellcheck="false" /></form></div>`);
  play.append(box);
  const log = box.querySelector(".log");
  const form = box.querySelector("form");
  const input = box.querySelector("input");
  const replies = {
    help: script.lie,
    look: "a room that wants to be believed",
    win: "not like that",
    eat: "there is nothing to eat",
    go: "you are already inside",
    open: "it was never closed",
    wait: "...",
    lie: "finally",
    die: "that is one way",
  };
  log.textContent = "the game  ·  a place that speaks\n";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim().toLowerCase();
    input.value = "";
    if (!text) return;
    log.textContent += "> " + text + "\n" + (replies[text] || "that word is not from this room") + "\n";
    log.scrollTop = log.scrollHeight;
    send({ type: "type", text });
  });
  queueMicrotask(() => input.focus());
  return { tick() {}, unmount() {} };
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP
// ─────────────────────────────────────────────────────────────────────────────
export function mountDesktop(os, script, send) {
  const iconsEl = os.querySelector("#icons");
  const windowsEl = os.querySelector("#windows");
  const clockBtn = os.querySelector("#clock");
  const startBtn = os.querySelector("#startBtn");
  const tasks = os.querySelector("#tasks");
  iconsEl.innerHTML = "";
  windowsEl.innerHTML = "";
  tasks.textContent = script.lie;
  let opened = 0;
  let menu = os.querySelector(".menu");
  if (!menu) {
    menu = el(`<div class="menu" hidden></div>`);
    os.append(menu);
  }
  menu.hidden = true;
  menu.innerHTML = `<button type="button" data-act="about">about this</button><button type="button" data-act="sleep">sleep</button><button type="button" data-act="lie">${script.lie}</button>`;

  const icons = [
    { id: "snake", glyph: "S", name: "snake.exe" },
    { id: "breakout", glyph: "B", name: "breakout.exe" },
    { id: "notes", glyph: "n", name: "notes.txt" },
    { id: "term", glyph: ">", name: "terminal" },
    { id: "trash", glyph: "□", name: "trash" },
  ];

  icons.forEach((icon, idx) => {
    const b = el(`<button class="icon" type="button"><div class="glyph"></div><span></span></button>`);
    b.querySelector(".glyph").textContent = icon.glyph;
    b.querySelector("span").textContent = icon.name;
    b.style.position = "relative";
    b.draggable = true;
    b.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text", icon.id);
    });
    b.addEventListener("dblclick", () => openIcon(icon));
    b.addEventListener("click", () => send({ type: "input" }));
    iconsEl.append(b);
    b.style.marginTop = idx === 0 ? "0" : "";
  });

  const trashBtn = [...iconsEl.children][4];
  trashBtn.addEventListener("dragover", (e) => e.preventDefault());
  trashBtn.addEventListener("drop", (e) => {
    e.preventDefault();
    send({ type: "trash", id: e.dataTransfer.getData("text") });
  });

  function openIcon(icon) {
    opened += 1;
    send({ type: "open", value: opened, id: icon.id });
    if (icon.id === "trash") {
      send({ type: "trash", id: "open" });
      return;
    }
    const win = el(`<article class="window"><header><span></span><button type="button">×</button></header><div class="body"></div></article>`);
    win.style.left = `${120 + opened * 28}px`;
    win.style.top = `${70 + opened * 24}px`;
    win.style.width = icon.id === "notes" || icon.id === "term" ? "420px" : "520px";
    win.querySelector("span").textContent = icon.name;
    win.querySelector("header button").addEventListener("click", () => {
      win.remove();
      send({ type: "close" });
    });
    const body = win.querySelector(".body");
    if (icon.id === "notes") {
      const n = el(`<div class="notes" contenteditable="true"></div>`);
      n.textContent = script.lie + "\n\n(do the opposite of whatever this says)";
      n.addEventListener("input", () => send({ type: "type", text: n.textContent.trim().toLowerCase().split(/\s+/).pop() }));
      body.append(n);
    } else if (icon.id === "term") {
      mountTerminal(body, script, send);
      body.querySelector(".bar")?.remove();
      const play = body.querySelector(".play") || body;
      play.style.minHeight = "240px";
    } else {
      body.innerHTML = `<p class="notes">${icon.name} is busy pretending.</p>`;
    }
    windowsEl.append(win);
    dragWindow(win);
  }

  startBtn.onclick = () => {
    menu.hidden = !menu.hidden;
    send({ type: "menu" });
  };
  menu.onclick = (e) => {
    const act = e.target.dataset?.act;
    if (!act) return;
    send({ type: "menu", act });
    menu.hidden = true;
  };

  let fake = 11 * 60 + 47;
  clockBtn.textContent = "11:47";
  const clockTimer = setInterval(() => {
    fake += script.win.kind === "clock" ? 7 : 1;
    const h = String(Math.floor(fake / 60) % 24).padStart(2, "0");
    const m = String(fake % 60).padStart(2, "0");
    clockBtn.textContent = `${h}:${m}`;
    if (h === "12" && m === "00") send({ type: "clock" });
  }, 400);
  clockBtn.onclick = () => send({ type: "clock-click" });

  return {
    tick() {},
    unmount() {
      clearInterval(clockTimer);
      startBtn.onclick = null;
      iconsEl.innerHTML = "";
      windowsEl.innerHTML = "";
      menu.hidden = true;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMBER  (text-adventure room)
// ─────────────────────────────────────────────────────────────────────────────
export function mountChamber(root, script, send) {
  const play = makeStage(root, script.lie, () => send({ type: "close" }));

  const box = el(`<div class="term chamber-term"><div class="log chamber-log"></div><form><span>&gt;</span><input autocomplete="off" spellcheck="false" placeholder="type a command…" /></form></div>`);
  play.append(box);
  const log = box.querySelector(".chamber-log");
  const form = box.querySelector("form");
  const input = box.querySelector("input");

  // State
  let hasCube = false;
  let doorOpen = false;
  let talkCount = 0;
  let jumpCount = 0;
  let waitElapsed = 0;
  let isWaiting = false;
  let waitTimer = null;

  const ROOM_DESC =
    "You are in a stone chamber.\n" +
    "A RED DOOR stands to the north.\n" +
    "A BLUE CUBE sits on the floor.\n" +
    "A STRANGE CHARACTER watches from the corner.\n" +
    "A clock on the wall runs backwards.";

  // Character dialogue - increasingly cryptic
  const TALKS = [
    "\"The answer is obvious,\" the character says, and looks away.",
    "\"You already know what to do. Everyone does. Eventually.\"",
    "\"The door has not moved. Nor has the cube. Nor have you, really.\"",
    "\"I told you. You weren't listening. I won't say it again.\"",
    "\"...\"",
    "The character seems to be counting under their breath.",
    "\"The clock agrees with me. You should ask the clock.\"",
    "\"Do the opposite of what you think.\"",
  ];

  function print(text) {
    log.textContent += text + "\n";
    log.scrollTop = log.scrollHeight;
  }

  function inventory() {
    return hasCube ? "You are holding: BLUE CUBE." : "Your hands are empty.";
  }

  print(ROOM_DESC);
  print("");
  print("(type HELP for a hint, or explore the room)");
  print("");

  const commands = {
    look() {
      print(ROOM_DESC);
      print(inventory());
    },
    "take cube"() {
      if (hasCube) { print("You already have the cube."); return; }
      hasCube = true;
      print("You pick up the BLUE CUBE. It is heavier than expected.");
      send({ type: "input" });
    },
    "drop cube"() {
      if (!hasCube) { print("You have nothing to drop."); return; }
      hasCube = false;
      print("You set the BLUE CUBE down carefully.");
      send({ type: "input" });
      send({ type: "drop-all" });
    },
    "open door"() {
      if (doorOpen) { print("The door is already open... and yet you cannot leave."); return; }
      if (hasCube) {
        doorOpen = true;
        print("The door creaks open. A pale light streams through.");
        send({ type: "cube-door" });
      } else {
        print("The door does not move. You push harder. Nothing.");
      }
    },
    talk() {
      talkCount += 1;
      const line = TALKS[Math.min(talkCount - 1, TALKS.length - 1)];
      print(line);
      send({ type: "input" });
      if (talkCount === 3) {
        print("(The character stares at you for a long moment.)");
        send({ type: "talk-three" });
      }
    },
    jump() {
      jumpCount += 1;
      print("You jump. The chamber does not care.");
      send({ type: "input" });
      if (jumpCount === 3) {
        print("You jump a third time. Something shifts.");
        send({ type: "jump-three" });
      }
    },
    wait() {
      if (isWaiting) { print("You are already waiting."); return; }
      isWaiting = true;
      print("You wait. The clock ticks backwards. The character watches.");
      waitElapsed = 0;
      waitTimer = setInterval(() => {
        waitElapsed += 1;
        if (waitElapsed % 2 === 0) print(`...${waitElapsed}s`);
        send({ type: "wait", seconds: waitElapsed });
        if (waitElapsed >= 8) {
          clearInterval(waitTimer);
          waitTimer = null;
          isWaiting = false;
          print("Something gives. The chamber acknowledges your patience.");
          send({ type: "wait-long" });
        }
      }, 1000);
    },
    lie() {
      print("\"Lie,\" you say. The word hangs in the air.");
      send({ type: "type", text: "lie" });
      send({ type: "lie-word" });
    },
    help() {
      // Lies - gives wrong information based on script.lie
      print(`The character glances at you. "${script.lie}."`);
      print("(This may or may not be true.)");
      send({ type: "type", text: "help" });
    },
    inventory() {
      print(inventory());
    },
    inv() {
      print(inventory());
    },
    "look door"() {
      print("The RED DOOR stands impassive. It has seen many things.");
    },
    "look cube"() {
      print("The BLUE CUBE is smooth and cold. Somehow familiar.");
    },
    "look clock"() {
      print("The clock's hands move counter-clockwise. This is not an error.");
    },
    "look character"() {
      print("The STRANGE CHARACTER does not blink. This is deliberate.");
    },
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    input.value = "";
    if (!raw) return;
    const text = raw.toLowerCase();
    print("> " + raw);
    if (commands[text]) {
      commands[text]();
    } else {
      print("The chamber does not understand \"" + raw + "\".");
      print("(try: look, take cube, drop cube, open door, talk, jump, wait, lie, help, inventory)");
    }
    print("");
  });

  queueMicrotask(() => input.focus());

  return {
    tick(dt) {
      // idle wait tracking handled by setInterval above
    },
    unmount() {
      if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOCKROOM
// ─────────────────────────────────────────────────────────────────────────────
export function mountClockRoom(root, script, send) {
  const play = makeStage(root, script.lie, () => send({ type: "close" }));

  const canvas = document.createElement("canvas");
  canvas.className = "pixel";
  canvas.style.cursor = "pointer";
  play.append(canvas);
  const ctx = canvas.getContext("2d");

  // Clock angle - runs backwards
  let angle = 0; // radians, counter-clockwise
  let idleTimer = 0;
  let lastInteraction = 0;
  let raf;

  // Wall elements (N/S/E/W shown as colored strips on edges)
  const walls = [
    { id: "north", label: "N", color: "#4a2020" },
    { id: "south", label: "S", color: "#1e3a2f" },
    { id: "east",  label: "E", color: "#1a2a4a" },
    { id: "west",  label: "W", color: "#3a2a10" },
  ];

  function isNearTwelve() {
    // hand at 12 = angle ≈ -π/2 (pointing up); we track normalized
    const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // pointing up in canvas coords = angle 0 in our backward system at start
    // We rotate counter-clockwise, so "12 o'clock" is when angle mod 2π ≈ 3π/2 ... 
    // Simpler: near twelve = norm within 0.35 rad of 0 or 2π
    return norm < 0.35 || norm > Math.PI * 2 - 0.35;
  }

  function getClockRect(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.35;
    return { cx, cy, r };
  }

  function getWallRects(w, h) {
    const thick = Math.min(w, h) * 0.07;
    return {
      north: { x: 0, y: 0, w, h: thick },
      south: { x: 0, y: h - thick, w, h: thick },
      east:  { x: w - thick, y: 0, w: thick, h },
      west:  { x: 0, y: 0, w: thick, h },
    };
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const w = canvas.width;
    const h = canvas.height;

    idleTimer = 0;
    lastInteraction = performance.now();

    // Check walls first
    const wr = getWallRects(w, h);
    for (const wall of walls) {
      const r = wr[wall.id];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        send({ type: "wall-touch", wall: wall.id });
        return;
      }
    }

    // Check clock face
    const { cx, cy, r } = getClockRect(w, h);
    const dist = Math.hypot(mx - cx, my - cy);
    if (dist <= r) {
      const atTwelve = isNearTwelve();
      send({ type: "clock-click", atTwelve });
    }
  });

  function draw(dt) {
    // Backwards: subtract angle
    angle -= dt * (Math.PI * 2) * (0.5 / 60); // 0.5 RPM counter-clockwise

    const w = (canvas.width = play.clientWidth * 2 || 800);
    const h = (canvas.height = play.clientHeight * 2 || 500);

    ctx.fillStyle = "#0a070a";
    ctx.fillRect(0, 0, w, h);

    // Draw walls
    const wr = getWallRects(w, h);
    walls.forEach((wall) => {
      const r = wr[wall.id];
      ctx.fillStyle = wall.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "rgba(232,224,208,0.3)";
      ctx.font = `${Math.max(14, h * 0.04)}px IBM Plex Mono, monospace`;
      ctx.textAlign = "center";
      const tx = r.x + r.w / 2;
      const ty = r.y + r.h / 2 + 6;
      ctx.fillText(wall.label, tx, ty);
    });

    // Draw clock face
    const { cx, cy, r } = getClockRect(w, h);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#151017";
    ctx.fill();
    ctx.strokeStyle = "rgba(232,224,208,0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Clock numerals (backwards: 12 at top, then 11, 10... going clockwise)
    ctx.fillStyle = "rgba(232,224,208,0.55)";
    ctx.font = `${Math.max(10, r * 0.18)}px Cormorant Garamond, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 1; i <= 12; i++) {
      // backwards order: position i at angle that would be 13-i normally
      const num = (13 - i) % 12 || 12;
      const a = ((i / 12) * Math.PI * 2) - Math.PI / 2;
      const nx = cx + Math.cos(a) * r * 0.78;
      const ny = cy + Math.sin(a) * r * 0.78;
      ctx.fillText(String(num), nx, ny);
    }

    // Clock tick marks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const inner = i % 5 === 0 ? r * 0.82 : r * 0.88;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96);
      ctx.strokeStyle = i % 5 === 0 ? "rgba(232,224,208,0.7)" : "rgba(232,224,208,0.25)";
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.stroke();
    }

    // Hour hand (backwards - going counter-clockwise)
    const hourAngle = angle * (1 / 12) - Math.PI / 2;
    drawHand(cx, cy, hourAngle, r * 0.55, 5, "#f4efe4");

    // Minute hand (backwards)
    const minAngle = angle - Math.PI / 2;
    drawHand(cx, cy, minAngle, r * 0.78, 3, "#e8d5a3");

    // Second hand (backwards, faster)
    const secAngle = angle * 60 - Math.PI / 2;
    drawHand(cx, cy, secAngle, r * 0.85, 1, "#e07a5f");

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#f4efe4";
    ctx.fill();

    // Hint text
    ctx.fillStyle = "rgba(232,224,208,0.2)";
    ctx.font = `${Math.max(10, h * 0.025)}px IBM Plex Mono, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("time runs backwards here", w / 2, h - 20);
  }

  function drawHand(cx, cy, angle, len, width, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  let lastTime = performance.now();
  let ticking = true;

  return {
    tick(dt) {
      if (!ticking) return;
      idleTimer += dt;
      draw(dt);
      if (idleTimer >= 7) {
        idleTimer = 0;
        send({ type: "idle-still" });
      }
    },
    unmount() {
      ticking = false;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MIRROR ROOM
// ─────────────────────────────────────────────────────────────────────────────
export function mountMirror(root, script, send) {
  const play = makeStage(root, script.lie, () => send({ type: "close" }));

  const canvas = document.createElement("canvas");
  canvas.className = "pixel";
  play.append(canvas);
  const ctx = canvas.getContext("2d");

  // Player avatar position (normalized 0-1 within left half)
  let px = 0.25, py = 0.5;
  // Mirror avatar (moves opposite direction)
  let mx = 0.75, my = 0.5;

  // Red zone in right half
  let zoneX = 0.65 + Math.random() * 0.25;
  let zoneY = 0.15 + Math.random() * 0.7;

  let stillTimer = 0;
  let moving = false;
  let hasMoved = false;

  const SPEED = 0.35; // units per second
  const AVATAR_R = 0.04;
  const ZONE_R = 0.07;

  const keys = new Set();

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
      keys.add(k);
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);

  let running = true;
  let sentWin = false;

  return {
    tick(dt) {
      if (!running || sentWin) return;

      let dx = 0, dy = 0;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;

      if (dx !== 0 || dy !== 0) {
        moving = true;
        hasMoved = true;
        stillTimer = 0;

        // Normalize diagonal
        const len = Math.hypot(dx, dy);
        dx = (dx / len) * SPEED * dt;
        dy = (dy / len) * SPEED * dt;

        // Player moves on left half (0 to 0.5)
        px = Math.max(AVATAR_R, Math.min(0.5 - AVATAR_R, px + dx));
        py = Math.max(AVATAR_R, Math.min(1 - AVATAR_R, py + dy));

        // Mirror moves OPPOSITE direction, on right half (0.5 to 1)
        mx = Math.max(0.5 + AVATAR_R, Math.min(1 - AVATAR_R, mx - dx));
        my = Math.max(AVATAR_R, Math.min(1 - AVATAR_R, my - dy));
      } else {
        moving = false;
        stillTimer += dt;
        if (stillTimer >= 5 && hasMoved) {
          stillTimer = -999; // prevent repeated fires
          send({ type: "stand-still" });
        }
      }

      // Check: mirror avatar reaches red zone
      const distZone = Math.hypot(mx - zoneX, my - zoneY);
      if (distZone < ZONE_R + AVATAR_R) {
        sentWin = true;
        send({ type: "reach-zone" });
      }

      // Check: mirror avatar and player avatar overlap (in abstract "same" coords)
      // Mirror is symmetric: if px corresponds to mx, they overlap when |px - (1-mx)| < threshold
      const mirrorEquiv = 1 - mx; // mirror x mapped to left-half coords
      const distSelf = Math.hypot(px - mirrorEquiv, py - my);
      if (distSelf < AVATAR_R * 2.5) {
        sentWin = true;
        send({ type: "touch-mirror" });
      }

      // Escape: player reaches left or right edge extremes
      if (px <= AVATAR_R * 0.5 || py <= AVATAR_R * 0.5 || py >= 1 - AVATAR_R * 0.5) {
        sentWin = true;
        send({ type: "escape" });
      }

      // Move zone slightly every few seconds to keep it interesting
      // (zone drifts toward mirror avatar slightly - teasing)
      zoneX += (mx - zoneX) * dt * 0.05;
      zoneY += (my - zoneY) * dt * 0.05;
      zoneX = Math.max(0.52, Math.min(0.97, zoneX));
      zoneY = Math.max(0.05, Math.min(0.95, zoneY));

      draw(dt);
    },
    unmount() {
      running = false;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    },
  };

  function draw() {
    const w = (canvas.width = play.clientWidth * 2 || 800);
    const h = (canvas.height = play.clientHeight * 2 || 500);

    ctx.fillStyle = "#06070a";
    ctx.fillRect(0, 0, w, h);

    // Left side (player)
    ctx.fillStyle = "#0a0b12";
    ctx.fillRect(0, 0, w / 2, h);

    // Right side (mirror)
    ctx.fillStyle = "#0d0a10";
    ctx.fillRect(w / 2, 0, w / 2, h);

    // Centre divider - mirror glass
    const grad = ctx.createLinearGradient(w / 2 - 8, 0, w / 2 + 8, 0);
    grad.addColorStop(0, "rgba(126,200,200,0.3)");
    grad.addColorStop(0.5, "rgba(200,200,232,0.6)");
    grad.addColorStop(1, "rgba(126,200,200,0.3)");
    ctx.fillStyle = grad;
    ctx.fillRect(w / 2 - 4, 0, 8, h);

    // Red zone (on right side)
    const zx = zoneX * w;
    const zy = zoneY * h;
    const zr = ZONE_R * Math.min(w, h);
    ctx.beginPath();
    ctx.arc(zx, zy, zr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(224,122,95,0.3)";
    ctx.fill();
    ctx.strokeStyle = "rgba(224,122,95,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player avatar (left side)
    const par = AVATAR_R * Math.min(w, h);
    ctx.beginPath();
    ctx.arc(px * w, py * h, par, 0, Math.PI * 2);
    ctx.fillStyle = "#f4efe4";
    ctx.fill();

    // Mirror avatar (right side) - slightly different appearance
    const mar = AVATAR_R * Math.min(w, h);
    ctx.beginPath();
    ctx.arc(mx * w, my * h, mar, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(201,160,220,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(201,160,220,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(232,224,208,0.2)";
    ctx.font = `${Math.max(10, h * 0.025)}px IBM Plex Mono, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("you", w * 0.25, h - 18);
    ctx.fillText("the mirror", w * 0.75, h - 18);

    // Still timer indicator
    if (stillTimer > 0 && hasMoved) {
      ctx.fillStyle = "rgba(232,224,208,0.15)";
      ctx.textAlign = "center";
      ctx.fillText(`still: ${stillTimer.toFixed(1)}s`, w * 0.5, 30);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag-window helper
// ─────────────────────────────────────────────────────────────────────────────
function dragWindow(win) {
  const header = win.querySelector("header");
  let grab = null;
  header.addEventListener("mousedown", (e) => {
    grab = { x: e.clientX - win.offsetLeft, y: e.clientY - win.offsetTop };
  });
  window.addEventListener("mouseup", () => {
    grab = null;
  });
  window.addEventListener("mousemove", (e) => {
    if (!grab) return;
    win.style.left = `${e.clientX - grab.x}px`;
    win.style.top = `${e.clientY - grab.y}px`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MOUNT COSTUME - router
// ─────────────────────────────────────────────────────────────────────────────
export function mountCostume(name, stage, os, script, send) {
  if (name === "desktop") {
    stage.hidden = true;
    os.hidden = false;
    return mountDesktop(os, script, send);
  }
  os.hidden = true;
  stage.hidden = false;
  if (name === "snake")     return mountSnake(stage, script, send);
  if (name === "breakout")  return mountBreakout(stage, script, send);
  if (name === "board")     return mountBoard(stage, script, send);
  if (name === "terminal")  return mountTerminal(stage, script, send);
  if (name === "chamber")   return mountChamber(stage, script, send);
  if (name === "clockroom") return mountClockRoom(stage, script, send);
  if (name === "mirror")    return mountMirror(stage, script, send);
  // fallback
  return mountSnake(stage, script, send);
}
