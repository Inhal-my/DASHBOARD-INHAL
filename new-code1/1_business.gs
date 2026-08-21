function _getSheetRawRows(sheetName, numCols) {
    const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return [];
    const last = sheet.getLastRow();
    if (last < 2) return [];
    const width = Math.max(1, Math.min(numCols || sheet.getLastColumn(), sheet.getLastColumn()));
    return sheet.getRange(2, 1, last - 1, width).getValues().map(function(r) {
        return r.map(function(c) { return String(c == null ? '' : c).trim(); });
    });
}

function authenticateAdmin(password) {
    const pwd = String(password || '').trim();
    if (!pwd) return { ok: false, message: 'Masukkan password admin.' };
    const rows = _getSheetRawRows('Admin', 2);
    for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] && rows[i][0] === pwd) {
            const nama = rows[i][1] || 'Admin';
            const token = createSession({ role: 'admin', nama: nama });
            return { ok: true, token: token, nama: nama };
        }
    }
    return { ok: false, message: 'Password admin salah.' };
}

function authenticateBagian(password, kategori, subBagian) {
    const pwd = String(password || '').trim();
    if (!pwd) return { ok: false, message: 'Masukkan password.' };
    const kat = String(kategori || '').trim();
    const sub = String(subBagian || '').trim();
    const rows = _getSheetRawRows('BagianStaff', 4);
    let account = null;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r[3] && r[3] === pwd) {
            const entry = { kategoris: r[1] ? [r[1]] : [], nama: r[2] };
            if (_baginaHasAccess(entry, kat, sub)) {
                account = { nama: r[2] || 'Bagian', kategori: r[1] || '', kategoris: entry.kategoris };
                break;
            }
        }
    }
    if (!account) {
        return { ok: false, message: 'Password tidak berlaku untuk bagian ' + (kat || 'yang dipilih') + ' ini.' };
    }
    const token = createSession({ role: 'bagian', nama: account.nama, kategori: kat, subBagian: sub, kategoris: account.kategoris });
    return { ok: true, token: token, nama: account.nama, kategori: kat, subBagian: sub };
}

function logoutSession(token) {
    destroySession(token);
    return { success: true, message: 'Anda telah keluar.' };
}

function requireAuthorized(token) {
    _CURRENT_SESSION = requireAdmin(token);
}

function _normalizeFormText(value) {
    return String(value || '').trim();
}

function _buildDetailKegiatanRows(formData, idPengajuan) {
    const rows = [];
    const jenis = _normalizeFormText(formData.jenisKegiatan);
    const now = new Date();

    const addRow = function(pilihan, detail, tanggal) {
        rows.push({
            Timestamp: now,
            'ID Pengajuan': idPengajuan,
            'Jenis Kegiatan': jenis,
            'Pilihan': pilihan,
            'Detail': detail,
            'Tanggal Pelaksanaan': tanggal,
            'Bagian': _resolveBagianFor(jenis, pilihan, detail)
        });
    };

    if (jenis === 'Ujian') {
        addRow(_normalizeFormText(formData.detailKegiatan), '', _normalizeFormText(formData.tanggalKegiatan));
    } else if (jenis === 'SGD') {
        addRow(_normalizeFormText(formData.pilihanSgd), _normalizeFormText(formData.detailSgd), _normalizeFormText(formData.tanggalKegiatan));
    } else if (jenis === 'KKD') {
        addRow(_normalizeFormText(formData.pilihanKkd), _normalizeFormText(formData.detailKkd), _normalizeFormText(formData.tanggalKegiatan));
    } else if (jenis === 'Praktikum' && Array.isArray(formData.praktikum)) {
        formData.praktikum.forEach(function(p) {
            const lab = _normalizeFormText(p && p.lab);
            const kegiatan = _normalizeFormText(p && p.kegiatanLab);
            const tanggal = _normalizeFormText(p && p.tanggal);
            if (lab || kegiatan) {
                addRow(lab, kegiatan, tanggal);
            }
        });
    }
    return rows;
}

function _resolveBagianFor(jenis, pilihan, detail) {
    if (jenis !== 'Praktikum') return '';
    try {
        const rows = getAllRows('MasterBagian');
        const lab = norm(pilihan);
        const kegiatan = norm(detail);
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (norm(r.Lab) === lab && norm(r['Kegiatan Lab']) === kegiatan) {
                return r.Bagian || '';
            }
        }
        return '';
    } catch (e) {
        return '';
    }
}

function _normBagianAggregateWithLabs(raw, labs) {
    const v = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!v) return 'Lainnya';
    const key = norm(v);
    const categories = ['SGD', 'KKD', 'Ujian', 'Praktikum'];
    for (let i = 0; i < categories.length; i++) {
        if (norm(categories[i]) === key) return categories[i];
    }
    const list = labs || [];
    for (let i = 0; i < list.length; i++) {
        if (norm(list[i]) === key) return 'Praktikum';
    }
    return 'Lainnya';
}

function _getBagianOptions12(labs) {
    return ['Ujian', 'SGD', 'KKD'].concat(labs || getMasterOptions('Lab'));
}

function _resolveBagian12(rawLabel, pilihan, namaKegiatan, labs) {
    const categories = ['Ujian', 'SGD', 'KKD'];
    const list = labs || getMasterOptions('Lab');
    const v = String(rawLabel || '').replace(/\s+/g, ' ').trim();
    const key = norm(v);

    if (key) {
        for (let i = 0; i < categories.length; i++) {
            if (norm(categories[i]) === key) return categories[i];
        }
        for (let i = 0; i < list.length; i++) {
            if (norm(list[i]) === key) return list[i];
        }
    }

    const pKey = norm(pilihan);
    if (pKey) {
        for (let i = 0; i < list.length; i++) {
            if (norm(list[i]) === pKey) return list[i];
        }
    }

    const nKey = norm(namaKegiatan);
    if (nKey) {
        const sorted = list.slice().sort(function(a, b) { return norm(b).length - norm(a).length; });
        for (let i = 0; i < sorted.length; i++) {
            if (nKey.indexOf(norm(sorted[i])) !== -1) return sorted[i];
        }
    }

    return '';
}

function registerPengajuan(formData) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const npm = _normalizeFormText(formData.npm);
        const nama = _normalizeFormText(formData.namaLengkap);
        if (!npm || !nama) {
            return { success: false, message: 'NPM dan Nama Lengkap wajib diisi.' };
        }

        const dup = checkDuplicatePengajuan(formData);
        if (dup && dup.isDuplicate) {
            return { success: false, message: dup.message || 'Data identik sudah pernah diajukan.' };
        }

        const idPengajuan = generateId('INHAL');
        const now = new Date();

        let suratUrl = '';
        if (formData.fileSurat && formData.fileSurat.data) {
            suratUrl = _saveFileToDrive(formData.fileSurat.data, formData.fileSurat.mimeType, formData.fileSurat.name, 'surat-' + idPengajuan);
        } else if (formData.fileSurat && formData.fileSurat.url) {
            suratUrl = formData.fileSurat.url;
        }

        const pengajuanData = {
            Timestamp: now,
            'ID Pengajuan': idPengajuan,
            'NPM': npm,
            'Nama Lengkap': nama,
            'Email': _normalizeFormText(formData.email),
            'No. HP/WA': _normalizeFormText(formData.noHp),
            'Blok': _normalizeFormText(formData.blok),
            'Jenis Kegiatan': _normalizeFormText(formData.jenisKegiatan),
            'Keterangan': _normalizeFormText(formData.keterangan),
            'Link Surat Keterangan': suratUrl,
            'Status': STATUS.MENUNGGU,
            'Catatan Admin': '',
            'Notifikasi Terkirim Pada': '',
            'Status Notifikasi Email': '',
            'Error Notifikasi Email': '',
            'Nomor Surat': '',
            'Link ACC INHAL': '',
            'Link Bukti Bayar': '',
            'Link Final': '',
            'Status Info Bagian': '',
            'Waktu Info Bagian': '',
            'Email Bagian': '',
            'Catatan Info Bagian': '',
            'UpdatedAt': now
        };

        const detailRows = _buildDetailKegiatanRows(formData, idPengajuan);
        if (detailRows.length === 0) {
            return { success: false, message: 'Detail kegiatan tidak valid.' };
        }

        appendRowSafe('Pengajuan', pengajuanData);
        detailRows.forEach(function(row) {
            appendRowSafe('DetailKegiatan', row);
        });
        appendRowSafe('StatusHistory', {
            Timestamp: now,
            'ID Pengajuan': idPengajuan,
            'Status': STATUS.MENUNGGU,
            'Catatan': 'Pengajuan dibuat.',
            'Actor Email': getActorName()
        });

        return { success: true, idPengajuan: idPengajuan, message: 'Pengajuan berhasil didaftarkan.' };
    } catch (e) {
        console.error('registerPengajuan error: ' + e.message);
        return { success: false, message: e.message };
    } finally {
        lock.releaseLock();
    }
}

function _buildPengajuanKey(formData) {
    const npm = norm(formData.npm);
    const jenis = norm(formData.jenisKegiatan);
    let detail = '';
    let tanggal = '';
    if (jenis === 'ujian') {
        detail = norm(formData.detailKegiatan);
        tanggal = norm(formData.tanggalKegiatan);
    } else if (jenis === 'sgd') {
        detail = [norm(formData.pilihanSgd), norm(formData.detailSgd)].filter(Boolean).join(' | ');
        tanggal = norm(formData.tanggalKegiatan);
    } else if (jenis === 'kkd') {
        detail = [norm(formData.pilihanKkd), norm(formData.detailKkd)].filter(Boolean).join(' | ');
        tanggal = norm(formData.tanggalKegiatan);
    } else if (jenis === 'praktikum' && Array.isArray(formData.praktikum) && formData.praktikum.length > 0) {
        const parts = formData.praktikum.map(function(p) {
            return [norm(p.lab), norm(p.kegiatanLab), norm(p.tanggal)].filter(Boolean).join(' | ');
        }).filter(Boolean).sort();
        detail = parts.join(' && ');
        tanggal = norm(formData.praktikum[0].tanggal);
    }
    return [npm, jenis, detail, tanggal].join('||');
}

function _buildPengajuanKeyFromStored(pengajuan, details) {
    const npm = norm(pengajuan['NPM']);
    const jenis = norm(pengajuan['Jenis Kegiatan']);
    const detailParts = [];
    let tanggal = '';
    (details || []).forEach(function(d) {
        detailParts.push([norm(d.Pilihan), norm(d.Detail)].filter(Boolean).join(' | '));
        if (!tanggal) tanggal = norm(d['Tanggal Pelaksanaan']);
    });
    const detail = detailParts.filter(Boolean).sort().join(' && ');
    return [npm, jenis, detail, tanggal].join('||');
}

function checkDuplicatePengajuan(formData) {
    try {
        const searchKey = _buildPengajuanKey(formData);
        if (!searchKey) return { isDuplicate: false };

        const pengajuans = getAllRows('Pengajuan');
        const allDetails = getAllRows('DetailKegiatan');
        const detailByPengajuan = {};
        allDetails.forEach(function(d) {
            const id = String(d['ID Pengajuan'] || '').trim();
            if (!detailByPengajuan[id]) detailByPengajuan[id] = [];
            detailByPengajuan[id].push(d);
        });

        for (let i = 0; i < pengajuans.length; i++) {
            const p = pengajuans[i];
            const id = String(p['ID Pengajuan'] || '').trim();
            const key = _buildPengajuanKeyFromStored(p, detailByPengajuan[id]);
            if (key === searchKey) {
                return { isDuplicate: true, message: 'Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.' };
            }
        }
        return { isDuplicate: false };
    } catch (e) {
        return { isDuplicate: false };
    }
}

function updatePengajuanStatus(idPengajuan, newStatus, catatan, actorEmail) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const validStatus = Object.keys(STATUS).map(function(k) { return STATUS[k]; });
        if (validStatus.indexOf(newStatus) === -1) {
            return { success: false, message: 'Status tidak valid: ' + newStatus };
        }
        if (!idPengajuan) {
            return { success: false, message: 'ID Pengajuan wajib diisi.' };
        }

        const existing = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
        if (!existing) {
            return { success: false, message: 'Pengajuan tidak ditemukan.' };
        }

        const update = {
            'Status': newStatus,
            'UpdatedAt': new Date()
        };
        if (catatan !== undefined) update['Catatan Admin'] = catatan;

        let nomorSurat = String(existing['Nomor Surat'] || '').trim();
        if (newStatus === STATUS.DITERIMA && !nomorSurat) {
            nomorSurat = getNextSuratNumberYearly('INHAL');
            update['Nomor Surat'] = nomorSurat;
        }

        upsertRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan, update);
        appendRowSafe('StatusHistory', {
            Timestamp: new Date(),
            'ID Pengajuan': idPengajuan,
            'Status': newStatus,
            'Catatan': catatan || '',
            'Actor Email': actorEmail || getActorName()
        });

        let notification = null;
        if (newStatus === STATUS.DITERIMA || newStatus === STATUS.DITOLAK) {
            try {
                notification = _processStatusNotification(idPengajuan, newStatus);
            } catch (e) {
                notification = { ok: false, error: (e && e.message) ? e.message : String(e) };
            }
        }

        const baseMessage = 'Status diperbarui menjadi ' + newStatus + '.';
        if (notification) {
            return {
                success: true,
                idPengajuan: idPengajuan,
                nomorSurat: nomorSurat,
                notification: notification,
                message: baseMessage + (notification.ok ? ' Email notifikasi terkirim.' : ' Email notifikasi gagal: ' + notification.error)
            };
        }
        return { success: true, idPengajuan: idPengajuan, nomorSurat: nomorSurat, message: baseMessage };
    } catch (e) {
        return { success: false, message: e.message };
    } finally {
        lock.releaseLock();
    }
}

function uploadBuktiBayar(uploadData, accUrl, buktiUrl) {
    try {
        const idPengajuan = String((uploadData && (uploadData.idPengajuan || uploadData.IdPengajuan)) || '').trim();
        if (!idPengajuan) {
            return { success: false, message: 'ID Pengajuan tidak tersedia.' };
        }

        const existing = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
        if (!existing) {
            return { success: false, message: 'Pengajuan tidak ditemukan.' };
        }

        const npm = String((uploadData && (uploadData.npm || uploadData.NPM)) || '').trim() || existing.NPM || '';
        const detail = _getPengajuanDetailSummary(idPengajuan);

        appendRowSafe('LogUpload', {
            Timestamp: new Date(),
            'ID Pengajuan': idPengajuan,
            'NPM': npm,
            'Nama Lengkap': (uploadData && (uploadData.namaLengkap || uploadData.NamaLengkap) || '') || existing['Nama Lengkap'] || '',
            'Blok': (uploadData && (uploadData.blok || uploadData.Blok) || '') || existing.Blok || '',
            'Jenis Kegiatan': (uploadData && (uploadData.jenisKegiatan || uploadData.JenisKegiatan) || '') || existing['Jenis Kegiatan'] || '',
            'Detail': detail.detail,
            'Tanggal': detail.tanggal,
            'Link ACC INHAL': accUrl || '',
            'Link Bukti Bayar': buktiUrl || ''
        });

        upsertRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan, {
            'Link ACC INHAL': accUrl || '',
            'Link Bukti Bayar': buktiUrl || '',
            'UpdatedAt': new Date()
        });

        _sendUploadReceiptEmail(existing, accUrl, buktiUrl);

        return { success: true, message: 'Bukti berhasil disimpan.' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function _getPengajuanDetailSummary(idPengajuan) {
    const rows = getAllRows('DetailKegiatan').filter(function(r) {
        return String(r['ID Pengajuan'] || '').trim() === String(idPengajuan || '').trim();
    });
    const detail = rows.map(function(r) {
        return [r.Pilihan || '', r.Detail || ''].filter(Boolean).join(' - ');
    }).filter(Boolean).join('; ');
    const tanggal = rows.length > 0 ? rows[0]['Tanggal Pelaksanaan'] || '' : '';
    return { detail: detail, tanggal: tanggal };
}

function updateStatusInfoBagian(idPengajuan, status, email, message) {
    try {
        const existing = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
        if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };
        upsertRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan, {
            'Status Info Bagian': status || 'Belum dikirim',
            'Waktu Info Bagian': new Date(),
            'Email Bagian': email || '',
            'Catatan Info Bagian': message || '',
            'UpdatedAt': new Date()
        });
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function updateLinkFinal(idPengajuan, url) {
    try {
        upsertRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan, {
            'Link Final': url || '',
            'UpdatedAt': new Date()
        });
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function getNextSuratNumberYearly(type) {
    type = type || 'INHAL';
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const now = new Date();
        const year = now.getFullYear();
        const romanMonth = getRomanMonth(now.getMonth() + 1);

        const sheet = getGlobalSpreadsheet().getSheetByName('NomorSurat');
        const headers = getHeadersFromSheet(sheet);
        const iType = headers.indexOf('Type');
        const iTahun = headers.indexOf('Tahun');
        const iLast = headers.indexOf('LastNumber');
        const iUpdated = headers.indexOf('UpdatedAt');

        const lastRow = sheet.getLastRow();
        let rowIndex = -1;
        if (lastRow > 1) {
            const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
            for (let r = 0; r < data.length; r++) {
                const row = data[r];
                if (String(row[iType] || '') === type && Number(row[iTahun]) === year) {
                    rowIndex = r + 2;
                    break;
                }
            }
        }

        let nextNum = 1;
        if (rowIndex > 0) {
            const row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
            const current = parseInt(row[iLast], 10) || 0;
            nextNum = current + 1;
            sheet.getRange(rowIndex, iLast + 1).setValue(nextNum);
            sheet.getRange(rowIndex, iUpdated + 1).setValue(new Date());
        } else {
            const values = new Array(headers.length).fill('');
            values[iType] = type;
            values[iTahun] = year;
            values[iLast] = nextNum;
            values[iUpdated] = new Date();
            sheet.appendRow(values);
        }

        const seq = String(nextNum).padStart(3, '0');
        return seq + '/' + type + '/FKIK-UMSU/' + romanMonth + '/' + year;
    } finally {
        lock.releaseLock();
    }
}

function getRomanMonth(month) {
    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return roman[month] || String(month);
}

function getMasterOptions(kategori) {
    try {
        const rows = getAllRowsCached('MasterKegiatan', 300);
        const target = norm(kategori);
        const values = [];
        const seen = {};
        rows.forEach(function(r) {
            if (norm(r.Kategori) === target) {
                const v = String(r.Nilai || '').trim();
                if (v && !seen[v.toLowerCase()]) {
                    seen[v.toLowerCase()] = true;
                    values.push(v);
                }
            }
        });
        return values;
    } catch (e) {
        return [];
    }
}

function getBlokOptions() { return getMasterOptions('Blok'); }
function getUjianOptions() { return getMasterOptions('Ujian'); }
function getSgdOptions() { return getMasterOptions('SGD'); }
function getDetailSgdOptions() { return getMasterOptions('Detail SGD'); }
function getKkdOptions() { return getMasterOptions('KKD'); }
function getDetailKkdOptions() { return getMasterOptions('Detail KKD'); }
function getLabOptions() { return getMasterOptions('Lab'); }
function getKegiatanLabOptions() { return getMasterOptions('Kegiatan Lab'); }
function getDosenOptions() { return getMasterOptions('Dosen'); }

function getRegistrationOptions() {
    return {
        blok: getMasterOptions('Blok'),
        ujian: getMasterOptions('Ujian'),
        sgd: getMasterOptions('SGD'),
        detailSgd: getMasterOptions('Detail SGD'),
        kkd: getMasterOptions('KKD'),
        detailKkd: getMasterOptions('Detail KKD'),
        lab: getMasterOptions('Lab'),
        kegiatanLab: getMasterOptions('Kegiatan Lab'),
        dosen: getMasterOptions('Dosen'),
        buktiMode: getBuktiMode()
    };
}

function getBuktiMode() {
    try {
        const rows = getAllRowsCached('Config', 60);
        for (let i = 0; i < rows.length; i++) {
            if (String(rows[i].Key || '').trim() === 'BUKTI_MODE') {
                const v = String(rows[i].Value || '').trim();
                if (v === 'strict' || v === 'lenggang') return v;
            }
        }
        return 'strict';
    } catch (e) {
        return 'strict';
    }
}

function getMahasiswaByNpm(npm) {
    if (!npm) return null;
    return getRowByKey('Mahasiswa', 'NPM', String(npm).trim());
}

function getStudentNameByNpm(npm) {
    const m = getMahasiswaByNpm(npm);
    return m ? (m['Nama Lengkap'] || '') : '';
}

function getBagianMappings() {
    try {
        return getAllRows('MasterBagian');
    } catch (e) {
        return [];
    }
}

function getBagianStaffList() {
    try {
        return getAllRowsCached('BagianStaff', 60);
    } catch (e) {
        return [];
    }
}

function getAllPengajuan() {
    return getAllRows('Pengajuan');
}

function getPengajuanWithDetails(idPengajuan) {
    const pengajuan = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
    if (!pengajuan) return null;
    const details = getAllRows('DetailKegiatan').filter(function(r) {
        return String(r['ID Pengajuan'] || '').trim() === String(idPengajuan || '').trim();
    });
    const copy = _clientRow(pengajuan);
    copy.details = details.map(function(d) { return _clientRow(d); });
    copy.Biaya = _resolveBiayaForPengajuan(pengajuan);
    copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
    return copy;
}

function getStatusHistory(idPengajuan) {
    return getAllRows('StatusHistory').filter(function(r) {
        return String(r['ID Pengajuan'] || '').trim() === String(idPengajuan || '').trim();
    });
}

function saveMasterKegiatan(payload) {
    try {
        requireAuthorized(arguments[arguments.length - 1]);
        invalidateSheetCache('MasterKegiatan');
        const rows = (payload && payload.rows) ? payload.rows : [];
        const sheet = getGlobalSpreadsheet().getSheetByName('MasterKegiatan');
        if (!sheet) throw new Error('Sheet MasterKegiatan tidak ditemukan.');
        const headers = getHeadersFromSheet(sheet);
        sheet.clearContents();
        sheet.appendRow(headers);
        rows.forEach(function(r) {
            const kategori = String((r && (r.Kategori || r.kategori)) || '').trim();
            const nilai = String((r && (r.Nilai || r.nilai)) || '').trim();
            if (kategori || nilai) {
                sheet.appendRow([kategori, nilai]);
            }
        });
        formatHeaderRow(sheet);
        applyDropdownValidation(getGlobalSpreadsheet(), 'MasterKegiatan', 'Kategori', KATEGORI_MASTER);
        return { success: true, message: 'Master kegiatan diperbarui.' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function _saveFileToDrive(base64, mimeType, fileName, prefix) {
    let folder;
    try {
        folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } catch (e) {
        folder = DriveApp.getRootFolder();
    }
    const safeName = String(fileName || (prefix || 'file')).replace(/[\/\\?%*:|"<>]/g, '_');
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || 'application/octet-stream', safeName);
    const file = folder.createFile(blob);
    try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { }
    return file.getUrl();
}

function uploadBuktiFiles(payload) {
    try {
        const idPengajuan = String((payload && (payload.idPengajuan || payload.IdPengajuan)) || '').trim();
        if (!idPengajuan) {
            return { success: false, message: 'ID Pengajuan tidak tersedia.' };
        }
        const existing = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
        if (!existing) {
            return { success: false, message: 'Pengajuan tidak ditemukan.' };
        }

        if (payload && payload.buktiFile && payload.buktiFile.data) {
            if (getBuktiMode() === 'strict') {
                let head = '';
                try {
                    head = Utilities.newBlob(Utilities.base64Decode(payload.buktiFile.data)).getDataAsString().slice(0, 5);
                } catch (e) { }
                if (head.indexOf('%PDF') !== 0) {
                    return { success: false, message: 'Maaf, bukti bayar bukan PDF portal (header: ' + JSON.stringify(head) + '). Gunakan PDF asli.' };
                }
            }
        }

        let accUrl = '';
        if (payload && payload.accFile && payload.accFile.data) {
            accUrl = _saveFileToDrive(payload.accFile.data, payload.accFile.mimeType, payload.accFile.name, 'acc-' + idPengajuan);
        }
        let buktiUrl = '';
        if (payload && payload.buktiFile && payload.buktiFile.data) {
            buktiUrl = _saveFileToDrive(payload.buktiFile.data, payload.buktiFile.mimeType, payload.buktiFile.name, 'bukti-' + idPengajuan);
        }
        if (!accUrl && !buktiUrl) {
            return { success: false, message: 'Tidak ada file yang diunggah.' };
        }

        return uploadBuktiBayar({ idPengajuan: idPengajuan }, accUrl, buktiUrl);
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function getPengajuanByNpm(npm) {
    try {
        const npmVal = _normalizeFormText(npm);
        if (!npmVal) {
            return { success: false, message: 'NPM wajib diisi.' };
        }
        const all = getAllRows('Pengajuan');
        const details = getAllRows('DetailKegiatan');
        const histories = getAllRows('StatusHistory');
        const rows = all.filter(function(p) {
            return String(p['NPM'] || '').trim() === npmVal;
        }).map(function(p) {
            const id = String(p['ID Pengajuan'] || '').trim();
            return {
                pengajuan: p,
                details: details.filter(function(d) {
                    return String(d['ID Pengajuan'] || '').trim() === id;
                }),
                history: histories.filter(function(h) {
                    return String(h['ID Pengajuan'] || '').trim() === id;
                })
            };
        });
        return { success: true, rows: rows };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// Portal mahasiswa: kembalikan payload ringkas dalam kontrak info.html
// { nama, npm, buktiMode, history[] } atau { error }.
function getStudentPortalData(npm) {
    try {
        const npmRaw = String(npm || '').trim();
        const npmKey = _normalizeNpm(npmRaw);
        if (!npmKey) {
            return { error: 'NPM tidak boleh kosong' };
        }
        const all = getAllRows('Pengajuan');
        const details = getAllRows('DetailKegiatan');
        let namaLengkap = '';
        const history = [];

        const rows = all.filter(function(p) {
            return _normalizeNpm(p['NPM']) === npmKey;
        });
        rows.forEach(function(p) {
            if (!namaLengkap && p['Nama Lengkap']) {
                namaLengkap = String(p['Nama Lengkap']).trim();
            }
            const id = String(p['ID Pengajuan'] || '').trim();
            const pDetails = details.filter(function(d) {
                return String(d['ID Pengajuan'] || '').trim() === id;
            });
            const detailText = pDetails.map(function(d) {
                return [d.Pilihan || '', d.Detail || ''].filter(Boolean).join(' - ');
            }).filter(Boolean).join('; ');
            const tanggalKegiatan = pDetails.length
                ? (pDetails[0]['Tanggal Pelaksanaan'] || '')
                : (p['Tanggal Pelaksanaan'] || '');
            const hasUpload = !!(p['Link ACC INHAL'] || p['Link Bukti Bayar']);
            history.push({
                id: id,
                idPengajuan: id,
                tanggalAjuan: _clientDate(p.Timestamp) || '',
                blok: p.Blok || '',
                jenis: String(p['Jenis Kegiatan'] || '').trim(),
                detail: detailText,
                tanggalKegiatan: _clientDate(tanggalKegiatan),
                status: p.Status || 'Menunggu',
                reason: p['Catatan Admin'] || '',
                hasUpload: hasUpload,
                linkFinal: p['Link Final'] || '',
                uploadTimestamp: hasUpload ? (_clientDate(p.UpdatedAt) || 'Uploaded') : ''
            });
        });

        if (!namaLengkap) {
            namaLengkap = getStudentNameByNpm(npmKey);
        }
        if (!namaLengkap && history.length === 0) {
            const sample = all.slice(0, 8).map(function(p) {
                return String(p['NPM'] || '').trim();
            }).filter(Boolean).join(', ');
            return {
                error: 'Data pengajuan tidak ditemukan untuk NPM ' + npmRaw + ' (total ' + all.length + ' pengajuan terdata' + (sample ? '; NPM terdata: ' + sample : '') + ').'
            };
        }

        history.sort(function(a, b) {
            return String(b.tanggalAjuan || '').localeCompare(String(a.tanggalAjuan || ''));
        });

        let latestEmail = '';
        let latestNoHp = '';
        const sortedRows = rows.slice().sort(function(a, b) {
            const ta = (a.Timestamp instanceof Date) ? a.Timestamp.getTime() : 0;
            const tb = (b.Timestamp instanceof Date) ? b.Timestamp.getTime() : 0;
            return tb - ta;
        });
        for (let i = 0; i < sortedRows.length; i++) {
            if (!latestEmail && sortedRows[i]['Email']) latestEmail = String(sortedRows[i]['Email']).trim();
            if (!latestNoHp && sortedRows[i]['No. HP/WA']) latestNoHp = String(sortedRows[i]['No. HP/WA']).trim();
            if (latestEmail && latestNoHp) break;
        }

        return {
            nama: namaLengkap || 'Mahasiswa',
            npm: npmRaw,
            email: latestEmail,
            noHp: latestNoHp,
            buktiMode: getBuktiMode(),
            history: history
        };
    } catch (e) {
        return { error: 'Terjadi kesalahan saat mengambil data portal: ' + e.message };
    }
}

function _countRows(sheetName) {
    try {
        const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
        if (!sheet) return -1;
        return sheet.getLastRow() - 1;
    } catch (e) {
        return -1;
    }
}

function diagnosticData() {
    const diagToken = arguments[arguments.length - 1];
    requireAuthorized(diagToken);
    const ss = getGlobalSpreadsheet();
    const sheets = ss.getSheets().map(function(s) {
        return { name: s.getName(), lastRow: s.getLastRow(), lastCol: s.getLastColumn() };
    });

    const pengajuan = getAllRows('Pengajuan');

    const npmDebug = pengajuan.map(function(p) {
        const raw = p['NPM'];
        const s = String(raw || '');
        const codes = [];
        for (let i = 0; i < s.length; i++) codes.push(s.charCodeAt(i));
        const st = String(p.Status || '');
        const stCodes = [];
        for (let j = 0; j < st.length; j++) stCodes.push(st.charCodeAt(j));
        return {
            type: typeof raw,
            value: JSON.stringify(s),
            charCodes: codes.join(' '),
            nama: String(p['Nama Lengkap'] || ''),
            status: JSON.stringify(st),
            statusCodes: stCodes.join(' '),
            timestampType: (p.Timestamp instanceof Date) ? 'Date' : (typeof p.Timestamp)
        };
    });

    let portalResult = null;
    try {
        const pr = getStudentPortalData('2508260032');
        if (pr && pr.error) {
            portalResult = { error: pr.error };
        } else {
            portalResult = {
                nama: pr && pr.nama,
                historyCount: (pr && pr.history && pr.history.length) || 0,
                firstHistory: (pr && pr.history && pr.history[0]) ? { jenis: pr.history[0].jenis, status: pr.history[0].status } : null
            };
        }
    } catch (e) {
        portalResult = { __error: (e && e.message) ? e.message : String(e) };
    }

    let listResult = null;
    try {
        const l = getPengajuanList({}, diagToken);
        listResult = {
            length: (l && l.length) || 0,
            first: (l && l[0]) ? { npm: l[0]['NPM'], nama: l[0]['Nama Lengkap'], status: l[0]['Status'] } : null
        };
    } catch (e) {
        listResult = { __error: (e && e.message) ? e.message : String(e) };
    }

    let menungguResult = null;
    try {
        const ml = getPengajuanList({ status: 'Menunggu' }, diagToken);
        menungguResult = {
            length: (ml && ml.length) || 0,
            statuses: (ml || []).map(function(r) { return JSON.stringify(String(r['Status'] || '')); })
        };
    } catch (e) {
        menungguResult = { __error: (e && e.message) ? e.message : String(e) };
    }

    return {
        sheetId: DATABASE_SHEET_ID,
        sheets: sheets,
        counts: {
            Pengajuan: pengajuan.length,
            DetailKegiatan: _countRows('DetailKegiatan'),
            StatusHistory: _countRows('StatusHistory'),
            CheckData: _countRows('CheckData'),
            Mahasiswa: _countRows('Mahasiswa'),
            LogData: _countRows('LogData')
        },
        npmDebug: npmDebug,
        portalResult: portalResult,
        listResult: listResult,
        menungguResult: menungguResult
    };
}

function getBaginaConfig() {
    return {
        categories: ['SGD', 'KKD', 'Ujian', 'Praktikum'],
        labOptions: getMasterOptions('Lab'),
        kegiatanLabOptions: getMasterOptions('Kegiatan Lab'),
        ba: _getBagianBaSettings()
    };
}

function _getConfigValue(key, fallback) {
    try {
        const rows = getAllRowsCached('Config', 60);
        for (let i = 0; i < rows.length; i++) {
            if (String(rows[i].Key || '').trim() === key) {
                const v = String(rows[i].Value || '').trim();
                return v === '' ? fallback : v;
            }
        }
    } catch (e) {}
    return fallback;
}

function _setConfigValue(key, value) {
    invalidateSheetCache('Config');
    const sheet = getGlobalSpreadsheet().getSheetByName('Config');
    if (!sheet) throw new Error('Sheet Config tidak ditemukan.');
    const last = sheet.getLastRow();
    if (last > 1) {
        const keys = sheet.getRange(2, 1, last - 1, 1).getValues();
        for (let i = 0; i < keys.length; i++) {
            if (String(keys[i][0] || '').trim() === key) {
                sheet.getRange(i + 2, 2).setValue(String(value));
                return;
            }
        }
    }
    sheet.appendRow([key, String(value)]);
}

function _getBagianBaStatuses() {
    const raw = _getConfigValue('BAGIAN_BA_STATUSES', '');
    const def = ['Diterima', 'ACC'];
    if (!raw) return def;
    const list = raw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    return list.length ? list : def;
}

function _getBagianBaFinalOnly() {
    return _getConfigValue('BAGIAN_BA_FINAL_ONLY', 'true') !== 'false';
}

function _getBagianBaSettings() {
    return {
        statuses: _getBagianBaStatuses(),
        finalOnly: _getBagianBaFinalOnly()
    };
}

function getBagianBaSettings() {
    requireAuthorized(arguments[arguments.length - 1]);
    return _getBagianBaSettings();
}

function saveBagianBaSettings(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    const raw = (payload && payload.statuses) ? payload.statuses : [];
    const statuses = [];
    const seen = {};
    (Array.isArray(raw) ? raw : [raw]).forEach(function(s) {
        const v = String(s || '').trim();
        if (v && !seen[v]) { seen[v] = true; statuses.push(v); }
    });
    const valid = Object.keys(STATUS).map(function(k) { return STATUS[k]; });
    const invalid = statuses.filter(function(s) { return valid.indexOf(s) === -1; });
    if (invalid.length) {
        return { success: false, message: 'Status tidak dikenal: ' + invalid.join(', ') };
    }
    if (!statuses.length) {
        return { success: false, message: 'Pilih minimal satu status peserta untuk Berita Acara.' };
    }
    _setConfigValue('BAGIAN_BA_STATUSES', statuses.join(','));
    const finalOnly = (payload && payload.finalOnly !== undefined) ? !!payload.finalOnly : true;
    _setConfigValue('BAGIAN_BA_FINAL_ONLY', finalOnly ? 'true' : 'false');
    return { success: true, message: 'Pengaturan Berita Acara Bagian diperbarui.' };
}

function _getBagianStaffMap() {
    const rows = getBagianStaffList();
    const map = {};
    rows.forEach(function(r) {
        const email = String(r.Email || '').trim().toLowerCase();
        if (!email) return;
        if (!map[email]) map[email] = { kategoris: [], nama: String(r.Nama || '').trim() };
        const kategori = String(r.Kategori || '').trim();
        if (kategori) map[email].kategoris.push(kategori.toLowerCase());
    });
    return map;
}

function _normBaginaKey(v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function _isWildcardBaginaKategori(k) {
    const v = _normBaginaKey(k);
    return v === '' || v === '*' || v === 'semua' || v === 'all';
}

function _getBagianAliasMap() {
    const map = {};
    try {
        getAllRows('MasterBagian').forEach(function(r) {
            const lab = _normBaginaKey(r.Lab);
            if (!lab) return;
            ['Lab', 'Kegiatan Lab', 'Bagian'].forEach(function(field) {
                const k = _normBaginaKey(r[field]);
                if (k) map[k] = lab;
            });
        });
    } catch (e) {}
    return map;
}

function _baginaHasAccess(entry, kategori, subBagian) {
    if (!entry || !entry.kategoris || entry.kategoris.length === 0) return true;
    const kat = _normBaginaKey(kategori);
    const sub = _normBaginaKey(subBagian);
    const isPraktikum = kat === 'praktikum';
    const aliasMap = (isPraktikum && sub) ? _getBagianAliasMap() : null;
    for (let i = 0; i < entry.kategoris.length; i++) {
        const raw = entry.kategoris[i];
        const nk = _normBaginaKey(raw);
        if (_isWildcardBaginaKategori(raw)) return true;
        if (nk === kat) return true;
        if (isPraktikum && nk.indexOf('lab') !== -1 && (!sub || nk.indexOf(sub) !== -1)) return true;
        if (sub && nk === sub) return true;
        if (sub && aliasMap && aliasMap[nk] === sub) return true;
    }
    return false;
}

function requireBaginaSession(kategori, subBagian, token) {
    const s = getSession(token);
    if (!s || s.role !== 'bagian') {
        throw new Error('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
    }
    const kat = String(kategori || '').trim();
    if (kat && !_baginaHasAccess({ kategoris: s.kategoris || [] }, kat, subBagian)) {
        throw new Error('Akses ditolak. Akun ini terdaftar untuk kategori: ' + ((s.kategoris || []).join(', ') || '(semua)') + '.');
    }
    _CURRENT_SESSION = s;
    return s;
}

function _computeBagianRows(kategori, subBagian) {
    const all = getAllRows('Pengajuan');
    const details = getAllRows('DetailKegiatan');
    const kat = _normBaginaKey(kategori);
    const sub = _normBaginaKey(subBagian);
    const byId = {};
    details.forEach(function(d) {
        const id = String(d['ID Pengajuan'] || '').trim();
        if (!id) return;
        if (!byId[id]) byId[id] = [];
        byId[id].push(d);
    });
    const rows = [];
    all.forEach(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        const ds = byId[id];
        if (!ds) return;
        ds.forEach(function(d) {
            const dJenis = _normBaginaKey(d['Jenis Kegiatan']);
            if (kat && dJenis !== kat) return;
            if (kat === 'praktikum' && sub) {
                const dBagian = _normBaginaKey(d.Bagian);
                const dPilihan = _normBaginaKey(d.Pilihan);
                if (dBagian !== sub && dPilihan !== sub) return;
            }
            rows.push({
                idPengajuan: id,
                npm: String(p['NPM'] || '').trim(),
                namaLengkap: String(p['Nama Lengkap'] || '').trim(),
                blok: String(p['Blok'] || '').trim(),
                jenis: String(d['Jenis Kegiatan'] || '').trim(),
                pilihan: String(d.Pilihan || '').trim(),
                detail: String(d.Detail || '').trim(),
                tanggal: _clientDate(d['Tanggal Pelaksanaan']) || '',
                bagian: String(d.Bagian || '').trim(),
                status: String(p.Status || '').trim(),
                linkSurat: String(p['Link Surat Keterangan'] || '').trim(),
                linkFinal: String(p['Link Final'] || '').trim()
            });
        });
    });
    return rows;
}

function generateBaId(baSheet) {
    const now = new Date();
    const year = now.getFullYear();
    const prefix = 'BA-' + year + '-';
    let maxSeq = 0;
    const lastRow = baSheet.getLastRow();
    if (lastRow > 1) {
        const ids = baSheet.getRange(2, 2, lastRow - 1, 1).getValues();
        ids.forEach(function(row) {
            const id = String(row[0] || '').trim();
            if (id.indexOf(prefix) === 0) {
                const num = parseInt(id.substring(prefix.length), 10);
                if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
        });
    }
    return prefix + String(maxSeq + 1).padStart(4, '0');
}

function normalizeBaPeserta(payload) {
    const peserta = [];
    const raw = payload && payload.peserta ? payload.peserta : [];
    if (Array.isArray(raw)) {
        raw.forEach(function(p) {
            const npm = String((p && p.npm) || '').trim();
            const nama = String((p && p.namaLengkap) || (p && p.nama) || '').trim();
            if (npm || nama) {
                peserta.push({
                    idPengajuan: String((p && p.idPengajuan) || '').trim(),
                    npm: npm,
                    namaLengkap: nama,
                    blok: String((p && p.blok) || '').trim(),
                    statusPengajuan: String((p && p.statusPengajuan) || (p && p.status) || '').trim()
                });
            }
        });
    }
    return peserta;
}

function _validateBaPesertaStatus(peserta) {
    const allowed = _getBagianBaStatuses();
    const pMap = {};
    getAllRows('Pengajuan').forEach(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        if (id) pMap[id] = p;
    });
    const blocked = [];
    peserta.forEach(function(p) {
        const pid = String(p.idPengajuan || '').trim();
        const pr = pid ? pMap[pid] : null;
        const st = pr ? String(pr.Status || '').trim() : String(p.statusPengajuan || '').trim();
        if (st && allowed.indexOf(st) === -1) {
            blocked.push((p.namaLengkap || p.npm) + ' (' + st + ')');
        }
    });
    return blocked;
}

function uploadBeritaAcaraBagian(payload, kategori) {
    try {
        requireBaginaSession(kategori, payload && payload.bagian, arguments[arguments.length - 1]);
        const ss = getGlobalSpreadsheet();
        const baSheet = ss.getSheetByName('BeritaAcara');
        const pesertaSheet = ss.getSheetByName('BeritaAcaraPeserta');
        if (!baSheet || !pesertaSheet) {
            return { success: false, message: 'Sheet BeritaAcara tidak ditemukan. Jalankan setupDatabase() dahulu.' };
        }

        const baId = generateBaId(baSheet);
        let fileUrl = '';
        let fileName = '';
        if (payload && payload.file && payload.file.data) {
            fileUrl = _saveFileToDrive(payload.file.data, payload.file.mimeType, payload.file.name, 'ba-' + baId);
            fileName = String(payload.file.name || '').trim();
        }

        const peserta = normalizeBaPeserta(payload);

        const blocked = _validateBaPesertaStatus(peserta);
        if (blocked.length) {
            const allowed = _getBagianBaStatuses();
            return {
                success: false,
                message: 'Upload dibatalkan: peserta belum berstatus ' + allowed.join(' / ') + ' — ' + blocked.join(', ') + '. Muat ulang data terlebih dahulu.'
            };
        }

        appendRowSafe('BeritaAcara', {
            Timestamp: new Date(),
            'BA ID': baId,
            'Bagian': String((payload && payload.bagian) || kategori || '').trim(),
            'Blok': String((payload && payload.blok) || '').trim(),
            'Nama Kegiatan': String((payload && payload.namaKegiatan) || '').trim(),
            'Tanggal Pelaksanaan': String((payload && payload.tanggalPelaksanaan) || '').trim(),
            'Jumlah Peserta': peserta.length,
            'File Name': fileName,
            'File URL': fileUrl,
            'Catatan': String((payload && payload.catatan) || '').trim(),
            'Sumber': 'Bagian'
        });

        peserta.forEach(function(p) {
            appendRowSafe('BeritaAcaraPeserta', {
                Timestamp: new Date(),
                'BA ID': baId,
                'NPM': p.npm,
                'Nama Lengkap': p.namaLengkap,
                'Blok': p.blok,
                'Bagian': String((payload && payload.bagian) || kategori || '').trim(),
                'Status Pengajuan': p.statusPengajuan
            });
        });

        return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function _baSumber(r) {
    const s = String((r && r.Sumber) || '').trim().toLowerCase();
    return s === 'admin' ? 'Admin' : 'Bagian';
}

function _getBaPesertaMap() {
    const map = {};
    getAllRows('BeritaAcaraPeserta').forEach(function(r) {
        const id = String(r['BA ID'] || '').trim();
        if (!id) return;
        if (!map[id]) map[id] = [];
        map[id].push({
            npm: String(r.NPM || '').trim(),
            namaLengkap: String(r['Nama Lengkap'] || '').trim(),
            blok: String(r.Blok || '').trim()
        });
    });
    return map;
}

function _getBaPesertaMapAdmin() {
    const map = {};
    getAllRows('BeritaAcaraAdminPeserta').forEach(function(r) {
        const id = String(r['BA ID'] || '').trim();
        if (!id) return;
        if (!map[id]) map[id] = [];
        map[id].push({
            npm: String(r.NPM || '').trim(),
            namaLengkap: String(r['Nama Lengkap'] || '').trim(),
            blok: String(r.Blok || '').trim()
        });
    });
    return map;
}

function _computeBaList(bagianFilter, kategori) {
    const rows = getAllRows('BeritaAcara').filter(function(r) {
        return _baSumber(r) === 'Bagian';
    });
    const filter = _normBaginaKey(bagianFilter);
    const kat = _normBaginaKey(kategori);
    const isPraktikum = kat === 'praktikum';
    const labs = isPraktikum ? getMasterOptions('Lab') : null;
    const pesertaMap = _getBaPesertaMap();
    const sanitized = rows.map(function(r) {
        const c = _clientRow(r);
        c.peserta = pesertaMap[String(r['BA ID'] || '').trim()] || [];
        return c;
    });
    if (filter) {
        return sanitized.filter(function(r) {
            if (isPraktikum) {
                const resolved = _resolveBagian12(r.Bagian, '', r['Nama Kegiatan'], labs);
                return resolved ? _normBaginaKey(resolved) === filter : false;
            }
            return _normBaginaKey(r.Bagian) === filter;
        });
    }
    return sanitized;
}

function getBeritaAcaraList(bagianFilter, kategori) {
    try {
        requireBaginaSession(kategori, '', arguments[arguments.length - 1]);
        return _computeBaList(bagianFilter, kategori);
    } catch (e) {
        return [];
    }
}

function getBagianBootstrap(kategori, subBagian, token) {
    const out = {
        ok: false,
        message: '',
        nama: '',
        kategori: String(kategori || '').trim(),
        subBagian: String(subBagian || '').trim(),
        config: { categories: ['SGD', 'KKD', 'Ujian', 'Praktikum'], labOptions: [], kegiatanLabOptions: [] },
        rows: [],
        baList: []
    };
    try {
        const s = getSession(token);
        if (!s || s.role !== 'bagian') {
            out.message = 'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.';
            return out;
        }
        const kat = out.kategori;
        if (kat && !_baginaHasAccess({ kategoris: s.kategoris || [] }, kat, subBagian)) {
            out.message = 'Akun ini terdaftar untuk kategori: ' + ((s.kategoris || []).join(', ') || '(semua)') + '. Bukan ' + kat + '.';
            return out;
        }
        _CURRENT_SESSION = s;
        out.ok = true;
        out.nama = s.nama || '';
        out.config.labOptions = getMasterOptions('Lab');
        out.config.kegiatanLabOptions = getMasterOptions('Kegiatan Lab');
        out.rows = _computeBagianRows(kat, subBagian);
        out.baList = _computeBaList(subBagian || out.kategori, out.kategori);
        return out;
    } catch (e) {
        out.message = e.message;
        return out;
    }
}

function getDashboardStats() {
    requireAuthorized(arguments[arguments.length - 1]);
    return _computeDashboardStats(
        getAllRows('Pengajuan'),
        getAllRows('DetailKegiatan'),
        getAllRows('BeritaAcara'),
        _getBiayaMap()
    );
}

function _computeDashboardStats(pengajuan, details, ba, biayaMap) {
    const perStatus = {};
    const perJenis = {};
    const perBlok = {};
    const trend = {};
    const perBagian = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const labs = getMasterOptions('Lab');
    let totalBiaya = 0;

    pengajuan.forEach(function(p) {
        const status = String(p.Status || 'Lainnya').trim();
        perStatus[status] = (perStatus[status] || 0) + 1;

        const jenis = String(p['Jenis Kegiatan'] || 'Lainnya').trim();
        perJenis[jenis] = (perJenis[jenis] || 0) + 1;

        const blok = String(p.Blok || '-').trim();
        perBlok[blok] = (perBlok[blok] || 0) + 1;

        totalBiaya += _resolveBiayaForPengajuan(p, biayaMap);

        const ts = p.Timestamp;
        if (ts) {
            const d = ts instanceof Date ? ts : new Date(ts);
            if (!isNaN(d.getTime())) {
                const key = months[d.getMonth()] + ' ' + d.getFullYear();
                trend[key] = (trend[key] || 0) + 1;
            }
        }
    });

    details.forEach(function(d) {
        const bagian = _normBagianAggregateWithLabs(d['Jenis Kegiatan'] || d.Bagian, labs);
        perBagian[bagian] = (perBagian[bagian] || 0) + 1;
    });
    ba.forEach(function(b) {
        if (_baSumber(b) !== 'Bagian') return;
        const bagian = _normBagianAggregateWithLabs(b.Bagian, labs);
        perBagian[bagian] = (perBagian[bagian] || 0) + parseInt(b['Jumlah Peserta'], 10) || 0;
    });

    return {
        total: pengajuan.length,
        perStatus: perStatus,
        perJenis: perJenis,
        perBlok: perBlok,
        trend: trend,
        perBagian: perBagian,
        totalBiaya: totalBiaya,
        biayaMap: biayaMap
    };
}

function getPengajuanList(filters) {
    requireAuthorized(arguments[arguments.length - 1]);
    filters = filters || {};
    const fStatus = String(filters.status || '').trim();
    const fJenis = String(filters.jenis || '').trim();
    const fBlok = String(filters.blok || '').trim();
    const q = norm(filters.search || '');

    let rows = getAllRows('Pengajuan');
    if (fStatus) rows = rows.filter(function(r) { return String(r.Status || '').trim() === fStatus; });
    if (fJenis) rows = rows.filter(function(r) { return String(r['Jenis Kegiatan'] || '').trim() === fJenis; });
    if (fBlok) rows = rows.filter(function(r) { return String(r.Blok || '').trim() === fBlok; });
    if (q) {
        rows = rows.filter(function(r) {
            const npm = norm(r.NPM);
            const nama = norm(r['Nama Lengkap']);
            return (npm && npm.indexOf(q) !== -1) || (nama && nama.indexOf(q) !== -1);
        });
    }
    rows.sort(function(a, b) {
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
    const biayaMap = _getBiayaMap();
    return _buildPengajuanClientRows(rows, biayaMap);
}

function _buildPengajuanClientRows(rows, biayaMap) {
    return rows.map(function(r) {
        const copy = _clientRow(r);
        copy.Biaya = _resolveBiayaForPengajuan(copy, biayaMap);
        copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
        return copy;
    });
}

function getDashboardBootstrap() {
    requireAuthorized(arguments[arguments.length - 1]);
    const pengajuan = getAllRows('Pengajuan');
    const details = getAllRows('DetailKegiatan');
    const ba = getAllRows('BeritaAcara');
    const biayaMap = _getBiayaMap();
    const adminBaPesertaMap = _getBaPesertaMapAdmin();

    const sortedPengajuan = pengajuan.slice().sort(function(a, b) {
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
    const adminBa = getAllRows('BeritaAcaraAdmin').slice().sort(function(a, b) { return String(b.Timestamp || '').localeCompare(String(a.Timestamp || '')); });

    const detailMap = {};
    details.forEach(function(d) {
        const id = String(d['ID Pengajuan'] || '').trim();
        if (!id) return;
        if (!detailMap[id]) detailMap[id] = [];
        detailMap[id].push(_clientRow(d));
    });

    return {
        stats: _computeDashboardStats(pengajuan, details, ba, biayaMap),
        pengajuan: _buildPengajuanClientRows(sortedPengajuan, biayaMap),
        detailMap: detailMap,
        bagian: _computeBagianAggregation(pengajuan, details, ba),
        beritaAcara: adminBa.map(function(r) {
            const c = _clientRow(r);
            c.peserta = adminBaPesertaMap[String(r['BA ID'] || '').trim()] || [];
            return c;
        })
    };
}

function getDetailLaporanData() {
    requireAuthorized(arguments[arguments.length - 1]);
    const pengajuan = getAllRows('Pengajuan');
    const details = getAllRows('DetailKegiatan');
    const histories = getAllRows('StatusHistory');

    let totalPendaftar = 0;
    let totalDiterima = 0;
    let totalDitolak = 0;
    let totalMenunggu = 0;
    let totalAcc = 0;
    let totalBiaya = 0;
    const perJenis = {};
    const perBlok = {};
    const biayaMap = _getBiayaMap();

    const rows = pengajuan.map(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        const status = String(p.Status || '').trim();
        totalPendaftar++;
        if (status === 'Diterima') totalDiterima++;
        if (status === 'Ditolak') totalDitolak++;
        if (status === 'Menunggu') totalMenunggu++;
        if (status === 'ACC') totalAcc++;
        const jenis = String(p['Jenis Kegiatan'] || 'Lainnya').trim();
        perJenis[jenis] = (perJenis[jenis] || 0) + 1;
        const blok = String(p.Blok || '-').trim();
        perBlok[blok] = (perBlok[blok] || 0) + 1;

        const pengajuanCopy = _clientRow(p);
        pengajuanCopy.Biaya = _resolveBiayaForPengajuan(pengajuanCopy, biayaMap);
        pengajuanCopy['Biaya Rupiah'] = formatRupiah(pengajuanCopy.Biaya);
        totalBiaya += pengajuanCopy.Biaya;

        return {
            pengajuan: pengajuanCopy,
            details: details.filter(function(d) { return String(d['ID Pengajuan'] || '').trim() === id; }).map(function(d) { return _clientRow(d); }),
            history: histories.filter(function(h) { return String(h['ID Pengajuan'] || '').trim() === id; }).map(function(h) { return _clientRow(h); })
        };
    });

    return {
        summary: {
            totalPendaftar: totalPendaftar,
            totalDiterima: totalDiterima,
            totalDitolak: totalDitolak,
            totalMenunggu: totalMenunggu,
            totalAcc: totalAcc,
            totalBiaya: totalBiaya,
            perJenis: perJenis,
            perBlok: perBlok
        },
        rows: rows
    };
}

function getLaporanBootstrap() {
    requireAuthorized(arguments[arguments.length - 1]);
    const pengajuan = getAllRows('Pengajuan');
    const details = getAllRows('DetailKegiatan');
    const histories = getAllRows('StatusHistory');
    const ba = getAllRows('BeritaAcara');
    const biayaMap = _getBiayaMap();
    const baPesertaMap = _getBaPesertaMap();

    let totalPendaftar = 0;
    let totalDiterima = 0;
    let totalDitolak = 0;
    let totalMenunggu = 0;
    let totalAcc = 0;
    let totalBiaya = 0;
    const perJenis = {};
    const perBlok = {};
    const perStatus = {};

    const rows = pengajuan.map(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        const status = String(p.Status || '').trim();
        totalPendaftar++;
        if (status === 'Diterima') totalDiterima++;
        if (status === 'Ditolak') totalDitolak++;
        if (status === 'Menunggu') totalMenunggu++;
        if (status === 'ACC') totalAcc++;
        perStatus[status || 'Lainnya'] = (perStatus[status || 'Lainnya'] || 0) + 1;
        const jenis = String(p['Jenis Kegiatan'] || 'Lainnya').trim();
        perJenis[jenis] = (perJenis[jenis] || 0) + 1;
        const blok = String(p.Blok || '-').trim();
        perBlok[blok] = (perBlok[blok] || 0) + 1;

        const pengajuanCopy = _clientRow(p);
        pengajuanCopy.Biaya = _resolveBiayaForPengajuan(pengajuanCopy, biayaMap);
        pengajuanCopy['Biaya Rupiah'] = formatRupiah(pengajuanCopy.Biaya);
        totalBiaya += pengajuanCopy.Biaya;

        return {
            pengajuan: pengajuanCopy,
            details: details.filter(function(d) { return String(d['ID Pengajuan'] || '').trim() === id; }).map(function(d) { return _clientRow(d); }),
            history: histories.filter(function(h) { return String(h['ID Pengajuan'] || '').trim() === id; }).map(function(h) { return _clientRow(h); })
        };
    });

    const sortedBa = ba.slice().sort(function(a, b) {
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
    const beritaAcara = sortedBa.filter(function(r) {
        return _baSumber(r) === 'Bagian';
    }).map(function(r) {
        const c = _clientRow(r);
        c.peserta = baPesertaMap[String(r['BA ID'] || '').trim()] || [];
        return c;
    });

    const pushUnique = function(list, v) {
        v = String(v || '').replace(/\s+/g, ' ').trim();
        if (v && list.indexOf(v) === -1) list.push(v);
    };

    const dosen = [];
    pengajuan.forEach(function(p) { pushUnique(dosen, p.Dosen); });
    dosen.sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });

    const blok = [];
    pengajuan.forEach(function(p) { pushUnique(blok, p.Blok); });
    ba.forEach(function(b) { pushUnique(blok, b.Blok); });
    blok.sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });

    return {
        summary: {
            totalPendaftar: totalPendaftar,
            totalDiterima: totalDiterima,
            totalDitolak: totalDitolak,
            totalMenunggu: totalMenunggu,
            totalAcc: totalAcc,
            totalBiaya: totalBiaya,
            perJenis: perJenis,
            perBlok: perBlok,
            perStatus: perStatus
        },
        rows: rows,
        beritaAcara: beritaAcara,
        dosen: dosen,
        blok: blok,
        bagian: {
            categories: ['Ujian', 'SGD', 'KKD'],
            labs: getMasterOptions('Lab')
        }
    };
}

function getBagianAggregation() {
    requireAuthorized(arguments[arguments.length - 1]);
    return _computeBagianAggregation(getAllRows('Pengajuan'), getAllRows('DetailKegiatan'), getAllRows('BeritaAcara'));
}

function _computeBagianAggregation(pengajuan, details, ba) {
    const pMap = {};
    pengajuan.forEach(function(p) { pMap[String(p['ID Pengajuan']).trim()] = p; });

    const bagianRows = [];
    const bagianIndex = {};
    const labs = getMasterOptions('Lab');
    const pushUnique = function(list, v) {
        v = String(v || '').replace(/\s+/g, ' ').trim();
        if (v && list.indexOf(v) === -1) list.push(v);
    };

    const addRow = function(sumber, bagian, blok, jenisKegiatan, tgl, jumlah, fileUrl) {
        blok = String(blok || '-').replace(/\s+/g, ' ').trim();
        jenisKegiatan = String(jenisKegiatan || '-').replace(/\s+/g, ' ').trim();
        tgl = String(tgl || '-').replace(/\s+/g, ' ').trim();
        const key = [sumber, bagian, blok, jenisKegiatan, tgl].join('|');
        if (bagianIndex[key] !== undefined) {
            bagianRows[bagianIndex[key]].total += jumlah;
        } else {
            bagianIndex[key] = bagianRows.length;
            bagianRows.push({
                sumber: sumber,
                bagian: bagian,
                blok: blok,
                jenisKegiatan: jenisKegiatan,
                tanggalPelaksanaan: tgl,
                total: jumlah,
                fileUrl: fileUrl || ''
            });
        }
    };

    details.forEach(function(d) {
        const id = String(d['ID Pengajuan'] || '').trim();
        const p = pMap[id] || {};
        const bagian = _resolveBagian12(d['Jenis Kegiatan'] || d.Bagian, d.Pilihan || d.Bagian, '', labs) || 'Lainnya';
        const pilihan = String(d.Pilihan || '').trim();
        const detailText = String(d.Detail || '').trim();
        const jenisKegiatan = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
        addRow('Pengajuan', bagian, p.Blok, jenisKegiatan, _clientDate(d['Tanggal Pelaksanaan']), 1, '');
    });

    ba.forEach(function(b) {
        if (_baSumber(b) !== 'Bagian') return;
        const bagian = _resolveBagian12(b.Bagian, '', b['Nama Kegiatan'], labs);
        if (!bagian) return;
        const nama = String(b['Nama Kegiatan'] || '').trim();
        const jenisKegiatan = nama || 'Berita Acara';
        addRow('Berita Acara', bagian, b.Blok, jenisKegiatan, _clientDate(b['Tanggal Pelaksanaan']), parseInt(b['Jumlah Peserta'], 10) || 0, b['File URL']);
    });

    return {
        categories: _getBagianOptions12(labs),
        labs: labs,
        rows: bagianRows,
        filters: {
            bagian: _getBagianOptions12(labs),
            blok: (function() {
                const list = [];
                bagianRows.forEach(function(r) { pushUnique(list, r.blok); });
                return list;
            })(),
            sumber: ['Pengajuan', 'Berita Acara']
        }
    };
}

function getBeritaAcaraAdminList() {
    requireAuthorized(arguments[arguments.length - 1]);
    const rows = getAllRows('BeritaAcaraAdmin');
    rows.sort(function(a, b) {
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
    const pesertaMap = _getBaPesertaMapAdmin();
    return rows.map(function(r) {
        const c = _clientRow(r);
        c.peserta = pesertaMap[String(r['BA ID'] || '').trim()] || [];
        return c;
    });
}

function deleteBeritaAcaraAdmin(baId) {
    requireAuthorized(arguments[arguments.length - 1]);
    const baIdVal = String(baId || '').trim();
    if (!baIdVal) return { success: false, message: 'BA ID wajib diisi.' };

    const existing = getRowByKey('BeritaAcaraAdmin', 'BA ID', baIdVal);
    if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

    deleteRowByKey('BeritaAcaraAdmin', 'BA ID', baIdVal, 'Dihapus dari Panel Admin', getActorName());

    const pesertaRows = getAllRows('BeritaAcaraAdminPeserta').filter(function(r) {
        return String(r['BA ID'] || '').trim() === baIdVal;
    });
    pesertaRows.forEach(function(r) {
        deleteRowByKey('BeritaAcaraAdminPeserta', 'BA ID', baIdVal, 'Hapus peserta menyertai BA', getActorName());
    });

    const fileUrl = String(existing['File URL'] || '');
    const idMatch = fileUrl.match(/[=\/]([\w\-]{20,})/);
    if (idMatch) {
        try {
            DriveApp.getFileById(idMatch[1]).setTrashed(true);
        } catch (e) { }
    }

    return { success: true, message: 'Berita acara berhasil dihapus.' };
}

function getMasterDataMonitor() {
    requireAuthorized(arguments[arguments.length - 1]);
    return {
        masterKegiatan: getAllRows('MasterKegiatan'),
        masterBagian: getAllRows('MasterBagian'),
        masterBiaya: getAllRows('MasterBiaya'),
        config: getAllRows('Config'),
        bagianStaff: getAllRows('BagianStaff'),
        admin: getAllRows('Admin'),
        bagianSettings: _getBagianBaSettings()
    };
}

function saveMasterBagian(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    const rows = (payload && payload.rows) ? payload.rows : [];
    const sheet = getGlobalSpreadsheet().getSheetByName('MasterBagian');
    if (!sheet) throw new Error('Sheet MasterBagian tidak ditemukan.');
    const headers = getHeadersFromSheet(sheet);
    sheet.clearContents();
    sheet.appendRow(headers);
    rows.forEach(function(r) {
        const lab = String((r && (r.Lab || r.lab)) || '').trim();
        const kegiatan = String((r && (r['Kegiatan Lab'] || r.kegiatanLab)) || '').trim();
        const bagian = String((r && (r.Bagian || r.bagian)) || '').trim();
        const email = String((r && (r.Email || r.email)) || '').trim();
        if (lab || kegiatan || bagian || email) {
            sheet.appendRow([lab, kegiatan, bagian, email]);
        }
    });
    formatHeaderRow(sheet);
    return { success: true, message: 'Master bagian diperbarui.' };
}

function saveMasterBiaya(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    const rows = (payload && payload.rows) ? payload.rows : [];
    const sheet = getGlobalSpreadsheet().getSheetByName('MasterBiaya');
    if (!sheet) throw new Error('Sheet MasterBiaya tidak ditemukan.');
    const headers = getHeadersFromSheet(sheet);
    sheet.clearContents();
    sheet.appendRow(headers);
    rows.forEach(function(r) {
        const kegiatan = String((r && (r.Kegiatan || r.kegiatan)) || '').trim();
        const biaya = String((r && (r.Biaya || r.biaya)) || '').trim();
        if (kegiatan || biaya) {
            sheet.appendRow([kegiatan, biaya]);
        }
    });
    formatHeaderRow(sheet);
    return { success: true, message: 'Master biaya diperbarui.' };
}

function saveConfig(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    invalidateSheetCache('Config');
    const rows = (payload && payload.rows) ? payload.rows : [];
    const sheet = getGlobalSpreadsheet().getSheetByName('Config');
    if (!sheet) throw new Error('Sheet Config tidak ditemukan.');
    const headers = getHeadersFromSheet(sheet);
    sheet.clearContents();
    sheet.appendRow(headers);
    rows.forEach(function(r) {
        const key = String((r && (r.Key || r.key)) || '').trim();
        const value = String((r && (r.Value || r.value)) || '').trim();
        if (key) {
            sheet.appendRow([key, value]);
        }
    });
    formatHeaderRow(sheet);
    return { success: true, message: 'Config diperbarui.' };
}

function saveBagianStaff(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    invalidateSheetCache('BagianStaff');
    const rows = (payload && payload.rows) ? payload.rows : [];
    const sheet = getGlobalSpreadsheet().getSheetByName('BagianStaff');
    if (!sheet) throw new Error('Sheet BagianStaff tidak ditemukan.');
    const headers = ['Email', 'Kategori', 'Nama', 'Pass'];
    sheet.clearContents();
    sheet.appendRow(headers);
    rows.forEach(function(r) {
        const email = String((r && (r.Email || r.email)) || '').trim();
        const kategori = String((r && (r.Kategori || r.kategori)) || '').trim();
        const nama = String((r && (r.Nama || r.nama)) || '').trim();
        const pass = String((r && (r.Pass || r.pass)) || '').trim();
        if (email || pass) {
            sheet.appendRow([email, kategori, nama, pass]);
        }
    });
    formatHeaderRow(sheet);
    return { success: true, message: 'Bagian staff diperbarui.' };
}

function saveAdminList(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    invalidateSheetCache('Admin');
    const rows = (payload && payload.rows) ? payload.rows : [];
    const sheet = getGlobalSpreadsheet().getSheetByName('Admin');
    if (!sheet) throw new Error('Sheet Admin tidak ditemukan.');
    const headers = ['Password', 'Nama'];
    sheet.clearContents();
    sheet.appendRow(headers);
    rows.forEach(function(r) {
        const password = String((r && (r.Password || r.password || r.Email || r.email)) || '').trim();
        const nama = String((r && (r.Nama || r.nama)) || '').trim();
        if (password) {
            sheet.appendRow([password, nama]);
        }
    });
    formatHeaderRow(sheet);
    return { success: true, message: 'Daftar admin diperbarui.' };
}

// =================================================================
// ==================== EMAIL & PDF HELPERS ========================
// =================================================================

function formatIndonesianDate(date) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function parseCurrency(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const clean = String(str).replace(/[^0-9]/g, '');
    return parseInt(clean, 10) || 0;
}

function formatRupiah(num) {
    const n = Number(num) || 0;
    return 'Rp ' + n.toLocaleString('id-ID');
}

function _escapeHtmlForTemplate(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\r\n|\r|\n/g, '<br />');
}

function _stripPdfPreviewArtifacts(html) {
    return String(html || '')
        .replace(/<div class="preview-bar no-print">[\s\S]*?<\/div>/gi, '')
        .replace(/<p class="hint no-print">[\s\S]*?<\/p>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '');
}

function _renderPdfTemplateHtml(templateRef, data, status) {
    const fileName = String(templateRef || '').trim().replace(/\.html$/i, '');
    let html = HtmlService.createHtmlOutputFromFile(fileName).getContent();

    Object.keys(data || {}).forEach(function(key) {
        const token = '{{' + key + '}}';
        html = html.split(token).join(_escapeHtmlForTemplate(data[key]));
    });

    if (fileName === 'template-acc-diterima-ditolak') {
        const bodyClass = status === 'Ditolak' ? 'show-ditolak' : 'show-diterima';
        html = html.replace(/<body\b[^>]*>/i, '<body class="' + bodyClass + '">');
    }

    return _stripPdfPreviewArtifacts(html);
}

function _createPdfFromTemplate(templateRef, data, status) {
    try {
        const renderedHtml = _renderPdfTemplateHtml(templateRef, data, status);
        const pdfBlob = HtmlService.createHtmlOutput(renderedHtml)
            .getBlob()
            .getAs(MimeType.PDF);
        pdfBlob.setName((status || 'INHAL') + '_INHAL_' + (data.NPM || '') + '_' + (data['Nama Lengkap'] || '') + '.pdf');
        return pdfBlob;
    } catch (e) {
        console.error('Error _createPdfFromTemplate: ' + (e && e.message ? e.message : e));
        throw new Error('Gagal membuat PDF: ' + (e && e.message ? e.message : e));
    }
}

function _saveBlobToDrive(blob, prefix) {
    let folder;
    try {
        folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } catch (e) {
        folder = DriveApp.getRootFolder();
    }
    const safeName = String(blob && blob.getName ? blob.getName() : (prefix || 'file')).replace(/[\/\\?%*:|"<>]/g, '_');
    const file = folder.createFile(blob).setName(safeName);
    try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { }
    return file.getUrl();
}

function _getPengajuanDetails(idPengajuan) {
    const id = String(idPengajuan || '').trim();
    return getAllRows('DetailKegiatan').filter(function(r) {
        return String(r['ID Pengajuan'] || '').trim() === id;
    });
}

function _enhancePengajuanForTemplate(pengajuan, details, status) {
    const now = new Date();
    const enhanced = {
        NomorSurat: String((pengajuan && pengajuan['Nomor Surat']) || '').trim(),
        NPM: String((pengajuan && pengajuan.NPM) || '').trim(),
        'Nama Lengkap': String((pengajuan && pengajuan['Nama Lengkap']) || '').trim(),
        Email: String((pengajuan && pengajuan.Email) || '').trim(),
        'No. HP/WA': String((pengajuan && pengajuan['No. HP/WA']) || '').trim(),
        Blok: String((pengajuan && pengajuan.Blok) || '').trim(),
        'Jenis Kegiatan': String((pengajuan && pengajuan['Jenis Kegiatan']) || '').trim(),
        Status: status || String((pengajuan && pengajuan.Status) || '').trim(),
        'Catatan Admin': String((pengajuan && pengajuan['Catatan Admin']) || '').trim(),
        Keterangan: String((pengajuan && pengajuan.Keterangan) || '').trim(),
        TanggalPengajuan: formatIndonesianDate((pengajuan && (pengajuan.Timestamp || pengajuan['Tanggal Pengajuan'])) || now),
        TanggalSurat: formatIndonesianDate(now)
    };

    const detailParts = [];
    let tanggal = '';
    (details || []).forEach(function(d) {
        const pil = String(d.Pilihan || '').trim();
        const det = String(d.Detail || '').trim();
        const tgl = String(d['Tanggal Pelaksanaan'] || '').trim();
        if (pil || det) {
            detailParts.push([pil, det].filter(Boolean).join(' - '));
        }
        if (!tanggal && tgl) tanggal = tgl;
    });
    enhanced.DetailKegiatan = detailParts.filter(Boolean).join('; ') || '';
    enhanced.TanggalKegiatan = tanggal ? formatIndonesianDate(tanggal) : '';
    enhanced.Dosen = String((pengajuan && pengajuan.Dosen) || '').trim();
    enhanced.TanggalPelaksanaan = formatIndonesianDate((pengajuan && pengajuan['Tanggal Pelaksanaan']) || '');

    return enhanced;
}

function _updateNotifikasiColumns(idPengajuan, status, sentAt, error) {
    try {
        const sheet = getGlobalSpreadsheet().getSheetByName('Pengajuan');
        const headers = getHeadersFromSheet(sheet);
        const idx = {
            notif: headers.indexOf('Notifikasi Terkirim Pada'),
            status: headers.indexOf('Status Notifikasi Email'),
            error: headers.indexOf('Error Notifikasi Email'),
            updated: headers.indexOf('UpdatedAt')
        };
        const idIdx = headers.indexOf('ID Pengajuan');
        if (idIdx === -1) return;
        const rowIndex = findRowByColumnValue(sheet, idIdx + 1, idPengajuan);
        if (rowIndex === -1) return;
        const values = {};
        if (idx.status !== -1) values[idx.status] = status || '';
        if (idx.notif !== -1) values[idx.notif] = sentAt || '';
        if (idx.error !== -1) values[idx.error] = error || '';
        if (idx.updated !== -1) values[idx.updated] = new Date();
        const cols = Object.keys(values).map(Number).sort(function(a, b) { return a - b; });
        if (!cols.length) return;
        const range = sheet.getRange(rowIndex, cols[0] + 1, 1, cols[cols.length - 1] - cols[0] + 1);
        const row = range.getValues()[0];
        cols.forEach(function(c) { row[c - cols[0]] = values[c]; });
        range.setValues([row]);
    } catch (e) {
        console.error('Gagal update kolom notifikasi: ' + (e && e.message ? e.message : e));
    }
}

function _sendNotificationEmail(recipient, status, attachment, data) {
    recipient = String(recipient || '').trim();
    if (!recipient) throw new Error('Email penerima kosong.');
    if (!attachment) throw new Error('Lampiran PDF belum tersedia.');
    const catatan = String(data['Catatan Admin'] || data.Catatan || data.Keterangan || '').trim();
    const noteLine = catatan ? '\n\nCatatan Admin: ' + catatan : '';
    const subject = 'Pemberitahuan Status Pendaftaran INHAL';
    const body = "Assalamu'alaikum " + (data['Nama Lengkap'] || '') + ', ' + (data.NPM || '') +
        '.\n\nTerlampir adalah surat pemberitahuan status pendaftaran INHAL Anda.' + noteLine +
        "\n\nWassalamu'alaikum\nAdmin Prodi";
    MailApp.sendEmail({
        to: recipient,
        subject: subject,
        body: body,
        attachments: [attachment]
    });
}

function _processStatusNotification(idPengajuan, newStatus) {
    try {
        const pengajuan = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
        if (!pengajuan) return { ok: false, error: 'Pengajuan tidak ditemukan.' };
        const recipient = String(pengajuan.Email || '').trim();
        if (!recipient) {
            _updateNotifikasiColumns(idPengajuan, 'Gagal', '', 'Email mahasiswa tidak ditemukan.');
            return { ok: false, error: 'Email mahasiswa tidak ditemukan.' };
        }
        const details = _getPengajuanDetails(idPengajuan);
        const templateRef = newStatus === STATUS.DITOLAK ? TEMPLATE_DITOLAK : TEMPLATE_DITERIMA;
        const enhanced = _enhancePengajuanForTemplate(pengajuan, details, newStatus);
        const pdfBlob = _createPdfFromTemplate(templateRef, enhanced, newStatus);

        let attachmentUrl = '';
        try {
            attachmentUrl = _saveBlobToDrive(pdfBlob, 'notifikasi-' + idPengajuan);
        } catch (e) {
            console.error('Gagal simpan lampiran notifikasi ke Drive: ' + (e && e.message ? e.message : e));
        }
        upsertRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan, {
            'Lampiran Email': attachmentUrl,
            'UpdatedAt': new Date()
        });

        _sendNotificationEmail(recipient, newStatus, pdfBlob, enhanced);
        _updateNotifikasiColumns(idPengajuan, 'Berhasil', new Date(), '');
        return { ok: true, lampiranEmail: attachmentUrl };
    } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        console.error('Error _processStatusNotification: ' + msg);
        _updateNotifikasiColumns(idPengajuan, 'Gagal', '', msg);
        return { ok: false, error: msg };
    }
}

function sendStatusNotificationEmail(idPengajuan) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const pengajuan = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
        if (!pengajuan) return { success: false, message: 'Pengajuan tidak ditemukan.' };
        const status = String(pengajuan.Status || '').trim();
        if (status !== STATUS.DITERIMA && status !== STATUS.DITOLAK) {
            return { success: false, message: 'Email notifikasi hanya untuk status Diterima/Ditolak. Status saat ini: ' + (status || '-') };
        }
        const result = _processStatusNotification(idPengajuan, status);
        return result.ok
            ? { success: true, message: 'Email notifikasi berhasil dikirim.' }
            : { success: false, message: 'Email notifikasi gagal: ' + result.error };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

function _sendUploadReceiptEmail(pengajuan, accUrl, buktiUrl) {
    try {
        const recipient = String((pengajuan && pengajuan.Email) || '').trim();
        if (!recipient) {
            console.warn('_sendUploadReceiptEmail: email mahasiswa tidak ditemukan.');
            return;
        }
        const npm = String((pengajuan && pengajuan.NPM) || '').trim();
        const nama = String((pengajuan && pengajuan['Nama Lengkap']) || '').trim();
        const blok = String((pengajuan && pengajuan.Blok) || '').trim();
        const jenis = String((pengajuan && pengajuan['Jenis Kegiatan']) || '').trim();
        const detail = _getPengajuanDetailSummary(String((pengajuan && pengajuan['ID Pengajuan']) || '').trim());

        const subject = 'Konfirmasi pengisian form Upload Bukti Pembayaran INHAL';

        const htmlBody = [
            "Assalamu'alaikum " + nama + ' ,',
            'Kami telah menerima upload bukti pembayaran INHAL Anda. Berikut ringkasan data yang tercatat:',
            'NPM: ' + npm,
            'Nama Lengkap: ' + nama,
            'Blok: ' + blok,
            'Jenis Kegiatan: ' + jenis,
            'Detail Kegiatan: ' + detail.detail,
            'Tanggal: ' + detail.tanggal,
            'Link ACC INHAL: <a href="' + (accUrl || '') + '" target="_blank">' + (accUrl || '') + '</a>',
            'Link Bukti Bayar: <a href="' + (buktiUrl || '') + '" target="_blank">' + (buktiUrl || '') + '</a>',
            '',
            'Catatan:',
            '- Prodi akan memverifikasi dokumen dan Anda akan menerima email pemberitahuan selanjutnya.',
            '- Silakan simpan email ini sebagai bukti bahwa pengisian form Anda sudah tercatat.',
            'Jika ada pertanyaan, silakan hubungi admin Prodi.',
            'Terima kasih.',
            "Wassalamu'alaikum."
        ].map(function(line) { return '<p>' + line + '</p>'; }).join('');

        const plainBody = [
            "Assalamu'alaikum " + nama + ' ,',
            'Kami telah menerima upload bukti pembayaran INHAL Anda. Berikut ringkasan data yang tercatat:',
            'NPM: ' + npm,
            'Nama Lengkap: ' + nama,
            'Blok: ' + blok,
            'Jenis Kegiatan: ' + jenis,
            'Detail Kegiatan: ' + detail.detail,
            'Tanggal: ' + detail.tanggal,
            'Link ACC INHAL: ' + (accUrl || ''),
            'Link Bukti Bayar: ' + (buktiUrl || ''),
            '',
            'Catatan:',
            '- Prodi akan memverifikasi dokumen dan Anda akan menerima email pemberitahuan selanjutnya.',
            '- Silakan simpan email ini sebagai bukti bahwa pengisian form Anda sudah tercatat.',
            'Jika ada pertanyaan, silakan hubungi admin Prodi.',
            'Terima kasih.',
            "Wassalamu'alaikum."
        ].join('\n');

        MailApp.sendEmail(recipient, subject, plainBody, { htmlBody: htmlBody });
        console.log('Upload receipt email sent to: ' + recipient);
    } catch (e) {
        console.error('_sendUploadReceiptEmail error: ' + (e && e.message ? e.message : e));
    }
}

// =================================================================
// ==================== BAGIAN EMAIL LOOKUP ========================
// =================================================================

function _getBagianEmailMap() {
    try {
        const rows = getAllRows('MasterBagian');
        const map = {};
        rows.forEach(function(r) {
            const email = String(r.Email || '').trim();
            if (!email) return;
            ['Lab', 'Kegiatan Lab', 'Bagian'].forEach(function(field) {
                const v = String(r[field] || '').trim();
                const k = norm(v);
                if (k) map[k] = email;
            });
        });
        return map;
    } catch (e) {
        return {};
    }
}

function _resolveBagianEmailForPengajuan(pengajuan, details) {
    const map = _getBagianEmailMap();
    const candidates = [];
    const added = {};
    const push = function(v) {
        const raw = String(v || '').trim();
        const k = norm(raw);
        if (raw && k && !added[k]) {
            added[k] = true;
            candidates.push(raw);
        }
    };
    push(pengajuan && pengajuan.Blok);
    (details || []).forEach(function(d) {
        push(d.Bagian);
        push(d.Pilihan);
        push(d.Detail);
    });
    push(pengajuan && pengajuan['Jenis Kegiatan']);
    for (let i = 0; i < candidates.length; i++) {
        const email = map[norm(candidates[i])];
        if (email) {
            return { name: candidates[i], email: email };
        }
    }
    return { name: candidates.length ? candidates[0] : '', email: '' };
}

// =================================================================
// ==================== FINAL ACC PDF EMAIL ========================
// =================================================================

function _prepareFinalPdf(idPengajuan) {
    const pengajuan = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
    if (!pengajuan) throw new Error('Pengajuan tidak ditemukan.');
    const details = _getPengajuanDetails(idPengajuan);
    const enhanced = _enhancePengajuanForTemplate(pengajuan, details, 'Final');
    const pdfBlob = _createPdfFromTemplate(TEMPLATE_ACC_FINAL, enhanced, 'Final');
    return { pengajuan: pengajuan, details: details, enhanced: enhanced, pdfBlob: pdfBlob };
}

function _sendFinalPdfEmails(idPengajuan) {
    const prepared = _prepareFinalPdf(idPengajuan);
    const pengajuan = prepared.pengajuan;
    const pdfBlob = prepared.pdfBlob;

    const accInhal = String(pengajuan['Link ACC INHAL'] || '').trim();
    if (!accInhal) {
        return {
            ok: false,
            pdfUrl: '',
            studentEmailSent: false,
            bagianEmailSent: false,
            bagianEmail: '',
            bagianName: '',
            notes: ['Berkas ACC INHAL belum diunggah. Upload ACC INHAL terlebih dahulu sebelum mengirim PDF final.']
        };
    }

    if (String(pengajuan.Status || '').trim() !== STATUS.ACC) {
        upsertRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan, {
            'Status': STATUS.ACC,
            'UpdatedAt': new Date()
        });
        appendRowSafe('StatusHistory', {
            Timestamp: new Date(),
            'ID Pengajuan': idPengajuan,
            'Status': STATUS.ACC,
            'Catatan': '',
            'Actor Email': getActorName()
        });
    }

    let pdfUrl = '';
    try {
        pdfUrl = _saveBlobToDrive(pdfBlob, 'final-' + idPengajuan);
        upsertRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan, {
            'Link Final': pdfUrl,
            'UpdatedAt': new Date()
        });
    } catch (e) {
        console.error('Gagal simpan PDF final ke Drive: ' + (e && e.message ? e.message : e));
    }

    const nama = String(pengajuan['Nama Lengkap'] || '').trim();
    const npm = String(pengajuan.NPM || '').trim();
    const studentEmail = String(pengajuan.Email || '').trim();
    const bagianMatch = _resolveBagianEmailForPengajuan(pengajuan, prepared.details);
    const bagianName = bagianMatch.name || '';
    const bagianEmail = bagianMatch.email || '';

    let studentSent = false;
    let bagianSent = false;

    if (studentEmail) {
        try {
            const subject = 'Surat Keterangan Final INHAL - ' + (nama || '');
            const body = "Assalamu'alaikum " + (nama || '') + ' (NPM: ' + npm + ').' +
                '\n\nTerlampir adalah surat keterangan final pendaftaran INHAL Anda.' +
                '\nBerkas Anda telah diperiksa dan ACC final telah disetujui oleh Admin Prodi.' +
                "\n\nWassalamu'alaikum\nAdmin Prodi";
            MailApp.sendEmail({ to: studentEmail, subject: subject, body: body, attachments: [pdfBlob] });
            studentSent = true;
        } catch (e) {
            console.error('Gagal kirim email final ke mahasiswa: ' + (e && e.message ? e.message : e));
        }
    }

    if (bagianEmail) {
        try {
            const subject = 'Pemberitahuan ACC Final INHAL Mahasiswa - ' + (nama || '');
            const body = "Assalamu'alaikum Admin Bagian " + (bagianName || '') + '.' +
                '\n\nTerlampir adalah bukti ACC final pendaftaran INHAL.' +
                '\nMohon segera ditindak lanjuti.' +
                '\n\nData Mahasiswa:' +
                '\nNama: ' + nama +
                '\nNPM: ' + npm +
                "\n\nTerimakasih,\n\nWassalamu'alaikum\nAdmin Prodi";
            MailApp.sendEmail({ to: bagianEmail, subject: subject, body: body, attachments: [pdfBlob] });
            bagianSent = true;
        } catch (e) {
            console.error('Gagal kirim email final ke Bagian: ' + (e && e.message ? e.message : e));
        }
    }

    updateStatusInfoBagian(
        idPengajuan,
        bagianSent ? 'Terkirim' : (bagianEmail ? 'Gagal' : 'Belum dikirim'),
        bagianEmail,
        (!bagianSent ? ("Email untuk Bagian '" + (bagianName || '-') + "' tidak terkirim / tidak ditemukan.") : '')
    );

    const notes = [];
    if (!studentSent) notes.push('Email mahasiswa tidak terkirim.');
    if (!bagianSent) notes.push("Email untuk Bagian '" + (bagianName || '-') + "' tidak terkirim / tidak ditemukan.");

    return {
        ok: true,
        pdfUrl: pdfUrl,
        studentEmailSent: studentSent,
        bagianEmailSent: bagianSent,
        bagianEmail: bagianEmail,
        bagianName: bagianName,
        notes: notes
    };
}

function sendFinalEmail(idPengajuan) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const result = _sendFinalPdfEmails(idPengajuan);
        return {
            success: result.ok,
            linkFinal: result.pdfUrl,
            message: (result.notes && result.notes.length) ? result.notes.join(' ') : 'Email final berhasil dikirim.',
            emailSent: result.studentEmailSent || result.bagianEmailSent,
            studentEmailSent: result.studentEmailSent,
            bagianEmailSent: result.bagianEmailSent
        };
    } catch (e) {
        console.error('Error sendFinalEmail: ' + (e && e.message ? e.message : e));
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

// =================================================================
// ==================== MASTER BIAYA ===============================
// =================================================================

function _getBiayaMap() {
    try {
        const rows = getAllRows('MasterBiaya');
        const map = {};
        rows.forEach(function(r) {
            const kegiatan = String(r.Kegiatan || '').trim();
            if (kegiatan) {
                map[kegiatan] = parseCurrency(r.Biaya);
            }
        });
        return map;
    } catch (e) {
        return {};
    }
}

function _resolveBiayaForPengajuan(pengajuan, biayaMap) {
    biayaMap = biayaMap || _getBiayaMap();
    const jenis = String((pengajuan && pengajuan['Jenis Kegiatan']) || '').trim();
    if (jenis && biayaMap[jenis] !== undefined) return biayaMap[jenis];
    const jNorm = norm(jenis);
    const keys = Object.keys(biayaMap || {});
    for (let i = 0; i < keys.length; i++) {
        const kNorm = norm(keys[i]);
        if (kNorm && jNorm && (jNorm.indexOf(kNorm) !== -1 || kNorm.indexOf(jNorm) !== -1)) {
            return biayaMap[keys[i]];
        }
    }
    return 0;
}

// =================================================================
// ==================== BA ADMIN ===================================
// =================================================================

function getBaUploadOptions() {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const pengajuan = getAllRows('Pengajuan');
        const details = getAllRows('DetailKegiatan');

        const pMap = {};
        pengajuan.forEach(function(p) { pMap[String(p['ID Pengajuan'] || '').trim()] = p; });

        const blokList = [];
        const blokSeen = {};
        pengajuan.forEach(function(p) {
            const b = String(p.Blok || '').replace(/\s+/g, ' ').trim();
            if (b && !blokSeen[b.toLowerCase()]) {
                blokSeen[b.toLowerCase()] = true;
                blokList.push(b);
            }
        });
        blokList.sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });

        const detailMap = {};
        details.forEach(function(d) {
            const id = String(d['ID Pengajuan'] || '').trim();
            const p = pMap[id];
            const blok = String((p && p.Blok) || '').replace(/\s+/g, ' ').trim();
            const jenis = String(d['Jenis Kegiatan'] || '').replace(/\s+/g, ' ').trim();
            const pilihan = String(d.Pilihan || '').replace(/\s+/g, ' ').trim();
            const detailText = String(d.Detail || '').replace(/\s+/g, ' ').trim();
            if (!jenis && !pilihan && !detailText) return;
            const key = [blok.toLowerCase(), jenis.toLowerCase(), pilihan.toLowerCase(), detailText.toLowerCase()].join('|');
            if (!detailMap[key]) {
                const nama = pilihan + (detailText ? ' - ' + detailText : '');
                detailMap[key] = {
                    blok: blok,
                    jenis: jenis,
                    pilihan: pilihan,
                    detail: detailText,
                    tanggalPelaksanaan: _clientDate(d['Tanggal Pelaksanaan']),
                    label: (jenis || 'Lainnya') + ' — ' + (nama || '-'),
                    count: 0
                };
            }
            detailMap[key].count++;
        });

        const detailList = Object.keys(detailMap).map(function(k) { return detailMap[k]; });
        detailList.sort(function(a, b) {
            const ka = a.blok.toLowerCase() + a.label.toLowerCase();
            const kb = b.blok.toLowerCase() + b.label.toLowerCase();
            return ka.localeCompare(kb);
        });

        return { blok: blokList, details: detailList, labs: getMasterOptions('Lab') };
    } catch (e) {
        return { blok: [], details: [], labs: [] };
    }
}

function _resolveBaPesertaFromDetail(payload) {
    const jenis = String((payload && payload.jenis) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const pilihan = String((payload && payload.pilihan) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const detailText = String((payload && payload.detail) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const blok = String((payload && payload.blok) || '').replace(/\s+/g, ' ').trim();
    if (!jenis && !pilihan && !detailText) return [];

    const idSet = {};
    getAllRows('DetailKegiatan').forEach(function(d) {
        if (String(d['Jenis Kegiatan'] || '').replace(/\s+/g, ' ').trim().toLowerCase() !== jenis) return;
        if (String(d.Pilihan || '').replace(/\s+/g, ' ').trim().toLowerCase() !== pilihan) return;
        if (String(d.Detail || '').replace(/\s+/g, ' ').trim().toLowerCase() !== detailText) return;
        idSet[String(d['ID Pengajuan'] || '').trim()] = true;
    });

    const ids = Object.keys(idSet);
    if (!ids.length) return [];

    const peserta = [];
    getAllRows('Pengajuan').forEach(function(p) {
        if (!idSet[String(p['ID Pengajuan'] || '').trim()]) return;
        if (String(p.Blok || '').replace(/\s+/g, ' ').trim() !== blok) return;
        const npm = String(p.NPM || '').trim();
        const nama = String(p['Nama Lengkap'] || '').trim();
        if (npm || nama) {
            peserta.push({
                npm: npm,
                namaLengkap: nama,
                blok: String(p.Blok || '').trim(),
                statusPengajuan: String(p.Status || '').trim()
            });
        }
    });

    peserta.sort(function(a, b) { return a.npm.toLowerCase().localeCompare(b.npm.toLowerCase()); });
    return peserta;
}

function uploadBeritaAcaraAdmin(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const ss = getGlobalSpreadsheet();
        const baSheet = ss.getSheetByName('BeritaAcaraAdmin');
        if (!baSheet) {
            return { success: false, message: 'Sheet BeritaAcaraAdmin tidak ditemukan. Jalankan setupDatabase() dahulu.' };
        }

        const baId = generateBaId(baSheet);
        let fileUrl = '';
        let fileName = '';
        if (payload && payload.file && payload.file.data) {
            fileUrl = _saveFileToDrive(payload.file.data, payload.file.mimeType, payload.file.name, 'ba-admin-' + baId);
            fileName = String(payload.file.name || '').trim();
        }

        let peserta = _resolveBaPesertaFromDetail(payload);
        if (!peserta.length) {
            peserta = normalizeBaPeserta(payload);
        }

        appendRowSafe('BeritaAcaraAdmin', {
            Timestamp: new Date(),
            'BA ID': baId,
            'Bagian': String((payload && payload.bagian) || 'Admin').trim(),
            'Blok': String((payload && payload.blok) || '').trim(),
            'Nama Kegiatan': String((payload && payload.namaKegiatan) || '').trim(),
            'Tanggal Pelaksanaan': String((payload && payload.tanggalPelaksanaan) || '').trim(),
            'Jumlah Peserta': peserta.length,
            'File Name': fileName,
            'File URL': fileUrl,
            'Catatan': String((payload && payload.catatan) || '').trim(),
            'Sumber': 'Admin'
        });

        peserta.forEach(function(p) {
            appendRowSafe('BeritaAcaraAdminPeserta', {
                Timestamp: new Date(),
                'BA ID': baId,
                'NPM': p.npm,
                'Nama Lengkap': p.namaLengkap,
                'Blok': p.blok,
                'Bagian': String((payload && payload.bagian) || 'Admin').trim(),
                'Status Pengajuan': p.statusPengajuan
            });
        });

        return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

// =================================================================
// ==================== ADMIN MAINTENANCE ==========================
// =================================================================

function _setPengajuanColumns(idPengajuan, values) {
    const ss = getGlobalSpreadsheet();
    ensureSheetWithHeaders(ss, 'Pengajuan', SCHEMAS.Pengajuan);
    const sheet = ss.getSheetByName('Pengajuan');
    const headers = getHeadersFromSheet(sheet);
    const idIdx = headers.indexOf('ID Pengajuan');
    if (idIdx === -1) throw new Error('Kolom ID Pengajuan tidak ditemukan.');
    const rowIndex = findRowByColumnValue(sheet, idIdx + 1, idPengajuan);
    if (rowIndex === -1) throw new Error('Pengajuan tidak ditemukan.');
    const target = {};
    Object.keys(values || {}).forEach(function(h) {
        const idx = headers.indexOf(h);
        if (idx !== -1) target[idx] = values[h];
    });
    const cols = Object.keys(target).map(Number).sort(function(a, b) { return a - b; });
    if (!cols.length) return;
    const range = sheet.getRange(rowIndex, cols[0] + 1, 1, cols[cols.length - 1] - cols[0] + 1);
    const row = range.getValues()[0];
    cols.forEach(function(c) { row[c - cols[0]] = target[c]; });
    range.setValues([row]);
}

function updatePengajuanFields(idPengajuan, payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const existing = getRowByKey('Pengajuan', 'ID Pengajuan', idPengajuan);
        if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };
        const p = payload || {};
        const values = {};
        const setField = function(header, raw) {
            values[header] = String(raw === undefined || raw === null ? '' : raw).trim();
        };
        if (p.email !== undefined) setField('Email', p.email);
        if (p.noHp !== undefined) setField('No. HP/WA', p.noHp);
        if (p.namaLengkap !== undefined) setField('Nama Lengkap', p.namaLengkap);
        if (p.blok !== undefined) setField('Blok', p.blok);
        if (p.dosen !== undefined) setField('Dosen', p.dosen);
        if (p.tanggalPelaksanaan !== undefined) setField('Tanggal Pelaksanaan', p.tanggalPelaksanaan);
        if (p.finalUrl !== undefined) setField('Link Final', p.finalUrl);
        if (p.catatan !== undefined) setField('Catatan Admin', p.catatan);
        if (p.keterangan !== undefined) setField('Keterangan', p.keterangan);

        if (values.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.Email)) {
            return { success: false, message: 'Format email tidak valid.' };
        }

        if (Object.keys(values).length > 0) {
            values['UpdatedAt'] = new Date();
            _setPengajuanColumns(idPengajuan, values);
            writeAuditLog({
                actor: getActorName(),
                action: 'UPDATE',
                target: 'Pengajuan',
                detail: JSON.stringify(Object.assign({ idPengajuan: idPengajuan }, values)),
                alasan: 'Pemeliharaan data admin'
            });
        }
        return { success: true, message: 'Data pengajuan diperbarui.', values: values };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

function deletePengajuanAdmin(idPengajuan, alasan) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const idVal = String(idPengajuan || '').trim();
        if (!idVal) return { success: false, message: 'ID Pengajuan wajib diisi.' };
        const existing = getRowByKey('Pengajuan', 'ID Pengajuan', idVal);
        if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };

        let deleted = 0;
        ['DetailKegiatan', 'StatusHistory', 'LogUpload', 'CheckData'].forEach(function(sheetName) {
            getAllRows(sheetName).forEach(function(r) {
                if (String(r['ID Pengajuan'] || '').trim() === idVal) {
                    deleteRowByKey(sheetName, 'ID Pengajuan', idVal, 'Hapus pengajuan ' + idVal + ' oleh admin', getActorName());
                    deleted++;
                }
            });
        });

        deleteRowByKey('Pengajuan', 'ID Pengajuan', idVal, alasan || 'Dihapus oleh admin', getActorName());

        return { success: true, message: 'Pengajuan beserta data terkait berhasil dihapus (' + deleted + ' baris terkait).' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

// =================================================================
// ==================== BULK FINAL EMAIL ===========================
// =================================================================

function sendBulkFinalEmail(ids) {
    requireAuthorized(arguments[arguments.length - 1]);
    const idList = Array.isArray(ids) ? ids.map(function(x) { return String(x || '').trim(); }).filter(Boolean) : null;
    let targets = getAllRows('Pengajuan');
    if (idList && idList.length) {
        targets = targets.filter(function(p) {
            return idList.indexOf(String(p['ID Pengajuan'] || '').trim()) !== -1;
        });
    } else {
        targets = targets.filter(function(p) {
            return String(p.Status || '').trim() === STATUS.ACC;
        });
    }

    const results = { total: 0, sent: 0, failed: 0, details: [] };
    targets.forEach(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        if (!id) return;
        results.total++;
        try {
            const r = _sendFinalPdfEmails(id);
            if (r && r.ok) {
                results.sent++;
                results.details.push({ idPengajuan: id, npm: p.NPM, nama: p['Nama Lengkap'], ok: true, notes: r.notes || [] });
            } else {
                results.failed++;
                results.details.push({ idPengajuan: id, npm: p.NPM, nama: p['Nama Lengkap'], ok: false, notes: (r && r.notes) || ['Gagal mengirim.'] });
            }
        } catch (e) {
            results.failed++;
            results.details.push({ idPengajuan: id, npm: p.NPM, nama: p['Nama Lengkap'], ok: false, notes: [(e && e.message) ? e.message : String(e)] });
        }
    });

    return {
        success: true,
        total: results.total,
        sent: results.sent,
        failed: results.failed,
        details: results.details,
        message: 'Email final diproses untuk ' + results.total + ' pengajuan: ' + results.sent + ' terkirim, ' + results.failed + ' gagal.'
    };
}

// =================================================================
// ==================== CHECK / PRESENSI ===========================
// =================================================================

function _checkDataKey(c) {
    return [
        String(c['ID Pengajuan'] || '').trim(),
        String(c.Pilihan || '').trim(),
        String(c.Detail || '').trim(),
        String(c['Tanggal Pelaksanaan'] || '').trim()
    ].join('||');
}

function getCheckPageData(options) {
    requireAuthorized(arguments[arguments.length - 1]);
    options = options || {};
    const pengajuan = getAllRows('Pengajuan');
    const details = getAllRows('DetailKegiatan');
    const checkRows = getAllRows('CheckData');

    const checkByKey = {};
    checkRows.forEach(function(c) {
        checkByKey[_checkDataKey(c)] = c;
    });

    const rows = [];
    pengajuan.forEach(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        const pDetails = details.filter(function(d) {
            return String(d['ID Pengajuan'] || '').trim() === id;
        });
        const list = pDetails.length ? pDetails : [{
            'Jenis Kegiatan': p['Jenis Kegiatan'], Pilihan: '', Detail: '', 'Tanggal Pelaksanaan': '', Bagian: ''
        }];
        list.forEach(function(d) {
            const existingCheck = checkByKey[_checkDataKey(Object.assign({ 'ID Pengajuan': id }, d))];
            rows.push({
                checkKey: _checkDataKey(Object.assign({ 'ID Pengajuan': id }, d)),
                checkId: existingCheck ? String(existingCheck['Check ID'] || '').trim() : '',
                idPengajuan: id,
                npm: String(p.NPM || '').trim(),
                namaLengkap: String(p['Nama Lengkap'] || '').trim(),
                blok: String(p.Blok || '').trim(),
                jenisKegiatan: String(d['Jenis Kegiatan'] || p['Jenis Kegiatan'] || '').trim(),
                pilihan: String(d.Pilihan || '').trim(),
                detail: String(d.Detail || '').trim(),
                tanggalPelaksanaan: String(d['Tanggal Pelaksanaan'] || '').trim(),
                bagian: String(d.Bagian || '').trim(),
                dosen: existingCheck ? String(existingCheck.Dosen || '').trim() : String(p.Dosen || '').trim(),
                hadir: existingCheck ? String(existingCheck.Hadir || '').trim() : '',
                catatan: existingCheck ? String(existingCheck.Catatan || '').trim() : '',
                statusPengajuan: String(p.Status || '').trim()
            });
        });
    });

    let filtered = rows;
    if (options.status) filtered = filtered.filter(function(r) { return r.statusPengajuan === options.status; });
    if (options.hadir) filtered = filtered.filter(function(r) { return (r.hadir || 'Belum') === options.hadir; });
    if (options.jenis) filtered = filtered.filter(function(r) { return r.jenisKegiatan === options.jenis; });
    if (options.search) {
        const q = norm(options.search);
        filtered = filtered.filter(function(r) {
            return (r.npm && norm(r.npm).indexOf(q) !== -1) || (r.namaLengkap && norm(r.namaLengkap).indexOf(q) !== -1);
        });
    }
    filtered.sort(function(a, b) {
        const cmp = String(a.tanggalPelaksanaan || '').localeCompare(String(b.tanggalPelaksanaan || ''));
        return cmp !== 0 ? cmp : String(a.npm || '').localeCompare(String(b.npm || ''));
    });

    return { rows: filtered, total: rows.length };
}

function updateCheckDataPartial(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const p = payload || {};
        const idPengajuan = String(p.idPengajuan || p['ID Pengajuan'] || '').trim();
        const pilihan = String(p.pilihan || '').trim();
        const detail = String(p.detail || '').trim();
        const tanggal = String(p.tanggalPelaksanaan || '').trim();
        if (!idPengajuan) return { success: false, message: 'ID Pengajuan tidak tersedia.' };

        const key = [idPengajuan, pilihan, detail, tanggal].join('||');
        const existingRows = getAllRows('CheckData');
        let found = null;
        for (let i = 0; i < existingRows.length; i++) {
            if (_checkDataKey(existingRows[i]) === key) { found = existingRows[i]; break; }
        }

        const now = new Date();
        const values = {
            'ID Pengajuan': idPengajuan,
            'NPM': String(p.npm || '').trim(),
            'Nama Lengkap': String(p.namaLengkap || '').trim(),
            'Blok': String(p.blok || '').trim(),
            'Jenis Kegiatan': String(p.jenisKegiatan || '').trim(),
            'Pilihan': pilihan,
            'Detail': detail,
            'Tanggal Pelaksanaan': tanggal,
            'Bagian': String(p.bagian || '').trim(),
            'UpdatedAt': now
        };
        if (p.dosen !== undefined) values['Dosen'] = String(p.dosen || '').trim();
        if (p.hadir !== undefined) values['Hadir'] = String(p.hadir || '').trim();
        if (p.catatan !== undefined) values['Catatan'] = String(p.catatan || '').trim();

        if (found) {
            values['Check ID'] = found['Check ID'];
            values['Timestamp'] = found['Timestamp'];
            const sheet = getGlobalSpreadsheet().getSheetByName('CheckData');
            const headers = getHeadersFromSheet(sheet);
            const idIdx = headers.indexOf('Check ID');
            const rowIndex = findRowByColumnValue(sheet, idIdx + 1, found['Check ID']);
            if (rowIndex === -1) throw new Error('Baris CheckData tidak ditemukan.');
            const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
            headers.forEach(function(h, i) {
                if (values[h] !== undefined) row[i] = values[h];
            });
            sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
        } else {
            appendRowSafe('CheckData', Object.assign({ Timestamp: now, 'Check ID': generateId('CHK') }, values));
        }

        try {
            const updatePengajuan = { 'Dosen': values.Dosen, 'UpdatedAt': now };
            if (values['Tanggal Pelaksanaan']) updatePengajuan['Tanggal Pelaksanaan'] = values['Tanggal Pelaksanaan'];
            _setPengajuanColumns(idPengajuan, updatePengajuan);
        } catch (e) {
            console.error('updateCheckDataPartial: gagal mirror ke Pengajuan: ' + (e && e.message ? e.message : e));
        }

        return { success: true, message: 'Data kehadiran berhasil disimpan.' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

// =================================================================
// ==================== SYNC OLD LOGDATA ===========================
// =================================================================

function syncLogDataToPengajuan() {
    requireAuthorized(arguments[arguments.length - 1]);
    const ss = getGlobalSpreadsheet();
    const logSheet = ss.getSheetByName('LogData');
    const report = { total: 0, created: 0, skipped: 0, errors: [] };
    if (!logSheet || logSheet.getLastRow() < 2) {
        return { success: true, report: report, message: 'Tidak ada data LogData untuk disinkronkan.' };
    }
    const headers = getHeadersFromSheet(logSheet);
    const idx = function(name) { return headers.indexOf(name); };
    const getVal = function(row, name) {
        const i = idx(name);
        return (i !== -1 && row[i] !== undefined && row[i] !== null) ? String(row[i]).trim() : '';
    };
    const getDateVal = function(row, name) {
        const i = idx(name);
        if (i === -1 || row[i] === undefined || row[i] === null || row[i] === '') return null;
        return row[i] instanceof Date ? row[i] : new Date(row[i]);
    };

    const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logSheet.getLastColumn()).getValues();
    data.forEach(function(row) {
        report.total++;
        const idLama = getVal(row, 'ID Pengajuan');
        const npm = getVal(row, 'NPM');
        if (!idLama || !npm) { report.skipped++; return; }
        if (getRowByKey('Pengajuan', 'ID Pengajuan', idLama)) { report.skipped++; return; }

        try {
            const now = getDateVal(row, 'Timestamp') || new Date();
            const jenis = getVal(row, 'Jenis Kegiatan');
            const pengajuan = {
                Timestamp: now,
                'ID Pengajuan': idLama,
                'NPM': npm,
                'Nama Lengkap': getVal(row, 'Nama Lengkap'),
                'Email': getVal(row, 'Email') || getVal(row, 'Email Address'),
                'No. HP/WA': getVal(row, 'No. HP/WA'),
                'Blok': getVal(row, 'Blok'),
                'Jenis Kegiatan': jenis,
                'Keterangan': getVal(row, 'Keterangan'),
                'Link Surat Keterangan': getVal(row, 'Link Surat Keterangan'),
                'Status': getVal(row, 'Status') || STATUS.MENUNGGU,
                'Catatan Admin': getVal(row, 'Catatan Admin'),
                'Notifikasi Terkirim Pada': getVal(row, 'Notifikasi Terkirim Pada'),
                'Nomor Surat': getVal(row, 'Nomor Surat'),
                'Lampiran Email': getVal(row, 'Lampiran Email')
            };
            appendRowSafe('Pengajuan', pengajuan);

            const detailRows = [];
            const addDetail = function(pilihan, det, tgl) {
                detailRows.push({
                    Timestamp: now,
                    'ID Pengajuan': idLama,
                    'Jenis Kegiatan': jenis,
                    'Pilihan': pilihan,
                    'Detail': det,
                    'Tanggal Pelaksanaan': tgl,
                    'Bagian': _resolveBagianFor(jenis, pilihan, det)
                });
            };
            const jenisNorm = norm(jenis);
            if (jenisNorm === 'ujian') {
                addDetail(getVal(row, 'Pilihan Ujian'), '', getVal(row, 'Tanggal Ujian'));
            } else if (jenisNorm === 'sgd') {
                addDetail(getVal(row, 'Pilihan SGD'), getVal(row, 'Detail SGD'), getVal(row, 'Tanggal SGD'));
            } else if (jenisNorm === 'kkd') {
                addDetail(getVal(row, 'Pilihan KKD'), getVal(row, 'Detail KKD'), getVal(row, 'Tanggal KKD'));
            } else if (jenisNorm === 'praktikum') {
                for (let n = 1; n <= 9; n++) {
                    const pil = getVal(row, 'Pilihan LAB ' + n);
                    const keg = getVal(row, 'Kegiatan LAB ' + n);
                    const tgl = getVal(row, 'Tanggal Praktikum ' + n);
                    if (pil || keg) addDetail(pil, keg, tgl);
                }
            }
            if (detailRows.length === 0) addDetail(jenis, '', '');
            detailRows.forEach(function(d) { appendRowSafe('DetailKegiatan', d); });

            appendRowSafe('StatusHistory', {
                Timestamp: now,
                'ID Pengajuan': idLama,
                'Status': pengajuan.Status,
                'Catatan': 'Disinkronkan dari LogData lama.',
                'Actor Email': getActorName()
            });

            report.created++;
        } catch (e) {
            report.errors.push((e && e.message) ? e.message : String(e));
        }
    });

    return {
        success: true,
        report: report,
        message: 'Sinkronisasi selesai. Dibuat: ' + report.created + ', dilewati: ' + report.skipped + ', error: ' + report.errors.length + '.'
    };
}

// =================================================================
// ==================== BAGIAN-ONLY FINAL EMAIL ====================
// =================================================================

function sendAccFinalToBagian(idPengajuan) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const prepared = _prepareFinalPdf(idPengajuan);
        const pengajuan = prepared.pengajuan;
        const pdfBlob = prepared.pdfBlob;
        const bagianMatch = _resolveBagianEmailForPengajuan(pengajuan, prepared.details);
        const bagianName = bagianMatch.name || '';
        const bagianEmail = bagianMatch.email || '';

        if (!bagianEmail) {
            return { success: false, message: "Email Bagian untuk '" + (bagianName || '-') + "' tidak ditemukan. Cek Master Bagian / Master Data." };
        }

        const nama = String(pengajuan['Nama Lengkap'] || '').trim();
        const npm = String(pengajuan.NPM || '').trim();
        const subject = 'Pemberitahuan ACC Final INHAL Mahasiswa - ' + (nama || '');
        const body = "Assalamu'alaikum Admin Bagian " + (bagianName || '') + '.' +
            '\n\nTerlampir adalah bukti ACC final pendaftaran INHAL.' +
            '\nMohon segera ditindak lanjuti.' +
            '\n\nData Mahasiswa:' +
            '\nNama: ' + nama +
            '\nNPM: ' + npm +
            "\n\nTerimakasih,\n\nWassalamu'alaikum\nAdmin Prodi";

        MailApp.sendEmail({ to: bagianEmail, subject: subject, body: body, attachments: [pdfBlob] });

        updateStatusInfoBagian(
            idPengajuan,
            'Terkirim',
            bagianEmail,
            'Dikirim ulang khusus ke Bagian oleh Admin'
        );

        return { success: true, message: "Email final terkirim ke Bagian '" + (bagianName || '') + "' (" + bagianEmail + ').' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

// =================================================================
// ==================== REKAP / EXPORT =============================
// =================================================================

function getAcceptedStudentData(filter) {
    requireAuthorized(arguments[arguments.length - 1]);
    filter = filter || {};
    let rows = getAllRows('Pengajuan');
    const fStatus = String(filter.status || '').trim();
    if (fStatus) {
        rows = rows.filter(function(r) { return String(r.Status || '').trim() === fStatus; });
    }
    rows.sort(function(a, b) {
        return String(a.Timestamp || '').localeCompare(String(b.Timestamp || ''));
    });
    const biayaMap = _getBiayaMap();
    return rows.map(function(r) {
        const copy = Object.assign({}, r);
        copy.Biaya = _resolveBiayaForPengajuan(copy, biayaMap);
        copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
        return copy;
    });
}
