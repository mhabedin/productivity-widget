/* todo.js — full to-do list implementation */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;
  return task.dueDate < today();
}

function saveTasks() {
  window.electronAPI.saveTasks(AppState.tasks);
  window.updateCompactDisplay?.();
}

/* ── public: add task ────────────────────────────────────────── */
window.addTask = function (text, priority = 'medium', dueDate = today()) {
  const task = {
    id: genId(),
    text,
    completed: false,
    priority,
    dueDate,
    recurring: null,
    subtasks: [],
    linkedBlocks: [],
    order: AppState.tasks.length,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  AppState.tasks.push(task);
  saveTasks();
  renderTasks();
};

/* ── public: render task list ────────────────────────────────── */
window.renderTasks = function () {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';

  const showToday = AppState.todayFilter;
  const t = today();

  let visible = [...AppState.tasks].sort((a, b) => a.order - b.order);
  if (showToday) visible = visible.filter((task) => task.dueDate === t || !task.dueDate);

  visible.forEach((task) => list.appendChild(buildTaskEl(task)));

  // Overdue badge
  const overdueCount = AppState.tasks.filter(isOverdue).length;
  const badge = document.getElementById('overdue-badge');
  badge.textContent = overdueCount;
  badge.classList.toggle('hidden', overdueCount === 0);
};

/* ── build a single task DOM element ─────────────────────────── */
function buildTaskEl(task) {
  const item = document.createElement('div');
  item.className = `task-item${task.completed ? ' done' : ''}`;
  item.dataset.id = task.id;
  item.draggable = true;

  // Priority dot
  const dot = document.createElement('span');
  dot.className = 'priority-dot';
  dot.dataset.p = task.priority;
  dot.title = 'Click to cycle priority';
  dot.addEventListener('click', () => cyclePriority(task.id));

  // Checkbox
  const check = document.createElement('div');
  check.className = `task-check${task.completed ? ' checked' : ''}`;
  check.addEventListener('click', () => toggleTask(task.id, check));

  // Body
  const body = document.createElement('div');
  body.className = 'task-body';

  const textEl = document.createElement('div');
  textEl.className = 'task-text';
  textEl.textContent = task.text;
  textEl.title = 'Double-click to edit';
  textEl.addEventListener('dblclick', () => inlineEdit(task.id, textEl));

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  if (isOverdue(task)) {
    const t = document.createElement('span');
    t.className = 'task-tag overdue'; t.textContent = 'Overdue';
    meta.appendChild(t);
  }
  if (task.recurring) {
    const t = document.createElement('span');
    t.className = 'task-tag recurring'; t.textContent = `🔁 ${task.recurring}`;
    meta.appendChild(t);
  }
  if (task.linkedBlocks?.length) {
    const t = document.createElement('span');
    t.className = 'task-tag linked'; t.textContent = `🗓 ${task.linkedBlocks.length}`;
    meta.appendChild(t);
  }

  body.appendChild(textEl);
  body.appendChild(meta);

  // Subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    const toggle = document.createElement('button');
    toggle.className = 'subtask-toggle';
    const doneCount = task.subtasks.filter((s) => s.completed).length;
    toggle.textContent = `▾ ${doneCount}/${task.subtasks.length} subtasks`;

    const subList = document.createElement('div');
    subList.className = 'subtask-list';

    task.subtasks.forEach((sub) => {
      const si = document.createElement('div');
      si.className = `subtask-item${sub.completed ? ' done' : ''}`;

      const sc = document.createElement('div');
      sc.className = `subtask-check${sub.completed ? ' checked' : ''}`;
      sc.addEventListener('click', () => toggleSubtask(task.id, sub.id, sc, si));

      const st = document.createElement('span');
      st.className = 'subtask-text';
      st.textContent = sub.text;

      si.appendChild(sc);
      si.appendChild(st);
      subList.appendChild(si);
    });

    let expanded = true;
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      subList.style.display = expanded ? '' : 'none';
      toggle.textContent = `${expanded ? '▾' : '▸'} ${doneCount}/${task.subtasks.length} subtasks`;
    });

    body.appendChild(toggle);
    body.appendChild(subList);
  }

  // Drag handle
  const dh = document.createElement('span');
  dh.className = 'task-drag-handle';
  dh.textContent = '⣿';
  dh.title = 'Drag to reorder';

  // Delete button
  const del = document.createElement('button');
  del.className = 'task-delete-btn';
  del.textContent = '×';
  del.title = 'Delete task';
  del.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });

  item.appendChild(dot);
  item.appendChild(check);
  item.appendChild(body);
  item.appendChild(dh);
  item.appendChild(del);

  attachTaskDragHandlers(item, task);
  return item;
}

/* ── toggle completion ───────────────────────────────────────── */
function toggleTask(id, checkEl) {
  const task = AppState.tasks.find((t) => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  checkEl.classList.toggle('checked', task.completed);
  checkEl.classList.add('pop');
  checkEl.addEventListener('animationend', () => checkEl.classList.remove('pop'), { once: true });

  saveTasks();
  renderTasks();

  // Recurring: re-create task for next occurrence
  if (task.completed && task.recurring) {
    scheduleRecurring(task);
  }

  // Queue writeback for all linked calendar events
  task.linkedBlocks?.forEach((evId) => window.queueWriteback?.(evId));
}

/* ── toggle subtask ──────────────────────────────────────────── */
function toggleSubtask(taskId, subId, checkEl, itemEl) {
  const task = AppState.tasks.find((t) => t.id === taskId);
  const sub = task?.subtasks.find((s) => s.id === subId);
  if (!sub) return;

  sub.completed = !sub.completed;
  checkEl.classList.toggle('checked', sub.completed);
  itemEl.classList.toggle('done', sub.completed);

  saveTasks();
  // Refresh progress in linked calendar events
  task.linkedBlocks?.forEach((evId) => {
    window.refreshEventTaskList?.(evId);
    window.queueWriteback?.(evId);
  });
}

/* ── delete task ─────────────────────────────────────────────── */
function deleteTask(id) {
  AppState.tasks = AppState.tasks.filter((t) => t.id !== id);
  AppState.tasks.forEach((t, i) => { t.order = i; });
  saveTasks();
  renderTasks();
}

/* ── cycle priority ──────────────────────────────────────────── */
function cyclePriority(id) {
  const order = ['high', 'medium', 'low'];
  const task = AppState.tasks.find((t) => t.id === id);
  if (!task) return;
  const idx = order.indexOf(task.priority);
  task.priority = order[(idx + 1) % order.length];
  saveTasks();
  renderTasks();
}

/* ── inline edit ─────────────────────────────────────────────── */
function inlineEdit(id, el) {
  const task = AppState.tasks.find((t) => t.id === id);
  if (!task) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.text;
  input.style.cssText = 'width:100%;background:var(--surface2);border:1px solid var(--accent);border-radius:4px;color:var(--text);font-size:13px;padding:2px 5px;outline:none;';

  const commit = () => {
    const v = input.value.trim();
    if (v) { task.text = v; saveTasks(); }
    renderTasks();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') renderTasks();
    e.stopPropagation();
  });
  input.addEventListener('blur', commit);

  el.replaceWith(input);
  input.select();
}

/* ── recurring task scheduling ───────────────────────────────── */
function scheduleRecurring(task) {
  const next = { ...task, id: genId(), completed: false, completedAt: null, createdAt: new Date().toISOString() };
  const d = new Date(task.dueDate || today());
  if (task.recurring === 'daily')  d.setDate(d.getDate() + 1);
  if (task.recurring === 'weekly') d.setDate(d.getDate() + 7);
  next.dueDate = d.toISOString().slice(0, 10);
  next.order = AppState.tasks.length;
  AppState.tasks.push(next);
  saveTasks();
}

/* ── drag-to-reorder within todo list ────────────────────────── */
let dragSrcId = null;

function attachTaskDragHandlers(item, task) {
  item.addEventListener('dragstart', (e) => {
    dragSrcId = task.id;
    item.classList.add('dragging');
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.effectAllowed = 'all';
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach((el) => {
      el.classList.remove('drag-above', 'drag-below');
    });
    dragSrcId = null;
  });

  item.addEventListener('dragover', (e) => {
    // Only handle reorder when source is also a task item (not from calendar drag)
    if (!dragSrcId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    document.querySelectorAll('.task-item').forEach((el) => el.classList.remove('drag-above', 'drag-below'));
    if (e.clientY < midY) {
      item.classList.add('drag-above');
    } else {
      item.classList.add('drag-below');
    }
  });

  item.addEventListener('drop', (e) => {
    if (!dragSrcId || dragSrcId === task.id) return;
    e.preventDefault();
    e.stopPropagation();

    const srcTask = AppState.tasks.find((t) => t.id === dragSrcId);
    const tgtTask = task;
    if (!srcTask) return;

    const rect = item.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;

    // Remove src from array
    AppState.tasks.splice(AppState.tasks.indexOf(srcTask), 1);
    const tgtIdx = AppState.tasks.indexOf(tgtTask);
    AppState.tasks.splice(insertBefore ? tgtIdx : tgtIdx + 1, 0, srcTask);

    // Re-number order
    AppState.tasks.forEach((t, i) => { t.order = i; });
    saveTasks();
    renderTasks();
  });
}

/* ── public: add subtask ─────────────────────────────────────── */
window.addSubtask = function (taskId, text) {
  const task = AppState.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.subtasks.push({ id: genId(), text, completed: false });
  saveTasks();
  renderTasks();
};

// renderTasks is called by app.js after AppState.tasks is populated
