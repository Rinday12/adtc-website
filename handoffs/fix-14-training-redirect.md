# Fix #14 — Redirect URL Training Tunggal ke Plural
Status: BELUM DEPLOY · Service: adminRoutes · Diperbarui: 2026-09-17 15:10

## Sedang dikerjakan
Fix #14 sudah selesai di kode dan changelog, menunggu deploy.

## Status terakhir
- Route `/admin/training/create` sekarang redirect 302 ke `/admin/trainings/create`
- Backend test: login OK, halaman create tampil normal (200)
- CHANGELOG_FIXES.md sudah diupdate

## Keputusan penting
Tambah redirect di routes/adminRoutes.js untuk singular → plural tanpa mengubah route utama.

## Langkah berikutnya
Deploy ke production atau testing environment.

## Jangan lakukan
Jangan hapus route plural `/admin/trainings/*` — itu route utama yang tetap dipakai.
