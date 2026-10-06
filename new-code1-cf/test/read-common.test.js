import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  norm, baginaKey, parseCurrency, formatRupiah, getMasterOptions,
  resolveBagian12, baginaHasAccess, getBagianBaStatuses, kegiatanKey
} from '../src/read/common.js';

describe('common helpers', () => {
  it('norm lowercases and strips spaces', () => {
    expect(norm(' Praktikum ')).toBe('praktikum');
  });
  it('kegiatanKey menyamakan variasi tanda hubung', () => {
    const hyphen = kegiatanKey('SGD', 'A', 'SGD 2 - Remediasi');
    expect(kegiatanKey('SGD', 'A', 'SGD 2 — Remediasi')).toBe(hyphen);
    expect(kegiatanKey('SGD', 'A', 'SGD 2 – Remediasi')).toBe(hyphen);
    expect(kegiatanKey('SGD', 'A', 'SGD 2 − Remediasi')).toBe(hyphen);
    expect(hyphen).toBe('sgd|a|sgd 2 - remediasi');
  });
  it('baginaKey strips non-alphanumerics', () => {
    expect(baginaKey('Lab. Anatomi')).toBe('labanatomi');
  });
  it('parseCurrency reads rupiah strings', () => {
    expect(parseCurrency('Rp. 300.000')).toBe(300000);
    expect(parseCurrency(0)).toBe(0);
  });
  it('formatRupiah uses dot grouping', () => {
    expect(formatRupiah(300000)).toBe('Rp 300.000');
  });
  it('getMasterOptions returns unique category values', async () => {
    const blok = await getMasterOptions(env.DB, 'Blok');
    expect(blok).toEqual(['A', 'B']);
  });
  it('resolveBagian12 maps a lab label', () => {
    const labs = ['Anatomi', 'Biokimia'];
    expect(resolveBagian12('Biokimia', '', '', labs)).toBe('Biokimia');
  });
  it('baginaHasAccess allows wildcard accounts', () => {
    expect(baginaHasAccess({ kategoris: ['*'] }, 'SGD', '')).toBe(true);
  });
  it('getBagianBaStatuses falls back to defaults', async () => {
    expect(await getBagianBaStatuses(env.DB)).toEqual(['Diterima', 'ACC']);
  });
});
