<?php
$pageKey = $page ?? 'pengaturan';
$pageTitle = $title ?? 'Pengaturan';
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
        .wrap{max-width:76rem;margin:0 auto;padding:1.5rem 1.25rem 4rem}
        .page-head{display:flex;align-items:center;gap:.9rem;margin-bottom:1.25rem;flex-wrap:wrap}
        .page-head-icon{display:inline-flex;align-items:center;justify-content:center;width:2.9rem;height:2.9rem;border-radius:1rem;background:#eef2ff;color:#4f46e5;font-size:1.3rem}
        .page-head h1{margin:0;font-size:1.3rem;font-weight:800;letter-spacing:-.01em}
        .page-head p{margin:.15rem 0 0;font-size:.8rem;color:#64748b}
        .page-head-actions{margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap}
        .tabs{display:flex;gap:.3rem;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:.35rem;margin-bottom:1.25rem;max-width:100%;overflow-x:auto}
        .tab{border:0;background:transparent;display:inline-flex;align-items:center;gap:.45rem;font-size:.83rem;font-weight:700;color:#64748b;padding:.55rem .9rem;border-radius:.7rem;cursor:pointer;white-space:nowrap;transition:.15s ease}
        .tab:hover{background:#f1f5f9;color:#334155}
        .tab.is-active{background:#eef2ff;color:#4f46e5}
        .card{background:#fff;border-radius:1.15rem;box-shadow:0 1px 3px rgba(15,23,42,.06);margin-bottom:1.25rem;overflow:hidden}
        .card-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1rem 1.25rem;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
        .card-title{display:flex;align-items:center;gap:.6rem;font-size:.98rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .card-title i{color:#6366f1}
        .card-body{padding:1.25rem}
        .empty{text-align:center;padding:2.5rem 1rem;color:#94a3b8}
        .empty i{font-size:2.2rem;display:block;margin-bottom:.6rem;opacity:.6}
        .empty p{margin:0;font-size:.88rem;font-weight:600}
        .grid{display:grid;gap:1rem}
        @media(min-width:768px){.grid-2{grid-template-columns:1fr 1fr}.grid-4{grid-template-columns:repeat(4,1fr)}}
        .input{width:100%;border:1px solid #e2e8f0;border-radius:.7rem;padding:.55rem .8rem;font-size:.86rem;color:#0f172a;background:#fff;transition:.15s ease}
        .input:focus{outline:none;border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
        textarea.input{min-height:7rem;resize:vertical;font-family:inherit}
        label.f{display:block;font-size:.76rem;font-weight:700;color:#64748b;margin-bottom:.35rem}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:0;border-radius:.75rem;font-size:.84rem;font-weight:700;padding:.55rem .95rem;cursor:pointer;transition:.15s ease}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#7c5cf0);color:#fff;box-shadow:0 6px 18px rgba(99,102,241,.28)}
        .btn-primary:hover{filter:brightness(1.05)}
        .btn-soft{background:#fff;color:#475569;border:1px solid #e2e8f0}
        .btn-soft:hover{background:#f8fafc;color:#0f172a}
        .btn-danger-soft{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
        .btn-danger-soft:hover{background:#fee2e2}
        .btn-success{background:#059669;color:#fff}
        .btn-sm{padding:.38rem .7rem;font-size:.78rem;border-radius:.6rem}
        table.list{width:100%;border-collapse:collapse;font-size:.84rem}
        table.list th{text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:.6rem .9rem;border-bottom:1px solid #f1f5f9;background:#fafbfc;font-weight:800;white-space:nowrap}
        table.list td{padding:.5rem .9rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155}
        table.list input,table.list select{min-width:0;width:100%}
        .table-scroll{overflow-x:auto}
        .table-scroll .wide{min-width:340px}
        .badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;font-weight:800;padding:.26rem .6rem;border-radius:999px;white-space:nowrap}
        .st-active{background:#ecfdf5;color:#047857}
        .st-inactive{background:#f1f5f9;color:#64748b}
        .row-del td{opacity:.4;text-decoration:line-through}
        .loading-pane{display:flex;align-items:center;justify-content:center;gap:.6rem;padding:3rem 1rem;color:#64748b;font-size:.88rem;font-weight:600}
        .spinner{width:1.3rem;height:1.3rem;border:2.5px solid #e0e7ff;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .toast{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:.6rem;max-width:92vw;color:#fff;font-size:.85rem;font-weight:600;padding:.8rem 1.15rem;border-radius:.9rem;box-shadow:0 14px 40px rgba(15,23,42,.35);animation:rise .25s ease}
        .toast-success{background:#065f46}.toast-error{background:#991b1b}.toast-info{background:#0f172a}
        @keyframes rise{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        .fade-enter-active,.fade-leave-active{transition:opacity .18s ease}
        .fade-enter-from,.fade-leave-to{opacity:0}
        .sm{font-size:.76rem;color:#94a3b8;font-weight:500}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem}
        .kbd{display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:.4rem;padding:.05rem .45rem;font-size:.74rem;font-weight:700;color:#475569}
        .chip-check{display:inline-flex;align-items:center;gap:.4rem;border:1px solid #e2e8f0;border-radius:999px;padding:.35rem .7rem;font-size:.78rem;font-weight:700;color:#475569;cursor:pointer;background:#fff}
        .chip-check.is-on{border-color:#818cf8;background:#eef2ff;color:#4f46e5}
        .hint{font-size:.74rem;color:#94a3b8;font-weight:500}
        .role-tabs{display:flex;gap:.3rem;background:#f1f5f9;border-radius:.8rem;padding:.3rem;margin-bottom:1rem}
        .role-tab{flex:1;border:0;border-radius:.6rem;padding:.5rem;font-weight:700;font-size:.84rem;color:#64748b;cursor:pointer;background:transparent}
        .role-tab.is-active{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(15,23,42,.12)}
        .auth-card{max-width:25rem;margin:2rem auto;background:#fff;border-radius:1.2rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:1.75rem}
        .auth-logo{width:3.2rem;height:3.2rem;border-radius:1rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto .9rem}
        .auth-title{margin:0;text-align:center;font-size:1.15rem;font-weight:800}
        .auth-desc{margin:.3rem 0 1.1rem;text-align:center;font-size:.8rem;color:#94a3b8}
        .auth-error{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:.7rem;padding:.6rem .8rem;font-size:.8rem;font-weight:600;margin-bottom:.8rem;display:flex;gap:.4rem;align-items:center}
        .field{margin-bottom:.9rem}
        .btn-block{width:100%}
        .topbar-actions{display:flex;align-items:center;gap:.6rem}
        .user-chip{display:inline-flex;align-items:center;gap:.45rem;font-size:.78rem;font-weight:600;color:#334155;background:#fff;border:1px solid #e2e8f0;padding:.4rem .8rem;border-radius:999px}
        .user-chip i{color:#6366f1}
    </style>
</head>
<body>
<div id="app" v-cloak>
    <div style="position:sticky;top:0;z-index:40;background:rgba(255,255,255,.88);border-bottom:1px solid #eef1f6;backdrop-filter:blur(8px)">
        <div style="max-width:76rem;margin:0 auto;height:4rem;padding:0 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem">
            <div style="display:flex;align-items:center;gap:.7rem">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:.8rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.35);font-size:1.1rem"><i class="bi bi-sliders"></i></span>
                <div>
                    <div style="font-weight:800;font-size:.95rem;letter-spacing:-.01em;line-height:1.2">Pengaturan INHAL</div>
                    <div style="font-size:.68rem;color:#94a3b8;line-height:1.2">Konfigurasi master, pengguna, dan email</div>
                </div>
            </div>
            <div class="topbar-actions">
                <a class="btn btn-soft btn-sm" href="/dashboard"><i class="bi bi-speedometer2"></i> Dashboard</a>
                <a class="btn btn-soft btn-sm" href="/laporan"><i class="bi bi-file-earmark-bar-graph"></i> Laporan</a>
                <a class="btn btn-soft btn-sm" href="/logout"><i class="bi bi-box-arrow-right"></i> Keluar</a>
            </div>
        </div>
    </div>

    <div class="wrap">
        <template v-if="!loggedIn">
            <div class="auth-card">
                <div class="auth-logo"><i class="bi bi-shield-lock"></i></div>
                <h2 class="auth-title">Masuk Admin</h2>
                <p class="auth-desc">Masuk sebagai admin untuk membuka Pengaturan</p>
                <div v-if="loginError" class="auth-error"><i class="bi bi-exclamation-triangle-fill"></i>{{ loginError }}</div>
                <form @submit.prevent="doLogin">
                    <div class="field">
                        <label class="f">Password admin</label>
                        <input class="input" type="password" v-model="loginPwd" autocomplete="current-password" placeholder="••••••••">
                    </div>
                    <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
                        <span v-if="loading" class="spinner" style="width:1rem;height:1rem"></span>
                        <i v-else class="bi bi-box-arrow-in-right"></i> Masuk
                    </button>
                </form>
            </div>
        </template>

        <template v-else>
            <div class="page-head">
                <div class="page-head-icon"><i class="bi bi-sliders"></i></div>
                <div>
                    <h1>Pengaturan</h1>
                    <p>Atur seluruh konfigurasi aplikasi INHAL</p>
                </div>
                <div class="page-head-actions">
                    <button class="btn btn-primary" @click="saveActive()" :disabled="saving">
                        <span v-if="saving" class="spinner" style="width:1rem;height:1rem"></span>
                        <i v-else class="bi bi-check2-circle"></i> Simpan
                    </button>
                </div>
            </div>

            <div class="tabs">
                <button class="tab" :class="{'is-active': tab==='umum'}" @click="setTab('umum')"><i class="bi bi-gear"></i> Umum</button>
                <button class="tab" :class="{'is-active': tab==='matakuliah'}" @click="setTab('matakuliah')"><i class="bi bi-book"></i> Matakuliah</button>
                <button class="tab" :class="{'is-active': tab==='kegiatan'}" @click="setTab('kegiatan')"><i class="bi bi-diagram-3"></i> Master Kegiatan</button>
                <button class="tab" :class="{'is-active': tab==='bagian'}" @click="setTab('bagian')"><i class="bi bi-people"></i> Master Bagian</button>
                <button class="tab" :class="{'is-active': tab==='biaya'}" @click="setTab('biaya')"><i class="bi bi-cash-coin"></i> Master Biaya</button>
                <button class="tab" :class="{'is-active': tab==='mahasiswa'}" @click="setTab('mahasiswa')"><i class="bi bi-person-lines-fill"></i> Mahasiswa</button>
                <button class="tab" :class="{'is-active': tab==='pengguna'}" @click="setTab('pengguna')"><i class="bi bi-person-badge"></i> Pengguna</button>
                <button class="tab" :class="{'is-active': tab==='email'}" @click="setTab('email')"><i class="bi bi-envelope"></i> Email</button>
                <button class="tab" :class="{'is-active': tab==='nomor'}" @click="setTab('nomor')"><i class="bi bi-file-earmark-text"></i> Nomor Surat</button>
                <button class="tab" :class="{'is-active': tab==='upload'}" @click="setTab('upload')"><i class="bi bi-cloud-arrow-up"></i> Upload</button>
                <button class="tab" :class="{'is-active': tab==='status'}" @click="setTab('status')"><i class="bi bi-arrow-repeat"></i> Alur Status</button>
                <button class="tab" :class="{'is-active': tab==='audit'}" @click="setTab('audit')"><i class="bi bi-clock-history"></i> Audit</button>
            </div>

            <template v-if="loading">
                <div class="card"><div class="loading-pane"><div class="spinner"></div><span>Memuat pengaturan…</span></div></div>
            </template>

            <template v-else>
                <section v-if="tab==='umum'">
                    <div class="card">
                        <div class="card-head"><div class="card-title"><i class="bi bi-gear"></i> Umum</div></div>
                        <div class="card-body grid grid-2">
                            <div><label class="f">Nama aplikasi</label><input class="input" v-model="c.umum.appName"></div>
                            <div><label class="f">Zona waktu</label><input class="input" v-model="c.umum.timezone"></div>
                            <div>
                                <label class="f">Mode verifikasi bukti</label>
                                <select class="input" v-model="c.umum.buktiMode">
                                    <option value="strict">strict — PDF wajib</option>
                                    <option value="lenggang">lenggang — file apa pun</option>
                                </select>
                                <div class="hint" style="margin-top:.3rem">Pesan ke mahasiswa selalu netral.</div>
                            </div>
                            <div>
                                <label class="f">BA bagian hanya untuk status final</label>
                                <select class="input" v-model="c.umum.bagianBaFinalOnly">
                                    <option :value="0">Tidak (0)</option>
                                    <option :value="1">Ya (1)</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-body" style="padding-top:0">
                            <label class="f">Status BA bagian yang diizinkan</label>
                            <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.45rem">
                                <span v-for="s in statusAll" :key="s" class="chip-check" :class="{'is-on': c.umum.bagianBaStatuses.indexOf(s)>=0}" @click="toggleIn(c.umum.bagianBaStatuses, s)">
                                    <i :class="c.umum.bagianBaStatuses.indexOf(s)>=0 ? 'bi bi-check-circle-fill' : 'bi bi-circle'"></i>{{ s }}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='matakuliah'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-book"></i> Daftar Matakuliah</div>
                            <button class="btn btn-soft btn-sm" @click="addRow('matakuliah')"><i class="bi bi-plus-lg"></i> Tambah Matakuliah</button>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th style="width:8rem">Kode</th><th>Nama</th><th style="width:8rem">Blok</th><th style="width:5rem">SKS</th><th style="width:6rem">Aktif</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.matakuliah" :key="'mk'+(r.id||'n'+i)" :class="{'row-del': r._delete}">
                                        <td><input class="input" v-model="r.kode" placeholder="KIM101"></td>
                                        <td><input class="input" v-model="r.nama" placeholder="Nama matakuliah"></td>
                                        <td><input class="input" v-model="r.blok" placeholder="Blok 1"></td>
                                        <td><input class="input" type="number" min="0" max="24" v-model.number="r.sks"></td>
                                        <td><input type="checkbox" v-model="r.aktif" :true-value="1" :false-value="0"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.matakuliah, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.matakuliah.length"><td colspan="6"><div class="empty"><i class="bi bi-book"></i><p>Belum ada matakuliah. Klik "Tambah Matakuliah".</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="sm">Matakuliah aktif tampil di dropdown formulir pendaftaran & portal mahasiswa.</div>
                </section>

                <section v-if="tab==='kegiatan'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-diagram-3"></i> Master Kegiatan (kategori & nilai)</div>
                            <button class="btn btn-soft btn-sm" @click="addRow('kegiatan')"><i class="bi bi-plus-lg"></i> Tambah</button>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th style="width:12rem">Kategori</th><th>Nilai</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.kegiatan" :key="'kg'+(r.id||'n'+i)" :class="{'row-del': r._delete}">
                                        <td>
                                            <select class="input" v-model="r.kategori">
                                                <option v-for="k in kegiatanKategori" :value="k">{{ k }}</option>
                                            </select>
                                        </td>
                                        <td><input class="input" v-model="r.nilai" placeholder="Nilai kegiatan"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.kegiatan, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.kegiatan.length"><td colspan="3"><div class="empty"><i class="bi bi-diagram-3"></i><p>Belum ada data.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='bagian'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-people"></i> Master Bagian (pemetaan lab → bagian)</div>
                            <button class="btn btn-soft btn-sm" @click="addRow('bagian')"><i class="bi bi-plus-lg"></i> Tambah</button>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th style="width:10rem">Lab</th><th style="width:12rem">Kegiatan Lab</th><th style="width:12rem">Bagian</th><th>Email Bagian</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.bagian" :key="'bg'+(r.id||'n'+i)" :class="{'row-del': r._delete}">
                                        <td><input class="input" v-model="r.lab" placeholder="Lab A"></td>
                                        <td><input class="input" v-model="r.kegiatan_lab" placeholder="Praktikum Kimia"></td>
                                        <td><input class="input" v-model="r.bagian" placeholder="SGD"></td>
                                        <td><input class="input" v-model="r.email" placeholder="bagian@inhal.test"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.bagian, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.bagian.length"><td colspan="5"><div class="empty"><i class="bi bi-people"></i><p>Belum ada data.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="sm">Email bagian dipakai untuk pengiriman ACC final ke bagian.</div>
                </section>

                <section v-if="tab==='biaya'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-cash-coin"></i> Master Biaya per Kegiatan</div>
                            <button class="btn btn-soft btn-sm" @click="addRow('biaya')"><i class="bi bi-plus-lg"></i> Tambah</button>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th>Kegiatan</th><th style="width:12rem">Biaya (Rp)</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.biaya" :key="'by'+(r.id||'n'+i)" :class="{'row-del': r._delete}">
                                        <td><input class="input" v-model="r.kegiatan" placeholder="UTS"></td>
                                        <td><input class="input" type="number" min="0" step="500" v-model.number="r.biaya"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.biaya, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.biaya.length"><td colspan="3"><div class="empty"><i class="bi bi-cash-coin"></i><p>Belum ada data.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='mahasiswa'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-person-lines-fill"></i> Tambah / Impor Mahasiswa</div>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-2" style="margin-bottom:.9rem">
                                <div>
                                    <label class="f">NPM</label>
                                    <input class="input mono" v-model="mhsManual.npm" placeholder="Contoh: 1234567890" @keyup.enter="mhsAddManual()">
                                </div>
                                <div>
                                    <label class="f">Nama Lengkap</label>
                                    <input class="input" v-model="mhsManual.nama_lengkap" placeholder="Nama lengkap mahasiswa" @keyup.enter="mhsAddManual()">
                                </div>
                            </div>
                            <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
                                <button class="btn btn-soft" @click="mhsAddManual()"><i class="bi bi-plus-lg"></i> Tambah Baris</button>
                                <button class="btn btn-success" @click="mhsOpenFile()" :disabled="mhsImporting"><i v-if="mhsImporting" class="bi bi-hourglass-split"></i><i v-else class="bi bi-file-earmark-spreadsheet"></i> Impor dari Excel</button>
                                <input type="file" ref="mhsFile" accept=".xlsx,.xls,.csv" style="display:none" @change="mhsOnFile">
                            </div>
                            <div class="sm" style="margin-top:.8rem">
                                Excel: kolom pertama <b>NPM</b>, kolom kedua <b>Nama Lengkap</b> (baris judul diabaikan).
                                Paste juga didukung: tempel langsung ke kolom NPM di bawah dari Excel/CSV (tab/koma/baris baru).
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-people"></i> Daftar Mahasiswa</div>
                            <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
                                <span v-if="mhsInfo" class="sm" style="color:#047857;font-weight:700">{{ mhsInfo }}</span>
                                <button class="btn btn-soft btn-sm" @click="mhsClearImport()"><i class="bi bi-x-lg"></i> Bersihkan Antrean</button>
                                <button class="btn btn-soft btn-sm" @click="addRow('mahasiswa')"><i class="bi bi-plus-lg"></i> Tambah Baris Kosong</button>
                            </div>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th style="width:10rem">NPM</th><th>Nama Lengkap</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.mahasiswa" :key="'mh'+(r.id||'new'+i)" :class="{'row-del': r._delete}">
                                        <td>
                                            <input class="input mono" v-model="r.npm" placeholder="NPM" @paste="mhsOnPasteCell($event)">
                                        </td>
                                        <td><input class="input" v-model="r.nama_lengkap" placeholder="Nama lengkap"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.mahasiswa, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.mahasiswa.length"><td colspan="3"><div class="empty"><i class="bi bi-person-lines-fill"></i><p>Belum ada mahasiswa. Tambahkan lewat form di atas, impor dari Excel, atau "Tambah Baris Kosong".</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="card-body" style="padding-top:.6rem">
                            <div class="sm">Baris tanpa NPM duplikat (nama diisi) akan disimpan; NPM yang sudah ada di database otomatis dilewati. Klik <b>Simpan</b> di pojok kanan atas untuk menyimpan seluruh daftar. Nama terisi otomatis di formulir pendaftaran saat NPM dikenali.</div>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='pengguna'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-person-badge"></i> Admin</div>
                            <button class="btn btn-soft btn-sm" @click="addUser('admin')"><i class="bi bi-plus-lg"></i> Tambah Admin</button>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th>Nama</th><th>Password</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.pengguna.admin" :key="'ad'+(r.id||'n'+i)" :class="{'row-del': r._delete}">
                                        <td><input class="input" v-model="r.nama" placeholder="Nama admin"></td>
                                        <td><input class="input" type="password" v-model="r.password" placeholder="Kosongkan jika tidak diganti"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.pengguna.admin, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.pengguna.admin.length"><td colspan="3"><div class="empty"><i class="bi bi-person-badge"></i><p>Belum ada admin.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-people"></i> Staf Bagian</div>
                            <button class="btn btn-soft btn-sm" @click="addUser('staf')"><i class="bi bi-plus-lg"></i> Tambah Staf</button>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th style="width:13rem">Email</th><th style="width:8rem">Kategori</th><th>Nama</th><th>Password</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.pengguna.staf" :key="'st'+(r.id||'n'+i)" :class="{'row-del': r._delete}">
                                        <td><input class="input" type="email" v-model="r.email" placeholder="nama@inhal.test"></td>
                                        <td>
                                            <select class="input" v-model="r.kategori">
                                                <option value="">Pilih</option>
                                                <option v-for="k in ['SGD','KKD','Ujian','Praktikum']" :value="k">{{ k }}</option>
                                            </select>
                                        </td>
                                        <td><input class="input" v-model="r.nama" placeholder="Nama staf"></td>
                                        <td><input class="input" type="password" v-model="r.password" placeholder="Kosongkan jika tidak diganti"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.pengguna.staf, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.pengguna.staf.length"><td colspan="5"><div class="empty"><i class="bi bi-people"></i><p>Belum ada staf.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='email'">
                    <div class="card">
                        <div class="card-head"><div class="card-title"><i class="bi bi-server"></i> Status SMTP</div></div>
                        <div class="card-body">
                            <div class="grid grid-4">
                                <div><label class="f">Protokol</label><div class="mono">{{ c.email.smtp.protocol || '-' }}</div></div>
                                <div><label class="f">Host</label><div class="mono">{{ c.email.smtp.host || '-' }}</div></div>
                                <div><label class="f">Port</label><div class="mono">{{ c.email.smtp.port || '-' }}</div></div>
                                <div><label class="f">User</label><div class="mono">{{ c.email.smtp.user || '-' }}</div></div>
                            </div>
                            <div class="hint" style="margin-top:.6rem">Konfigurasi SMTP diambil dari app/Config/Email.php / env. Kata sandi tidak pernah ditampilkan.</div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-head"><div class="card-title"><i class="bi bi-envelope"></i> Template Email</div></div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th style="width:10rem">Kode</th><th style="width:14rem">Subjek</th><th>Isi (HTML)</th><th style="width:4rem">Aktif</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.email.templates" :key="'tp'+(r.id||'n'+i)">
                                        <td><input class="input mono" v-model="r.kode"></td>
                                        <td><input class="input" v-model="r.subjek"></td>
                                        <td><textarea class="input" v-model="r.body_html" style="min-height:3.2rem"></textarea></td>
                                        <td><input type="checkbox" v-model="r.aktif" :true-value="1" :false-value="0"></td>
                                    </tr>
                                    <tr v-if="!c.email.templates.length"><td colspan="4"><div class="empty"><i class="bi bi-envelope"></i><p>Belum ada template.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="card-body" style="padding-top:.6rem">
                            <div class="sm">Variabel yang didukung: <span class="kbd">{NAMA}</span> <span class="kbd">{NPM}</span> <span class="kbd">{STATUS}</span> <span class="kbd">{NOMOR_SURAT}</span> <span class="kbd">{CATATAN}</span></div>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='nomor'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-file-earmark-text"></i> Penomoran Surat</div>
                            <button class="btn btn-soft btn-sm" @click="addRow('nomor')"><i class="bi bi-plus-lg"></i> Tahun Baru</button>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th>Type</th><th style="width:9rem">Tahun</th><th style="width:10rem">Nomor Terakhir</th><th style="width:5rem">Hapus</th></tr></thead>
                                <tbody>
                                    <tr v-for="(r,i) in c.nomor" :key="'no'+(r.id||'n'+i)" :class="{'row-del': r._delete}">
                                        <td><input class="input mono" v-model="r.type" placeholder="INHAL"></td>
                                        <td><input class="input" type="number" min="2000" max="2100" v-model.number="r.tahun"></td>
                                        <td><input class="input" type="number" min="0" v-model.number="r.last_number"></td>
                                        <td><button class="btn btn-danger-soft btn-sm" @click="toggleDelete(c.nomor, i)"><i :class="r._delete ? 'bi bi-arrow-counterclockwise' : 'bi bi-trash'"></i></button></td>
                                    </tr>
                                    <tr v-if="!c.nomor.length"><td colspan="4"><div class="empty"><i class="bi bi-file-earmark-text"></i><p>Belum ada data.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="sm">Format: <span class="mono">0001/INHAL/2026</span> — nomor berikutnya = nomor terakhir + 1.</div>
                </section>

                <section v-if="tab==='upload'">
                    <div class="card">
                        <div class="card-head"><div class="card-title"><i class="bi bi-cloud-arrow-up"></i> Pengaturan Unggah Berkas</div></div>
                        <div class="card-body grid grid-2">
                            <div>
                                <label class="f">Batas ukuran (bytes)</label>
                                <input class="input" type="number" min="1" v-model.number="c.upload.uploadMaxBytes">
                                <div class="hint" style="margin-top:.3rem">Contoh: 5242880 = 5 MB</div>
                            </div>
                            <div>
                                <label class="f">Whitelist MIME (dipisah koma)</label>
                                <input class="input" v-model="uploadMimeText" placeholder="application/pdf, image/jpeg">
                                <div class="hint" style="margin-top:.3rem">MIME whitelist untuk bukti & BA.</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='status'">
                    <div class="card">
                        <div class="card-head"><div class="card-title"><i class="bi bi-arrow-repeat"></i> Alur Status Pengajuan</div></div>
                        <div class="card-body">
                            <div class="grid grid-2">
                                <div>
                                    <label class="f">Daftar status (tetap)</label>
                                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.45rem">
                                        <span v-for="s in statusAll" :key="'ss'+s" class="chip-check is-on"><i class="bi bi-lock-fill"></i>{{ s }}</span>
                                    </div>
                                    <div class="hint" style="margin-top:.5rem">Status inti tidak dapat diubah; hanya dijadikan referensi.</div>
                                </div>
                                <div>
                                    <label class="f">Status BA bagian yang diizinkan</label>
                                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.45rem">
                                        <span v-for="s in statusAll" :key="'bs'+s" class="chip-check" :class="{'is-on': c.status.bagianBaStatuses.indexOf(s)>=0}" @click="toggleIn(c.status.bagianBaStatuses, s)">
                                            <i :class="c.status.bagianBaStatuses.indexOf(s)>=0 ? 'bi bi-check-circle-fill' : 'bi bi-circle'"></i>{{ s }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top:1.25rem">
                                <label class="f">Peran yang dapat mengubah ke status</label>
                                <div class="table-scroll">
                                    <table class="list">
                                        <thead><tr><th>Status</th><th>Sistem</th><th>Admin</th><th>Bagian</th></tr></thead>
                                        <tbody>
                                            <tr v-for="s in statusAll" :key="'sr'+s">
                                                <td><span class="badge" :class="badgeStatus(s)">{{ s }}</span></td>
                                                <td><input type="checkbox" :checked="rolesHas(s,'sistem')" @change="rolesToggle(s,'sistem', $event.target.checked)"></td>
                                                <td><input type="checkbox" :checked="rolesHas(s,'admin')" @change="rolesToggle(s,'admin', $event.target.checked)"></td>
                                                <td><input type="checkbox" :checked="rolesHas(s,'bagian')" @change="rolesToggle(s,'bagian', $event.target.checked)"></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section v-if="tab==='audit'">
                    <div class="card">
                        <div class="card-head">
                            <div class="card-title"><i class="bi bi-clock-history"></i> Audit Log</div>
                            <button class="btn btn-soft btn-sm" @click="loadTab('audit', true)"><i class="bi bi-arrow-clockwise"></i> Muat Ulang</button>
                        </div>
                        <div class="card-body">
                            <div class="sm" style="margin-bottom:.7rem">Jumlah baris per tabel:</div>
                            <div style="display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:1rem">
                                <span v-for="(v,k) in c.audit.counts" :key="k" class="chip-check"><i class="bi bi-table"></i>{{ k }}: <b style="margin-left:.25rem">{{ v }}</b></span>
                            </div>
                        </div>
                        <div class="table-scroll">
                            <table class="list">
                                <thead><tr><th style="width:10rem">Waktu</th><th style="width:8rem">Pelaku</th><th style="width:10rem">Aksi</th><th style="width:10rem">Target</th><th>Detail</th></tr></thead>
                                <tbody>
                                    <tr v-for="(l,i) in c.audit.logs" :key="'log'+i">
                                        <td class="mono">{{ l.timestamp }}</td>
                                        <td>{{ l.actor_email || '-' }}</td>
                                        <td><span class="kbd">{{ l.aksi || '-' }}</span></td>
                                        <td>{{ l.target || '-' }}</td>
                                        <td>{{ l.detail || '' }}</td>
                                    </tr>
                                    <tr v-if="!c.audit.logs.length"><td colspan="5"><div class="empty"><i class="bi bi-clock-history"></i><p>Belum ada aktivitas tercatat.</p></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </template>
        </template>
    </div>

    <transition name="fade">
        <div v-if="toast.show" class="toast" :class="'toast-'+toast.type">
            <i :class="toast.type==='success' ? 'bi bi-check-circle-fill' : (toast.type==='error' ? 'bi bi-x-circle-fill' : 'bi bi-info-circle-fill')"></i>{{ toast.message }}
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
        if (!res.ok || !data.ok) {
            throw new Error((data && data.message) || 'Terjadi kesalahan server.');
        }
        return data;
    }

    const STATUS_ALL = ['Menunggu', 'Diterima', 'Ditolak', 'ACC', 'Dibatalkan'];

    createApp({
        data() {
            return {
                loggedIn: false,
                loading: false,
                saving: false,
                loginPwd: '',
                loginError: '',
                tab: 'matakuliah',
                statusAll: STATUS_ALL,
                kegiatanKategori: ['Blok', 'Ujian', 'SGD', 'Detail SGD', 'KKD', 'Detail KKD', 'Lab', 'Kegiatan Lab', 'Dosen', 'Matakuliah'],
                c: {
                    umum: { appName: '', timezone: '', buktiMode: 'strict', bagianBaStatuses: [], bagianBaFinalOnly: 0 },
                    matakuliah: [],
                    kegiatan: [],
                    bagian: [],
                    biaya: [],
                    mahasiswa: [],
                    pengguna: { admin: [], staf: [] },
                    email: { templates: [], smtp: {} },
                    nomor: [],
                    upload: { uploadMaxBytes: 5242880, uploadMimeWhitelist: [] },
                    status: { statuses: [], bagianBaStatuses: [], statusRoles: {} },
                    audit: { logs: [], counts: {} }
                },
                mhsManual: { npm: '', nama_lengkap: '' },
                mhsInfo: '',
                mhsImporting: false,
                loaded: {},
                toast: { show: false, type: 'info', message: '' },
                toastTimer: null
            };
        },
        computed: {
            uploadMimeText: {
                get() {
                    return (this.c.upload.uploadMimeWhitelist || []).join(', ');
                },
                set(v) {
                    this.c.upload.uploadMimeWhitelist = v.split(',').map(s => s.trim()).filter(Boolean);
                }
            }
        },
        methods: {
            toastShow(type, message) {
                this.toast = { show: true, type: type, message: message };
                clearTimeout(this.toastTimer);
                this.toastTimer = setTimeout(() => { this.toast.show = false; }, 3200);
            },
            badgeStatus(s) {
                return 'st-' + s.toLowerCase();
            },
            async doLogin() {
                if (!this.loginPwd) {
                    this.loginError = 'Masukkan password admin.';
                    return;
                }
                this.loginError = '';
                this.saving = true;
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
                    window.location.reload();
                } catch (e) {
                    this.loginError = 'Tidak dapat terhubung ke server.';
                } finally {
                    this.saving = false;
                }
            },
            async boot() {
                this.loading = true;
                try {
                    const res = await apiFetch('GET', 'pengaturan/umum');
                    this.loggedIn = true;
                    this.loaded.umum = true;
                    this.c.umum = Object.assign(this.c.umum, res.data);
                    await this.loadTab('matakuliah');
                } catch (e) {
                    this.loggedIn = false;
                } finally {
                    this.loading = false;
                }
            },
            async setTab(name) {
                this.tab = name;
                if (name === 'audit') {
                    await this.loadTab('audit', true);
                } else if (!this.loaded[name]) {
                    await this.loadTab(name);
                }
            },
            async loadTab(name, force) {
                if (force) this.loaded[name] = false;
                if (this.loaded[name]) return;
                this.loading = true;
                try {
                    const res = await apiFetch('GET', 'pengaturan/' + this.sectionFor(name));
                    const d = res.data;
                    if (name === 'umum') this.c.umum = Object.assign(this.c.umum, d);
                    else if (name === 'kegiatan') this.c.kegiatan = this.rowsOf(d);
                    else if (name === 'matakuliah') this.c.matakuliah = this.rowsOf(d);
                    else if (name === 'bagian') this.c.bagian = this.rowsOf(d);
                    else if (name === 'biaya') this.c.biaya = this.rowsOf(d);
                    else if (name === 'mahasiswa') this.c.mahasiswa = this.rowsOf(d);
                    else if (name === 'pengguna') this.c.pengguna = d;
                    else if (name === 'email') this.c.email = d;
                    else if (name === 'nomor') this.c.nomor = this.rowsOf(d);
                    else if (name === 'upload') this.c.upload = d;
                    else if (name === 'status') this.c.status = d;
                    else if (name === 'audit') this.c.audit = d;
                    this.loaded[name] = true;
                } catch (e) {
                    this.toastShow('error', e.message);
                    if (/sesi|login/i.test(e.message)) window.location.href = '/login';
                } finally {
                    this.loading = false;
                }
            },
            sectionFor(name) {
                return { matakuliah: 'matakuliah', kegiatan: 'kegiatan', bagian: 'bagian', biaya: 'biaya', mahasiswa: 'mahasiswa', pengguna: 'pengguna', email: 'email', nomor: 'nomor-surat', upload: 'upload', status: 'status', audit: 'audit', umum: 'umum' }[name] || name;
            },
            rowsOf(d) {
                return (d || []).map(r => Object.assign({}, r));
            },
            addRow(tab) {
                let empty = {};
                if (tab === 'matakuliah') empty = { kode: '', nama: '', blok: '', sks: null, aktif: 1 };
                else if (tab === 'kegiatan') empty = { kategori: 'SGD', nilai: '' };
                else if (tab === 'bagian') empty = { lab: '', kegiatan_lab: '', bagian: '', email: '' };
                else if (tab === 'biaya') empty = { kegiatan: '', biaya: 0 };
                else if (tab === 'mahasiswa') empty = { npm: '', nama_lengkap: '' };
                else if (tab === 'nomor') empty = { type: 'INHAL', tahun: new Date().getFullYear(), last_number: 0 };
                this.c[tab].push(empty);
            },
            toggleDelete(list, i) {
                const row = list[i];
                if (row._delete) {
                    delete row._delete;
                } else if (row.id) {
                    row._delete = true;
                } else {
                    list.splice(i, 1);
                }
            },
            addUser(kind) {
                if (kind === 'admin') this.c.pengguna.admin.push({ nama: '', password: '' });
                else this.c.pengguna.staf.push({ email: '', kategori: 'SGD', nama: '', password: '' });
            },
            toggleIn(arr, v) {
                const i = arr.indexOf(v);
                if (i >= 0) arr.splice(i, 1);
                else arr.push(v);
            },
            rolesHas(s, role) {
                return (this.c.status.statusRoles[s] || []).indexOf(role) >= 0;
            },
            rolesToggle(s, role, on) {
                const arr = this.c.status.statusRoles[s] || (this.c.status.statusRoles[s] = []);
                const i = arr.indexOf(role);
                if (on && i < 0) arr.push(role);
                if (!on && i >= 0) arr.splice(i, 1);
            },
            clean(items) {
                return (items || []).filter(r => {
                    if (r._delete) return r.id ? true : false;
                    return Object.values(r).some(v => v !== '' && v !== null && v !== undefined);
                }).map(r => {
                    const o = Object.assign({}, r);
                    if (o._delete && !o.id) delete o._delete;
                    return o;
                });
            },
            mhsNpmOk(npm) {
                return /^[A-Za-z0-9][A-Za-z0-9.\-_]{0,19}$/.test(npm);
            },
            mhsKey(npm) {
                return String(npm || '').trim().toLowerCase();
            },
            mhsNpmTaken(npm, skipIndex) {
                const k = this.mhsKey(npm);
                return this.c.mahasiswa.some((r, i) => i !== skipIndex && !r._delete && this.mhsKey(r.npm) === k);
            },
            mhsAddManual() {
                const npm = String(this.mhsManual.npm || '').trim();
                const nama = String(this.mhsManual.nama_lengkap || '').trim();
                if (!npm || !nama) {
                    this.toastShow('error', 'Isi NPM dan Nama Lengkap dulu.');
                    return;
                }
                if (!this.mhsNpmOk(npm)) {
                    this.toastShow('error', 'Format NPM tidak valid: ' + npm);
                    return;
                }
                if (this.mhsNpmTaken(npm)) {
                    this.toastShow('error', 'NPM ' + npm + ' sudah ada di daftar.');
                    return;
                }
                this.c.mahasiswa.push({ npm: npm, nama_lengkap: nama });
                this.mhsManual = { npm: '', nama_lengkap: '' };
                this.mhsInfo = '';
                this.toastShow('success', npm + ' ditambahkan ke daftar. Klik Simpan untuk menyimpan.');
            },
            mhsOpenFile() {
                this.$refs.mhsFile.click();
            },
            async mhsOnFile(ev) {
                const file = ev.target.files && ev.target.files[0];
                ev.target.value = '';
                if (!file) return;
                const isExcel = /\.(xlsx|xls)$/i.test(file.name);
                this.mhsImporting = true;
                try {
                    let rows;
                    if (isExcel) {
                        await this._loadXlsx();
                        const buf = await file.arrayBuffer();
                        const wb = XLSX.read(buf, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
                        rows = aoa.map(row => row.map(c => String(c == null ? '' : c).trim()));
                    } else {
                        const txt = await file.text();
                        rows = this._mhsSplitText(txt);
                    }
                    this._mhsMergeRows(rows, 'Impor dari ' + file.name);
                } catch (e) {
                    this.toastShow('error', 'Gagal membaca file: ' + (e && e.message || 'format tidak didukung.'));
                } finally {
                    this.mhsImporting = false;
                }
            },
            mhsOnPasteCell(ev) {
                const text = (ev.clipboardData || window.clipboardData).getData('text');
                if (!text || !/[\t\r\n]/.test(text)) return;
                ev.preventDefault();
                this._mhsMergeRows(this._mhsSplitText(text), 'Tempelan (paste)');
            },
            _mhsSplitText(text) {
                return String(text || '').split(/\r?\n/).map(line => {
                    const l = String(line || '');
                    let sep = '\t';
                    if (l.indexOf('\t') === -1) sep = l.indexOf(',') >= 0 ? ',' : (l.indexOf(';') >= 0 ? ';' : ',');
                    return l.split(sep).map(c => String(c == null ? '' : c).replace(/^["']|["']$/g, '').trim());
                }).filter(cells => cells.some(c => c !== ''));
            },
            _mhsIsHeader(cells) {
                const a = String(cells[0] || '').toLowerCase();
                const b = String(cells[1] || '').toLowerCase();
                return /^(npm|nim|no|nomor)$/.test(a) || /nama/.test(a) || /nama/.test(b);
            },
            _mhsMergeRows(rows, sumber) {
                let diabaikan = 0;
                let ditambah = 0;
                const skipNpm = [];
                let first = true;
                const pendek = [];
                rows.forEach(cells => {
                    if (first) {
                        first = false;
                        if (this._mhsIsHeader(cells)) return;
                    }
                    let npm = String(cells[0] || '').trim();
                    const nama = String(cells[1] || '').trim();
                    if (!npm && !nama) return;
                    if (!npm && nama) {
                        diabaikan++;
                        pendek.push('(NPM kosong)');
                        return;
                    }
                    if (npm && !nama) {
                        diabaikan++;
                        pendek.push(npm);
                        return;
                    }
                    if (!this.mhsNpmOk(npm)) {
                        diabaikan++;
                        pendek.push(npm);
                        return;
                    }
                    if (this.mhsNpmTaken(npm)) {
                        diabaikan++;
                        skipNpm.push(npm);
                        return;
                    }
                    this.c.mahasiswa.push({ npm: npm, nama_lengkap: nama });
                    ditambah++;
                });
                const pesan = sumber + ': ' + ditambah + ' baris valid ditambahkan ke daftar, ' + diabaikan + ' dilewati.';
                this.mhsInfo = pesan;
                if (ditambah) {
                    this.toastShow('success', pesan + ' Klik Simpan untuk menyimpan.');
                } else {
                    let alas = 'NPM sudah ada.';
                    if (skipNpm.length) alas = 'NPM sudah ada: ' + skipNpm.slice(0, 3).join(', ') + (skipNpm.length > 3 ? ', …' : '');
                    else if (pendek.length) alas = 'Baris tidak lengkap / format salah.';
                    this.toastShow('info', 'Tidak ada baris baru. ' + alas);
                }
            },
            mhsClearImport() {
                const before = this.c.mahasiswa.length;
                this.c.mahasiswa = this.c.mahasiswa.filter(r => r.id);
                const removed = before - this.c.mahasiswa.length;
                this.mhsInfo = removed ? removed + ' baris antrean dibersihkan.' : '';
                if (removed) this.toastShow('info', this.mhsInfo);
            },
            _loadXlsx() {
                return new Promise((resolve, reject) => {
                    if (window.XLSX) return resolve();
                    const s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                    s.onload = () => resolve();
                    s.onerror = () => reject(new Error('Gagal memuat library Excel.'));
                    document.head.appendChild(s);
                });
            },
            async saveActive() {
                this.saving = true;
                try {
                    const tab = this.tab;
                    const c = this.c;
                    let path = this.sectionFor(tab);
                    let payload;
                    if (tab === 'umum') {
                        payload = {
                            appName: c.umum.appName,
                            timezone: c.umum.timezone,
                            buktiMode: c.umum.buktiMode,
                            bagianBaStatuses: c.umum.bagianBaStatuses,
                            bagianBaFinalOnly: c.umum.bagianBaFinalOnly
                        };
                    } else if (tab === 'pengguna') {
                        payload = { items: [].concat(
                            this.clean(c.pengguna.admin).map(r => Object.assign({ kind: 'admin' }, r)),
                            this.clean(c.pengguna.staf).map(r => Object.assign({ kind: 'staf' }, r))
                        ) };
                    } else if (tab === 'email') {
                        payload = { items: this.clean(c.email.templates) };
                    } else if (tab === 'upload') {
                        payload = {
                            uploadMaxBytes: c.upload.uploadMaxBytes,
                            uploadMimeWhitelist: c.upload.uploadMimeWhitelist
                        };
                    } else if (tab === 'status') {
                        payload = { bagianBaStatuses: c.status.bagianBaStatuses, statusRoles: c.status.statusRoles };
                    } else if (tab === 'nomor') {
                        payload = { items: this.clean(c.nomor) };
                    } else {
                        payload = { items: this.clean(c[tab]) };
                    }
                    const res = await apiFetch('PUT', 'pengaturan/' + path, payload);
                    const d = res.data;
                    if (tab === 'kegiatan') this.c.kegiatan = this.rowsOf(d);
                    else if (tab === 'matakuliah') this.c.matakuliah = this.rowsOf(d);
                    else if (tab === 'bagian') this.c.bagian = this.rowsOf(d);
                    else if (tab === 'biaya') this.c.biaya = this.rowsOf(d);
                    else if (tab === 'mahasiswa') {
                        this.c.mahasiswa = this.rowsOf(d.list);
                        this.mhsInfo = '';
                        this.mhsManual = { npm: '', nama_lengkap: '' };
                    }
                    else if (tab === 'nomor') this.c.nomor = this.rowsOf(d);
                    else if (tab === 'umum') this.c.umum = Object.assign(this.c.umum, d);
                    else if (tab === 'pengguna') this.c.pengguna = d;
                    else if (tab === 'email') this.c.email = d;
                    else if (tab === 'upload') this.c.upload = d;
                    else if (tab === 'status') this.c.status = d;
                    let okMsg = 'Pengaturan ' + this.labelFor(tab) + ' disimpan.';
                    if (tab === 'mahasiswa') {
                        const added = Number(d.added) || 0;
                        const skipped = d.skipped || [];
                        if (skipped.length) {
                            const ex = skipped.slice(0, 3).map(s => s.npm).join(', ');
                            okMsg = added + ' mahasiswa ditambahkan, ' + skipped.length + ' dilewati (duplikat): ' + ex + (skipped.length > 3 ? ', …' : '');
                        } else if (added > 0) {
                            okMsg = added + ' mahasiswa ditambahkan.';
                        }
                    }
                    this.toastShow('success', okMsg);
                } catch (e) {
                    this.toastShow('error', e.message);
                    if (/sesi|login/i.test(e.message)) window.location.href = '/login';
                } finally {
                    this.saving = false;
                }
            },
            labelFor(tab) {
                return { umum: 'Umum', matakuliah: 'Matakuliah', kegiatan: 'Master Kegiatan', bagian: 'Master Bagian', biaya: 'Master Biaya', mahasiswa: 'Mahasiswa', pengguna: 'Pengguna', email: 'Email', nomor: 'Nomor Surat', upload: 'Upload', status: 'Alur Status', audit: 'Audit' }[tab] || tab;
            }
        },
        mounted() {
            this.boot();
        }
    }).mount('#app');
</script>
</body>
</html>
