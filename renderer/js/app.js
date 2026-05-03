/* app.js — entry point, coordinates all modules */

/* ── resize handles (independent axes) ──────────────────────── */
function attachResize(elId, axis) {
  // axis: 'ew' = width only, 'ns' = height only, 'both' = both
  const el = document.getElementById(elId);
  if (!el) return;

  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.screenX;
    const startY = e.screenY;
    const startW = window.innerWidth;
    const startH = window.innerHeight;

    let rafId = null;
    let pending = null;

    const onMove = (ev) => {
      const dX = ev.screenX - startX;
      const dY = ev.screenY - startY;
      pending = {
        w: axis === 'ns'   ? startW : Math.max(180, startW + dX),
        h: axis === 'ew'   ? startH : Math.max(150, startH + dY),
      };
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          if (pending) window.electronAPI.resizeWindow(Math.round(pending.w), Math.round(pending.h));
          pending = null;
          rafId = null;
        });
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachResize('resize-e',  'ew');
  attachResize('resize-s',  'ns');
  attachResize('resize-se', 'both');
});

window.AppState = {
  tasks: [],
  calendarEvents: [],
  isCompact: false,
  isPinned: true,
  isFocusSession: false,
  todayFilter: false,
  pendingWritebacks: {},   // eventId → { tasks, dirty }
  writebackTimer: null,
  sessionCount: 0,
};

/* ── click-through: pass mouse through transparent areas ───── */
document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el !== document.documentElement && el !== document.body) {
    window.electronAPI.setIgnoreMouseEvents(false);
  } else {
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }
});

document.addEventListener('mouseleave', () => {
  window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
});

/* ── compact toggle ─────────────────────────────────────────── */
document.getElementById('btn-compact').addEventListener('click', () => {
  AppState.isCompact = !AppState.isCompact;
  window.electronAPI.toggleCompact(AppState.isCompact);

  const compactView   = document.getElementById('compact-view');
  const mainContent   = document.getElementById('main-content');
  const topBar        = document.getElementById('top-bar');
  const quickAdd      = document.getElementById('quick-add-bar');
  const focusBanner   = document.getElementById('focus-banner');

  if (AppState.isCompact) {
    compactView.classList.remove('hidden');
    mainContent.classList.add('hidden');
    topBar.classList.add('hidden');
    quickAdd.classList.add('hidden');
    focusBanner.classList.add('hidden');
    updateCompactDisplay();
  } else {
    compactView.classList.add('hidden');
    mainContent.classList.remove('hidden');
    topBar.classList.remove('hidden');
    if (AppState.isFocusSession) focusBanner.classList.remove('hidden');
  }
});

/* ── always-on-top pin ──────────────────────────────────────── */
document.getElementById('btn-pin').addEventListener('click', () => {
  AppState.isPinned = !AppState.isPinned;
  window.electronAPI.toggleAlwaysOnTop(AppState.isPinned);
  document.getElementById('btn-pin').classList.toggle('active', AppState.isPinned);
});

/* ── minimize ───────────────────────────────────────────────── */
document.getElementById('btn-minimize').addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

/* ── global hotkey: quick add ───────────────────────────────── */
window.electronAPI.onHotkeyQuickAdd(() => {
  if (AppState.isCompact) {
    // Expand first
    document.getElementById('btn-compact').click();
  }
  openQuickAdd();
});

/* ── today filter toggle ────────────────────────────────────── */
document.getElementById('btn-today-filter').addEventListener('click', () => {
  AppState.todayFilter = !AppState.todayFilter;
  document.getElementById('btn-today-filter').classList.toggle('active', AppState.todayFilter);
  if (typeof window.renderTasks === 'function') window.renderTasks();
});

/* ── Google Calendar connect button ─────────────────────────── */
document.getElementById('btn-gcal-connect').addEventListener('click', async () => {
  const btn = document.getElementById('btn-gcal-connect');
  const isAuth = await window.electronAPI.gcalIsAuthenticated();
  if (isAuth) {
    if (confirm('Disconnect Google Calendar?')) {
      await window.electronAPI.gcalRevoke();
      btn.textContent = '🔗';
      btn.title = 'Connect Google Calendar';
      AppState.calendarEvents = [];
      if (typeof window.renderCalendar === 'function') window.renderCalendar([]);
    }
  } else {
    btn.textContent = '⏳';
    const result = await window.electronAPI.gcalAuthenticate();
    if (result.success) {
      btn.textContent = '✅';
      btn.title = 'Google Calendar connected';
      if (typeof window.fetchAndRenderCalendar === 'function') {
        await window.fetchAndRenderCalendar();
      }
    } else {
      btn.textContent = '🔗';
      alert('Authentication failed: ' + (result.error || 'Unknown error'));
    }
  }
});

/* ── quick-add helpers ──────────────────────────────────────── */
function openQuickAdd() {
  const bar = document.getElementById('quick-add-bar');
  bar.classList.remove('hidden');
  document.getElementById('quick-add-input').focus();
}

function closeQuickAdd() {
  const bar = document.getElementById('quick-add-bar');
  bar.classList.add('hidden');
  document.getElementById('quick-add-input').value = '';
}

document.getElementById('btn-add-task').addEventListener('click', openQuickAdd);

document.getElementById('quick-add-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = e.target.value.trim();
    if (text && typeof window.addTask === 'function') {
      const activePriorityBtn = document.querySelector('.qp-btn.active');
      const priority = activePriorityBtn?.dataset.priority || 'medium';
      window.addTask(text, priority);
      closeQuickAdd();
    }
  } else if (e.key === 'Escape') {
    closeQuickAdd();
  }
});

document.querySelectorAll('.qp-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.qp-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ── compact display refresh ─────────────────────────────────── */
window.updateCompactDisplay = function () {
  const remaining = AppState.tasks.filter((t) => !t.completed).length;
  document.getElementById('compact-tasks').textContent =
    `${remaining} task${remaining !== 1 ? 's' : ''} remaining`;
};

/* ── writeback queue ─────────────────────────────────────────── */
window.queueWriteback = function (eventId) {
  const linked = AppState.tasks.filter((t) => t.linkedBlocks?.includes(eventId));
  AppState.pendingWritebacks[eventId] = { tasks: linked, dirty: true };
};

async function flushWritebacks() {
  const ids = Object.keys(AppState.pendingWritebacks);
  if (!ids.length) return;

  const isAuth = await window.electronAPI.gcalIsAuthenticated();
  if (!isAuth) return;

  document.getElementById('sync-spinner').classList.remove('hidden');

  for (const eventId of ids) {
    const { tasks, dirty } = AppState.pendingWritebacks[eventId];
    if (!dirty) continue;
    AppState.pendingWritebacks[eventId].dirty = false;
    await window.electronAPI.gcalWriteback({ eventId, tasks });
  }

  document.getElementById('sync-spinner').classList.add('hidden');
}

AppState.writebackTimer = setInterval(flushWritebacks, 90_000);

/* ── deadline amber warnings ──────────────────────────────────── */
function checkDeadlines() {
  const now = Date.now();
  AppState.tasks.forEach((task) => {
    if (task.completed || !task.linkedBlocks?.length) return;
    task.linkedBlocks.forEach((evId) => {
      const ev = AppState.calendarEvents.find((e) => e.id === evId);
      if (!ev) return;
      const endTime = new Date(ev.end).getTime();
      const item = document.querySelector(`.task-item[data-id="${task.id}"]`);
      if (!item) return;
      const tag = item.querySelector('.task-tag.deadline-warn');
      if (endTime - now <= 15 * 60_000 && endTime > now) {
        if (!tag) {
          const t = document.createElement('span');
          t.className = 'task-tag deadline-warn';
          t.textContent = '⏰ 15 min';
          item.querySelector('.task-meta')?.appendChild(t);
        }
      } else if (tag) {
        tag.remove();
      }
    });
  });
}

setInterval(checkDeadlines, 60_000);

/* ── initialise ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Hydrate tasks then render
  AppState.tasks = (await window.electronAPI.getTasks()) || [];
  if (typeof window.renderTasks === 'function') window.renderTasks();

  // Check GCal auth state
  const isAuth = await window.electronAPI.gcalIsAuthenticated();
  if (isAuth) {
    document.getElementById('btn-gcal-connect').textContent = '✅';
    document.getElementById('btn-gcal-connect').title = 'Google Calendar connected';
  }
});
