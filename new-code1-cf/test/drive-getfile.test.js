import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDriveFileBase64 } from '../src/drive.js';

afterEach(() => { vi.unstubAllGlobals(); });
const env = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };

describe('getDriveFileBase64', () => {
  it('mengembalikan base64 dari bridge', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ success: true, base64: 'AAAA', mimeType: 'image/jpeg' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const res = await getDriveFileBase64(env, 'FILEID1234567890ABCDEFG');
    expect(res.ok).toBe(true);
    expect(res.base64).toBe('AAAA');
    expect(res.mime).toBe('image/jpeg');
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.action).toBe('getFile');
    expect(body.fileId).toBe('FILEID1234567890ABCDEFG');
  });

  it('gagal ramah saat bridge tidak dikonfigurasi', async () => {
    const res = await getDriveFileBase64({}, 'FILEID1234567890ABCDEFG');
    expect(res.ok).toBe(false);
  });

  it('gagal bila fileId kosong', async () => {
    const res = await getDriveFileBase64(env, '');
    expect(res.ok).toBe(false);
  });
});
