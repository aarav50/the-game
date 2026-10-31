(() => {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const tallyEl = document.getElementById("tally");
  const ticksEl = document.getElementById("ticks");
  const titleEl = document.getElementById("title");
  const beginBtn = document.getElementById("begin");
  const flashEl = document.getElementById("flash");
  const tearEl = document.getElementById("tear");

  const COLS = 17;
  const ROWS = 13;
  const ROBES = ["#e8d5a3", "#7ec8c8", "#e07a5f", "#81b29a", "#c9a0dc"];

  const state = {
    running: false,
    shifting: false,
    generation: 0,
    solved: 0,
    progress: 0,
    time: 0,
    roundTime: 0,
    width: 0,
    height: 0,
    dpr: 1,
    tile: 40,
    ox: 0,
    oy: 0,
    keys: new Set(),
    mouse: { x: 0, y: 0 },
    player: null,
    people: [],
    stones: [],
    lanterns: [],
    particles: [],
    grid: [],
    rite: null,
    shake: 0,
    pulse: 0,
    moon: 0.4,
    lastAngle: 0,
    wind: 0,
    sequence: [],
    interactLock: 0,
  };

  const audio = createAudio();

  function rand() {
    return Math.random();
  }
  function pick(list) {
    return list[(Math.random() * list.length) | 0];
  }
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function irand(n) {
    return (rand() * n) | 0;
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    const pad = Math.min(state.width, state.height) * 0.08;
    state.tile = Math.floor(Math.min((state.width - pad * 2) / COLS, (state.height - pad * 2.4) / ROWS));
    state.ox = (state.width - state.tile * COLS) / 2;
    state.oy = (state.height - state.tile * ROWS) / 2 + 10;
  }

  function cell(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return { t: "wall" };
    return state.grid[r][c];
  }

  function walkable(c, r) {
    const t = cell(c, r).t;
    return t !== "wall";
  }

  function tileKind(x, y) {
    return cell(Math.floor(x), Math.floor(y)).t;
  }

  function buildGrid(pattern) {
    const g = [];
    for (let r = 0; r < ROWS; r += 1) {
      const row = [];
      for (let c = 0; c < COLS; c += 1) {
        const edge = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
        const gate = r === 0 && c >= 7 && c <= 9;
        if (edge && !gate) {
          row.push({ t: "wall" });
          continue;
        }
        if (gate) {
          row.push({ t: "gate" });
          continue;
        }
        if (c === 8 && r === 6) {
          row.push({ t: "altar" });
          continue;
        }
        if (pattern === "pool" && c >= 7 && c <= 9 && r >= 8 && r <= 10) {
          row.push({ t: "water" });
          continue;
        }
        let floor = "light";
        if (pattern === "checker") floor = (c + r) % 2 === 0 ? "dark" : "light";
        else if (pattern === "stripes") floor = c % 2 === 0 ? "dark" : "light";
        else if (pattern === "rows") floor = r % 2 === 0 ? "dark" : "light";
        else if (pattern === "frame") floor = c <= 2 || c >= COLS - 3 || r <= 2 || r >= ROWS - 3 ? "dark" : "light";
        else if (pattern === "cross") floor = c === 8 || r === 6 ? "dark" : "light";
        else if (pattern === "spiral") floor = ((c * 3 + r * 5) % 4) < 2 ? "dark" : "light";
        row.push({ t: floor });
      }
      g.push(row);
    }
    return g;
  }

  function createRite(generation) {
    if (generation === 0) {
      return {
        walk: "dark",
        goal: "gate",
        carry: null,
        lanterns: false,
        pulse: false,
        bow: false,
        orbit: 0,
        avoid: null,
        invert: false,
        liar: false,
        pattern: "stripes",
        drone: 96,
      };
    }

    const walk = pick(["dark", "light", "any", "any", "edge", "not-water"]);
    const goals = ["gate", "gate", "altar", "lanterns", "bow", "orbit", "still"];
    let goal = pick(goals);
    if (generation < 2) goal = pick(["gate", "altar", "lanterns"]);

    const carry = goal === "altar" ? pick(ROBES) : rand() < 0.25 ? pick(ROBES) : null;
    const lanterns = goal === "lanterns" || (goal === "gate" && rand() < 0.2);
    const pulse = goal === "still" || (generation > 2 && rand() < 0.28);
    const bow = goal === "bow";
    const orbit = goal === "orbit" ? 2 + irand(2) : 0;
    const avoid = generation > 1 && rand() < 0.35 ? pick(ROBES) : null;
    const pattern = walk === "not-water" || walk === "water" ? "pool" : pick(["checker", "stripes", "rows", "frame", "cross", "spiral"]);

    return {
      walk: walk === "not-water" && pattern !== "pool" ? "dark" : walk,
      goal,
      carry,
      lanterns,
      pulse,
      bow,
      orbit,
      avoid,
      invert: generation > 3 && rand() < 0.18,
      liar: generation > 2 && rand() < 0.3,
      pattern,
      drone: 70 + rand() * 120,
    };
  }

  function person(kind, x, y, robe, extra) {
    return {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      robe,
      hat: extra.hat || "none",
      scale: extra.scale || 1,
      hold: null,
      bob: rand() * Math.PI * 2,
      target: extra.target || { x, y },
      cooldown: 0,
      demo: 0,
      liar: !!extra.liar,
      angle: 0,
      alive: 1,
    };
  }

  function randomFloor(pred) {
    for (let i = 0; i < 80; i += 1) {
      const c = 1 + irand(COLS - 2);
      const r = 2 + irand(ROWS - 3);
      if (!walkable(c, r)) continue;
      if (pred && !pred(cell(c, r).t, c, r)) continue;
      return { x: c + 0.5, y: r + 0.5 };
    }
    return { x: 8.5, y: 10.5 };
  }

  function legalTile(t, c, r, rite, isLiar) {
    let walk = rite.walk;
    if (isLiar) {
      if (walk === "dark") walk = "light";
      else if (walk === "light") walk = "dark";
      else walk = "any";
    }
    if (t === "wall") return false;
    if (walk === "dark") return t === "dark" || t === "altar" || t === "gate";
    if (walk === "light") return t === "light" || t === "altar" || t === "gate";
    if (walk === "water") return t === "water" || t === "altar" || t === "gate";
    if (walk === "not-water") return t !== "water";
    if (walk === "edge") {
      const nearWall =
        cell(c - 1, r).t === "wall" ||
        cell(c + 1, r).t === "wall" ||
        cell(c, r - 1).t === "wall" ||
        cell(c, r + 1).t === "wall";
      return nearWall || t === "gate" || t === "altar";
    }
    return true;
  }

  function playerLegal(t, c, r, rite) {
    if (rite.invert) {
      const fake = { ...rite, walk: rite.walk === "dark" ? "light" : rite.walk === "light" ? "dark" : rite.walk };
      if (rite.walk === "dark" || rite.walk === "light") return legalTile(t, c, r, fake, false);
    }
    return legalTile(t, c, r, rite, false);
  }

  function placeLanterns() {
    const spots = [
      { x: 3.5, y: 3.5 },
      { x: 13.5, y: 3.5 },
      { x: 3.5, y: 10.5 },
      { x: 13.5, y: 10.5 },
    ];
    state.lanterns = spots.map((s, i) => ({ ...s, lit: 0, id: i, flare: 0 }));
  }

  function placeStones(color) {
    state.stones = [];
    const count = color ? 4 : 3;
    for (let i = 0; i < count; i += 1) {
      const p = randomFloor((t) => t === "dark" || t === "light");
      state.stones.push({
        x: p.x,
        y: p.y,
        color: color && i < 2 ? color : pick(ROBES),
        taken: false,
      });
    }
  }

  function startRound(advance) {
    if (advance) state.generation += 1;
    const rite = createRite(state.generation);
    state.rite = rite;
    state.grid = buildGrid(rite.pattern);
    state.progress = 0;
    state.roundTime = 0;
    state.sequence = [];
    state.wind = 0;
    state.lastAngle = 0;
    placeLanterns();
    placeStones(rite.carry);

    const spawn = randomFloor((t, c, r) => r > 8 && playerLegal(t, c, r, rite));
    state.player = person("you", spawn.x, spawn.y, "#f4efe4", { hat: "none", scale: 1 });

    state.people = [];
    const n = 3 + irand(2);
    let crowned = irand(n);
    for (let i = 0; i < n; i += 1) {
      const p = randomFloor((t, c, r) => r > 3);
      const liar = rite.liar && i === n - 1;
      state.people.push(
        person("npc", p.x, p.y, pick(ROBES), {
          hat: rite.bow && i === crowned ? "crown" : pick(["none", "none", "hood"]),
          scale: 0.9 + rand() * 0.25,
          liar,
        })
      );
    }
    renderTicks();
    audio.setDrone(rite.drone);
  }

  function renderTicks() {
    const n = Math.min(14, state.generation + 1);
    ticksEl.innerHTML = "";
    for (let i = 0; i < n; i += 1) {
      const dot = document.createElement("span");
      if (i <= state.generation) dot.classList.add("on");
      ticksEl.appendChild(dot);
    }
  }

  function bumpScore(delta) {
    state.solved = Math.max(0, state.solved + delta);
    tallyEl.textContent = String(state.solved);
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

  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i += 1) {
      const a = rand() * Math.PI * 2;
      const s = 1.2 + rand() * 3.2;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + rand() * 0.5,
        max: 0.9,
        color,
        r: 0.08 + rand() * 0.1,
      });
    }
  }

  function shiftWorld(success) {
    if (state.shifting) return;
    state.shifting = true;
    tearEl.classList.add("on");
    audio.shift(success);
    if (success) {
      bumpScore(1);
      flash("warm");
      burst(8.5, 0.8, "#e8d5a3", 28);
    } else {
      flash("cold");
      state.shake = 8;
    }
    window.setTimeout(() => {
      tearEl.classList.remove("on");
      startRound(true);
      state.shifting = false;
    }, 780);
  }

  function screenToWorld(px, py) {
    return {
      x: (px - state.ox) / state.tile,
      y: (py - state.oy) / state.tile,
    };
  }

  function nearest(list, p, max) {
    let best = null;
    let bd = max;
    for (const item of list) {
      if (item.taken) continue;
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < bd) {
        bd = d;
        best = item;
      }
    }
    return best;
  }

  function tryInteract() {
    if (state.interactLock > 0 || !state.player) return;
    const p = state.player;
    const rite = state.rite;
    const stone = nearest(state.stones, p, 0.85);
    if (stone && !p.hold) {
      p.hold = stone.color;
      stone.taken = true;
      audio.blip(520);
      burst(stone.x, stone.y, stone.color, 8);
      state.interactLock = 0.2;
      return;
    }
    if (p.hold && Math.hypot(p.x - 8.5, p.y - 6.5) < 1.15) {
      const ok = !rite.carry || p.hold === rite.carry;
      burst(8.5, 6.5, p.hold, 16);
      audio.blip(ok ? 680 : 180);
      if (rite.goal === "altar") {
        if (ok) {
          state.progress += 1;
          p.hold = null;
          if (state.progress >= 1) shiftWorld(true);
        } else {
          p.hold = null;
          shiftWorld(false);
        }
      } else {
        p.hold = null;
        if (rite.carry && !ok) shiftWorld(false);
      }
      state.interactLock = 0.25;
      return;
    }
    const lantern = nearest(state.lanterns, p, 0.9);
    if (lantern && rite.lanterns) {
      lantern.flare = 1;
      lantern.lit = 1;
      audio.blip(400 + lantern.id * 80);
      const order = state.sequence;
      if (order.length === 0 || order[order.length - 1] !== lantern.id) {
        if (order.includes(lantern.id)) {
          state.sequence = [];
          for (const l of state.lanterns) l.lit = 0;
          shiftWorld(false);
          return;
        }
        order.push(lantern.id);
      }
      if (rite.goal === "lanterns" && order.length >= 4) shiftWorld(true);
      state.interactLock = 0.2;
    }
  }

  function canOccupy(body, x, y) {
    const c = Math.floor(x);
    const r = Math.floor(y);
    const t = cell(c, r).t;
    if (t === "wall") return false;
    const rite = state.rite;
    if (!rite || rite.walk === "any") return t !== "wall";
    if (body.kind === "you") return playerLegal(t, c, r, rite);
    return legalTile(t, c, r, rite, body.liar);
  }

  function moveBody(body, ax, ay, dt, speed) {
    const sp = speed || 2.8;
    const m = Math.hypot(ax, ay);
    if (m > 0.01) {
      body.vx = (ax / m) * sp;
      body.vy = (ay / m) * sp;
      body.angle = Math.atan2(body.vy, body.vx);
    } else {
      body.vx *= 0.8;
      body.vy *= 0.8;
    }
    const nx = body.x + body.vx * dt;
    const ny = body.y + body.vy * dt;
    if (canOccupy(body, nx, body.y)) body.x = nx;
    else body.vx = 0;
    if (canOccupy(body, body.x, ny)) body.y = ny;
    else body.vy = 0;
    body.bob += dt * (2.5 + Math.hypot(body.vx, body.vy) * 2);
  }

  function chooseNpcTarget(npc, rite) {
    if (rite.orbit) {
      const ang = state.time * 0.7 + npc.bob;
      return { x: 8.5 + Math.cos(ang) * 3.2, y: 6.5 + Math.sin(ang) * 2.4 };
    }
    if (rite.lanterns) {
      const step = Math.floor(state.time / 2.4 + npc.bob) % 4;
      const L = state.lanterns[step];
      if (Math.hypot(npc.x - L.x, npc.y - L.y) < 0.55) L.flare = Math.max(L.flare, 0.7);
      return L;
    }
    if (rite.carry && !npc.hold) {
      const s = state.stones.find((st) => !st.taken && (!rite.carry || st.color === rite.carry));
      if (s) return s;
    }
    if (rite.carry && npc.hold) {
      if (Math.hypot(npc.x - 8.5, npc.y - 6.5) < 0.7) {
        burst(8.5, 6.5, npc.hold, 6);
        npc.hold = null;
      }
      return { x: 8.5, y: 6.5 };
    }
    if (rite.bow) {
      const crown = state.people.find((p) => p.hat === "crown") || state.people[0];
      if (crown && npc !== crown) return { x: crown.x, y: crown.y + 1.1 };
    }
    if (rite.goal === "still" || rite.pulse) {
      return { x: npc.x, y: npc.y };
    }
    return { x: 8.5, y: 0.9 };
  }

  function stepNpcs(dt) {
    const rite = state.rite;
    const freeze = rite.pulse && state.moon > 0.72;
    for (const npc of state.people) {
      npc.cooldown -= dt;
      if (freeze && !npc.liar) {
        npc.vx = 0;
        npc.vy = 0;
        npc.bob += dt * 0.4;
        continue;
      }
      const t = chooseNpcTarget(npc, rite);
      let ax = t.x - npc.x;
      let ay = t.y - npc.y;
      const neighbors = [
        [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1],
      ];
      let best = null;
      let bestScore = Infinity;
      const c0 = Math.floor(npc.x);
      const r0 = Math.floor(npc.y);
      for (const [dc, dr] of neighbors) {
        const c = c0 + dc;
        const r = r0 + dr;
        const kind = cell(c, r).t;
        if (!legalTile(kind, c, r, rite, npc.liar)) continue;
        const sx = c + 0.5 - t.x;
        const sy = r + 0.5 - t.y;
        const score = sx * sx + sy * sy + rand() * 0.4;
        if (score < bestScore) {
          bestScore = score;
          best = { x: c + 0.5, y: r + 0.5 };
        }
      }
      if (best) {
        ax = best.x - npc.x;
        ay = best.y - npc.y;
      }
      if (rite.carry && !npc.hold) {
        const s = nearest(state.stones.filter((st) => !rite.carry || st.color === rite.carry), npc, 0.7);
        if (s) {
          npc.hold = s.color;
          s.taken = true;
        }
      }
      moveBody(npc, ax, ay, dt, npc.liar ? 3.4 : 2.35);
      if (Math.hypot(npc.x - 8.5, npc.y - 0.9) < 0.8 && (rite.goal === "gate" || !rite.lanterns)) {
        npc.demo += dt;
        if (npc.demo > 0.8) {
          burst(npc.x, npc.y, npc.robe, 10);
          const p = randomFloor((tt, c, r) => r > 8 && legalTile(tt, c, r, rite, npc.liar));
          npc.x = p.x;
          npc.y = p.y;
          npc.demo = 0;
          npc.hold = null;
        }
      }
    }
  }

  function checkPlayerRules(dt) {
    const p = state.player;
    const rite = state.rite;
    const c = Math.floor(p.x);
    const r = Math.floor(p.y);
    const t = cell(c, r).t;
    const moving = Math.hypot(p.vx, p.vy) > 0.35;

    if (rite.pulse && state.moon > 0.78 && moving) {
      audio.thud();
      shiftWorld(false);
      return;
    }
    if (rite.avoid) {
      for (const npc of state.people) {
        if (npc.robe === rite.avoid && Math.hypot(npc.x - p.x, npc.y - p.y) < 0.7) {
          audio.thud();
          shiftWorld(false);
          return;
        }
      }
    }
    if (rite.goal === "gate" && t === "gate") {
      const needCarry = rite.carry && p.hold !== rite.carry;
      const needEmpty = rite.carry && rite.goal === "gate" && false;
      if (!needCarry && !needEmpty) {
        if (rite.lanterns && state.sequence.length < 3) return;
        shiftWorld(true);
      }
    }
    if (rite.goal === "still") {
      if (!moving) state.progress += dt;
      else state.progress = Math.max(0, state.progress - dt * 0.5);
      if (state.progress > 3.2) shiftWorld(true);
    }
    if (rite.orbit) {
      const ang = Math.atan2(p.y - 6.5, p.x - 8.5);
      let d = ang - state.lastAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.hypot(p.x - 8.5, p.y - 6.5) > 1.6 && Math.hypot(p.x - 8.5, p.y - 6.5) < 4.4) {
        state.wind += d;
      }
      state.lastAngle = ang;
      if (Math.abs(state.wind) >= Math.PI * 2 * rite.orbit) shiftWorld(true);
    }
    if (rite.goal === "bow" || rite.bow) {
      const crown = state.people.find((n) => n.hat === "crown");
      if (crown && Math.hypot(crown.x - p.x, crown.y - p.y) < 1.35 && !moving) {
        state.progress += dt;
        if (state.progress > 1.6 && rite.goal === "bow") shiftWorld(true);
      }
    }
  }

  function steerPlayer(dt) {
    const p = state.player;
    let ax = 0;
    let ay = 0;
    if (state.keys.has("arrowleft") || state.keys.has("a")) ax -= 1;
    if (state.keys.has("arrowright") || state.keys.has("d")) ax += 1;
    if (state.keys.has("arrowup") || state.keys.has("w")) ay -= 1;
    if (state.keys.has("arrowdown") || state.keys.has("s")) ay += 1;
      moveBody(p, ax, ay, dt, 3.3);
    if (state.interactLock <= 0) {
      const stone = nearest(state.stones, p, 0.55);
      if (stone && !p.hold) {
        p.hold = stone.color;
        stone.taken = true;
        audio.blip(520);
        burst(stone.x, stone.y, stone.color, 8);
        state.interactLock = 0.25;
      } else if (p.hold && Math.hypot(p.x - 8.5, p.y - 6.5) < 0.7) {
        tryInteract();
      } else if (state.rite.lanterns && nearest(state.lanterns, p, 0.55)) {
        tryInteract();
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const q = state.particles[i];
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.96;
      q.vy *= 0.96;
      q.life -= dt;
      if (q.life <= 0) state.particles.splice(i, 1);
    }
  }

  function wx(x) {
    return state.ox + x * state.tile;
  }
  function wy(y) {
    return state.oy + y * state.tile;
  }

  function drawFloor() {
    const ts = state.tile;
    ctx.fillStyle = "#0a0c10";
    ctx.fillRect(0, 0, state.width, state.height);

    const sky = ctx.createRadialGradient(state.width * 0.5, 0, 10, state.width * 0.5, 0, state.height * 0.7);
    sky.addColorStop(0, `rgba(40, 55, 70, ${0.18 + state.moon * 0.2})`);
    sky.addColorStop(1, "rgba(7, 8, 10, 0)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.beginPath();
    ctx.fillStyle = `rgba(232, 224, 208, ${0.35 + state.moon * 0.5})`;
    ctx.shadowColor = "#e8e0d0";
    ctx.shadowBlur = 24 + state.moon * 20;
    ctx.arc(state.width * 0.78, 54, 16 + state.moon * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const t = state.grid[r][c].t;
        const x = wx(c);
        const y = wy(r);
        if (t === "wall") {
          ctx.fillStyle = "#16141a";
          ctx.fillRect(x, y, ts, ts);
          ctx.fillStyle = "rgba(255,255,255,0.03)";
          ctx.fillRect(x, y, ts, 3);
          continue;
        }
        if (t === "water") {
          ctx.fillStyle = "#15262c";
          ctx.fillRect(x, y, ts, ts);
          ctx.strokeStyle = "rgba(126, 200, 200, 0.18)";
          ctx.beginPath();
          ctx.moveTo(x + 6, y + ts * 0.45 + Math.sin(state.time * 2 + c) * 2);
          ctx.lineTo(x + ts - 6, y + ts * 0.55 + Math.cos(state.time * 2 + r) * 2);
          ctx.stroke();
          continue;
        }
        if (t === "gate") {
          ctx.fillStyle = `rgba(232, 213, 163, ${0.08 + (state.rite && state.rite.goal === "gate" ? 0.08 : 0)})`;
          ctx.fillRect(x, y, ts, ts);
          continue;
        }
        if (t === "altar") {
          ctx.fillStyle = "#2c261c";
          ctx.fillRect(x, y, ts, ts);
          continue;
        }
        ctx.fillStyle = t === "dark" ? "#1a1814" : "#2c281f";
        ctx.fillRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
      }
    }

    ctx.fillStyle = "#1c1810";
    ctx.beginPath();
    ctx.ellipse(wx(8.5), wy(6.55), ts * 0.72, ts * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 213, 163, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(wx(8.5), wy(6.5), ts * 0.55, ts * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(232, 213, 163, 0.12)";
    ctx.beginPath();
    ctx.ellipse(wx(8.5), wy(6.5), ts * 0.28, ts * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    const gx = wx(8.5);
    const gy = wy(0.2);
    ctx.fillStyle = "#121018";
    ctx.fillRect(gx - ts * 1.6, gy - ts * 0.2, ts * 0.45, ts * 1.4);
    ctx.fillRect(gx + ts * 1.15, gy - ts * 0.2, ts * 0.45, ts * 1.4);
    ctx.strokeStyle = `rgba(232, 213, 163, ${0.25 + Math.sin(state.time * 2) * 0.1})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx - ts * 1.4, gy + ts * 0.2);
    ctx.quadraticCurveTo(gx, gy - ts * 1.1, gx + ts * 1.4, gy + ts * 0.2);
    ctx.stroke();
  }

  function drawLanterns() {
    for (const l of state.lanterns) {
      const x = wx(l.x);
      const y = wy(l.y);
      const glow = Math.max(l.lit, l.flare);
      ctx.fillStyle = "#241c14";
      ctx.fillRect(x - 4, y - 18, 8, 22);
      ctx.beginPath();
      ctx.fillStyle = glow > 0.15 ? `rgba(255, 186, 92, ${0.35 + glow * 0.5})` : "rgba(80,70,60,0.7)";
      ctx.shadowColor = "#ffb45a";
      ctx.shadowBlur = glow * 28;
      ctx.arc(x, y - 22, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      l.flare *= 0.94;
    }
  }

  function drawStones() {
    for (const s of state.stones) {
      if (s.taken) continue;
      const x = wx(s.x);
      const y = wy(s.y);
      ctx.beginPath();
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 12;
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y + 4);
      ctx.lineTo(x - 6, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawPerson(p, isYou) {
    const x = wx(p.x);
    const y = wy(p.y);
    const walk = Math.hypot(p.vx, p.vy);
    const bob = Math.sin(p.bob) * (walk > 0.2 ? 3 : 1);
    const s = state.tile * 0.38 * p.scale;
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.ellipse(x, y + s * 0.9, s * 0.55, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = p.robe;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.75);
    ctx.lineTo(s * 0.55, s * 0.75);
    ctx.lineTo(s * 0.32, -s * 0.15);
    ctx.lineTo(-s * 0.32, -s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = isYou ? "#f7f1e6" : "#e4d8c4";
    ctx.arc(0, -s * 0.42, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    if (p.hat === "crown") {
      ctx.fillStyle = "#e8d5a3";
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, -s * 0.62);
      ctx.lineTo(-s * 0.14, -s * 0.92);
      ctx.lineTo(0, -s * 0.62);
      ctx.lineTo(s * 0.14, -s * 0.92);
      ctx.lineTo(s * 0.28, -s * 0.62);
      ctx.closePath();
      ctx.fill();
    } else if (p.hat === "hood") {
      ctx.fillStyle = p.robe;
      ctx.beginPath();
      ctx.arc(0, -s * 0.48, s * 0.34, Math.PI, 0);
      ctx.fill();
    }
    if (p.liar) {
      ctx.fillStyle = "rgba(224, 122, 95, 0.8)";
      ctx.beginPath();
      ctx.arc(s * 0.22, -s * 0.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.hold) {
      ctx.fillStyle = p.hold;
      ctx.beginPath();
      ctx.arc(s * 0.42, s * 0.2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isYou) {
      ctx.strokeStyle = "rgba(247, 241, 230, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -s * 0.42, s * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const q of state.particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(wx(q.x), wy(q.y), q.r * state.tile, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const sx = state.shake ? (rand() - 0.5) * state.shake : 0;
    const sy = state.shake ? (rand() - 0.5) * state.shake : 0;
    state.shake *= 0.88;
    ctx.save();
    ctx.translate(sx, sy);
    if (!state.grid.length) {
      ctx.fillStyle = "#07080a";
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
      return;
    }
    drawFloor();
    drawLanterns();
    drawStones();
    const bodies = [...state.people];
    if (state.player) bodies.push(state.player);
    bodies.sort((a, b) => a.y - b.y);
    for (const b of bodies) drawPerson(b, b.kind === "you");
    drawParticles();
    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    state.time += dt;
    state.moon = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.time * (state.rite && state.rite.pulse ? 1.35 : 0.35)));
    if (state.running && !state.shifting && state.rite) {
      state.roundTime += dt;
      state.interactLock = Math.max(0, state.interactLock - dt);
      steerPlayer(dt);
      stepNpcs(dt);
      checkPlayerRules(dt);
      updateParticles(dt);
      if (state.roundTime > 50) shiftWorld(state.progress > 0.4);
    } else {
      updateParticles(dt);
    }
    draw();
    requestAnimationFrame(loop);
  }

  function createAudio() {
    let ctxA = null;
    let master = null;
    let osc = null;
    let gain = null;
    let filt = null;
    function ensure() {
      if (ctxA) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxA = new AC();
      master = ctxA.createGain();
      master.gain.value = 0.2;
      master.connect(ctxA.destination);
      filt = ctxA.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 480;
      filt.connect(master);
      osc = ctxA.createOscillator();
      gain = ctxA.createGain();
      osc.type = "sine";
      osc.frequency.value = 96;
      gain.gain.value = 0.045;
      osc.connect(gain);
      gain.connect(filt);
      osc.start();
    }
    function tone(freq, dur, type, vol) {
      if (!ctxA) return;
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = type || "triangle";
      o.frequency.value = freq;
      g.gain.value = vol || 0.08;
      o.connect(g);
      g.connect(master);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
      o.stop(ctxA.currentTime + dur + 0.02);
    }
    return {
      resume() {
        ensure();
        if (ctxA.state === "suspended") ctxA.resume();
      },
      setDrone(freq) {
        if (!osc) return;
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq), ctxA.currentTime + 0.7);
      },
      blip(freq) {
        tone(freq, 0.14, "sine", 0.07);
      },
      thud() {
        tone(64, 0.32, "sawtooth", 0.09);
      },
      shift(ok) {
        tone(ok ? 520 : 150, 0.4, "triangle", 0.09);
        tone(ok ? 780 : 84, 0.5, "sine", 0.05);
      },
    };
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (e) => {
    state.keys.add(e.key.toLowerCase());
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
    if (e.key === " " || e.key.toLowerCase() === "e") tryInteract();
  });
  window.addEventListener("keyup", (e) => {
    state.keys.delete(e.key.toLowerCase());
  });
  window.addEventListener("mousemove", (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
  });
  window.addEventListener("mousedown", (e) => {
    const w = screenToWorld(e.clientX, e.clientY);
    if (state.player && Math.hypot(w.x - state.player.x, w.y - state.player.y) < 8) tryInteract();
    else tryInteract();
  });

  function begin() {
    audio.resume();
    titleEl.classList.add("gone");
    state.running = true;
    state.generation = 0;
    state.solved = 0;
    tallyEl.textContent = "0";
    startRound(false);
  }

  beginBtn.addEventListener("click", begin);
  resize();
  requestAnimationFrame(loop);
})();
