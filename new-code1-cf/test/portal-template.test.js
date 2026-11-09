import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadPortalHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/portal.html'));
  return res.text();
}

describe('guard template portal', () => {
  it('tidak menyebut Diterima dan tidak meminta berkas ACC INHAL', async () => {
    const html = await loadPortalHtml();
    expect(html).not.toContain('diterima');
    expect(html).not.toContain('accFile');
  });

  it('form unggah hanya mengirim buktiFile dan tampil saat status approved', async () => {
    const html = await loadPortalHtml();
    expect(html).toContain('buktiFile: await this.readFileAsBase64');
    expect(html).toContain("detailItem.statusCode === 'approved' && !detailItem.hasUpload");
  });

  it('field keterangan wajib diisi pada form pendaftaran', async () => {
    const html = await loadPortalHtml();
    expect(html).toContain('for="regKeterangan">Keterangan <span class="text-rose-500">*</span>');
    expect(html).toContain('id="regKeterangan" v-model="regForm.keterangan"');
    expect(html).toContain('placeholder="Jelaskan keperluan pengajuan ini" required');
    expect(html).toContain("this.showToast('Keterangan wajib diisi.', 'error')");
  });

  it('menandai Detail dan Tanggal sebagai wajib', async () => {
    const html = await loadPortalHtml();
    expect(html).toContain('for="regUjianDetail">Detail Ujian <span class="text-rose-500">*</span>');
    expect(html).toContain('id="regUjianDetail" v-model="regUjian.detail"');
    expect(html).toContain('for="regSgdDetail">Detail SGD <span class="text-rose-500">*</span>');
    expect(html).toContain('for="regKkdDetail">Detail KKD <span class="text-rose-500">*</span>');
    expect(html).toContain("'regLabPilihan-' + i\">Pilihan Lab <span class=\"text-rose-500\">*</span>");
    expect(html).toContain("'regLabKegiatan-' + i\">Kegiatan Lab <span class=\"text-rose-500\">*</span>");
    expect(html).toContain("'regLabTanggal-' + i\">Tanggal Praktikum <span class=\"text-rose-500\">*</span>");
    expect(html).toContain('id="regUjianTanggal" v-model="regUjian.tanggal" type="date" class="input" required');
    expect(html).toContain('id="regSgdTanggal" v-model="regSgd.tanggal" type="date" class="input" required');
    expect(html).toContain('id="regKkdTanggal" v-model="regKkd.tanggal" type="date" class="input" required');
  });

  it('memvalidasi Detail Ujian, Detail KKD/SGD, dan Praktikum sebelum kirim', async () => {
    const html = await loadPortalHtml();
    expect(html).toContain("return 'Pilih Detail Ujian terlebih dahulu.'");
    expect(html).toContain("return 'Pilih Detail SGD terlebih dahulu.'");
    expect(html).toContain("return 'Pilih Detail KKD terlebih dahulu.'");
    expect(html).toContain("return 'Tanggal Praktikum wajib diisi dengan tanggal yang valid pada setiap baris.'");
    expect(html).toContain("return 'Baris praktikum identik tidak boleh diulang.'");
    expect(html).toContain('formData.detailUjian = this.regUjian.detail;');
  });
});
