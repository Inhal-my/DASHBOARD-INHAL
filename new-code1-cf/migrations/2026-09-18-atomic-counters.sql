-- Atomic id generators.
-- nomor_surat: enforce one row per (type, tahun) so numbering can use an
-- atomic upsert (INSERT ... ON CONFLICT ... RETURNING) instead of a
-- read-modify-write that could hand out duplicate nomor surat.
-- If this index fails to build, the table already contains duplicate
-- (type, tahun) rows from the previous racy code and must be reviewed first.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomor_surat_type_tahun ON nomor_surat(type, tahun);

-- id_sequence: generic atomic counter used for BA id generation.
CREATE TABLE IF NOT EXISTS id_sequence (
  scope TEXT PRIMARY KEY, last_number INTEGER NOT NULL DEFAULT 0, updated_at TEXT
);
