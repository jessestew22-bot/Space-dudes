// ---------- AUDIO: everything synthesized, original music only ----------
const Snd = (() => {
  let ctx = null, master, musicBus, sfxBus, delay, delayFb, noiseBuf;
  let cur = null, nextStep = 0, nextTime = 0, timer = null;
  let muted = false;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const N = {}; // note names -> midi
  'C C# D D# E F F# G G# A A# B'.split(' ').forEach((n, i) => {
    for (let o = 0; o < 8; o++) N[n + o] = 12 * (o + 1) + i;
  });

  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(comp);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(comp);
      delay = ctx.createDelay(1); delay.delayTime.value = 0.32;
      delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
      const dl = ctx.createGain(); dl.gain.value = 0.35;
      delay.connect(delayFb); delayFb.connect(delay); delay.connect(dl); dl.connect(musicBus);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== 'running') ctx.resume();
    // silent blip keeps iOS happy
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  }

  function tone(t, freq, dur, { type = 'square', vol = 0.2, a = 0.005, r = 0.08, cut = 0, q = 1, bus, slide = 0, send = 0, detune = 0 } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur + r);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    let node = o;
    if (cut) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = q; o.connect(f); node = f; }
    node.connect(g); g.connect(bus || musicBus);
    if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(delay); }
    o.start(t); o.stop(t + dur + r + 0.05);
  }
  function noise(t, dur, { vol = 0.2, hp = 0, lp = 0, bus, r = 0.05 } = {}) {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const g = ctx.createGain(); let node = s;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    node.connect(g); g.connect(bus || musicBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + r + 0.05);
  }
  const kick = (t, v = 0.7) => tone(t, 150, 0.04, { type: 'sine', vol: v, slide: 0.28, r: 0.18 });
  const snare = (t, v = 0.28) => { noise(t, 0.05, { vol: v, hp: 1200, r: 0.16 }); tone(t, 190, 0.03, { type: 'triangle', vol: v * 0.8, r: 0.08 }); };
  const hat = (t, v = 0.07, open) => noise(t, open ? 0.08 : 0.01, { vol: v, hp: 7000, r: open ? 0.1 : 0.03 });

  // chord helper: root midi + quality
  const triad = (root, minor) => [root, root + (minor ? 3 : 4), root + 7];

  // ---- tracks: step(i, t, sd) schedules 16th-note step i (sd = 16th duration)
  const LEIT = [ // original leitmotif, 4 bars of 16ths (A minor)
    [N.A4,-1,-1,N.C5,-1,-1,N.E5,-1,N.D5,-1,N.C5,-1,-1,-1,N.B4,-1],
    [N.A4,-1,-1,-1,N.F4,-1,N.A4,-1,N.C5,-1,-1,-1,-1,-1,-1,-1],
    [N.G4,-1,-1,N.C5,-1,-1,N.E5,-1,N.G5,-1,N.E5,-1,N.D5,-1,N.C5,-1],
    [N.B4,-1,-1,-1,N.D5,-1,-1,-1,N.G4,-1,-1,-1,-1,-1,-1,-1],
  ];
  const TRACKS = {
    title: {
      bpm: 96, bars: 8,
      chords: [[N.A2, 1], [N.F2, 0], [N.C3, 0], [N.G2, 0]],
      step(i, t, sd) {
        const bar = (i >> 4), s = i & 15, [root, mi] = this.chords[bar % 4];
        if (s % 2 === 0) tone(t, mtof(root), sd * 1.6, { type: 'sawtooth', vol: 0.16, cut: 500, q: 4 });
        const ch = triad(root + 24, mi), arp = [0, 1, 2, 1];
        tone(t, mtof(ch[arp[s % 4]] + (s >= 8 ? 12 : 0)), sd * 0.8, { type: 'square', vol: 0.045, cut: 2400, send: 0.5 });
        if (s === 0) ch.forEach((n, k) => tone(t, mtof(n + 12), sd * 15, { type: 'sawtooth', vol: 0.035, a: 0.4, r: 0.6, cut: 1400, detune: k * 7 - 7 }));
        if (bar >= 4) { const m = LEIT[bar % 4][s]; if (m > 0) tone(t, mtof(m), sd * 2.5, { type: 'square', vol: 0.07, cut: 3000, send: 0.6, r: 0.2 }); }
        if (s === 0 || s === 8) kick(t, 0.5);
        if (s === 4 || s === 12) snare(t, 0.18);
        if (s % 2 === 0) hat(t, 0.04);
      },
    },
    explore: {
      bpm: 84, bars: 8,
      chords: [[N.D3, 1], [N.A2 + 1, 0], [N.C3, 0], [N.A2, 1]],
      step(i, t, sd) {
        const bar = i >> 4, s = i & 15, [root, mi] = this.chords[bar % 4];
        if (s === 0 || s === 10) tone(t, mtof(root - 12), sd * 5, { type: 'triangle', vol: 0.22, r: 0.3 });
        const ch = triad(root + 12, mi);
        if (s % 3 === 0) tone(t, mtof(ch[(s / 3) % 3] + 12), sd * 0.7, { type: 'sine', vol: 0.07, send: 0.8, r: 0.3 });
        if (s === 0) ch.forEach((n, k) => tone(t, mtof(n), sd * 16, { type: 'sawtooth', vol: 0.022, a: 1.2, r: 1, cut: 700, detune: k * 9 - 9 }));
        if (bar % 8 === 6 && s % 4 === 0) { const m = LEIT[(s >> 2) % 4][0] - 2; tone(t, mtof(m + 12), sd * 3, { type: 'sine', vol: 0.05, send: 0.9 }); }
        if (s === 0) kick(t, 0.35);
        if (s === 14 && bar % 2) noise(t, 0.2, { vol: 0.03, hp: 3000, r: 0.3 });
      },
    },
    boss: {
      bpm: 140, bars: 4,
      chords: [[N.E2, 1], [N.C2, 0], [N.D2, 0], [N.B1, 1]],
      step(i, t, sd) {
        const bar = i >> 4, s = i & 15, [root, mi] = this.chords[bar % 4];
        tone(t, mtof(root + (s % 4 === 2 ? 12 : 0)), sd * 0.8, { type: 'sawtooth', vol: 0.15, cut: 900, q: 6 });
        if (s % 4 === 0) kick(t, 0.75);
        if (s === 4 || s === 12) snare(t, 0.3);
        hat(t, s % 2 ? 0.03 : 0.06);
        const m = LEIT[bar % 4][s];
        if (m > 0) tone(t, mtof(m - 5 + 12), sd * 1.8, { type: 'square', vol: 0.06, cut: 3500 });
        if (s === 0) triad(root + 24, mi).forEach(n => tone(t, mtof(n), sd * 6, { type: 'sawtooth', vol: 0.03, cut: 2000 }));
      },
    },
    escape: {
      bpm: 168, bars: 4,
      chords: [[N.A2, 1], [N.G2, 0], [N.F2, 0], [N.E2, 0]],
      step(i, t, sd) {
        const bar = i >> 4, s = i & 15, [root] = this.chords[bar % 4];
        tone(t, mtof(root + (s % 2 ? 12 : 0)), sd * 0.7, { type: 'sawtooth', vol: 0.14, cut: 1100, q: 5 });
        if (s % 4 === 0) kick(t, 0.8);
        if (s % 8 === 4) snare(t, 0.32);
        hat(t, 0.05);
        if (s % 8 === 0) tone(t, mtof(root + 36), sd * 2, { type: 'square', vol: 0.06, slide: 0.98 });
        if (s === 0 && bar % 2 === 0) tone(t, 880, sd * 3, { type: 'square', vol: 0.04, slide: 0.5 }); // alarm sweep
      },
    },
    ending: { // the car-radio anthem (original)
      bpm: 116, bars: 8,
      chords: [[N.E2, 0], [N.B1, 0], [N.C2 + 1, 1], [N.A1, 0]],
      mel: [
        [N.E5,-1,N.E5,-1,N.F5+1,-1,N.G5+1,-1,-1,-1,N.F5+1,-1,N.E5,-1,N.B4,-1],
        [N.D5+1,-1,-1,-1,N.B4,-1,-1,-1,N.F5+1,-1,-1,-1,N.D5+1,-1,-1,-1],
        [N.E5,-1,N.E5,-1,N.F5+1,-1,N.G5+1,-1,-1,-1,N.B5,-1,N.G5+1,-1,N.F5+1,-1],
        [N.E5,-1,-1,-1,N.C5+1,-1,-1,-1,N.E5,-1,N.F5+1,-1,N.E5,-1,-1,-1],
      ],
      step(i, t, sd) {
        const bar = i >> 4, s = i & 15, [root, mi] = this.chords[bar % 4];
        // power chords, chugging 8ths
        if (s % 2 === 0) [0, 7, 12].forEach((iv, k) => tone(t, mtof(root + 12 + iv), sd * 1.5, { type: 'sawtooth', vol: 0.05, cut: 1800, q: 2, detune: k * 4 }));
        tone(t, mtof(root + (s % 4 === 3 ? 12 : 0)), sd * 0.9, { type: 'square', vol: 0.08, cut: 700 });
        if (s === 0 || s === 6 || s === 8 || s === 11) kick(t, 0.85);
        if (s === 4 || s === 12) snare(t, 0.38);
        hat(t, s % 2 ? 0.035 : 0.07, s === 14);
        if (bar >= 0) {
          const m = this.mel[bar % 4][s];
          if (m > 0 && !(bar < 2 && s > 8)) tone(t, mtof(m), sd * 1.9, { type: 'square', vol: 0.085, cut: 4200, send: 0.35, r: 0.12 });
          if (m > 0 && bar >= 4) tone(t, mtof(m - 12), sd * 1.9, { type: 'sawtooth', vol: 0.04, cut: 2500 });
        }
        if (s === 0) triad(root + 24, mi).forEach(n => tone(t, mtof(n), sd * 15, { type: 'triangle', vol: 0.03, a: 0.2 }));
      },
    },
  };

  function schedule() {
    if (!ctx || !cur) return;
    const tr = TRACKS[cur], sd = 60 / tr.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      try { tr.step(nextStep % (tr.bars * 16), nextTime, sd); } catch (e) {}
      nextStep++; nextTime += sd;
    }
  }
  function music(name) {
    if (!ctx) { cur = name; return; }
    if (cur === name && timer) return;
    cur = name; nextStep = 0; nextTime = ctx.currentTime + 0.06;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(muted ? 0 : 0.55, ctx.currentTime);
    if (!timer) timer = setInterval(schedule, 25);
  }
  function stop() { cur = null; }
  function beat() { // 0..1 phase of the current beat, for headbangs
    if (!ctx || !cur) return 0;
    const tr = TRACKS[cur], bd = 60 / tr.bpm;
    return ((ctx.currentTime - (nextTime - nextStep * bd / 4)) / bd) % 1;
  }

  const S = (fn) => (...a) => { if (ctx && !muted) fn(ctx.currentTime, ...a); };
  const sfx = {
    shoot: S(t => tone(t, 980, 0.03, { type: 'square', vol: 0.12, slide: 0.35, bus: sfxBus })),
    charge: S(t => tone(t, 300, 0.25, { type: 'sawtooth', vol: 0.05, slide: 3, bus: sfxBus, cut: 3000 })),
    big: S(t => { tone(t, 420, 0.12, { type: 'sawtooth', vol: 0.2, slide: 0.2, bus: sfxBus }); noise(t, 0.1, { vol: 0.15, hp: 800, bus: sfxBus }); }),
    jump: S(t => tone(t, 240, 0.05, { type: 'square', vol: 0.07, slide: 2.2, bus: sfxBus })),
    jump2: S(t => tone(t, 380, 0.06, { type: 'square', vol: 0.07, slide: 2.4, bus: sfxBus })),
    hit: S(t => tone(t, 300, 0.03, { type: 'square', vol: 0.1, slide: 0.5, bus: sfxBus })),
    kill: S(t => { noise(t, 0.12, { vol: 0.25, lp: 2500, bus: sfxBus, r: 0.15 }); tone(t, 200, 0.08, { type: 'triangle', vol: 0.15, slide: 0.3, bus: sfxBus }); }),
    hurt: S(t => { tone(t, 160, 0.15, { type: 'sawtooth', vol: 0.18, slide: 0.5, bus: sfxBus }); }),
    pickup: S(t => [0, 4, 7, 12].forEach((iv, k) => tone(t + k * 0.06, mtof(76 + iv), 0.05, { type: 'square', vol: 0.09, bus: sfxBus }))),
    item: S(t => [0, 4, 7, 12, 16, 19, 24].forEach((iv, k) => tone(t + k * 0.08, mtof(64 + iv), 0.1, { type: 'square', vol: 0.09, bus: sfxBus, send: 0 }))),
    brk: S(t => { noise(t, 0.15, { vol: 0.3, lp: 4000, bus: sfxBus, r: 0.2 }); tone(t, 1400, 0.05, { type: 'triangle', vol: 0.1, slide: 0.4, bus: sfxBus }); }),
    boom: S(t => { noise(t, 0.6, { vol: 0.5, lp: 600, bus: sfxBus, r: 0.8 }); tone(t, 90, 0.4, { type: 'sine', vol: 0.5, slide: 0.3, bus: sfxBus, r: 0.5 }); }),
    door: S(t => { tone(t, 90, 0.5, { type: 'sawtooth', vol: 0.2, slide: 2, bus: sfxBus, cut: 600 }); noise(t, 0.5, { vol: 0.12, lp: 900, bus: sfxBus }); }),
    blip: S(t => tone(t, 1500, 0.015, { type: 'square', vol: 0.03, bus: sfxBus })),
    alarm: S(t => { tone(t, 700, 0.18, { type: 'square', vol: 0.08, bus: sfxBus }); tone(t + 0.22, 520, 0.18, { type: 'square', vol: 0.08, bus: sfxBus }); }),
    splash: S(t => noise(t, 0.12, { vol: 0.12, lp: 1500, bus: sfxBus, r: 0.1 })),
  };
  function setMuted(m) { muted = m; if (musicBus) musicBus.gain.value = m ? 0 : 0.55; }
  document.addEventListener('visibilitychange', () => { if (ctx && !document.hidden) ctx.resume(); });
  return { unlock, music, stop, sfx, beat, setMuted, get muted() { return muted; }, get ready() { return !!ctx; } };
})();
