'use strict';

const { createApp } = require('./app');
const { TaskStore } = require('./store');

const PORT = Number(process.env.PORT) || 3000;
// Set DATA_FILE (for example /data/tasks.json) to keep tasks across restarts.
const store = new TaskStore({ file: process.env.DATA_FILE || null });
const server = createApp({ store });

server.listen(PORT, () => {
  console.log(`Dockside listening on port ${PORT}`);
});

// Docker sends SIGTERM on "docker stop". Close quickly instead of waiting to be killed.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
