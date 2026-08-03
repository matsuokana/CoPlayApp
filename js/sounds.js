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

  'カッコウ笛'(ctx) {
    const notes = [659, 523];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(ctx, freq, 'sine', 0.35, 0.45, 0.02), i * 220);
    });
  },

  'ウズラ笛'(ctx) {
    // ウズラ：3連符風の短い上昇
    const notes = [880, 1047, 1175];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(ctx, freq, 'sine', 0.18, 0.4, 0.01), i * 110);
    });
  },

  'ナイチンゲール笛'(ctx) {
    // ナイチンゲール：トリル風の速い音の動き
    const base = 1047;
    [0,1,0,1,0,1,2].forEach((step, i) => {
      const freq = base * Math.pow(2, step / 12);
      setTimeout(() => playTone(ctx, freq, 'sine', 0.12, 0.35, 0.01), i * 80);
    });
  },

  マラカス(ctx) {
    playNoise(ctx, 0.25, 0.5, 6000);
  },

  'おもちゃのラッパ'(ctx) {
    // おもちゃの交響曲風：プァ〜ンという明るい3和音
    const chord = [
      { freq: 523, gain: 0.30 },  // ド
      { freq: 659, gain: 0.20 },  // ミ
      { freq: 784, gain: 0.12 },  // ソ
    ];
    chord.forEach(({ freq, gain }) => {
      // 矩形波（おもちゃらしい音色）
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g    = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.value = freq;
      osc2.type = 'sawtooth';
      osc2.frequency.value = freq * 2;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.04);
      g.gain.setValueAtTime(gain, ctx.currentTime + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc1.connect(g); osc2.connect(g); g.connect(ctx.destination);
      osc1.start(); osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    });
  },

  'おもちゃのたいこ'(ctx) {
    playTone(ctx, 120, 'sine', 0.3, 0.7, 0.005);
    playNoise(ctx, 0.05, 0.3, 1000);
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
    // 手で叩く打撃音（低めのノイズバースト）
    const hit = ctx.createBufferSource();
    hit.buffer = noiseBuffer(ctx, 0.08);
    const hitFilt = ctx.createBiquadFilter();
    hitFilt.type = 'bandpass';
    hitFilt.frequency.value = 800;
    hitFilt.Q.value = 1.5;
    const hitG = ctx.createGain();
    hitG.gain.setValueAtTime(1.0, ctx.currentTime);
    hitG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    hit.connect(hitFilt); hitFilt.connect(hitG); hitG.connect(ctx.destination);
    hit.start();

    // ジングル（複数の短い金属音を時間差で）
    const jingleFreqs = [6000, 7200, 8500, 9800];
    jingleFreqs.forEach((f, i) => {
      [0, 40, 80].forEach(delay => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx, 0.18);
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = f;
        filt.Q.value = 8;
        const g = ctx.createGain();
        const t = ctx.currentTime + delay / 1000;
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        src.connect(filt); filt.connect(g); g.connect(ctx.destination);
        src.start(t);
      });
    });
  },

  トライアングル(ctx) {
    // 高い正弦波が長く余韻
    [4186, 5274].forEach((f, i) => {
      playTone(ctx, f, 'sine', 2.0, 0.3 / (i + 1), 0.005);
    });
  },

  ラチェット(ctx) {
    // 短いクリック音を連続で鳴らす
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playNoise(ctx, 0.03, 0.6, 3000), i * 55);
    }
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
