/* calendar.js — calendar view rendering + GCal sync */

const PX_PER_MIN = 1;  // 1px per minute, 60px per hour

function minutesFromMidnight(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function fmtTime(iso) {
  const d = new Date(iso);
  const h = d.getHours(); const m = d.getMinutes();
  const ampm = h < 12 ? 'am' : 'pm';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')}${ampm}`;
}

/* ── hour labels + grid lines ─────────────────────────────────── */
function buildTimeGrid() {
  const grid = document.getElementById('time-grid');
  for (let h = 0; h < 24; h++) {
    const topPx = h * 60;

    const line = document.createElement('div');
    line.className = 'hour-line';
    line.style.top = `${topPx}px`;
    grid.appendChild(line);

    const label = document.createElement('div');
    label.className = 'hour-label';
    label.style.top = `${topPx}px`;
    label.textContent = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
    grid.appendChild(label);
  }
}

/* ── current-time line ────────────────────────────────────────── */
function updateTimeLine() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const line = document.getElementById('current-time-line');
  if (line) line.style.top = `${mins * PX_PER_MIN}px`;
}

setInterval(updateTimeLine, 60_000);
updateTimeLine();

/* ── auto-scroll to current time ─────────────────────────────── */
function scrollToCurrent() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const scroll = document.getElementById('calendar-scroll');
  if (scroll) {
    scroll.scrollTop = Math.max(0, mins * PX_PER_MIN - 100);
  }
}

/* ── public: render calendar events ──────────────────────────── */
window.renderCalendar = function (events) {
  AppState.calendarEvents = events;
  const grid = document.getElementById('time-grid');

  // Remove old event blocks (keep hour lines, labels, time line)
  grid.querySelectorAll('.cal-event').forEach((el) => el.remove());

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  events.filter((ev) => !ev.allDay).forEach((ev) => {
    const startMin = minutesFromMidnight(ev.start);
    const endMin   = minutesFromMidnight(ev.end);
    const height   = Math.max(endMin - startMin, 22);
    const upcoming = startMin >= nowMin && startMin <= nowMin + 120;

    const block = document.createElement('div');
    block.className = `cal-event${upcoming ? ' upcoming' : ''}`;
    block.dataset.eventId = ev.id;
    block.style.top        = `${startMin * PX_PER_MIN}px`;
    block.style.height     = `${height}px`;
    block.style.background = ev.color + 'cc';
    block.style.borderLeft = `3px solid ${ev.color}`;

    const titleEl = document.createElement('div');
    titleEl.className = 'cal-event-title';
    titleEl.textContent = ev.title;

    const timeEl = document.createElement('div');
    timeEl.className = 'cal-event-time';
    timeEl.textContent = `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;

    const taskListEl = document.createElement('div');
    taskListEl.className = 'cal-event-tasks';
    taskListEl.id = `evt-tasks-${ev.id}`;

    block.appendChild(titleEl);
    if (height > 30) block.appendChild(timeEl);
    if (height > 45) block.appendChild(taskListEl);

    // Click to open event detail
    block.addEventListener('click', () => openEventDetail(ev.id));

    // Drop target for tasks
    block.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('text/task-id')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', () => block.classList.remove('drag-over'));
    block.addEventListener('drop', (e) => {
      block.classList.remove('drag-over');
      document.getElementById('time-grid').classList.remove('drag-active');
      const taskId = e.dataTransfer.getData('text/task-id');
      if (taskId) linkTaskToEvent(taskId, ev.id);
    });

    grid.appendChild(block);
  });

  // Refresh linked task lists for all events
  events.forEach((ev) => refreshEventTaskList(ev.id));
};

/* ── refresh linked task list inside an event block ─────────── */
window.refreshEventTaskList = function (eventId) {
  const container = document.getElementById(`evt-tasks-${eventId}`);
  if (!container) return;
  container.innerHTML = '';

  const linked = AppState.tasks.filter((t) => t.linkedBlocks?.includes(eventId));
  if (linked.length === 0) return;

  linked.forEach((task) => {
    const el = document.createElement('div');
    el.className = `cal-linked-task${task.completed ? ' done' : ''}`;

    const icon = document.createElement('span');
    icon.className = 'cal-task-icon';
    icon.textContent = task.completed ? '✅' : '⬜';

    const text = document.createElement('span');
    text.className = 'cal-task-text';
    text.textContent = task.text;

    el.appendChild(icon);
    el.appendChild(text);
    container.appendChild(el);
  });

  const block = document.querySelector(`.cal-event[data-event-id="${eventId}"]`);
  const done = linked.filter((t) => t.completed).length;
  const allDone = done === linked.length;

  let prog = block?.querySelector('.cal-progress');
  if (!prog) {
    prog = document.createElement('div');
    prog.className = 'cal-progress';
    block?.appendChild(prog);
  }
  if (allDone) {
    prog.textContent = '✅ All done!';
    prog.classList.add('all-done');
  } else {
    prog.textContent = `${done}/${linked.length} done`;
    prog.classList.remove('all-done');
  }
};

/* ── drop confirmation ✓ mark ─────────────────────────────────── */
function showDropConfirmation(block) {
  const rect = block.getBoundingClientRect();
  const mark = document.createElement('div');
  mark.className = 'drop-confirm-mark';
  mark.textContent = '✓';
  mark.style.left = `${rect.left + rect.width / 2}px`;
  mark.style.top  = `${rect.top  + rect.height / 2}px`;
  document.body.appendChild(mark);
  mark.addEventListener('animationend', () => mark.remove(), { once: true });
}

/* ── link a task to a calendar event ─────────────────────────── */
window.linkTaskToEvent = function (taskId, eventId) {
  const task = AppState.tasks.find((t) => t.id === taskId);
  const ev   = AppState.calendarEvents.find((e) => e.id === eventId);
  if (!task || !ev) return;

  if (!task.linkedBlocks.includes(eventId)) {
    task.linkedBlocks.push(eventId);
  }

  window.electronAPI.saveTasks(AppState.tasks);
  if (typeof window.renderTasks === 'function') window.renderTasks();
  refreshEventTaskList(eventId);
  renderDetailTaskList(eventId);       // refresh detail panel if open
  window.queueWriteback?.(eventId);
  setTimeout(() => window.flushWritebacks?.(), 400); // write to GCal immediately

  const block = document.querySelector(`.cal-event[data-event-id="${eventId}"]`);
  if (block) showDropConfirmation(block);
};

/* ── status message inside calendar panel ────────────────────── */
function setCalStatus(msg, isError) {
  let el = document.getElementById('cal-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cal-status';
    el.style.cssText = [
      'padding:8px 10px',
      'font-size:11px',
      'text-align:center',
      'white-space:pre-wrap',
      'word-break:break-word',
    ].join(';');
    document.getElementById('calendar-scroll').prepend(el);
  }
  if (msg) {
    el.textContent = msg;
    el.style.color = isError ? 'var(--high)' : 'var(--text-dim)';
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

/* ── fetch events from Google Calendar ───────────────────────── */
window.fetchAndRenderCalendar = async function () {
  document.getElementById('sync-spinner')?.classList.remove('hidden');
  setCalStatus(null);

  const result = await window.electronAPI.gcalGetEvents();

  document.getElementById('sync-spinner')?.classList.add('hidden');

  if (result.error) {
    renderCalendar([]);
    setCalStatus(`⚠ ${result.error}`, true);
    alert(`Google Calendar error:\n\n${result.error}\n\nCheck the calendar panel for details.`);
    return;
  }

  const events = result.events || [];
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const timedEvents = events.filter((ev) => !ev.allDay);
  if (events.length === 0) {
    setCalStatus(`No events found for ${dateLabel}.`);
    renderCalendar([]);
  } else if (timedEvents.length === 0) {
    setCalStatus(`Only all-day events on ${dateLabel}.`);
    renderCalendar(events);
  } else {
    setCalStatus(null);
    renderCalendar(events);
    scrollToCurrent();
  }
};

/* ── init ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  buildTimeGrid();
  updateTimeLine();

  const isAuth = await window.electronAPI.gcalIsAuthenticated();
  if (isAuth) {
    await window.fetchAndRenderCalendar();
  } else {
    // Show demo events so the layout is visible
    renderCalendar(getDemoEvents());
  }

  scrollToCurrent();
});

/* ── auto-scroll drift every 5 minutes ──────────────────────── */
setInterval(scrollToCurrent, 5 * 60_000);

/* ── event detail panel ──────────────────────────────────────── */
let _detailEventId = null;

function openEventDetail(eventId) {
  _detailEventId = eventId;
  renderEventDetail(eventId);
  document.getElementById('calendar-panel').classList.add('hidden');
  document.getElementById('event-detail-panel').classList.remove('hidden');
}

function closeEventDetail() {
  document.getElementById('event-detail-panel').classList.add('hidden');
  document.getElementById('calendar-panel').classList.remove('hidden');
  _detailEventId = null;
}

function renderEventDetail(eventId) {
  const ev = AppState.calendarEvents.find((e) => e.id === eventId);
  if (!ev) return;

  document.getElementById('event-detail-color-dot').style.background = ev.color;
  document.getElementById('event-detail-title').textContent = ev.title;
  document.getElementById('event-detail-time').textContent =
    `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;

  // Show original GCal notes (strip the task block we write after ---)
  const raw = (ev.description || '').trim();
  const notes = raw.includes('\n---\n') ? raw.slice(0, raw.indexOf('\n---\n')).trim() : raw;
  const descSection = document.getElementById('event-detail-desc-section');
  if (notes) {
    document.getElementById('event-detail-desc').textContent = notes;
    descSection.classList.remove('hidden');
  } else {
    descSection.classList.add('hidden');
  }

  renderDetailTaskList(eventId);
}

function renderDetailTaskList(eventId) {
  if (_detailEventId !== eventId) return; // panel showing a different event
  const list = document.getElementById('event-detail-task-list');
  const hint = document.getElementById('event-detail-empty-hint');
  if (!list) return;
  list.innerHTML = '';

  const linked = AppState.tasks.filter((t) => t.linkedBlocks?.includes(eventId));
  hint.classList.toggle('hidden', linked.length > 0);

  linked.forEach((task) => {
    const row = document.createElement('div');
    row.className = 'detail-task-row';

    const check = document.createElement('div');
    check.className = `detail-task-check${task.completed ? ' checked' : ''}`;
    check.title = task.completed ? 'Mark incomplete' : 'Mark complete';
    check.addEventListener('click', () => {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      check.classList.toggle('checked', task.completed);
      check.classList.add('pop');
      check.addEventListener('animationend', () => check.classList.remove('pop'), { once: true });
      textEl.classList.toggle('done', task.completed);
      textEl.textContent = task.completed ? `${task.text} — Task done` : task.text;
      window.electronAPI.saveTasks(AppState.tasks);
      if (typeof window.renderTasks === 'function') window.renderTasks();
      window.refreshEventTaskList?.(eventId);
      window.queueWriteback?.(eventId);
      setTimeout(() => window.flushWritebacks?.(), 400);
    });

    const textEl = document.createElement('div');
    textEl.className = `detail-task-text${task.completed ? ' done' : ''}`;
    textEl.textContent = task.completed ? `${task.text} — Task done` : task.text;

    const unlink = document.createElement('button');
    unlink.className = 'detail-task-unlink';
    unlink.textContent = '×';
    unlink.title = 'Unlink from this event';
    unlink.addEventListener('click', () => {
      task.linkedBlocks = task.linkedBlocks.filter((id) => id !== eventId);
      window.electronAPI.saveTasks(AppState.tasks);
      if (typeof window.renderTasks === 'function') window.renderTasks();
      window.refreshEventTaskList?.(eventId);
      window.queueWriteback?.(eventId);
      setTimeout(() => window.flushWritebacks?.(), 400);
      renderDetailTaskList(eventId);
    });

    row.appendChild(check);
    row.appendChild(textEl);
    row.appendChild(unlink);
    list.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-close-detail').addEventListener('click', closeEventDetail);

  // Drag tasks directly onto the detail panel to link them
  const panel = document.getElementById('event-detail-panel');
  panel.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('text/task-id') || !_detailEventId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    panel.classList.add('drag-over');
  });
  panel.addEventListener('dragleave', (e) => {
    if (!panel.contains(e.relatedTarget)) panel.classList.remove('drag-over');
  });
  panel.addEventListener('drop', (e) => {
    panel.classList.remove('drag-over');
    if (!_detailEventId) return;
    const taskId = e.dataTransfer.getData('text/task-id');
    if (taskId) window.linkTaskToEvent(taskId, _detailEventId);
  });
});

/* ── demo events (shown when not connected) ──────────────────── */
function getDemoEvents() {
  const d = new Date();
  const base = (h, m) => {
    const dt = new Date(d);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  };
  return [
    { id: 'demo1', title: 'Morning standup', start: base(9, 0),  end: base(9, 30),  color: '#4285f4', allDay: false },
    { id: 'demo2', title: 'Design review',   start: base(11, 0), end: base(12, 0),  color: '#0b8043', allDay: false },
    { id: 'demo3', title: 'Lunch break',     start: base(12, 30),end: base(13, 30), color: '#f6bf26', allDay: false },
    { id: 'demo4', title: 'Focus work',      start: base(14, 0), end: base(16, 0),  color: '#8e24aa', allDay: false },
    { id: 'demo5', title: '1-on-1 with manager', start: base(16,0), end: base(16, 30), color: '#e67c73', allDay: false },
  ];
}
