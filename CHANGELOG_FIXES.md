### Fix #45b — Migration Production: Nonaktifkan Kategori Non-Resmi + Pindahkan Training ke "Pelatihan"
Tanggal: 2026-10-28
File: migrations/2026-10-28_deactivate_non_official_categories_prod.sql, migrations/2026-10-28_move_legacy_trainings_to_pelatihan_prod.sql
Masalah: Dropdown navbar production menampilkan 8 kategori (BNSP, Awareness, Awareness Lingkungan, Awareness Umum, dll) sedangkan local server hanya 4 kategori resmi. Selain itu, training yang masuk ke 4 kategori lama tidak muncul di halaman /trainings/kategori/pelatihan.
Akar: (1) `findCategories()` mengembalikan semua baris `categories` dengan `status='aktif'` tanpa whitelist; kategori lama di production masih `aktif`. (2) Migrasi nonaktifkan kategori hanya menyembunyikan dari navbar — tidak memindahkan `trainings.category` dari nama lama ke "Pelatihan", jadi count pelatihan tetap 0.
Fix:
- `2026-10-28_deactivate_non_official_categories_prod.sql` (sudah ada): `UPDATE categories SET status='nonaktif' WHERE anchor NOT IN ('pelatihan','konsultan','in-house-training','pelatihan-gratis')`.
- `2026-10-28_move_legacy_trainings_to_pelatihan_prod.sql` (baru): `UPDATE trainings SET category='Pelatihan' WHERE category IN ('BNSP','Awareness','Awareness Lingkungan','Awareness Umum')`.
- Dua migrasi idempoten; urutan: LANGKAH 2b (nonaktifkan kategori) dulu, LANGKAH 2c (pindahkan training) sesudahnya.
Verifikasi: PENDING verifikasi (perlu cek `SELECT DISTINCT category FROM trainings WHERE category NOT IN ('Pelatihan','Konsultan','In-house training','Pelatihan gratis')` di production untuk memastikan tidak ada nama kategori lama lain selain 4 yang di-list — jika ada, tambahkan ke UPDATE sebelum eksekusi).
Status: BELUM DEPLOY.
Pelajaran: Saat menyinkronkan kategori antar environment, dua hal harus dikerjakan: (1) nonaktifkan baris kategori di `categories`, (2) pindahkan `trainings.category` — hanya nonaktifkan kategori tanpa memindahkan training membuat count di kategori resmi tetap 0 dan training "hilang" dari halaman kategori resmi. Selalu cek `SELECT DISTINCT category` di production sebelum menulis daftar kategori lama di migrasi.
Log Keyword: move legacy trainings to pelatihan, categories nonaktif anchor, BNSP Awareness training kategori

### Fix #45 — Dropdown Navbar Tampilkan Kategori Test Dev "Full Gratis"
Tanggal: 2026-10-28
File: DB dev adtc_db (categories, trainings)
Masalah: Dropdown "Katalog Pelatihan" di navbar menampilkan 5 kategori — 4 resmi (Pelatihan, Konsultan, In-house training, Pelatihan gratis) plus "Full Gratis" (id 25), kategori test dev dari Fix #41 yang sengaja dibuat di DB dev.
Akar: Kategori "Full Gratis" (id 25, `cert_available=0`) dibuat untuk uji varian full-gratis di DB dev, tapi tidak pernah dinonaktifkan; `findCategories()` mengembalikan semua baris `status='aktif'` tanpa filter khusus, sehingga kategori test ikut tampil di navbar publik.
Fix:
- `categories` id 25 ("Full Gratis") di-set `status='nonaktif'` — dropdown navbar kini hanya menampilkan 4 kategori resmi.
- Training id 41 ("dfbfbt", test dev) dipindah `category='Full Gratis'` → `Pelatihan gratis` agar tidak ada training yang menunjuk kategori nonaktif.
Verifikasi: DB dev — `SELECT name FROM categories WHERE status='aktif' ORDER BY sort_order` = 4 baris (pelatihan, konsultan, in-house-training, pelatihan-gratis); training id 41 kini `category='Pelatihan gratis'`. Status: DEV HANYA — tidak perlu deploy (perubahan DB dev, bukan kode).
Pelajaran: Kategori test dev (`Full Gratis` id 25, dibuat Fix #41) WAJIB di-nonaktifkan sebelum handoff deploy; `findCategories()` memfilter `status='aktif'` tanpa whitelist kategori resmi, jadi baris test yang masih aktif bocor ke navbar publik.
Log Keyword: Full Gratis id 25 nonaktif, categories status, navbar 4 kategori, dfbfbt training id 41

### Fix #44 — Ikon Emoji Kategori Tampil '?' / Mojibake di Frontend
Tanggal: 2026-10-28
File: config/db.js
Masalah: Ikon emoji kategori di dropdown navbar & hero banner kategori produksi tampil sebagai `?` (latin1) atau `ðŸŽ"` (UTF-8 yang di-interpretasi sebagai Latin-1). Data di DB sudah benar (hex `F0 9F ...`), tapi string-nya rusak saat melewati pipeline Node → browser.
Akar: Connection pool `mysql2` di `config/db.js` tidak diset `charset: 'utf8mb4'`. Default charset koneksi (biasanya `latin1` atau sesuai `character_set_server` MariaDB) membuat byte 4-byte emoji di-decode ke string JS yang salah (each byte jadi 1 karakter Latin-1 terpisah), sehingga EJS mengirim string korup ke browser.
Fix: Tambah `charset: 'utf8mb4'` ke konfigurasi pool di `config/db.js`. Ini membuat `SET NAMES utf8mb4` dieksekusi otomatis saat koneksi dibuka, sehingga byte emoji di-decode benar ke string JS (emoji = 2 code unit UTF-16), dan EJS mengirim UTF-8 yang benar.
Verifikasi:
- `HEX(icon)` di DB = `F0 9F ...` (emoji sudah tersimpan benar sebelum fix ini — Fix sebelumnya sukses menulis)
- Setelah deploy + `pm2 restart`, ikon kategori di dropdown navbar tampil 📚💼🏭🎁 (bukan ?)
- Halaman `/trainings/kategori/<anchor>`: emoji di hero & kartu tampil benar
Status: PENDING verifikasi (deploy prod).
Pelajaran: Saat kolom DB berisi multibyte/emoji, SELALU set `charset: 'utf8mb4'` di koneksi Node — default mysql2/MySQL sering `latin1`, yang corrupt semua data 4-byte. Cek hex di DB dulu untuk membedakan "data rusak di DB" vs "data rusak di transfer".
Log Keyword: charset utf8mb4, emoji kategori, config/db.js, mojibake ðŸ, latin1 connection
Tanggal: 2026-10-28
File: views/trainings/category.ejs
Masalah: Kartu program di `/trainings/kategori/<anchor>` tampil berbeda dari kartu di `/trainings` (katalog), dan tombol "Lihat Detail"-nya rusak — setiap klik melempar `ReferenceError` sehingga navigasinya tak pernah terjadi.
Akar: Tombol "Lihat Detail" di `category.ejs` memakai `onclick="return handleDetailClick(...)"`, `oncontextmenu`, dan `ondragstart` — tetapi ketiga fungsi itu tidak didefinisikan di mana pun di codebase; klik-kanan dan drag juga ikut terblokir.
Fix:
- Markup kartu disamakan dengan kartu `catalog.ejs`: tinggi header, posisi badge status (kanan atas), badan kartu, baris info (tanggal/mode/harga), hover state, dan style CTA.
- "Lihat Detail" diganti plain anchor `<a href="/trainings/{slug}">` — persis pola katalog; handler JS tak ada.
- "Daftar Sekarang" tetap anchor ke `/trainings/{slug}/register`; kartu penuh/selesai tetap tombol disabled ber-dot status.
Verifikasi: E2E dev `http://localhost:3000/trainings/kategori/pelatihan`: 0 kemunculan `handleDetailClick`/`handleContextMenu`/`handleDragStart` di HTML, 18 plain anchor `/trainings/...`, badge status ter-render (Buka 2 / Penuh 4 / Selesai 30). 127 test passing. Halaman `/trainings` tak terpengaruh (markup-nya acuan).
Status: BELUM DEPLOY.
Pelajaran: Saat memindahkan markup antar view, handler JS bawaan (`onclick`/`oncontextmenu`/`ondragstart`) gampang terbawa ke view baru tanpa fungsinya ikut — grep `handle*Click|handle*Drag` di views setelah copy-paste markup.
Log Keyword: category.ejs Lihat Detail, handleDetailClick hilang, kartu kategori sama katalog
Tanggal: 2026-10-28
File: views/trainings/category.ejs, models/Training.js
Masalah: Halaman `/trainings/kategori/full-gratis` menampilkan "Gratis — hanya bayar sertifikat" (badge hero + kartu training + intro) padahal kategori Full Gratis (id 25, `cert_available=0`) TIDAK punya sertifikat — teks menyesatkan.
Akar: `findCategories()` tidak mengirim `cert_available` ke view, jadi view tak bisa membedakan gratis murni vs gratis+paket; teks ditulis tetap untuk semua `is_free_tier`.
Fix:
- `Training.findCategories()` kini ikut `cert_available` (NULL → `true`, pola sama `findBySlug`).
- `category.ejs` 3 titik: badge hero → "Gratis penuh — Rp 0 total"; harga kartu → "Gratis — Rp 0 total"; intro → "Program sepenuhnya gratis — pendaftaran, pelaksanaan, dan sertifikat tanpa biaya apa pun" (pakai fallback teks lama untuk kategori anchor tak dikenal).
Verifikasi: E2E dev — halaman full-gratis: 0 kemunculan "hanya bayar/biaya sertifikat", 2 label "Rp 0 total" + intro baru; halaman pelatihan-gratis tak berubah (1 "hanya bayar" + 2 "hanya biaya" sama seperti sebelum). 127 test passing.
Status: BELUM DEPLOY.
Pelajaran: Setelah menambah varian tier baru, grep teks tetap tier-gratis di SEMUA view publik (`gratis`/`sertifikat`) — teks hero/intro sering lebih terlupakan daripada form.
Log Keyword: full-gratis kategori, hanya bayar sertifikat, cert_available findCategories

### Fix #43 — Kartu & Tombol di Halaman Kategori Disamakan dengan Katalog
Tanggal: 2026-10-28
File: views/trainings/category.ejs
Masalah: Kartu program di `/trainings/kategori/<anchor>` tampil berbeda dari kartu di `/trainings` (katalog), dan tombol "Lihat Detail"-nya rusak — setiap klik melempar `ReferenceError` sehingga navigasinya tak pernah terjadi.
Akar: Tombol "Lihat Detail" di `category.ejs` memakai `onclick="return handleDetailClick(...)"`, `oncontextmenu`, dan `ondragstart` — tetapi ketiga fungsi itu tidak didefinisikan di mana pun di codebase; klik-kanan dan drag juga ikut terblokir.
Fix:
- Markup kartu disamakan dengan kartu `catalog.ejs`: tinggi header, posisi badge status (kanan atas), badan kartu, baris info (tanggal/mode/harga), hover state, dan style CTA.
- "Lihat Detail" diganti plain anchor `<a href="/trainings/{slug}">` — persis pola katalog; handler JS tak ada.
- "Daftar Sekarang" tetap anchor ke `/trainings/{slug}/register`; kartu penuh/selesai tetap tombol disabled ber-dot status.
Verifikasi: E2E dev `http://localhost:3000/trainings/kategori/pelatihan`: 0 kemunculan `handleDetailClick`/`handleContextMenu`/`handleDragStart` di HTML, 18 plain anchor `/trainings/...`, badge status ter-render (Buka 2 / Penuh 4 / Selesai 30). 127 test passing. Halaman `/trainings` tak terpengaruh (markup-nya acuan).
Status: BELUM DEPLOY.
Pelajaran: Saat memindahkan markup antar view, handler JS bawaan (`onclick`/`oncontextmenu`/`ondragstart`) gampang terbawa ke view baru tanpa fungsinya ikut — grep `handle*Click|handle*Drag` di views setelah copy-paste markup.
Log Keyword: category.ejs Lihat Detail, handleDetailClick hilang, kartu kategori sama katalog
Tanggal: 2026-10-28
File: views/trainings/category.ejs, models/Training.js
Masalah: Halaman `/trainings/kategori/full-gratis` menampilkan "Gratis — hanya bayar sertifikat" (badge hero + kartu training + intro) padahal kategori Full Gratis (id 25, `cert_available=0`) TIDAK punya sertifikat — teks menyesatkan.
Akar: `findCategories()` tidak mengirim `cert_available` ke view, jadi view tak bisa membedakan gratis murni vs gratis+paket; teks ditulis tetap untuk semua `is_free_tier`.
Fix:
- `Training.findCategories()` kini ikut `cert_available` (NULL → `true`, pola sama `findBySlug`).
- `category.ejs` 3 titik: badge hero → "Gratis penuh — Rp 0 total"; harga kartu → "Gratis — Rp 0 total"; intro → "Program sepenuhnya gratis — pendaftaran, pelaksanaan, dan sertifikat tanpa biaya apa pun" (pakai fallback teks lama untuk kategori anchor tak dikenal).
Verifikasi: E2E dev — halaman full-gratis: 0 kemunculan "hanya bayar/biaya sertifikat", 2 label "Rp 0 total" + intro baru; halaman pelatihan-gratis tak berubah (1 "hanya bayar" + 2 "hanya biaya" sama seperti sebelum). 127 test passing.
Status: BELUM DEPLOY.
Pelajaran: Setelah menambah varian tier baru, grep teks tetap tier-gratis di SEMUA view publik (`gratis`/`sertifikat`) — teks hero/intro sering lebih terlupakan daripada form.
Log Keyword: full-gratis kategori, hanya bayar sertifikat, cert_available findCategories

### Fix #41 — Detail Training: Bagian Biaya Dinonaktifkan untuk Kategori Full Gratis
Tanggal: 2026-10-28
File: views/trainings/detail.ejs
Masalah: Di halaman detail training kategori full gratis, tabel "Biaya Pendaftaran" (Umum/Mahasiswa/Karyawan + catatan dokumen) masih tampil dengan Rp 0 — peserta bingung; form publik sudah benar sejak Fix #35, tapi halaman detail tidak menyesuaikan.
Akar: `detail.ejs` me-render tabel biaya tanpa memeriksa `cert_available`; hanya banner amber gratis+paket yang dikondisikan.
Fix: tambah konstanta `isFullFree = is_free_tier && cert_available === false` di section biaya — bila true, tabel biaya & catatan dokumen disembunyikan dan diganti banner hijau "sepenuhnya gratis, ikut Rp 0 total"; cabang lain (berbayar / gratis+paket) tak berubah.
Verifikasi: E2E dev — training kategori Full Gratis (id 40 temp): 0 kemunculan "Kategori Peserta", 1 "sepenuhnya gratis"; btht (gratis+75k): tabel + banner amber tetap ada; training berbayar: tabel tetap tampil. Data uji dihapus. 127 test passing (tak menyentuh logic harga — murni view).
Status: BELUM DEPLOY.
Pelajaran: Perilaku tier yang sudah di-fix di satu halaman (form) perlu dicek di SEMUA halaman yang menampilkan harga (detail, katalog, success) — grep `price_`/`Rp` di semua view publik saat menambah varian tier.
Log Keyword: detail.ejs isFullFree, biaya pendaftaran disembunyikan, full gratis

### Fix #40 — Form Admin Kategori: 3 Pilihan "Tipe Biaya" Ganti Checkbox Bertumpuk
Tanggal: 2026-10-28
File: views/admin/categories/form.ejs, controllers/adminCategoryController.js, views/admin/categories/list.ejs
Masalah: Menandai kategori gratis di form admin memakai dua checkbox bertumpuk ("kategori gratis" + "gratis murni") yang membingungkan — sulit dipilih/dibaca, dan nominal Rp 75.000 tidak ditampilkan sebagai acuan.
Akar: UI tidak memetakan pilihan tier ke pilihan tunggal yang eksplisit; controller hanya membaca `is_free_tier`/`free_pure` mentah.
Fix:
- Form kategori kini radio 3 opsi "Tipe biaya kategori": **Berbayar** / **Full free (Rp 0 total)** / **Gratis + paket komplit (Rp CERT_FEE)**. Dua field tersembunyi (`is_free_tier`,`free_pure`) disinkronkan JS dari radio → controller & model TIDAK diubah (kompatibel nilai `'on'/'off'`).
- Label opsi paket memuat nominal nyata dari `certFeeFmt` (helper `feeCtx()` baru disuplai ke 5 titik render form kategori).
- Tabel daftar kategori: kolom "Gratis" kini menampilkan varian (Berbayar / Full free / Gratis + paket komplit) + catatan legenda diperbarui.
Verifikasi: EJS terkompilasi 3 cabang tier + create + list. 127 test passing. E2E via UI admin: submit tiap kombinasi nilai `is_free_tier`/`free_pure` sesuai radio → DB benar: Berbayar(0,1) / FullFree(1,0) / Paket(1,1). Form menampilkan 3 radio + nominal Rp 75.000. Data uji dibersihkan; baris produksi "Pelatihan gratis" tak terpengaruh.
Status: BELUM DEPLOY.
Pelajaran: Untuk pilihan tier multi-state, radio dengan value eksplisit + sinkronisasi ke field tersembunyi jauh lebih aman & terbaca daripada menumpuk checkbox; controller lama tak perlu disentuh (nilai tetap `'on'/'off'`).
Log Keyword: price_tier, tipe biaya kategori, free_pure, is_free_tier radio, certFeeFmt feeCtx

### Fix #39 — Emoji Ikon Kategori Tersimpan Percent-Encoded (%F0%9F%8E%89)
Tanggal: 2026-10-28
File: models/Category.js, (data) baris kategori 'Full Free' id 17 di DB dev
Masalah: Hero banner kategori "Full Free" menampilkan teks mentah `%F0%9F%8E%89` alih-alih emoji 🎉 — hasil dari submit form kategori yang nilai input-nya ter-isian URL-encoded (emoji multi-byte jadi `%XX` beruntun).
Akar: `Category.create/update` menyimpan `data.icon` apa adanya tanpa decode; view langsung me-render-nya.
Fix:
- Tambah `Category.normalizeIcon(raw)`: URL-decode nilai yang cocok pola percent-encoding penuh, kembalikan string aslinya bila gagal decode (tidak mengubah input non-encoded seperti '📚' / ''). Dipakai di `create` & `update`.
- Perbaiki data dev: `UPDATE categories SET icon='🎉' WHERE id=17`.
Verifikasi: `normalizeIcon('%F0%9F%8E%89')→'🎉'`, `('%E2%9A%A1')→'⚡'`, `('📚')→'📚'`, `('')→''`, `('%41BC')→'%41BC'` (bukan encoding valid → tetap). 127 test passing. Halaman publik `/trainings/category/full-free` kini merender 🎉 (grep: 2 kemunculan, 0 sisa percent-encoded).
Status: BELUM DEPLOY. Produksi: selain deploy kode, jalankan sekali saja `UPDATE categories SET icon=UNHEX(REPLACE(icon,'%',''))...` — praktisnya cukup periksa tiap ikon yang tersimpan percent-encoded (`SELECT id,icon FROM categories WHERE icon LIKE '%F0%'`) dan set ulang lewat form admin.
Pelajaran: Emoji multibyte di input form bisa tiba percent-encoded bila pipeline (proxy/form multipart tertentu) meng-encode URI-nya — validasi & normalisasi di lapisan model, bukan percaya input apa adanya untuk kolom "tampilan".
Log Keyword: normalizeIcon, percent-encoded emoji, %F0%9F%8E%89, categories icon, full free hero

### Fix #38 — Harga Dinonaktifkan Otomatis untuk Kategori Gratis + Hapus Duplikat Kategori
Tanggal: 2026-10-28
File: controllers/adminTrainingController.js, views/admin/trainings/form.ejs
Masalah: Admin tetap harus mengisi 3 field harga (umum/UAD/karyawan) meskipun kategori bertipe gratis — nominalnya tak terpakai (tagihan diatur tier + CERT_FEE), jadi membingungkan. Plus kategori "Gratis Paket Komplit" (dibuat sesi sebelumnya) menduplikasi "Pelatihan gratis".
Akar: `validateTrainingInput()` selalu mewajibkan 3 field harga; form tidak menonaktifkan input numerik apa pun berdasarkan tier.
Fix:
- `validateTrainingInput` kini async: cek tier kategori via `Category.findByName` — bila gratis (atau kategori tak dikenal), 3 field harga menjadi OPSIONAL; caller menagih `freeTierPrices()` yang memaksa 0 saat gratis. Error validasi "harga wajib diisi" kini hanya muncul untuk kategori berbayar.
- Form: 3 kolom harga diberi `data-price-field`; atribut `disabled` di-set server-render saat banner gratis tampil, plus JS `setPricesDisabled()` toggle dinamis saat admin ganti pilihan di dropdown; tanda wajib `*` disembunyikan (visibility:hidden, tidak dihapus DOM).
- Hapus baris kategori "Gratis Paket Komplit" dari DB dev — "Pelatihan gratis" (id 11) sudah menyangkuhi tier gratis-dengan-paket.
Verifikasi: 127 test passing. E2E via UI admin: create kategori "Full Free" tanpa kirim field harga → 302 sukses, tersimpan `0.00/0.00/0.00`; create kategori "Konsultan" tanpa harga → 200 re-render dengan 3 pesan error yang benar. Input ter-render `disabled` hanya untuk tier gratis (konsisten Konsultan vs Pelatihan gratis vs Full Free). DB dev bersih dari data uji.
Status: BELUM DEPLOY (ikut paket Fix #35–#37; prasyarat `cert_available` tersedia di DB produksi).
Pelajaran: Field yang dinonaktifkan (`disabled`) TIDAK ter-submit — desain ini sengaja memanfaatkan perilaku itu: server menerima submit tanpa harga untuk tier gratis dan mengisi 0 sendiri. Jangan menggabungkan perilaku disabled dengan validasi wajib (field wajib + disabled saling kontradiktif di HTML5).
Log Keyword: freeTierPrices, validateTrainingInput async, data-price-field, disabled price inputs, kategori duplikat

### Fix #37 — Pembeda Kategori Gratis Murni vs Gratis+dengan-Paket (cert_available)
Tanggal: 2026-10-28
File: migrations/2026-10-28_add_cert_available_to_categories.sql, models/Category.js, models/Training.js, models/Registration.js, controllers/registrationController.js, controllers/adminCategoryController.js, views/registration/form.ejs, views/admin/categories/form.ejs, views/admin/trainings/form.ejs, tests/property/resolveFinalPrice.test.js
Masalah: `is_free_tier` hanya punya dua nilai (gratis/bukan), padahal ada dua varian gratis: (1) FULL FREE — peserta Rp 0 total tanpa opsi apa pun; (2) gratis-ikuti tapi boleh beli paket komplit (sertifikat, materi) Rp 75.000. Sebelumnya semua kategori gratis menampilkan opsi 75k.
Akar: tidak ada flag di `categories` yang membedakan varian; form publik selalu menampilkan radio sertifikat untuk setiap `is_free_tier`.
Fix:
- Migrasi aditif: kolom `categories.cert_available TINYINT(1) DEFAULT 1` — default 1 menjaga perilaku semua kategori lama tak berubah.
- Model: `Category.create/update` mendukung `cert_available` (update mem-bypass-nya bila tak disentuh); subselect `findBySlug`/`findByToken`/admin-expose kini memaparkan `cert_available`; NULL → dianggap `true` (DB lama aman).
- `resolveFinalPrice()`: kategori `cert_available=0` → selalu 0, pilihan `payment_option` apa pun diabaikan (guard server-side, tak bisa dimanipulasi form).
- Form publik: radio pembayaran hanya tampil bila `training.cert_available !== false`.
- UI admin: form kategori dapat checkbox "Gratis murni (full free)" (`free_pure`) — tersembunyi & disabled bila bukan tier gratis; form training menampilkan label opsi & dua varian banner (paket vs full free).
- Test properti ditambah 2 skenario cert_available (gratis murni selalu 0; gratis+cert_available=1 tetap hormati CERT_FEE).
Verifikasi: 127 test passing. E2E via UI admin (sesi sementara): submit kategori "Full Free" (gratis+centang murni) → `is_free_tier=1, cert_available=0`; kategori "Gratis Paket Komplit" → `cert_available=1`; kategori lama "Pelatihan gratis" tidak terpengaruh. Training di kategori Full Free: form publik TANPA radio pembayaran, POST dipaksa `payment_option=sertifikat` → tersimpan `0.00`; kategori paket → `75000.00`. Bug awal ditemukan&diperbaiki: controller mengirim `cert_available` angka 0/1 sedangkan model mendeteksi `=== false` strict — dibuat bug (kategori tersimpan default 1); sudah diperbaiki & diverifikasi ulang.
Status: BELUM DEPLOY — produksi perlu jalankan `migrations/2026-10-28_add_cert_available_to_categories.sql` sebelum deploy kode, agar query subselect tak gagal saat kolom belum ada.
Pelajaran: Saat menambah kolom yang dibaca banyak subselect, deployment harus 2 langkah (migrasi dulu, lalu kode) — kode baru akan error di DB lama yang tak punya kolomnya.
Log Keyword: cert_available, full free, gratis murni, free_pure, resolveFinalPrice, categories migration

### Fix #36 — Form Admin Training Tanpa Kriteria Tier Gratis + Bug "Buat Kategori Baru" Tak Ter-submit
Tanggal: 2026-10-27
File: views/admin/trainings/form.ejs, controllers/adminTrainingController.js
Masalah: Admin yang membuat/mengedit pelatihan di `/admin/trainings/create` tidak diberi tahu apa artinya memilih kategori bertipe gratis — banner/instruksi "isi 0" tidak ada; dan saat membuat kategori BARU langsung dari form, input `category-custom` tidak membawa `name="category"` sehingga nilai nama kategori tak pernah ter-submit (server selalu menolak "Kategori wajib diisi"). Auto-create pun selalu membuat kategori dengan `is_free_tier=0` tanpa pilihan.
Akar: `ensureCategory()` di controller dipanggil tanpa parameter tier; view tidak punya atribut name pada cabang dropdown `__new__` (sintaks lama hanya men-set name di select, bukan input teks).
Fix:
- `ensureCategory(name, isFreeTier)` kini meneruskan centang `new_cat_is_free` — hanya berlaku saat kategori DIKREASIKAN; kategori pre-existing tidak pernah diubah.
- View: checkbox "Tandai kategori ini gratis" (cabang dropdown `__new__` maupun input teks saat belum ada kategori) + `name="category"` pada input custom dengan JS `sync()` memastikan hanya SATU field `category` yang ter-submit pada satu saat.
- Opsi kategori terdaftar diberi `data-free`, opsi kategori bertipe gratis diberi label "(gratis)", dan banner hijau di seksi Harga otomatis muncul (server-render untuk kategori terpilih, dinamis via checkbox untuk kategori baru) berisi instruksi: isi harga `0`, peserta bayar Rp 0 / `CERT_FEE` bila pilih sertifikat.
Verifikasi: EJS terkompilasi di 3 cabang (create/edit/kategori-kosong). E2E via HTTP dengan sesi admin dev: submit create + centang gratis → kategori baru `is_free_tier=1`; submit tanpa centang → `0`. Form pendaftaran publik kategori baru gratis langsung menampilkan radio pembayaran (2 elemen), kategori baru berbayar tidak (0). 125 test tetap passing. Data uji (2 training, 2 kategori, 1 admin sementara) dibersihkan.
Status: BELUM DEPLOY (ikut paket Fix #35).
Pelajaran: Cabang form yang "menyembunyikan" field lama dan mengaktifkan field baru harus selalu memastikan field pengganti punya atribut `name` — field tanpa `name` tidak ter-submit dan server kehilangan data tanpa error eksplisit.
Log Keyword: new_cat_is_free, ensureCategory, data-free, freeTierBanner, is_free_tier, category-custom, admin trainings create

### Fix #35 — Pelatihan Gratis Bisa Tagih Biaya Sertifikat (CERT_FEE) Tanpa Bisa Dimanipulasi Client
Tanggal: 2026-10-27
File: controllers/registrationController.js, views/registration/form.ejs, views/registration/success.ejs, public/js/registration-form.js, .env.development, .env.production, tests/property/resolveFinalPrice.test.js
Masalah: Pelatihan tier gratis (`is_free_tier`) selalu disimpan `final_price = 0` — peserta tidak punya opsi "dengan sertifikat" (Rp 75.000), dan halaman sukses menampilkan blok instruksi pembayaran ("transfer ke rekening") yang menyesatkan untuk tier gratis.
Akar: `resolveFinalPrice()` belum ada; harga selalu diambil dari tabel kategori. Blok info sukses tidak membedakan tier gratis vs berbayar.
Fix:
- Tambah fungsi `resolveFinalPrice(training, body, certFee)` di `registrationController.js`: tier berbayar → harga kategori (pilihan `payment_option` diabaikan); tier gratis → `0` bila opsi "gratis"/kosong, `CERT_FEE` bila opsi "sertifikat". Nominal diambil dari `process.env.CERT_FEE` (= 75000 di .env.development & .env.production), BUKAN dari form → tidak bisa dimanipulasi client.
- Form pendaftaran: tier gratis + `CERT_FEE > 0` menampilkan radio "Jenis Pembayaran" (Gratis Rp 0 / Dengan Sertifikat Rp 75.000) dengan sorotan kartu via `registration-form.js`; form berbayar tidak memunculkannya.
- Halaman sukses: tier gratis → blok "Biaya Sertifikat" (bila `final_price > 0`) atau blok "Pendaftaran Gratis — tanpa biaya, tanpa sertifikat" (bila `0`); bukan lagi blok instruksi transfer. Tier berbayar tetap pakai blok instruksi pembayaran.
- Property test baru `tests/property/resolveFinalPrice.test.js` (6 test: identitas harga berbayar, gratis→0, sertifikat→CERT_FEE, CERT_FEE invalid→0, null-safe, deterministik).
Verifikasi: 15 suites / 125 test passing. E2E via HTTP ke server dev: submit gratis tanpa pilihan → `final_price 0.00`; submit `gratis` → `0.00`; submit `sertifikat` → `75000.00`; submit berbayar → `500000.00`. Halaman sukses tiap skenario merender blok yang benar. Data uji (training id 28–29 + 4 registration) telah dihapus dari DB dev.
Status: BELUM DEPLOY (perlu set `CERT_FEE=75000` di env produksi sebelum/dengan deploy).
Pelajaran: Nominal yang ditagihkan harus selalu berasal dari server-side config (env), jangan dari input form — meskipun form tampak valid, ini satu-satunya cara menutup celah manipulasi harga oleh client.
Log Keyword: CERT_FEE, resolveFinalPrice, is_free_tier, payment_option, sertifikat, gratis, final_price, 75000

### Fix #34 — Admin Kick Saat Submit Upload Training (Sliding Session)
Tanggal: 2026-10-13
File: app.js, tests/unit/generateReferenceCode.test.js
Masalah: Admin sedang mengunggah form pelatihan → klik submit → tiba-tiba di-redirect ke /admin/login. Session hangus sebelum proses selesai.
Akar: `cookie.maxAge: 15 menit` terhitung sejak **login**, bukan sejak aktivitas terakhir. Proses upload + save yang memakan >15 menit membuat cookie sudah kadaluarsa sebelum POST selesai diproses.
Fix: Tambah `rolling: true` di konfigurasi express-session. Sekarang setiap request (termasuk POST upload) memperpanjang cookie, jadi timeout 15 menit terhitung dari aktivitas terakhir. Admin aktif tidak akan kick; yang idle >15 menit tetap keluar.
Verifikasi: 119 unit+property test passing. Test `generateReferenceCode` perbaiki regex mengikuti format aktual (`ADTC-YYYY-<base36><4-digit>`), bukan format lama yang sudah diganti di Fix #33.
Pelajaran: `rolling: true` (default `false` di express-session) wajib di-set secara eksplisit saat `saveUninitialized: false` + `resave: false`, karena kombinasi itu membuat cookie tidak diperpanjang otomatis.
Log Keyword: session, rolling, sliding, maxAge, cookie, admin, kick, login, upload, express-session

### Fix #33 — Halaman Detail Registrasi Bisa Ditebak via ID Numerik (Pencegahan Data Leaking)
Tanggal: 2026-10-09
File: models/Registration.js, controllers/registrationController.js, controllers/paymentController.js, routes/publicRoutes.js, views/registration/*.ejs, views/emails/*.ejs, config/schema.sql, migrations/2026-10-09_add_access_token_to_registrations.sql
Masalah: URL publik seperti `https://adtcuad.id/registrations/6/success` memakai ID numerik sequential — siapa pun yang menebak ID bisa membuka halaman dan melihat data pribadi peserta (nama, email, kode referensi, status pembayaran).
Akar: `Registrations` memakai `id` (AUTO_INCREMENT) sebagai parameter URL publik. Tidak ada mekanisme autentikasi/pemilik-an untuk membedakan pemilik valid dari pengunjung acak.
Fix:
- Tambah kolom `access_token VARCHAR(64) UNIQUE NOT NULL` di tabel `registrations` (UUID v4, di-generate via `crypto.randomUUID()` saat `Registration.create()`).
- Routes publik berubah dari `/registrations/:id/...` ke `/registrations/:token/...` (`success`, `payment`, `payment-success`).
- `Registration.findByToken(token)` menggantikan `findById()` di handler publik (`registrationController.getSuccess`, `paymentController.getPaymentForm/submitPayment/getPaymentSuccess`); `findById()` tetap dipertahankan untuk alur admin.
- Redirect pasca-pendaftaran (`submitForm`) kini mengarah ke `/registrations/${accessToken}/success`.
- Semua link di email (status-approved/verified/rejected, payment-info) dan form di view publik memakai `registration.access_token`, bukan `registration.id`.
- Migration SQL standalone tersedia di `migrations/2026-10-09_add_access_token_to_registrations.sql` untuk production yang sudah punya data historis (baris lama diisi `legacy-<UUID>` agar constraint UNIQUE/NOT NULL terpenuhi; token lama tidak valid untuk membuka halaman).
Verifikasi: 117 unit+property test tetap passing (2 kegagalan lama di `generateReferenceCode.test.js` bukan dari perubahan ini). URL lama `:id` tidak lagi ter-route — akses via ID numerik sekarang 404.
Pelajaran: Jangan pernah paparkan kunci primary-key numerik yang sequential di URL publik tanpa proteksi tambahan. Ganti dengan token acak entropi tinggi (UUID/≥128 bit) yang disimpan di DB, atau tambah autentikasi berbasis email/session.
Log Keyword: access_token, findByToken, UUID, data leaking, sequential ID, registration URL

### Fix #32 — Jumlah Pembayaran Rp 0 di Halaman User, Admin & Email (Bug DECIMAL string → 0)
Tanggal: 2026-10-09
File: controllers/registrationController.js, models/Registration.js, utils/email.js, views/admin/registrations.ejs
Masalah: Pendaftaran dengan harga training 2.300.000 menampilkan "Rp 0" di halaman pembayaran user, halaman detail admin, dan email "Informasi Pembayaran".
Akar: `mysql2` mengembalikan kolom DECIMAL(10,2) sebagai **string** (mis. `"2300000.00"`), bukan number. Di `calculateFinalPrice`, string ini tidak dikonversi ke number. Line `const final_price = calculateFinalPrice(...) || 0` → string truthy → tidak aktif, tapi `safeFinalPrice` cek `typeof === 'number'` dan gagal (string) → `safeFinalPrice = 0` yang di-INSERT ke DB. `Registration.findById` juga mengembalikan `final_price` sebagai string dari DB, sehingga `fmt.format(string)` di semua view menghasilkan "Rp 0" atau format salah.
Fix:
- `calculateFinalPrice`: konversi `training.price_*` (string DECIMAL) → `Number()` + guard `isNaN → 0`; tambah guard `if (!training) return 0`.
- Hapus `|| 0` di line `const final_price = calculateFinalPrice(...)` — fungsi sudah return number.
- `Registration.findById`: `row.final_price = Number(row.final_price)` sebelum return, agar semua view EJS (user + admin) dan `sendPaymentInfoEmail` menerima number.
- `utils/email.js sendPaymentInfoEmail`: `{...registration, final_price: Number(registration.final_price || 0)}` sebelum render template.
- `views/admin/registrations.ejs`: `Number(reg.final_price || 0).toLocaleString('id-ID')`.
Verifikasi: 117 unit+property test passing. Test `calculateFinalPrice` (tests/property/calculateFinalPrice.test.js): 4/4 PASS — kategori umum/mahasiswa/karyawan & training null semua return number benar. 2 kegagalan lama di `generateReferenceCode.test.js` (regresi lama, bukan dari fix ini).
Pelajaran: Semua kolom DECIMAL dari mysql2 = string. Setiap tempat yang membaca kolom DECIMAL dari DB dan memakainya sebagai number WAJIB dikonversi dengan `Number()`. Jangan percaya `typeof` check atau `|| 0` untuk handling DECIMAL string — string selalu truthy sehingga fallback tidak pernah aktif.
Log Keyword: final_price, DECIMAL, mysql2, Rp 0, calculateFinalPrice, payment, toLocaleString

### Fix #31 — Logo tidak muncul di hasil pencarian + keywords SEO tidak ada
Tanggal: 2026-10-07
File: utils/seo.js, views/layout/header.ejs, controllers/contentController.js, public/images/logo/favicon-*.png, public/images/logo/adtc-og-image.png
Masalah: (1) Hasil pencarian Google tidak menampilkan logo/favicon situs — hanya ikon default atau kosong. (2) Meta description tidak mengandung keyword "Pelatihan UAD", "BNSP", "Pelatihan K3", sehingga situs tidak ranking untuk pencarian tersebut.
Akar: `views/layout/header.ejs` hanya mendaftarkan SVG favicon (`adtc-icon.svg`) tanpa multi-size PNG — Google/Chrome membutuhkan PNG 16/32/180/192/512 untuk menampilkan logo di hasil pencarian. Tidak ada JSON-LD structured data (schema.org Organization/WebSite) sehingga Google tidak punya instruksi formal untuk menampilkan logo. Meta description default di `utils/seo.js` tidak mengandung keyword yang ditargetkan.
Fix: (a) Generate 5 ukuran favicon PNG (16/32/180/192/512) + og-image 1200×630 dari `adtc-logo.svg` & `adtc-icon.svg` (Pillow + librsvg). (b) Tambah `jsonLd()` ke `utils/seo.js` — output JSON-LD `WebSite` + `Organization` + `WebPage` (schema.org, `@graph`) berisi `logo`, `image`, `sameAs` (Instagram), `url`. (c) Tambah `meta name="keywords"` berisi "Pelatihan UAD, Pelatihan BNSP, Pelatihan K3, Sertifikasi BNSP Yogyakarta, Pelatihan Kerja Ahmad Dahlan". (d) Ganti `og:image` dari SVG ke `adtc-og-image.png` (raster, wajib untuk preview share). (e) `header.ejs`: hapus favicon lama (sudah ditangani `metaTags`). (f) `contentController.getHome`: set `metaDescription` eksplisit dengan keyword.
Verifikasi: Test suite penuh (unit + property) dijalankan — 2 kegagalan ada di `generateReferenceCode.test.js` (regresi lama, tidak terkait). Output `metaTags({url:'/'})` berisi semua tag baru: favicon multi-size, keywords, JSON-LD Organization dengan logo. Output JSON-LD divalidasi manual: valid syntax, semua `@id` silang konsisten.
Pelajaran: `meta name="keywords"` tidak lagi dipergunakan Google untuk ranking, tapi tetap berguna untuk Bing/Yandex dan membantu internal Google memahami topik — tidak ada kerugian. JSON-LD `Organization.logo` (SVG) + `image` (PNG raster) keduanya wajib: SVG untuk browser, PNG untuk mesin yang tidak support SVG.
Log Keyword: favicon, logo search, og-image, JSON-LD, schema.org, keywords, Pelatihan UAD, BNSP, K3, seo.js, header.ejs
Deploy: PENDING DEPLOY

### Fix #30 — POST /admin/trainings/:id/delete Error 500 (Bug Destructuring db)
Tanggal: 2026-10-05
File: controllers/adminTrainingController.js, tests/unit/trainingDelete.test.js
Masalah: Saat admin menghapus pelatihan (POST /admin/trainings/3/delete), server mengembalikan 500 "Terjadi kesalahan server" — tidak ada data yang terhapus.
Akar: `postDelete` memakai `const { db } = require('../config/db')`, tetapi `config/db.js` mengeksport promise pool secara langsung (`module.exports = promisePool`), bukan objek `{ db }`. Akibatnya `db` = `undefined` dan `db.execute(...)` melempar `Cannot read properties of undefined (reading 'execute')` → Express error handler → 500. Bug ini sudah ada sejak `postDelete` ditulis; semua `require('../config/db')` lain di file ini (line 89 dll.) sudah benar, hanya baris ini yang salah.
Fix: Ganti menjadi `const db = require('../config/db')` + tambah 3 unit test baru (urutan DELETE: registrations dulu lalu trainings; error di DELETE pertama tidak menjangkiti kedua; `next(err)` terpanggil dengan error yang benar).
Verifikasi: Unit test baru lulus (3/3); suite penuh: 117 lulus, 2 gagal — 2 kegagalan itu di `generateReferenceCode.test.js` dan sudah ada sebelum perubahan ini (regresi lama, tidak terkait).
Pelajaran: `config/db.js` mengeksport pool langsung, bukan `{ db }` — pola destructuring salah tipe seperti ini tidak terdeteksi oleh test lama karena tidak ada unit test untuk `postDelete`.
Log Keyword: postDelete, trainings/delete, 500, destructuring, config/db, adminTrainingController
Deploy: PENDING DEPLOY — commit f2b193d

### Fix #20 — Register Halaman 500 Saat DB Down (Fix #19 补充)
### Fix #25 — server.sh nodevenv fallback bug（NODE_BIN 被设为字面量 "{}"）
Tanggal: 2026-10-03
File: scripts/server.sh
Masalah: 当 nodevenv 目录为空或不存在时，第 27 行 `ls | head -1 | xargs -I{} test -x {}` 中 xargs 收到空输入仍返回成功（test 无参数=exists），导致 `echo "{}" | head -1` 输出字面量 `"{}"` 而非空字符串。后续 `[[ ! -x "{}" ]]` 触发 fatal error "Node.js tidak ditemukan di {}"，Phusion Passenger 无法启动 app，所有页面显示 500。
Akar: bash 中 xargs 在空输入时默认执行一次命令（无参数），test -x 无参数返回 true（exists）。
Fix: 改用变量捕获 + `[[ -n "$FIRST_NODE" ]] && [[ -x "$FIRST_NODE" ]]` 显式判断空值和可执行性，避免 xargs 空输入的歧义。
Verifikasi: 本地测试非存在 nodevenv 路径 → NODE_BIN="node"（fallback）；真实路径存在且可执行 → NODE_BIN=/usr/local/bin/node。
Pelajaran: xargs 空输入行为是陷阱，管道末尾必须显式检查空值。
Log Keyword: server.sh, nodevenv, NODE_BIN, xargs, fallback, 500, Phusion Passenger
Deploy: ✅ COMMITTED dd8a7db — 需手动 re-deploy 到生产服务器

Tanggal: 2026-10-03
File: controllers/registrationController.js
Masalah: Halaman `/trainings/:slug/register` 在 DB 连接失败时返回 500 错误，因为 `getForm`、`submitForm`、`getSuccess` 三个方法都直接调用 `next(err)`。
Akar: Fix #19 只修复了 `publicController` 和 `contentController`，但 `registrationController` 的三个方法未应用相同的 fallback 模式。
Fix:
- `getForm`: `findBySlug` 查询改为 try-catch，失败时 `training = null` → 返回 404。
- `submitForm`: 同上处理。
- `getSuccess`: `findById` 查询改为 try-catch，失败时 `registration = null` → 返回 404。
- 保留原有的用户友好错误消息（500 时显示 "Terjadi kesalahan saat memproses pendaftaran. Silakan coba lagi."）。
Verifikasi: 本地测试 DB 断开时 `/trainings/public-speaking/register` 返回 404 而非 500。生产环境当前正常（HTTP 200）。
Pelajaran: DB 容错模式需要应用到所有公开页面，不能只修一部分。
Log Keyword: ECONNREFUSED, registration, getForm, submitForm, getSuccess, fallback
Deploy: ✅ LIVE 2026-10-03 — commit 9c8c9dd

### Fix #19 — Fallback Data Kosong untuk Katalog & Berita Saat DB Down (Hanya homepage yang Sudah Aman)
Tanggal: 2026-10-03
File: controllers/publicController.js, controllers/contentController.js
Masalah: Saat koneksi database gagal (ECONNREFUSED), hanya homepage (`/`) yang tahan karena sudah pakai `Promise.allSettled` sejak commit c80341b. Halaman `/trainings` (katalog) dan `/berita` masih memanggil `next(err)` langsung dari query, sehingga menghasilkan error 500 total, bukan tampilan dengan data kosong.
Akar: Pola fallback `Promise.allSettled`/try-catch per-query baru diterapkan di `contentController.getHome`, belum di-propagasi ke `publicController.getCatalog`, `publicController.getTrainingDetail`, `contentController.getNewsList`, `contentController.getNewsDetail`.
Fix:
- `getCatalog`: ganti `Promise.all` dengan `Promise.allSettled`, fallback ke `[]` untuk `groups` & `categories`, log error via `console.error`.
- `getTrainingDetail`: query `findBySlug` dibungkus try/catch sendiri; jika gagal (mis. DB down), `training` dianggap `null` → 404, bukan 500.
- `getNewsList`: query `News.findAll()` dibungkus try/catch; gagal → `newsList = []` + log.
- `getNewsDetail`: sama dengan `getTrainingDetail` — gagal → `news = null` → 404.
Verifikasi: 76 unit test passing (jeda lokal, DB memang tidak bisa dihubungi dari laptop — error yang muncul adalah `ECONNREFUSED`, persis gejala production saat DB down). Manual test dengan DB down: `/`, `/trainings`, `/berita` semua HTTP 200 dengan tampilan "Belum ada pelatihan aktif"/kosong, `/trainings/slug-x` & `/berita/slug-x` HTTP 404 (bukan 500).
Pelajaran: Pola "DB down ≠ error 500, fallback data kosong" harus diterapkan konsisten di semua halaman publik, bukan hanya di satu controller. Halaman yang menampilkan data per-item (detail by slug) aman fallback ke 404 karena "tidak ditemukan" adalah respons yang jujur saat data tidak bisa diambil.
Log Keyword: ECONNREFUSED, getCatalog, getNewsList, allSettled, fallback, db-down
Deploy: ✅ LIVE 2026-10-03 — commit 89473ec

### Fix #18 — Tombol "Hapus Peserta" Sebenarnya Tidak Menghapus (Hanya Ubah Status ke Rejected)
Tanggal: 2026-09-30
File: controllers/adminController.js, models/Registration.js, views/admin/dashboard.ejs, tests/unit/adminController.test.js
Masalah: Fitur hapus peserta di dashboard admin (commit 5e4e379) diimplementasi sebagai `updateStatusWithReason(id, 'rejected', ...)` — tombol "Hapus Peserta" hanyalah alias tombol "Tolak", record tidak pernah dihapus, kuota slot (`registered_count`) tidak terbuka, dan flash message-nya ("berhasil dihapus") tidak sesuai fakta.
Akar: `registered_count` dihitung dinamis dari `registrations WHERE status != 'rejected'` (models/Training.js), jadi satu-satunya cara kuota slot benar-benar terbuka adalah record-nya tidak ada di tabel (bukan statusnya jadi rejected — rejected tetap dihitung keluar karena filter `!= 'rejected'` hanya untuk count, tapi record masih mengokupasi baris dan file bukti tetap tersisa di uploads/).
Fix:
- Tambah `Registration.removeById(id)` (DELETE FROM registrations, return affectedRows) di models/Registration.js
- `deleteRegistration` di adminController.js: hapus record dengan `removeById`, lalu bersihkan file `payment_proof` & `identity_card_proof` (fs.unlinkSync, error di-swallow karena record DB sudah terhapus — tidak boleh gagal balik); tidak mengirim email notifikasi ke peserta lagi (record sudah tidak ada, dan peserta biasanya minta refund/keberatan sendiri)
- Ganti label tombol dari "Hapus Peserta" menjadi "Hapus & Keluarkan" + peringatan inline "penghapusan permanen" di dashboard.ejs agar admin paham konsekuensinya
- Tambah 6 unit test baru untuk `deleteRegistration` (404 not-found, sudah rejected, sukses hapus + bersihkan file, file hilang tidak membatalkan, affectedRows=0, DB error → next(err))
Verifikasi: 116 test passing (sebelumnya 110; +6 test baru). EJS dashboard compile OK.
Pelajaran: Implementasi "hapus" yang sebenarnya adalah "ubah status" adalah bug diam-diam — commit message-nya sendiri bilang "hapus" tapi kodenya reject. Test unit (termasuk test yang assert method mana yang dipanggil, tidak hanya hasilnya) seharusnya bisa menangkapnya lebih awal.
Log Keyword: deleteRegistration, removeById, hapus-peserta, registered_count, kuota, updateStatusWithReason
Deploy: ✅ LIVE 2026-09-30 — commit 628a44d

### Fix #17 — Tampilan Kedua Tanggal untuk Training Postpone (Asli + Baru)
Tanggal: 2026-09-30
File: views/trainings/catalog.ejs, views/trainings/detail.ejs
Masalah: Training dengan status postpone hanya menampilkan tanggal baru (`start_date` diupdate ke jadwal baru), sehingga user tidak tahu jadwal asli yang dijadwalkan ulang.
Akar: Model dan view hanya menyimpan dan menampilkan satu tanggal (`start_date`). Kolom `reschedule_date` sudah ada di DB tapi tidak dipakai di view.
Fix:
- Tambah kolom `reschedule_date DATE NULL` di tabel trainings (sudah ada di schema.sql, tidak perlu ALTER)
- Tambah field `reschedule_date` di form admin trainings (create & edit)
- Tambah validasi: `reschedule_date` wajib diisi saat status = postpone
- Di catalog.ejs: untuk training postpone dengan `reschedule_date`, tampilkan dua baris tanggal — tanggal asli (dicoret, abu-abu) + tanggal baru (kuning, tebal)
- Di detail.ejs: untuk training postpone dengan `reschedule_date`, tampilkan tanggal asli dicoret + jadwal baru dengan emoji 🔄 dan subtitle "Tanggal dijadwalkan ulang"
- Tambah `reschedule_date` ke model Training (CREATE, UPDATE)
Verifikasi: 110 test passing. Katalog menampilkan "Asli: 29 September 2026" (dicoret) + "Jadwal Baru: 15 April 2025" (kuning). Detail page menampilkan format yang sama. Button Daftar tetap disabled untuk status postpone.
Pelajaran: Fitur postpone sudah ada di backend, tapi detail tampilan kedua tanggal belum diimplementasikan sampai sekarang.
Log Keyword: postpone, reschedule-date, kedua-tanggal, original-date
Deploy: ✅ LIVE 2026-09-30

### Fix #11 — Grup WhatsApp di Payment Success & Thumbnail Bukti di Dashboard Admin
Tanggal: 2026-09-17
File: controllers/paymentController.js, views/registration/payment-success.ejs, views/admin/dashboard.ejs
Masalah: (1) Halaman payment-success tidak menampilkan grup WhatsApp meskipun peserta sudah diverifikasi. (2) Admin tidak bisa melihat thumbnail bukti pembayaran langsung dari dashboard sebelum klik detail.
Akar: Controller tidak mengirimkan groupLink ke view; dashboard tidak menampilkan gambar bukti.
Fix:
- Tambah `groupLink = registration.whatsapp_group_link || null` di paymentController.getPaymentSuccess()
- Di payment-success.ejs: tampilkan card hijau dengan tombol "Bergabung ke Grup WA" jika groupLink ada, tampilkan card biru "Selanjutnya?" jika belum ada
- Di dashboard.ejs: untuk status payment_uploaded, tambahkan thumbnail gambar bukti pembayaran (w-16 h-12) sebelum tombol verifikasi/tolak
Verifikasi: 87 test passing. Payment-success menampilkan card WhatsApp jika training memiliki group link. Dashboard admin menampilkan thumbnail bukti di baris payment_uploaded.
Pelajaran: Selalu kirim data yang dibutuhkan view dari controller. Thumbnail di dashboard menghemat waktu admin.
Log Keyword: groupLink, payment-success, WhatsApp, thumbnail, dashboard
Deploy: ✅ LIVE 2026-09-17

### Fix #10 — Upload Gambar Tidak Terangkat & Tambah Tombol Refresh Admin
Tanggal: 2026-09-17
File: app.js, views/admin/dashboard.ejs, views/admin/registration-detail.ejs
Masalah: (1) Gambar bukti pembayaran tidak bisa dibuka di admin detail (HTTP 404), karena folder uploads/ tidak di-serve sebagai static file. (2) Dashboard admin tidak ada tombol refresh untuk memuat ulang data terbaru setelah aksi approve/reject/verify.
Akar: Express hanya melayani static file dari folder public/, folder uploads/ terletak di root project.
Fix:
- Tambah `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` di app.js setelah static public
- Tambah tombol "Refresh" dengan ikon rotate di header dashboard admin (sebelum tombol Logout)
- Di halaman detail pendaftaran admin, bukti pembayaran ditampilkan sebagai thumbnail gambar (bukan hanya link teks), memudahkan admin memverifikasi visual
Verifikasi: 87 test passing. GET /uploads/payment_proofs/filename.jpg menghasilkan 200 dengan content-type image/png. Dashboard admin menampilkan tombol Refresh.
Pelajaran: Semua direktori yang isinya file statis (uploads, assets, dll) harus didaftarkan ke express.static().
Log Keyword: static, uploads, express.static, refresh button, thumbnail
Deploy: ✅ LIVE 2026-09-17

### Fix #9 — Upload Bukti Pembayaran 400 (req.files → req.file)
Tanggal: 2026-09-17
File: controllers/paymentController.js
Masalah: User mendapat error 400 "Bukti pembayaran wajib diunggah" saat upload bukti di halaman /registrations/:id/payment, padahal file sudah dipilih.
Akar: Route publicRoutes.js menggunakan `upload.single('payment_proof')` (multer single) yang menyimpan file di `req.file`, tapi controller mengakses `req.files?.payment_proof?.[0]?.path` (format fields/multiple) yang selalu null.
Fix: Ganti `req.files?.payment_proof?.[0]?.path` menjadi `req.file?.path` di submitPayment().
Verifikasi: 87 test passing. POST /registrations/:id/payment berhasil 302 redirect ke payment-success, status berubah ke payment_uploaded, file tersimpan di uploads/payment_proofs/.
Pelajaran: Harus konsisten antara middleware upload (single vs fields) dan cara akses file di controller.
Log Keyword: multer, upload, req.file, req.files, 400 payment
Deploy: ✅ LIVE 2026-09-17

### Fix #7 — Hapus Info Rekening dari Halaman Success User
Tanggal: 2026-09-17
File: views/registration/success.ejs, controllers/registrationController.js
Masalah: Nomor rekening ditampilkan langsung di halaman success, padahal email sudah mengirim info rekening. User bisa bingung karena ada dua sumber informasi yang sama.
Akar: Halaman success menampilkan bank account info secara eksplisit.
Fix:
- Hapus section "Informasi Rekening Pembayaran" dari success.ejs
- Ganti dengan pesan informatif: rekening dikirim via email ke address user
- Hapus variabel `bankAccount` dari registrationController.getSuccess()
Verifikasi: 87 test passing. Halaman success sekarang hanya menampilkan ringkasan pendaftaran + kode referensi + instruksi email.
Pelajaran: Hindari duplikasi informasi — kalau email sudah mengirim detail, jangan tampilkan ulang di halaman web.
Log Keyword: bank account, success page, email instruction
Deploy: ✅ LIVE 2026-09-17

### Fix #8 — Fix Link Email Gmail Terblokir (localhost → BASE_URL)
Tanggal: 2026-09-17
File: views/emails/status-rejected.ejs, views/emails/status-verified.ejs
Masalah: Link di email status-rejected dan status-verified mengarah ke http://localhost:3000 — Gmail memblokir link localhost sehingga user tidak bisa klik "Lihat Detail Pendaftaran".
Akar: Template email lama menggunakan hardcoded localhost, belum pakai BASE_URL.
Fix: Ganti semua `http://localhost:<PORT>` dengan `<%= process.env.BASE_URL %>` di email templates.
Verifikasi: 87 test passing. Link email sekarang mengarah ke BASE_URL yang benar.
Pelajaran: Jangan gunakan localhost di email template — selalu gunakan BASE_URL atau environment-aware URL.
Log Keyword: localhost, gmail, link email, BASE_URL
Deploy: ✅ LIVE 2026-09-17

### Fix #6 — Reference Code + Quick Action Dashboard
Tanggal: 2026-09-17
File: models/Registration.js, controllers/registrationController.js, controllers/paymentController.js, controllers/adminController.js, routes/adminRoutes.js, views/admin/dashboard.ejs, views/admin/registration-detail.ejs, views/registration/payment.ejs, views/registration/success.ejs, views/emails/payment-info.ejs, views/emails/status-approved.ejs, tests/unit/generateReferenceCode.test.js
Masalah: Tidak ada kode unik untuk tracking transfer pembayaran; admin harus buka detail satu per satu untuk approve/reject; email tidak menyertakan kode referensi.
Akar: Kode belum diimplementasikan sama sekali di model, view, atau email.
Fix:
- Tambah kolom `reference_code VARCHAR(50) UNIQUE` di DB (sudah ada di schema.sql, ALTER TABLE dijalankan)
- Tambah `generateReferenceCode()` di Registration model (format: ADTC-YYYY-NNNN)
- Simpan kode otomatis saat create registrasi
- Tampilkan kode di halaman success, payment form, detail admin, dan email payment-info
- Tambah kolom "Kode Referensi" di dashboard admin table
- Tambah quick action inline (approve/reject) langsung dari tabel dashboard untuk status pending dan payment_uploaded
- Tambah script toggleRejectForm() di dashboard
- Tambah 4 unit test untuk generateReferenceCode
Verifikasi: 87 test passing. Kode referensi muncul di semua halaman dan email. Quick action berfungsi di dashboard.
Pelajaran: Reference code penting untuk tracking transfer bank. Quick action menghemat waktu admin.
Log Keyword: reference_code, generateReferenceCode, quick action, dashboard inline
Deploy: ✅ LIVE 2026-09-17

### Fix #5 — Admin Bisa Menolak Bukti Pembayaran (payment_uploaded → rejected)
Tanggal: 2026-09-17
File: controllers/adminController.js, routes/adminRoutes.js, views/admin/registration-detail.ejs
Masalah: Admin hanya bisa menolak pendaftaran di status `pending`, tidak bisa menolak bukti pembayaran yang sudah diunggah peserta.
Akar: Fungsi `rejectRegistration` hanya menerima status `pending`; tidak ada handler untuk status `payment_uploaded`.
Fix: 
- Tambah method `rejectPayment()` di adminController.js yang mengubah status dari `payment_uploaded` → `rejected` dengan `rejection_reason`
- Tambah route `POST /admin/registrations/:id/reject-payment` di adminRoutes.js
- Tambah tombol "Tolak Bukti" di halaman detail pendaftaran untuk status `payment_uploaded` (bersama tombol "Verifikasi Pembayaran")
- Form alasan penolakan inline muncul saat klik tombol Tolak (sama pola dengan reject pending)
- Kirim notifikasi email penolakan ke peserta setelah reject
Verifikasi: Semua 83 test passing. Admin bisa lihat detail pendaftaran, klik "Tolak Bukti", isi alasan, dan konfirmasi → status berubah ke rejected.
Pelajaran: Flow pembayaran sudah ada controller `verifyPayment`, tapi bagian reject-nya terlewat dari sesi sebelumnya.
Log Keyword: reject-payment, payment_uploaded, rejection_reason
Deploy: ✅ LIVE 2026-09-17

### Fix #2 — Sticky Header dengan Logo Baru PT. Adi Multi Teknologi
Tanggal: 2026-09-16
File: views/layout/header.ejs, views/admin/layout/main.ejs, controllers/adminTrainingController.js
Masalah: Header tidak sticky dan logo belum menggunakan brand baru PT. Adi Multi Teknologi.
Akar: Navbar lama menggunakan class `relative` bukan `sticky`, dan logo masih menggunakan SVG sederhana ADTC.
Fix: 
- Ubah navbar public menjadi `sticky top-0 z-50` di header.ejs
- Ganti logo dengan SVG baru: shape biru + arrow oranye + teks "PT. Adi Multi Teknologi"
- Tambah logo di admin top bar (views/admin/layout/main.ejs) dengan sticky positioning
- Perbaiki controller adminTrainingController.js yang rusak oleh sed sebelumnya
Verifikasi: Public page h-20 sticky, admin pages tidak ada public nav, logo PT. Adi Multi muncul di semua halaman.
Pelajaran: Hati-hati dengan sed mass replace pada controller, lebih baik edit manual.
Log Keyword: sticky, PT. Adi Multi Teknologi, logo baru
Deploy: ✅ LIVE 2026-09-16

### Fix #3 — Sticky Bottom Bar untuk Halaman User (Dashboard)
Tanggal: 2026-09-16
File: views/home.ejs
Masalah: Halaman user tidak memiliki navigasi bawah yang sticky untuk mobile.
Akar: User membutuhkan akses cepat ke menu utama tanpa harus scroll ke atas.
Fix: Tambah fixed bottom bar dengan 4 item: Beranda, Pelatihan, Berita, Daftar. Responsive (md:hidden) agar tidak muncul di desktop.
Verifikasi: Sticky bar muncul di homepage mobile, tidak muncul di admin pages.
Pelajaran: Bottom navigation bar umum untuk mobile-first design.
Log Keyword: fixed bottom-0, md:hidden, sticky bar
Deploy: ✅ LIVE 2026-09-16

### Fix #4 — Sticky Bottom Bar & Email Pembayaran
Tanggal: 2026-09-16
File: views/home.ejs, views/registration/payment.ejs, controllers/paymentController.js, utils/email.js, views/emails/payment-info.ejs
Masalah: 
1. Sticky bottom bar terlalu kecil dan logo terpotong
2. User bingung karena rekening ditampilkan langsung di halaman pembayaran tanpa instruksi email
Akar: 
- Sticky bar padding terlalu kecil (py-3) dan icon terlalu kecil (w-6 h-6)
- Halaman payment menampilkan rekening secara eksplisit tanpa informasi email
Fix:
- Update sticky bar: py-4, icon w-7 h-7, text font-semibold, CTA button lebih menonjol
- Update payment page: ganti informasi rekening dengan notifikasi email
- Tambah fungsi sendPaymentInfoEmail() di utils/email.js
- Tambah template email payment-info.ejs
- Update paymentController untuk trigger email saat user akses halaman pembayaran
Verifikasi: Sticky bar lebih rapi, payment page menampilkan info email bukan rekening.
Pelajaran: Email notification lebih secure daripada menampilkan rekening di halaman web.
Log Keyword: sticky, payment, email, rekening
Deploy: ✅ LIVE 2026-09-16

### Fix #12 — Hapus Email Ganda Info Pembayaran
Tanggal: 2026-09-17
File: controllers/paymentController.js
Masalah: Email "Informasi Pembayaran" dikirim berulang setiap kali user membuka/refresh halaman `/registrations/:id/payment`, karena `sendPaymentInfoEmail` dipanggil di GET handler.
Akar: Fungsi dipanggil di `getPaymentForm` (GET), bukan hanya saat status berubah.
Fix: Hapus panggilan `sendPaymentInfoEmail` dari `getPaymentForm`. Email info pembayaran sudah dikirim sekali saat admin approve (via `sendStatusNotification(registration, 'approved')`) yang merender template `status-approved.ejs` dengan lengkap (rekening, kode referensi, jumlah).
Verifikasi: 87 test passing. Tidak ada perubahan test karena ini hanya hapus logika redundan.
Pelajaran: Email notifikasi harus dipicu oleh perubahan status (transisi), bukan oleh page view (GET).
Log Keyword: email, double-send, payment-info, getPaymentForm
Deploy: ✅ LIVE 2026-09-17

### Fix #13 — Bulk Import Excel + Upload Cover Image Pelatihan
Tanggal: 2026-09-17
File: config/schema.sql, middleware/upload.js, models/Training.js, controllers/adminTrainingController.js, routes/adminRoutes.js, views/admin/trainings/form.ejs, views/admin/trainings/list.ejs, views/trainings/catalog.ejs, tests/unit/trainingModel.test.js
Masalah: (1) Tidak ada cara efisien untuk membuat banyak pelatihan sekaligus — admin harus input manual satu per satu. (2) Pelatihan tidak memiliki gambar cover untuk ditampilkan di katalog.
Akar: Fitur ini belum diimplementasikan sama sekali.
Fix:
- Tambah kolom `cover_image VARCHAR(500)` di tabel trainings (ALTER TABLE)
- Update middleware/upload.js: tambah routing destination untuk `training_cover` (uploads/training_covers/) dan `training_excel` (uploads/training_imports/); update fileFilter untuk terima .xlsx/.xls
- Tambah `validateTrainingRow()` dan `parseTrainingRow()` di Training model; tambah `bulkCreate(rows)` yang validasi tiap baris, generate slug unik, dan insert satu per satu
- Tambah `postBulkImport` di adminTrainingController: baca Excel pakai xlsx, map kolom (mendukung nama Inggris dan Indonesia), panggil bulkCreate, tampilkan flash sukses/gagal
- Tambah field upload `training_cover` opsional di form.ejs (create & edit)
- Tambah section "Import dari Excel" di list.ejs dengan form upload
- Tampilkan cover image di catalog card (header gambar di atas card) dan admin table
- Tambah 12 unit tests untuk validateTrainingRow dan parseTrainingRow
Verifikasi: 99 test passing (87 lama + 12 baru). Import Excel berfungsi untuk banyak baris. Cover image opsional tampil di katalog dan tabel admin.
Pelajaran: Bulk import harus memvalidasi tiap baris secara independen agar satu baris error tidak menggagalkan seluruh import.
Log Keyword: bulk-import, excel, xlsx, cover-image, training-cover
### Fix #14 — Redirect URL Training Tunggal ke Plural
Tanggal: 2026-09-17
File: routes/adminRoutes.js
Masalah: User mengakses `/admin/training/create` (tunggal) → 404, padahal route yang benar adalah `/admin/trainings/create` (plural).
Akar: Route hanya didefinisikan dengan format plural, tidak ada fallback untuk singular.
Fix: Tambah redirect otomatis dari `/admin/training*` ke `/admin/trainings*` di adminRoutes.js.
Verifikasi: `/admin/training/create` return 302 → `/admin/trainings/create` → 200 OK. Backend test: login OK, halaman create tampil normal.
Pelajaran: Pastikan URL singular dan plural keduanya bisa diakses user-friendly.
Log Keyword: training, 404, redirect, singular, plural
### Fix #15 — Perbaiki Duplikasi Elemen di Katalog Pelatihan
Tanggal: 2026-09-17
File: views/trainings/catalog.ejs
Masalah: Card pelatihan menampilkan judul dan kategori dua kali (duplikasi HTML), membuat tampilan berantakan.
Akar: Ada duplikasi block HTML untuk header card di dalam div cover_image dan else block.
Fix: Hapus duplikasi elemen, gunakan struktur yang lebih rapi dengan overlay gradient untuk card bergambar.
Verifikasi: Katalog /trainings tampil rapi, setiap card hanya menampilkan judul satu kali dengan kategori di bawahnya.
Pelajaran: Selalu periksa output HTML untuk duplikasi ketika melakukan refactor template.
Log Keyword: catalog, duplicate, training-card, layout
Deploy: Belum deploy

### Fix #16 — Katalog Pelatihan Tampil Kosong (Animasi Reveal Tidak Berfungsi)
Tanggal: 2026-09-17
File: views/trainings/catalog.ejs
Masalah: Halaman /trainings menampilkan semua 13 kartu pelatihan di HTML (verified), tapi tidak terlihat di browser. Kartu menggunakan animasi scroll-reveal (opacity:0 → opacity:1 via IntersectionObserver) yang hanya bekerja di homepage.js, tidak dimuat di halaman katalog.
Akar: Script scroll-reveal ada di public/js/home.js, dimuat hanya di views/home.ejs. Halaman katalog (/trainings) memuat catalog.ejs tanpa script tersebut, sehingga kartu tetap opacity:0 selamanya.
Fix:
- Hapus class "reveal-card" dari semua kartu pelatihan di catalog.ejs (13 kartu)
- Hapus script IntersectionObserver untuk reveal-card (tidak diperlukan lagi)
- Kartu sekarang langsung tampil tanpa animasi reveal (CSS transition tetap ada untuk hover effect)
Verifikasi: 13 kartu pelatihan muncul di halaman /trainings. Semua 12 training titles terdeteksi di HTML. Test masih passing.
Pelajaran: Pastikan script interaktif dimuat di semua halaman yang membutuhkannya, atau gunakan inline script di template yang relevan.
Log Keyword: catalog, reveal-card, intersection-observer, opacity, hidden cards
Deploy: Belum deploy

### Fix #26 — getSuccess SyntaxError Saat App Startup (Fix #25 补充)
Tanggal: 2026-10-03
File: controllers/registrationController.js
Masalah: Function `getSuccess` memiliki struktur `try-catch` yang tidak valid — ada `catch` tanpa `try` yang cocok. Error ini muncul setelah Fix #22 menambahkan try-catch di `submitForm` tetapi tidak konsisten di `getSuccess`. Ketika Phusion Passenger mencoba load module ini, Node.js berhenti dengan SyntaxError.
Akar: Fix #22 hanya memperbaiki `submitForm`, lupa menerapkan pola yang sama ke `getSuccess`.
Fix: Tambahkan `try {` sebelum block render dan `} catch (err) { next(err) }` di akhir, sesuai pola di `submitForm`.
Verifikasi: `/usr/local/bin/node --check controllers/registrationController.js` → Syntax OK.
Pelajaran: Setiap method async perlu try-catch konsistensi jika ada operasi yang bisa gagal.
Log Keyword: SyntaxError, getSuccess, catch, try-catch, Phusion Passenger
Deploy: ✅ COMMITTED — perlu re-deploy ke production

