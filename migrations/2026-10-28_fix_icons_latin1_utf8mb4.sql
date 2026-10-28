-- Konversi kolom icon dari latin1 → utf8mb4, lalu isi ulang emoji yang benar.
-- Jalankan di server:
--   mysql --default-character-set=utf8mb4 -u adtcuadi_adtc_app -p'...' adtcuadi_adtc_app < fix_icons_convert.sql
SET NAMES utf8mb4;

-- 1. Ubah charset kolom (data latin1 lama di-*transcode* ke utf8mb4)
ALTER TABLE categories MODIFY icon VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '';
ALTER TABLE services   MODIFY icon VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '';

-- 2. Set ulang emoji yang benar (pakai UNHEX untuk bypass negosiasi charset client)
UPDATE categories SET icon = UNHEX('F09F939A') WHERE anchor='pelatihan';         -- 📚
UPDATE categories SET icon = UNHEX('F09F92BC') WHERE anchor='konsultan';        -- 💼
UPDATE categories SET icon = UNHEX('F09F8FAD') WHERE anchor='in-house-training';-- 🏭
UPDATE categories SET icon = UNHEX('F09F8E81') WHERE anchor='pelatihan-gratis'; -- 🎁
UPDATE categories SET icon = UNHEX('F09F9585') WHERE anchor='bnsp';             -- 🏅
UPDATE categories SET icon = UNHEX('F09F93A3') WHERE anchor='awareness';        -- 📣
UPDATE categories SET icon = UNHEX('F09F8CFD') WHERE anchor='awareness-lingkungan'; -- 🌱
UPDATE categories SET icon = UNHEX('F09F93A3') WHERE anchor='awareness-umum';   -- 📣

-- 3. Fallback: icon yang masih kosong
UPDATE categories SET icon = UNHEX('F09F938B') WHERE icon='' ; -- 📋

-- 4. Verifikasi
SELECT anchor, icon, HEX(icon) AS hex FROM categories ORDER BY sort_order;
