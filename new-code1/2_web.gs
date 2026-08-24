const PAGE_TITLES = {
    index: 'Pendaftaran INHAL',
    portal: 'Portal Mahasiswa INHAL',
    admin: 'Dashboard INHAL',
    bagian: 'Panel Bagian INHAL',
    dashboard: 'Dashboard INHAL',
    'detail-laporan': 'Detail Laporan INHAL'
};

const PAGE_IDS = ['index', 'portal', 'admin', 'bagian', 'dashboard', 'detail-laporan'];

function doGet(e) {
    const params = e && e.parameter ? e.parameter : {};
    let page = String(params.page || 'index').toLowerCase();
    if (PAGE_IDS.indexOf(page) === -1) {
        page = 'index';
    }
    if (page === 'admin') {
        page = 'dashboard';
    }
    return renderPage(page);
}

function renderPage(page) {
    let tpl = null;
    try {
        tpl = HtmlService.createTemplateFromFile('pages/' + page);
    } catch (e) {
        tpl = null;
    }
    if (!tpl) {
        tpl = HtmlService.createTemplateFromFile(page);
    }
    tpl.appUrl = ScriptApp.getService().getUrl();
    tpl.userEmail = getCurrentUserEmail();
    const html = tpl.evaluate()
        .setTitle(PAGE_TITLES[page] || 'INHAL')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return html;
}

function renderMessagePage(title, message, detectedEmail) {
    const esc = function(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    const emailInfo = detectedEmail === undefined ? '' :
        '<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px">Email terdeteksi: <code style="background:#f1f5f9;padding:2px 6px;border-radius:6px;color:#0f172a">' + (detectedEmail ? esc(detectedEmail) : '(kosong - tidak ada login Google terdeteksi)') + '</code></p>';
    const html = HtmlService.createHtmlOutput(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>' + esc(title) + '</title>' +
        '<style>body{font-family:system-ui,sans-serif;background:#f1f5f9;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#fff;padding:32px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);max-width:420px;width:90%;text-align:center}.card h1{font-size:20px;margin:0 0 8px}.card p{color:#475569;margin:0;line-height:1.5}</style>' +
        '</head><body><div class="card"><h1>' + esc(title) + '</h1><p>' + esc(message) + '</p>' + emailInfo + '</div></body></html>'
    ).setTitle(title);
    html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return html;
}
