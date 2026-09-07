<?php

namespace App\Controllers\Api;

use App\Libraries\AuthService;
use App\Libraries\UploadService;
use App\Models\BeritaAcaraAdminModel;
use App\Models\BeritaAcaraAdminPesertaModel;
use App\Models\MasterKegiatanModel;

class BeritaAcaraApi extends BaseApi
{
    public function index()
    {
        $this->requireAdmin();
        $baModel = new BeritaAcaraAdminModel();
        $rows = $baModel->orderBy('timestamp', 'DESC')->findAll();
        $pesertaAll = (new BeritaAcaraAdminPesertaModel())
            ->whereIn('ba_id', array_column($rows, 'ba_id') ?: [''])
            ->orderBy('npm', 'ASC')
            ->findAll();
        $pesertaMap = [];
        foreach ($pesertaAll as $p) {
            $pesertaMap[$p['ba_id']][] = [
                'npm'             => $p['npm'],
                'namaLengkap'     => $p['nama_lengkap'],
                'blok'            => $p['blok'],
                'statusPengajuan' => $p['status_pengajuan'],
            ];
        }
        $list = [];
        $jumlahPeserta = 0;
        foreach ($rows as $r) {
            $list[] = [
                'baId'               => $r['ba_id'],
                'bagian'             => $r['bagian'],
                'blok'               => $r['blok'],
                'namaKegiatan'       => $r['nama_kegiatan'],
                'tanggalPelaksanaan' => $this->dateOnly($r['tanggal_pelaksanaan']),
                'jumlahPeserta'      => (int) $r['jumlah_peserta'],
                'file_name'          => $r['file_name'],
                'file_path'          => $r['file_path'],
                'catatan'            => $r['catatan'],
                'sumber'             => $r['sumber'],
                'timestamp'          => $r['timestamp'],
                'peserta'            => $pesertaMap[$r['ba_id']] ?? [],
            ];
            $jumlahPeserta += (int) $r['jumlah_peserta'];
        }

        return $this->respondOk([
            'list'    => $list,
            'summary' => [
                'jumlahBa'       => count($list),
                'jumlahPeserta'  => $jumlahPeserta,
                'terakhir'       => isset($rows[0]['timestamp']) ? $rows[0]['timestamp'] : null,
            ],
        ]);
    }

    public function options()
    {
        $this->requireAdmin();
        $db = db_connect();
        $rows = $db->table('detail_kegiatan d')
            ->select("d.id_pengajuan AS idPengajuan, p.npm, p.nama_lengkap AS namaLengkap, p.blok, p.status, d.jenis_kegiatan AS jenis, d.pilihan, d.detail, d.tanggal_pelaksanaan AS tanggal")
            ->join('pengajuan p', 'p.id_pengajuan = d.id_pengajuan')
            ->orderBy('p.npm', 'ASC')
            ->get()->getResultArray();

        $blokList = [];
        $blokSeen = [];
        $groups = [];
        $groupMap = [];
        $groupSeen = [];
        foreach ($rows as $r) {
            $blok = trim((string) $r['blok']);
            if ($blok !== '' && !isset($blokSeen[$this->normKey($blok)])) {
                $blokSeen[$this->normKey($blok)] = true;
                $blokList[] = $blok;
            }
            $jenis = trim((string) $r['jenis']);
            $pilihan = trim((string) $r['pilihan']);
            $detail = trim((string) $r['detail']);
            if ($jenis === '' && $pilihan === '' && $detail === '') {
                continue;
            }
            $key = $this->normKey($blok) . '|' . $this->normKey($jenis) . '|' . $this->normKey($pilihan) . '|' . $this->normKey($detail);
            if (!isset($groupMap[$key])) {
                $nama = $pilihan . ($detail !== '' ? ' - ' . $detail : '');
                $groupMap[$key] = count($groups);
                $groupSeen[$key] = [];
                $groups[] = [
                    'key'          => $key,
                    'blok'         => $blok,
                    'jenis'        => $jenis,
                    'pilihan'      => $pilihan,
                    'detail'       => $detail,
                    'tanggal'      => $this->dateOnly($r['tanggal']),
                    'nama'         => $nama,
                    'label'        => ($jenis !== '' ? $jenis : 'Lainnya') . ' — ' . ($nama !== '' ? $nama : '-'),
                    'peserta'      => [],
                ];
            }
            $idx = $groupMap[$key];
            if (isset($groupSeen[$key][$r['idPengajuan']])) {
                continue;
            }
            $groupSeen[$key][$r['idPengajuan']] = true;
            $groups[$idx]['peserta'][] = [
                'idPengajuan'     => $r['idPengajuan'],
                'npm'             => $r['npm'],
                'namaLengkap'     => $r['namaLengkap'],
                'blok'            => $r['blok'],
                'statusPengajuan' => trim((string) $r['status']),
            ];
        }
        usort($blokList, static fn ($a, $b) => strcmp($a, $b));

        return $this->respondOk([
            'blok'     => $blokList,
            'labs'     => (new MasterKegiatanModel())->valuesFor('Lab'),
            'bagian'   => ['Admin', 'SGD', 'KKD', 'Ujian', 'Praktikum'],
            'groups'   => $groups,
        ]);
    }

    public function store()
    {
        $this->requireAdmin();
        $req = $this->request;

        $namaKegiatan = trim((string) $req->getPost('namaKegiatan'));
        $blok = trim((string) $req->getPost('blok'));
        $tanggal = substr(trim((string) $req->getPost('tanggalPelaksanaan')), 0, 10);
        $pesertaRaw = $req->getPost('peserta') ?? '[]';
        $peserta = json_decode($pesertaRaw, true);
        if (!is_array($peserta)) {
            $peserta = [];
        }
        if ($namaKegiatan === '' || $blok === '' || $tanggal === '' || count($peserta) === 0) {
            return $this->respondValidation(['ba' => 'Data BA belum lengkap (nama kegiatan, blok, tanggal, peserta).']);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
            return $this->respondValidation(['tanggalPelaksanaan' => 'Tanggal pelaksanaan tidak valid.']);
        }

        $rows = $this->allDetailRows();
        $group = [];
        foreach ($rows as $r) {
            if ($this->namaKegiatanOf($r) === $namaKegiatan && trim((string) $r['blok']) === $blok) {
                $group[] = $r;
            }
        }
        if (!$group) {
            return $this->respondErr('Kegiatan tidak ditemukan pada data pengajuan.', 404);
        }

        $validPeserta = [];
        $seen = [];
        foreach ($peserta as $p) {
            $id = trim((string) ($p['idPengajuan'] ?? ''));
            if ($id === '' || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $match = null;
            foreach ($group as $r) {
                if ($r['idPengajuan'] === $id) {
                    $match = $r;
                    break;
                }
            }
            if (!$match) {
                return $this->respondErr('Ada peserta yang tidak sesuai dengan kegiatan terpilih.', 409);
            }
            $validPeserta[] = [
                'idPengajuan'     => $id,
                'npm'             => $match['npm'],
                'namaLengkap'     => $match['namaLengkap'],
                'blok'            => $match['blok'],
                'statusPengajuan' => trim((string) $match['status']),
            ];
        }
        if (!$validPeserta) {
            return $this->respondErr('Upload dibatalkan: tidak ada peserta pada berita acara ini. Pilih minimal satu peserta.', 409);
        }

        $bagian = trim((string) $req->getPost('bagian'));
        $baModel = new BeritaAcaraAdminModel();
        $baId = inhal_id('BA');
        $now = date('Y-m-d H:i:s');
        $saved = ['file_name' => null, 'file_path' => null];
        $file = $req->getFile('file');
        if ($file && $file->isValid()) {
            $res = (new UploadService())->store('ba', $baId, $file);
            if (!$res['ok']) {
                return $this->respondErr($res['message']);
            }
            $saved = ['file_name' => $res['file_name'], 'file_path' => $res['path']];
        }

        $db = db_connect();
        $db->transStart();
        $baModel->insert([
            'timestamp'           => $now,
            'ba_id'               => $baId,
            'bagian'              => $bagian !== '' ? $bagian : 'Admin',
            'blok'                => $blok,
            'nama_kegiatan'       => $namaKegiatan,
            'tanggal_pelaksanaan' => $tanggal,
            'jumlah_peserta'      => count($validPeserta),
            'file_name'           => $saved['file_name'],
            'file_path'           => $saved['file_path'],
            'catatan'             => trim((string) $req->getPost('catatan')),
            'sumber'              => 'Admin',
        ]);
        $bp = new BeritaAcaraAdminPesertaModel();
        foreach ($validPeserta as $vp) {
            $bp->insert([
                'timestamp'        => $now,
                'ba_id'            => $baId,
                'npm'              => $vp['npm'],
                'nama_lengkap'     => $vp['namaLengkap'],
                'blok'             => $vp['blok'],
                'bagian'           => $bagian !== '' ? $bagian : 'Admin',
                'status_pengajuan' => $vp['statusPengajuan'],
            ]);
        }
        $db->transComplete();
        if (!$db->transStatus()) {
            return $this->respondErr('Gagal menyimpan berita acara.', 500);
        }

        audit_log_add($this->actor(), 'BA_ADMIN_UPLOAD', $baId, $namaKegiatan . ' | ' . $tanggal);

        return $this->respondOk(['baId' => $baId, 'message' => 'Berita acara berhasil diunggah.']);
    }

    public function delete(string $id)
    {
        $this->requireAdmin();
        $baModel = new BeritaAcaraAdminModel();
        $ba = $baModel->where('ba_id', $id)->first();
        if (!$ba) {
            return $this->respondErr('Berita acara tidak ditemukan.', 404);
        }
        $baModel->delete($ba['id']);
        audit_log_add($this->actor(), 'BA_ADMIN_DELETE', $ba['ba_id'], 'hapus BA beserta peserta');

        return $this->respondOk(['message' => 'Berita acara berhasil dihapus.']);
    }

    public function bypassStart()
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];
        $kategori = trim((string) ($r['kategori'] ?? ''));
        $subBagian = trim((string) ($r['subBagian'] ?? ''));
        $res = (new AuthService())->adminBagianBypass($kategori, $subBagian);
        if (!$res['ok']) {
            return $this->respondErr($res['message'], 400);
        }

        return $this->respondOk(['message' => 'Sesi bagian aktif sebagai ' . $res['nama'], 'kategori' => $kategori, 'subBagian' => $subBagian]);
    }

    public function bypassEnd()
    {
        $this->requireAdmin();
        session()->remove('bab_session');

        return $this->respondOk(['message' => 'Sesi bagian diakhiri.']);
    }

    private function allDetailRows(): array
    {
        return db_connect()->table('detail_kegiatan d')
            ->select("d.id_pengajuan AS idPengajuan, p.npm, p.nama_lengkap AS namaLengkap, p.blok, p.status, d.jenis_kegiatan AS jenis, d.pilihan, d.detail")
            ->join('pengajuan p', 'p.id_pengajuan = d.id_pengajuan')
            ->get()->getResultArray();
    }

    private function namaKegiatanOf(array $r): string
    {
        $label = trim((string) $r['pilihan']);
        if (trim((string) $r['detail']) !== '') {
            $label .= ' - ' . trim((string) $r['detail']);
        }

        return $label;
    }

    private function dateOnly($v): string
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', (string) $v, $m)) {
            return $m[1] . '-' . $m[2] . '-' . $m[3];
        }

        return '';
    }

    private function normKey($v): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', (string) $v));
    }

    private function actor(): string
    {
        return (string) ((new AuthService())->sessionAuth()['nama'] ?? 'admin');
    }
}
