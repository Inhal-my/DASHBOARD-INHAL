import { describe, it, expect } from 'vitest';
import { writeAuditLog, writeLogUpload } from '../src/audit.js';

const failingDb = {
  prepare() {
    throw new Error('db down');
  }
};

describe('audit logging', () => {
  it('rethrows when the audit insert fails', async () => {
    await expect(writeAuditLog(failingDb, { action: 'UPDATE' })).rejects.toThrow('db down');
  });

  it('rethrows when the upload log insert fails', async () => {
    await expect(writeLogUpload(failingDb, { idPengajuan: 'INHAL-1' })).rejects.toThrow('db down');
  });
});
