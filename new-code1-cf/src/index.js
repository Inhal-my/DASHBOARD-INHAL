import { Hono } from 'hono';
import { getMasterOptions, getBuktiMode, getStudentNameByNpm } from './repo.js';
import { registerPengajuan } from './pengajuan.js';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/registration-options', async (c) => {
  const db = c.env.DB;
  const [blok, ujian, sgd, detailSgd, kkd, detailKkd, lab, kegiatanLab, dosen, buktiMode] = await Promise.all([
    getMasterOptions(db, 'Blok'),
    getMasterOptions(db, 'Ujian'),
    getMasterOptions(db, 'SGD'),
    getMasterOptions(db, 'Detail SGD'),
    getMasterOptions(db, 'KKD'),
    getMasterOptions(db, 'Detail KKD'),
    getMasterOptions(db, 'Lab'),
    getMasterOptions(db, 'Kegiatan Lab'),
    getMasterOptions(db, 'Dosen'),
    getBuktiMode(db)
  ]);
  return c.json({ blok, ujian, sgd, detailSgd, kkd, detailKkd, lab, kegiatanLab, dosen, buktiMode });
});

app.get('/api/mahasiswa/:npm', async (c) => {
  const name = await getStudentNameByNpm(c.env.DB, c.req.param('npm'));
  return c.json(name);
});

app.post('/api/pengajuan', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Data tidak valid.' }, 400);
  }
  const result = await registerPengajuan(c.env.DB, body);
  return c.json(result, result.success ? 200 : 400);
});

export default app;
