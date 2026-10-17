import { describe, it, expect, vi, afterEach } from 'vitest';
import { BackupWorkflow } from '../src/backup/workflow.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function makeStep() {
  const names = [];
  return {
    names,
    async do(name, options, fn) {
      names.push(name);
      return await fn();
    },
    async sleep(name) {
      names.push('sleep:' + name);
    }
  };
}

function makeBucket() {
  const puts = [];
  return {
    puts,
    async put(key, value, options) {
      puts.push({ key, value, options });
    }
  };
}

function makeEnv(bucket) {
  return {
    ACCOUNT_ID: 'acc-1',
    DATABASE_ID: 'db-1',
    D1_REST_API_TOKEN: 'secret-token',
    BACKUP_BUCKET: bucket
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BackupWorkflow', () => {
  it('mengekspor, menyimpan dump, dan menulis status sukses', async () => {
    const bucket = makeBucket();
    const dump = new TextEncoder().encode('CREATE TABLE t (id);');
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/export')) {
        const body = JSON.parse(init.body);
        if (body.output_format === 'polling') {
          return jsonResponse({ success: true, result: { at_bookmark: 'bookmark-1' } });
        }
        return jsonResponse({ success: true, result: { signed_url: 'https://r2.example/dump.sql' } });
      }
      return new Response(dump, { status: 200 });
    }));

    const step = makeStep();
    const manifest = await BackupWorkflow.prototype.run.call({ env: makeEnv(bucket) }, {}, step);

    expect(manifest.bookmark).toBe('bookmark-1');
    expect(manifest.bytes).toBe(dump.byteLength);
    expect(bucket.puts.map((p) => p.key)).toEqual([
      expect.stringMatching(/^d1\/.+\.sql$/),
      expect.stringMatching(/^d1\/.+\.json$/),
      'status/last-success.json'
    ]);
    expect(step.names[0]).toBe('start-export');
    expect(step.names).toContain('poll-export-0');
    expect(step.names).toContain('store-backup');
    expect(calls.filter((c) => c.url === 'https://r2.example/dump.sql')).toHaveLength(1);
  });

  it('menulis status gagal saat export tidak pernah siap', async () => {
    const bucket = makeBucket();
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.output_format === 'polling') {
        return jsonResponse({ success: true, result: { at_bookmark: 'bookmark-1' } });
      }
      return jsonResponse({ success: true, result: {} });
    }));
    await expect(
      BackupWorkflow.prototype.run.call({ env: makeEnv(bucket) }, {}, makeStep())
    ).rejects.toThrow('timeout');
    expect(bucket.puts.map((p) => p.key)).toContain('status/last-failure.json');
    const failure = JSON.parse(bucket.puts.find((p) => p.key === 'status/last-failure.json').value);
    expect(failure.message).toContain('timeout');
  });

  it('menulis status gagal saat API menolak export', async () => {
    const bucket = makeBucket();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      success: false,
      errors: [{ message: 'tidak diizinkan' }]
    }, 403)));
    await expect(
      BackupWorkflow.prototype.run.call({ env: makeEnv(bucket) }, {}, makeStep())
    ).rejects.toThrow('tidak diizinkan');
    expect(bucket.puts.map((p) => p.key)).toContain('status/last-failure.json');
  });
});
