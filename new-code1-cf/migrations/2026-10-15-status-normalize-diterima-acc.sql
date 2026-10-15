-- migrations/2026-10-15-status-normalize-diterima-acc.sql
-- Status "Diterima" dihapus dari sistem, digantikan oleh "ACC".
UPDATE pengajuan SET status = 'ACC' WHERE status = 'Diterima';

UPDATE status_history SET status = 'ACC' WHERE status = 'Diterima';

UPDATE config SET value = 'ACC'
  WHERE key = 'BAGIAN_BA_STATUSES' AND value = 'Diterima';

UPDATE config SET value = trim(replace(value, 'Diterima,', ''))
  WHERE key = 'BAGIAN_BA_STATUSES' AND value LIKE 'Diterima,%';

UPDATE config SET value = trim(replace(value, ',Diterima', ''))
  WHERE key = 'BAGIAN_BA_STATUSES' AND value LIKE '%,Diterima';
