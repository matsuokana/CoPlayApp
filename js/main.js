'use strict';

// ===== 画面切り替え =====
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');

  // 録音画面以外ではすべての入力欄をblurしてiOSシェイク取り消しを抑制
  if (name !== 'record') {
    document.querySelectorAll('input, textarea').forEach(el => el.blur());
  }
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', async () => {
  await initSoundboard();
  initShakelight();
  bindMenuEvents();
  bindNavigation();
});

// iOS DeviceMotion許可を求めるユーティリティ（ユーザー操作内でのみ有効）
async function requestMotionIfNeeded() {
  if (
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function' &&
    !_motionEnabled
  ) {
    await requestMotionPermission();
  }
}

function bindNavigation() {
  // ホーム → サウンドボード（iOSなら同時にセンサー許可）
  document.getElementById('btn-go-soundboard').addEventListener('click', async () => {
    await requestMotionIfNeeded();
    showScreen('soundboard');
  });

  // ホーム → 発光（iOSなら同時にセンサー許可）
  document.getElementById('btn-go-shakelight').addEventListener('click', async () => {
    await requestMotionIfNeeded();
    showScreen('shakelight');
  });

  // サウンドボード → ホーム
  document.getElementById('btn-back-soundboard').addEventListener('click', () => {
    showScreen('home');
  });

  // 録音 → サウンドボード
  document.getElementById('btn-back-record').addEventListener('click', () => {
    stopRecording();
    showScreen('soundboard');
  });

  // 発光 → ホーム
  document.getElementById('btn-back-shakelight').addEventListener('click', () => {
    showScreen('home');
  });

  // ＋追加ボタン → 録音画面
  document.getElementById('btn-add-sound').addEventListener('click', () => {
    showScreen('record');
  });
}
