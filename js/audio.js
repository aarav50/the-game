export function createAudio() {
  let ctx;
  let master;
  let osc;
  let gain;
  let filt;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 480;
    filt.connect(master);
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 92;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(filt);
    osc.start();
  }

  function tone(freq, dur, type, vol) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "triangle";
    o.frequency.value = freq;
    g.gain.value = vol || 0.07;
    o.connect(g);
    g.connect(master);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    resume() {
      ensure();
      if (ctx.state === "suspended") ctx.resume();
    },
    setDrone(freq) {
      if (!osc) return;
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq), ctx.currentTime + 0.5);
    },
    blip(freq) {
      tone(freq, 0.1, "square", 0.04);
    },
    thud() {
      tone(64, 0.28, "sawtooth", 0.08);
    },
    shift(ok) {
      tone(ok ? 520 : 150, 0.32, "triangle", 0.08);
      tone(ok ? 780 : 90, 0.4, "sine", 0.04);
    },
  };
}
