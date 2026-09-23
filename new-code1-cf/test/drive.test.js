import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateBaFile, parseDriveFileId, saveDriveFile, trashDriveFile
} from '../src/drive.js';

afterEach(() => { vi.unstubAllGlobals(); });

const env = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
const pdf = { data: btoa('hello world'), mimeType: 'application/pdf', name: 'ba.pdf' };
const driveUrl = 'https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view';

describe('ba drive storage', () => {
  it('validates file type and empty input', () => {
    expect(validateBaFile(null).ok).toBe(false);
    expect(validateBaFile({ data: btoa('x'), mimeType: 'text/plain' }).ok).toBe(false);
    expect(validateBaFile(pdf).ok).toBe(true);
  });

  it('extracts a drive file id from a url', () => {
    expect(parseDriveFileId(driveUrl)).toBe('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
    expect(parseDriveFileId('')).toBe('');
  });

  it('returns a friendly error when the bridge is not configured', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = await saveDriveFile({}, pdf, 'ba-1');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('belum dikonfigurasi');
    expect(f).not.toHaveBeenCalled();
  });

  it('posts saveFile to the bridge and returns the drive url', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ success: true, url: driveUrl, fileId: 'AAAABBBBCCCCDDDDEEEEFFFFGGGG12345' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const res = await saveDriveFile(env, pdf, 'ba-admin-BA-2026-0001');
    expect(res.ok).toBe(true);
    expect(res.url).toBe(driveUrl);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.action).toBe('saveFile');
    expect(body.token).toBe('tok');
    expect(body.prefix).toBe('ba-admin-BA-2026-0001');
  });

  it('posts trashFile to the bridge', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const res = await trashDriveFile(env, 'AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
    expect(res.ok).toBe(true);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.action).toBe('trashFile');
    expect(body.fileId).toBe('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
  });
});
