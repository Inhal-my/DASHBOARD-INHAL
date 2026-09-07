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
        .topnav{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.88);border-bottom:1px solid #eef1f6;backdrop-filter:blur(8px)}
        .topnav-inner{max-width:80rem;margin:0 auto;height:4rem;padding:0 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
        .topnav-brand{display:flex;align-items:center;gap:.7rem;text-decoration:none;color:inherit}
        .topnav-badge{display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:.8rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.35);font-size:1.1rem}
        .topnav-name{display:flex;flex-direction:column}
        .topnav-name b{font-size:.95rem;font-weight:800;letter-spacing:-.01em;line-height:1.2}
        .topnav-name span{font-size:.68rem;color:#94a3b8;line-height:1.2}
        .topnav-links{display:flex;align-items:center;gap:.4rem}
        .navlink{display:inline-flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:700;color:#475569;text-decoration:none;padding:.5rem .8rem;border-radius:.7rem}
        .navlink:hover{background:#f1f5f9;color:#0f172a}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border:0;border-radius:.8rem;font-size:.84rem;font-weight:700;padding:.6rem 1rem;cursor:pointer;transition:.15s ease}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#7c5cf0);color:#fff;box-shadow:0 6px 18px rgba(99,102,241,.28)}
        .btn-primary:hover{filter:brightness(1.05)}
        .btn-soft{background:#fff;color:#475569;border:1px solid #e2e8f0}
        .btn-soft:hover{background:#f8fafc;color:#0f172a}
        .btn-sm{padding:.42rem .75rem;font-size:.78rem;border-radius:.65rem}
        .btn-block{width:100%}
        .container{max-width:80rem;margin:0 auto;padding:1.5rem 1.25rem 4rem}
        .page-head{display:flex;align-items:center;gap:.9rem;margin-bottom:1.25rem;flex-wrap:wrap}
        .page-head-icon{display:inline-flex;align-items:center;justify-content:center;width:2.9rem;height:2.9rem;border-radius:1rem;background:#eef2ff;color:#4f46e5;font-size:1.3rem}
        .page-head h1{margin:0;font-size:1.3rem;font-weight:800;letter-spacing:-.01em}
        .page-head p{margin:.15rem 0 0;font-size:.8rem;color:#64748b}
        .page-head-actions{margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap}
        .card{background:#fff;border-radius:1.15rem;box-shadow:0 1px 3px rgba(15,23,42,.06);margin-bottom:1.25rem;overflow:hidden}
        .card-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1.05rem 1.25rem;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
        .card-title{display:flex;align-items:center;gap:.6rem;font-size:.98rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .card-title i{color:#6366f1}
        .card-sub{font-size:.76rem;color:#94a3b8;font-weight:500;margin-top:.15rem}
        .card-body{padding:1.25rem}
        .tabs{display:flex;gap:.35rem;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:.35rem;margin-bottom:1.25rem;width:max-content;max-width:100%;overflow-x:auto}
        .tab{border:0;background:transparent;display:inline-flex;align-items:center;gap:.5rem;font-size:.85rem;font-weight:700;color:#64748b;padding:.55rem 1rem;border-radius:.7rem;cursor:pointer;white-space:nowrap;transition:.15s ease}
        .tab:hover{background:#f1f5f9;color:#334155}
        .tab.is-active{background:#eef2ff;color:#4f46e5}
        .auth-card{max-width:26rem;margin:6vh auto 0;background:#fff;border-radius:1.25rem;box-shadow:0 20px 60px rgba(15,23,42,.12);padding:2rem 1.75rem}
        .auth-logo{width:3rem;height:3rem;border-radius:1rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 1rem;box-shadow:0 10px 26px rgba(99,102,241,.4)}
        .auth-title{text-align:center;font-size:1.15rem;font-weight:800;letter-spacing:-.01em;margin:0 0 .25rem}
        .auth-desc{text-align:center;font-size:.8rem;color:#64748b;margin:0 0 1.25rem}
        .field{margin-bottom:.9rem}
        .field label{display:flex;align-items:center;gap:.4rem;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.35rem}
        .auth-error{display:flex;align-items:center;gap:.5rem;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:.8rem;font-weight:600;border-radius:.8rem;padding:.6rem .8rem;margin-bottom:.9rem}
        .loading-pane{display:flex;flex-direction:column;align-items:center;gap:.6rem;padding:3.5rem 1rem;color:#64748b}
        .spinner{width:1.4rem;height:1.4rem;border:3px solid #e0e7ff;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        .spinner-sm{width:1rem;height:1rem;border-width:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .empty{text-align:center;padding:2.5rem 1rem;color:#94a3b8}
        .empty i{font-size:2.2rem;display:block;margin-bottom:.6rem;opacity:.6}
        .empty p{margin:0;font-size:.88rem;font-weight:600}
        .label{display:block;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-bottom:.3rem}
        .value{font-size:.9rem;color:#334155;word-break:break-word}
        .input{width:100%;border:1px solid #e2e8f0;border-radius:.8rem;padding:.62rem .9rem;font-size:.88rem;color:#0f172a;background:#fff;transition:.15s ease}
        .input:focus{outline:none;border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
        .filter-grid{display:grid;gap:.8rem 1rem;grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))}
        .filter-grid .wide{grid-column:span 2}
        .chips{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.9rem}
        .chip{border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:.76rem;font-weight:700;padding:.35rem .8rem;border-radius:999px;display:inline-flex;align-items:center;gap:.3rem}
        .table-scroll{overflow-x:auto}
        table.mtx{width:100%;border-collapse:collapse;font-size:.84rem}
        table.mtx th{background:#f8fafc;color:#64748b;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;font-weight:800;padding:.7rem .8rem;white-space:nowrap;text-align:left}
        table.mtx td{padding:.55rem .8rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155}
        table.mtx tr.total td{background:#f8fafc;font-weight:800;color:#0f172a}
        table.mtx tr.subtotal td{background:#f1f5f9;font-weight:700;color:#475569}
        table.mtx tr.row-main{cursor:pointer;transition:background .12s ease}
        table.mtx tr.row-main:hover{background:#f8fafc}
        table.mtx td.num,table.mtx th.num{text-align:right;font-variant-numeric:tabular-nums}
        table.mtx td.ctr,table.mtx th.ctr{text-align:center}
        table.mtx td.left-sticky,table.mtx th.left-sticky{position:sticky;left:0;z-index:2}
        .badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;font-weight:800;padding:.26rem .6rem;border-radius:999px;white-space:nowrap}
        .b-ba{background:#eef2ff;color:#4f46e5}
        .b-bba{background:#fffbeb;color:#b45309}
        .b-teal{background:#f0fdfa;color:#0f766e}
        .st-menunggu{background:#fffbeb;color:#b45309}
        .st-diterima{background:#ecfdf5;color:#047857}
        .st-acc{background:#eef2ff;color:#4f46e5}
        .st-ditolak{background:#fef2f2;color:#b91c1c}
        .st-dibatalkan{background:#f1f5f9;color:#475569}
        .link{font-weight:600;color:#4f46e5;text-decoration:none;word-break:break-all}
        .link:hover{text-decoration:underline}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76rem}
        .cell-btn{border:0;display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:.55rem;font-size:.86rem;font-weight:700;cursor:pointer;background:#eef2ff;color:#4338ca;transition:.12s ease}
        .cell-btn:hover{background:#e0e7ff}
        .cell-btn:disabled{background:transparent;color:#e2e8f0;cursor:default}
        .cell-btn.is-active{background:#4f46e5;color:#fff;box-shadow:0 4px 12px rgba(79,70,229,.35)}
        .avatar{display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:.6rem;background:linear-gradient(135deg,#818cf8,#8b5cf6);color:#fff;flex:none}
        .mono-chip{font-family:ui-monospace,monospace;font-size:.72rem;color:#94a3b8}
        .toast{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:.6rem;max-width:92vw;color:#fff;font-size:.85rem;font-weight:600;padding:.8rem 1.15rem;border-radius:.9rem;box-shadow:0 14px 40px rgba(15,23,42,.35);animation:rise .25s ease}
        .toast-success{background:#065f46}
        .toast-error{background:#991b1b}
        .toast-info{background:#0f172a}
        @keyframes rise{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        .fade-enter-active,.fade-leave-active{transition:opacity .18s ease}
        .fade-enter-from,.fade-leave-to{opacity:0}
        .loading-block{height:4rem;border-radius:.8rem;background:linear-gradient(90deg,#f1f5f9,#eef2ff,#f1f5f9);background-size:200% 100%;animation:shimmer 1.2s infinite;margin-bottom:.7rem}
        @keyframes shimmer{to{background-position:-200% 0}}
        @media(max-width:640px){.filter-grid .wide{grid-column:span 1}.filter-grid{grid-template-columns:1fr 1fr}}
    </style>
</head>
<body>
<div id="app" v-cloak>
    <nav class="topnav">
        <div class="topnav-inner">
            <a href="/dashboard" class="topnav-brand">
                <span class="topnav-badge"><i class="bi bi-file-earmark-bar-graph"></i></span>
                <span class="topnav-name"><b>Laporan INHAL</b><span>Admin laporan &amp; rekap biaya</span></span>
            </a>
            <div v-if="loggedIn" class="topnav-links">
                <span class="navlink" style="color:#94a3b8;cursor:default"><i class="bi bi-person-circle"></i>{{ sessionNama }}</span>
                <a class="navlink" href="/dashboard"><i class="bi bi-speedometer2"></i>Dashboard</a>
                <a class="navlink" href="/logout"><i class="bi bi-box-arrow-right"></i>Keluar</a>
            </div>
        </div>
    </nav>

    <div class="container">
        <template v-if="bootLoading">
            <div class="card"><div class="loading-pane"><div class="spinner"></div><span>Memeriksa sesi admin…</span></div></div>
        </template>

        <template v-else-if="!loggedIn">
            <div class="auth-card">
                <div class="auth-logo"><i class="bi bi-shield-lock"></i></div>
                <h2 class="auth-title">Masuk Laporan</h2>
                <p class="auth-desc">Halaman laporan khusus admin</p>
                <div v-if="loginError" class="auth-error"><i class="bi bi-exclamation-triangle-fill"></i>{{ loginError }}</div>
                <form @submit.prevent="doLogin">
                    <div class="field">
                        <label><i class="bi bi-shield-lock"></i> Password admin</label>
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
                <div class="page-head-icon"><i class="bi bi-file-earmark-bar-graph"></i></div>
                <div>
                    <h1>Laporan INHAL</h1>
                    <p>Matriks kelengkapan berita acara &amp; rekap biaya per bagian dan dosen</p>
                </div>
                <div class="page-head-actions">
                    <button class="btn btn-soft" @click="refresh()" :disabled="loading">
                        <span v-if="loading" class="spinner spinner-sm"></span>
                        <i v-else class="bi bi-arrow-clockwise"></i> Muat Ulang
                    </button>
                </div>
            </div>

            <div class="tabs">
                <button class="tab" :class="{'is-active': activeTab==='bagian'}" @click="activeTab='bagian'"><i class="bi bi-diagram-3"></i>Laporan Bagian</button>
                <button class="tab" :class="{'is-active': activeTab==='dosen'}" @click="activeTab='dosen'"><i class="bi bi-person-video3"></i>Laporan Dosen</button>
            </div>

            <div v-if="loading" class="card"><div class="card-body"><div class="loading-block"></div><div class="loading-block"></div><div class="loading-block"></div><div class="loading-block"></div></div></div>

            <template v-else>
                <!-- ============ TAB LAPORAN BAGIAN ============ -->
                <section v-if="activeTab==='bagian'" class="space-y-4">
                    <div class="card">
                        <div class="card-body">
                            <div class="filter-grid">
                                <div>
                                    <label class="label">Bagian</label>
                                    <select v-model="bagianFilter.bagian" class="input">
                                        <option value="">Semua Bagian</option>
                                        <option v-for="o in bagianOptions" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="label">Blok</label>
                                    <select v-model="bagianFilter.blok" class="input">
                                        <option value="">Semua Blok</option>
                                        <option v-for="o in bagianBlokOptions" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div class="wide">
                                    <label class="label">Cari</label>
                                    <input v-model="bagianFilter.q" class="input" placeholder="Kegiatan, NPM, atau nama mahasiswa...">
                                </div>
                                <div style="display:flex;align-items:flex-end">
                                    <button v-if="activeMatrixCell" class="btn btn-soft btn-block" @click="resetMatrixCell"><i class="bi bi-arrow-counterclockwise"></i> Reset</button>
                                </div>
                            </div>
                            <div class="chips">
                                <span class="chip"><i class="bi bi-diagram-3"></i>{{ bagianAllLabels.length }} bagian</span>
                                <span class="chip"><i class="bi bi-layers"></i>{{ bagianMatrixRows.length }} blok</span>
                                <span class="chip"><i class="bi bi-list-check"></i>{{ bagianDetailRows.length }} kegiatan</span>
                                <span class="chip"><i class="bi bi-people"></i>{{ bagianDetailPesertaTotal }} mahasiswa</span>
                            </div>
                        </div>
                    </div>

                    <div class="card" id="bagian-detail">
                        <div class="card-head">
                            <div>
                                <div class="card-title"><i class="bi bi-list-check"></i> Detail Kegiatan per Bagian &amp; Blok</div>
                                <div class="card-sub">Klik baris untuk melihat daftar peserta &amp; bukti bayar</div>
                            </div>
                            <button class="btn btn-soft btn-sm" :disabled="exporting" @click="exportExcel()"><i class="bi bi-file-earmark-excel"></i>{{ exporting ? 'Menyiapkan...' : 'Export .xlsx' }}</button>
                        </div>
                        <div class="table-scroll">
                            <table class="mtx">
                                <thead>
                                    <tr>
                                        <th style="width:2rem"></th>
                                        <th>Bagian</th>
                                        <th>Blok</th>
                                        <th>Kegiatan</th>
                                        <th>Tanggal</th>
                                        <th class="num">Biaya</th>
                                        <th class="ctr">Peserta</th>
                                        <th class="ctr">Bukti Bayar</th>
                                        <th>BA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template v-for="s in bagianDetailSections" :key="s.type === 'row' ? s.row.uid : ('sub-' + normBagian(s.bagian))">
                                        <tr v-if="s.type==='subtotal'" class="subtotal">
                                            <td></td>
                                            <td colspan="3" class="num" style="text-align:right;text-transform:uppercase;font-size:.72rem;letter-spacing:.04em">Subtotal {{ s.bagian }}</td>
                                            <td></td>
                                            <td class="num" style="color:#0f766e">{{ fmtRupiah(s.biaya) }}</td>
                                            <td class="ctr">{{ s.pesertaCount }}</td>
                                            <td colspan="2"></td>
                                        </tr>
                                        <template v-else>
                                            <tr class="row-main" @click="toggleExpand(s.row.uid)">
                                                <td style="color:#94a3b8"><i :class="expanded[s.row.uid] ? 'bi-chevron-up' : 'bi-chevron-down'"></i></td>
                                                <td style="font-weight:700">{{ s.row.bagian }}</td>
                                                <td>{{ s.row.blok }}</td>
                                                <td>
                                                    <div style="display:flex;align-items:center;gap:.5rem">
                                                        <span :class="s.row.sumber === 'BA' ? 'badge b-ba' : 'badge b-bba'">{{ s.row.sumber === 'BA' ? 'BA' : 'Belum ada BA' }}</span>
                                                        <span style="font-weight:600">{{ s.row.nama }}</span>
                                                    </div>
                                                </td>
                                                <td style="white-space:nowrap">{{ s.row.tanggal ? fmtTanggalWaktu(s.row.tanggal) : '-' }}</td>
                                                <td class="num" style="font-weight:600">{{ fmtRupiah(s.row.biaya || 0) }}</td>
                                                <td class="ctr" style="font-weight:600">{{ s.row.jumlahPeserta }}</td>
                                                <td class="ctr">
                                                    <span v-if="s.row.peserta.length"
                                                          :class="s.row.countBukti === s.row.peserta.length ? 'badge b-teal' : (s.row.countBukti ? 'badge b-bba' : 'badge b-bba')"
                                                          style="background:#f1f5f9;color:#64748b">{{ s.row.countBukti }}/{{ s.row.peserta.length }}</span>
                                                    <span v-else style="color:#cbd5e1">-</span>
                                                </td>
                                                <td>
                                                    <a v-if="s.row.fileUrl" :href="s.row.fileUrl" target="_blank" class="link" style="font-size:.78rem" @click.stop><i class="bi bi-file-earmark-pdf"></i> Lihat</a>
                                                    <span v-else style="color:#cbd5e1">-</span>
                                                </td>
                                            </tr>
                                            <tr v-if="expanded[s.row.uid]">
                                                <td colspan="9" style="background:#f8fafc;padding:.9rem 1.5rem">
                                                    <div v-if="s.row.peserta.length" style="display:flex;flex-direction:column;gap:.35rem">
                                                        <div v-for="(p, i) in s.row.peserta" :key="i" style="display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;background:#fff;border:1px solid #f1f5f9;border-radius:.6rem;padding:.45rem .75rem;font-size:.8rem">
                                                            <span class="mono" style="font-weight:700;color:#475569">{{ p.npm || '-' }}</span>
                                                            <span style="font-weight:600">{{ p.namaLengkap || '-' }}</span>
                                                            <span v-if="p.status" :class="'badge ' + statusBadgeCls(p.status)" style="margin-left:auto">{{ p.status }}</span>
                                                            <span v-if="biayaForNpm(p.npm, s.row.blok)" style="white-space:nowrap;font-weight:700;color:#0f766e">{{ fmtRupiah(biayaForNpm(p.npm, s.row.blok)) }}</span>
                                                            <a v-if="p.linkBukti" :href="p.linkBukti" target="_blank" class="link" style="white-space:nowrap"><i class="bi bi-cash-coin"></i> Bukti Bayar</a>
                                                            <span v-else style="color:#cbd5e1">-</span>
                                                        </div>
                                                    </div>
                                                    <div v-else class="empty" style="padding:1rem"><p>Tidak ada daftar peserta.</p></div>
                                                </td>
                                            </tr>
                                        </template>
                                    </template>
                                    <tr v-if="bagianDetailRows.length" class="total">
                                        <td></td>
                                        <td colspan="3" style="text-transform:uppercase;font-size:.76rem;letter-spacing:.05em">Grand Total</td>
                                        <td></td>
                                        <td class="num" style="color:#0f766e">{{ fmtRupiah(bagianDetailGrandTotal) }}</td>
                                        <td class="ctr">{{ bagianDetailPesertaTotal }}</td>
                                        <td colspan="2"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-if="!bagianDetailRows.length" class="empty">
                            <i class="bi bi-table"></i>
                            <p>Tidak ada data kegiatan untuk filter ini.</p>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-head">
                            <div>
                                <div class="card-title"><i class="bi bi-grid-3x3-gap"></i> Rekap Jumlah Kegiatan per Bagian &amp; Blok</div>
                                <div class="card-sub">Klik angka pada sel untuk memfilter detail kegiatan &amp; pesertanya</div>
                            </div>
                        </div>
                        <div class="table-scroll">
                            <table class="mtx">
                                <thead>
                                    <tr>
                                        <th class="left-sticky" style="background:#f8fafc">Blok</th>
                                        <th v-for="b in bagianAllLabels" :key="b" class="ctr">{{ b }}</th>
                                        <th class="ctr">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, ri) in bagianMatrixRows" :key="row.key" :style="ri % 2 ? 'background:#f8fafc' : ''">
                                        <td class="left-sticky" :style="(ri % 2 ? 'background:#f8fafc' : 'background:#fff') + ';font-weight:700'">{{ row.label }}</td>
                                        <td v-for="b in bagianAllLabels" :key="b" class="ctr">
                                            <button
                                                :disabled="!row.counts[bagianKey(b)]"
                                                :class="['cell-btn', activeMatrixCell && activeMatrixCell.key === matrixCellKey(row.label, b) ? 'is-active' : '']"
                                                @click="filterByMatrixCell(b, row.label)">
                                                {{ row.counts[bagianKey(b)] || '0' }}
                                            </button>
                                        </td>
                                        <td class="ctr" style="font-weight:800">{{ row.total }}</td>
                                    </tr>
                                    <tr class="total">
                                        <td class="left-sticky" style="background:#f8fafc">Total</td>
                                        <td v-for="b in bagianAllLabels" :key="b" class="ctr">{{ matrixColTotal(b) }}</td>
                                        <td class="ctr">{{ matrixGrandTotal }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- ============ TAB LAPORAN DOSEN ============ -->
                <section v-else>
                    <div class="card">
                        <div class="card-body">
                            <div class="filter-grid">
                                <div>
                                    <label class="label">Blok</label>
                                    <select v-model="dosenFilter.blok" class="input">
                                        <option value="">Semua Blok</option>
                                        <option v-for="o in blok" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="label">Jenis Kegiatan</label>
                                    <select v-model="dosenFilter.jenis" class="input">
                                        <option value="">Semua Jenis</option>
                                        <option v-for="o in jenisOptions" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="label">Bagian</label>
                                    <select v-model="dosenFilter.bagian" class="input">
                                        <option value="">Semua Bagian</option>
                                        <option v-for="o in bagianOptions" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="label">Cari Dosen</label>
                                    <input v-model="dosenFilter.q" class="input" placeholder="Ketik nama dosen...">
                                </div>
                                <div>
                                    <label class="label">Dari Tanggal</label>
                                    <input v-model="dosenFilter.from" type="date" class="input">
                                </div>
                                <div>
                                    <label class="label">Sampai Tanggal</label>
                                    <input v-model="dosenFilter.to" type="date" class="input">
                                </div>
                                <div style="display:flex;align-items:flex-end">
                                    <button v-if="activeDosenCell" class="btn btn-soft btn-block" @click="resetDosenCell"><i class="bi bi-arrow-counterclockwise"></i> Reset</button>
                                </div>
                            </div>
                            <div class="chips">
                                <span class="chip"><i class="bi bi-person-video3"></i>{{ dosenMatrix.rows.length }} dosen</span>
                                <span class="chip"><i class="bi bi-diagram-3"></i>{{ dosenMatrix.cols.length }} bagian</span>
                                <span class="chip"><i class="bi bi-file-earmark-text"></i>{{ dosenMatrix.grandTotal }} BA total</span>
                            </div>
                        </div>
                    </div>

                    <div class="card" id="dosen-matrix">
                        <div class="card-head">
                            <div>
                                <div class="card-title"><i class="bi bi-person-video3"></i> Rekap Berita Acara per Dosen &amp; Bagian</div>
                                <div class="card-sub">Klik angka pada sel untuk melihat daftar BA-nya</div>
                            </div>
                            <button class="btn btn-soft btn-sm" :disabled="exporting" @click="exportDosenMatrix"><i class="bi bi-file-earmark-excel"></i>{{ exporting ? 'Menyiapkan...' : 'Export XLSX' }}</button>
                        </div>
                        <div class="table-scroll">
                            <table class="mtx">
                                <thead>
                                    <tr>
                                        <th class="left-sticky" style="background:#f8fafc">Dosen</th>
                                        <th v-for="b in dosenMatrix.cols" :key="b" class="ctr">{{ b }}</th>
                                        <th class="ctr">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, ri) in dosenMatrix.rows" :key="row.key" :style="ri % 2 ? 'background:#f8fafc' : ''">
                                        <td class="left-sticky" :style="(ri % 2 ? 'background:#f8fafc' : 'background:#fff')">
                                            <div style="display:flex;align-items:center;gap:.6rem">
                                                <span class="avatar"><i class="bi bi-person-video3"></i></span>
                                                <span style="font-weight:700">{{ row.label }}</span>
                                            </div>
                                        </td>
                                        <td v-for="b in dosenMatrix.cols" :key="b" class="ctr">
                                            <button
                                                :disabled="!row.counts[bagianKey(b)]"
                                                :class="['cell-btn', activeDosenCell && activeDosenCell.key === dosenCellKey(row.label, b) ? 'is-active' : '']"
                                                @click="openDosenCell(row.label, b)">
                                                {{ row.counts[bagianKey(b)] || '0' }}
                                            </button>
                                        </td>
                                        <td class="ctr" style="font-weight:800">{{ row.total }}</td>
                                    </tr>
                                    <tr class="total">
                                        <td class="left-sticky" style="background:#f8fafc">Total</td>
                                        <td v-for="b in dosenMatrix.cols" :key="b" class="ctr">{{ dosenColTotal(b) }}</td>
                                        <td class="ctr">{{ dosenMatrix.grandTotal }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-if="!dosenMatrix.rows.length" class="empty">
                            <i class="bi bi-table"></i>
                            <p>Tidak ada data BA untuk filter ini.</p>
                        </div>
                    </div>

                    <div v-if="activeDosenCell" class="card" id="dosen-detail">
                        <div class="card-head">
                            <div>
                                <div class="card-title"><i class="bi bi-file-earmark-text"></i> Detail BA: {{ activeDosenCell.dosen }}</div>
                                <div class="card-sub">Bagian: {{ activeDosenCell.bagian }} · {{ dosenCellDetail.length }} BA · Total <span style="color:#0f766e;font-weight:700">{{ fmtRupiah(dosenCellBiayaTotal) }}</span></div>
                            </div>
                            <button class="btn btn-soft btn-sm" @click="closeDosenDetail"><i class="bi bi-x-lg"></i> Tutup</button>
                        </div>
                        <div v-if="dosenCellDetail.length" style="display:flex;flex-direction:column">
                            <div v-for="(d, i) in dosenCellDetail" :key="i" style="display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;border-bottom:1px solid #f1f5f9;padding:.75rem 1.25rem">
                                <div style="min-width:0;flex:1">
                                    <div style="font-weight:700">{{ d.nama }}</div>
                                    <div style="font-size:.78rem;color:#94a3b8">{{ fmtTanggalWaktu(d.tanggal) }}</div>
                                </div>
                                <span class="chip">{{ d.jumlahPeserta }} peserta</span>
                                <a v-if="d.fileUrl" :href="d.fileUrl" target="_blank" class="btn btn-soft btn-sm"><i class="bi bi-file-earmark-pdf"></i> Lihat File</a>
                                <span v-if="d.biaya" class="chip" style="color:#0f766e;border-color:#99f6e4;background:#f0fdfa">{{ fmtRupiah(d.biaya) }}</span>
                            </div>
                        </div>
                        <div v-else class="empty" style="padding:1.5rem"><p>Tidak ada BA untuk kombinasi ini.</p></div>
                    </div>
                </section>
            </template>
        </template>
    </div>

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

    function fmtRupiah(num) {
        const n = Number(num) || 0;
        return 'Rp ' + n.toLocaleString('id-ID');
    }
    function fmtTanggalWaktu(v) {
        if (!v) return '-';
        const s = String(v);
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
        if (m) {
            const datePart = m[3] + '/' + m[2] + '/' + m[1];
            const timePart = (m[4] !== undefined && m[5] !== undefined) ? (' ' + m[4] + ':' + m[5]) : '';
            return datePart + timePart;
        }
        return s;
    }
    function setUrlHyperlinks(ws, header, tooltip) {
        if (!ws || !ws['!ref']) return;
        const range = XLSX.utils.decode_range(ws['!ref']);
        let col = -1;
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
            if (cell && String(cell.v) === header) { col = c; break; }
        }
        if (col < 0) return;
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
            const addr = XLSX.utils.encode_cell({ r, c: col });
            const cell = ws[addr];
            if (!cell) continue;
            const url = String(cell.v || '');
            if (/^https?:\/\//i.test(url)) XLSX.utils.cell_set_hyperlink(cell, url, tooltip);
        }
    }

    createApp({
        data() {
            return {
                bootLoading: true,
                loading: false,
                loadingData: false,
                loggedIn: false,
                sessionNama: '',
                loginPwd: '',
                loginError: '',
                activeTab: 'bagian',
                summary: {},
                rows: [],
                beritaAcara: [],
                dosen: [],
                blok: [],
                kategori: [],
                bagian: { categories: [], labs: [] },
                masterBiaya: [],
                expanded: {},
                bagianFilter: { bagian: '', blok: '', q: '' },
                dosenFilter: { blok: '', jenis: '', from: '', to: '', bagian: '', q: '' },
                activeMatrixCell: null,
                activeDosenCell: null,
                exporting: false,
                toast: { show: false, type: 'success', message: '', icon: 'bi-check-circle-fill' },
                toastTimer: null
            };
        },
        computed: {
            toastClass() {
                return { success: 'toast-success', error: 'toast-error', info: 'toast-info' }[this.toast.type] || 'toast-info';
            },
            jenisOptions() {
                const set = {};
                this.rows.forEach(r => { if (r.pengajuan.jenisKegiatan) set[r.pengajuan.jenisKegiatan] = 1; });
                return Object.keys(set);
            },
            bagianOptions() {
                const cats = (this.bagian.categories && this.bagian.categories.length) ? this.bagian.categories : ['Ujian', 'SGD', 'KKD'];
                return cats.concat(this.bagian.labs || []);
            },
            dosenNpmMap() {
                const map = {};
                this.rows.forEach(r => {
                    const p = r.pengajuan;
                    const npm = String(p.npm || '').trim();
                    if (!npm) return;
                    if (!map[npm]) map[npm] = [];
                    map[npm].push({ dosen: String(p.dosen || '').trim() || 'Tanpa Dosen', blok: String(p.blok || '').trim(), jenis: String(p.jenisKegiatan || '').trim() });
                });
                return map;
            },
            npmBiayaMap() {
                const map = {};
                this.rows.forEach(r => {
                    const p = r.pengajuan;
                    const npm = String(p.npm || '').trim();
                    if (!npm) return;
                    if (!map[npm]) map[npm] = [];
                    map[npm].push({ blok: String(p.blok || '').trim(), biaya: Number(p.biaya) || 0 });
                });
                return map;
            },
            pLinkMap() {
                const map = {};
                this.rows.forEach(r => {
                    const p = r.pengajuan;
                    const npm = String(p.npm || '').trim();
                    if (!npm) return;
                    map[npm] = { status: String(p.status || '').trim() || '-', linkBukti: String(p.linkBukti || '').trim() };
                });
                return map;
            },
            bagianBlokOptions() {
                const sel = this.bagianFilter.bagian;
                const set = {};
                const add = (bagianLabel, blokRaw) => {
                    const blok = String(blokRaw || '').trim();
                    if (!blok) return;
                    if (!sel || bagianLabel === sel) set[blok] = 1;
                };
                this.beritaAcara.forEach(b => add(this.resolveBagianLabel(b.bagian, '', b.namaKegiatan) || 'Lainnya', b.blok));
                this.rows.forEach(r => {
                    const p = r.pengajuan;
                    const dets = (r.details && r.details.length) ? r.details : [{ jenisKegiatan: p.jenisKegiatan, pilihan: '', detail: '', tanggalPelaksanaan: p.tanggalPelaksanaan }];
                    dets.forEach(d => add(this.resolveBagianLabel(d.jenisKegiatan || d.bagian, d.pilihan || d.bagian, '') || 'Lainnya', p.blok));
                });
                return Object.keys(set).sort((a, b) => a.localeCompare(b));
            },
            bagianKegiatanAll() {
                const normBlok = s => String(s || '').trim() || 'Tanpa Blok';
                const normName = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim();
                const map = {};
                const get = (bagianLabel, blokLabel) => {
                    const key = this.normBagian(bagianLabel) + '::' + normBlok(blokLabel);
                    if (!map[key]) map[key] = { bagian: bagianLabel, blok: normBlok(blokLabel), byName: {} };
                    return map[key];
                };
                const baNames = {};
                this.beritaAcara.forEach(b => {
                    const bagianLabel = this.resolveBagianLabel(b.bagian, '', b.namaKegiatan) || 'Lainnya';
                    const blokLabel = normBlok(b.blok);
                    const g = get(bagianLabel, blokLabel);
                    const kName = normName(b.namaKegiatan);
                    const bKey = g.bagian && g.blok ? this.normBagian(g.bagian) + '::' + g.blok : '';
                    if (!baNames[bKey]) baNames[bKey] = [];
                    if (baNames[bKey].indexOf(kName) === -1) baNames[bKey].push(kName);
                    const fullKey = kName + '::' + String(b.tanggalPelaksanaan || '');
                    if (g.byName[fullKey]) return;
                    const peserta = (b.peserta || []).map(p => {
                        const info = this.pLinkMap[String(p.npm || '').trim()] || {};
                        return { npm: String(p.npm || '').trim(), namaLengkap: String(p.namaLengkap || '').trim(), status: info.status || '-', linkBukti: info.linkBukti || '' };
                    });
                    g.byName[fullKey] = {
                        sumber: 'BA', nama: b.namaKegiatan || '-', tanggal: b.tanggalPelaksanaan || '',
                        jumlahPeserta: Math.max(peserta.length, Number(b.jumlahPeserta) || 0),
                        fileUrl: b.fileUrl || '', peserta: peserta
                    };
                });
                this.rows.forEach(r => {
                    const p = r.pengajuan;
                    const npm = String(p.npm || '').trim();
                    if (!npm) return;
                    const info = this.pLinkMap[npm] || { status: '-', linkBukti: '' };
                    const dets = (r.details && r.details.length) ? r.details : [{ jenisKegiatan: p.jenisKegiatan, pilihan: '', detail: '', tanggalPelaksanaan: p.tanggalPelaksanaan }];
                    dets.forEach(d => {
                        const bagianLabel = this.resolveBagianLabel(d.jenisKegiatan || d.bagian, d.pilihan || d.bagian, '') || 'Lainnya';
                        const blokLabel = normBlok(p.blok);
                        const g = get(bagianLabel, blokLabel);
                        const parts = [d.pilihan, d.detail].filter(x => x && String(x).trim());
                        const nama = parts.length ? parts.join(' ') : (p.jenisKegiatan || '-');
                        const bKey = this.normBagian(g.bagian) + '::' + g.blok;
                        if ((baNames[bKey] || []).indexOf(normName(nama)) !== -1) return;
                        const tanggal = d.tanggalPelaksanaan || p.tanggalPelaksanaan || '';
                        const fullKey = normName(nama) + '::' + String(tanggal || '');
                        let keg = g.byName[fullKey];
                        if (!keg) {
                            keg = { sumber: 'Pengajuan', nama, tanggal, jumlahPeserta: 0, fileUrl: '', peserta: [] };
                            g.byName[fullKey] = keg;
                        }
                        if (!keg.peserta.some(x => x.npm === npm)) {
                            keg.peserta.push({ npm, namaLengkap: String(p.namaLengkap || '').trim(), status: info.status || '-', linkBukti: info.linkBukti || '' });
                        }
                    });
                });
                const out = [];
                Object.values(map).forEach(g => {
                    Object.values(g.byName).forEach(k => {
                        const seen = {};
                        k.peserta = k.peserta.filter(p => {
                            const key = (p.npm || p.namaLengkap || '').toLowerCase();
                            if (!key || seen[key]) return false;
                            seen[key] = 1;
                            return true;
                        });
                        if (k.sumber === 'Pengajuan') k.jumlahPeserta = k.peserta.length;
                        const biaya = k.peserta.reduce((t, p) => t + this.biayaForNpm(String(p.npm || '').trim(), g.blok), 0);
                        out.push({ bagian: g.bagian, blok: g.blok, sumber: k.sumber, nama: k.nama, tanggal: k.tanggal, jumlahPeserta: k.jumlahPeserta, fileUrl: k.fileUrl || '', peserta: k.peserta, biaya });
                    });
                });
                out.sort((a, b) => this.normBagian(a.bagian).localeCompare(this.normBagian(b.bagian)) || String(a.blok).localeCompare(String(b.blok)) || normName(a.nama).localeCompare(normName(b.nama)) || String(a.tanggal || '').localeCompare(String(b.tanggal || '')));
                return out;
            },
            bagianAllLabels() {
                const cats = (this.bagian.categories && this.bagian.categories.length) ? this.bagian.categories : ['Ujian', 'SGD', 'KKD'];
                const labels = cats.concat(this.bagian.labs || []);
                const seen = {};
                const uniq = labels.filter(l => {
                    const k = this.normBagian(l);
                    if (!k || seen[k]) return false;
                    seen[k] = 1;
                    return true;
                });
                const hasLainnya = this.bagianKegiatanAll.some(k => this.normBagian(k.bagian) === this.normBagian('Lainnya'));
                if (hasLainnya && !seen[this.normBagian('Lainnya')]) uniq.push('Lainnya');
                return uniq;
            },
            bagianMatrixBloks() {
                const set = {};
                (this.blok || []).forEach(b => { const v = String(b || '').trim(); if (v) set[v] = 1; });
                this.bagianKegiatanAll.forEach(k => { if (k.blok) set[k.blok] = 1; });
                return Object.keys(set).sort((a, b) => a.localeCompare(b));
            },
            bagianMatrixRows() {
                const bagianLabels = this.bagianAllLabels;
                return this.bagianMatrixBloks.map(blok => {
                    const counts = {};
                    bagianLabels.forEach(l => { counts[this.normBagian(l)] = 0; });
                    let total = 0;
                    this.bagianKegiatanAll.forEach(k => {
                        if (k.blok === blok) {
                            const bk = this.normBagian(k.bagian);
                            if (counts[bk] !== undefined) counts[bk]++;
                            total++;
                        }
                    });
                    return { key: blok, label: blok, counts, total };
                });
            },
            matrixGrandTotal() {
                return this.bagianMatrixRows.reduce((t, r) => t + r.total, 0);
            },
            bagianDetailRows() {
                const selBagian = this.bagianFilter.bagian;
                const selBlok = this.bagianFilter.blok;
                const q = this.normSearch(this.bagianFilter.q);
                const normName = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim();
                const rows = this.bagianKegiatanAll.filter(k => {
                    if (selBagian && this.normBagian(k.bagian) !== this.normBagian(selBagian)) return false;
                    if (selBlok && k.blok !== selBlok) return false;
                    if (q) {
                        if (normName(k.nama).indexOf(q) !== -1) return true;
                        return (k.peserta || []).some(p => this.normSearch((p.npm || '') + ' ' + (p.namaLengkap || '')).indexOf(q) !== -1);
                    }
                    return true;
                });
                rows.forEach((r, i) => {
                    r.uid = 'bagian-k' + i;
                    let c = 0;
                    r.peserta.forEach(p => { if (p.linkBukti) c++; });
                    r.countBukti = c;
                });
                return rows;
            },
            bagianDetailSections() {
                const sections = [];
                let last = null;
                let sub = null;
                this.bagianDetailRows.forEach(r => {
                    if (last !== r.bagian) {
                        if (sub) sections.push(sub);
                        sub = { type: 'subtotal', bagian: r.bagian, pesertaCount: 0, biaya: 0 };
                        last = r.bagian;
                    }
                    sub.pesertaCount += r.jumlahPeserta || 0;
                    sub.biaya += r.biaya || 0;
                    sections.push({ type: 'row', row: r });
                });
                if (sub) sections.push(sub);
                return sections;
            },
            bagianDetailGrandTotal() {
                return this.bagianDetailRows.reduce((t, r) => t + (r.biaya || 0), 0);
            },
            bagianDetailPesertaTotal() {
                const seen = {};
                this.bagianDetailRows.forEach(r => r.peserta.forEach(p => { const key = (p.npm || p.namaLengkap || '').toLowerCase(); if (key) seen[key] = 1; }));
                return Object.keys(seen).length;
            },
            dosenFilteredBa() {
                const blok = String(this.dosenFilter.blok || '').trim();
                const jenis = String(this.dosenFilter.jenis || '').trim();
                const fromD = this.dosenFilter.from ? this.dateVal(this.dosenFilter.from) : null;
                const toD = this.dosenFilter.to ? this.dateVal(this.dosenFilter.to) : null;
                if (toD) toD.setHours(23, 59, 59, 999);
                return this.beritaAcara.filter(b => {
                    if (blok && String(b.blok || '').trim() !== blok) return false;
                    if (jenis) {
                        const ok = (b.peserta || []).some(p => {
                            const info = this.npmInfoFor(String(p.npm || '').trim(), b.blok);
                            return info && info.jenis === jenis;
                        });
                        if (!ok) return false;
                    }
                    if (fromD || toD) {
                        const d = this.dateVal(b.tanggalPelaksanaan);
                        if (!d) return false;
                        if (fromD && d < fromD) return false;
                        if (toD && d > toD) return false;
                    }
                    return true;
                });
            },
            dosenMatrixCols() {
                let cols = this.bagianAllLabels.slice();
                const sel = String(this.dosenFilter.bagian || '').trim();
                if (sel) {
                    const sk = this.normBagian(sel);
                    cols = cols.filter(c => this.normBagian(c) === sk);
                }
                return cols;
            },
            dosenMatrixRows() {
                const cols = this.dosenMatrixCols;
                const colKeys = cols.map(c => this.normBagian(c));
                const q = this.normSearch(this.dosenFilter.q);
                const map = {};
                this.dosenFilteredBa.forEach(b => {
                    const bagianLabel = this.resolveBagianLabel(b.bagian, '', b.namaKegiatan) || 'Lainnya';
                    const bk = this.normBagian(bagianLabel);
                    if (colKeys.indexOf(bk) === -1) return;
                    const seenDosen = {};
                    (b.peserta || []).forEach(p => {
                        const dosen = this.resolveDosenForNpm(String(p.npm || '').trim(), b.blok);
                        if (!dosen) return;
                        const dk = this.normSearch(dosen);
                        if (seenDosen[dk]) return;
                        seenDosen[dk] = 1;
                        if (!map[dk]) {
                            map[dk] = { key: dk, label: dosen, counts: {}, total: 0 };
                            colKeys.forEach(k => { map[dk].counts[k] = 0; });
                        }
                        map[dk].counts[bk] = (map[dk].counts[bk] || 0) + 1;
                        map[dk].total++;
                    });
                });
                let arr = Object.values(map);
                if (q) arr = arr.filter(r => this.normSearch(r.label).indexOf(q) !== -1);
                arr.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
                return arr;
            },
            dosenGrandTotal() {
                return this.dosenMatrixRows.reduce((t, r) => t + r.total, 0);
            },
            dosenMatrix() {
                return { cols: this.dosenMatrixCols, rows: this.dosenMatrixRows, grandTotal: this.dosenGrandTotal };
            },
            dosenCellDetail() {
                const cell = this.activeDosenCell;
                if (!cell) return [];
                const bk = this.normBagian(cell.bagian);
                const dk = this.normSearch(cell.dosen);
                const out = [];
                this.dosenFilteredBa.forEach(b => {
                    const bagianLabel = this.resolveBagianLabel(b.bagian, '', b.namaKegiatan) || 'Lainnya';
                    if (this.normBagian(bagianLabel) !== bk) return;
                    const found = (b.peserta || []).some(p => {
                        const d = this.resolveDosenForNpm(String(p.npm || '').trim(), b.blok);
                        return d && this.normSearch(d) === dk;
                    });
                    if (!found) return;
                    out.push({
                        nama: b.namaKegiatan || '-', tanggal: b.tanggalPelaksanaan || '',
                        jumlahPeserta: Math.max((b.peserta || []).length, Number(b.jumlahPeserta) || 0),
                        fileUrl: b.fileUrl || '', biaya: (b.peserta || []).reduce((t, p) => t + this.biayaForNpm(String(p.npm || '').trim(), b.blok), 0)
                    });
                });
                return out;
            },
            dosenCellBiayaTotal() {
                return this.dosenCellDetail.reduce((t, d) => t + (d.biaya || 0), 0);
            }
        },
        watch: {
            'bagianFilter.bagian'(v) {
                if (this.activeMatrixCell && v !== this.activeMatrixCell.bagian) this.activeMatrixCell = null;
            },
            'bagianFilter.blok'(v) {
                if (this.activeMatrixCell && v !== this.activeMatrixCell.blok) this.activeMatrixCell = null;
            },
            'dosenFilter.blok'() { this.activeDosenCell = null; },
            'dosenFilter.jenis'() { this.activeDosenCell = null; },
            'dosenFilter.from'() { this.activeDosenCell = null; },
            'dosenFilter.to'() { this.activeDosenCell = null; },
            'dosenFilter.bagian'() { this.activeDosenCell = null; },
            'dosenFilter.q'() { this.activeDosenCell = null; }
        },
        methods: {
            showToast(message, type) {
                const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
                this.toast = { show: true, type: type || 'success', message, icon: icons[type || 'success'] };
                if (this.toastTimer) clearTimeout(this.toastTimer);
                this.toastTimer = setTimeout(() => { this.toast.show = false; }, 3600);
            },
            normSearch(s) {
                return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
            },
            normBagian(v) {
                return String(v || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
            },
            resolveBagianLabel(v, pilihan, namaKegiatan) {
                const key = this.normBagian(v);
                const categories = (this.bagian.categories && this.bagian.categories.length) ? this.bagian.categories : ['Ujian', 'SGD', 'KKD'];
                if (key) {
                    for (let i = 0; i < categories.length; i++) {
                        if (this.normBagian(categories[i]) === key) return categories[i];
                    }
                }
                const labs = this.bagian.labs || [];
                if (key) {
                    for (let i = 0; i < labs.length; i++) {
                        if (this.normBagian(labs[i]) === key) return labs[i];
                    }
                }
                const pKey = this.normBagian(pilihan);
                if (pKey) {
                    for (let i = 0; i < labs.length; i++) {
                        if (this.normBagian(labs[i]) === pKey) return labs[i];
                    }
                }
                const nKey = this.normBagian(namaKegiatan);
                if (nKey) {
                    const sorted = labs.slice().sort((a, b) => this.normBagian(b).length - this.normBagian(a).length);
                    for (let i = 0; i < sorted.length; i++) {
                        if (nKey.indexOf(this.normBagian(sorted[i])) !== -1) return sorted[i];
                    }
                }
                return '';
            },
            npmInfoFor(npm, baBlok) {
                const list = this.dosenNpmMap[String(npm || '').trim()] || [];
                if (!list.length) return null;
                const blok = String(baBlok || '').trim();
                return list.find(x => x.blok && x.blok === blok) || list[0];
            },
            biayaForNpm(npm, baBlok) {
                const list = this.npmBiayaMap[String(npm || '').trim()] || [];
                if (!list.length) return 0;
                const blok = String(baBlok || '').trim();
                return (list.find(x => x.blok && x.blok === blok) || list[0]).biaya || 0;
            },
            resolveDosenForNpm(npm, baBlok) {
                const info = this.npmInfoFor(npm, baBlok);
                return info ? info.dosen : null;
            },
            dateVal(v) {
                if (!v) return null;
                if (v instanceof Date) return v;
                const s = String(v).trim();
                let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
                m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            },
            toggleExpand(id) {
                this.expanded[id] = !this.expanded[id];
            },
            matrixColTotal(bagianLabel) {
                const bk = this.normBagian(bagianLabel);
                return this.bagianMatrixRows.reduce((t, r) => t + (r.counts[bk] || 0), 0);
            },
            dosenColTotal(bagianLabel) {
                const bk = this.normBagian(bagianLabel);
                return this.dosenMatrixRows.reduce((t, r) => t + (r.counts[bk] || 0), 0);
            },
            dosenCellKey(dosen, bagian) {
                return this.normSearch(dosen) + '::' + this.normBagian(bagian);
            },
            matrixCellKey(blok, bagianLabel) {
                return this.normBagian(bagianLabel) + '::' + String(blok || '').trim();
            },
            bagianKey(v) {
                return this.normBagian(v);
            },
            filterByMatrixCell(bagian, blok) {
                this.bagianFilter.bagian = bagian;
                this.bagianFilter.blok = blok;
                this.activeMatrixCell = { key: this.matrixCellKey(blok, bagian), bagian, blok };
                this.$nextTick(() => {
                    const el = document.getElementById('bagian-detail');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            },
            resetMatrixCell() {
                this.bagianFilter.bagian = '';
                this.bagianFilter.blok = '';
                this.activeMatrixCell = null;
            },
            openDosenCell(dosen, bagian) {
                this.activeDosenCell = { key: this.dosenCellKey(dosen, bagian), dosen, bagian };
                this.$nextTick(() => {
                    const el = document.getElementById('dosen-detail');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            },
            resetDosenCell() {
                this.activeDosenCell = null;
            },
            closeDosenDetail() {
                this.activeDosenCell = null;
            },
            statusBadgeCls(status) {
                return {
                    'Menunggu': 'st-menunggu',
                    'Diterima': 'st-diterima',
                    'Ditolak': 'st-ditolak',
                    'ACC': 'st-acc',
                    'Dibatalkan': 'st-dibatalkan'
                }[status] || 'st-dibatalkan';
            },
            applyBootstrap(b) {
                this.sessionNama = b.nama || 'Admin';
                this.summary = b.summary || {};
                this.rows = b.rows || [];
                this.beritaAcara = b.beritaAcara || [];
                this.dosen = b.dosen || [];
                this.blok = b.blok || [];
                this.kategori = b.kategori || [];
                this.masterBiaya = b.masterBiaya || [];
                this.bagian = b.bagian || { categories: b.kategori || ['Ujian', 'SGD', 'KKD'], labs: [] };
                this.expanded = {};
                this.activeDosenCell = null;
                this.activeMatrixCell = null;
            },
            async boot() {
                this.bootLoading = true;
                try {
                    const res = await apiFetch('GET', 'laporan/bootstrap');
                    this.applyBootstrap(res.data);
                    this.loggedIn = true;
                } catch (e) {
                    this.loggedIn = false;
                } finally {
                    this.bootLoading = false;
                }
            },
            async refresh() {
                if (this.loadingData) return;
                this.loadingData = true;
                this.loading = true;
                try {
                    const res = await apiFetch('GET', 'laporan/bootstrap');
                    this.applyBootstrap(res.data);
                    this.showToast('Data berhasil dimuat ulang.');
                } catch (e) {
                    this.showToast('Gagal memuat data: ' + e.message, 'error');
                } finally {
                    this.loadingData = false;
                    this.loading = false;
                }
            },
            async doLogin() {
                if (!this.loginPwd) { this.loginError = 'Masukkan password admin.'; return; }
                this.loginError = '';
                this.loading = true;
                try {
                    const fd = new URLSearchParams();
                    fd.set('role', 'admin');
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
                    window.location.href = '/laporan';
                } catch (e) {
                    this.loginError = 'Terjadi kesalahan jaringan. Coba lagi.';
                } finally {
                    this.loading = false;
                }
            },
            _loadXlsx() {
                return new Promise((resolve, reject) => {
                    if (window.XLSX) return resolve();
                    const s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                    s.onload = () => resolve();
                    s.onerror = () => reject(new Error('Gagal memuat library export.'));
                    document.head.appendChild(s);
                });
            },
            exportExcel() {
                this.exporting = true;
                this._loadXlsx().then(() => {
                    try {
                        const wb = XLSX.utils.book_new();
                        const bagianLabels = this.bagianAllLabels;
                        const rekapBagianRows = this.bagianMatrixRows.map(r => {
                            const row = { Blok: r.label };
                            bagianLabels.forEach(b => { row[b] = r.counts[this.normBagian(b)] || 0; });
                            row.Total = r.total;
                            return row;
                        });
                        const totalBlokRow = { Blok: 'Total' };
                        bagianLabels.forEach(b => { totalBlokRow[b] = this.matrixColTotal(b); });
                        totalBlokRow.Total = this.matrixGrandTotal;
                        rekapBagianRows.push(totalBlokRow);
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rekapBagianRows), 'Rekap Bagian');

                        const detailKegiatanRows = this.bagianDetailRows.map(r => ({
                            'Bagian': r.bagian, 'Blok': r.blok, 'Sumber': r.sumber === 'BA' ? 'Berita Acara' : 'Pengajuan',
                            'Nama Kegiatan': r.nama, 'Tanggal': fmtTanggalWaktu(r.tanggal), 'Biaya': r.biaya || 0,
                            'Jumlah Peserta': r.jumlahPeserta, 'Bukti Bayar': r.countBukti + '/' + r.peserta.length,
                            'Daftar Peserta': r.peserta.map(p => (p.npm || '-') + ' - ' + (p.namaLengkap || '-')).join('; '),
                            'Link BA': r.fileUrl || ''
                        }));
                        const wsDetailKegiatan = XLSX.utils.json_to_sheet(detailKegiatanRows);
                        setUrlHyperlinks(wsDetailKegiatan, 'Link BA', 'Buka link berita acara');
                        XLSX.utils.book_append_sheet(wb, wsDetailKegiatan, 'Detail Kegiatan');

                        const detailPesertaRows = [];
                        this.bagianDetailRows.forEach(r => r.peserta.forEach(p => {
                            detailPesertaRows.push({
                                'Bagian': r.bagian, 'Blok': r.blok, 'Kegiatan': r.nama, 'Tanggal': fmtTanggalWaktu(r.tanggal),
                                'NPM': p.npm || '', 'Nama': p.namaLengkap || '', 'Status': p.status || '',
                                'Biaya': this.biayaForNpm(String(p.npm || '').trim(), r.blok),
                                'Link Bukti Bayar': p.linkBukti || ''
                            });
                        }));
                        const wsDetailPeserta = XLSX.utils.json_to_sheet(detailPesertaRows);
                        setUrlHyperlinks(wsDetailPeserta, 'Link Bukti Bayar', 'Buka link bukti bayar');
                        XLSX.utils.book_append_sheet(wb, wsDetailPeserta, 'Detail Peserta');

                        const dosenCols = this.dosenMatrixCols;
                        const dosenRows = this.dosenMatrixRows.map(r => {
                            const row = { Dosen: r.label };
                            dosenCols.forEach(b => { row[b] = r.counts[this.bagianKey(b)] || 0; });
                            row.Total = r.total;
                            return row;
                        });
                        const dosenTotalRow = { Dosen: 'Total' };
                        dosenCols.forEach(b => { dosenTotalRow[b] = this.dosenColTotal(b); });
                        dosenTotalRow.Total = this.dosenGrandTotal;
                        dosenRows.push(dosenTotalRow);
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dosenRows), 'Rekap Dosen');

                        XLSX.writeFile(wb, 'Laporan-INHAL-' + new Date().toISOString().slice(0, 10) + '.xlsx');
                        this.showToast('Export .xlsx berhasil diunduh.');
                    } catch (e) {
                        this.showToast('Export gagal: ' + ((e && e.message) ? e.message : e), 'error');
                    } finally {
                        this.exporting = false;
                    }
                }).catch(e => {
                    this.exporting = false;
                    this.showToast('Export gagal: ' + ((e && e.message) ? e.message : e), 'error');
                });
            },
            exportDosenMatrix() {
                this.exporting = true;
                this._loadXlsx().then(() => {
                    try {
                        const wb = XLSX.utils.book_new();
                        const cols = this.dosenMatrixCols;
                        const rows = this.dosenMatrixRows.map(r => {
                            const row = { Dosen: r.label };
                            cols.forEach(b => { row[b] = r.counts[this.bagianKey(b)] || 0; });
                            row.Total = r.total;
                            return row;
                        });
                        const totalRow = { Dosen: 'Total' };
                        cols.forEach(b => { totalRow[b] = this.dosenColTotal(b); });
                        totalRow.Total = this.dosenGrandTotal;
                        rows.push(totalRow);
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Rekap Dosen');
                        XLSX.writeFile(wb, 'Rekap-Dosen-' + new Date().toISOString().slice(0, 10) + '.xlsx');
                        this.showToast('Export matriks dosen berhasil diunduh.');
                    } catch (e) {
                        this.showToast('Export gagal: ' + ((e && e.message) ? e.message : e), 'error');
                    } finally {
                        this.exporting = false;
                    }
                }).catch(e => {
                    this.exporting = false;
                    this.showToast('Export gagal: ' + ((e && e.message) ? e.message : e), 'error');
                });
            }
        },
        mounted() {
            this.boot();
        }
    }).mount('#app');
</script>
</body>
</html>
