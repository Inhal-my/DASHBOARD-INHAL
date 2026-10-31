#!/bin/bash
# Peluncur aplikasi INHAL lokal (UI sama persis dengan produksi).
#
# Klik dua kali berkas ini di Finder, atau jalankan dari Terminal:
#   ./Backup-INHAL.command
#
# Data lokal disimpan di new-code1-cf/local-data/ dan TIDAK pernah menyentuh
# Cloudflare (selalu mode --local).
set -euo pipefail

cd "$(dirname "$0")/new-code1-cf"

if ! command -v npx >/dev/null 2>&1; then
    echo "Node.js (npx) tidak ditemukan. Pasang Node 22+ lalu coba lagi."
    read -r -p "Tekan Enter untuk menutup..."
    exit 1
fi

exec npm run app:local -- "$@"
