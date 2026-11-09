import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  norm, baginaKey, parseCurrency, formatRupiah, getMasterOptions,
  resolveBagian12, baginaHasAccess, getBagianBaStatuses, kegiatanKey,
  resolveBiayaForPengajuan, effectiveDetailFor, filterKkdSgdDetailOptions
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
    expect(await getBagianBaStatuses(env.DB)).toEqual(['ACC']);
  });
});

describe('biaya berdasarkan Detail', () => {
  const biaya = { Inhal: 250000, Remediasi: 300000, Praktikum: 250000, PostTest: 250000 };

  it('memakai Detail Inhal untuk KKD/SGD/Ujian yang kosong', () => {
    expect(effectiveDetailFor({ 'Jenis Kegiatan': 'KKD' }, [])).toBe('Inhal');
    expect(effectiveDetailFor({ 'Jenis Kegiatan': 'SGD' }, [])).toBe('Inhal');
    expect(effectiveDetailFor({ 'Jenis Kegiatan': 'Ujian' }, [{ Detail: 'UAS' }])).toBe('Inhal');
  });

  it('mengambil biaya dari Detail, bukan Jenis', () => {
    const p = { 'ID Pengajuan': 'X', 'Jenis Kegiatan': 'KKD' };
    expect(resolveBiayaForPengajuan(p, biaya, {}, [{ Detail: 'Inhal' }])).toBe(250000);
    expect(resolveBiayaForPengajuan(p, biaya, {}, [])).toBe(250000);
    expect(resolveBiayaForPengajuan({ 'ID Pengajuan': 'X', 'Jenis Kegiatan': 'Ujian' }, biaya, {}, [])).toBe(250000);
  });

  it('menghargai Remediasi Praktikum 300k dan PostTest 250k', () => {
    const p = { 'ID Pengajuan': 'X', 'Jenis Kegiatan': 'Praktikum' };
    expect(resolveBiayaForPengajuan(p, biaya, {}, [{ Detail: 'Remediasi' }])).toBe(300000);
    expect(resolveBiayaForPengajuan(p, biaya, {}, [{ Detail: 'PostTest' }])).toBe(250000);
    expect(resolveBiayaForPengajuan(p, biaya, {}, [{ Detail: 'Praktikum' }])).toBe(250000);
  });

  it('override manual tetap prioritas dan tidak lagi memakai fuzzy', () => {
    const p = { 'ID Pengajuan': 'X', 'Jenis Kegiatan': 'KKD' };
    expect(resolveBiayaForPengajuan(p, biaya, { X: 100000 }, [{ Detail: 'Inhal' }])).toBe(100000);
    expect(resolveBiayaForPengajuan(p, { 'Gratis KKD': 0 }, {}, [])).toBe(0);
  });

  it('menyembunyikan Remediasi dari opsi Detail KKD/SGD', () => {
    expect(filterKkdSgdDetailOptions(['Inhal', 'Remediasi'])).toEqual(['Inhal']);
  });
});
