<?php

namespace App\Libraries;

use App\Models\CheckDataModel;
use App\Models\MasterBiayaModel;
use App\Models\PengajuanModel;

class BiayaService
{
    public function allMapped(): array
    {
        $rows = (new MasterBiayaModel())->orderBy('biaya', 'ASC')->findAll();
        $map = [];
        foreach ($rows as $r) {
            $map[$r['kegiatan']] = (float) $r['biaya'];
        }
        return $map;
    }

    public function override(int $pengajuanId): ?float
    {
        $row = (new CheckDataModel())
            ->where('pengajuan_id', $pengajuanId)
            ->where('detail', 'BIAYA-OVERRIDE')
            ->first();
        return $row && $row['biaya'] !== null ? (float) $row['biaya'] : null;
    }

    public function resolve(int $pengajuanId, ?string $kegiatan): ?float
    {
        $ov = $this->override($pengajuanId);
        if ($ov !== null) {
            return $ov;
        }
        $map = $this->allMapped();
        return $kegiatan !== null && isset($map[$kegiatan]) ? $map[$kegiatan] : null;
    }

    public function setOverride(int $pengajuanId, string $kegiatan, ?float $biaya): void
    {
        $m = new CheckDataModel();
        $existing = $m->where('pengajuan_id', $pengajuanId)->where('detail', 'BIAYA-OVERRIDE')->first();
        $pengajuan = (new PengajuanModel())->find($pengajuanId);
        $base = [
            'timestamp'    => date('Y-m-d H:i:s'),
            'pengajuan_id' => $pengajuanId,
            'id_pengajuan' => $pengajuan ? $pengajuan['id_pengajuan'] : '',
            'npm'          => $pengajuan ? $pengajuan['npm'] : '',
            'detail'       => 'BIAYA-OVERRIDE',
            'pilihan'      => $kegiatan,
        ];
        if ($biaya === null || $biaya <= 0) {
            if ($existing) {
                $m->delete($existing['id']);
            }
            return;
        }
        if ($existing) {
            $m->update($existing['id'], ['biaya' => $biaya, 'pilihan' => $kegiatan]);
        } else {
            $base['check_id'] = inhal_id('CHK');
            $base['biaya'] = $biaya;
            $m->insert($base);
        }
    }
}
