'use strict';

const SHAKE_THRESHOLD = 20;
const COOLDOWN_MS     = 500;

let _lastShake     = 0;
let _motionEnabled = false;

function initShake() {
  setupMotion();
}

function setupMotion() {
  if (typeof DeviceMotionEvent === 'undefined') return;
  if (typeof DeviceMotionEvent.requestPermission !== 'function') {
    enableMotionListener();
  }
}

// 自動呼び出し用（アラートなし）：ホームボタンタップ時に使用
async function requestMotionPermission() {
  try {
    const res = await DeviceMotionEvent.requestPermission();
    if (res === 'granted') enableMotionListener();
  } catch (e) {
    // 拒否済みや非対応の場合は何もしない
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
    const activeId = document.querySelector('.screen.active')?.id || '';
    if (activeId === 'screen-soundboard') {
      playSelectedSoundOnShake();
    }
  }
}
