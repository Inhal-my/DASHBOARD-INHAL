<?php

namespace App\Controllers\Api;

use App\Libraries\AuthService;
use App\Libraries\BiayaService;
use App\Models\BeritaAcaraModel;
use App\Models\BeritaAcaraPesertaModel;
use App\Models\CheckDataModel;
use App\Models\DetailKegiatanModel;
use App\Models\MasterBiayaModel;
use App\Models\MasterKegiatanModel;
use App\Models\PengajuanModel;
use App\Models\StatusHistoryModel;

class LaporanApi extends BaseApi
{
    private const CATEGORIES = ['Ujian', 'SGD', 'KKD'];

    public function bootstrap()
    {
        $this->requireAdmin();

        $pengajuan = (new PengajuanModel())->orderBy('timestamp', 'DESC')->findAll();
        $ids = array_map(static fn ($p) => (int) $p['id'], $pengajuan);
        $biayaMap = (new BiayaService())->allMapped();
        $overrideMap = $this->overrideMap($ids);
        $detailsByPengajuan = $this->loadDetailMap($pengajuan);
        $historyByPengajuan = $this->loadHistoryMap($pengajuan);
        $labs = (new MasterKegiatanModel())->valuesFor('Lab');

        $rows = [];
        foreach ($pengajuan as $p) {
            $details = $detailsByPengajuan[$p['id_pengajuan']] ?? [];
            $kegiatan = $this->biayaKegiatanOf($p, $details, $biayaMap);
            $override = $overrideMap[$p['id']] ?? null;
            $resolved = $override !== null
                ? (float) $override
                : ($kegiatan !== null && isset($biayaMap[$kegiatan]) ? (float) $biayaMap[$kegiatan] : 0.0);
            $rows[] = [
                'pengajuan' => $this->clientPengajuanRow($p, $resolved, $override),
                'details'   => array_map([$this, 'clientDetailRow'], $details),
                'history'   => array_map([$this, 'clientHistoryRow'], $historyByPengajuan[$p['id_pengajuan']] ?? []),
            ];
        }

        $beritaAcara = $this->aggregateBeritaAcara();
        $dosen = $this->uniqueDosen($pengajuan);
        $blok = $this->uniqueBlok($pengajuan, $beritaAcara);
        $masterBiaya = (new MasterBiayaModel())->orderBy('biaya', 'ASC')->findAll();

        return $this->respondOk([
            'summary'      => $this->computeSummary($rows),
            'rows'         => $rows,
            'beritaAcara'  => $beritaAcara,
            'dosen'        => $dosen,
            'blok'         => $blok,
            'kategori'     => self::CATEGORIES,
            'bagian'       => [
                'categories' => self::CATEGORIES,
                'labs'       => $labs,
            ],
            'masterBiaya'  => array_map(static fn ($m) => ['kegiatan' => $m['kegiatan'], 'biaya' => (float) $m['biaya']], $masterBiaya),
        ]);
    }

    private function loadDetailMap(array $pengajuan): array
    {
        $map = [];
        if ($pengajuan === []) {
            return $map;
        }
        $rows = (new DetailKegiatanModel())
            ->whereIn('id_pengajuan', array_column($pengajuan, 'id_pengajuan'))
            ->orderBy('timestamp', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
        foreach ($rows as $d) {
            $map[$d['id_pengajuan']][] = $d;
        }
        return $map;
    }

    private function loadHistoryMap(array $pengajuan): array
    {
        $map = [];
        if ($pengajuan === []) {
            return $map;
        }
        $rows = (new StatusHistoryModel())
            ->whereIn('id_pengajuan', array_column($pengajuan, 'id_pengajuan'))
            ->orderBy('timestamp', 'ASC')
            ->findAll();
        foreach ($rows as $h) {
            $map[$h['id_pengajuan']][] = $h;
        }
        return $map;
    }

    private function overrideMap(array $ids): array
    {
        $map = [];
        if ($ids === []) {
            return $map;
        }
        $rows = (new CheckDataModel())
            ->where('detail', 'BIAYA-OVERRIDE')
            ->whereIn('pengajuan_id', $ids)
            ->findAll();
        foreach ($rows as $r) {
            if ($r['biaya'] !== null) {
                $map[$r['pengajuan_id']] = (float) $r['biaya'];
            }
        }
        return $map;
    }

    private function aggregateBeritaAcara(): array
    {
        $baModel = new BeritaAcaraModel();
        $baRows = $baModel->orderBy('timestamp', 'DESC')->findAll();
        $pesertaAll = [];
        if ($baRows !== []) {
            $pesertaAll = (new BeritaAcaraPesertaModel())
                ->whereIn('ba_id', array_column($baRows, 'ba_id'))
                ->orderBy('id', 'ASC')
                ->findAll();
        }

        $out = [];
        foreach ($baRows as $r) {
            $out[] = [
                'baId'               => $r['ba_id'],
                'bagian'             => $r['bagian'],
                'blok'               => $r['blok'],
                'namaKegiatan'       => $r['nama_kegiatan'],
                'tanggalPelaksanaan' => $this->dateOnly($r['tanggal_pelaksanaan']),
                'jumlahPeserta'      => (int) $r['jumlah_peserta'],
                'fileUrl'            => '',
                'fileName'           => $r['file_name'],
                'catatan'            => $r['catatan'],
                'sumber'             => $r['sumber'] !== '' ? $r['sumber'] : 'Bagian',
                'timestamp'          => $r['timestamp'],
                'peserta'            => $this->pesertaRows($pesertaAll, $r['ba_id']),
            ];
        }
        return $out;
    }

    private function pesertaRows(array $pesertaAll, string $baId): array
    {
        $out = [];
        foreach ($pesertaAll as $p) {
            if ($p['ba_id'] === $baId) {
                $out[] = [
                    'npm'         => $p['npm'],
                    'namaLengkap' => $p['nama_lengkap'],
                    'blok'        => $p['blok'],
                ];
            }
        }
        return $out;
    }

    private function uniqueDosen(array $pengajuan): array
    {
        $list = [];
        $seen = [];
        foreach ($pengajuan as $p) {
            $v = $this->normalize($p['dosen'] ?? '');
            $key = strtolower($v);
            if ($v !== '' && !isset($seen[$key])) {
                $seen[$key] = true;
                $list[] = $v;
            }
        }
        usort($list, static fn ($a, $b) => strcmp(strtolower($a), strtolower($b)));
        return $list;
    }

    private function uniqueBlok(array $pengajuan, array $beritaAcara): array
    {
        $list = [];
        $seen = [];
        foreach ($pengajuan as $p) {
            $v = $this->normalize($p['blok'] ?? '');
            $key = strtolower($v);
            if ($v !== '' && !isset($seen[$key])) {
                $seen[$key] = true;
                $list[] = $v;
            }
        }
        foreach ($beritaAcara as $b) {
            $v = $this->normalize($b['blok'] ?? '');
            $key = strtolower($v);
            if ($v !== '' && !isset($seen[$key])) {
                $seen[$key] = true;
                $list[] = $v;
            }
        }
        usort($list, static fn ($a, $b) => strcmp(strtolower($a), strtolower($b)));
        return $list;
    }

    private function computeSummary(array $rows): array
    {
        $perStatus = [];
        $perJenis = [];
        $perBlok = [];
        $totalPendaftar = count($rows);
        $totalDiterima = 0;
        $totalDitolak = 0;
        $totalMenunggu = 0;
        $totalAcc = 0;
        $totalBiaya = 0.0;
        foreach ($rows as $r) {
            $p = $r['pengajuan'];
            $status = trim((string) $p['status']);
            $perStatus[$status === '' ? 'Lainnya' : $status] = ($perStatus[$status === '' ? 'Lainnya' : $status] ?? 0) + 1;
            if ($status === 'Diterima') {
                $totalDiterima++;
            } elseif ($status === 'Ditolak') {
                $totalDitolak++;
            } elseif ($status === 'Menunggu') {
                $totalMenunggu++;
            } elseif ($status === 'ACC') {
                $totalAcc++;
            }
            $jenis = trim((string) $p['jenisKegiatan']);
            $perJenis[$jenis === '' ? 'Lainnya' : $jenis] = ($perJenis[$jenis === '' ? 'Lainnya' : $jenis] ?? 0) + 1;
            $blok = trim((string) $p['blok']);
            $perBlok[$blok === '' ? '-' : $blok] = ($perBlok[$blok === '' ? '-' : $blok] ?? 0) + 1;
            $totalBiaya += (float) $p['biaya'];
        }
        return [
            'totalPendaftar' => $totalPendaftar,
            'totalDiterima'  => $totalDiterima,
            'totalDitolak'   => $totalDitolak,
            'totalMenunggu'  => $totalMenunggu,
            'totalAcc'       => $totalAcc,
            'totalBiaya'     => $totalBiaya,
            'perJenis'       => $perJenis,
            'perBlok'        => $perBlok,
            'perStatus'      => $perStatus,
        ];
    }

    private function biayaKegiatanOf(array $p, array $details, array $biayaMap): ?string
    {
        foreach ($details as $d) {
            foreach (['pilihan', 'detail', 'jenis_kegiatan'] as $col) {
                $v = trim((string) ($d[$col] ?? ''));
                if ($v !== '' && isset($biayaMap[$v])) {
                    return $v;
                }
            }
        }
        $jenis = trim((string) ($p['jenis_kegiatan'] ?? ''));
        return $jenis !== '' && isset($biayaMap[$jenis]) ? $jenis : null;
    }

    private function clientPengajuanRow(array $p, float $biaya, ?float $override): array
    {
        return [
            'id'               => (int) $p['id'],
            'idPengajuan'      => $p['id_pengajuan'],
            'timestamp'        => $p['timestamp'],
            'npm'              => $p['npm'],
            'namaLengkap'      => $p['nama_lengkap'],
            'email'            => $p['email'],
            'noHp'             => $p['no_hp_wa'],
            'blok'             => $p['blok'],
            'jenisKegiatan'    => $p['jenis_kegiatan'],
            'matakuliah'       => $p['matakuliah'],
            'dosen'            => $p['dosen'],
            'tanggalPelaksanaan' => $this->dateOnly($p['tanggal_pelaksanaan']),
            'keterangan'       => $p['keterangan'],
            'status'           => $p['status'],
            'catatanAdmin'     => $p['catatan_admin'],
            'nomorSurat'       => $p['nomor_surat'],
            'statusInfoBagian' => $p['status_info_bagian'],
            'linkSurat'        => $p['link_surat_keterangan'],
            'linkAcc'          => $p['path_acc_inhal'],
            'linkBukti'        => $p['path_bukti_bayar'],
            'linkFinal'        => $p['path_final'],
            'biaya'            => $biaya,
            'biayaOverride'    => $override,
        ];
    }

    private function clientDetailRow(array $d): array
    {
        return [
            'id'               => (int) $d['id'],
            'jenisKegiatan'    => $d['jenis_kegiatan'],
            'pilihan'          => $d['pilihan'],
            'detail'           => $d['detail'],
            'tanggalPelaksanaan' => $this->dateOnly($d['tanggal_pelaksanaan']),
            'bagian'           => $d['bagian'],
        ];
    }

    private function clientHistoryRow(array $h): array
    {
        return [
            'timestamp'  => $h['timestamp'],
            'status'     => $h['status'],
            'catatan'    => $h['catatan'],
            'actorEmail' => $h['actor_email'],
        ];
    }

    private function dateOnly($v): string
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', (string) $v, $m)) {
            return $m[1] . '-' . $m[2] . '-' . $m[3];
        }
        return '';
    }

    private function normalize($v): string
    {
        return trim((string) preg_replace('/\s+/', ' ', (string) $v));
    }
}
