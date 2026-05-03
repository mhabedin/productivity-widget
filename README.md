# Productivity Widget

A lightweight Windows desktop widget built with Electron. It combines a live Google Calendar day view, a full-featured to-do list, and a focus timer — all in a compact, always-on-top panel you can drag anywhere on your screen.

---

## Quick Start

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Launch
npm start
```

Or double-click **"Productivity Widget"** on your Desktop.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+W` | Show / hide the widget |
| `Ctrl+Shift+T` | Quick-add a task from anywhere |

---

## Window Controls

| Control | Description |
|---|---|
| `⊟` button | Toggle compact mode (clock + task count only) |
| `📌` button | Toggle always-on-top |
| `─` button | Minimize to taskbar |
| Drag top bar | Move widget anywhere on screen |
| Right edge `│` | Resize width only |
| Bottom edge `─` | Resize height only |
| Bottom-right `⌟` | Resize both |

---

## Features

### To-Do List
- Add tasks via `+` button or `Ctrl+Shift+T`
- Priority tags: 🔴 high · 🟡 medium · 🟢 low (click the dot to cycle)
- Drag to reorder tasks
- Hover a task → click `×` to delete
- Collapsible subtasks
- Recurring tasks (daily / weekly)
- "Today only" filter
- Overdue badge counter
- Double-click task text to edit inline

### Calendar Panel
- Scrollable day view — auto-scrolls to the current time on launch
- Live red current-time line
- Events in the next 2 hours are highlighted
- Drag a task from the to-do list onto a calendar block to link them
- Drag a task onto empty calendar space to create a new local block
- Linked tasks show inside the event block with a progress count

### Focus Timer
- Click **▶ Focus** to start a session (25 / 45 / 60 min)
- Active session dims all non-related tasks
- Break nudge when session ends
- Daily session count tracked

---

## Google Calendar Setup (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → **APIs & Services** → **Library** → search **Google Calendar API** → click **Enable**
3. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID** (Desktop app type)
4. Download the credentials JSON and copy it to:
   ```
   config/credentials.json
   ```
   (use `config/credentials.example.json` as a template)
5. Click the **🔗** button in the calendar panel header and sign in
6. After sign-in the button turns ✅ and events load automatically

Google Calendar is **free** for personal use. No credit card required.

### What syncs
- Reads today's events with their colours
- When tasks are linked to a block and checked off, their status is written back to the event's description in Google Calendar every 90 seconds

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Demo blocks show instead of real events | Google Calendar API not enabled | In Cloud Console → APIs & Services → Library → enable **Google Calendar API** |
| Alert: "API has not been used in project…" | Same as above | Enable the Calendar API for your project |
| Alert: "Invalid grant" or "Token expired" | Auth token revoked or expired | Click ✅ → Disconnect, then reconnect with 🔗 |
| Calendar panel blank after connecting | No timed events today (all-day or empty day) | Normal — all-day events are not shown on the time grid |
| 🔗 button stays as ⏳ forever | OAuth callback server blocked | Check that nothing is blocking port 52741 |

Press **F12** inside the widget to open DevTools and check the Console for detailed error messages.

---

## Project Structure

```
ClaudeCodeTest/
├── main.js               # Electron main process (window, IPC, shortcuts)
├── preload.js            # Secure IPC bridge to renderer
├── src/
│   ├── auth.js           # Google OAuth2 flow
│   ├── gcal.js           # Google Calendar API calls
│   └── store.js          # Local JSON task storage
├── renderer/
│   ├── index.html
│   ├── css/main.css
│   └── js/
│       ├── app.js        # Entry point, resize, compact mode
│       ├── clock.js      # 12-hour live clock
│       ├── todo.js       # Full to-do list logic
│       ├── calendar.js   # Calendar rendering + sync queue
│       ├── focus-timer.js
│       └── drag-drop.js  # Task → calendar drag-and-drop
├── config/
│   ├── credentials.example.json
│   └── credentials.json  # ← you create this (git-ignored)
└── start-widget.vbs      # Silent launcher (used by desktop shortcut)
```

---

## Data Storage

Tasks are saved locally to:
```
%APPDATA%\productivity-widget\tasks.json
```

The app works fully offline. Google Calendar sync is attempted whenever a connection is available.

---

## Tech Stack

- [Electron](https://www.electronjs.org/) v28
- [googleapis](https://github.com/googleapis/google-api-nodejs-client) for Calendar API
- Vanilla HTML / CSS / JS — no UI framework
