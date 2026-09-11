import { Hono } from 'hono';
import { getMasterOptions, getBuktiMode, getStudentNameByNpm } from './repo.js';
import { registerPengajuan } from './pengajuan.js';
import { getStudentPortalData, uploadBuktiFiles } from './portal.js';
import { dispatchRpc } from './rpc.js';
import { getUpload, base64ToBytes } from './uploads.js';

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

app.get('/api/portal/:npm', async (c) => {
  const data = await getStudentPortalData(c.env.DB, c.req.param('npm'));
  return c.json(data);
});

app.post('/api/portal/upload', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Data tidak valid.' }, 400);
  }
  const result = await uploadBuktiFiles(c.env.DB, body, c.env);
  return c.json(result, result.success ? 200 : 400);
});

app.get('/api/files/:id', async (c) => {
  const row = await getUpload(c.env.DB, c.req.param('id'));
  if (!row) return c.json({ error: 'Berkas tidak ditemukan.' }, 404);
  const name = String(row.file_name || row.id).replace(/"/g, '');
  return new Response(base64ToBytes(row.content), {
    headers: {
      'Content-Type': row.mime_type || 'application/octet-stream',
      'Content-Disposition': 'inline; filename="' + name + '"',
      'Cache-Control': 'private, max-age=600'
    }
  });
});

app.post('/api/rpc', async (c) => {
  let body = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'local';
  const result = await dispatchRpc(c.env.DB, body.fn, body.args, ip, c.env);
  return c.json(result);
});

export default app;
