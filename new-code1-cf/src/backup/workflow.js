import { WorkflowEntrypoint } from 'cloudflare:workers';
import { startExport, pollExport, saveBackup, writeFailure } from './export.js';

const POLL_ATTEMPTS = 30;
const POLL_DELAY = '10 seconds';

export class BackupWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const env = this.env;
    const startedAt = new Date().toISOString();
    const config = {
      accountId: env.ACCOUNT_ID,
      databaseId: env.DATABASE_ID,
      token: env.D1_REST_API_TOKEN
    };

    try {
      const start = await step.do('start-export', {
        retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' },
        timeout: '1 minute'
      }, async () => startExport(config));

      let ready = null;
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        const polled = await step.do('poll-export-' + i, {
          retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
          timeout: '1 minute'
        }, async () => pollExport({ ...config, bookmark: start.at_bookmark }));
        if (polled && polled.signed_url) {
          ready = polled;
          break;
        }
        await step.sleep('wait-export-' + i, POLL_DELAY);
      }
      if (!ready) {
        throw new Error('D1 export timeout setelah ' + POLL_ATTEMPTS + ' percobaan.');
      }

      return await step.do('store-backup', {
        retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
        timeout: '5 minutes'
      }, async () => {
        const res = await fetch(ready.signed_url);
        if (!res.ok) throw new Error('Unduh dump gagal: HTTP ' + res.status);
        const bytes = await res.arrayBuffer();
        return saveBackup(env.BACKUP_BUCKET, {
          bytes,
          bookmark: start.at_bookmark,
          startedAt,
          databaseId: env.DATABASE_ID
        });
      });
    } catch (err) {
      await step.do('record-failure', {
        retries: { limit: 2, delay: '5 seconds' },
        timeout: '30 seconds'
      }, async () => writeFailure(env.BACKUP_BUCKET, {
        step: 'backup',
        message: String((err && err.message) || err)
      })).catch(() => {});
      throw err;
    }
  }
}
