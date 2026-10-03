(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const els = {
    form: $('#add-form'),
    title: $('#title'),
    formError: $('#form-error'),
    list: $('#task-list'),
    empty: $('#empty'),
    summary: $('#summary'),
    filters: document.querySelectorAll('[data-filter]'),
    health: $('#health'),
    stamp: $('#stamp'),
    build: $('#build'),
    commit: $('#commit'),
    built: $('#built'),
    uptime: $('#uptime'),
    runtime: $('#runtime'),
  };

  const state = { tasks: [], filter: 'open' };

  const EMPTY_MESSAGES = {
    open: 'Nothing on deck. Add a task above.',
    done: 'No finished tasks yet.',
    all: 'No tasks yet. Add your first one above.',
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong. Try again.');
    }
    return data;
  }

  function showError(message) {
    els.formError.textContent = message;
    els.formError.hidden = !message;
  }

  function timeAgo(iso) {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
  }

  function duration(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0) return `${days} d ${hours} h`;
    if (hours > 0) return `${hours} h ${minutes} min`;
    if (minutes > 0) return `${minutes} min`;
    return `${totalSeconds} s`;
  }

  function visibleTasks() {
    const newestFirst = [...state.tasks].reverse();
    if (state.filter === 'open') return newestFirst.filter((task) => !task.done);
    if (state.filter === 'done') return newestFirst.filter((task) => task.done);
    return newestFirst;
  }

  function buildRow(task) {
    const item = document.createElement('li');
    item.className = task.done ? 'task is-done' : 'task';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'check';
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', String(task.done));
    check.setAttribute('aria-label', `Mark done: ${task.title}`);
    check.addEventListener('click', () => toggle(task));

    const title = document.createElement('div');
    title.className = 'title';
    const text = document.createElement('span');
    text.className = 'title-text';
    text.textContent = task.title;
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = `Added ${timeAgo(task.createdAt)}`;
    title.append(text, when);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove task: ${task.title}`);
    remove.addEventListener('click', () => removeTask(task));

    item.append(check, title, remove);
    return item;
  }

  function render() {
    const open = state.tasks.filter((task) => !task.done).length;
    const done = state.tasks.length - open;
    els.summary.textContent = state.tasks.length ? `${open} open, ${done} done` : '';

    const rows = visibleTasks();
    els.list.replaceChildren(...rows.map(buildRow));
    els.empty.hidden = rows.length > 0;
    els.empty.textContent = EMPTY_MESSAGES[state.filter];

    els.filters.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
    });
  }

  async function loadTasks() {
    try {
      state.tasks = await api('/api/tasks');
      render();
    } catch (err) {
      showError('Could not load tasks. Check your connection and refresh the page.');
    }
  }

  async function addTask(event) {
    event.preventDefault();
    showError('');
    const title = els.title.value.trim();
    if (!title) {
      showError('Enter a task title first.');
      return;
    }
    try {
      const task = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
      state.tasks.push(task);
      els.title.value = '';
      if (state.filter === 'done') state.filter = 'open';
      render();
    } catch (err) {
      showError(err.message);
    }
  }

  async function toggle(task) {
    try {
      const updated = await api(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ done: !task.done }),
      });
      Object.assign(task, updated);
      render();
    } catch (err) {
      showError(err.message);
    }
  }

  async function removeTask(task) {
    try {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      render();
    } catch (err) {
      showError(err.message);
    }
  }

  async function refreshHealth() {
    try {
      await api('/health');
      els.health.textContent = 'Server healthy';
      els.health.dataset.state = 'up';
    } catch (err) {
      els.health.textContent = 'Server unreachable';
      els.health.dataset.state = 'down';
    }
  }

  async function refreshVersion() {
    try {
      const info = await api('/api/version');
      const isLocal = info.build === 'local';
      els.build.textContent = isLocal ? 'local' : `#${info.build}`;
      els.commit.textContent = info.commit;
      els.built.textContent = info.builtAt
        ? new Date(info.builtAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'not built in CI';
      els.uptime.textContent = duration(info.uptimeSeconds);
      els.runtime.textContent = `Node ${info.node.replace(/^v/, '')}`;
    } catch (err) {
      els.build.textContent = '?';
    }
  }

  els.form.addEventListener('submit', addTask);
  els.filters.forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      render();
    });
  });

  loadTasks();
  refreshHealth();
  refreshVersion();
  setInterval(() => {
    refreshHealth();
    refreshVersion();
  }, 30000);
})();
