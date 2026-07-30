'use strict';

const COLORS = [
  { name: 'あか',      hex: '#FF4444' },
  { name: 'だいだい',  hex: '#FF8800' },
  { name: 'き',        hex: '#FFDD00' },
  { name: 'みどり',    hex: '#44CC44' },
  { name: 'あお',      hex: '#4488FF' },
  { name: 'むらさき',  hex: '#AA44FF' },
  { name: 'ピンク',    hex: '#FF44AA' },
  { name: 'しろ',      hex: '#FFFFFF' },
];

const SHAKE_THRESHOLD = 20;
const COOLDOWN_MS     = 500;

let _selectedColor = COLORS[0].hex;
let _lastShake     = 0;
let _motionEnabled = false;

function initShakelight() {
  renderColorPicker();
  bindShakelightUI();
  setupMotion();
}

function renderColorPicker() {
  const picker = document.getElementById('color-picker');
  picker.innerHTML = '';
  COLORS.forEach(c => {
    const item  = document.createElement('div');
    item.className = 'color-item';

    const circle = document.createElement('div');
    circle.className = 'color-option' + (c.hex === _selectedColor ? ' selected' : '');
    circle.style.background = c.hex;
    circle.setAttribute('aria-label', c.name);
    circle.setAttribute('role', 'button');
    circle.addEventListener('click', () => selectColor(c.hex));

    const label = document.createElement('div');
    label.className   = 'color-name';
    label.textContent = c.name;

    item.appendChild(circle);
    item.appendChild(label);
    picker.appendChild(item);
  });
}

function selectColor(hex) {
  _selectedColor = hex;
  document.querySelectorAll('.color-option').forEach(el => {
    el.classList.toggle('selected', el.style.background === hexToRgb(hex) || el.style.background === hex);
  });
}

// CSS background を比較するためにhex→rgb変換
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${r}, ${g}, ${b})`;
}

function bindShakelightUI() {
  document.getElementById('btn-tap-light').addEventListener('click', triggerFlash);

  document.getElementById('sfx-toggle').addEventListener('change', e => {
    saveSettings('sfx', e.target.checked);
  });
  document.getElementById('sfx-toggle').checked = loadSettings('sfx', true);

  document.getElementById('btn-request-motion').addEventListener('click', requestMotionPermission);
}

// ===== DeviceMotion =====
function setupMotion() {
  if (typeof DeviceMotionEvent === 'undefined') {
    showTapOnly('このきのうはつかえません（センサーがありません）');
    return;
  }

  // iOS 13+ 許可が必要
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    document.getElementById('btn-request-motion').classList.remove('hidden');
    document.getElementById('shake-status-text').textContent =
      '「センサーをゆるす」をおしてね！';
    return;
  }

  // Android・その他はそのまま登録
  enableMotionListener();
}

async function requestMotionPermission() {
  try {
    const res = await DeviceMotionEvent.requestPermission();
    if (res === 'granted') {
      enableMotionListener();
      document.getElementById('btn-request-motion').classList.add('hidden');
      document.getElementById('shake-status-text').textContent = 'スマホをふると光るよ！';
    } else {
      showTapOnly('センサーをゆるしてもらえませんでした。\nタップでも光らせられるよ！');
    }
  } catch (e) {
    showTapOnly('センサーをつかえませんでした。\nタップでも光らせられるよ！');
  }
}

function enableMotionListener() {
  _motionEnabled = true;
  window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
}

function onDeviceMotion(e) {
  if (!_motionEnabled) return;
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const total = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
  const now   = Date.now();
  if (total > SHAKE_THRESHOLD && now - _lastShake > COOLDOWN_MS) {
    _lastShake = now;
    const active = document.querySelector('.screen.active');
    const screenId = active ? active.id : '';
    if (screenId === 'screen-shakelight') {
      triggerFlash();
    } else if (screenId === 'screen-soundboard') {
      playSelectedSoundOnShake();
    }
    // それ以外の画面では何もしない
  }
}

function showTapOnly(msg) {
  document.getElementById('shake-status-text').textContent = msg;
}

// ===== 発光 =====
function triggerFlash() {
  const overlay = document.getElementById('flash-overlay');
  overlay.style.background = _selectedColor;
  overlay.classList.add('visible');

  if (loadSettings('sfx', true)) playSparkle();

  // フェードアウト
  setTimeout(() => { overlay.classList.remove('visible'); }, 400);
}
