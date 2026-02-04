import { config } from '../config/index.js';
import { DecisionDispatcher } from './decision-dispatcher.js';
import { ArchiverWorker } from './archiver.js';

export interface WorkerManager {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export async function createWorkers(): Promise<WorkerManager> {
  const connectionString = config.DATABASE_URL;

  const dispatcher = new DecisionDispatcher(connectionString);
  const archiver = new ArchiverWorker(connectionString);

  return {
    async start() {
      await Promise.all([
        dispatcher.start(),
        archiver.start(),
      ]);
      console.log('[Workers] All workers started');
    },

    async stop() {
      await Promise.all([
        dispatcher.stop(),
        archiver.stop(),
      ]);
      console.log('[Workers] All workers stopped');
    },
  };
}

// Export individual workers for testing
export { DecisionDispatcher } from './decision-dispatcher.js';
export { ArchiverWorker } from './archiver.js';
