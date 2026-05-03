/* focus-timer.js — Pomodoro-style focus session */

const FocusTimer = {
  intervalId: null,
  totalSeconds: 0,
  remainingSeconds: 0,
  taskText: '',
};

let selectedDuration = 25;

/* ── open focus modal ────────────────────────────────────────── */
document.getElementById('btn-focus').addEventListener('click', () => {
  if (AppState.isFocusSession) {
    stopFocusSession();
    return;
  }
  document.getElementById('focus-modal').classList.remove('hidden');
  document.getElementById('focus-task-input').value = '';
  document.getElementById('focus-task-input').focus();
});

/* ── duration selection ──────────────────────────────────────── */
document.querySelectorAll('.dur-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dur-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDuration = parseInt(btn.dataset.duration, 10);
  });
});

/* ── start session ───────────────────────────────────────────── */
document.getElementById('btn-start-focus').addEventListener('click', startFocusSession);
document.getElementById('btn-cancel-focus').addEventListener('click', () => {
  document.getElementById('focus-modal').classList.add('hidden');
});

function startFocusSession() {
  const text = document.getElementById('focus-task-input').value.trim();
  if (!text) { document.getElementById('focus-task-input').focus(); return; }

  document.getElementById('focus-modal').classList.add('hidden');

  FocusTimer.taskText = text;
  FocusTimer.totalSeconds = selectedDuration * 60;
  FocusTimer.remainingSeconds = FocusTimer.totalSeconds;
  AppState.isFocusSession = true;
  AppState.sessionCount++;

  document.getElementById('session-counter').textContent =
    `${AppState.sessionCount} session${AppState.sessionCount !== 1 ? 's' : ''} today`;
  document.getElementById('btn-focus').textContent = '■ Stop';

  const banner = document.getElementById('focus-banner');
  banner.classList.remove('hidden');
  document.getElementById('focus-banner-task').textContent = text;
  document.getElementById('focus-banner-fill').style.width = '100%';

  // Dim non-linked tasks in the todo list
  document.getElementById('todo-list').classList.add('focus-session-active');
  markFocusLinkedTasks(text);

  updateBannerTimer();
  FocusTimer.intervalId = setInterval(timerTick, 1000);
}

/* ── timer tick ──────────────────────────────────────────────── */
function timerTick() {
  FocusTimer.remainingSeconds--;

  if (FocusTimer.remainingSeconds <= 0) {
    sessionComplete();
    return;
  }

  updateBannerTimer();
}

function updateBannerTimer() {
  const m = Math.floor(FocusTimer.remainingSeconds / 60);
  const s = FocusTimer.remainingSeconds % 60;
  const label = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  document.getElementById('focus-banner-timer').textContent = label;

  const pct = (FocusTimer.remainingSeconds / FocusTimer.totalSeconds) * 100;
  document.getElementById('focus-banner-fill').style.width = `${pct}%`;
}

/* ── session complete ────────────────────────────────────────── */
function sessionComplete() {
  clearInterval(FocusTimer.intervalId);
  cleanUpFocusUI();
  document.getElementById('break-modal').classList.remove('hidden');
}

document.getElementById('btn-dismiss-break').addEventListener('click', () => {
  document.getElementById('break-modal').classList.add('hidden');
});

/* ── stop session manually ───────────────────────────────────── */
document.getElementById('btn-stop-focus').addEventListener('click', stopFocusSession);

function stopFocusSession() {
  clearInterval(FocusTimer.intervalId);
  cleanUpFocusUI();
}

function cleanUpFocusUI() {
  AppState.isFocusSession = false;
  document.getElementById('btn-focus').textContent = '▶ Focus';
  document.getElementById('focus-banner').classList.add('hidden');
  document.getElementById('todo-list').classList.remove('focus-session-active');
  document.querySelectorAll('.task-item.focus-linked')
    .forEach((el) => el.classList.remove('focus-linked'));
}

/* ── dim logic: mark tasks related to focus text ─────────────── */
function markFocusLinkedTasks(text) {
  const lower = text.toLowerCase();
  document.querySelectorAll('.task-item').forEach((item) => {
    const taskText = item.querySelector('.task-text')?.textContent.toLowerCase() || '';
    if (taskText.includes(lower) || lower.includes(taskText.slice(0, 10))) {
      item.classList.add('focus-linked');
    }
  });
}
