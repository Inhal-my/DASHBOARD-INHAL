import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { dispatchRpc } from '../src/rpc.js';

async function bagianToken() {
  return await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: ['SGD'] });
}
async function seedPengajuan() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
}

describe('rpc jadwal', () => {
  it('menyimpan jadwal lewat dispatchRpc', async () => {
    await seedPengajuan();
    const token = await bagianToken();
    const payload = {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    };
    const res = await dispatchRpc(env.DB, 'saveJadwalPelaksanaan', [payload, 'SGD', token], 'local', env);
    expect(res.success).toBe(true);
    expect(res.jadwalId).toMatch(/^JDW-/);
    const bad = await dispatchRpc(env.DB, 'saveJadwalPelaksanaan', [payload, 'SGD'], 'local', env);
    expect(bad.error).toBeTruthy();
  });
});
