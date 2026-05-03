const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Mouse / window
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  toggleCompact: (compact) => ipcRenderer.send('toggle-compact', compact),
  toggleAlwaysOnTop: (enabled) => ipcRenderer.send('toggle-always-on-top', enabled),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', w, h),

  // Tasks
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  saveTasks: (tasks) => ipcRenderer.invoke('tasks:save', tasks),

  // Google Calendar
  gcalIsAuthenticated: () => ipcRenderer.invoke('gcal:is-authenticated'),
  gcalAuthenticate: () => ipcRenderer.invoke('gcal:authenticate'),
  gcalRevoke: () => ipcRenderer.invoke('gcal:revoke'),
  gcalGetEvents: () => ipcRenderer.invoke('gcal:get-events'),
  gcalWriteback: (data) => ipcRenderer.invoke('gcal:writeback', data),

  // Main → Renderer events
  onHotkeyQuickAdd: (cb) => ipcRenderer.on('hotkey:quick-add', cb),
});
