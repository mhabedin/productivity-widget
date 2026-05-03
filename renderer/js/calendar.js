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
  linked.forEach((task) => {
    const el = document.createElement('div');
    el.className = `cal-linked-task${task.completed ? ' done' : ''}`;
    el.textContent = `${task.completed ? '✅' : '⬜'} ${task.text}`;
    container.appendChild(el);
  });

  // Progress
  if (linked.length > 0) {
    const block = document.querySelector(`.cal-event[data-event-id="${eventId}"]`);
    const done  = linked.filter((t) => t.completed).length;
    let prog = block?.querySelector('.cal-progress');
    if (!prog) {
      prog = document.createElement('div');
      prog.className = 'cal-progress';
      block?.appendChild(prog);
    }
    prog.textContent = `${done}/${linked.length} tasks`;
  }
};

/* ── link a task to a calendar event ─────────────────────────── */
window.linkTaskToEvent = function (taskId, eventId) {
  const task = AppState.tasks.find((t) => t.id === taskId);
  const ev   = AppState.calendarEvents.find((e) => e.id === eventId);
  if (!task || !ev) return;

  if (!task.linkedBlocks.includes(eventId)) {
    task.linkedBlocks.push(eventId);
  }

  window.electronAPI.saveTasks(AppState.tasks);
  renderTasks();
  refreshEventTaskList(eventId);
  window.queueWriteback?.(eventId);
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
    setCalStatus(`Could not load events:\n${result.error}`, true);
    return;
  }

  const events = result.events || [];

  if (events.length === 0) {
    setCalStatus('No events found for today.');
    renderCalendar([]);
  } else {
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
