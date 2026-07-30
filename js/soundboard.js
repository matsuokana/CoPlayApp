'use strict';

const DEFAULT_SOUNDS = [
  { id: 'default_drum',       name: 'たいこ',         icon: '🥁',  type: 'default' },
  { id: 'default_guitar',     name: 'ギター',          icon: '🎸',  type: 'default' },
  { id: 'default_trumpet',    name: 'トランペット',    icon: '🎺',  type: 'default' },
  { id: 'default_piano',      name: 'ピアノ',          icon: '🎹',  type: 'default' },
  { id: 'default_maraca',     name: 'マラカス',        icon: '🪇',  type: 'default' },
  { id: 'default_bell',       name: 'かね',            icon: '🔔',  type: 'default' },
  { id: 'default_violin',     name: 'バイオリン',      icon: '🎻',  type: 'default' },
  { id: 'default_whistle',    name: 'ホイッスル',      icon: '📯',  type: 'default' },
  { id: 'default_castanet',   name: 'カスタネット',    icon: '👐',  type: 'default' },
  { id: 'default_boing',      name: 'ぼよよーん',      icon: '🌀',  type: 'default' },
  { id: 'default_cymbal',     name: 'シンバル',        icon: '🔘',  type: 'default' },
  { id: 'default_tambourine', name: 'タンバリン',      icon: '🥁',  type: 'default' },
  { id: 'default_toydrum',    name: 'おもちゃのたいこ',icon: '🪘',  type: 'default' },
  { id: 'default_bell2',      name: 'すず',            icon: '🔕',  type: 'default' },
];

const ICON_OPTIONS = [
  '🥁','🎸','🎺','🎹','🎻','🪇','🔔','📯','🪘','🎷',
  '🎵','🎶','🎤','🎧','🪗','🎼','🎙️','🎟️','⭐','🌟'
];

const MAX_USER_SOUNDS = 5;

let _allSounds  = [];
let _editTarget = null;
let _recorder   = null;
let _recChunks  = [];
let _recBlob    = null;
let _recTimer   = null;
let _recSec     = 0;

async function initSoundboard() {
  const userSounds = await loadAllUserSounds();
  _allSounds = [...DEFAULT_SOUNDS, ...userSounds];
  renderGrid();
  bindRecordUI();
}

function renderGrid() {
  const grid = document.getElementById('soundboard-grid');
  grid.innerHTML = '';
  _allSounds.forEach(s => {
    const btn = document.createElement('button');
    btn.className  = 'sound-btn';
    btn.setAttribute('aria-label', s.name);
    btn.dataset.id = s.id;
    btn.innerHTML  = `<span class="s-icon">${s.icon}</span><span class="s-name">${s.name}</span>`;

    btn.addEventListener('click', () => onSoundTap(s, btn));

    // 長押し（ユーザー音源のみ編集可）
    if (s.type === 'user') {
      let timer;
      const startLong = () => { timer = setTimeout(() => openMenu(s), 600); };
      const cancel    = () => clearTimeout(timer);
      btn.addEventListener('touchstart', startLong, { passive: true });
      btn.addEventListener('touchend',   cancel);
      btn.addEventListener('touchmove',  cancel, { passive: true });
      btn.addEventListener('mousedown',  startLong);
      btn.addEventListener('mouseup',    cancel);
      btn.addEventListener('mouseleave', cancel);
    }
    grid.appendChild(btn);
  });

  // 追加ボタンの表示制御
  const userCount = _allSounds.filter(s => s.type === 'user').length;
  document.getElementById('btn-add-sound').style.display =
    userCount >= MAX_USER_SOUNDS ? 'none' : '';
}

async function onSoundTap(s, btn) {
  btn.classList.add('playing');
  setTimeout(() => btn.classList.remove('playing'), 300);
  if (s.type === 'default') {
    await playDefaultSound(s.name);
  } else {
    const db  = await openDB();
    const tx  = db.transaction('sounds', 'readonly');
    const req = tx.objectStore('sounds').get(s.id);
    req.onsuccess = async e => {
      if (e.target.result && e.target.result.blob) {
        await playBlobSound(e.target.result.blob);
      }
    };
  }
}

// ===== 長押しメニュー =====
function openMenu(s) {
  _editTarget = s;
  document.getElementById('longpress-menu').classList.remove('hidden');
  document.getElementById('menu-backdrop').classList.remove('hidden');
}
function closeMenu() {
  document.getElementById('longpress-menu').classList.add('hidden');
  document.getElementById('menu-backdrop').classList.add('hidden');
  _editTarget = null;
}

function bindMenuEvents() {
  document.getElementById('menu-backdrop').addEventListener('click', closeMenu);
  document.getElementById('btn-menu-cancel').addEventListener('click', closeMenu);

  document.getElementById('btn-delete').addEventListener('click', () => {
    closeMenu();
    openConfirm();
  });

  document.getElementById('btn-rename').addEventListener('click', () => {
    closeMenu();
    document.getElementById('rename-input').value = _editTarget.name;
    document.getElementById('rename-dialog').classList.remove('hidden');
    document.getElementById('dialog-backdrop').classList.remove('hidden');
    document.getElementById('rename-input').focus();
  });

  document.getElementById('btn-confirm-no').addEventListener('click', closeConfirm);
  document.getElementById('dialog-backdrop').addEventListener('click', closeConfirm);
  document.getElementById('btn-confirm-yes').addEventListener('click', async () => {
    if (!_editTarget) { closeConfirm(); return; }
    await deleteUserSound(_editTarget.id);
    _allSounds = _allSounds.filter(s => s.id !== _editTarget.id);
    _editTarget = null;
    closeConfirm();
    renderGrid();
  });

  document.getElementById('btn-rename-cancel').addEventListener('click', () => {
    document.getElementById('rename-dialog').classList.add('hidden');
    document.getElementById('dialog-backdrop').classList.add('hidden');
  });
  document.getElementById('btn-rename-ok').addEventListener('click', async () => {
    const newName = document.getElementById('rename-input').value.trim();
    if (!newName || !_editTarget) return;
    const rec = await (async () => {
      const db  = await openDB();
      const tx  = db.transaction('sounds', 'readonly');
      const req = tx.objectStore('sounds').get(_editTarget.id);
      return new Promise(r => { req.onsuccess = e => r(e.target.result); });
    })();
    if (rec) { rec.name = newName; await saveUserSound(rec); }
    const idx = _allSounds.findIndex(s => s.id === _editTarget.id);
    if (idx >= 0) _allSounds[idx].name = newName;
    _editTarget = null;
    document.getElementById('rename-dialog').classList.add('hidden');
    document.getElementById('dialog-backdrop').classList.add('hidden');
    renderGrid();
  });
}

function openConfirm() {
  document.getElementById('confirm-dialog').classList.remove('hidden');
  document.getElementById('dialog-backdrop').classList.remove('hidden');
}
function closeConfirm() {
  document.getElementById('confirm-dialog').classList.add('hidden');
  document.getElementById('dialog-backdrop').classList.add('hidden');
  _editTarget = null;
}

// ===== 録音UI =====
function bindRecordUI() {
  // アイコン選択
  const picker = document.getElementById('icon-picker');
  picker.innerHTML = '';
  ICON_OPTIONS.forEach((ic, i) => {
    const el = document.createElement('div');
    el.className  = 'icon-option' + (i === 0 ? ' selected' : '');
    el.textContent = ic;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', ic);
    el.addEventListener('click', () => {
      picker.querySelectorAll('.icon-option').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
    picker.appendChild(el);
  });

  document.getElementById('btn-rec-start').addEventListener('click', startRecording);
  document.getElementById('btn-rec-stop').addEventListener('click',  stopRecording);
  document.getElementById('btn-rec-play').addEventListener('click',  playPreview);
  document.getElementById('btn-rec-decide').addEventListener('click', saveRecording);
}

async function startRecording() {
  _recBlob = null;
  document.getElementById('btn-rec-play').classList.add('hidden');
  document.getElementById('btn-rec-decide').classList.add('hidden');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    alert('マイクをつかえませんでした。\nせってい画面でマイクをゆるしてください。');
    return;
  }

  _recChunks = [];
  _recorder  = new MediaRecorder(stream);
  _recorder.ondataavailable = e => { if (e.data.size > 0) _recChunks.push(e.data); };
  _recorder.onstop = () => {
    _recBlob = new Blob(_recChunks, { type: _recorder.mimeType || 'audio/webm' });
    stream.getTracks().forEach(t => t.stop());
    document.getElementById('btn-rec-play').classList.remove('hidden');
    document.getElementById('btn-rec-decide').classList.remove('hidden');
  };

  _recorder.start();
  document.getElementById('btn-rec-start').classList.add('hidden');
  document.getElementById('btn-rec-stop').classList.remove('hidden');
  document.getElementById('record-timer').classList.remove('hidden');

  _recSec   = 0;
  _recTimer = setInterval(() => {
    _recSec += 0.1;
    document.getElementById('record-timer').textContent =
      _recSec.toFixed(1) + 'びょう';
    if (_recSec >= 10) stopRecording();
  }, 100);
}

function stopRecording() {
  clearInterval(_recTimer);
  if (_recorder && _recorder.state !== 'inactive') _recorder.stop();
  document.getElementById('btn-rec-start').classList.remove('hidden');
  document.getElementById('btn-rec-stop').classList.add('hidden');
  document.getElementById('record-timer').classList.add('hidden');
}

async function playPreview() {
  if (_recBlob) await playBlobSound(_recBlob);
}

async function saveRecording() {
  const name = document.getElementById('sound-name-input').value.trim();
  if (!name) { alert('なまえをいれてね！'); return; }
  if (!_recBlob) { alert('まだろくおんしていません！'); return; }

  const icon = document.querySelector('#icon-picker .icon-option.selected')?.textContent || '🎵';
  const userCount = _allSounds.filter(s => s.type === 'user').length;
  if (userCount >= MAX_USER_SOUNDS) {
    alert('つけくわえられるのは' + MAX_USER_SOUNDS + 'こまでです。');
    return;
  }

  const id  = 'user_' + Date.now();
  const rec = { id, name, icon, type: 'user', blob: _recBlob };
  await saveUserSound(rec);
  _allSounds.push({ id, name, icon, type: 'user' });
  renderGrid();

  // 録音画面をリセット
  _recBlob = null;
  document.getElementById('sound-name-input').value = '';
  document.getElementById('btn-rec-play').classList.add('hidden');
  document.getElementById('btn-rec-decide').classList.add('hidden');
  document.getElementById('icon-picker').querySelector('.icon-option')?.classList.add('selected');

  showScreen('soundboard');
}
