<?php
$pageKey = $page ?? 'bagian';
$pageTitle = $title ?? 'Bagian';
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
        body{margin:0;background:#f1f5f9;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased}
        .topbar{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.88);border-bottom:1px solid #e2e8f0;backdrop-filter:blur(8px)}
        .topbar-inner{max-width:68rem;margin:0 auto;height:4rem;padding:0 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
        .brand{display:flex;align-items:center;gap:.7rem;text-decoration:none;color:inherit}
        .brand-badge{display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:.8rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.35);font-size:1.1rem}
        .brand-text{display:flex;flex-direction:column;line-height:1.2}
        .brand-name{font-weight:800;font-size:.95rem;letter-spacing:-.01em}
        .brand-sub{font-size:.68rem;color:#64748b}
        .topbar-right{display:flex;align-items:center;gap:.6rem}
        .user-chip{display:inline-flex;align-items:center;gap:.45rem;font-size:.78rem;font-weight:600;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;padding:.4rem .8rem;border-radius:999px}
        .user-chip i{color:#6366f1}
        .link-btn{display:inline-flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:700;color:#475569;text-decoration:none;border:1px solid #e2e8f0;background:#fff;padding:.4rem .85rem;border-radius:.65rem;transition:.15s ease}
        .link-btn:hover{background:#f1f5f9;color:#0f172a}
        .wrap{max-width:68rem;margin:0 auto;padding:1.5rem 1.25rem 4rem}
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
        .inp{width:100%;border:1px solid #e2e8f0;border-radius:.75rem;padding:.65rem .9rem;font-size:.9rem;color:#0f172a;background:#fff;transition:.15s ease}
        .inp:focus{outline:none;border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:.8rem;font-size:.9rem;font-weight:700;padding:.68rem 1.1rem;cursor:pointer;transition:.15s ease}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#7c5cf0);color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.3)}
        .btn-primary:hover{filter:brightness(1.05)}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-ghost{background:#eef2ff;color:#4f46e5}
        .btn-ghost:hover{background:#e0e7ff}
        .btn-success{background:#059669;color:#fff}
        .btn-success:hover{filter:brightness(1.05)}
        .btn-danger{background:#fee2e2;color:#b91c1c}
        .btn-danger:hover{background:#fecaca}
        .btn-block{width:100%}
        .auth-error{display:flex;align-items:center;gap:.5rem;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:.8rem;font-weight:600;border-radius:.8rem;padding:.6rem .8rem;margin-bottom:.9rem}
        .page-head{display:flex;align-items:center;gap:.9rem;margin-bottom:1.25rem}
        .page-head-icon{display:inline-flex;align-items:center;justify-content:center;width:2.9rem;height:2.9rem;border-radius:1rem;background:#eef2ff;color:#4f46e5;font-size:1.3rem}
        .page-head h1{margin:0;font-size:1.3rem;font-weight:800;letter-spacing:-.01em}
        .page-head p{margin:.15rem 0 0;font-size:.8rem;color:#64748b}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.8rem;margin-bottom:1.25rem}
        .stat{background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.25rem}
        .stat-label{font-size:.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:.35rem}
        .stat-value{font-size:1.4rem;font-weight:800;letter-spacing:-.01em}
        .stat-sub{font-size:.72rem;color:#94a3b8}
        .card{background:#fff;border-radius:1.15rem;box-shadow:0 1px 3px rgba(15,23,42,.06);margin-bottom:1.25rem;overflow:hidden}
        .card-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1.05rem 1.25rem;border-bottom:1px solid #f1f5f9}
        .card-title{display:flex;align-items:center;gap:.6rem;font-size:.98rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .card-title i{color:#6366f1}
        .card-body{padding:1.25rem}
        .empty{text-align:center;padding:2rem 1rem;color:#94a3b8}
        .empty i{font-size:2rem;display:block;margin-bottom:.6rem;opacity:.6}
        .empty p{margin:0;font-size:.88rem;font-weight:600}
        .group-item{width:100%;text-align:left;border:0;background:#fff;border-bottom:1px solid #f1f5f9;padding:1rem 1.25rem;cursor:pointer;transition:.15s ease;display:flex;align-items:center;gap:1rem}
        .group-item:last-child{border-bottom:0}
        .group-item:hover{background:#f8fafc}
        .group-main{flex:1;min-width:0}
        .group-name{font-weight:700;font-size:.92rem;color:#0f172a;word-break:break-word}
        .group-meta{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem}
        .chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.68rem;font-weight:700;padding:.18rem .55rem;border-radius:999px}
        .chip-soft{background:#f1f5f9;color:#475569}
        .chip-brand{background:#eef2ff;color:#4f46e5}
        .chip-emerald{background:#ecfdf5;color:#047857}
        .chip-amber{background:#fffbeb;color:#b45309}
        .chip-rose{background:#fef2f2;color:#b91c1c}
        .status-menunggu{background:#fffbeb;color:#b45309}
        .status-diterima{background:#ecfdf5;color:#047857}
        .status-acc{background:#eef2ff;color:#4f46e5}
        .status-ditolak{background:#fef2f2;color:#b91c1c}
        .group-arrow{color:#cbd5e1;font-size:1.1rem}
        .sec-title{display:flex;align-items:center;gap:.5rem;font-weight:800;font-size:.95rem;margin:1.4rem 0 .9rem;color:#0f172a}
        .sec-title i{color:#6366f1}
        table.list{width:100%;border-collapse:collapse;font-size:.85rem}
        table.list th{text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:.6rem 1rem;border-bottom:1px solid #f1f5f9;background:#f8fafc;font-weight:800}
        table.list td{padding:.75rem 1rem;border-bottom:1px solid #f1f5f9;vertical-align:top;color:#334155}
        table.list tr:last-child td{border-bottom:0}
        .badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:800;padding:.28rem .6rem;border-radius:999px}
        .table-scroll{overflow-x:auto}
        .modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(2px);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto}
        .modal{background:#fff;border-radius:1.25rem;width:100%;max-width:42rem;box-shadow:0 30px 80px rgba(15,23,42,.25);overflow:hidden;margin:auto}
        .modal-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1.15rem 1.35rem;border-bottom:1px solid #f1f5f9}
        .modal-title{font-weight:800;font-size:1rem;display:flex;align-items:center;gap:.55rem}
        .modal-title i{color:#6366f1}
        .modal-close{border:0;background:#f1f5f9;color:#64748b;width:2rem;height:2rem;border-radius:.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .modal-close:hover{background:#e2e8f0;color:#0f172a}
        .modal-body{padding:1.35rem}
        .modal-foot{padding:1rem 1.35rem;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:.6rem}
        .alert{display:flex;align-items:flex-start;gap:.6rem;border-radius:.9rem;padding:.75rem .9rem;font-size:.82rem;font-weight:600;line-height:1.45}
        .alert-warn{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
        .alert-info{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
        .alert-danger{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
        .alert-success{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
        .check-item{display:flex;align-items:center;gap:.8rem;padding:.6rem .1rem;border-bottom:1px dashed #f1f5f9}
        .check-item:last-child{border-bottom:0}
        .check-item input{width:1.05rem;height:1.05rem;accent-color:#4f46e5;flex:none}
        .check-name{flex:1;min-width:0;font-size:.88rem;font-weight:600;color:#0f172a}
        .check-npm{font-size:.7rem;color:#94a3b8;font-weight:500}
        .file-drop{border:2px dashed #c7d2fe;border-radius:.9rem;padding:1rem;text-align:center;cursor:pointer;background:#fafaff;transition:.15s ease}
        .file-drop:hover{background:#eef2ff}
        .file-drop i{font-size:1.5rem;color:#6366f1;display:block;margin-bottom:.35rem}
        .file-drop span{font-size:.82rem;font-weight:700;color:#475569}
        .file-drop small{display:block;font-size:.68rem;color:#94a3b8;margin-top:.2rem}
        .toast{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:.6rem;max-width:92vw;background:#0f172a;color:#fff;font-size:.85rem;font-weight:600;padding:.8rem 1.15rem;border-radius:.9rem;box-shadow:0 14px 40px rgba(15,23,42,.35);animation:rise .25s ease}
        .toast-success{background:#065f46}
        .toast-error{background:#991b1b}
        @keyframes rise{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        .fade-enter-active,.fade-leave-active{transition:opacity .18s ease}
        .fade-enter-from,.fade-leave-to{opacity:0}
        .loading-pane{display:flex;flex-direction:column;align-items:center;gap:.6rem;padding:3.5rem 1rem;color:#64748b}
        .spinner{width:1.4rem;height:1.4rem;border:3px solid #e0e7ff;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .meta-pill{font-size:.72rem;font-weight:700;background:#f1f5f9;color:#64748b;border-radius:999px;padding:.3rem .7rem;display:inline-flex;align-items:center;gap:.4rem}
    </style>
</head>
<body>
<div id="app" v-cloak>
    <div class="topbar">
        <div class="topbar-inner">
            <a class="brand" href="/">
                <span class="brand-badge"><i class="bi bi-clipboard2-check"></i></span>
                <span class="brand-text">
                    <span class="brand-name">Pendaftaran INHAL</span>
                    <span class="brand-sub">Panel Bagian</span>
                </span>
            </a>
            <div class="topbar-right" v-if="loggedIn">
                <span class="user-chip"><i class="bi bi-person-circle"></i>{{ sessionNama }} · {{ sessionScope }}</span>
                <a class="link-btn" href="/logout"><i class="bi bi-box-arrow-right"></i> Keluar</a>
            </div>
        </div>
    </div>

    <div class="wrap">
        <template v-if="bootLoading">
            <div class="card"><div class="loading-pane"><div class="spinner"></div><span>Memeriksa sesi…</span></div></div>
        </template>

        <template v-else-if="!loggedIn">
            <div class="auth-card">
                <div class="auth-logo"><i class="bi bi-people-fill"></i></div>
                <h2 class="auth-title">Masuk Panel Bagian</h2>
                <p class="auth-desc">Masuk sebagai petugas bagian atau admin</p>
                <div class="role-tabs">
                    <button class="role-tab" :class="{'is-active': role==='bagian'}" @click="role='bagian'">Bagian</button>
                    <button class="role-tab" :class="{'is-active': role==='admin'}" @click="role='admin'">Admin</button>
                </div>
                <div v-if="loginError" class="auth-error"><i class="bi bi-exclamation-triangle-fill"></i>{{ loginError }}</div>
                <form @submit.prevent="doLogin">
                    <div v-if="role==='bagian'" class="field">
                        <label><i class="bi bi-envelope"></i> Email bagian</label>
                        <input class="inp" type="email" v-model="loginEmail" autocomplete="username" placeholder="nama@inhal.test">
                    </div>
                    <div class="field">
                        <label><i class="bi bi-shield-lock"></i> {{ role==='admin' ? 'Password admin' : 'Password' }}</label>
                        <input class="inp" type="password" v-model="loginPwd" autocomplete="current-password" placeholder="••••••••">
                    </div>
                    <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
                        <span v-if="loading" class="spinner"></span>
                        <i v-else class="bi bi-box-arrow-in-right"></i> Masuk
                    </button>
                </form>
            </div>
        </template>

        <template v-else>
            <div class="page-head">
                <div class="page-head-icon"><i class="bi bi-people"></i></div>
                <div>
                    <h1>Panel Bagian</h1>
                    <p>Kelola berita acara dan kehadiran per bagian</p>
                </div>
                <div style="margin-left:auto" class="meta-pill"><i class="bi bi-funnel-fill"></i>{{ kategori }}</div>
            </div>

            <div class="stats">
                <div class="stat">
                    <span class="stat-label"><i class="bi bi-calendar2-check"></i> Kegiatan Siap</span>
                    <span class="stat-value">{{ kegiatanGroups.length }}</span>
                    <span class="stat-sub">Diterima / ACC</span>
                </div>
                <div class="stat">
                    <span class="stat-label"><i class="bi bi-file-earmark-text"></i> Berita Acara</span>
                    <span class="stat-value">{{ baSummary.jumlahBa }}</span>
                    <span class="stat-sub">{{ baSummary.jumlahPeserta }} peserta</span>
                </div>
                <div class="stat" v-if="baSummary.terakhir">
                    <span class="stat-label"><i class="bi bi-clock-history"></i> Terakhir</span>
                    <span class="stat-value" style="font-size:1rem;padding-top:.2rem">{{ formatTanggal(baSummary.terakhir) }}</span>
                </div>
            </div>

            <div class="card">
                <div class="card-head">
                    <span class="card-title"><i class="bi bi-list-check"></i> Pilih Kegiatan (Diterima / ACC)</span>
                    <button class="btn btn-ghost" style="padding:.45rem .8rem;font-size:.78rem" @click="loadData" :disabled="loading">
                        <i class="bi bi-arrow-clockwise"></i> Muat ulang
                    </button>
                </div>
                <div v-if="!kegiatanGroups.length" class="empty">
                    <i class="bi bi-inbox"></i>
                    <p>Belum ada kegiatan yang seluruh pesertanya berstatus Diterima / ACC.</p>
                </div>
                <div v-else>
                    <button v-for="g in kegiatanGroups" :key="g.key" class="group-item" @click="openBaPicker(g)">
                        <span class="group-main">
                            <span class="group-name">{{ g.label }}</span>
                            <span class="group-meta">
                                <span class="chip chip-soft"><i class="bi bi-calendar3"></i> {{ formatTanggal(g.tanggal) }}</span>
                                <span class="chip chip-soft"><i class="bi bi-people"></i> {{ g.peserta.length }} peserta</span>
                                <span v-for="(n, st) in g.statusCounts" :key="st" class="chip" :class="statusClass(st)">{{ st }}: {{ n }}</span>
                            </span>
                        </span>
                        <i class="bi bi-chevron-right group-arrow"></i>
                    </button>
                </div>
            </div>

            <div class="sec-title"><i class="bi bi-file-earmark-check"></i> Berita Acara Bagian ({{ baList.length }})</div>
            <div class="card">
                <div v-if="!baList.length" class="empty">
                    <i class="bi bi-file-earmark-text"></i>
                    <p>Belum ada berita acara diunggah untuk bagian ini.</p>
                </div>
                <div v-else class="table-scroll">
                    <table class="list">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Kegiatan</th>
                                <th>Blok</th>
                                <th>Jumlah</th>
                                <th>File</th>
                                <th>Catatan</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="ba in baList" :key="ba.baId">
                                <td style="white-space:nowrap">{{ formatTanggal(ba.tanggalPelaksanaan) }}</td>
                                <td>
                                    <div style="font-weight:700;color:#0f172a">{{ ba.namaKegiatan }}</div>
                                    <div style="font-size:.72rem;color:#94a3b8">{{ ba.baId }}</div>
                                </td>
                                <td>{{ ba.blok }}</td>
                                <td><span class="badge" style="background:#eef2ff;color:#4f46e5">{{ ba.jumlahPeserta }}</span></td>
                                <td>
                                    <span v-if="ba.file_name" class="chip chip-emerald"><i class="bi bi-paperclip"></i> {{ ba.file_name }}</span>
                                    <span v-else class="chip chip-soft">Tanpa file</span>
                                </td>
                                <td style="max-width:14rem">{{ ba.catatan || '-' }}</td>
                                <td style="white-space:nowrap">
                                    <button class="link-btn" style="font-size:.72rem;padding:.3rem .6rem" @click="syncStatus(ba)" :disabled="loading">
                                        <i class="bi bi-arrow-repeat"></i> Sinkron
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </div>

    <transition name="fade">
        <div v-if="picker.open" class="modal-mask" @click.self="closePicker">
            <div class="modal">
                <div class="modal-head">
                    <span class="modal-title"><i class="bi bi-upload"></i> Unggah Berita Acara</span>
                    <button class="modal-close" @click="closePicker"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="modal-body">
                    <template v-if="!picker.kegiatanKey">
                        <p style="font-size:.85rem;color:#64748b;margin:0 0 .8rem;font-weight:600">Pilih kegiatan yang akan dibuatkan berita acara:</p>
                        <button v-for="g in kegiatanGroups" :key="g.key" class="group-item" @click="selectKegiatan(g)">
                            <span class="group-main">
                                <span class="group-name">{{ g.label }}</span>
                                <span class="group-meta">
                                    <span class="chip chip-soft">{{ formatTanggal(g.tanggal) }}</span>
                                    <span class="chip chip-soft">{{ g.peserta.length }} peserta</span>
                                </span>
                            </span>
                            <i class="bi bi-chevron-right group-arrow"></i>
                        </button>
                    </template>
                    <template v-else>
                        <button class="btn btn-ghost" style="padding:.4rem .8rem;font-size:.78rem;margin-bottom:1rem" @click="backToKegiatan">
                            <i class="bi bi-arrow-left"></i> Ganti kegiatan
                        </button>
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:.9rem;padding:.8rem 1rem;margin-bottom:1.1rem">
                            <div style="font-weight:800;font-size:.95rem">{{ selectedGroup ? selectedGroup.label : '' }}</div>
                            <div style="font-size:.75rem;color:#94a3b8;margin-top:.2rem">{{ formatTanggal(picker.tanggal) }}</div>
                        </div>

                        <div class="field">
                            <label><i class="bi bi-calendar3"></i> Tanggal pelaksanaan</label>
                            <input class="inp" type="date" v-model="picker.tanggal">
                        </div>
                        <div v-if="baDuplicate" class="alert alert-warn" style="margin-bottom:1rem">
                            <i class="bi bi-exclamation-triangle-fill"></i>
                            <span>Sudah ada berita acara untuk kegiatan ini pada tanggal tersebut (BA {{ baDuplicate.baId }}). Upload akan ditolak.</span>
                        </div>

                        <div style="display:flex;align-items:center;justify-content:space-between;margin:.2rem 0 .5rem">
                            <label class="card-title" style="font-size:.9rem"><i class="bi bi-people"></i> Peserta ({{ pickerPeserta.length }})</label>
                            <label style="display:inline-flex;align-items:center;gap:.35rem;font-size:.78rem;font-weight:700;color:#475569;cursor:pointer">
                                <input type="checkbox" style="accent-color:#4f46e5" :checked="allSelected" @change="toggleAllPeserta">
                                Pilih semua
                            </label>
                        </div>
                        <div style="border:1px solid #e2e8f0;border-radius:.9rem;padding:.35rem 1rem;max-height:15rem;overflow-y:auto;margin-bottom:1rem">
                            <label v-for="p in pickerPeserta" :key="p.idPengajuan" class="check-item" style="cursor:pointer">
                                <input type="checkbox" :checked="isSelected(p.idPengajuan)" @change="togglePeserta(p.idPengajuan)">
                                <span class="check-name">
                                    {{ p.namaLengkap }}
                                    <span class="check-npm">{{ p.npm }} · {{ p.blok }}</span>
                                </span>
                                <span class="chip" :class="statusClass(p.statusPengajuan)">{{ p.statusPengajuan }}</span>
                            </label>
                            <div v-if="!pickerPeserta.length" class="empty">
                                <i class="bi bi-person-x"></i>
                                <p>Belum ada peserta berstatus Diterima / ACC pada kegiatan ini.</p>
                            </div>
                        </div>

                        <div class="field">
                            <label><i class="bi bi-paperclip"></i> File berita acara (PDF/JPG/PNG)</label>
                            <label class="file-drop">
                                <input type="file" accept="application/pdf,image/jpeg,image/png" style="display:none" @change="onBaFile">
                                <i class="bi bi-cloud-arrow-up"></i>
                                <span>{{ picker.fileName || 'Pilih file' }}</span>
                                <small v-if="!picker.fileName">maks. 5 MB</small>
                            </label>
                        </div>
                        <div class="field">
                            <label><i class="bi bi-chat-left-text"></i> Catatan (opsional)</label>
                            <textarea class="inp" rows="2" v-model="picker.catatan" placeholder="Catatan tambahan…"></textarea>
                        </div>
                    </template>
                </div>
                <div class="modal-foot" v-if="picker.kegiatanKey">
                    <button class="btn btn-ghost" @click="closePicker">Batal</button>
                    <button class="btn btn-primary" :disabled="loading || uploadBlocked" @click="confirmUpload">
                        <span v-if="loading" class="spinner"></span>
                        <i v-else class="bi bi-check-lg"></i> Unggah BA
                    </button>
                </div>
            </div>
        </div>
    </transition>

    <transition name="fade">
        <div v-if="toast.show" class="toast" :class="'toast-' + toast.type"><i class="bi" :class="toast.icon"></i>{{ toast.message }}</div>
    </transition>
</div>
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
<script>
const CSRF = document.querySelector('meta[name="csrf"]').getAttribute('content');

function readJson(res) {
    return res.json().catch(() => ({ ok: false, message: 'Respon tidak valid.' }));
}

Vue.createApp({
    data() {
        return {
            bootLoading: true,
            loading: false,
            loggedIn: false,
            kategori: '',
            subBagian: '',
            sessionNama: '',
            config: { statuses: ['Diterima', 'ACC'], finalOnly: true },
            rows: [],
            baList: [],
            baSummary: {},
            role: 'bagian',
            loginEmail: '',
            loginPwd: '',
            loginError: '',
            picker: { open: false, kegiatanKey: null, tanggal: '', catatan: '', file: null, fileName: '', selected: {} },
            toast: { show: false, type: 'info', message: '', icon: 'bi-info-circle' },
            toastTimer: null,
            pollTimer: null
        };
    },
    computed: {
        kegiatanGroups() {
            const map = {};
            const statuses = this.config.statuses || ['Diterima', 'ACC'];
            const finalOnly = this.config.finalOnly !== false;
            this.rows.forEach(r => {
                const key = [r.jenis, r.pilihan, r.detail, r.tanggal, r.blok].join('|');
                if (!map[key]) {
                    map[key] = {
                        key,
                        jenis: r.jenis,
                        pilihan: r.pilihan,
                        detail: r.detail,
                        tanggal: r.tanggal,
                        blok: r.blok,
                        label: this.kegiatanLabel(r) + (r.blok ? ' · Blok ' + r.blok : ''),
                        peserta: [],
                        statusCounts: {},
                        blocked: false
                    };
                }
                const g = map[key];
                g.statusCounts[r.status] = (g.statusCounts[r.status] || 0) + 1;
                if (statuses.indexOf(r.status) !== -1) {
                    g.peserta.push({
                        idPengajuan: r.idPengajuan,
                        npm: r.npm,
                        namaLengkap: r.namaLengkap,
                        blok: r.blok,
                        statusPengajuan: r.status
                    });
                }
                if (finalOnly && r.status === 'Menunggu') g.blocked = true;
            });
            return Object.values(map).filter(g => !g.blocked && g.peserta.length > 0);
        },
        selectedGroup() {
            if (!this.picker.kegiatanKey) return null;
            return this.kegiatanGroups.find(g => g.key === this.picker.kegiatanKey) || null;
        },
        allSelected() {
            const list = this.pickerPeserta;
            return list.length > 0 && list.every(p => !!this.picker.selected[p.idPengajuan]);
        },
        pickerPeserta() {
            return this.selectedGroup ? this.selectedGroup.peserta : [];
        },
        selectedCount() {
            return this.pickerPeserta.filter(p => !!this.picker.selected[p.idPengajuan]).length;
        },
        baDuplicate() {
            if (!this.selectedGroup || !this.picker.tanggal) return null;
            const tgl = String(this.picker.tanggal).slice(0, 10);
            return this.baList.find(r =>
                String(r.bagian) === (this.subBagian || this.kategori) &&
                String(r.blok) === String(this.selectedGroup.blok) &&
                String(r.namaKegiatan) === this.kegiatanLabel(this.selectedGroup) &&
                String(r.tanggalPelaksanaan).slice(0, 10) === tgl
            ) || null;
        },
        uploadBlocked() {
            return this.baDuplicate !== null;
        }
    },
    methods: {
        kegiatanLabel(r) {
            let label = String(r.pilihan || '');
            if (r.detail) label += ' - ' + r.detail;
            return label;
        },
        statusClass(st) {
            return { 'Menunggu': 'status-menunggu', 'Diterima': 'status-diterima', 'ACC': 'status-acc', 'Ditolak': 'status-ditolak' }[st] || 'chip-soft';
        },
        formatTanggal(v) {
            if (!v) return '-';
            const s = String(v);
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return m[3] + '/' + m[2] + '/' + m[1];
            const d = new Date(v);
            if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
            return s;
        },
        showToast(message, type) {
            const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
            this.toast = { show: true, type: type || 'info', message, icon: icons[type || 'info'] };
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => { this.toast.show = false; }, 3400);
        },
        async api(url, options) {
            const res = await fetch(url, options || {});
            const data = await readJson(res);
            if (res.status === 401 && data && data.ok === false) {
                this.loggedIn = false;
                this.stopPolling();
            }
            return { status: res.status, data };
        },
        async boot() {
            this.bootLoading = true;
            const { status, data } = await this.api('/api/bagian/bootstrap');
            this.bootLoading = false;
            if (status === 200 && data.ok) {
                this.applyBootstrap(data.data);
            } else {
                this.loggedIn = false;
            }
        },
        applyBootstrap(b) {
            this.loggedIn = true;
            this.sessionNama = b.nama || 'Bagian';
            this.kategori = b.kategori || '';
            this.subBagian = b.subBagian || '';
            this.config = b.config || { statuses: ['Diterima', 'ACC'], finalOnly: true };
            this.rows = b.rows || [];
            this.baList = (b.ba && b.ba.list) || [];
            this.baSummary = (b.ba && b.ba.summary) || {};
            this.startPolling();
        },
        async loadData() {
            this.loading = true;
            try {
                const { status, data } = await this.api('/api/bagian/bootstrap');
                if (status === 200 && data.ok) this.applyBootstrap(data.data);
            } catch (e) {
                this.showToast('Gagal memuat data.', 'error');
            } finally {
                this.loading = false;
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
                window.location.href = data.redirect || '/bagian';
            } catch (e) {
                this.loginError = 'Terjadi kesalahan jaringan. Coba lagi.';
            } finally {
                this.loading = false;
            }
        },
        startPolling() {
            this.stopPolling();
            this.pollTimer = setInterval(() => this.silentRefresh(), 30000);
        },
        stopPolling() {
            if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
        },
        async silentRefresh() {
            if (!this.loggedIn) { this.stopPolling(); return; }
            if (this.loading || this.picker.open) return;
            const { status, data } = await this.api('/api/bagian/bootstrap');
            if (status === 200 && data.ok) this.applyBootstrap(data.data);
        },
        openBaPicker(g) {
            this.picker.open = true;
            this.picker.kegiatanKey = null;
            this.picker.tanggal = '';
            this.picker.catatan = '';
            this.picker.file = null;
            this.picker.fileName = '';
            this.picker.selected = {};
            window.scrollTo(0, 0);
        },
        closePicker() {
            this.picker.open = false;
            this.picker.kegiatanKey = null;
            this.picker.selected = {};
            this.picker.confirm = false;
        },
        selectKegiatan(g) {
            this.picker.kegiatanKey = g.key;
            this.picker.tanggal = String(g.tanggal || '').slice(0, 10);
            this.picker.selected = {};
        },
        backToKegiatan() {
            this.picker.kegiatanKey = null;
            this.picker.selected = {};
        },
        isSelected(id) {
            return !!this.picker.selected[id];
        },
        togglePeserta(id) {
            this.picker.selected[id] = !this.picker.selected[id];
        },
        toggleAllPeserta() {
            const target = !this.allSelected;
            this.picker.peserta.forEach(p => { this.picker.selected[p.idPengajuan] = target; });
        },
        onBaFile(e) {
            const f = e.target.files && e.target.files.length ? e.target.files[0] : null;
            this.picker.file = f;
            this.picker.fileName = f ? f.name : '';
        },
        confirmUpload() {
            if (!this.selectedGroup) { this.showToast('Pilih kegiatan terlebih dahulu.', 'error'); return; }
            if (!this.selectedCount) { this.showToast('Pilih minimal satu peserta.', 'error'); return; }
            if (!this.picker.file) { this.showToast('Pilih file berita acara terlebih dahulu.', 'error'); return; }
            if (!this.picker.tanggal) { this.showToast('Isi tanggal pelaksanaan terlebih dahulu.', 'error'); return; }
            this.submitBa();
        },
        async submitBa() {
            if (this.loading) return;
            this.loading = true;
            try {
                const g = this.selectedGroup;
                const peserta = g.peserta.filter(p => !!this.picker.selected[p.idPengajuan]);
                const fd = new FormData();
                fd.set('namaKegiatan', this.kegiatanLabel(g));
                fd.set('tanggalPelaksanaan', this.picker.tanggal);
                fd.set('blok', String(g.blok || ''));
                fd.set('bagian', this.subBagian || this.kategori);
                fd.set('catatan', this.picker.catatan.trim());
                fd.set('peserta', JSON.stringify(peserta));
                if (this.picker.file) fd.set('file', this.picker.file);
                const res = await fetch('/api/bagian/ba', { method: 'POST', body: fd });
                const data = await readJson(res);
                this.showToast((data && data.message) || (res.ok ? 'Berita acara berhasil diunggah.' : 'Upload gagal.'), res.ok ? 'success' : 'error');
                if (res.ok && data.ok) {
                    this.closePicker();
                    this.loadData();
                }
            } catch (e) {
                this.showToast('Gagal mengunggah berita acara.', 'error');
            } finally {
                this.loading = false;
            }
        },
        async syncStatus(ba) {
            if (this.loading) return;
            this.loading = true;
            try {
                const res = await fetch('/api/bagian/ba/' + encodeURIComponent(ba.baId) + '/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ catatan: '' })
                });
                const data = await readJson(res);
                this.showToast((data && data.message) || 'Gagal menyinkronkan status.', res.ok ? 'success' : 'error');
                if (res.ok && data.ok) this.loadData();
            } catch (e) {
                this.showToast('Gagal menyinkronkan status.', 'error');
            } finally {
                this.loading = false;
            }
        }
    },
    mounted() {
        this.boot();
    }
}).mount('#app');
</script>
</body>
</html>
