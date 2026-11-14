const D1_IMPORT_PRESERVE = ['Admin', 'BagianStaff', 'NomorSurat'];

const D1_IMPORT_STAGES = {
    1: {
        label: 'Master, Mahasiswa, dan Config',
        tables: ['mahasiswa', 'master_kegiatan', 'master_bagian', 'master_biaya', 'config']
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
    const parts = (def.key || []).map(function(header) { return _d1Norm(mapped[header]); });
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
            if (seen[key.value]) {
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

function d1ImportHelp() {
    const text = [
        'Cara impor snapshot D1:',
        '1. Buka dashboard CF, pilih Download Database, cakupan "Semua tabel".',
        '2. Unggah file XLSX ke Google Drive.',
        '3. Salin link atau ID file XLSX.',
        '4. Klik INHAL -> Impor Snapshot D1 - Dry-run, tempel link/ID.',
        '5. Periksa laporan. Jika tidak ada error, jalankan Impor Snapshot D1 - Tahap 1.',
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
