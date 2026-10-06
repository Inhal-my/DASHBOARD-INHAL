/**
 * Drive Bridge — dipakai oleh Worker (new-code1-cf) untuk menyimpan berkas
 * Berita Acara ke Google Drive (folder DRIVE_FOLDER_ID di 0_code.gs) sekaligus
 * membuat PDF surat (status & ACC final) dan mengirim email via MailApp.
 *
 * Cara pakai:
 *   1. Set Script Property DRIVE_BRIDGE_TOKEN (Project Settings > Script Properties).
 *   2. Deploy > Manage deployments > Edit (aktif) > Version: New version > Deploy.
 *   3. Web App sudah berformat "Execute as: Me" / "Access: Anyone" (lihat appsscript.json).
 *
 * Aksi yang didukung:
 *   - saveFile            : simpan berkas base64 ke Drive.
 *   - trashFile           : pindahkan berkas Drive ke trash.
 *   - sendStatusEmail     : render PDF ACC/Ditolak + kirim notifikasi status ke mahasiswa.
 *   - sendFinalEmail      : render PDF ACC final + kirim ke mahasiswa dan Bagian.
 *   - sendFinalToBagian   : render PDF ACC final + kirim ulang khusus ke Bagian.
 *   - sendReceiptEmail    : kirim email tanda terima upload bukti (tanpa lampiran).
 *
 * Catatan: data pengajuan dikirim oleh Worker (bukan dibaca dari sheet), agar
 * sumber kebenaran tetap di Cloudflare D1.
 */

function _driveBridgeToken() {
    return String(PropertiesService.getScriptProperties().getProperty('DRIVE_BRIDGE_TOKEN') || '').trim();
}

function _driveBridgeJson(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

function _driveBridgeExtractId(url) {
    const m = String(url || '').match(/[=\/]([\w\-]{20,})/);
    return m ? m[1] : '';
}

function _driveBridgeStr(v) {
    return String(v === undefined || v === null ? '' : v).trim();
}

function _driveBridgeIdOf(data, body) {
    const id = _driveBridgeStr((data && data.IDPengajuan) || body.idPengajuan);
    return id || 'unknown';
}

function _driveBridgeSendStatus(data, status, recipient) {
    const templateRef = status === 'Ditolak' ? TEMPLATE_DITOLAK : TEMPLATE_DITERIMA;
    const pdfBlob = _createPdfFromTemplate(templateRef, data, status);
    let attachmentUrl = '';
    try {
        attachmentUrl = _saveBlobToDrive(pdfBlob, 'notifikasi-' + _driveBridgeIdOf(data, {}));
    } catch (e) {
        console.error('drive-bridge: gagal simpan lampiran notifikasi: ' + (e && e.message ? e.message : e));
    }
    _sendNotificationEmail(recipient, status, pdfBlob, data);
    return attachmentUrl;
}

function _driveBridgeSendFinal(data, idPengajuan, studentEmail, studentName, npm, bagianEmail, bagianName) {
    const pdfBlob = _createPdfFromTemplate(TEMPLATE_ACC_FINAL, data, 'Final');
    let pdfUrl = '';
    try {
        pdfUrl = _saveBlobToDrive(pdfBlob, 'final-' + idPengajuan);
    } catch (e) {
        console.error('drive-bridge: gagal simpan PDF final: ' + (e && e.message ? e.message : e));
    }

    let studentSent = false;
    let bagianSent = false;

    if (studentEmail) {
        try {
            const subject = 'Surat Keterangan Final INHAL - ' + (studentName || '');
            const body = "Assalamu'alaikum " + (studentName || '') + ' (NPM: ' + npm + ').' +
                '\n\nTerlampir adalah surat keterangan final pendaftaran INHAL Anda.' +
                '\nBerkas Anda telah diperiksa dan ACC final telah disetujui oleh Admin Prodi.' +
                "\n\nWassalamu'alaikum\nAdmin Prodi";
            MailApp.sendEmail({ to: studentEmail, subject: subject, body: body, attachments: [pdfBlob] });
            studentSent = true;
        } catch (e) {
            console.error('drive-bridge: gagal kirim email final ke mahasiswa: ' + (e && e.message ? e.message : e));
        }
    }

    if (bagianEmail) {
        try {
            const subject = 'Pemberitahuan ACC Final INHAL Mahasiswa - ' + (studentName || '');
            const body = "Assalamu'alaikum Admin Bagian " + (bagianName || '') + '.' +
                '\n\nTerlampir adalah bukti ACC final pendaftaran INHAL.' +
                '\nMohon segera ditindak lanjuti.' +
                '\n\nData Mahasiswa:' +
                '\nNama: ' + studentName +
                '\nNPM: ' + npm +
                "\n\nTerimakasih,\n\nWassalamu'alaikum\nAdmin Prodi";
            MailApp.sendEmail({ to: bagianEmail, subject: subject, body: body, attachments: [pdfBlob] });
            bagianSent = true;
        } catch (e) {
            console.error('drive-bridge: gagal kirim email final ke Bagian: ' + (e && e.message ? e.message : e));
        }
    }

    return { pdfUrl: pdfUrl, studentEmailSent: studentSent, bagianEmailSent: bagianSent };
}

function _driveBridgeSendFinalToBagian(data, idPengajuan, studentName, npm, bagianEmail, bagianName) {
    const pdfBlob = _createPdfFromTemplate(TEMPLATE_ACC_FINAL, data, 'Final');
    let pdfUrl = '';
    try {
        pdfUrl = _saveBlobToDrive(pdfBlob, 'final-' + idPengajuan);
    } catch (e) {
        console.error('drive-bridge: gagal simpan PDF final: ' + (e && e.message ? e.message : e));
    }

    const subject = 'Pemberitahuan ACC Final INHAL Mahasiswa - ' + (studentName || '');
    const body = "Assalamu'alaikum Admin Bagian " + (bagianName || '') + '.' +
        '\n\nTerlampir adalah bukti ACC final pendaftaran INHAL.' +
        '\nMohon segera ditindak lanjuti.' +
        '\n\nData Mahasiswa:' +
        '\nNama: ' + studentName +
        '\nNPM: ' + npm +
        "\n\nTerimakasih,\n\nWassalamu'alaikum\nAdmin Prodi";
    MailApp.sendEmail({ to: bagianEmail, subject: subject, body: body, attachments: [pdfBlob] });
    return { pdfUrl: pdfUrl };
}

function _driveBridgeSendReceipt(data) {
    const recipient = _driveBridgeStr(data.recipient);
    if (!recipient) throw new Error('Email penerima kosong.');
    const nama = _driveBridgeStr(data.nama);
    const npm = _driveBridgeStr(data.npm);
    const blok = _driveBridgeStr(data.blok);
    const jenis = _driveBridgeStr(data.jenis);
    const detail = _driveBridgeStr(data.detail);
    const tanggal = _driveBridgeStr(data.tanggal);
    const accUrl = _driveBridgeStr(data.accUrl);
    const buktiUrl = _driveBridgeStr(data.buktiUrl);

    const subject = 'Konfirmasi pengisian form Upload Bukti Pembayaran INHAL';
    const lines = [
        "Assalamu'alaikum " + nama + ' ,',
        'Kami telah menerima upload bukti pembayaran INHAL Anda. Berikut ringkasan data yang tercatat:',
        'NPM: ' + npm,
        'Nama Lengkap: ' + nama,
        'Blok: ' + blok,
        'Jenis Kegiatan: ' + jenis,
        'Detail Kegiatan: ' + detail,
        'Tanggal: ' + tanggal,
        'Link ACC INHAL: ' + accUrl,
        'Link Bukti Bayar: ' + buktiUrl,
        '',
        'Catatan:',
        '- Prodi akan memverifikasi dokumen dan Anda akan menerima email pemberitahuan selanjutnya.',
        '- Silakan simpan email ini sebagai bukti bahwa pengisian form Anda sudah tercatat.',
        'Jika ada pertanyaan, silakan hubungi admin Prodi.',
        'Terima kasih.',
        "Wassalamu'alaikum."
    ];
    const plainBody = lines.join('\n');
    const htmlBody = [
        "Assalamu'alaikum " + nama + ' ,',
        'Kami telah menerima upload bukti pembayaran INHAL Anda. Berikut ringkasan data yang tercatat:',
        'NPM: ' + npm,
        'Nama Lengkap: ' + nama,
        'Blok: ' + blok,
        'Jenis Kegiatan: ' + jenis,
        'Detail Kegiatan: ' + detail,
        'Tanggal: ' + tanggal,
        'Link ACC INHAL: <a href="' + accUrl + '" target="_blank">' + accUrl + '</a>',
        'Link Bukti Bayar: <a href="' + buktiUrl + '" target="_blank">' + buktiUrl + '</a>',
        '',
        'Catatan:',
        '- Prodi akan memverifikasi dokumen dan Anda akan menerima email pemberitahuan selanjutnya.',
        '- Silakan simpan email ini sebagai bukti bahwa pengisian form Anda sudah tercatat.',
        'Jika ada pertanyaan, silakan hubungi admin Prodi.',
        'Terima kasih.',
        "Wassalamu'alaikum."
    ].map(function(line) { return '<p>' + line + '</p>'; }).join('');

    MailApp.sendEmail(recipient, subject, plainBody, { htmlBody: htmlBody });
    return true;
}

function doPost(e) {
    try {
        const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
        const body = raw ? JSON.parse(raw) : {};
        const expected = _driveBridgeToken();
        if (!expected || String(body.token || '') !== expected) {
            return _driveBridgeJson({ success: false, message: 'Token tidak valid.' });
        }

        const action = String(body.action || '').trim();
        if (action === 'saveFile') {
            const data = String(body.base64 || '');
            if (!data) return _driveBridgeJson({ success: false, message: 'Berkas kosong.' });
            const url = _saveFileToDrive(data, body.mimeType, body.fileName, body.prefix);
            return _driveBridgeJson({
                success: true,
                url: url,
                fileId: _driveBridgeExtractId(url),
                name: String(body.fileName || '')
            });
        }

        if (action === 'trashFile') {
            const id = String(body.fileId || '').trim();
            if (!id) return _driveBridgeJson({ success: false, message: 'fileId wajib diisi.' });
            try { DriveApp.getFileById(id).setTrashed(true); } catch (err) { }
            return _driveBridgeJson({ success: true });
        }

        if (action === 'sendStatusEmail') {
            const data = body.data || {};
            const status = _driveBridgeStr(body.status || data.Status);
            const recipient = _driveBridgeStr(body.recipient || data.Email);
            if (!recipient) return _driveBridgeJson({ success: false, message: 'Email mahasiswa tidak ditemukan.' });
            const attachmentUrl = _driveBridgeSendStatus(data, status, recipient);
            return _driveBridgeJson({ success: true, attachmentUrl: attachmentUrl });
        }

        if (action === 'sendFinalEmail') {
            const data = body.data || {};
            const idPengajuan = _driveBridgeIdOf(data, body);
            const res = _driveBridgeSendFinal(
                data, idPengajuan,
                _driveBridgeStr(body.studentEmail), _driveBridgeStr(body.studentName), _driveBridgeStr(body.npm),
                _driveBridgeStr(body.bagianEmail), _driveBridgeStr(body.bagianName)
            );
            return _driveBridgeJson({
                success: true,
                pdfUrl: res.pdfUrl,
                studentEmailSent: res.studentEmailSent,
                bagianEmailSent: res.bagianEmailSent
            });
        }

        if (action === 'sendFinalToBagian') {
            const data = body.data || {};
            const idPengajuan = _driveBridgeIdOf(data, body);
            const bagianEmail = _driveBridgeStr(body.bagianEmail);
            if (!bagianEmail) return _driveBridgeJson({ success: false, message: 'Email Bagian tidak ditemukan.' });
            const res = _driveBridgeSendFinalToBagian(
                data, idPengajuan,
                _driveBridgeStr(body.studentName), _driveBridgeStr(body.npm),
                bagianEmail, _driveBridgeStr(body.bagianName)
            );
            return _driveBridgeJson({ success: true, pdfUrl: res.pdfUrl });
        }

        if (action === 'sendReceiptEmail') {
            const data = body.data || {};
            _driveBridgeSendReceipt(data);
            return _driveBridgeJson({ success: true });
        }

        return _driveBridgeJson({ success: false, message: 'Aksi tidak dikenal: ' + action });
    } catch (err) {
        return _driveBridgeJson({ success: false, message: (err && err.message) ? err.message : String(err) });
    }
}
