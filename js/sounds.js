'use strict';

let _ctx = null;
let _master = null;
function getCtx() {
  if (!_ctx) {
    // iOS でマナースイッチがオンでも音が鳴るようにする（対応ブラウザのみ）
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    // すべての音の出口。DynamicsCompressor はブラウザが自動で音量を持ち上げて
    // 楽器ごとにそろえた音量が崩れるので使わない
    _master = _ctx.createGain();
    _master.connect(_ctx.destination);
  }
  return _ctx;
}

// 音量補正（dB）をかけた出力先を作る
function outputNode(ctx, gainDb) {
  const g = ctx.createGain();
  g.gain.value = Math.pow(10, (gainDb || 0) / 20);
  g.connect(_master);
  return g;
}

function resumeCtx() {
  const ctx = getCtx();
  // 合成打楽器の波形を最初の操作のあとで先に作っておき、タップ時の遅れをなくす
  if (!resumeCtx._warmed) {
    resumeCtx._warmed = true;
    setTimeout(() => warmPercussion(ctx), 0);
  }
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

function playNoise(ctx, out, duration, gain, filterFreq) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration);
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = filterFreq;
  filt.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(filt); filt.connect(g); g.connect(out);
  src.start();
}

function playTone(ctx, out, freq, type, duration, gainVal, attack) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type      = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.001, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + (attack || 0.01));
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g); g.connect(out);
  osc.start(); osc.stop(ctx.currentTime + duration + 0.05);
}

// ====== 各楽器の合成音 ======
const synths = {

  'カッコウ笛'(ctx, out) {
    const notes = [659, 523];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(ctx, out, freq, 'sine', 0.35, 0.45, 0.02), i * 220);
    });
  },

  'ウズラ笛'(ctx, out) {
    // ウズラ：3連符風の短い上昇
    const notes = [880, 1047, 1175];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(ctx, out, freq, 'sine', 0.18, 0.4, 0.01), i * 110);
    });
  },

  'ナイチンゲール笛'(ctx, out) {
    // ナイチンゲール：トリル風の速い音の動き
    const base = 1047;
    [0,1,0,1,0,1,2].forEach((step, i) => {
      const freq = base * Math.pow(2, step / 12);
      setTimeout(() => playTone(ctx, out, freq, 'sine', 0.12, 0.35, 0.01), i * 80);
    });
  },

  マラカス(ctx, out) {
    playNoise(ctx, out, 0.25, 0.5, 6000);
  },

  'おもちゃのラッパ'(ctx, out) {
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
      osc1.connect(g); osc2.connect(g); g.connect(out);
      osc1.start(); osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    });
  },

  ホイッスル(ctx, out) {
    playTone(ctx, out, 2000, 'sine', 0.5, 0.5, 0.02);
    playTone(ctx, out, 2200, 'sine', 0.3, 0.15, 0.02);
  },

  'ぼよよーん'(ctx, out) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.7);
    g.gain.setValueAtTime(0.6, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(g); g.connect(out);
    osc.start(); osc.stop(ctx.currentTime + 0.85);
  },

  シンバル(ctx, out) {
    playNoise(ctx, out, 0.8, 0.4, 8000);
    const filt = ctx.createBiquadFilter();
    filt.type  = 'highpass'; filt.frequency.value = 5000;
    const src  = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.8);
    const g    = ctx.createGain();
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    src.connect(filt); filt.connect(g); g.connect(out);
    src.start();
  },

  トライアングル(ctx, out) {
    // 高い正弦波が長く余韻
    [4186, 5274].forEach((f, i) => {
      playTone(ctx, out, f, 'sine', 2.0, 0.3 / (i + 1), 0.005);
    });
  },

  ラチェット(ctx, out) {
    // 短いクリック音を連続で鳴らす
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playNoise(ctx, out, 0.03, 0.6, 3000), i * 55);
    }
  },

  // キラキラ効果音（発光時）
  _sparkle(ctx, out) {
    [1500, 2000, 2500, 3000].forEach((f, i) => {
      setTimeout(() => playTone(ctx, out, f, 'sine', 0.2, 0.15, 0.01), i * 60);
    });
  }
};

// 音源ファイルを読み込んで AudioBuffer にしておく（src ごとに1回だけ）
const _bufCache = {};
function loadSoundFile(src) {
  if (!_bufCache[src]) {
    _bufCache[src] = fetch(src)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => getCtx().decodeAudioData(b));
    _bufCache[src].catch(() => {}); // 先読み失敗は再生時に合成音へフォールバックする
  }
  return _bufCache[src];
}

// 既定の楽器を鳴らす。s.gainDb で楽器ごとの音量差をそろえる。
// ファイルがあればそれを優先し、なければ（または読めなければ）合成音で鳴らす。
async function playDefaultSound(s) {
  await resumeCtx();
  const ctx = getCtx();
  const out = outputNode(ctx, s.gainDb);
  if (s.src) {
    try {
      const buf = await loadSoundFile(s.src);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      const from = s.start || 0;
      if (s.end) src.start(0, from, s.end - from);
      else src.start(0, from);
      return;
    } catch (e) {
      // ファイルが未配置の場合は合成音で代替
    }
  }
  if (hasPercussion(s.name)) return playPercussion(ctx, s.name, out);
  const fn = synths[s.name];
  if (fn) fn(ctx, out);
}

async function playBlobSound(blob) {
  await resumeCtx();
  const ctx    = getCtx();
  const buf    = await blob.arrayBuffer();
  const audio  = await ctx.decodeAudioData(buf);
  const src    = ctx.createBufferSource();
  src.buffer   = audio;
  src.connect(outputNode(ctx, 0));
  src.start();
}

async function playSparkle() {
  await resumeCtx();
  const ctx = getCtx();
  synths._sparkle(ctx, outputNode(ctx, 0));
}
