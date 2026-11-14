const D1_IMPORT_PRESERVE = ['Admin', 'BagianStaff', 'NomorSurat'];

const D1_IMPORT_STAGES = {
    1: {
        label: 'Master, Mahasiswa, dan Config',
        tables: ['mahasiswa', 'master_kegiatan', 'master_bagian', 'master_biaya', 'config']
    },
    2: {
        label: 'Pengajuan, Detail, Riwayat, Check Data, dan Revisi Pembayaran',
        tables: ['pengajuan', 'detail_kegiatan', 'status_history', 'check_data', 'pembayaran_revisi']
    },
    3: {
        label: 'Berita Acara dan Berkas Pendukung',
        tables: ['berita_acara', 'berita_acara_peserta', 'berita_acara_admin', 'berita_acara_admin_peserta', 'berita_acara_admin_berkas']
    },
    4: {
        label: 'Jadwal, Dosen, dan Sesi BA',
        tables: ['jadwal_pelaksanaan', 'jadwal_peserta', 'jadwal_dosen', 'ba_dosen', 'berita_acara_sesi']
    },
    5: {
        label: 'Log Upload dan Audit Log',
        tables: ['log_upload', 'audit_log']
    }
};

const D1_IMPORT_TABLES = {
    mahasiswa: {
        sheet: 'Mahasiswa',
        strictKey: true,
        key: ['NPM'],
        fields: [
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Nama Lengkap', from: ['nama_lengkap', 'Nama Lengkap'] },
            { to: 'Email', from: ['email', 'Email'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Keterangan', from: ['keterangan', 'Keterangan'] }
        ]
    },
    master_kegiatan: {
        sheet: 'MasterKegiatan',
        strictKey: true,
        key: ['Kategori', 'Nilai'],
        fields: [
            { to: 'Kategori', from: ['kategori', 'Kategori'] },
            { to: 'Nilai', from: ['nilai', 'Nilai'] }
        ]
    },
    master_bagian: {
        sheet: 'MasterBagian',
        strictKey: false,
        key: ['Lab', 'Kegiatan Lab', 'Bagian'],
        fields: [
            { to: 'Lab', from: ['lab', 'Lab'] },
            { to: 'Kegiatan Lab', from: ['kegiatan_lab', 'Kegiatan Lab'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] },
            { to: 'Email', from: ['email', 'Email'] }
        ]
    },
    master_biaya: {
        sheet: 'MasterBiaya',
        strictKey: false,
        key: ['Kegiatan'],
        fields: [
            { to: 'Kegiatan', from: ['kegiatan', 'Kegiatan'] },
            { to: 'Biaya', from: ['biaya', 'Biaya'] }
        ]
    },
    config: {
        sheet: 'Config',
        strictKey: true,
        key: ['Key'],
        fields: [
            { to: 'Key', from: ['key', 'Key'] },
            { to: 'Value', from: ['value', 'Value'] }
        ]
    },
    pengajuan: {
        sheet: 'Pengajuan',
        strictKey: true,
        key: ['ID Pengajuan'],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Nama Lengkap', from: ['nama_lengkap', 'Nama Lengkap'] },
            { to: 'Email', from: ['email', 'Email'] },
            { to: 'No. HP/WA', from: ['no_hp_wa', 'No. HP/WA'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Jenis Kegiatan', from: ['jenis_kegiatan', 'Jenis Kegiatan'] },
            { to: 'Dosen', from: ['dosen', 'Dosen'] },
            { to: 'Tanggal Pelaksanaan', from: ['tanggal_pelaksanaan', 'Tanggal Pelaksanaan'] },
            { to: 'Keterangan', from: ['keterangan', 'Keterangan'] },
            { to: 'Link Surat Keterangan', from: ['link_surat_keterangan', 'Link Surat Keterangan'] },
            { to: 'Status', from: ['status', 'Status'] },
            { to: 'Catatan Admin', from: ['catatan_admin', 'Catatan Admin'] },
            { to: 'Notifikasi Terkirim Pada', from: ['notifikasi_terkirim_pada', 'Notifikasi Terkirim Pada'] },
            { to: 'Status Notifikasi Email', from: ['status_notifikasi_email', 'Status Notifikasi Email'] },
            { to: 'Error Notifikasi Email', from: ['error_notifikasi_email', 'Error Notifikasi Email'] },
            { to: 'Lampiran Email', from: ['lampiran_email', 'Lampiran Email'] },
            { to: 'Nomor Surat', from: ['nomor_surat', 'Nomor Surat'] },
            { to: 'Link ACC INHAL', from: ['link_acc_inhal', 'Link ACC INHAL'] },
            { to: 'Link Bukti Bayar', from: ['link_bukti_bayar', 'Link Bukti Bayar'] },
            { to: 'Link Final', from: ['link_final', 'Link Final'] },
            { to: 'Status Info Bagian', from: ['status_info_bagian', 'Status Info Bagian'] },
            { to: 'Waktu Info Bagian', from: ['waktu_info_bagian', 'Waktu Info Bagian'] },
            { to: 'Email Bagian', from: ['email_bagian', 'Email Bagian'] },
            { to: 'Catatan Info Bagian', from: ['catatan_info_bagian', 'Catatan Info Bagian'] },
            { to: 'UpdatedAt', from: ['updated_at', 'UpdatedAt'] },
            { to: 'Sumber', from: ['sumber', 'Sumber'] },
            { to: 'Status Pembayaran', from: ['status_pembayaran', 'Status Pembayaran'] },
            { to: 'Kesesuaian Pembayaran', from: ['kesesuaian_pembayaran', 'Kesesuaian Pembayaran'] },
            { to: 'Nominal Dibayar', from: ['nominal_dibayar', 'Nominal Dibayar'] },
            { to: 'Tanggal Bayar', from: ['tanggal_bayar', 'Tanggal Bayar'] },
            { to: 'Metode Bayar', from: ['metode_bayar', 'Metode Bayar'] },
            { to: 'Catatan Verifikasi', from: ['catatan_verifikasi', 'Catatan Verifikasi'] },
            { to: 'Verified At', from: ['verified_at', 'Verified At'] },
            { to: 'Verified By', from: ['verified_by', 'Verified By'] },
            { to: 'Payment Revision', from: ['payment_revision', 'Payment Revision'] },
            { to: 'Upload Reset At', from: ['upload_reset_at', 'Upload Reset At'] },
            { to: 'Upload Reset By', from: ['upload_reset_by', 'Upload Reset By'] },
            { to: 'Upload Reset Note', from: ['upload_reset_note', 'Upload Reset Note'] },
            { to: 'Form Key', from: ['form_key', 'Form Key'] }
        ]
    },
    detail_kegiatan: {
        sheet: 'DetailKegiatan',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'Jenis Kegiatan', from: ['jenis_kegiatan', 'Jenis Kegiatan'] },
            { to: 'Pilihan', from: ['pilihan', 'Pilihan'] },
            { to: 'Detail', from: ['detail', 'Detail'] },
            { to: 'Tanggal Pelaksanaan', from: ['tanggal_pelaksanaan', 'Tanggal Pelaksanaan'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] }
        ]
    },
    status_history: {
        sheet: 'StatusHistory',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'Status', from: ['status', 'Status'] },
            { to: 'Catatan', from: ['catatan', 'Catatan'] },
            { to: 'Actor Email', from: ['actor_email', 'Actor Email'] }
        ]
    },
    check_data: {
        sheet: 'CheckData',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'Check ID', from: ['check_id', 'Check ID'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Nama Lengkap', from: ['nama_lengkap', 'Nama Lengkap'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Jenis Kegiatan', from: ['jenis_kegiatan', 'Jenis Kegiatan'] },
            { to: 'Pilihan', from: ['pilihan', 'Pilihan'] },
            { to: 'Detail', from: ['detail', 'Detail'] },
            { to: 'Tanggal Pelaksanaan', from: ['tanggal_pelaksanaan', 'Tanggal Pelaksanaan'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] },
            { to: 'Dosen', from: ['dosen', 'Dosen'] },
            { to: 'Hadir', from: ['hadir', 'Hadir'] },
            { to: 'Catatan', from: ['catatan', 'Catatan'] },
            { to: 'Biaya', from: ['biaya', 'Biaya'] },
            { to: 'UpdatedAt', from: ['updated_at', 'UpdatedAt'] }
        ]
    },
    pembayaran_revisi: {
        sheet: 'PembayaranRevisi',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['created_at', 'Created At', 'timestamp', 'Timestamp'] },
            { to: 'Revisi ID', from: ['id', 'Revisi ID'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'Revision', from: ['revision', 'Revision'] },
            { to: 'Mode', from: ['mode', 'Mode'] },
            { to: 'Status Lama', from: ['status_lama', 'Status Lama'] },
            { to: 'Status Baru', from: ['status_baru', 'Status Baru'] },
            { to: 'Kesesuaian Lama', from: ['kesesuaian_lama', 'Kesesuaian Lama'] },
            { to: 'Kesesuaian Baru', from: ['kesesuaian_baru', 'Kesesuaian Baru'] },
            { to: 'Nominal Lama', from: ['nominal_lama', 'Nominal Lama'] },
            { to: 'Nominal Baru', from: ['nominal_baru', 'Nominal Baru'] },
            { to: 'Tanggal Lama', from: ['tanggal_lama', 'Tanggal Lama'] },
            { to: 'Tanggal Baru', from: ['tanggal_baru', 'Tanggal Baru'] },
            { to: 'Metode Lama', from: ['metode_lama', 'Metode Lama'] },
            { to: 'Metode Baru', from: ['metode_baru', 'Metode Baru'] },
            { to: 'Alasan', from: ['alasan', 'Alasan'] },
            { to: 'Catatan', from: ['catatan', 'Catatan'] },
            { to: 'Actor', from: ['actor', 'Actor'] },
            { to: 'Created At', from: ['created_at', 'Created At'] },
            { to: 'Before JSON', from: ['before_json', 'Before JSON'] },
            { to: 'After JSON', from: ['after_json', 'After JSON'] }
        ]
    },
    berita_acara: {
        sheet: 'BeritaAcara',
        strictKey: true,
        key: ['BA ID'],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'BA ID', from: ['ba_id', 'BA ID'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Nama Kegiatan', from: ['nama_kegiatan', 'Nama Kegiatan'] },
            { to: 'Tanggal Pelaksanaan', from: ['tanggal_pelaksanaan', 'Tanggal Pelaksanaan'] },
            { to: 'Jumlah Peserta', from: ['jumlah_peserta', 'Jumlah Peserta'] },
            { to: 'File Name', from: ['file_name', 'File Name'] },
            { to: 'File URL', from: ['file_url', 'File URL'] },
            { to: 'Catatan', from: ['catatan', 'Catatan'] },
            { to: 'Sumber', from: ['sumber', 'Sumber'] },
            { to: 'Jam', from: ['jam', 'Jam'] },
            { to: 'Dosen', from: ['dosen', 'Dosen'] },
            { to: 'Jadwal ID', from: ['jadwal_id', 'Jadwal ID'] },
            { to: 'Label', from: ['label', 'Label'] },
            { to: 'Kegiatan Key', from: ['kegiatan_key', 'Kegiatan Key'] }
        ]
    },
    berita_acara_peserta: {
        sheet: 'BeritaAcaraPeserta',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'BA ID', from: ['ba_id', 'BA ID'] },
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Nama Lengkap', from: ['nama_lengkap', 'Nama Lengkap'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] },
            { to: 'Status Pengajuan', from: ['status_pengajuan', 'Status Pengajuan'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] }
        ]
    },
    berita_acara_admin: {
        sheet: 'BeritaAcaraAdmin',
        strictKey: true,
        key: ['BA ID'],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'BA ID', from: ['ba_id', 'BA ID'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Nama Kegiatan', from: ['nama_kegiatan', 'Nama Kegiatan'] },
            { to: 'Tanggal Pelaksanaan', from: ['tanggal_pelaksanaan', 'Tanggal Pelaksanaan'] },
            { to: 'Jumlah Peserta', from: ['jumlah_peserta', 'Jumlah Peserta'] },
            { to: 'File Name', from: ['file_name', 'File Name'] },
            { to: 'File URL', from: ['file_url', 'File URL'] },
            { to: 'Catatan', from: ['catatan', 'Catatan'] },
            { to: 'Sumber', from: ['sumber', 'Sumber'] },
            { to: 'Jam', from: ['jam', 'Jam'] },
            { to: 'Dosen', from: ['dosen', 'Dosen'] },
            { to: 'Kegiatan Key', from: ['kegiatan_key', 'Kegiatan Key'] },
            { to: 'Base File URL', from: ['base_file_url', 'Base File URL'] },
            { to: 'Base File Name', from: ['base_file_name', 'Base File Name'] },
            { to: 'Needs Regen', from: ['needs_regen', 'Needs Regen'] },
            { to: 'Updated At', from: ['updated_at', 'Updated At'] }
        ]
    },
    berita_acara_admin_peserta: {
        sheet: 'BeritaAcaraAdminPeserta',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'BA ID', from: ['ba_id', 'BA ID'] },
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Nama Lengkap', from: ['nama_lengkap', 'Nama Lengkap'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] },
            { to: 'Status Pengajuan', from: ['status_pengajuan', 'Status Pengajuan'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'Urutan', from: ['urutan', 'Urutan'] },
            { to: 'Active', from: ['active', 'Active'] }
        ]
    },
    berita_acara_admin_berkas: {
        sheet: 'BeritaAcaraAdminBerkas',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'BA ID', from: ['ba_id', 'BA ID'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Urutan', from: ['urutan', 'Urutan'] },
            { to: 'Page Index', from: ['page_index', 'Page Index'] },
            { to: 'File Name', from: ['file_name', 'File Name'] },
            { to: 'File URL', from: ['file_url', 'File URL'] },
            { to: 'Page Count', from: ['page_count', 'Page Count'] },
            { to: 'Byte Size', from: ['byte_size', 'Byte Size'] },
            { to: 'Active', from: ['active', 'Active'] },
            { to: 'Superseded At', from: ['superseded_at', 'Superseded At'] },
            { to: 'Scope', from: ['scope', 'Scope'] }
        ]
    },
    jadwal_pelaksanaan: {
        sheet: 'JadwalPelaksanaan',
        strictKey: true,
        key: ['Jadwal ID'],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'Jadwal ID', from: ['jadwal_id', 'Jadwal ID'] },
            { to: 'Bagian', from: ['bagian', 'Bagian'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Nama Kegiatan', from: ['nama_kegiatan', 'Nama Kegiatan'] },
            { to: 'Kegiatan Key', from: ['kegiatan_key', 'Kegiatan Key'] },
            { to: 'Tanggal', from: ['tanggal', 'Tanggal'] },
            { to: 'Jam', from: ['jam', 'Jam'] },
            { to: 'Dosen', from: ['dosen', 'Dosen'] },
            { to: 'Catatan', from: ['catatan', 'Catatan'] },
            { to: 'Active', from: ['active', 'Active'] },
            { to: 'Created By', from: ['created_by', 'Created By'] },
            { to: 'Updated At', from: ['updated_at', 'Updated At'] }
        ]
    },
    jadwal_peserta: {
        sheet: 'JadwalPeserta',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'Jadwal ID', from: ['jadwal_id', 'Jadwal ID'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Nama Lengkap', from: ['nama_lengkap', 'Nama Lengkap'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Status Pengajuan', from: ['status_pengajuan', 'Status Pengajuan'] }
        ]
    },
    jadwal_dosen: {
        sheet: 'JadwalDosen',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'Jadwal ID', from: ['jadwal_id', 'Jadwal ID'] },
            { to: 'Nama', from: ['nama', 'Nama'] },
            { to: 'Nama Key', from: ['nama_key', 'Nama Key'] },
            { to: 'Urutan', from: ['urutan', 'Urutan'] }
        ]
    },
    ba_dosen: {
        sheet: 'BaDosen',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'BA ID', from: ['ba_id', 'BA ID'] },
            { to: 'Nama', from: ['nama', 'Nama'] },
            { to: 'Nama Key', from: ['nama_key', 'Nama Key'] },
            { to: 'Urutan', from: ['urutan', 'Urutan'] }
        ]
    },
    berita_acara_sesi: {
        sheet: 'BeritaAcaraSesi',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'BA ID', from: ['ba_id', 'BA ID'] },
            { to: 'Jadwal ID', from: ['jadwal_id', 'Jadwal ID'] },
            { to: 'Urutan', from: ['urutan', 'Urutan'] }
        ]
    },
    log_upload: {
        sheet: 'LogUpload',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'ID Pengajuan', from: ['id_pengajuan', 'ID Pengajuan'] },
            { to: 'NPM', from: ['npm', 'NPM'] },
            { to: 'Nama Lengkap', from: ['nama_lengkap', 'Nama Lengkap'] },
            { to: 'Blok', from: ['blok', 'Blok'] },
            { to: 'Jenis Kegiatan', from: ['jenis_kegiatan', 'Jenis Kegiatan'] },
            { to: 'Detail', from: ['detail', 'Detail'] },
            { to: 'Tanggal', from: ['tanggal', 'Tanggal'] },
            { to: 'Link ACC INHAL', from: ['link_acc_inhal', 'Link ACC INHAL'] },
            { to: 'Link Bukti Bayar', from: ['link_bukti_bayar', 'Link Bukti Bayar'] }
        ]
    },
    audit_log: {
        sheet: 'AuditLog',
        strictKey: false,
        key: [],
        fields: [
            { to: 'Timestamp', from: ['timestamp', 'Timestamp'] },
            { to: 'Actor Email', from: ['actor_email', 'Actor Email'] },
            { to: 'Aksi', from: ['aksi', 'Aksi'] },
            { to: 'Target', from: ['target', 'Target'] },
            { to: 'Detail', from: ['detail', 'Detail'] },
            { to: 'Alasan', from: ['alasan', 'Alasan'] }
        ]
    }
};

function _d1StageDef(stage) {
    const def = D1_IMPORT_STAGES[stage];
    if (!def) throw new Error('Tahap impor ' + stage + ' belum tersedia.');
    return def;
}

function _d1Str(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

function _d1Raw(v) {
    return v === null || v === undefined ? '' : v;
}

function _d1Norm(v) {
    return _d1Str(v).toLowerCase().replace(/\s+/g, ' ');
}

function _d1Field(row, aliases) {
    const src = row || {};
    for (let i = 0; i < aliases.length; i += 1) {
        const name = aliases[i];
        if (Object.prototype.hasOwnProperty.call(src, name)) return src[name];
    }
    return '';
}

function _d1MapRow(tableName, row) {
    const def = D1_IMPORT_TABLES[tableName];
    if (!def) throw new Error('Tabel ' + tableName + ' belum dipetakan.');
    const out = {};
    def.fields.forEach(function(field) {
        out[field.to] = _d1Raw(_d1Field(row, field.from));
    });
    return out;
}

function _d1RowKey(def, mapped) {
    const keys = def.key || [];
    if (!keys.length) return { valid: true, value: '' };
    const parts = keys.map(function(header) { return _d1Norm(mapped[header]); });
    return { valid: parts.every(function(part) { return !!part; }), value: parts.join('|') };
}

function _d1ValidateStage(stage, tables) {
    const stageDef = _d1StageDef(stage);
    const stats = [];
    const issues = [];
    const mappedTables = {};
    const sourceTables = tables || {};

    stageDef.tables.forEach(function(tableName) {
        const def = D1_IMPORT_TABLES[tableName];
        const rows = sourceTables[tableName];
        const stat = { table: tableName, sheet: def.sheet, input: 0, accepted: 0, skipped: 0 };
        const acceptedRows = [];
        mappedTables[tableName] = acceptedRows;

        if (!Array.isArray(rows)) {
            issues.push({ level: 'error', table: tableName, row: 0, message: 'Sheet ' + tableName + ' tidak ditemukan pada file snapshot.' });
            stats.push(stat);
            return;
        }

        stat.input = rows.length;
        const seen = {};
        rows.forEach(function(row, index) {
            const mapped = _d1MapRow(tableName, row);
            const key = _d1RowKey(def, mapped);
            if (!key.valid) {
                issues.push({ level: 'error', table: tableName, row: index + 2, message: 'Kolom kunci kosong: ' + def.key.join(' + ') + '.' });
                stat.skipped += 1;
                return;
            }
            if ((def.key || []).length && seen[key.value]) {
                const level = def.strictKey ? 'error' : 'warning';
                issues.push({ level: level, table: tableName, row: index + 2, message: 'Duplikat kunci ' + def.key.join(' + ') + ': ' + key.value + '.' });
                if (def.strictKey) {
                    stat.skipped += 1;
                    return;
                }
            }
            seen[key.value] = true;
            acceptedRows.push(mapped);
            stat.accepted += 1;
        });
        stats.push(stat);
    });

    const errors = issues.filter(function(issue) { return issue.level === 'error'; }).length;
    const warnings = issues.filter(function(issue) { return issue.level === 'warning'; }).length;
    return { stage: stage, label: stageDef.label, stats: stats, issues: issues, tables: mappedTables, errors: errors, warnings: warnings };
}

function _d1ReportText(report, dryRun) {
    const lines = [];
    lines.push('Tahap ' + report.stage + ': ' + report.label);
    if (report.source && report.source.sourceName) lines.push('Sumber: ' + report.source.sourceName);
    if (report.source && report.source.converted) lines.push('Sheet konversi: ' + report.source.spreadsheetId);
    lines.push('');
    report.stats.forEach(function(stat) {
        lines.push(stat.table + ' -> ' + stat.sheet + ': ' + stat.input + ' baris, ' + stat.accepted + ' diterima, ' + stat.skipped + ' dilewati');
    });
    lines.push('');
    lines.push('Dipertahankan: ' + D1_IMPORT_PRESERVE.join(', '));
    lines.push('Diganti: ' + report.stats.map(function(stat) { return stat.sheet; }).join(', '));
    if (report.issues.length) {
        lines.push('');
        lines.push('Temuan (' + report.errors + ' error, ' + report.warnings + ' peringatan):');
        report.issues.slice(0, 25).forEach(function(issue) {
            const where = issue.row ? (' baris ' + issue.row) : '';
            lines.push('[' + issue.level.toUpperCase() + '] ' + issue.table + where + ': ' + issue.message);
        });
        if (report.issues.length > 25) lines.push('... dan ' + (report.issues.length - 25) + ' temuan lain.');
    }
    lines.push('');
    lines.push(dryRun ? 'Mode dry-run: tidak ada data yang ditulis.' : 'Perubahan belum diterapkan.');
    return lines.join('\n');
}

function _d1ResultText(result) {
    const lines = ['Impor selesai.'];
    (result.results || []).forEach(function(item) {
        lines.push(item.sheet + ': ' + item.rows + ' baris ditulis.');
    });
    return lines.join('\n');
}

// ===== RUNTIME GAS =====

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('INHAL')
        .addItem('Impor Snapshot D1 - Dry-run', 'd1ImportDryRun')
        .addItem('Impor Snapshot D1 - Tahap 1', 'd1ImportStage1')
        .addItem('Impor Snapshot D1 - Tahap 2', 'd1ImportStage2')
        .addItem('Impor Snapshot D1 - Tahap 3', 'd1ImportStage3')
        .addItem('Impor Snapshot D1 - Tahap 4', 'd1ImportStage4')
        .addItem('Impor Snapshot D1 - Tahap 5', 'd1ImportStage5')
        .addSeparator()
        .addItem('Bantuan Impor Snapshot', 'd1ImportHelp')
        .addToUi();
}

function d1ImportDryRun() {
    const ui = SpreadsheetApp.getUi();
    const source = _d1PromptSnapshot();
    if (!source) return;
    try {
        const report = _d1BuildReport(1, source);
        ui.alert('Dry-run Tahap 1', _d1ReportText(report, true), ui.ButtonSet.OK);
    } catch (e) {
        ui.alert('Gagal dry-run', (e && e.message) ? e.message : String(e), ui.ButtonSet.OK);
    }
}

function d1ImportStage1() {
    _d1RunStage(1);
}

function d1ImportStage2() {
    _d1RunStage(2);
}

function d1ImportStage3() {
    _d1RunStage(3);
}

function d1ImportStage4() {
    _d1RunStage(4);
}

function d1ImportStage5() {
    _d1RunStage(5);
}

function d1ImportHelp() {
    const text = [
        'Cara impor snapshot D1:',
        '1. Buka dashboard CF, pilih Download Database, cakupan "Semua tabel".',
        '2. Unggah file XLSX ke Google Drive.',
        '3. Salin link atau ID file XLSX.',
        '4. Klik INHAL -> Impor Snapshot D1 - Dry-run, tempel link/ID.',
        '5. Periksa laporan. Jika tidak ada error, jalankan impor sesuai tahap.',
        '',
        'Tahap 1: Mahasiswa, MasterKegiatan, MasterBagian, MasterBiaya, Config.',
        'Tahap 2: Pengajuan, DetailKegiatan, StatusHistory, CheckData, PembayaranRevisi.',
        'Tahap 3: BeritaAcara, BeritaAcaraPeserta, BeritaAcaraAdmin, BeritaAcaraAdminPeserta, BeritaAcaraAdminBerkas.',
        'Tahap 4: JadwalPelaksanaan, JadwalPeserta, JadwalDosen, BaDosen, BeritaAcaraSesi.',
        'Tahap 5: LogUpload dan AuditLog.',
        'Jalankan tahap secara berurutan.',
        '',
        'Admin, BagianStaff, dan NomorSurat tidak pernah diubah.',
        'Config dan sheet pada tahap terpilih akan dikosongkan lalu diisi dari D1.',
        'Pastikan layanan Drive lanjutan sudah aktif agar XLSX bisa dikonversi otomatis.'
    ].join('\n');
    SpreadsheetApp.getUi().alert('Bantuan Impor Snapshot', text, SpreadsheetApp.getUi().ButtonSet.OK);
}

function _d1PromptSnapshot() {
    const ui = SpreadsheetApp.getUi();
    const res = ui.prompt(
        'Impor Snapshot D1',
        'Tempel link/ID file XLSX hasil Download Database, atau ID Google Sheet yang sudah dikonversi:',
        ui.ButtonSet.OK_CANCEL
    );
    if (res.getSelectedButton() !== ui.Button.OK) return '';
    return String(res.getResponseText() || '').trim();
}

function _d1NormalizeSource(input) {
    const text = String(input || '').trim();
    if (!text) return '';
    const sheetMatch = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
    if (sheetMatch) return sheetMatch[1];
    const fileMatch = text.match(/\/d\/([A-Za-z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];
    const idMatch = text.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    return text;
}

function _d1ResolveWorkbook(input) {
    const id = _d1NormalizeSource(input);
    if (!id) throw new Error('Link/ID snapshot kosong.');
    const file = DriveApp.getFileById(id);
    const mime = String(file.getMimeType() || '');
    if (mime === 'application/vnd.google-apps.spreadsheet') {
        return { spreadsheetId: id, sourceName: file.getName(), converted: false };
    }
    if (mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error('File harus XLSX atau Google Sheet. Tipe file: ' + mime);
    }
    if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.copy) {
        throw new Error('Layanan Drive lanjutan belum aktif. Buka file XLSX di Google Sheets lalu masukkan ID Google Sheet-nya.');
    }
    const props = PropertiesService.getScriptProperties();
    const stamp = String(file.getLastUpdated().getTime());
    const cacheKey = 'D1_CONVERTED_' + id + '_' + stamp;
    const cachedId = String(props.getProperty(cacheKey) || '').trim();
    if (cachedId) {
        try {
            const cached = DriveApp.getFileById(cachedId);
            return { spreadsheetId: cachedId, sourceName: file.getName(), converted: true, convertedName: cached.getName() };
        } catch (e) {}
    }
    const copy = Drive.Files.copy(
        { title: 'INHAL D1 Snapshot - ' + file.getName(), mimeType: MimeType.GOOGLE_SHEETS },
        id,
        { convert: true }
    );
    props.setProperty(cacheKey, copy.id);
    return { spreadsheetId: copy.id, sourceName: file.getName(), converted: true, convertedName: copy.title || '' };
}

function _d1ReadTables(spreadsheetId) {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const tables = {};
    ss.getSheets().forEach(function(sheet) {
        const name = sheet.getName();
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow < 1 || lastCol < 1) {
            tables[name] = [];
            return;
        }
        const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
        const headers = values[0].map(function(cell) { return _d1Str(cell); });
        const rows = [];
        for (let i = 1; i < values.length; i += 1) {
            const row = values[i];
            if (!row.some(function(cell) { return cell !== '' && cell !== null && cell !== undefined; })) continue;
            const obj = {};
            headers.forEach(function(header, index) {
                if (header) obj[header] = row[index];
            });
            rows.push(obj);
        }
        tables[name] = rows;
    });
    return tables;
}

function _d1BuildReport(stage, source) {
    _d1StageDef(stage);
    const workbook = _d1ResolveWorkbook(source);
    const tables = _d1ReadTables(workbook.spreadsheetId);
    const report = _d1ValidateStage(stage, tables);
    report.source = workbook;
    return report;
}

function _d1RunStage(stage) {
    const ui = SpreadsheetApp.getUi();
    const source = _d1PromptSnapshot();
    if (!source) return;
    let report;
    try {
        report = _d1BuildReport(stage, source);
    } catch (e) {
        ui.alert('Gagal membaca snapshot', (e && e.message) ? e.message : String(e), ui.ButtonSet.OK);
        return;
    }
    if (report.errors) {
        ui.alert('Impor dibatalkan', _d1ReportText(report, true), ui.ButtonSet.OK);
        return;
    }
    const question = _d1ReportText(report, false) + '\n\nSheet di atas akan dikosongkan lalu diisi data D1. Lanjutkan?';
    const answer = ui.alert('Konfirmasi Impor Tahap ' + stage, question, ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;
    try {
        const result = _d1ApplyStage(stage, report);
        ui.alert('Impor selesai', _d1ResultText(result), ui.ButtonSet.OK);
    } catch (e) {
        ui.alert('Gagal impor', (e && e.message) ? e.message : String(e), ui.ButtonSet.OK);
    }
}

function _d1ApplyStage(stage, report) {
    if (!report || report.errors) throw new Error('Laporan masih memiliki error.');
    const stageDef = _d1StageDef(stage);
    const ss = getGlobalSpreadsheet();
    const results = [];
    stageDef.tables.forEach(function(tableName) {
        const def = D1_IMPORT_TABLES[tableName];
        if (D1_IMPORT_PRESERVE.indexOf(def.sheet) !== -1) {
            throw new Error('Sheet ' + def.sheet + ' tidak boleh ditimpa.');
        }
        ensureSheetWithHeaders(ss, def.sheet, SCHEMAS[def.sheet]);
        const sheet = ss.getSheetByName(def.sheet);
        const headers = getHeadersFromSheet(sheet);
        if (!headers.length) throw new Error('Header sheet ' + def.sheet + ' kosong.');
        const lastRow = sheet.getLastRow();
        const lastCol = Math.max(sheet.getLastColumn(), headers.length);
        if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
        const rows = (report.tables[tableName] || []).map(function(row) {
            return headers.map(function(header) {
                return Object.prototype.hasOwnProperty.call(row, header) ? row[header] : '';
            });
        });
        if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        invalidateSheetCache(def.sheet);
        results.push({ table: tableName, sheet: def.sheet, rows: rows.length });
    });
    SpreadsheetApp.flush();
    return { success: true, results: results };
}
