# Setting Promo Harga Global + Promo per Training
Status: SELESAI · Service: adtcwebsite · Diperbarui: 2026-11-19

Fitur promo global (Fix #59) & skema harga per training (Fix #60, tabel
`promo_trainings`) sudah selesai di kode, di-commit (f63a4da), migrasi sudah
dijalankan di DB lokal, dan keduanya changelog sudah ditandai ✅ LIVE.

Langkah yang masih tertunda HANYA untuk production: jalankan KEDUA migrasi
(`migrations/2026-11-18_add_promo_settings.sql` dan
`migrations/2026-11-19_add_promo_trainings.sql`) di DB production SEBELUM
deploy kode ke production — bila belum pernah dijalankan di DB prod.
