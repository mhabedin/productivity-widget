/* drag-drop.js — task → calendar drag-drop + empty-space drop */

const timeGrid = document.getElementById('time-grid');

/* ── visual cue while dragging over the calendar ─────────────── */
timeGrid.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer.types.includes('text/task-id')) return;
  timeGrid.classList.add('drag-active');
});

timeGrid.addEventListener('dragleave', (e) => {
  if (!timeGrid.contains(e.relatedTarget)) {
    timeGrid.classList.remove('drag-active');
  }
});

timeGrid.addEventListener('dragend', () => {
  timeGrid.classList.remove('drag-active');
});

/* ── drop on empty space → offer to create calendar block ────── */
timeGrid.addEventListener('dragover', (e) => {
  if (!e.dataTransfer.types.includes('text/task-id')) return;
  // Only allow default if not over a .cal-event child
  if (!e.target.closest('.cal-event')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
  }
});

timeGrid.addEventListener('drop', (e) => {
  if (e.target.closest('.cal-event')) return; // handled by event block itself
  if (!e.dataTransfer.types.includes('text/task-id')) return;
  e.preventDefault();
  timeGrid.classList.remove('drag-active');

  const taskId = e.dataTransfer.getData('text/task-id');
  const task   = AppState.tasks.find((t) => t.id === taskId);
  if (!task) return;

  // Calculate the time at the drop position
  const rect = timeGrid.getBoundingClientRect();
  const offsetY = e.clientY - rect.top + timeGrid.closest('#calendar-scroll').scrollTop;
  const minutes = Math.round(offsetY);
  const hour    = Math.floor(minutes / 60);
  const min     = Math.round((minutes % 60) / 15) * 15; // snap to 15-min
  const hLabel  = hour % 12 || 12;
  const ampm    = hour < 12 ? 'am' : 'pm';
  const timeStr = `${hLabel}:${String(min).padStart(2,'0')}${ampm}`;

  openNewEventModal(task, timeStr);
});

/* ── new-event modal ──────────────────────────────────────────── */
let pendingNewEvent = null; // { task, timeStr }

function openNewEventModal(task, timeStr) {
  pendingNewEvent = { task, timeStr };
  document.getElementById('new-event-desc').textContent =
    `Drop "${task.text}" at ~${timeStr} — create a calendar block?`;
  document.getElementById('new-event-title').value = task.text;
  document.getElementById('new-event-modal').classList.remove('hidden');
  document.getElementById('new-event-title').focus();
}

document.getElementById('btn-cancel-event').addEventListener('click', () => {
  document.getElementById('new-event-modal').classList.add('hidden');
  pendingNewEvent = null;
});

document.getElementById('btn-create-event').addEventListener('click', () => {
  document.getElementById('new-event-modal').classList.add('hidden');
  if (!pendingNewEvent) return;

  // We can't create GCal events without the full API (needs write scope already included).
  // For now, create a local placeholder event and link the task to it.
  const { task, timeStr } = pendingNewEvent;
  pendingNewEvent = null;

  const title = document.getElementById('new-event-title').value.trim() || task.text;
  createLocalEvent(task, title);
});

function createLocalEvent(task, title) {
  const now = new Date();
  const start = new Date(now); start.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
  const end   = new Date(start); end.setMinutes(end.getMinutes() + 60);

  const localEvent = {
    id: 'local-' + Date.now().toString(36),
    title,
    start: start.toISOString(),
    end:   end.toISOString(),
    color: '#5c7cfa',
    allDay: false,
    local: true,
  };

  AppState.calendarEvents.push(localEvent);
  window.renderCalendar(AppState.calendarEvents);
  window.linkTaskToEvent(task.id, localEvent.id);
}
