'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TaskStore, ValidationError } = require('../src/store');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dockside-'));
  return path.join(dir, 'tasks.json');
}

test('create() adds a trimmed task with defaults', () => {
  const store = new TaskStore();
  const task = store.create({ title: '  Ship it  ' });
  assert.equal(task.id, 1);
  assert.equal(task.title, 'Ship it');
  assert.equal(task.done, false);
});

test('create() rejects empty and overly long titles', () => {
  const store = new TaskStore();
  assert.throws(() => store.create({ title: '   ' }), ValidationError);
  assert.throws(() => store.create({}), ValidationError);
  assert.throws(() => store.create({ title: 'x'.repeat(201) }), ValidationError);
});

test('update() changes title and done', () => {
  const store = new TaskStore();
  const { id } = store.create({ title: 'Draft' });
  const updated = store.update(id, { title: 'Final', done: true });
  assert.equal(updated.title, 'Final');
  assert.equal(updated.done, true);
});

test('update() rejects a non-boolean done value', () => {
  const store = new TaskStore();
  const { id } = store.create({ title: 'Task' });
  assert.throws(() => store.update(id, { done: 'yes' }), ValidationError);
});

test('update() and delete() handle unknown ids', () => {
  const store = new TaskStore();
  assert.equal(store.update(99, { done: true }), null);
  assert.equal(store.delete(99), false);
});

test('tasks are saved to disk and reloaded by a new store', () => {
  const file = tempFile();
  const first = new TaskStore({ file });
  first.create({ title: 'Survives a redeploy' });
  const second = first.create({ title: 'Also survives' });
  first.update(second.id, { done: true });

  const reloaded = new TaskStore({ file });
  assert.equal(reloaded.list().length, 2);
  assert.equal(reloaded.get(second.id).done, true);
  assert.equal(reloaded.create({ title: 'New one' }).id, 3);
});

test('a missing data file starts an empty store', () => {
  const store = new TaskStore({ file: tempFile() });
  assert.equal(store.list().length, 0);
});
