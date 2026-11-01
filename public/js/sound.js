// 음원 파일 없이 소리를 합성한다 (저작권 걱정 없음). 장소 설정의 ambient·sounds 이름으로 고른다.
export function createSound() {
  let ctx = null, master = null, ambient = null, on = false;

  function ensure() {
    if (ctx) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  function noise(seconds = 2) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; } // 갈색 잡음
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }
  function lfo(param, rate, depth, base) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = rate; g.gain.value = depth; param.value = base;
    o.connect(g).connect(param); o.start();
  }

  // 배경 소리: wind(산바람) waves(파도) hall(넓은 실내 웅웅거림)
  const AMBIENT = {
    wind() {
      const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = 0.6;
      lfo(f.frequency, 0.07, 250, 500);
      g.gain.value = 0.18;
      n.connect(f).connect(g).connect(master); n.start();
    },
    waves() {
      const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 900;
      lfo(g.gain, 0.11, 0.16, 0.2);
      n.connect(f).connect(g).connect(master); n.start();
    },
    hall() {
      const g = ctx.createGain(); g.gain.value = 0.035;
      for (const hz of [110, 165, 220.5]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(g); o.start(); }
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
      g.connect(f).connect(master);
      AMBIENT.wind();
    },
  };

  // 짧은 효과음
  const FX = {
    moktak() { // 목탁: 짧게 떨어지는 나무 소리
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.12);
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
    },
    bell() { // 풍경·종: 배음 여러 개가 길게 남는다
      const t = ctx.currentTime;
      for (const [hz, a] of [[523, 0.25], [1046, 0.12], [1569, 0.07], [2637, 0.04]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = hz; g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        o.connect(g).connect(master); o.start(t); o.stop(t + 3.6);
      }
    },
    bead() { // 염주알 딸깍
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'triangle'; o.frequency.value = 1800;
      g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.06);
    },
    chime() { // 맑은 두 음
      const t = ctx.currentTime;
      [784, 1175].forEach((hz, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.18;
        o.frequency.value = hz; g.gain.setValueAtTime(0.18, s); g.gain.exponentialRampToValueAtTime(0.0001, s + 1.6);
        o.connect(g).connect(master); o.start(s); o.stop(s + 1.7);
      });
    },
  };

  return {
    get on() { return on; },
    toggle(ambientName) {
      ensure();
      on = !on;
      if (ctx.state === 'suspended') ctx.resume();
      if (on && !ambient) { ambient = ambientName; AMBIENT[ambientName]?.(); }
      master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.4);
      return on;
    },
    play(name) { if (on && FX[name]) FX[name](); },
  };
}
