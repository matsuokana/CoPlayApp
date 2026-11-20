'use strict';

// タンバリン・カスタネット・おもちゃのたいこを、音源ファイルを使わずにその場で合成する。
// 物理モデル風（減衰する固有振動の重ね合わせ＋衝突ノイズ）で波形を一度だけ計算し、
// AudioBuffer としてキャッシュして再生する。アプリのサイズを増やさないためファイルにはしない。

const _percCache = {};

// 毎回同じ音になるよう固定シードの乱数を使う
function _rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    uni: (a, b) => a + (b - a) * next(),
    noise: () => next() * 2 - 1,
    exp: mean => -Math.log(1 - next()) * mean,
  };
}

// RBJ 双二次フィルタ（その場で配列を書き換える）
function _biquad(x, sr, type, freq, q) {
  const w = 2 * Math.PI * freq / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'bp')      { b0 = al;            b1 = 0;         b2 = -al; }
  else if (type === 'hp') { b0 = (1 + cw) / 2;  b1 = -(1 + cw); b2 = (1 + cw) / 2; }
  else                    { b0 = (1 - cw) / 2;  b1 = 1 - cw;    b2 = (1 - cw) / 2; }
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
  return x;
}

// 減衰する正弦波（固有振動）を t0 秒から足し込む
function _addMode(buf, sr, t0, freq, amp, decay, phase) {
  const i0 = Math.floor(t0 * sr);
  const end = Math.min(buf.length, i0 + Math.ceil(decay * 7 * sr));
  const k = 2 * Math.PI * freq / sr, d = Math.exp(-1 / (decay * sr));
  let e = amp;
  for (let i = i0; i < end; i++) {
    buf[i] += e * Math.sin(k * (i - i0) + phase);
    e *= d;
  }
}

// 指数減衰するノイズ（フィルタ付き）を t0 秒から足し込む
function _addNoise(buf, sr, r, t0, amp, decay, filters) {
  const i0 = Math.floor(t0 * sr);
  const n = Math.min(buf.length - i0, Math.ceil(decay * 7 * sr));
  if (n <= 0) return;
  const tmp = new Float32Array(n);
  const d = Math.exp(-1 / (decay * sr));
  let e = amp;
  for (let i = 0; i < n; i++) { tmp[i] = r.noise() * e; e *= d; }
  filters.forEach(([type, f, q]) => _biquad(tmp, sr, type, f, q));
  for (let i = 0; i < n; i++) buf[i0 + i] += tmp[i];
}

function _normalize(buf, sr, peak) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  const g = m > 0 ? peak / m : 0;
  const fade = Math.floor(sr * 0.01);
  for (let i = 0; i < buf.length; i++) {
    const f = i > buf.length - fade ? (buf.length - i) / fade : 1;
    buf[i] *= g * f;
  }
  return buf;
}

const _percRecipes = {

  // カスタネット：硬い木の殻2枚が打ち合う「カッ」。
  // 鋭い衝突音＋殻の内側の空洞が一瞬だけ響く音程感。余韻はほとんど残らない。
  カスタネット(sr) {
    const r = _rng(11);
    const buf = new Float32Array(Math.floor(sr * 0.12));
    const pitch = 2100;
    // 1回だけ鋭く打ち鳴らす。衝突の瞬間のクリック（ほぼインパルス）を強めに
    _addNoise(buf, sr, r, 0, 2.2, 0.0003, [['hp', 2000, 0.7]]);
    // 空洞の共鳴（「カッ」の音程感の元）。ごく短く切れて余韻を残さない
    _addMode(buf, sr, 0, pitch,        1.00, 0.0050, 0);
    _addMode(buf, sr, 0, pitch * 1.56, 0.45, 0.0032, 0.6);
    _addMode(buf, sr, 0, pitch * 2.37, 0.25, 0.0022, 1.3);
    // 木の殻そのものの低めの鳴り（硬さ・厚み）
    _addMode(buf, sr, 0, pitch * 0.48, 0.30, 0.0035, 2.1);
    // 鋭い先端だけが突出して音が割れやすいので、軽く丸めて全体の音量感を上げる
    _normalize(buf, sr, 1);
    const k = 3, tk = Math.tanh(k);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(k * buf[i]) / tk;
    return _normalize(buf, sr, 0.9);
  },

  // タンバリン：手で皮を叩く「パン」＋ジングル（小さな金属円盤）のシャラシャラ
  タンバリン(sr) {
    const r = _rng(7);
    const buf = new Float32Array(Math.floor(sr * 0.75));
    [[220, 1.0, 0.035], [352, 0.6, 0.025], [505, 0.4, 0.018]].forEach(([f, a, d]) =>
      _addMode(buf, sr, 0, f, a * 0.45, d, r.uni(0, 6.28)));
    _addNoise(buf, sr, r, 0, 0.8, 0.012, [['bp', 1100, 0.6]]);
    const times = [];
    for (let i = 0; i < 10; i++) times.push(r.uni(0, 0.012));
    for (let t = 0.015; t < 0.45; t += r.exp(0.006 + t * 0.06)) times.push(t);
    const ratios = [1.0, 1.47, 1.93, 2.41, 2.86, 3.52];
    times.forEach(t0 => {
      const g = Math.exp(-t0 / 0.13) * r.uni(0.5, 1.0) * 0.35;
      const base = r.uni(4200, 5200);
      ratios.forEach((ra, i) => _addMode(buf, sr, t0, base * ra * r.uni(0.98, 1.02),
        g * r.uni(0.4, 1.0) / (1 + i * 0.4), r.uni(0.05, 0.14), r.uni(0, 6.28)));
      _addNoise(buf, sr, r, t0, g * 1.5, 0.0012, [['hp', 5000, 0.7]]);
    });
    _addNoise(buf, sr, r, 0, 0.25, 0.16, [['hp', 7000, 0.7]]);
    return _normalize(buf, sr, 0.9);
  },

  // おもちゃのたいこ：叩いた直後に少し音程が下がる皮の音＋スティック＋響き線のジャリッ
  'おもちゃのたいこ'(sr) {
    const r = _rng(3);
    const buf = new Float32Array(Math.floor(sr * 0.6));
    const f0 = 210;
    let ph = 0;
    for (let i = 0; i < buf.length; i++) {
      const t = i / sr;
      ph += 2 * Math.PI * f0 * (1 + 0.25 * Math.exp(-t / 0.02)) / sr;
      buf[i] += Math.sin(ph) * Math.exp(-t / 0.16);
    }
    [[1.59, 0.5, 0.09], [2.14, 0.35, 0.07], [2.30, 0.25, 0.06], [2.65, 0.2, 0.05], [2.92, 0.15, 0.04]]
      .forEach(([m, a, d]) => _addMode(buf, sr, 0, f0 * m, a * 0.6, d, r.uni(0, 6.28)));
    _addNoise(buf, sr, r, 0, 0.6, 0.004, [['bp', 3000, 0.5]]);
    _addNoise(buf, sr, r, 0, 0.35, 0.07, [['bp', 4000, 0.5]]);
    return _normalize(buf, sr, 0.9);
  },
};

function hasPercussion(name) {
  return name in _percRecipes;
}

function playPercussion(ctx, name, out) {
  let ab = _percCache[name];
  if (!ab) {
    const data = _percRecipes[name](ctx.sampleRate);
    ab = ctx.createBuffer(1, data.length, ctx.sampleRate);
    ab.getChannelData(0).set(data);
    _percCache[name] = ab;
  }
  const src = ctx.createBufferSource();
  src.buffer = ab;
  src.connect(out);
  src.start();
}

// タップ時に計算待ちが出ないよう、最初の操作のあとで先に作っておく
function warmPercussion(ctx) {
  Object.keys(_percRecipes).forEach(name => {
    if (!_percCache[name]) {
      const data = _percRecipes[name](ctx.sampleRate);
      const ab = ctx.createBuffer(1, data.length, ctx.sampleRate);
      ab.getChannelData(0).set(data);
      _percCache[name] = ab;
    }
  });
}
