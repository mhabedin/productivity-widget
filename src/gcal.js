const { google } = require('googleapis');

const GCAL_COLORS = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6bf26', '6': '#f4511e', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
};
const DEFAULT_COLOR = '#4285f4';

class GCalAPI {
  constructor() {
    this.cal = null;
  }

  setAuth(authClient) {
    this.cal = google.calendar({ version: 'v3', auth: authClient });
  }

  async getTodayEvents() {
    if (!this.cal) throw new Error('Not authenticated');

    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);

    const res = await this.cal.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (res.data.items || []).map((ev) => ({
      id: ev.id,
      title: ev.summary || '(No title)',
      start: ev.start.dateTime || ev.start.date,
      end: ev.end.dateTime || ev.end.date,
      description: ev.description || '',
      color: GCAL_COLORS[ev.colorId] || DEFAULT_COLOR,
      allDay: !ev.start.dateTime,
    }));
  }

  async writeTasksToEvent(eventId, tasks) {
    if (!this.cal) throw new Error('Not authenticated');

    const evRes = await this.cal.events.get({ calendarId: 'primary', eventId });
    const existing = evRes.data.description || '';

    const taskLines = tasks
      .map((t) => t.completed ? `${t.text} — Task done` : t.text)
      .join('\n');
    const block = taskLines;

    let newDesc;
    if (existing.includes('\n---\n')) {
      const pivot = existing.indexOf('\n---\n');
      newDesc = existing.slice(0, pivot) + '\n---\n' + block;
    } else if (existing.trim()) {
      newDesc = existing + '\n---\n' + block;
    } else {
      newDesc = block;
    }

    await this.cal.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: { description: newDesc },
    });
  }
}

module.exports = { GCalAPI };
