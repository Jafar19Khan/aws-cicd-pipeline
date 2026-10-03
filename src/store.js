'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_TITLE_LENGTH = 200;

/** Error thrown when task input fails validation. */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validateTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new ValidationError('"title" must be a non-empty string');
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`"title" must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return title.trim();
}

/**
 * Task store. Keeps tasks in memory and, when a file path is given,
 * saves them to disk so they survive container restarts and redeploys.
 */
class TaskStore {
  constructor({ file = null } = {}) {
    this.file = file;
    this.tasks = new Map();
    this.nextId = 1;
    if (this.file) {
      this.load();
    }
  }

  load() {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') {
        return;
      }
      throw err;
    }
    for (const task of raw.tasks || []) {
      this.tasks.set(task.id, task);
    }
    const highestId = Math.max(0, ...this.tasks.keys());
    this.nextId = Math.max(raw.nextId || 1, highestId + 1);
  }

  save() {
    if (!this.file) {
      return;
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ nextId: this.nextId, tasks: this.list() }));
    fs.renameSync(tmp, this.file);
  }

  list() {
    return Array.from(this.tasks.values());
  }

  get(id) {
    return this.tasks.get(id) || null;
  }

  create(input = {}) {
    const task = {
      id: this.nextId++,
      title: validateTitle(input.title),
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    this.save();
    return task;
  }

  update(id, changes = {}) {
    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }
    if ('title' in changes) {
      task.title = validateTitle(changes.title);
    }
    if ('done' in changes) {
      if (typeof changes.done !== 'boolean') {
        throw new ValidationError('"done" must be a boolean');
      }
      task.done = changes.done;
    }
    this.save();
    return task;
  }

  delete(id) {
    const removed = this.tasks.delete(id);
    if (removed) {
      this.save();
    }
    return removed;
  }
}

module.exports = { TaskStore, ValidationError, MAX_TITLE_LENGTH };
