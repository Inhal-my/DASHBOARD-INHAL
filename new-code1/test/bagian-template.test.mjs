import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bagianHtml = readFileSync(new URL('../pages/bagian.html', import.meta.url), 'utf8');

describe('bagian template parity', () => {
  it('memakai shell CF: top-nav, workspace, drawer, dan bottom-nav', () => {
    assert.match(bagianHtml, /<nav class="top-nav"/);
    assert.match(bagianHtml, /<nav class="bottom-nav"/);
    assert.match(bagianHtml, /class="ws-detail"/);
    assert.match(bagianHtml, /class="workspace"/);
    assert.match(bagianHtml, /workspace--split/);
    assert.match(bagianHtml, /max-w-7xl/);
  });

  it('menyediakan tab ringkasan, jadwal, berita acara, dan riwayat', () => {
    assert.match(bagianHtml, /id: 'ringkasan'/);
    assert.match(bagianHtml, /id: 'jadwal'/);
    assert.match(bagianHtml, /id: 'ba'/);
    assert.match(bagianHtml, /id: 'riwayat'/);
  });

  it('memakai backend jadwal GAS dan mengaitkan BA ke jadwal', () => {
    assert.match(bagianHtml, /getJadwalList/);
    assert.match(bagianHtml, /saveJadwalPelaksanaan/);
    assert.match(bagianHtml, /updateJadwalPelaksanaan/);
    assert.match(bagianHtml, /cancelJadwalPelaksanaan/);
    assert.match(bagianHtml, /jadwalId: this\.baJadwal\.JadwalID/);
  });

  it('tidak lagi memakai status Diterima', () => {
    assert.doesNotMatch(bagianHtml, /Diterima/);
  });

  it('mempertahankan alur backend GAS tanpa API CF', () => {
    assert.match(bagianHtml, /google\.script\.run/);
    assert.match(bagianHtml, /getBagianBootstrap/);
    assert.match(bagianHtml, /uploadBeritaAcaraBagian/);
    assert.doesNotMatch(bagianHtml, /fetch\('\/api\/rpc'\)/);
  });

  it('memakai safeUrl untuk tautan surat, final, dan file BA', () => {
    assert.match(bagianHtml, /safeUrl\(r\.linkFinal\)/);
    assert.match(bagianHtml, /safeUrl\(r\.linkSurat\)/);
    assert.match(bagianHtml, /safeUrl\(item\.fileUrl\)/);
    assert.match(bagianHtml, /safeUrl\(selectedItem\.fileUrl\)/);
    assert.match(bagianHtml, /function safeUrl|safeUrl\(v\)/);
  });

  it('memakai KPI row 4 kolom dan hanya menampilkan tindakan yang perlu', () => {
    assert.match(bagianHtml, /class="grid grid-cols-2 gap-3 lg:grid-cols-4"/);
    assert.match(bagianHtml, /class="grid gap-4 lg:grid-cols-2"/);
    assert.match(bagianHtml, /tindakanAktif\(\)/);
    assert.match(bagianHtml, /v-if="ringkasanStats\.belumDijadwalkan > 0"/);
    assert.match(bagianHtml, /v-if="ringkasanStats\.belumBa > 0"/);
    assert.match(bagianHtml, /v-if="ringkasanStats\.pesertaMenunggu > 0"/);
  });

  it('menghitung antrean BA dari kegiatan yang belum punya BA', () => {
    assert.match(bagianHtml, /baForKegiatan/);
    assert.match(bagianHtml, /if \(baForKegiatan\(g, this\.baList\)\) return false;/);
    assert.match(bagianHtml, /ringkasanStats\(\)/);
  });
});
