-- manual-entry: tandai asal pengajuan (Portal / Manual)
ALTER TABLE pengajuan ADD COLUMN sumber TEXT;
UPDATE pengajuan SET sumber = 'Portal' WHERE sumber IS NULL OR sumber = '';
