<?php
$pageKey = $page ?? 'laporan';
$pageTitle = $title ?? 'Laporan';
$userEmail = $userEmail ?? '';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf" content="<?= csrf_hash() ?>">
    <title><?= htmlspecialchars($pageTitle) ?> | Pendaftaran INHAL</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <style>
        *,*::before,*::after{box-sizing:border-box}
        [v-cloak]{display:none}
        body{margin:0;background:#f5f6fa;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased}
        .topnav{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.85);border-bottom:1px solid #eef1f6;backdrop-filter:blur(8px)}
        .topnav-inner{max-width:72rem;margin:0 auto;height:4rem;padding:0 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
        .topnav-brand{display:flex;align-items:center;gap:.75rem;text-decoration:none;color:inherit}
        .topnav-badge{display:inline-flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:.75rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.35)}
        .topnav-brand-text{display:flex;flex-direction:column}
        .topnav-name{font-size:.95rem;font-weight:800;letter-spacing:-.01em;color:#0f172a;line-height:1.2}
        .topnav-sub{font-size:.68rem;color:#94a3b8;line-height:1.2}
        .topnav-links{display:flex;align-items:center;gap:.35rem;overflow-x:auto;scrollbar-width:none}
        .topnav-links::-webkit-scrollbar{display:none}
        .topnav-link{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;padding:.5rem .8rem;border-radius:.7rem;font-size:.8rem;font-weight:600;color:#64748b;text-decoration:none;transition:background .15s ease,color .15s ease}
        .topnav-link:hover{background:#f1f5f9;color:#334155}
        .topnav-link.is-active{background:#eef2ff;color:#4f46e5}
        .container{max-width:72rem;margin:0 auto;padding:1.75rem 1.25rem 3rem}
        .page-head{display:flex;align-items:center;gap:.9rem;margin-bottom:1.25rem}
        .page-head-icon{display:inline-flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border-radius:.9rem;background:#eef2ff;color:#4f46e5;font-size:1.25rem}
        .page-head h1{margin:0;font-size:1.35rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .page-head p{margin:.15rem 0 0;font-size:.8rem;color:#94a3b8}
        .card{background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:1.5rem}
        .card-note{display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:#475569}
        .boot-chip{display:inline-flex;align-items:center;gap:.4rem;margin-top:1rem;border-radius:999px;background:#ecfdf5;color:#059669;padding:.35rem .8rem;font-size:.75rem;font-weight:700}
    </style>
</head>
<body>
<div id="app">
    <?= view('layouts/nav', ['page' => $pageKey, 'title' => $pageTitle]) ?>
    <main class="container">
        <div class="page-head">
            <div class="page-head-icon"><i class="bi bi-file-earmark-bar-graph"></i></div>
            <div>
                <h1>Laporan INHAL</h1>
                <p>Rekapitulasi pengajuan, dosen, bagian, dan berita acara</p>
            </div>
        </div>
        <div class="card">
            <div class="card-note">
                <i class="bi bi-cursor"></i>
                <span>Kerangka halaman laporan. Login admin, matriks laporan bagian dan dosen, serta ekspor ditambahkan pada tahap berikutnya.</span>
            </div>
            <div v-cloak class="boot-chip">
                <i class="bi bi-check-circle-fill"></i>
                <span>{{ bootMsg }}</span>
            </div>
        </div>
    </main>
</div>
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
<script>
Vue.createApp({
    data() {
        return {
            pageKey: <?= json_encode($pageKey) ?>,
            bootMsg: 'Halaman ' + <?= json_encode($pageTitle) ?> + ' siap (Vue ' + Vue.version + ')'
        };
    }
}).mount('#app');
</script>
</body>
</html>
