import { describe, it, expect } from 'vitest';
import wrangler from '../wrangler.toml?raw';
import indexSource from '../src/index.js?raw';

describe('konfigurasi backup', () => {
  it('mendaftarkan Workflow harian dan binding R2', () => {
    expect(wrangler).toContain('[[workflows]]');
    expect(wrangler).toContain('binding = "BACKUP_WORKFLOW"');
    expect(wrangler).toContain('class_name = "BackupWorkflow"');
    expect(wrangler).toContain('schedules = ["0 1 * * *"]');
    expect(wrangler).toContain('[[r2_buckets]]');
    expect(wrangler).toContain('binding = "BACKUP_BUCKET"');
    expect(wrangler).toContain('bucket_name = "inhal-poc-backups"');
  });

  it('mengekspor kelas BackupWorkflow dari entry Worker', () => {
    expect(indexSource).toContain('BackupWorkflow');
    expect(indexSource).toContain('./backup/workflow.js');
  });

  it('tidak menyimpan token API di konfigurasi', () => {
    expect(wrangler).not.toContain('D1_REST_API_TOKEN');
    expect(wrangler).not.toContain('Bearer ');
  });
});
