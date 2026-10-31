// director.js - hidden-rule director
// The Master Rule: Whatever you believe the rules are, the game will try to prove you wrong.

const COSTUMES = ["snake", "breakout", "board", "desktop", "terminal", "chamber", "clockroom", "mirror"];

const BASE_COSTUMES = ["snake", "breakout", "board", "desktop", "terminal"];

const LIES = [
  "eat to win",
  "clear every brick",
  "follow the words",
  "the clock is honest",
  "type help",
  "do not close this",
  "high score required",
  "move to live",
  "the crowned one knows",
  "this is snake",
  "the blue opens the red",
  "time runs backwards here",
  "the mirror lies",
  "standing still is moving",
  "the clock knows the way",
  "hold nothing to pass",
  "the character has the answer",
  "wait for the signal",
  "the door remembers you",
  "do what the others do",
  "never do what you did before",
  "the rule you found is wrong",
];

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function rand() {
  return Math.random();
}

export function createDirector() {
  return {
    generation: 0,
    solved: 0,
    idle: 0,
    script: null,
    last: null,
    masterFound: false,

    // track last win kind for repeatsSolution detection
    _lastWinKind: null,
    _currentWinKind: null,

    boot() {
      this.generation = 0;
      this.solved = 0;
      this.idle = 0;
      this.masterFound = false;
      this._lastWinKind = null;
      this._currentWinKind = null;
      this.script = this.roll(0);
      return this.script;
    },

    roll(generation) {
      // Generation 0: always snake intro
      if (generation === 0) {
        return {
          costume: "snake",
          lie: "eat to win",
          infect: null,
          invert: false,
          win: { kind: "die" },
          doorLabel: "START",
          drone: 96,
        };
      }

      // Master reveal at generation 10+
      if (generation >= 10) {
        return {
          costume: "terminal",
          lie: "you have found the pattern",
          infect: null,
          invert: false,
          win: { kind: "master" },
          isMaster: true,
          doorLabel: "THE TRUTH",
          drone: 55,
        };
      }

      // After gen 5 include new costumes
      const pool = generation >= 3 ? COSTUMES : BASE_COSTUMES;
      const costume = pick(pool);

      const wins = {
        snake: [
          { kind: "die" },
          { kind: "idle", need: 7 },
          { kind: "close" },
          { kind: "score", need: 3 },
          { kind: "no-score" },
        ],
        breakout: [
          { kind: "miss" },
          { kind: "idle", need: 6 },
          { kind: "close" },
          { kind: "brick", need: 4 },
          { kind: "no-move", need: 5 },
        ],
        board: [
          { kind: "tile", word: pick(["WAIT", "LIE", "NOT", "THIS"]) },
          { kind: "idle", need: 6 },
          { kind: "close" },
          { kind: "type", text: "wait" },
        ],
        desktop: [
          { kind: "clock" },
          { kind: "trash" },
          { kind: "idle", need: 8 },
          { kind: "menu" },
          { kind: "open", need: 3 },
        ],
        terminal: [
          { kind: "type", text: pick(["wait", "lie", "look", "die"]) },
          { kind: "idle", need: 6 },
          { kind: "close" },
          { kind: "help-wrong" },
        ],
        chamber: [
          { kind: "cube-door" },
          { kind: "drop-all" },
          { kind: "talk-three" },
          { kind: "wait-long" },
          { kind: "jump-three" },
          { kind: "lie-word" },
          { kind: "opposite" },
        ],
        clockroom: [
          { kind: "wrong-time" },
          { kind: "right-time" },
          { kind: "wall-touch" },
          { kind: "wait-still" },
        ],
        mirror: [
          { kind: "reach-zone" },
          { kind: "stand-still" },
          { kind: "touch-mirror" },
          { kind: "escape" },
        ],
      };

      let win = pick(wins[costume]);

      // Avoid clock/trash in early generations for desktop
      if (generation < 2 && (win.kind === "clock" || win.kind === "trash")) {
        win = { kind: "idle", need: 6 };
      }

      // Detect repeat solution - if same win kind as last round, mutate
      if (generation >= 4 && this._currentWinKind && win.kind === this._currentWinKind) {
        // Force a different win kind from same costume
        const options = wins[costume].filter(w => w.kind !== this._currentWinKind);
        if (options.length) win = pick(options);
      }

      const doorLabels = ["SNAKE", "WORK", "HELP", "REAL", "DEMO", "SAVE", "THE GAME",
                          "ENTER", "TRUTH", "VOID", "NOW", "HERE"];

      return {
        costume,
        lie: pick(LIES),
        infect: generation > 1 && rand() < 0.45 ? pick(["keys", "popup", "label"]) : null,
        invert: generation > 2 && rand() < 0.3,
        win,
        doorLabel: pick(doorLabels),
        drone: 70 + rand() * 130,
      };
    },

    note(event) {
      const win = this.script?.win;
      if (!win) return null;
      this.last = event;

      if (event.type === "input" || event.type === "move") this.idle = 0;

      // ── Master win ──────────────────────────────────────────────────────────
      if (win.kind === "master" && event.type === "type" && event.text === "lie") {
        return "master-win";
      }

      // ── Standard wins ────────────────────────────────────────────────────────
      if (win.kind === "die"       && event.type === "die")   return "win";
      if (win.kind === "miss"      && event.type === "miss")  return "win";
      if (win.kind === "close"     && event.type === "close") return "win";
      if (win.kind === "clock"     && event.type === "clock") return "win";
      if (win.kind === "trash"     && event.type === "trash") return "win";
      if (win.kind === "menu"      && event.type === "menu")  return "win";

      if (win.kind === "tile" && event.type === "tile" && event.word === win.word) return "win";
      if (win.kind === "type" && event.type === "type" && event.text === win.text) return "win";
      if (win.kind === "help-wrong" && event.type === "type" && event.text && event.text !== "help") return "win";

      if (win.kind === "score"  && event.type === "score"  && event.value >= win.need) return "win";
      if (win.kind === "brick"  && event.type === "brick"  && event.value >= win.need) return "win";
      if (win.kind === "open"   && event.type === "open"   && event.value >= win.need) return "win";

      if (win.kind === "no-score" && event.type === "close" && (event.score || 0) === 0) return "win";
      if (win.kind === "no-move"  && event.type === "miss") return "win";

      // ── Chamber wins ────────────────────────────────────────────────────────
      if (win.kind === "cube-door"  && event.type === "cube-door")  return "win";
      if (win.kind === "drop-all"   && event.type === "drop-all")   return "win";
      if (win.kind === "talk-three" && event.type === "talk-three") return "win";
      if (win.kind === "wait-long"  && event.type === "wait-long")  return "win";
      if (win.kind === "jump-three" && event.type === "jump-three") return "win";
      if (win.kind === "lie-word"   && event.type === "lie-word")   return "win";
      if (win.kind === "opposite"   && event.type === "opposite")   return "win";

      // ── Clockroom wins ──────────────────────────────────────────────────────
      if (win.kind === "wrong-time" && event.type === "clock-click" && !event.atTwelve) return "win";
      if (win.kind === "right-time" && event.type === "clock-click" && event.atTwelve)  return "win";
      if (win.kind === "wall-touch" && event.type === "wall-touch")  return "win";
      if (win.kind === "wait-still" && event.type === "idle-still")  return "win";

      // ── Mirror wins ─────────────────────────────────────────────────────────
      if (win.kind === "reach-zone"   && event.type === "reach-zone")   return "win";
      if (win.kind === "stand-still"  && event.type === "stand-still")  return "win";
      if (win.kind === "touch-mirror" && event.type === "touch-mirror") return "win";
      if (win.kind === "escape"       && event.type === "escape")       return "win";

      // ── Repeat-solution mutation (gen 4+) ───────────────────────────────────
      if (this.generation >= 4 && this._currentWinKind &&
          event.type && event.type === this._currentWinKind) {
        // player is trying the same method - rewrite mid-round
        return "rewrite";
      }

      // ── Failure → rewrite triggers ───────────────────────────────────────────
      if (event.type === "die"  && win.kind !== "die")  return "rewrite";
      if (event.type === "miss" && win.kind !== "miss" && this.script?.costume === "breakout") return "rewrite";

      return null;
    },

    tickIdle(dt) {
      const win = this.script?.win;
      if (!win) return null;
      if (win.kind === "idle" || win.kind === "no-move") {
        this.idle += dt;
        if (this.idle >= (win.need || 7)) return "win";
      } else {
        this.idle += dt;
        if (this.idle > 48) return "rewrite";
      }
      return null;
    },

    advance(kind) {
      if (kind === "win" || kind === "master-win") {
        this.solved += 1;
        if (kind === "master-win") this.masterFound = true;
      }
      // Record win kind for repeat-detection
      this._lastWinKind = this._currentWinKind;
      this._currentWinKind = this.script?.win?.kind || null;

      this.generation += 1;
      this.idle = 0;
      this.script = this.roll(this.generation);
      return this.script;
    },
  };
}
