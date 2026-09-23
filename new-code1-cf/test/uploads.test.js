import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  parseFileInput, validateUpload, saveUpload, getUpload, base64ToBytes, MAX_UPLOAD_BYTES
} from '../src/uploads.js';

describe('uploads', () => {
  it('parses object and data-url inputs', () => {
    expect(parseFileInput({ data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'x.pdf' }))
      .toEqual({ mimeType: 'application/pdf', data: 'aGVsbG8=', name: 'x.pdf' });
    expect(parseFileInput('data:image/png;base64,iVBORw=='))
      .toEqual({ mimeType: 'image/png', data: 'iVBORw==', name: '' });
    expect(parseFileInput(null)).toBeNull();
    expect(parseFileInput({})).toBeNull();
  });

  it('validates mime type and size', () => {
    expect(validateUpload({ data: 'aGVsbG8=', mimeType: 'application/pdf' }).ok).toBe(true);
    expect(validateUpload({ data: 'aGVsbG8=', mimeType: 'text/plain' }).ok).toBe(false);
    expect(validateUpload(null).ok).toBe(false);
    const big = { data: 'A'.repeat(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 200), mimeType: 'application/pdf' };
    expect(validateUpload(big).ok).toBe(false);
  });

  it('saves and reads an upload back', async () => {
    const res = await saveUpload(
      env.DB,
      { data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'surat.pdf' },
      { pengajuanId: 'INHAL-x', kind: 'surat', createdBy: 'admin', createdAt: '2026-09-11T00:00:00' }
    );
    expect(res.ok).toBe(true);
    expect(res.url).toBe('/api/files/' + res.id);
    const row = await getUpload(env.DB, res.id);
    expect(row.mime_type).toBe('application/pdf');
    expect(row.file_name).toBe('surat.pdf');
    expect(new TextDecoder().decode(base64ToBytes(row.content))).toBe('hello');
  });
});
