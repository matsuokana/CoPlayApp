'use strict';

let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

function resumeCtx() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') return ctx.resume();
  return Promise.resolve();
}

// 短いホワイトノイズバースト（打楽器系）
function noiseBuffer(ctx, duration) {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
  return buf;
}

function playNoise(ctx, duration, gain, filterFreq) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration);
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = filterFreq;
  filt.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(filt); filt.connect(g); g.connect(ctx.destination);
  src.start();
}

function playTone(ctx, freq, type, duration, gainVal, attack) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type      = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.001, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + (attack || 0.01));
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration + 0.05);
}

// ====== 各楽器の合成音 ======
const synths = {

  たいこ(ctx) {
    // ピッチドロップ付きキック
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(1.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.45);
    playNoise(ctx, 0.08, 0.3, 2000);
  },

  ギター(ctx) {
    // Karplus-Strong 風の簡易実装
    const dur = 1.2;
    [220, 330, 440, 550].forEach((freq, i) => {
      setTimeout(() => playTone(ctx, freq, 'sawtooth', dur - i * 0.1, 0.18, 0.005), i * 20);
    });
  },

  トランペット(ctx) {
    playTone(ctx, 523, 'sawtooth', 0.6, 0.4, 0.03);
    playTone(ctx, 1046,'sawtooth', 0.4, 0.1, 0.03);
  },

  ピアノ(ctx) {
    [523, 1046, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type  = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.4 / (i + 1), ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 1.6);
    });
  },

  マラカス(ctx) {
    playNoise(ctx, 0.25, 0.5, 6000);
  },

  かね(ctx) {
    [880, 1320, 1760].forEach((f, i) => {
      playTone(ctx, f, 'sine', 1.5, 0.25 / (i + 1), 0.005);
    });
  },

  バイオリン(ctx) {
    const freq = 659;
    const osc  = ctx.createOscillator();
    const vib  = ctx.createOscillator();
    const vibG = ctx.createGain();
    const g    = ctx.createGain();
    osc.type  = 'sawtooth';
    osc.frequency.value = freq;
    vib.frequency.value = 6; vibG.gain.value = 8;
    vib.connect(vibG); vibG.connect(osc.frequency);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); vib.start();
    osc.stop(ctx.currentTime + 1.05); vib.stop(ctx.currentTime + 1.05);
  },

  ホイッスル(ctx) {
    playTone(ctx, 2000, 'sine', 0.5, 0.5, 0.02);
    playTone(ctx, 2200, 'sine', 0.3, 0.15, 0.02);
  },

  カスタネット(ctx) {
    playNoise(ctx, 0.06, 0.8, 4000);
    setTimeout(() => playNoise(ctx, 0.06, 0.6, 4000), 80);
  },

  'ぼよよーん'(ctx) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.7);
    g.gain.setValueAtTime(0.6, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.85);
  },

  シンバル(ctx) {
    playNoise(ctx, 0.8, 0.4, 8000);
    const filt = ctx.createBiquadFilter();
    filt.type  = 'highpass'; filt.frequency.value = 5000;
    const src  = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.8);
    const g    = ctx.createGain();
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start();
  },

  タンバリン(ctx) {
    // シェル打撃
    playNoise(ctx, 0.15, 0.7, 5000);
    // ジングル
    [3200, 4200, 5000].forEach(f => playTone(ctx, f, 'sine', 0.5, 0.08, 0.003));
  },

  おもちゃのたいこ(ctx) {
    playTone(ctx, 120, 'sine', 0.3, 0.7, 0.005);
    playNoise(ctx, 0.05, 0.3, 1000);
  },

  すず(ctx) {
    [1200, 1800, 2400].forEach((f, i) => {
      setTimeout(() => playTone(ctx, f, 'sine', 0.6, 0.2, 0.005), i * 40);
    });
  },

  // キラキラ効果音（発光時）
  _sparkle(ctx) {
    [1500, 2000, 2500, 3000].forEach((f, i) => {
      setTimeout(() => playTone(ctx, f, 'sine', 0.2, 0.15, 0.01), i * 60);
    });
  }
};

async function playDefaultSound(name) {
  await resumeCtx();
  const ctx = getCtx();
  const fn  = synths[name];
  if (fn) fn(ctx);
}

async function playBlobSound(blob) {
  await resumeCtx();
  const ctx    = getCtx();
  const buf    = await blob.arrayBuffer();
  const audio  = await ctx.decodeAudioData(buf);
  const src    = ctx.createBufferSource();
  src.buffer   = audio;
  src.connect(ctx.destination);
  src.start();
}

async function playSparkle() {
  await resumeCtx();
  synths._sparkle(getCtx());
}
