# Setting Promo Harga Global + Promo per Training
Status: BERJALAN · Service: adtcwebsite · Diperbarui: 2026-11-19

## Sedang dikerjakan
Fix #61 sudah di-commit (3ffa870). Tersisa: deploy migrasi + koreksi data DB prod.

## Status terakhir
- Fix #59 (promo global) & Fix #60 (promo per training, tabel `promo_trainings`)
  sudah LIVE — commit f63a4da, migrasi lokal jalan.
- Fix #61: commit 3ffa870 — `resolveFinalPrice` kini ambil min(CERT_FEE, promo)
  untuk kategori gratis + `payment_option='sertifikat'`; view (success/form/admin
  detail) tampil `final_price` + badge promo; IIFE promo di 5 view publik
  diperbaiki agar kategori gratis bisa tampil banner promo. 149 test lulus.
- DB lokal: reg #84 (rinday-2, gratis+sertifikat) final_price di-reset ke
  50000 = harga global promo aktif (id=10); baris `promo_trainings (10,56)`
  sudah dihapus.

## Keputusan penting
- `final_price` adalah snapshot saat submit — reg lama tak ikut otomatis saat
  promo berubah; perlu submit ulang / UPDATE SQL manual.
- Opsi A dipilih: kategori gratis boleh dipromokan.

## Langkah berikutnya
1. Deploy: jalankan KEDUA migrasi promo (`2026-11-18_add_promo_settings.sql`,
   `2026-11-19_add_promo_trainings.sql`) di DB prod bila belum.
2. Deploy: jalankan migration `2026-11-12_add_institution_social_proof_to_registrations.sql`
   (kolom `payment_option`) di DB prod — WAJIB sebelum kode Fix #61 live.
3. Update data DB: harga promo per training rinday6 (id=57) saat ini 78000 —
   di ATAS CERT_FEE 75000 sehingga promo TAK berlaku. Isi ulang harga promo
   per training tersebut jadi < 75000 (mis. 60000) agar promo aktif.

## Jangan lakukan
- Jangan anggap harga `final_price` di DB lama ikut promo otomatis.
