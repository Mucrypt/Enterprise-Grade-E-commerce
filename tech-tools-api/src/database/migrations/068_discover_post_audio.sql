-- Optional per-post background audio, admin-uploaded (their own recording
-- or a track they have rights to use) -- not a shared/licensed music
-- catalog like TikTok's, which this store has no rights to replicate.
-- audio_label is free text the admin can type (e.g. "Workshop Ambience"),
-- shown in the feed in place of a generic "Original sound" fallback.
ALTER TABLE discover_posts
  ADD COLUMN audio_url TEXT,
  ADD COLUMN audio_label VARCHAR(120);
