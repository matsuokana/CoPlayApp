'use strict';

// ===== 画面切り替え =====
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', async () => {
  await initSoundboard();
  initShakelight();
  bindMenuEvents();
  bindNavigation();
});

function bindNavigation() {
  // ホーム → サウンドボード
  document.getElementById('btn-go-soundboard').addEventListener('click', () => {
    showScreen('soundboard');
  });

  // ホーム → 発光
  document.getElementById('btn-go-shakelight').addEventListener('click', () => {
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
