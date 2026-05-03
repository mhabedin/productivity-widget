const fs = require('fs');
const path = require('path');

class TaskStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'tasks.json');
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch (e) {
      console.error('TaskStore: failed to load', e);
    }
    return [];
  }

  save(tasks) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (e) {
      console.error('TaskStore: failed to save', e);
    }
  }
}

module.exports = TaskStore;
