const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-disk-cache');
app.commandLine.appendSwitch('no-first-run');

const TaskStore = require('./src/store');
const { GCalAuth } = require('./src/auth');
const { GCalAPI } = require('./src/gcal');

const WINDOW_WIDTH  = 520;
const WINDOW_HEIGHT = 380;
const COMPACT_HEIGHT = 50;

let mainWindow;
let taskStore;
let gcalAuth;
let gcalAPI;

function getStartPos() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: width  - WINDOW_WIDTH  - 10,
    y: Math.floor((height - WINDOW_HEIGHT) / 2),
  };
}

function createWindow() {
  const { x, y } = getStartPos();

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x, y,
    frame: false,
    transparent: false,
    backgroundColor: '#0e0e16',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    maximizable: false,
    minWidth: 180,
    minHeight: 150,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// ─── IPC: Window ─────────────────────────────────────────────

ipcMain.on('set-ignore-mouse-events', (_e, ignore, opts) => {
  mainWindow?.setIgnoreMouseEvents(ignore, opts ?? {});
});

ipcMain.on('toggle-compact', (_e, compact) => {
  const [x, y] = mainWindow.getPosition();
  mainWindow?.setResizable(!compact);
  mainWindow?.setSize(WINDOW_WIDTH, compact ? COMPACT_HEIGHT : WINDOW_HEIGHT);
  mainWindow?.setPosition(x, y);
});

ipcMain.on('resize-window', (_e, w, h) => {
  mainWindow?.setSize(
    Math.max(180, Math.round(w)),
    Math.max(150, Math.round(h))
  );
});

ipcMain.on('toggle-always-on-top', (_e, enabled) => {
  mainWindow?.setAlwaysOnTop(!!enabled, 'floating');
});

ipcMain.on('minimize-window', () => mainWindow?.minimize());

// ─── IPC: Tasks ──────────────────────────────────────────────

ipcMain.handle('tasks:get',  ()          => taskStore.load());
ipcMain.handle('tasks:save', (_e, tasks) => { taskStore.save(tasks); return true; });

// ─── IPC: Google Calendar ────────────────────────────────────

ipcMain.handle('gcal:is-authenticated', () => gcalAuth.isAuthenticated());

ipcMain.handle('gcal:authenticate', async () => {
  try {
    await gcalAuth.authenticate();
    gcalAPI.setAuth(gcalAuth.getClient());
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('gcal:revoke', () => { gcalAuth.revoke(); return true; });

ipcMain.handle('gcal:get-events', async () => {
  const authed = gcalAuth.isAuthenticated();
  console.log(`gcal:get-events — isAuthenticated=${authed}`);
  if (!authed) return { events: [], error: 'Not authenticated — click 🔗 to connect Google Calendar' };
  try {
    const events = await gcalAPI.getTodayEvents();
    console.log(`gcal:get-events — OK, ${events.length} event(s)`);
    return { events };
  } catch (err) {
    console.error('gcal:get-events ERROR:', err.message);
    return { events: [], error: err.message };
  }
});

ipcMain.handle('gcal:writeback', async (_e, { eventId, tasks }) => {
  if (!gcalAuth.isAuthenticated()) return { success: false };
  try   { await gcalAPI.writeTasksToEvent(eventId, tasks); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

// ─── App lifecycle ───────────────────────────────────────────

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  taskStore = new TaskStore(userData);
  gcalAuth  = new GCalAuth(userData);
  gcalAPI   = new GCalAPI();

  if (gcalAuth.isAuthenticated()) gcalAPI.setAuth(gcalAuth.getClient());

  createWindow();

  // Ctrl+Shift+W — show / hide widget
  globalShortcut.register('CommandOrControl+Shift+W', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Ctrl+Shift+T — quick-add task
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('hotkey:quick-add');
  });
});

app.on('will-quit',         () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
