import { buildApp } from './app.js';
import { config } from './config/index.js';
import { createWorkers, WorkerManager } from './workers/index.js';

async function main() {
  const app = await buildApp();

  let workers: WorkerManager | null = null;

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`Server running at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Start background workers (decision dispatcher + archiver)
  try {
    workers = await createWorkers();
    await workers.start();
  } catch (err) {
    app.log.error(err, 'Failed to start background workers');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);

    if (workers) {
      try {
        await workers.stop();
      } catch (err) {
        app.log.error(err, 'Error stopping workers');
      }
    }

    try {
      await app.close();
      console.log('[Shutdown] Server closed');
    } catch (err) {
      app.log.error(err, 'Error closing server');
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
