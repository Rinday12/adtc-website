-- Migration: tambah 3 kolom syarat promosi untuk kategori gratis di registrations
-- (Jalankan di cPanel → phpMyAdmin → database adtc_db)
--
-- ig_story_proof   : VARCHAR(500) — path file bukti post flyer di IG story (NULL-able)
-- wa_share_proof   : VARCHAR(500) — path file bukti share ke 3 grup WhatsApp (NULL-able)
-- post_comment_url : VARCHAR(500) — URL link komentar di postingan IG adtc_uad (NULL-able)
--
-- Ketiga kolom hanya di-filled untuk kategori gratis (is_free_tier = true).
-- NULL untuk kategori berbayar dan baris lama.

ALTER TABLE registrations
  ADD COLUMN ig_story_proof   VARCHAR(500) NULL AFTER social_proof;

ALTER TABLE registrations
  ADD COLUMN wa_share_proof   VARCHAR(500) NULL AFTER ig_story_proof;

ALTER TABLE registrations
  ADD COLUMN post_comment_url VARCHAR(500) NULL AFTER wa_share_proof;
