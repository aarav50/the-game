// behavior.js - tracks player behavioral patterns across rounds
// Used by the Director to decide when to mutate rules

export function createBehavior() {
  const RING_SIZE = 20;

  return {
    jumpCount: 0,
    leftBias: 0,    // positive = prefers left, negative = prefers right
    ignoresNpcs: true,
    repeatsSolution: false,
    actionHistory: [],
    generation: 0,

    _lastWinKind: null,
    _currentWinKind: null,
    _npcInteractions: 0,
    _totalRoundActions: 0,
    _leftMoves: 0,
    _rightMoves: 0,

    record(action) {
      // ring buffer
      this.actionHistory.push({ action, t: Date.now() });
      if (this.actionHistory.length > RING_SIZE) {
        this.actionHistory.shift();
      }

      this._totalRoundActions += 1;

      switch (action) {
        case 'gallery-jump':
          this.jumpCount += 1;
          break;
        case 'gallery-left':
          this._leftMoves += 1;
          break;
        case 'gallery-right':
          this._rightMoves += 1;
          break;
        case 'npc-talk':
          this._npcInteractions += 1;
          this.ignoresNpcs = false;
          break;
        case 'enter-left':
          this._leftMoves += 3; // weighted: door choice is more deliberate
          break;
        case 'enter-right':
          this._rightMoves += 3;
          break;
        default:
          break;
      }

      // update leftBias as difference score
      this.leftBias = this._leftMoves - this._rightMoves;
    },

    recordWin(kind) {
      this._lastWinKind = this._currentWinKind;
      this._currentWinKind = kind;
      this.repeatsSolution = (this._lastWinKind !== null && this._lastWinKind === this._currentWinKind);
      // reset per-round counters
      this._npcInteractions = 0;
      this._totalRoundActions = 0;
      this.generation += 1;
    },

    profile() {
      return {
        prefersLeft: this.leftBias > 5,
        jumpSpammer: this.jumpCount > 8,
        npcAvoider: this.ignoresNpcs && this.generation > 1,
        repeater: this.repeatsSolution,
      };
    },

    shouldMutate() {
      const p = this.profile();
      return p.prefersLeft || p.jumpSpammer || p.npcAvoider || p.repeater;
    },
  };
}
