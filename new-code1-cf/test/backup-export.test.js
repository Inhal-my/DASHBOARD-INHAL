import { describe, it, expect, vi } from 'vitest';
import {
  exportUrl,
  startExport,
  pollExport,
  saveBackup,
  writeFailure
} from '../src/backup/export.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const base = {
  accountId: 'acc-1',
  databaseId: 'db-1',
  token: 'secret-token'
};

describe('D1 backup export helper', () => {
  it('membangun URL export yang benar', () => {
    expect(exportUrl('acc-1', 'db-1')).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc-1/d1/database/db-1/export'
    );
  });

  it('memulai export dengan payload polling dan mengembalikan bookmark', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      success: true,
      result: { at_bookmark: 'bookmark-1', filename: 'dump.sql' }
    }));
    const result = await startExport({ ...base, fetchImpl });
    expect(result.at_bookmark).toBe('bookmark-1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(exportUrl(base.accountId, base.databaseId));
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(init.body)).toEqual({ output_format: 'polling' });
  });

  it('menolak start export tanpa at_bookmark', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, result: {} }));
    await expect(startExport({ ...base, fetchImpl })).rejects.toThrow('at_bookmark');
  });

  it('polling mengembalikan signed_url saat siap', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      success: true,
      result: { signed_url: 'https://r2.example/dump.sql', filename: 'dump.sql' }
    }));
    const result = await pollExport({ ...base, bookmark: 'bookmark-1', fetchImpl });
    expect(result.signed_url).toBe('https://r2.example/dump.sql');
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ current_bookmark: 'bookmark-1' });
  });

  it('memberi pesan jelas saat API gagal', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      success: false,
      errors: [{ message: 'D1 export tidak diizinkan' }]
    }, 403));
    await expect(startExport({ ...base, fetchImpl })).rejects.toThrow('D1 export tidak diizinkan');
  });

  it('menyimpan dump dan manifest dengan hash serta bookmark', async () => {
    const puts = [];
    const bucket = {
      async put(key, value, options) {
        puts.push({ key, value, options });
      }
    };
    const bytes = new TextEncoder().encode('CREATE TABLE t (id);');
    const manifest = await saveBackup(bucket, {
      bytes,
      bookmark: 'bookmark-1',
      startedAt: '2026-10-18T01:00:00.000Z',
      accountId: 'acc-1',
      databaseId: 'db-1'
    });

    expect(manifest.filename).toBe('d1/2026-10-18T01-00-00-000Z.sql');
    expect(manifest.bookmark).toBe('bookmark-1');
    expect(manifest.bytes).toBe(bytes.byteLength);
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(puts.map((p) => p.key)).toEqual([
      'd1/2026-10-18T01-00-00-000Z.sql',
      'd1/2026-10-18T01-00-00-000Z.json',
      'status/last-success.json'
    ]);
    const storedManifest = JSON.parse(puts[1].value);
    expect(storedManifest.bookmark).toBe('bookmark-1');
    expect(storedManifest.sha256).toBe(manifest.sha256);
  });

  it('mencatat status kegagalan tanpa melempar bila bucket tersedia', async () => {
    const puts = [];
    const bucket = { async put(key, value) { puts.push({ key, value }); } };
    await writeFailure(bucket, { message: 'export timeout', step: 'poll-export' });
    expect(puts).toHaveLength(1);
    expect(puts[0].key).toBe('status/last-failure.json');
    const body = JSON.parse(puts[0].value);
    expect(body.message).toBe('export timeout');
    expect(body.step).toBe('poll-export');
  });

  it('tidak melempar saat mencatat kegagalan tanpa binding R2', async () => {
    await expect(writeFailure(null, { message: 'gagal' })).resolves.toBeUndefined();
  });
});
