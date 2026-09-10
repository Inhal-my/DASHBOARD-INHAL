import { writeFile } from 'node:fs/promises';
import { parseGvizResponse, tableToRecordsAuto, buildImportSql } from '../src/sheetImport.js';

const SHEET_ID = process.env.INHAL_SHEET_ID || '1awscv3N22hW9XMddsgk21p135Q8NOFXUcylH6BcJ518';
const OUTPUT = process.argv[2] || '/tmp/opencode/inhal-real-import.sql';

const SPECS = [
  {
    sheet: 'Mahasiswa',
    table: 'mahasiswa',
    columnMap: { NPM: 'npm', 'Nama Lengkap': 'nama_lengkap', Email: 'email', Blok: 'blok', Keterangan: 'keterangan' }
  },
  {
    sheet: 'MasterKegiatan',
    table: 'master_kegiatan',
    columnMap: { Kategori: 'kategori', Nilai: 'nilai' }
  },
  {
    sheet: 'MasterBagian',
    table: 'master_bagian',
    columnMap: { Lab: 'lab', 'Kegiatan Lab': 'kegiatan_lab', Bagian: 'bagian', Email: 'email' }
  },
  {
    sheet: 'Config',
    table: 'config',
    columnMap: { Key: 'key', Value: 'value' }
  },
  {
    sheet: 'Pengajuan',
    table: 'pengajuan',
    columnMap: {
      Timestamp: 'timestamp',
      'ID Pengajuan': 'id_pengajuan',
      NPM: 'npm',
      'Nama Lengkap': 'nama_lengkap',
      Email: 'email',
      'No. HP/WA': 'no_hp_wa',
      Blok: 'blok',
      'Jenis Kegiatan': 'jenis_kegiatan',
      Keterangan: 'keterangan',
      'Link Surat Keterangan': 'link_surat_keterangan',
      Status: 'status',
      'Catatan Admin': 'catatan_admin',
      'Notifikasi Terkirim Pada': 'notifikasi_terkirim_pada',
      'Status Notifikasi Email': 'status_notifikasi_email',
      'Error Notifikasi Email': 'error_notifikasi_email',
      'Nomor Surat': 'nomor_surat',
      'Link ACC INHAL': 'link_acc_inhal',
      'Link Bukti Bayar': 'link_bukti_bayar',
      'Link Final': 'link_final',
      'Status Info Bagian': 'status_info_bagian',
      'Waktu Info Bagian': 'waktu_info_bagian',
      'Email Bagian': 'email_bagian',
      'Catatan Info Bagian': 'catatan_info_bagian',
      UpdatedAt: 'updated_at',
      Dosen: 'dosen',
      'Tanggal Pelaksanaan': 'tanggal_pelaksanaan',
      'Lampiran Email': 'lampiran_email'
    }
  },
  {
    sheet: 'DetailKegiatan',
    table: 'detail_kegiatan',
    columnMap: {
      Timestamp: 'timestamp',
      'ID Pengajuan': 'id_pengajuan',
      'Jenis Kegiatan': 'jenis_kegiatan',
      Pilihan: 'pilihan',
      Detail: 'detail',
      'Tanggal Pelaksanaan': 'tanggal_pelaksanaan',
      Bagian: 'bagian'
    }
  },
  {
    sheet: 'Admin',
    table: 'admin',
    columnMap: { Password: 'password', Nama: 'nama' }
  },
  {
    sheet: 'BagianStaff',
    table: 'bagian_staff',
    columnMap: { Email: 'email', Kategori: 'kategori', Nama: 'nama', Pass: 'pass' }
  },
  {
    sheet: 'MasterBiaya',
    table: 'master_biaya',
    columnMap: { Kegiatan: 'kegiatan', Biaya: 'biaya' }
  },
  {
    sheet: 'BeritaAcara',
    table: 'berita_acara',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', Bagian: 'bagian', Blok: 'blok',
      'Nama Kegiatan': 'nama_kegiatan', 'Tanggal Pelaksanaan': 'tanggal_pelaksanaan',
      'Jumlah Peserta': 'jumlah_peserta', 'File Name': 'file_name', 'File URL': 'file_url',
      Catatan: 'catatan', Sumber: 'sumber'
    }
  },
  {
    sheet: 'BeritaAcaraPeserta',
    table: 'berita_acara_peserta',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', NPM: 'npm', 'Nama Lengkap': 'nama_lengkap',
      Blok: 'blok', Bagian: 'bagian', 'Status Pengajuan': 'status_pengajuan'
    }
  },
  {
    sheet: 'BeritaAcaraAdmin',
    table: 'berita_acara_admin',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', Bagian: 'bagian', Blok: 'blok',
      'Nama Kegiatan': 'nama_kegiatan', 'Tanggal Pelaksanaan': 'tanggal_pelaksanaan',
      'Jumlah Peserta': 'jumlah_peserta', 'File Name': 'file_name', 'File URL': 'file_url',
      Catatan: 'catatan', Sumber: 'sumber'
    }
  },
  {
    sheet: 'BeritaAcaraAdminPeserta',
    table: 'berita_acara_admin_peserta',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', NPM: 'npm', 'Nama Lengkap': 'nama_lengkap',
      Blok: 'blok', Bagian: 'bagian', 'Status Pengajuan': 'status_pengajuan'
    }
  },
  {
    sheet: 'CheckData',
    table: 'check_data',
    columnMap: {
      Timestamp: 'timestamp', 'Check ID': 'check_id', 'ID Pengajuan': 'id_pengajuan',
      NPM: 'npm', 'Nama Lengkap': 'nama_lengkap', Blok: 'blok',
      'Jenis Kegiatan': 'jenis_kegiatan', Pilihan: 'pilihan', Detail: 'detail',
      'Tanggal Pelaksanaan': 'tanggal_pelaksanaan', Bagian: 'bagian', Dosen: 'dosen',
      Hadir: 'hadir', Catatan: 'catatan', UpdatedAt: 'updated_at', Biaya: 'biaya'
    }
  },
  {
    sheet: 'StatusHistory',
    table: 'status_history',
    columnMap: { Timestamp: 'timestamp', 'ID Pengajuan': 'id_pengajuan', Status: 'status', Catatan: 'catatan', 'Actor Email': 'actor_email' }
  },
  {
    sheet: 'NomorSurat',
    table: 'nomor_surat',
    columnMap: { Type: 'type', Tahun: 'tahun', LastNumber: 'last_number', UpdatedAt: 'updated_at' }
  }
];

async function fetchSheet(sheet) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal mengambil sheet ${sheet}: HTTP ${res.status}`);
  const text = await res.text();
  return tableToRecordsAuto(parseGvizResponse(text));
}

async function main() {
  const specs = [];
  for (const spec of SPECS) {
    const records = await fetchSheet(spec.sheet);
    specs.push({ ...spec, records });
    console.log(`${spec.sheet.padEnd(16)} -> ${spec.table.padEnd(16)} ${records.length} baris`);
  }
  const sql = buildImportSql(specs);
  await writeFile(OUTPUT, sql, 'utf8');
  console.log(`SQL ditulis ke ${OUTPUT} (${sql.length} byte)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
