import { describe, it, expect, vi, afterEach } from 'vitest';
import { logEvent, logError } from '../src/obs/log.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function captured(spy) {
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(spy.mock.calls[0][0]);
}

describe('logEvent', () => {
  it('menulis satu baris JSON dengan field standar', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('info', 'http_request', { requestId: 'abc', status: 200 });

    const body = captured(spy);
    expect(body.level).toBe('info');
    expect(body.event).toBe('http_request');
    expect(body.requestId).toBe('abc');
    expect(body.status).toBe(200);
    expect(Number.isNaN(Date.parse(body.ts))).toBe(false);
  });

  it('meredaksi token dan password termasuk di objek bersarang', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logEvent('warn', 'contoh', {
      token: 'rahasia',
      nested: { password: '123', authorization: 'Bearer x' },
      aman: 'boleh'
    });

    const body = captured(spy);
    expect(body.token).toBe('[redacted]');
    expect(body.nested.password).toBe('[redacted]');
    expect(body.nested.authorization).toBe('[redacted]');
    expect(body.aman).toBe('boleh');
  });

  it('memotong string panjang dan menangani circular reference', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const circular = { name: 'root' };
    circular.self = circular;

    logEvent('info', 'contoh', { panjang: 'x'.repeat(2500), circular });

    const body = captured(spy);
    expect(body.panjang.length).toBe(2001);
    expect(body.panjang.endsWith('…')).toBe(true);
    expect(body.circular.self).toBe('[circular]');
  });

  it('tetap aman ketika fields berisi Error', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('info', 'contoh', { error: new Error('gagal') });

    const body = captured(spy);
    expect(body.error.message).toBe('gagal');
    expect(body.error.name).toBe('Error');
  });
});

describe('logError', () => {
  it('mencatat message dan stack pada level error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('rpc_failed', new Error('boom'), { fn: 'simpan', requestId: 'req-1' });

    const body = captured(spy);
    expect(body.level).toBe('error');
    expect(body.event).toBe('rpc_failed');
    expect(body.fn).toBe('simpan');
    expect(body.requestId).toBe('req-1');
    expect(body.error.message).toBe('boom');
    expect(body.error.stack).toContain('boom');
  });

  it('menerima nilai non-Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('rpc_failed', 'rusak');

    const body = captured(spy);
    expect(body.error.message).toBe('rusak');
  });
});
