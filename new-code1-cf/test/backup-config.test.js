import { describe, it, expect } from 'vitest';
import wrangler from '../wrangler.toml?raw';
import wranglerProduction from '../wrangler.production.toml?raw';
import indexSource from '../src/index.js?raw';
import backupSnapshot from '../scripts/backup-snapshot.mjs?raw';
import backupReport from '../scripts/backup-report.mjs?raw';

describe('konfigurasi backup', () => {
  it('tidak lagi memakai Cloudflare Workflow maupun binding R2', () => {
    const configs = [['wrangler.toml', wrangler], ['wrangler.production.toml', wranglerProduction]];
    for (const [label, config] of configs) {
      expect(config, label).not.toContain('[[workflows]]');
      expect(config, label).not.toContain('BACKUP_WORKFLOW');
      expect(config, label).not.toContain('[[r2_buckets]]');
      expect(config, label).not.toContain('BACKUP_BUCKET');
    }
  });

  it('menunjuk backup harian ke workflow GitHub Actions', () => {
    for (const config of [wrangler, wranglerProduction]) {
      expect(config).toContain('.github/workflows/backup-d1.yml');
    }
  });

  it('menyediakan skrip snapshot dan ringkasan backup', () => {
    expect(backupSnapshot).toContain('manifest.json');
    expect(backupReport).toContain('backup-report');
  });

  it('mengekspor kelas BackupWorkflow dari entry Worker', () => {
    expect(indexSource).toContain('BackupWorkflow');
    expect(indexSource).toContain('./backup/workflow.js');
  });

  it('tidak menyimpan token API di konfigurasi', () => {
    for (const config of [wrangler, wranglerProduction]) {
      expect(config).not.toContain('D1_REST_API_TOKEN');
      expect(config).not.toContain('Bearer ');
    }
  });
});
