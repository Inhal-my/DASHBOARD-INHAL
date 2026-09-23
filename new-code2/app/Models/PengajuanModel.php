<?php

namespace App\Models;

use CodeIgniter\Model;

class PengajuanModel extends Model
{
    protected $table            = 'pengajuan';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'id_pengajuan','timestamp','npm','nama_lengkap','email','no_hp_wa','blok',
        'jenis_kegiatan','matakuliah','dosen','tanggal_pelaksanaan','keterangan',
        'link_surat_keterangan','status','catatan_admin','notifikasi_terkirim_pada',
        'status_notifikasi_email','error_notifikasi_email','lampiran_email','nomor_surat',
        'path_acc_inhal','path_bukti_bayar','path_final','status_info_bagian',
        'waktu_info_bagian','email_bagian','catatan_info_bagian',
    ];
    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    public function findByIdPengajuan(string $idPengajuan): ?array
    {
        return $this->where('id_pengajuan', $idPengajuan)->first();
    }
}
