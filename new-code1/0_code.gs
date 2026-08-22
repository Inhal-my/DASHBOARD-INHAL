const DATABASE_SHEET_ID = '1awscv3N22hW9XMddsgk21p135Q8NOFXUcylH6BcJ518';
const DRIVE_FOLDER_ID = '1gFdANGMwa80gMpUNg1La91KOHAuMTt7P';

const TEMPLATE_DITERIMA = 'template-acc-diterima-ditolak';
const TEMPLATE_DITOLAK = 'template-acc-diterima-ditolak';
const TEMPLATE_ACC_FINAL = 'template-acc-final';

const STATUS = {
    MENUNGGU: 'Menunggu',
    DITERIMA: 'Diterima',
    DITOLAK: 'Ditolak',
    ACC: 'ACC',
    DIBATALKAN: 'Dibatalkan'
};

const STATUS_INFO_BAGIAN = ['Belum dikirim', 'Terkirim', 'Gagal'];

const JENIS_KEGIATAN = ['Ujian', 'SGD', 'KKD', 'Praktikum'];

const KATEGORI_MASTER = ['Blok', 'Ujian', 'SGD', 'Detail SGD', 'KKD', 'Detail KKD', 'Lab', 'Kegiatan Lab', 'Dosen'];

const SCHEMAS = {
    Pengajuan: [
        'Timestamp',
        'ID Pengajuan',
        'NPM',
        'Nama Lengkap',
        'Email',
        'No. HP/WA',
        'Blok',
        'Jenis Kegiatan',
        'Dosen',
        'Tanggal Pelaksanaan',
        'Keterangan',
        'Link Surat Keterangan',
        'Status',
        'Catatan Admin',
        'Notifikasi Terkirim Pada',
        'Status Notifikasi Email',
        'Error Notifikasi Email',
        'Lampiran Email',
        'Nomor Surat',
        'Link ACC INHAL',
        'Link Bukti Bayar',
        'Link Final',
        'Status Info Bagian',
        'Waktu Info Bagian',
        'Email Bagian',
        'Catatan Info Bagian',
        'UpdatedAt'
    ],
    DetailKegiatan: [
        'Timestamp',
        'ID Pengajuan',
        'Jenis Kegiatan',
        'Pilihan',
        'Detail',
        'Tanggal Pelaksanaan',
        'Bagian'
    ],
    StatusHistory: [
        'Timestamp',
        'ID Pengajuan',
        'Status',
        'Catatan',
        'Actor Email'
    ],
    Mahasiswa: [
        'NPM',
        'Nama Lengkap',
        'Email',
        'Blok',
        'Keterangan'
    ],
    MasterKegiatan: [
        'Kategori',
        'Nilai'
    ],
    MasterBagian: [
        'Lab',
        'Kegiatan Lab',
        'Bagian',
        'Email'
    ],
    MasterBiaya: [
        'Kegiatan',
        'Biaya'
    ],
    Admin: [
        'Password',
        'Nama'
    ],
    BagianStaff: [
        'Email',
        'Kategori',
        'Nama',
        'Pass'
    ],
    Config: [
        'Key',
        'Value'
    ],
    NomorSurat: [
        'Type',
        'Tahun',
        'LastNumber',
        'UpdatedAt'
    ],
    LogUpload: [
        'Timestamp',
        'ID Pengajuan',
        'NPM',
        'Nama Lengkap',
        'Blok',
        'Jenis Kegiatan',
        'Detail',
        'Tanggal',
        'Link ACC INHAL',
        'Link Bukti Bayar'
    ],
    AuditLog: [
        'Timestamp',
        'Actor Email',
        'Aksi',
        'Target',
        'Detail',
        'Alasan'
    ],
    BeritaAcara: [
        'Timestamp',
        'BA ID',
        'Bagian',
        'Blok',
        'Nama Kegiatan',
        'Tanggal Pelaksanaan',
        'Jumlah Peserta',
        'File Name',
        'File URL',
        'Catatan',
        'Sumber'
    ],
    BeritaAcaraPeserta: [
        'Timestamp',
        'BA ID',
        'NPM',
        'Nama Lengkap',
        'Blok',
        'Bagian',
        'Status Pengajuan'
    ],
    BeritaAcaraAdmin: [
        'Timestamp',
        'BA ID',
        'Bagian',
        'Blok',
        'Nama Kegiatan',
        'Tanggal Pelaksanaan',
        'Jumlah Peserta',
        'File Name',
        'File URL',
        'Catatan',
        'Sumber'
    ],
    BeritaAcaraAdminPeserta: [
        'Timestamp',
        'BA ID',
        'NPM',
        'Nama Lengkap',
        'Blok',
        'Bagian',
        'Status Pengajuan'
    ],
    CheckData: [
        'Timestamp',
        'Check ID',
        'ID Pengajuan',
        'NPM',
        'Nama Lengkap',
        'Blok',
        'Jenis Kegiatan',
        'Pilihan',
        'Detail',
        'Tanggal Pelaksanaan',
        'Bagian',
        'Dosen',
        'Hadir',
        'Catatan',
        'UpdatedAt'
    ]
};

const HEADER_BG_COLOR = '#0f766e';
const HEADER_FONT_COLOR = '#ffffff';

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function _normalizeNpm(v) {
    return String(v || '').replace(/[^0-9]/g, '');
}

function _clientDate(v) {
    if (!(v instanceof Date)) return v;
    if (isNaN(v.getTime())) return '';
    const p = function(n) { return (n < 10 ? '0' : '') + n; };
    return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate()) +
        'T' + p(v.getHours()) + ':' + p(v.getMinutes()) + ':' + p(v.getSeconds());
}

function _clientRow(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(function(k) {
        out[k] = _clientDate(obj[k]);
    });
    return out;
}

function generateId(prefix) {
    return (prefix ? prefix + '-' : '') + Utilities.getUuid();
}

function getCurrentUserEmail() {
    try {
        return Session.getActiveUser().getEmail() || '';
    } catch (e) {
        return '';
    }
}

// ---------- Password session (token) ----------
let _CURRENT_SESSION = null;
const SESSION_TTL_SECS = 4 * 60 * 60;
const _SESSION_PREFIX = 'inhal_sess_v1_';

function createSession(payload) {
    const token = Utilities.getUuid();
    try {
        CacheService.getScriptCache().put(_SESSION_PREFIX + token, JSON.stringify(payload || {}), SESSION_TTL_SECS);
    } catch (e) {}
    return token;
}

function getSession(token) {
    if (!token) return null;
    try {
        const raw = CacheService.getScriptCache().get(_SESSION_PREFIX + String(token));
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function destroySession(token) {
    try { CacheService.getScriptCache().remove(_SESSION_PREFIX + String(token)); } catch (e) {}
}

function requireAdmin(token) {
    const s = getSession(token);
    if (!s || s.role !== 'admin') {
        throw new Error('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
    }
    _CURRENT_SESSION = s;
    return s;
}

function getActorName() {
    if (_CURRENT_SESSION && _CURRENT_SESSION.nama) return _CURRENT_SESSION.nama;
    return getCurrentUserEmail() || '';
}

// ---------- Caching layer (per-execution in-memory + cross-execution CacheService) ----------
let _cachedSpreadsheet = null;
let _rowsCache = {};
const _SHEET_CACHE_PREFIX = 'cache_sheet_v1_';
const _DEFAULT_CACHE_TTL = 45;

function getGlobalSpreadsheet() {
    if (_cachedSpreadsheet) return _cachedSpreadsheet;
    let ss = null;
    if (DATABASE_SHEET_ID) {
        ss = SpreadsheetApp.openById(DATABASE_SHEET_ID);
    } else {
        ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    if (!ss) {
        throw new Error('DATABASE_SHEET_ID kosong dan tidak ada spreadsheet aktif. Isi DATABASE_SHEET_ID terlebih dahulu.');
    }
    _cachedSpreadsheet = ss;
    return ss;
}

function _sheetCacheKey(sheetName) {
    return _SHEET_CACHE_PREFIX + sheetName;
}

function invalidateSheetCache(sheetName) {
    if (_rowsCache[sheetName]) delete _rowsCache[sheetName];
    try {
        CacheService.getScriptCache().remove(_sheetCacheKey(sheetName));
    } catch (e) {}
}

function getAllRowsCached(sheetName, ttlSeconds) {
    if (_rowsCache[sheetName]) return _rowsCache[sheetName];
    const ttl = ttlSeconds || _DEFAULT_CACHE_TTL;
    try {
        const cached = CacheService.getScriptCache().get(_sheetCacheKey(sheetName));
        if (cached) {
            const rows = JSON.parse(cached);
            _rowsCache[sheetName] = rows;
            return rows;
        }
    } catch (e) {}
    const rows = getAllRows(sheetName);
    _rowsCache[sheetName] = rows;
    try {
        const payload = JSON.stringify(rows);
        if (payload.length <= 90000) {
            CacheService.getScriptCache().put(_sheetCacheKey(sheetName), payload, ttl);
        }
    } catch (e) {}
    return rows;
}

function getSchemas() {
    return SCHEMAS;
}

function getSheetSchema(sheetName) {
    return SCHEMAS[sheetName] || null;
}

function getHeadersFromSheet(sheet) {
    if (!sheet || sheet.getLastRow() < 1) return [];
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function getHeaders(sheetName) {
    const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
    return getHeadersFromSheet(sheet);
}

function ensureSheetWithHeaders(ss, sheetName, expectedHeaders) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(expectedHeaders);
        formatHeaderRow(sheet);
        return { action: 'created', added: expectedHeaders };
    }

    if (sheet.getLastRow() === 0) {
        sheet.appendRow(expectedHeaders);
        formatHeaderRow(sheet);
        return { action: 'created', added: expectedHeaders };
    }

    const existingHeaders = getHeadersFromSheet(sheet);
    const missing = expectedHeaders.filter(function(h) {
        return existingHeaders.indexOf(h) === -1;
    });

    if (missing.length > 0) {
        const startCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
        formatHeaderRow(sheet);
        return { action: 'updated', added: missing };
    }

    return { action: 'existing', added: [] };
}

function formatHeaderRow(sheet) {
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) return;
    sheet.setFrozenRows(1);
    const range = sheet.getRange(1, 1, 1, lastCol);
    range.setFontWeight('bold');
    range.setBackground(HEADER_BG_COLOR);
    range.setFontColor(HEADER_FONT_COLOR);
    range.setWrap(true);
}

function setupDatabase() {
    const ss = getGlobalSpreadsheet();
    const report = { created: [], updated: [], existing: [] };

    Object.keys(SCHEMAS).forEach(function(sheetName) {
        const result = ensureSheetWithHeaders(ss, sheetName, SCHEMAS[sheetName]);
        report[result.action].push({ sheet: sheetName, added: result.added });
    });

    applyDataValidation(ss);

    const migration = migrateBeritaAcaraSheets();
    console.log('migrateBeritaAcaraSheets:', JSON.stringify(migration));

    const summary = {
        success: true,
        message: 'setupDatabase selesai. Semua sheet dan header siap diisi manual.',
        report: report
    };
    console.log(JSON.stringify(summary));
    return summary;
}

function applyDropdownValidation(ss, sheetName, headerName, options) {
    try {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;
        const headers = getHeadersFromSheet(sheet);
        const idx = headers.indexOf(headerName);
        if (idx === -1) return;
        const col = idx + 1;
        const numRows = Math.max(sheet.getMaxRows() - 1, 1);
        const rule = SpreadsheetApp.newDataValidation()
            .requireValueInList(options, true)
            .setAllowInvalid(false)
            .build();
        sheet.getRange(2, col, numRows, 1).setDataValidation(rule);
    } catch (e) {
        console.warn('Gagal menerapkan validasi dropdown untuk ' + sheetName + '.' + headerName + ': ' + e.message);
    }
}

function applyDataValidation(ss) {
    applyDropdownValidation(ss, 'Pengajuan', 'Status', Object.values(STATUS));
    applyDropdownValidation(ss, 'DetailKegiatan', 'Jenis Kegiatan', JENIS_KEGIATAN);
    applyDropdownValidation(ss, 'MasterKegiatan', 'Kategori', KATEGORI_MASTER);
}

function validateDatabaseSchema() {
    const ss = getGlobalSpreadsheet();
    const result = { valid: true, missingSheets: [], missingHeaders: {} };

    Object.keys(SCHEMAS).forEach(function(sheetName) {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            result.valid = false;
            result.missingSheets.push(sheetName);
            return;
        }
        const existing = getHeadersFromSheet(sheet);
        const missing = SCHEMAS[sheetName].filter(function(h) {
            return existing.indexOf(h) === -1;
        });
        if (missing.length > 0) {
            result.valid = false;
            result.missingHeaders[sheetName] = missing;
        }
    });

    return result;
}

function rowToObject(headers, row) {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = row[i];
    }
    return obj;
}

function objectToRow(headers, obj) {
    const row = new Array(headers.length).fill('');
    headers.forEach(function(header, i) {
        if (obj[header] !== undefined && obj[header] !== null) {
            row[i] = obj[header];
        }
    });
    return row;
}

function findRowByColumnValue(sheet, columnIndex, value) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    const values = sheet.getRange(2, columnIndex, lastRow - 1, 1).getValues();
    const target = String(value == null ? '' : value).trim();
    for (let i = 0; i < values.length; i++) {
        if (String(values[i][0] == null ? '' : values[i][0]).trim() === target) {
            return i + 2;
        }
    }
    return -1;
}

function appendRowSafe(sheetName, obj) {
    invalidateSheetCache(sheetName);
    const ss = getGlobalSpreadsheet();
    ensureSheetWithHeaders(ss, sheetName, SCHEMAS[sheetName]);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan.');

    const headers = getHeadersFromSheet(sheet);
    const row = objectToRow(headers, obj);
    sheet.appendRow(row);
    return { success: true, sheetName: sheetName, rowIndex: sheet.getLastRow(), data: rowToObject(headers, row) };
}

function upsertRowByKey(sheetName, keyColumn, keyValue, obj) {
    invalidateSheetCache(sheetName);
    const ss = getGlobalSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan.');
    ensureSheetWithHeaders(ss, sheetName, SCHEMAS[sheetName]);

    const headers = getHeadersFromSheet(sheet);
    const keyIdx = headers.indexOf(keyColumn);
    if (keyIdx === -1) throw new Error('Kolom kunci ' + keyColumn + ' tidak ditemukan di ' + sheetName + '.');

    const rowIndex = findRowByColumnValue(sheet, keyIdx + 1, keyValue);
    const data = Object.assign({}, obj);
    data[keyColumn] = keyValue;

    if (rowIndex > 0) {
        const existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
        const merged = existing.slice();
        headers.forEach(function(header, i) {
            if (data[header] !== undefined && data[header] !== null && String(data[header]) !== '') {
                merged[i] = data[header];
            }
        });
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([merged]);
        return { success: true, rowIndex: rowIndex, created: false, data: rowToObject(headers, merged) };
    }

    const row = objectToRow(headers, data);
    sheet.appendRow(row);
    return { success: true, rowIndex: sheet.getLastRow(), created: true, data: rowToObject(headers, row) };
}

function getRowByKey(sheetName, keyColumn, keyValue) {
    const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan.');
    const headers = getHeadersFromSheet(sheet);
    const keyIdx = headers.indexOf(keyColumn);
    if (keyIdx === -1) return null;
    const rowIndex = findRowByColumnValue(sheet, keyIdx + 1, keyValue);
    if (rowIndex === -1) return null;
    const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    return rowToObject(headers, row);
}

function getAllRows(sheetName) {
    const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan.');
    const headers = getHeadersFromSheet(sheet);
    if (sheet.getLastRow() < 2) return [];
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    const rows = [];
    values.forEach(function(row) {
        const hasValue = row.some(function(cell) {
            return cell !== null && cell !== undefined && String(cell).trim() !== '';
        });
        if (hasValue) {
            rows.push(rowToObject(headers, row));
        }
    });
    return rows;
}

function writeAuditLog(entry) {
    try {
        appendRowSafe('AuditLog', {
            Timestamp: new Date(),
            'Actor Email': entry.actor || '',
            Aksi: entry.action || '',
            Target: entry.target || '',
            Detail: entry.detail || '',
            Alasan: entry.alasan || ''
        });
    } catch (e) {
        console.error('Gagal menulis AuditLog: ' + e.message);
    }
}

function deleteRowByKey(sheetName, keyColumn, keyValue, reason, actorEmail) {
    invalidateSheetCache(sheetName);
    const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan.');
    const headers = getHeadersFromSheet(sheet);
    const keyIdx = headers.indexOf(keyColumn);
    if (keyIdx === -1) throw new Error('Kolom kunci ' + keyColumn + ' tidak ditemukan di ' + sheetName + '.');

    const rowIndex = findRowByColumnValue(sheet, keyIdx + 1, keyValue);
    if (rowIndex === -1) return { success: false, message: 'Data tidak ditemukan.' };

    const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    const data = rowToObject(headers, row);
    sheet.deleteRow(rowIndex);

    writeAuditLog({
        actor: actorEmail || getActorName(),
        action: 'DELETE',
        target: sheetName,
        detail: JSON.stringify(data),
        alasan: reason || ''
    });

    return { success: true, message: 'Data berhasil dihapus.', deleted: data };
}

function migrateBeritaAcaraSheets() {
    const ss = getGlobalSpreadsheet();
    const baSheet = ss.getSheetByName('BeritaAcara');
    const pesertaSheet = ss.getSheetByName('BeritaAcaraPeserta');
    if (!baSheet || !pesertaSheet) return { success: true, migrated: 0, peserta: 0 };

    const adminSheet = ss.getSheetByName('BeritaAcaraAdmin');
    const adminPesertaSheet = ss.getSheetByName('BeritaAcaraAdminPeserta');
    if (!adminSheet || !adminPesertaSheet) {
        throw new Error('Sheet BeritaAcaraAdmin / BeritaAcaraAdminPeserta belum ada. Jalankan setupDatabase() ulang.');
    }

    const baHeaders = getHeadersFromSheet(baSheet);
    const adminHeaders = getHeadersFromSheet(adminSheet);
    const pesertaHeaders = getHeadersFromSheet(pesertaSheet);
    const adminPesertaHeaders = getHeadersFromSheet(adminPesertaSheet);

    const baLast = baSheet.getLastRow();
    const baRows = baLast > 1 ? baSheet.getRange(2, 1, baLast - 1, baSheet.getLastColumn()).getValues() : [];
    const adminBaIds = [];
    const toRemoveBa = [];
    let migrated = 0;

    baRows.forEach(function(row, i) {
        const obj = rowToObject(baHeaders, row);
        if (_baSumber(obj) !== 'Admin') return;
        const copy = {};
        adminHeaders.forEach(function(h) {
            if (obj[h] !== undefined && obj[h] !== null) copy[h] = obj[h];
        });
        adminSheet.appendRow(objectToRow(adminHeaders, copy));
        adminBaIds.push(String(obj['BA ID'] || '').trim());
        toRemoveBa.push(i + 2);
        migrated++;
    });

    const pesertaLast = pesertaSheet.getLastRow();
    const pesertaRows = pesertaLast > 1 ? pesertaSheet.getRange(2, 1, pesertaLast - 1, pesertaSheet.getLastColumn()).getValues() : [];
    const toRemovePeserta = [];
    let pesertaMigrated = 0;

    pesertaRows.forEach(function(row, i) {
        const obj = rowToObject(pesertaHeaders, row);
        if (adminBaIds.indexOf(String(obj['BA ID'] || '').trim()) === -1) return;
        const copy = {};
        adminPesertaHeaders.forEach(function(h) {
            if (obj[h] !== undefined && obj[h] !== null) copy[h] = obj[h];
        });
        adminPesertaSheet.appendRow(objectToRow(adminPesertaHeaders, copy));
        toRemovePeserta.push(i + 2);
        pesertaMigrated++;
    });

    toRemoveBa.sort(function(a, b) { return b - a; });
    toRemoveBa.forEach(function(rowIndex) { baSheet.deleteRow(rowIndex); });
    toRemovePeserta.sort(function(a, b) { return b - a; });
    toRemovePeserta.forEach(function(rowIndex) { pesertaSheet.deleteRow(rowIndex); });

    if (migrated > 0) {
        invalidateSheetCache('BeritaAcara');
        invalidateSheetCache('BeritaAcaraPeserta');
        invalidateSheetCache('BeritaAcaraAdmin');
        invalidateSheetCache('BeritaAcaraAdminPeserta');
    }

    return { success: true, migrated: migrated, peserta: pesertaMigrated };
}
