-- BA Pelaksanaan: boleh lebih dari satu BA per kegiatan. Tambah label opsional
-- sebagai pembeda tampilan (mis. "Sesi 1"). Tidak menyentuh data lama.
ALTER TABLE berita_acara ADD COLUMN label TEXT DEFAULT '';
UPDATE berita_acara SET label = '' WHERE label IS NULL;
