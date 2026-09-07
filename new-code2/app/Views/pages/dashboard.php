<?php
$pageKey = $page ?? 'dashboard';
$pageTitle = $title ?? 'Dashboard';
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
        .wrap{max-width:72rem;margin:0 auto;padding:1.5rem 1.25rem 4rem}
        .page-head{display:flex;align-items:center;gap:.9rem;margin-bottom:1.25rem;flex-wrap:wrap}
        .page-head-icon{display:inline-flex;align-items:center;justify-content:center;width:2.9rem;height:2.9rem;border-radius:1rem;background:#eef2ff;color:#4f46e5;font-size:1.3rem}
        .page-head h1{margin:0;font-size:1.3rem;font-weight:800;letter-spacing:-.01em}
        .page-head p{margin:.15rem 0 0;font-size:.8rem;color:#64748b}
        .page-head-actions{margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap}
        .tabs{display:flex;gap:.35rem;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:.35rem;margin-bottom:1.25rem;width:max-content;max-width:100%;overflow-x:auto}
        .tab{border:0;background:transparent;display:inline-flex;align-items:center;gap:.5rem;font-size:.85rem;font-weight:700;color:#64748b;padding:.55rem 1rem;border-radius:.7rem;cursor:pointer;white-space:nowrap;transition:.15s ease}
        .tab:hover{background:#f1f5f9;color:#334155}
        .tab.is-active{background:#eef2ff;color:#4f46e5}
        .tab .dot{display:inline-flex;align-items:center;justify-content:center;min-width:1.15rem;height:1.15rem;padding:0 .3rem;border-radius:999px;background:#fde68a;color:#92400e;font-size:.66rem;font-weight:800}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.8rem;margin-bottom:1.25rem}
        .stat{background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.25rem}
        .stat-label{font-size:.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:.35rem}
        .stat-value{font-size:1.4rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .stat-sub{font-size:.72rem;color:#94a3b8}
        .card{background:#fff;border-radius:1.15rem;box-shadow:0 1px 3px rgba(15,23,42,.06);margin-bottom:1.25rem;overflow:hidden}
        .card-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1.05rem 1.25rem;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
        .card-title{display:flex;align-items:center;gap:.6rem;font-size:.98rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .card-title i{color:#6366f1}
        .card-body{padding:1.25rem}
        .empty{text-align:center;padding:2.5rem 1rem;color:#94a3b8}
        .empty i{font-size:2.2rem;display:block;margin-bottom:.6rem;opacity:.6}
        .empty p{margin:0;font-size:.88rem;font-weight:600}
        .chips{display:flex;flex-wrap:wrap;gap:.45rem}
        .chip{border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:.78rem;font-weight:700;padding:.4rem .85rem;border-radius:999px;cursor:pointer;transition:.15s ease;display:inline-flex;align-items:center;gap:.35rem}
        .chip:hover{border-color:#cbd5e1}
        .chip.is-active{background:#0f172a;border-color:#0f172a;color:#fff}
        .chip .cnt{opacity:.65;font-weight:700}
        .filterbar{display:grid;gap:.75rem;margin-bottom:1rem}
        @media(min-width:768px){.filterbar{grid-template-columns:2fr 1fr 1fr auto}}
        .input{width:100%;border:1px solid #e2e8f0;border-radius:.8rem;padding:.62rem .9rem;font-size:.88rem;color:#0f172a;background:#fff;transition:.15s ease}
        .input:focus{outline:none;border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border:0;border-radius:.8rem;font-size:.84rem;font-weight:700;padding:.6rem 1rem;cursor:pointer;transition:.15s ease}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#7c5cf0);color:#fff;box-shadow:0 6px 18px rgba(99,102,241,.28)}
        .btn-primary:hover{filter:brightness(1.05)}
        .btn-soft{background:#fff;color:#475569;border:1px solid #e2e8f0}
        .btn-soft:hover{background:#f8fafc;color:#0f172a}
        .btn-danger-soft{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
        .btn-danger-soft:hover{background:#fee2e2}
        .btn-success{background:#059669;color:#fff}
        .btn-success:hover{filter:brightness(1.05)}
        .btn-sm{padding:.42rem .75rem;font-size:.78rem;border-radius:.65rem}
        table.list{width:100%;border-collapse:collapse;font-size:.84rem}
        table.list th{text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:.65rem 1rem;border-bottom:1px solid #f1f5f9;background:#fafbfc;font-weight:800;white-space:nowrap}
        table.list td{padding:.7rem 1rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155}
        table.list tbody tr{cursor:pointer;transition:.12s ease}
        table.list tbody tr:hover{background:#f8fafc}
        .table-scroll{overflow-x:auto}
        .badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;font-weight:800;padding:.26rem .6rem;border-radius:999px;white-space:nowrap}
        .st-menunggu{background:#fffbeb;color:#b45309}
        .st-diterima{background:#ecfdf5;color:#047857}
        .st-acc{background:#eef2ff;color:#4f46e5}
        .st-ditolak{background:#fef2f2;color:#b91c1c}
        .st-dibatalkan{background:#f1f5f9;color:#475569}
        .flag-on{display:inline-flex;align-items:center;gap:.25rem;background:#ecfdf5;color:#047857;font-size:.7rem;font-weight:800;padding:.2rem .55rem;border-radius:999px}
        .flag-off{color:#cbd5e1;font-size:.8rem}
        .check-item{display:flex;align-items:center;gap:.6rem;padding:.55rem .1rem;font-size:.84rem}
        .check-name{font-weight:700;color:#0f172a;flex:1;min-width:0}
        .check-npm{font-size:.7rem;color:#94a3b8;margin-left:.35rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76rem}
        .sec-title{display:flex;align-items:center;gap:.5rem;font-weight:800;font-size:.95rem;margin:1.3rem 0 .9rem;color:#0f172a}
        .sec-title i{color:#6366f1}
        .grid-info{display:grid;gap:.7rem 1.2rem;grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))}
        .label{display:block;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-bottom:.3rem}
        .value{font-size:.9rem;color:#334155;word-break:break-word}
        .panel{background:#f8fafc;border-radius:1rem;padding:1rem 1.1rem;margin-bottom:1rem}
        .panel-white{background:#fff;border:1px solid #f1f5f9;border-radius:1rem;padding:1rem 1.1rem;margin-bottom:1rem}
        .grid-form{display:grid;gap:.8rem;grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))}
        .detail-item{background:#fff;border:1px solid #f1f5f9;border-radius:.9rem;padding:.85rem 1rem;margin-bottom:.6rem}
        .detail-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem}
        .detail-actions{display:flex;gap:.25rem;flex:none}
        .icon-btn{border:0;background:transparent;color:#94a3b8;width:1.9rem;height:1.9rem;border-radius:.55rem;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
        .icon-btn:hover{background:#f1f5f9;color:#4f46e5}
        .icon-btn.danger:hover{background:#fef2f2;color:#e11d48}
        .auth-card{max-width:26rem;margin:6vh auto 0;background:#fff;border-radius:1.25rem;box-shadow:0 20px 60px rgba(15,23,42,.12);padding:2rem 1.75rem}
        .auth-logo{width:3rem;height:3rem;border-radius:1rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 1rem;box-shadow:0 10px 26px rgba(99,102,241,.4)}
        .auth-title{text-align:center;font-size:1.15rem;font-weight:800;letter-spacing:-.01em;margin:0 0 .25rem}
        .auth-desc{text-align:center;font-size:.8rem;color:#64748b;margin:0 0 1.25rem}
        .role-tabs{display:grid;grid-template-columns:1fr 1fr;gap:.35rem;background:#f1f5f9;padding:.3rem;border-radius:.8rem;margin-bottom:1.15rem}
        .role-tab{border:0;background:transparent;font-size:.8rem;font-weight:700;color:#64748b;padding:.5rem;border-radius:.6rem;cursor:pointer}
        .role-tab.is-active{background:#fff;color:#4f46e5;box-shadow:0 1px 4px rgba(15,23,42,.08)}
        .field{margin-bottom:.9rem}
        .field label{display:flex;align-items:center;gap:.4rem;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.35rem}
        .field label i{color:#94a3b8}
        .auth-error{display:flex;align-items:center;gap:.5rem;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:.8rem;font-weight:600;border-radius:.8rem;padding:.6rem .8rem;margin-bottom:.9rem}
        .modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(2px);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto}
        .modal{background:#fff;border-radius:1.25rem;width:100%;max-width:52rem;box-shadow:0 30px 80px rgba(15,23,42,.25);overflow:hidden;margin:auto}
        .modal-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1.15rem 1.35rem;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
        .modal-title{font-weight:800;font-size:1rem;display:flex;align-items:center;gap:.55rem}
        .modal-title i{color:#6366f1}
        .modal-sub{font-family:ui-monospace,monospace;font-size:.72rem;color:#94a3b8}
        .modal-close{border:0;background:#f1f5f9;color:#64748b;width:2rem;height:2rem;border-radius:.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .modal-close:hover{background:#e2e8f0;color:#0f172a}
        .modal-body{padding:1.35rem}
        .modal-foot{padding:1rem 1.35rem;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:.6rem;flex-wrap:wrap}
        .loading-pane{display:flex;flex-direction:column;align-items:center;gap:.6rem;padding:3.5rem 1rem;color:#64748b}
        .spinner{width:1.4rem;height:1.4rem;border:3px solid #e0e7ff;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        .spinner-sm{width:1rem;height:1rem;border-width:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .toast{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:.6rem;max-width:92vw;color:#fff;font-size:.85rem;font-weight:600;padding:.8rem 1.15rem;border-radius:.9rem;box-shadow:0 14px 40px rgba(15,23,42,.35);animation:rise .25s ease}
        .toast-success{background:#065f46}
        .toast-error{background:#991b1b}
        .toast-info{background:#0f172a}
        @keyframes rise{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        .fade-enter-active,.fade-leave-active{transition:opacity .18s ease}
        .fade-enter-from,.fade-leave-to{opacity:0}
        .pop-enter-active,.pop-leave-active{transition:transform .2s ease,opacity .2s ease}
        .pop-enter-from,.pop-leave-to{transform:scale(.96);opacity:0}
        .bar-track{height:.55rem;background:#f1f5f9;border-radius:999px;overflow:hidden;flex:1}
        .bar-fill{height:100%;border-radius:999px;transition:width .4s ease}
        .chart-row{display:flex;align-items:center;gap:.7rem;margin-bottom:.6rem}
        .chart-label{width:7.5rem;flex:none;text-align:right;font-size:.78rem;font-weight:600;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chart-val{width:2.2rem;flex:none;text-align:right;font-size:.78rem;font-weight:800;color:#0f172a}
        .link{font-weight:600;color:#4f46e5;text-decoration:none;word-break:break-all}
        .link:hover{text-decoration:underline}
        .divider{border:0;border-top:1px solid #f1f5f9;margin:1rem 0}
        .btn-block{width:100%}
        .topbar-actions{display:flex;align-items:center;gap:.6rem}
        .user-chip{display:inline-flex;align-items:center;gap:.45rem;font-size:.78rem;font-weight:600;color:#334155;background:#fff;border:1px solid #e2e8f0;padding:.4rem .8rem;border-radius:999px}
        .user-chip i{color:#6366f1}
        .hint{font-size:.74rem;color:#94a3b8;font-weight:500}
        .req{color:#e11d48}
    </style>
</head>
<body>
<div id="app" v-cloak>
    <div style="position:sticky;top:0;z-index:40;background:rgba(255,255,255,.88);border-bottom:1px solid #eef1f6;backdrop-filter:blur(8px)">
        <div style="max-width:72rem;margin:0 auto;height:4rem;padding:0 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem">
            <div style="display:flex;align-items:center;gap:.7rem">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:.8rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.35);font-size:1.1rem"><i class="bi bi-speedometer2"></i></span>
                <div>
                    <div style="font-weight:800;font-size:.95rem;letter-spacing:-.01em;line-height:1.2">Dashboard INHAL</div>
                    <div style="font-size:.68rem;color:#94a3b8;line-height:1.2">Admin operasional pengajuan</div>
                </div>
            </div>
            <div v-if="loggedIn" class="topbar-actions">
                <span class="user-chip"><i class="bi bi-person-circle"></i>{{ sessionNama }}</span>
                <a class="btn btn-soft btn-sm" href="/"><i class="bi bi-house"></i><span style="display:none" class="md-inline">Beranda</span></a>
                <a class="btn btn-soft btn-sm" href="/logout"><i class="bi bi-box-arrow-right"></i> Keluar</a>
            </div>
        </div>
    </div>

    <div class="wrap">
        <template v-if="bootLoading">
            <div class="card"><div class="loading-pane"><div class="spinner"></div><span>Memeriksa sesi admin…</span></div></div>
        </template>

        <template v-else-if="!loggedIn">
            <div class="auth-card">
                <div class="auth-logo"><i class="bi bi-shield-lock"></i></div>
                <h2 class="auth-title">Masuk Dashboard</h2>
                <p class="auth-desc">Masuk sebagai admin untuk mengelola pengajuan</p>
                <div class="role-tabs">
                    <button class="role-tab" :class="{'is-active': role==='admin'}" @click="role='admin'">Admin</button>
                    <button class="role-tab" :class="{'is-active': role==='bagian'}" @click="role='bagian'">Bagian</button>
                </div>
                <div v-if="loginError" class="auth-error"><i class="bi bi-exclamation-triangle-fill"></i>{{ loginError }}</div>
                <form @submit.prevent="doLogin">
                    <div v-if="role==='bagian'" class="field">
                        <label><i class="bi bi-envelope"></i> Email bagian</label>
                        <input class="input" type="email" v-model="loginEmail" autocomplete="username" placeholder="nama@inhal.test">
                    </div>
                    <div class="field">
                        <label><i class="bi bi-shield-lock"></i> {{ role==='admin' ? 'Password admin' : 'Password' }}</label>
                        <input class="input" type="password" v-model="loginPwd" autocomplete="current-password" placeholder="••••••••">
                    </div>
                    <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
                        <span v-if="loading" class="spinner spinner-sm"></span>
                        <i v-else class="bi bi-box-arrow-in-right"></i> Masuk
                    </button>
                </form>
            </div>
        </template>

        <template v-else>
            <div class="page-head">
                <div class="page-head-icon"><i class="bi bi-speedometer2"></i></div>
                <div>
                    <h1>{{ pageTitle }}</h1>
                    <p>Dashboard Admin INHAL</p>
                </div>
                <div class="page-head-actions">
                    <button class="btn btn-soft" @click="exportCsv()" title="Rekap CSV data saat ini"><i class="bi bi-download"></i>Rekap (CSV)</button>
                    <button class="btn btn-primary" @click="refresh()" :disabled="loading"><i class="bi bi-arrow-clockwise"></i>Muat Ulang</button>
                </div>
            </div>

            <div class="tabs">
                <button class="tab" :class="{'is-active': tab==='pengajuan'}" @click="tab='pengajuan'">
                    <i class="bi bi-inbox"></i> Telaah Pengajuan
                    <span v-if="stats.perStatus && stats.perStatus['Menunggu']" class="dot">{{ stats.perStatus['Menunggu'] }}</span>
                </button>
                <button class="tab" :class="{'is-active': tab==='stats'}" @click="tab='stats'">
                    <i class="bi bi-bar-chart-line"></i> Statistik
                </button>
                <button class="tab" :class="{'is-active': tab==='ba'}" @click="setTab('ba')">
                    <i class="bi bi-file-earmark-text"></i> Berita Acara
                    <span v-if="baSummary.jumlahBa" class="dot">{{ baSummary.jumlahBa }}</span>
                </button>
                <button class="tab" :class="{'is-active': tab==='bab'}" @click="setTab('bab')">
                    <i class="bi bi-diagram-3"></i> BA Bagian
                </button>
            </div>

            <section v-if="tab==='pengajuan'">
                <div class="chips" style="margin-bottom:1rem">
                    <button v-for="c in statusChips" :key="'st-'+c.key" class="chip" :class="{'is-active': filters.status===c.key}" @click="filters.status=c.key">
                        {{ c.label }} <span class="cnt">{{ c.count }}</span>
                    </button>
                </div>

                <div class="card" style="box-shadow:none;border:1px solid #f1f5f9">
                    <div class="card-body" style="padding:.9rem 1rem">
                        <div class="filterbar">
                            <div style="position:relative">
                                <i class="bi bi-search" style="position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:.85rem"></i>
                                <input class="input" style="padding-left:2.3rem" v-model="filters.search" placeholder="Cari NPM / nama...">
                            </div>
                            <select class="input" v-model="filters.jenis">
                                <option value="">Semua Jenis Kegiatan</option>
                                <option v-for="j in ['Ujian','SGD','KKD','Praktikum']" :value="j">{{ j }}</option>
                            </select>
                            <select class="input" v-model="filters.blok">
                                <option value="">Semua Blok</option>
                                <option v-for="b in blokOptions" :value="b">{{ b }}</option>
                            </select>
                            <button class="btn btn-soft" @click="clearFilters()"><i class="bi bi-eraser"></i>Reset</button>
                        </div>
                    </div>
                </div>

                <div class="card" v-if="loadingRows">
                    <div class="loading-pane"><div class="spinner"></div><span>Memuat pengajuan…</span></div>
                </div>
                <div class="card" v-else>
                    <div v-if="!filteredPengajuan.length" class="empty">
                        <i class="bi bi-inbox"></i>
                        <p>Belum ada data.</p>
                    </div>
                    <div v-else class="table-scroll">
                        <table class="list">
                            <thead>
                            <tr>
                                <th>NPM</th>
                                <th>Nama Lengkap</th>
                                <th>Blok</th>
                                <th>Jenis Kegiatan</th>
                                <th>Tanggal Daftar</th>
                                <th>Biaya</th>
                                <th>Status</th>
                                <th>Bukti Bayar</th>
                                <th>Link Final</th>
                            </tr>
                            </thead>
                            <tbody>
                            <tr v-for="r in filteredPengajuan" :key="r.idPengajuan" @click="openDetail(r)">
                                <td class="mono">{{ r.npm }}</td>
                                <td style="font-weight:700;color:#0f172a">{{ r.namaLengkap }}</td>
                                <td>{{ r.blok }}</td>
                                <td>{{ r.jenisKegiatan }}</td>
                                <td style="white-space:nowrap">{{ formatTanggal(r.timestamp) }}</td>
                                <td style="font-weight:700;color:#4f46e5;white-space:nowrap">{{ formatRupiah(r.biaya) }}</td>
                                <td><span class="badge" :class="statusBadge(r.status)">{{ r.status }}</span></td>
                                <td>
                                    <span v-if="r.hasBukti" class="flag-on"><i class="bi bi-cash-coin"></i>Ada</span>
                                    <span v-else class="flag-off">—</span>
                                </td>
                                <td>
                                    <span v-if="r.hasFinal" class="flag-on"><i class="bi bi-file-earmark-pdf"></i>Final</span>
                                    <span v-else class="flag-off">—</span>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section v-if="tab==='stats'">
                <div class="stats">
                    <div v-for="c in statCards" :key="c.label" class="stat">
                        <span class="stat-label"><i :class="c.icon"></i> {{ c.label }}</span>
                        <span class="stat-value" :style="c.money ? 'font-size:1.05rem;padding-top:.25rem' : ''">{{ c.num }}</span>
                    </div>
                </div>
                <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))">
                    <div v-for="ch in statCharts" :key="ch.title" class="card">
                        <div class="card-head">
                            <span class="card-title"><i :class="ch.icon"></i> {{ ch.title }}</span>
                        </div>
                        <div class="card-body">
                            <div v-if="!ch.bars.length" class="empty"><i class="bi bi-bar-chart"></i><p>Belum ada data.</p></div>
                            <div v-else>
                                <div v-for="b in ch.bars" :key="ch.title+b.label" class="chart-row">
                                    <div class="chart-label">{{ b.label }}</div>
                                    <div class="bar-track"><div class="bar-fill" :style="{width:b.pct+'%',background:ch.grad}"></div></div>
                                    <div class="chart-val">{{ b.value }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section v-if="tab==='ba'">
                <div class="card">
                    <div class="card-head">
                        <span class="card-title"><i class="bi bi-file-earmark-text"></i> Berita Acara Admin ({{ baRows.length }})</span>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                            <button class="btn btn-soft" @click="loadBa()" :disabled="baLoading"><i class="bi bi-arrow-clockwise"></i>Muat Ulang</button>
                            <button class="btn btn-primary" @click="openBaUpload()"><i class="bi bi-upload"></i>Upload Berita Acara</button>
                        </div>
                    </div>
                    <div v-if="baLoading" class="loading-pane"><div class="spinner"></div><span>Memuat berita acara…</span></div>
                    <div v-else-if="!baRows.length" class="empty">
                        <i class="bi bi-file-earmark-text"></i>
                        <p>Belum ada berita acara dari admin.</p>
                    </div>
                    <div v-else class="table-scroll">
                        <table class="list">
                            <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Kegiatan</th>
                                <th>Bagian</th>
                                <th>Blok</th>
                                <th>Peserta</th>
                                <th>File</th>
                                <th>Catatan</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            <tr v-for="b in baRows" :key="b.baId" @click="toggleBaExpand(b.baId)">
                                <td style="white-space:nowrap">{{ formatTanggal(b.tanggalPelaksanaan) }}</td>
                                <td>
                                    <div style="font-weight:700;color:#0f172a">{{ b.namaKegiatan }}</div>
                                    <div style="font-size:.72rem;color:#94a3b8">{{ b.baId }}</div>
                                </td>
                                <td>{{ b.bagian || 'Admin' }}</td>
                                <td>{{ b.blok }}</td>
                                <td><span class="badge" style="background:#eef2ff;color:#4f46e5">{{ b.jumlahPeserta }}</span></td>
                                <td>
                                    <span v-if="b.file_name" class="flag-on"><i class="bi bi-paperclip"></i>{{ b.file_name }}</span>
                                    <span v-else class="flag-off">—</span>
                                </td>
                                <td style="max-width:14rem">{{ b.catatan || '—' }}</td>
                                <td style="text-align:right;white-space:nowrap">
                                    <button class="icon-btn danger" title="Hapus BA" @click.stop="deleteBa(b)"><i class="bi bi-trash"></i></button>
                                </td>
                            </tr>
                            </tbody>
                            <tbody v-for="b in baRows" :key="'p'+b.baId">
                            <tr v-if="expandedBa[b.baId]" style="background:#fafbfc">
                                <td colspan="8" style="padding:.4rem 1rem">
                                    <div v-if="!b.peserta.length" class="hint">Tidak ada peserta tercatat.</div>
                                    <table style="width:100%;font-size:.78rem;border-collapse:collapse">
                                        <thead><tr><th style="text-align:left;color:#94a3b8;padding:.35rem .5rem">NPM</th><th style="text-align:left;color:#94a3b8;padding:.35rem .5rem">Nama Lengkap</th><th style="text-align:left;color:#94a3b8;padding:.35rem .5rem">Blok</th><th style="text-align:left;color:#94a3b8;padding:.35rem .5rem">Status Pengajuan</th></tr></thead>
                                        <tbody>
                                        <tr v-for="p in b.peserta" :key="b.baId+p.npm">
                                            <td style="padding:.3rem .5rem" class="mono">{{ p.npm }}</td>
                                            <td style="padding:.3rem .5rem;font-weight:600">{{ p.namaLengkap }}</td>
                                            <td style="padding:.3rem .5rem">{{ p.blok }}</td>
                                            <td style="padding:.3rem .5rem"><span class="badge" :class="statusBadge(p.statusPengajuan)">{{ p.statusPengajuan }}</span></td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="stats" v-if="baSummary.jumlahBa !== undefined">
                    <div class="stat"><span class="stat-label"><i class="bi bi-file-earmark-text"></i> Total BA</span><span class="stat-value">{{ baSummary.jumlahBa }}</span></div>
                    <div class="stat"><span class="stat-label"><i class="bi bi-people"></i> Total Peserta</span><span class="stat-value">{{ baSummary.jumlahPeserta }}</span></div>
                    <div class="stat" v-if="baSummary.terakhir"><span class="stat-label"><i class="bi bi-clock-history"></i> Terakhir</span><span class="stat-value" style="font-size:1rem;padding-top:.2rem">{{ formatTanggalWaktu(baSummary.terakhir) }}</span></div>
                </div>
            </section>

            <section v-if="tab==='bab'">
                <div v-if="!bab.active" class="card">
                    <div class="card-head"><span class="card-title"><i class="bi bi-play-circle"></i> Mulai Sesi Bagian</span></div>
                    <div class="card-body">
                        <div class="grid-form" style="grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))">
                            <div>
                                <label class="label">Kategori</label>
                                <select v-model="bab.kategori" class="input" @change="onBabKategoriChange()">
                                    <option value="">(Pilih Kategori)</option>
                                    <option>SGD</option><option>KKD</option><option>Ujian</option><option>Praktikum</option>
                                </select>
                            </div>
                            <div v-if="bab.kategori==='Praktikum'">
                                <label class="label">Sub Bagian / Lab</label>
                                <select v-model="bab.subBagian" class="input">
                                    <option value="">(Pilih Lab)</option>
                                    <option v-for="l in babLabOptions" :key="l" :value="l">{{ l }}</option>
                                </select>
                            </div>
                            <div style="display:flex;align-items:flex-end">
                                <button class="btn btn-primary" :disabled="bab.loading" @click="babStart()">
                                    <span v-if="bab.loading" class="spinner spinner-sm"></span>
                                    <i v-else class="bi bi-play-circle"></i> Mulai Sesi Bagian
                                </button>
                            </div>
                        </div>
                        <p class="hint" style="margin:.9rem 0 0"><i class="bi bi-info-circle"></i> Lihat data kegiatan dan berita acara bagian sebagai petugas bagian (tanpa mengubah sesi admin).</p>
                    </div>
                </div>
                <template v-else>
                    <div class="card">
                        <div class="card-head">
                            <span class="card-title"><i class="bi bi-funnel-fill"></i> {{ bab.kategori }}<template v-if="bab.subBagian"> / {{ bab.subBagian }}</template></span>
                            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                                <span class="user-chip"><i class="bi bi-person-badge"></i>{{ bab.nama }}</span>
                                <button class="btn btn-soft" :disabled="bab.loading" @click="babLoad()"><i class="bi bi-arrow-clockwise"></i>Muat Ulang</button>
                                <button class="btn btn-danger-soft" @click="babEnd()"><i class="bi bi-box-arrow-right"></i>Akhiri Sesi</button>
                            </div>
                        </div>
                        <div class="stats" v-if="babSummary.jumlahBa !== undefined">
                            <div class="stat"><span class="stat-label"><i class="bi bi-people"></i> Peserta Kegiatan</span><span class="stat-value">{{ babRows.length }}</span><span class="stat-sub">Diterima / ACC</span></div>
                            <div class="stat"><span class="stat-label"><i class="bi bi-file-earmark-text"></i> Berita Acara</span><span class="stat-value">{{ babSummary.jumlahBa }}</span><span class="stat-sub">{{ babSummary.jumlahPeserta }} peserta</span></div>
                            <div class="stat" v-if="babSummary.terakhir"><span class="stat-label"><i class="bi bi-clock-history"></i> Terakhir</span><span class="stat-value" style="font-size:1rem;padding-top:.2rem">{{ formatTanggal(babSummary.terakhir) }}</span></div>
                        </div>
                        <div class="table-scroll" style="max-height:30rem;overflow:auto">
                            <table class="list">
                                <thead>
                                <tr>
                                    <th>NPM</th><th>Nama Lengkap</th><th>Blok</th><th>Kegiatan</th><th>Tanggal</th><th>Status</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr v-if="!babRows.length"><td colspan="6"><div class="empty" style="padding:1.5rem"><p>Belum ada kegiatan pada bagian ini.</p></div></td></tr>
                                <tr v-for="r in babRows" :key="r.idPengajuan">
                                    <td class="mono">{{ r.npm }}</td>
                                    <td style="font-weight:600;color:#0f172a">{{ r.namaLengkap }}</td>
                                    <td>{{ r.blok }}</td>
                                    <td>{{ r.pilihan }}<template v-if="r.detail"> - {{ r.detail }}</template></td>
                                    <td style="white-space:nowrap">{{ formatTanggal(r.tanggal) }}</td>
                                    <td><span class="badge" :class="statusBadge(r.status)">{{ r.status }}</span></td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-head"><span class="card-title"><i class="bi bi-file-earmark-check"></i> Berita Acara Bagian ({{ babBaList.length }})</span></div>
                        <div v-if="!babBaList.length" class="empty"><i class="bi bi-file-earmark-text"></i><p>Belum ada berita acara dari bagian ini.</p></div>
                        <div v-else class="table-scroll">
                            <table class="list">
                                <thead>
                                <tr><th>Tanggal</th><th>Kegiatan</th><th>Blok</th><th>Jumlah</th><th>File</th><th>Catatan</th></tr>
                                </thead>
                                <tbody>
                                <tr v-for="b in babBaList" :key="b.baId">
                                    <td style="white-space:nowrap">{{ formatTanggal(b.tanggalPelaksanaan) }}</td>
                                    <td><div style="font-weight:700;color:#0f172a">{{ b.namaKegiatan }}</div><div style="font-size:.72rem;color:#94a3b8">{{ b.baId }}</div></td>
                                    <td>{{ b.blok }}</td>
                                    <td><span class="badge" style="background:#eef2ff;color:#4f46e5">{{ b.jumlahPeserta }}</span></td>
                                    <td><span v-if="b.file_name" class="flag-on"><i class="bi bi-paperclip"></i>{{ b.file_name }}</span><span v-else class="flag-off">—</span></td>
                                    <td style="max-width:14rem">{{ b.catatan || '—' }}</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>
            </section>
        </template>
    </div>

    <transition name="fade">
        <div v-if="detail.open" class="modal-mask">
            <div class="modal-mask" style="position:static;background:transparent;backdrop-filter:none;padding:0" @click.self="closeDetail()">
                <transition name="pop" appear>
                    <div class="modal">
                        <div class="modal-head">
                            <div style="display:flex;align-items:center;gap:.8rem">
                                <div style="width:2.5rem;height:2.5rem;border-radius:.8rem;background:#eef2ff;color:#4f46e5;display:inline-flex;align-items:center;justify-content:center"><i class="bi bi-person-badge"></i></div>
                                <div>
                                    <div class="modal-title">Detail Pengajuan</div>
                                    <div class="modal-sub">{{ detail.p ? detail.p.idPengajuan : '' }}</div>
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;gap:.6rem">
                                <span v-if="detail.p" class="badge" :class="statusBadge(detail.p.status)">{{ detail.p.status }}</span>
                                <button class="modal-close" @click="closeDetail()"><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>

                        <div v-if="detail.loading" class="modal-body"><div class="loading-pane"><div class="spinner"></div><span>Memuat detail…</span></div></div>

                        <template v-else-if="detail.p">
                            <div class="modal-body">
                                <div class="panel">
                                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;flex-wrap:wrap;gap:.5rem">
                                        <span style="font-weight:800;font-size:.9rem;display:inline-flex;align-items:center;gap:.45rem"><i class="bi bi-person-vcard" style="color:#6366f1"></i> Data Mahasiswa</span>
                                        <button v-if="!detail.editInduk" class="btn btn-soft btn-sm" @click="startEditInduk()"><i class="bi bi-pencil-square"></i>Edit</button>
                                    </div>
                                    <div v-if="!detail.editInduk" class="grid-info">
                                        <div><span class="label">NPM</span><span class="value mono">{{ detail.p.npm }}</span></div>
                                        <div><span class="label">Nama Lengkap</span><span class="value" style="font-weight:700;color:#0f172a">{{ detail.p.namaLengkap }}</span></div>
                                        <div><span class="label">Email</span><span class="value">{{ detail.p.email || '—' }}</span></div>
                                        <div><span class="label">No. HP/WA</span><span class="value">{{ detail.p.noHp || '—' }}</span></div>
                                        <div><span class="label">Blok</span><span class="value">{{ detail.p.blok }}</span></div>
                                        <div><span class="label">Jenis Kegiatan</span><span class="value">{{ detail.p.jenisKegiatan }}</span></div>
                                        <div v-if="detail.p.matakuliah"><span class="label">Matakuliah</span><span class="value">{{ detail.p.matakuliah }}</span></div>
                                        <div><span class="label">Tanggal Pelaksanaan</span><span class="value">{{ formatTanggalWaktu(detail.p.tanggalPelaksanaan) }}</span></div>
                                        <div><span class="label">Tanggal Daftar</span><span class="value">{{ formatTanggal(detail.p.timestamp) }}</span></div>
                                        <div><span class="label">Biaya</span><span class="value" style="font-weight:700;color:#4f46e5">{{ formatRupiah(detail.p.biaya) }}</span></div>
                                        <div><span class="label">Nomor Surat</span><span class="value mono">{{ detail.p.nomorSurat || '—' }}</span></div>
                                        <div><span class="label">Keterangan</span><span class="value">{{ detail.p.keterangan || '—' }}</span></div>
                                    </div>
                                    <div v-else class="grid-form">
                                        <div><span class="label">NPM</span><span class="value mono">{{ detail.p.npm }}</span></div>
                                        <div><span class="label">Nama Lengkap</span><span class="value">{{ detail.p.namaLengkap }}</span></div>
                                        <div><label class="label">Email</label><input v-model="detail.iForm.email" type="email" class="input"></div>
                                        <div><label class="label">No. HP/WA</label><input v-model="detail.iForm.noHp" class="input"></div>
                                        <div><label class="label">Blok</label><input v-model="detail.iForm.blok" class="input"></div>
                                        <div><label class="label">Jenis Kegiatan</label>
                                            <select v-model="detail.iForm.jenisKegiatan" class="input">
                                                <option v-for="j in ['Ujian','SGD','KKD','Praktikum']" :value="j">{{ j }}</option>
                                            </select>
                                        </div>
                                        <div><label class="label">Tanggal Pelaksanaan</label><input v-model="detail.iForm.tanggalPelaksanaan" type="datetime-local" class="input"></div>
                                        <div style="display:flex;align-items:center;gap:.5rem;grid-column:1/-1">
                                            <button class="btn btn-primary btn-sm" @click="saveIndukFields()"><i class="bi bi-save"></i>Simpan</button>
                                            <button class="btn btn-soft btn-sm" @click="detail.editInduk=false">Batal</button>
                                        </div>
                                    </div>

                                    <div v-if="detail.p.hasSurat || detail.p.hasAcc || detail.p.hasBukti || detail.p.hasFinal" style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.9rem;padding-top:.9rem;border-top:1px dashed #e2e8f0">
                                        <span v-if="detail.p.hasSurat" class="flag-on"><i class="bi bi-file-earmark-text"></i>Surat Keterangan</span>
                                        <span v-if="detail.p.hasAcc" class="flag-on"><i class="bi bi-patch-check"></i>ACC INHAL</span>
                                        <span v-if="detail.p.hasBukti" class="flag-on"><i class="bi bi-cash-coin"></i>Bukti Bayar</span>
                                        <span v-if="detail.p.hasFinal" class="flag-on"><i class="bi bi-file-earmark-pdf"></i>Final</span>
                                        <a v-if="detail.p.linkSurat && isHttp(detail.p.linkSurat)" class="link" style="font-size:.75rem" :href="detail.p.linkSurat" target="_blank"><i class="bi bi-box-arrow-up-right"></i> Buka tautan</a>
                                    </div>
                                </div>

                                <div class="panel" style="padding:0;overflow:hidden">
                                    <button type="button" style="width:100%;border:0;background:transparent;padding:1rem 1.1rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem;cursor:pointer" @click="detail.showLengkap=!detail.showLengkap">
                                        <span style="font-weight:800;font-size:.9rem;display:inline-flex;align-items:center;gap:.45rem"><i class="bi bi-pencil-square" style="color:#6366f1"></i> Keterangan Dosen</span>
                                        <i class="bi" :class="detail.showLengkap ? 'bi-chevron-up' : 'bi-chevron-down'" style="color:#94a3b8"></i>
                                    </button>
                                    <div v-if="detail.showLengkap" style="padding:0 1.1rem 1.1rem;border-top:1px solid #f1f5f9">
                                        <div class="grid-form" style="margin-top:1rem">
                                            <div><label class="label">Dosen</label><input v-model="detail.dForm.dosen" class="input" list="dosenList"></div>
                                            <div><label class="label">Tanggal Pelaksanaan</label><input v-model="detail.dForm.tanggalPelaksanaan" type="datetime-local" class="input"></div>
                                            <div><label class="label">Biaya</label>
                                                <select v-model="detail.dForm.biaya" class="input">
                                                    <option value="">Default (Master Biaya)</option>
                                                    <option v-for="b in masterBiaya" :key="b.kegiatan" :value="String(b.biaya)">{{ b.kegiatan }} - {{ formatRupiah(b.biaya) }}</option>
                                                </select>
                                            </div>
                                            <div style="display:flex;align-items:center;gap:.5rem;grid-column:1/-1;margin-top:.3rem">
                                                <button class="btn btn-primary btn-sm" @click="saveFields()"><i class="bi bi-save"></i>Simpan Perubahan</button>
                                                <button class="btn btn-danger-soft btn-sm" @click="deletePengajuan()"><i class="bi bi-trash"></i>Hapus</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div v-if="detail.details && detail.details.length" style="margin-top:1rem">
                                    <div class="sec-title" style="margin-top:.4rem"><i class="bi bi-list-check"></i> Detail Kegiatan</div>
                                    <div v-for="(d, i) in detail.details" :key="d.id || i" class="detail-item">
                                        <div v-if="detail.editDetailIndex !== i">
                                            <div class="detail-item-head">
                                                <div style="min-width:0">
                                                    <div style="font-weight:700;font-size:.9rem;color:#0f172a">{{ d.pilihan || '—' }}<span v-if="d.detail" style="font-weight:500;color:#475569"> - {{ d.detail }}</span></div>
                                                    <div style="display:flex;flex-wrap:wrap;gap:1rem;margin-top:.4rem;font-size:.72rem;color:#94a3b8">
                                                        <span><i class="bi bi-tag"></i> {{ d.jenisKegiatan }}</span>
                                                        <span><i class="bi bi-calendar3"></i> {{ formatTanggal(d.tanggalPelaksanaan) }}</span>
                                                        <span v-if="d.bagian"><i class="bi bi-diagram-3"></i> {{ d.bagian }}</span>
                                                    </div>
                                                </div>
                                                <div class="detail-actions">
                                                    <button class="icon-btn" title="Edit" @click="startEditDetail(i)"><i class="bi bi-pencil-square"></i></button>
                                                    <button class="icon-btn danger" title="Hapus" @click="deleteDetailRow(d)"><i class="bi bi-trash"></i></button>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-else>
                                            <div class="grid-form">
                                                <div><label class="label">Jenis Kegiatan</label>
                                                    <select v-model="detail.dEdit.jenisKegiatan" class="input">
                                                        <option v-for="j in ['Ujian','SGD','KKD','Praktikum']" :value="j">{{ j }}</option>
                                                    </select>
                                                </div>
                                                <div><label class="label">Pilihan</label><input v-model="detail.dEdit.pilihan" class="input"></div>
                                                <div><label class="label">Detail</label><input v-model="detail.dEdit.detail" class="input"></div>
                                                <div><label class="label">Tanggal Pelaksanaan</label><input v-model="detail.dEdit.tanggalPelaksanaan" type="datetime-local" class="input"></div>
                                                <div style="display:flex;gap:.5rem;grid-column:1/-1">
                                                    <button class="btn btn-primary btn-sm" @click="saveDetailRow()"><i class="bi bi-save"></i>Simpan</button>
                                                    <button class="btn btn-soft btn-sm" @click="cancelEditDetail()">Batal</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="panel-white">
                                    <div style="font-weight:800;font-size:.9rem;margin-bottom:.8rem;display:inline-flex;align-items:center;gap:.45rem"><i class="bi bi-clock-history" style="color:#6366f1"></i> Riwayat Status</div>
                                    <div v-if="!detail.history.length" class="empty" style="padding:1rem"><p>Belum ada riwayat.</p></div>
                                    <div v-else style="display:flex;flex-direction:column;gap:.6rem">
                                        <div v-for="(h, i) in detail.history" :key="i" style="display:flex;gap:.7rem;align-items:flex-start">
                                            <span class="badge" :class="statusBadge(h.status)">{{ h.status }}</span>
                                            <div style="flex:1;min-width:0">
                                                <div style="font-size:.72rem;color:#94a3b8">{{ formatTanggalWaktu(h.timestamp) }} · {{ h.actorEmail || '—' }}</div>
                                                <div v-if="h.catatan" style="font-size:.8rem;color:#475569">{{ h.catatan }}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="panel-white">
                                    <div style="font-weight:800;font-size:.9rem;margin-bottom:.8rem;display:inline-flex;align-items:center;gap:.45rem"><i class="bi bi-check2-circle" style="color:#6366f1"></i> Perbarui Status Pengajuan</div>
                                    <div style="display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))">
                                        <div>
                                            <label class="label">Status</label>
                                            <select v-model="detail.status" class="input">
                                                <option>Menunggu</option>
                                                <option>Diterima</option>
                                                <option>Ditolak</option>
                                                <option>ACC</option>
                                                <option>Dibatalkan</option>
                                            </select>
                                        </div>
                                        <div style="grid-column:span 2 / -1;min-width:0">
                                            <label class="label">Catatan <span v-if="detail.status==='Ditolak'" class="req">(wajib)</span></label>
                                            <input v-model="detail.catatan" class="input" placeholder="Catatan keputusan...">
                                        </div>
                                    </div>
                                    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.8rem">
                                        <button class="btn btn-primary btn-sm" @click="updateStatus()"><i class="bi bi-check2-circle"></i>Perbarui Status</button>
                                        <button class="btn btn-success btn-sm" @click="quickStatus('Diterima')"><i class="bi bi-hand-thumbs-up"></i>Terima</button>
                                        <button class="btn btn-soft btn-sm" @click="quickStatus('ACC')"><i class="bi bi-patch-check"></i>ACC</button>
                                        <button class="btn btn-danger-soft btn-sm" @click="quickStatus('Ditolak')"><i class="bi bi-hand-thumbs-down"></i>Tolak</button>
                                    </div>
                                </div>

                                <datalist id="dosenList">
                                    <option v-for="d in dosenOptions" :value="d"></option>
                                </datalist>
                            </div>
                        </template>
                    </div>
                </transition>
            </div>
        </div>
    </transition>

    <transition name="fade">
        <div v-if="baUpload.open" class="modal-mask" @click.self="baUpload.open=false">
            <div class="modal" style="max-width:46rem">
                <div class="modal-head">
                    <div style="display:flex;align-items:center;gap:.8rem">
                        <div style="width:2.5rem;height:2.5rem;border-radius:.8rem;background:#eef2ff;color:#4f46e5;display:inline-flex;align-items:center;justify-content:center"><i class="bi bi-upload"></i></div>
                        <div>
                            <div class="modal-title">Upload Berita Acara</div>
                            <div class="modal-sub">Admin</div>
                        </div>
                    </div>
                    <button class="modal-close" @click="baUpload.open=false"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-form">
                        <div>
                            <label class="label">Blok</label>
                            <select v-model="baUpload.blok" class="input" :disabled="baUpload.loadingOpts" @change="onUploadBlokChange">
                                <option value="">(Pilih Blok)</option>
                                <option v-for="b in baUpload.opts.blok" :key="b" :value="b">{{ b }}</option>
                            </select>
                        </div>
                        <div style="grid-column:span 2 / -1;min-width:0">
                            <label class="label">Kegiatan</label>
                            <select v-model="baUpload.groupKey" class="input" :disabled="!baUpload.blok || baUpload.loadingOpts" @change="onUploadGroupChange">
                                <option value="">(Pilih Kegiatan)</option>
                                <option v-for="g in uploadGroupOptions" :key="g.key" :value="g.key">{{ g.label }} ({{ g.peserta.length }} mhs)</option>
                            </select>
                        </div>
                        <div>
                            <label class="label">Nama Kegiatan</label>
                            <input v-model="baUpload.form.nama" class="input" placeholder="cth: SGD 1 - Modul 2">
                        </div>
                        <div>
                            <label class="label">Bagian</label>
                            <select v-model="baUpload.form.bagian" class="input">
                                <option>Admin</option><option>SGD</option><option>KKD</option><option>Ujian</option><option>Praktikum</option>
                                <optgroup label="Lab Praktikum">
                                    <option v-for="l in baUpload.opts.labs" :key="l" :value="l">{{ l }}</option>
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label class="label">Tanggal Pelaksanaan</label>
                            <input v-model="baUpload.form.tanggal" type="date" class="input">
                        </div>
                        <div>
                            <label class="label">File BA (PDF / JPG / PNG)</label>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="input" @change="onUploadFile">
                        </div>
                    </div>

                    <div v-if="uploadSelectedGroup" class="panel-white" style="margin-top:1rem">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.4rem">
                            <span style="font-weight:800;font-size:.85rem"><i class="bi bi-people" style="color:#6366f1"></i> Peserta ({{ uploadSelectedCount }})</span>
                            <label style="font-size:.78rem;font-weight:700;color:#475569;display:inline-flex;align-items:center;gap:.35rem;cursor:pointer">
                                <input type="checkbox" style="accent-color:#4f46e5" :checked="uploadAllSelected" @change="uploadToggleAll"> Pilih semua
                            </label>
                        </div>
                        <div style="border:1px solid #e2e8f0;border-radius:.8rem;padding:.3rem 1rem;max-height:14rem;overflow-y:auto">
                            <label v-for="p in uploadSelectedGroup.peserta" :key="p.idPengajuan" class="check-item" style="cursor:pointer;border-bottom:1px dashed #f1f5f9">
                                <input type="checkbox" :checked="!!baUpload.selected[p.idPengajuan]" @change="uploadTogglePeserta(p.idPengajuan)">
                                <span class="check-name">{{ p.namaLengkap }} <span class="check-npm">{{ p.npm }}</span></span>
                                <span class="badge" :class="statusBadge(p.statusPengajuan)">{{ p.statusPengajuan }}</span>
                            </label>
                        </div>
                    </div>

                    <div class="field" style="margin-top:1rem">
                        <label class="label">Catatan</label>
                        <textarea v-model="baUpload.form.catatan" rows="2" class="input" placeholder="Catatan tambahan…"></textarea>
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn btn-soft" @click="baUpload.open=false">Batal</button>
                    <button class="btn btn-primary" :disabled="loading || uploadBlocked" @click="submitBaUpload()">
                        <span v-if="loading" class="spinner spinner-sm"></span>
                        <i v-else class="bi bi-upload"></i> Upload
                    </button>
                </div>
            </div>
        </div>
    </transition>

    <transition name="fade">
        <div v-if="toast.show" class="toast" :class="toastClass">
            <i :class="toast.icon"></i>{{ toast.message }}
        </div>
    </transition>
</div>

<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
<script>
    const { createApp } = Vue;
    const CSRF = (() => {
        const el = document.querySelector('meta[name="csrf"]');
        return el ? el.getAttribute('content') : '';
    })();

    function readJson(res) {
        return res.json().catch(() => ({ ok: false, message: 'Respons tidak valid.' }));
    }

    async function apiFetch(method, path, payload) {
        const opts = { method: method, credentials: 'same-origin', headers: {} };
        if (payload !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(payload);
        }
        let res;
        try {
            res = await fetch('/api/' + path, opts);
        } catch (e) {
            throw new Error('Tidak dapat terhubung ke server.');
        }
        const data = await readJson(res);
        if (!res.ok) {
            throw new Error((data && data.message) || 'Terjadi kesalahan server.');
        }
        return data;
    }

    createApp({
        data() {
            return {
                bootLoading: true,
                loading: false,
                loadingRows: false,
                loggedIn: false,
                sessionNama: '',
                role: 'admin',
                loginEmail: '',
                loginPwd: '',
                loginError: '',
                tab: 'pengajuan',
                stats: { total: 0, totalBiaya: 0, perStatus: {}, perJenis: {}, perBlok: {}, trend: {}, perBagian: {} },
                pengajuanRows: [],
                allRows: [],
                detailMap: {},
                masterBiaya: [],
                dosenOptions: [],
                baRows: [],
                baSummary: {},
                baLoading: false,
                expandedBa: {},
                baUpload: {
                    open: false, loadingOpts: false, blok: '', groupKey: '',
                    opts: { blok: [], labs: [], groups: [] },
                    form: { nama: '', bagian: 'Admin', tanggal: '', catatan: '', file: null, fileLabel: '' },
                    selected: {}
                },
                bab: { active: false, loading: false, kategori: '', subBagian: '', nama: '' },
                babLabOptions: [],
                babRows: [],
                babBaList: [],
                babSummary: {},
                filters: { search: '', jenis: '', blok: '', status: '' },
                detail: {
                    open: false, loading: false, showLengkap: false, p: null, details: [], history: [],
                    editInduk: false, iForm: { email: '', noHp: '', blok: '', jenisKegiatan: '', tanggalPelaksanaan: '' },
                    dForm: { dosen: '', tanggalPelaksanaan: '', biaya: '' },
                    status: 'Diterima', catatan: '',
                    editDetailIndex: -1, dEdit: { jenisKegiatan: '', pilihan: '', detail: '', tanggalPelaksanaan: '' }
                },
                toast: { show: false, type: 'success', message: '', icon: 'bi-check-circle-fill' },
                toastTimer: null
            };
        },
        computed: {
            pageTitle() {
                const t = {
                    'pengajuan': 'Telaah Pengajuan',
                    'stats': 'Statistik Pendaftaran',
                    'ba': 'Berita Acara Admin',
                    'bab': 'Berita Acara Bagian'
                };
                return t[this.tab] || 'Dashboard';
            },
            toastClass() {
                return { success: 'toast-success', error: 'toast-error', info: 'toast-info' }[this.toast.type] || 'toast-info';
            },
            statusChips() {
                const s = this.stats.perStatus || {};
                return [
                    { key: '', label: 'Semua', count: this.stats.total || 0 },
                    { key: 'Menunggu', label: 'Menunggu', count: s['Menunggu'] || 0 },
                    { key: 'Diterima', label: 'Diterima', count: s['Diterima'] || 0 },
                    { key: 'ACC', label: 'ACC', count: s['ACC'] || 0 },
                    { key: 'Ditolak', label: 'Ditolak', count: s['Ditolak'] || 0 },
                    { key: 'Dibatalkan', label: 'Dibatalkan', count: s['Dibatalkan'] || 0 }
                ];
            },
            blokOptions() {
                const seen = {};
                (this.allRows || []).forEach(r => { if (r.blok) seen[r.blok] = 1; });
                return Object.keys(seen);
            },
            filteredPengajuan() {
                const q = this.norm(String(this.filters.search || ''));
                return (this.pengajuanRows || []).filter(r => {
                    if (this.filters.status && r.status !== this.filters.status) return false;
                    if (this.filters.jenis && r.jenisKegiatan !== this.filters.jenis) return false;
                    if (this.filters.blok && r.blok !== this.filters.blok) return false;
                    if (q && this.norm(r.npm).indexOf(q) === -1 && this.norm(r.namaLengkap).indexOf(q) === -1) return false;
                    return true;
                });
            },
            statCards() {
                const s = this.stats.perStatus || {};
                return [
                    { label: 'Total Pendaftar', num: this.stats.total || 0, icon: 'bi-people-fill', color: '#4f46e5', tint: 'bg-brand-50' },
                    { label: 'Menunggu', num: s['Menunggu'] || 0, icon: 'bi-hourglass-split', color: '#d97706' },
                    { label: 'Diterima', num: s['Diterima'] || 0, icon: 'bi-check2-circle', color: '#059669' },
                    { label: 'ACC', num: s['ACC'] || 0, icon: 'bi-patch-check-fill', color: '#6366f1' },
                    { label: 'Ditolak', num: s['Ditolak'] || 0, icon: 'bi-x-circle', color: '#e11d48' },
                    { label: 'Dibatalkan', num: s['Dibatalkan'] || 0, icon: 'bi-x-octagon', color: '#64748b' },
                    { label: 'Total Biaya', num: this.formatRupiah(this.stats.totalBiaya), money: true, icon: 'bi-cash-stack', color: '#0d9488' }
                ];
            },
            statCharts() {
                return [
                    { title: 'Trend Pengajuan per Bulan', icon: 'bi-graph-up', grad: 'linear-gradient(90deg,#6366f1,#a78bfa)', bars: this.barsOf(this.stats.trend) },
                    { title: 'Per Jenis Kegiatan', icon: 'bi-tags', grad: 'linear-gradient(90deg,#0ea5e9,#38bdf8)', bars: this.barsOf(this.stats.perJenis) },
                    { title: 'Per Blok', icon: 'bi-layers', grad: 'linear-gradient(90deg,#f59e0b,#fbbf24)', bars: this.barsOf(this.stats.perBlok) },
                    { title: 'Per Bagian', icon: 'bi-diagram-3', grad: 'linear-gradient(90deg,#8b5cf6,#c084fc)', bars: this.barsOf(this.stats.perBagian) }
                ];
            },
            uploadGroupOptions() {
                return (this.baUpload.opts.groups || []).filter(g => g.blok === this.baUpload.blok && (g.nama || '').trim() !== '');
            },
            uploadSelectedGroup() {
                return (this.baUpload.opts.groups || []).find(g => g.key === this.baUpload.groupKey) || null;
            },
            uploadSelectedList() {
                const g = this.uploadSelectedGroup;
                return g ? (g.peserta || []).filter(p => !!this.baUpload.selected[p.idPengajuan]) : [];
            },
            uploadSelectedCount() {
                return this.uploadSelectedList.length;
            },
            uploadAllSelected() {
                const g = this.uploadSelectedGroup;
                return !!g && (g.peserta || []).length > 0 && (g.peserta || []).every(p => !!this.baUpload.selected[p.idPengajuan]);
            },
            uploadBlocked() {
                const f = this.baUpload.form;
                return !this.baUpload.blok || !this.baUpload.groupKey || !(f.nama || '').trim() || !f.tanggal || !f.file || this.uploadSelectedCount === 0;
            }
        },
        methods: {
            norm(v) {
                return String(v === null || v === undefined ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
            },
            showToast(message, type) {
                const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
                this.toast = { show: true, type: type || 'success', message, icon: icons[type || 'success'] };
                if (this.toastTimer) clearTimeout(this.toastTimer);
                this.toastTimer = setTimeout(() => { this.toast.show = false; }, 3600);
            },
            isHttp(v) {
                return /^https?:\/\//i.test(String(v || ''));
            },
            async boot() {
                this.bootLoading = true;
                try {
                    const res = await apiFetch('GET', 'dashboard/bootstrap');
                    this.applyBootstrap(res.data);
                    this.loggedIn = true;
                    this.loadBa();
                } catch (e) {
                    this.loggedIn = false;
                } finally {
                    this.bootLoading = false;
                }
            },
            applyBootstrap(b) {
                this.sessionNama = b.nama || 'Admin';
                this.stats = b.stats || this.stats;
                this.allRows = (b.pengajuan || []).map(r => Object.assign({}, r));
                this.pengajuanRows = this.allRows.slice();
                this.detailMap = b.detailMap || {};
                this.masterBiaya = b.masterBiaya || [];
                this.dosenOptions = b.dosen || [];
            },
            async setTab(name) {
                this.tab = name;
                if (name === 'ba') {
                    await this.loadBa();
                } else if (name === 'bab') {
                    if (this.bab.active) {
                        await this.babLoad();
                    } else {
                        await this.babProbe();
                    }
                }
            },
            async fetchBaAdminOptions(force) {
                if (!force && this.baUpload.opts.groups.length) return;
                this.baUpload.loadingOpts = true;
                try {
                    const res = await apiFetch('GET', 'admin/ba/options');
                    const d = res.data || {};
                    this.baUpload.opts = { blok: d.blok || [], labs: d.labs || [], groups: d.groups || [] };
                    this.babLabOptions = d.labs || [];
                } catch (e) {
                    this.showToast('Gagal memuat pilihan kegiatan: ' + e.message, 'error');
                } finally {
                    this.baUpload.loadingOpts = false;
                }
            },
            async loadBa() {
                if (this.baLoading) return;
                this.baLoading = true;
                try {
                    const res = await apiFetch('GET', 'admin/ba');
                    this.baRows = (res.data && res.data.list) || [];
                    this.baSummary = (res.data && res.data.summary) || {};
                } catch (e) {
                    this.showToast('Gagal memuat berita acara: ' + e.message, 'error');
                } finally {
                    this.baLoading = false;
                }
            },
            toggleBaExpand(baId) {
                this.expandedBa[baId] = !this.expandedBa[baId];
            },
            async deleteBa(b) {
                if (!confirm('Hapus berita acara "' + b.namaKegiatan + '" (Blok ' + b.blok + ', ' + b.tanggalPelaksanaan + ')? Peserta terkait ikut terhapus.')) return;
                this.loading = true;
                try {
                    const res = await apiFetch('DELETE', 'admin/ba/' + encodeURIComponent(b.baId));
                    this.showToast((res.data && res.data.message) || 'Berita acara berhasil dihapus.');
                    this.expandedBa[b.baId] = false;
                    await this.loadBa();
                } catch (e) {
                    this.showToast('Gagal menghapus: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                }
            },
            async openBaUpload() {
                this.baUpload.open = true;
                this.baUpload.blok = '';
                this.baUpload.groupKey = '';
                this.baUpload.form = { nama: '', bagian: 'Admin', tanggal: '', catatan: '', file: null, fileLabel: '' };
                this.baUpload.selected = {};
                await this.fetchBaAdminOptions();
            },
            onUploadBlokChange() {
                this.baUpload.groupKey = '';
                this.baUpload.selected = {};
                this.baUpload.form.nama = '';
            },
            onUploadGroupChange() {
                const g = this.uploadSelectedGroup;
                this.baUpload.selected = {};
                if (g) {
                    this.baUpload.form.nama = (g.nama || '').trim();
                    this.baUpload.form.tanggal = String(g.tanggal || '').slice(0, 10);
                    this.baUpload.form.bagian = (g.jenis || '').trim() !== '' ? (g.jenis || '').trim() : 'Admin';
                }
            },
            uploadTogglePeserta(id) {
                this.baUpload.selected[id] = !this.baUpload.selected[id];
            },
            uploadToggleAll() {
                const g = this.uploadSelectedGroup;
                if (!g) return;
                const target = !this.uploadAllSelected;
                (g.peserta || []).forEach(p => { this.baUpload.selected[p.idPengajuan] = target; });
            },
            onUploadFile(e) {
                const f = e.target.files && e.target.files.length ? e.target.files[0] : null;
                this.baUpload.form.file = f;
                this.baUpload.form.fileLabel = f ? f.name : '';
            },
            async submitBaUpload() {
                if (this.uploadBlocked || this.loading) return;
                this.loading = true;
                try {
                    const f = this.baUpload.form;
                    const peserta = this.uploadSelectedList.map(p => ({ idPengajuan: p.idPengajuan }));
                    const fd = new FormData();
                    fd.set('namaKegiatan', (f.nama || '').trim());
                    fd.set('blok', this.baUpload.blok);
                    fd.set('tanggalPelaksanaan', f.tanggal);
                    fd.set('bagian', (f.bagian || 'Admin').trim());
                    fd.set('catatan', (f.catatan || '').trim());
                    fd.set('peserta', JSON.stringify(peserta));
                    if (f.file) fd.set('file', f.file);
                    const res = await fetch('/api/admin/ba', { method: 'POST', body: fd });
                    const data = await readJson(res);
                    this.showToast((data && data.message) || (res.ok ? 'Berita acara berhasil diunggah.' : 'Upload gagal.'), res.ok ? 'success' : 'error');
                    if (res.ok && data.ok) {
                        this.baUpload.open = false;
                        await this.loadBa();
                    }
                } catch (e) {
                    this.showToast('Gagal mengunggah berita acara.', 'error');
                } finally {
                    this.loading = false;
                }
            },
            onBabKategoriChange() {
                if (this.bab.kategori !== 'Praktikum') {
                    this.bab.subBagian = '';
                } else {
                    this.loadBabLabs();
                }
            },
            async loadBabLabs() {
                if (!this.babLabOptions.length) {
                    await this.fetchBaAdminOptions();
                }
            },
            applyBagianBootstrap(b) {
                this.bab.nama = b.nama || '';
                this.bab.kategori = b.kategori || '';
                this.bab.subBagian = b.subBagian || '';
                this.babRows = b.rows || [];
                const ba = b.ba || {};
                this.babBaList = ba.list || [];
                this.babSummary = ba.summary || {};
            },
            async babProbe() {
                if (this.bab.loading) return;
                this.bab.loading = true;
                try {
                    const res = await apiFetch('GET', 'bagian/bootstrap');
                    this.applyBagianBootstrap(res.data);
                    this.bab.active = true;
                } catch (e) {
                    this.bab.active = false;
                } finally {
                    this.bab.loading = false;
                }
            },
            async babLoad() {
                if (this.bab.loading) return;
                this.bab.loading = true;
                try {
                    const res = await apiFetch('GET', 'bagian/bootstrap');
                    this.applyBagianBootstrap(res.data);
                } catch (e) {
                    this.showToast('Gagal memuat data bagian: ' + e.message, 'error');
                    this.bab.active = false;
                } finally {
                    this.bab.loading = false;
                }
            },
            async babStart() {
                const k = (this.bab.kategori || '').trim();
                if (!k) { this.showToast('Pilih kategori kegiatan.', 'error'); return; }
                if (k === 'Praktikum' && !(this.bab.subBagian || '').trim()) {
                    this.showToast('Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.', 'error');
                    return;
                }
                this.bab.loading = true;
                try {
                    const res = await apiFetch('POST', 'admin/ba-bagian/start', { kategori: k, subBagian: (this.bab.subBagian || '').trim() });
                    this.bab.active = true;
                    this.showToast((res.data && res.data.message) || 'Sesi bagian dimulai.');
                    await this.babLoad();
                } catch (e) {
                    this.showToast('Gagal memulai sesi: ' + e.message, 'error');
                } finally {
                    this.bab.loading = false;
                }
            },
            async babEnd() {
                if (!confirm('Akhiri sesi bagian ' + this.bab.kategori + (this.bab.subBagian ? ' / ' + this.bab.subBagian : '') + '?')) return;
                this.bab.loading = true;
                try {
                    const res = await apiFetch('POST', 'admin/ba-bagian/end');
                    this.showToast((res.data && res.data.message) || 'Sesi bagian diakhiri.');
                    this.bab.active = false;
                    this.bab.kategori = '';
                    this.bab.subBagian = '';
                    this.bab.nama = '';
                    this.babRows = [];
                    this.babBaList = [];
                    this.babSummary = {};
                } catch (e) {
                    this.showToast('Gagal mengakhiri sesi: ' + e.message, 'error');
                } finally {
                    this.bab.loading = false;
                }
            },
            async refresh() {
                if (this.loading) return;
                this.loading = true;
                this.loadingRows = true;
                try {
                    const res = await apiFetch('GET', 'dashboard/bootstrap');
                    this.applyBootstrap(res.data);
                    this.showToast('Data berhasil dimuat ulang.');
                } catch (e) {
                    this.showToast('Gagal memuat data: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                    this.loadingRows = false;
                }
            },
            async doLogin() {
                if (this.role === 'bagian' && !this.loginEmail.trim()) {
                    this.loginError = 'Masukkan email bagian.';
                    return;
                }
                if (!this.loginPwd) {
                    this.loginError = this.role === 'admin' ? 'Masukkan password admin.' : 'Masukkan password.';
                    return;
                }
                this.loginError = '';
                this.loading = true;
                try {
                    const fd = new URLSearchParams();
                    fd.set('role', this.role);
                    if (this.role === 'bagian') fd.set('email', this.loginEmail.trim());
                    fd.set('password', this.loginPwd);
                    const res = await fetch('/login', {
                        method: 'POST',
                        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': CSRF },
                        body: fd
                    });
                    const data = await readJson(res);
                    if (!res.ok || !data.ok) {
                        this.loginError = (data && data.message) || 'Login gagal. Coba lagi.';
                        return;
                    }
                    this.loginPwd = '';
                    this.loginEmail = '';
                    window.location.href = data.redirect || '/dashboard';
                } catch (e) {
                    this.loginError = 'Terjadi kesalahan jaringan. Coba lagi.';
                } finally {
                    this.loading = false;
                }
            },
            clearFilters() {
                this.filters = { search: '', jenis: '', blok: '', status: '' };
            },
            openDetail(row) {
                this.detail.p = Object.assign({}, row, { details: this.detailMap[row.idPengajuan] || [] });
                this.detail.open = true;
                this.detail.showLengkap = false;
                this.detail.editInduk = false;
                this.detail.editDetailIndex = -1;
                this.detail.loading = true;
                this.detail.history = [];
                this.reloadDetail(row.idPengajuan);
            },
            closeDetail() {
                this.detail.open = false;
                this.detail.p = null;
                this.detail.editDetailIndex = -1;
            },
            async reloadDetail(id) {
                try {
                    const res = await apiFetch('GET', 'pengajuan/' + encodeURIComponent(id));
                    const p = res.data.pengajuan;
                    this.detail.p = p;
                    this.detail.details = p.details || [];
                    this.detail.history = res.data.history || [];
                    this.detail.iForm = {
                        email: p.email || '',
                        noHp: p.noHp || '',
                        blok: p.blok || '',
                        jenisKegiatan: p.jenisKegiatan || '',
                        tanggalPelaksanaan: this.toDatetimeLocalInputValue(p.tanggalPelaksanaan)
                    };
                    this.detail.dForm = {
                        dosen: p.dosen || '',
                        tanggalPelaksanaan: this.toDatetimeLocalInputValue(p.tanggalPelaksanaan),
                        biaya: p.biayaOverride !== null && p.biayaOverride !== undefined ? String(p.biayaOverride) : ''
                    };
                    this.detail.status = p.status || 'Diterima';
                    this.detail.catatan = p.catatanAdmin || '';
                    this.detail.editInduk = false;
                    this.detail.editDetailIndex = -1;
                } catch (e) {
                    this.showToast('Gagal memuat detail: ' + e.message, 'error');
                } finally {
                    this.detail.loading = false;
                }
            },
            startEditInduk() {
                const p = this.detail.p;
                this.detail.iForm = {
                    email: p.email || '',
                    noHp: p.noHp || '',
                    blok: p.blok || '',
                    jenisKegiatan: p.jenisKegiatan || '',
                    tanggalPelaksanaan: this.toDatetimeLocalInputValue(p.tanggalPelaksanaan)
                };
                this.detail.editInduk = true;
            },
            async saveIndukFields() {
                const f = this.detail.iForm;
                this.loading = true;
                try {
                    await apiFetch('PUT', 'pengajuan/' + encodeURIComponent(this.detail.p.idPengajuan), {
                        email: (f.email || '').trim(),
                        noHp: (f.noHp || '').trim(),
                        blok: (f.blok || '').trim(),
                        jenisKegiatan: (f.jenisKegiatan || '').trim(),
                        tanggalPelaksanaan: f.tanggalPelaksanaan || ''
                    });
                    this.showToast('Data pengajuan diperbarui.');
                    this.detail.editInduk = false;
                    await this.reloadDetail(this.detail.p.idPengajuan);
                } catch (e) {
                    this.showToast('Gagal menyimpan: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                }
            },
            startEditDetail(i) {
                const d = this.detail.details[i];
                if (!d) return;
                this.detail.dEdit = {
                    jenisKegiatan: d.jenisKegiatan || '',
                    pilihan: d.pilihan || '',
                    detail: d.detail || '',
                    tanggalPelaksanaan: this.toDatetimeLocalInputValue(d.tanggalPelaksanaan)
                };
                this.detail.editDetailIndex = i;
            },
            cancelEditDetail() {
                this.detail.editDetailIndex = -1;
                this.detail.dEdit = { jenisKegiatan: '', pilihan: '', detail: '', tanggalPelaksanaan: '' };
            },
            async saveDetailRow() {
                const d = this.detail.details[this.detail.editDetailIndex];
                if (!d || !d.id) return;
                const f = this.detail.dEdit;
                this.loading = true;
                try {
                    await apiFetch('PUT', 'pengajuan/' + encodeURIComponent(this.detail.p.idPengajuan) + '/detail/' + d.id, {
                        jenisKegiatan: (f.jenisKegiatan || '').trim(),
                        pilihan: (f.pilihan || '').trim(),
                        detail: (f.detail || '').trim(),
                        tanggalPelaksanaan: f.tanggalPelaksanaan || ''
                    });
                    this.showToast('Detail kegiatan diperbarui.');
                    this.cancelEditDetail();
                    await this.reloadDetail(this.detail.p.idPengajuan);
                } catch (e) {
                    this.showToast('Gagal menyimpan: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                }
            },
            async deleteDetailRow(d) {
                if (!confirm('Hapus detail kegiatan ini dari pengajuan ' + this.detail.p.idPengajuan + '?')) return;
                this.loading = true;
                try {
                    await apiFetch('DELETE', 'pengajuan/' + encodeURIComponent(this.detail.p.idPengajuan) + '/detail/' + d.id);
                    this.showToast('Detail kegiatan dihapus.');
                    this.cancelEditDetail();
                    await this.reloadDetail(this.detail.p.idPengajuan);
                } catch (e) {
                    this.showToast('Gagal menghapus: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                }
            },
            async saveFields() {
                const d = this.detail.dForm;
                this.loading = true;
                try {
                    await apiFetch('PUT', 'pengajuan/' + encodeURIComponent(this.detail.p.idPengajuan), {
                        dosen: (d.dosen || '').trim(),
                        tanggalPelaksanaan: d.tanggalPelaksanaan || ''
                    });
                    await apiFetch('PUT', 'pengajuan/' + encodeURIComponent(this.detail.p.idPengajuan) + '/biaya', {
                        biaya: (d.biaya || '').trim()
                    });
                    this.showToast('Perubahan disimpan.');
                    this.detail.open = false;
                    await this.reloadAll();
                } catch (e) {
                    this.showToast('Gagal menyimpan: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                }
            },
            async updateStatus() {
                const status = this.detail.status;
                const catatan = (this.detail.catatan || '').trim();
                if (status === 'Ditolak' && !catatan) {
                    this.showToast('Catatan wajib diisi saat menolak pengajuan.', 'error');
                    return;
                }
                this.loading = true;
                try {
                    await apiFetch('PUT', 'pengajuan/' + encodeURIComponent(this.detail.p.idPengajuan) + '/status', {
                        status: status,
                        catatan: catatan
                    });
                    this.showToast('Status diperbarui menjadi ' + status + '.');
                    this.detail.open = false;
                    await this.reloadAll();
                } catch (e) {
                    this.showToast('Gagal memperbarui status: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                }
            },
            async quickStatus(status) {
                if (status === 'Ditolak') {
                    const alasan = prompt('Alasan penolakan (wajib):');
                    if (!alasan || !alasan.trim()) {
                        this.showToast('Catatan wajib diisi saat menolak pengajuan.', 'error');
                        return;
                    }
                    this.detail.status = status;
                    this.detail.catatan = alasan.trim();
                } else {
                    this.detail.status = status;
                    this.detail.catatan = '';
                }
                await this.updateStatus();
            },
            async deletePengajuan() {
                if (!confirm('HAPUS pengajuan ' + this.detail.p.idPengajuan + ' beserta detail, riwayat, dan data terkait? Tindakan ini tidak dapat dibatalkan.')) return;
                const alasan = prompt('Alasan penghapusan (opsional):');
                if (alasan === null) return;
                this.loading = true;
                try {
                    await apiFetch('DELETE', 'pengajuan/' + encodeURIComponent(this.detail.p.idPengajuan), { alasan: alasan });
                    this.showToast('Pengajuan beserta data terkait berhasil dihapus.');
                    this.detail.open = false;
                    await this.reloadAll();
                } catch (e) {
                    this.showToast('Gagal menghapus: ' + e.message, 'error');
                } finally {
                    this.loading = false;
                }
            },
            async reloadAll() {
                try {
                    const res = await apiFetch('GET', 'dashboard/bootstrap');
                    this.applyBootstrap(res.data);
                } catch (e) {
                    this.showToast('Gagal memuat ulang data: ' + e.message, 'error');
                }
            },
            exportCsv() {
                const rows = this.filteredPengajuan;
                if (!rows.length) { this.showToast('Tidak ada data untuk diekspor.', 'error'); return; }
                const cols = [
                    ['timestamp', 'Timestamp'], ['idPengajuan', 'ID Pengajuan'], ['npm', 'NPM'],
                    ['namaLengkap', 'Nama Lengkap'], ['email', 'Email'], ['noHp', 'No. HP/WA'],
                    ['blok', 'Blok'], ['jenisKegiatan', 'Jenis Kegiatan'], ['dosen', 'Dosen'],
                    ['tanggalPelaksanaan', 'Tanggal Pelaksanaan'], ['nomorSurat', 'Nomor Surat'],
                    ['status', 'Status'], ['biaya', 'Biaya'], ['catatanAdmin', 'Catatan Admin']
                ];
                const cell = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
                let csv = cols.map(c => cell(c[1])).join(',') + '\n';
                rows.forEach(r => { csv += cols.map(c => cell(r[c[0]])).join(',') + '\n'; });
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'rekap-inhal.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                this.showToast('Rekap CSV berhasil diunduh.');
            },
            formatRupiah(num) {
                const n = Number(num) || 0;
                return 'Rp ' + n.toLocaleString('id-ID');
            },
            formatTanggal(v) {
                if (!v) return '—';
                const s = String(v);
                const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (m) return m[3] + '/' + m[2] + '/' + m[1];
                const d = new Date(v);
                if (!isNaN(d.getTime())) return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
                return s;
            },
            formatTanggalWaktu(v) {
                if (!v) return '—';
                const s = String(v);
                const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
                if (m) {
                    const datePart = m[3] + '/' + m[2] + '/' + m[1];
                    const timePart = (m[4] !== undefined && m[5] !== undefined) ? (' ' + m[4] + ':' + m[5]) : '';
                    return datePart + timePart;
                }
                const d = new Date(v);
                if (!isNaN(d.getTime())) {
                    const p = n => (n < 10 ? '0' : '') + n;
                    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
                }
                return s;
            },
            toDatetimeLocalInputValue(v) {
                if (!v) return '';
                const s = String(v);
                const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
                if (m) return m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] || '00') + ':' + (m[5] || '00');
                return s;
            },
            statusBadge(status) {
                return {
                    'Menunggu': 'st-menunggu',
                    'Diterima': 'st-diterima',
                    'ACC': 'st-acc',
                    'Ditolak': 'st-ditolak',
                    'Dibatalkan': 'st-dibatalkan'
                }[status] || 'st-dibatalkan';
            },
            barsOf(obj) {
                const o = obj || {};
                const keys = Object.keys(o);
                if (!keys.length) return [];
                const max = Math.max.apply(null, keys.map(k => o[k]));
                return keys.map(k => ({ label: k, value: o[k], pct: max ? Math.round(o[k] / max * 100) : 0 }));
            }
        },
        mounted() {
            this.boot();
        }
    }).mount('#app');
</script>
</body>
</html>
