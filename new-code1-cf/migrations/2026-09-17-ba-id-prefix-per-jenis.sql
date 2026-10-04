UPDATE berita_acara SET ba_id = 'BA-PEL-' || substr(ba_id, 4) WHERE ba_id LIKE 'BA-20%';
UPDATE berita_acara_peserta SET ba_id = 'BA-PEL-' || substr(ba_id, 4) WHERE ba_id LIKE 'BA-20%';
UPDATE berita_acara_admin SET ba_id = 'BA-PEN-' || substr(ba_id, 4) WHERE ba_id LIKE 'BA-20%';
UPDATE berita_acara_admin_peserta SET ba_id = 'BA-PEN-' || substr(ba_id, 4) WHERE ba_id LIKE 'BA-20%';
