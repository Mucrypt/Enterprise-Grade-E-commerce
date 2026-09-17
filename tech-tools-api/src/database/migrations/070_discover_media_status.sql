-- Discover post video/audio uploads used to transcode+upload synchronously
-- inside the create/update request -- ffmpeg on a real video plus a
-- Cloudinary upload routinely exceeds the admin dashboard's 120s axios
-- timeout, so every sufficiently long/large video upload eventually failed
-- outright, with no way to succeed regardless of how the timeout was tuned.
-- media_status decouples "the post exists" from "the media is ready":
-- video/audio uploads now insert immediately as 'pending' with video_url
-- still NULL, respond to the admin right away, and process in the
-- background -- see discover.controller.ts's processMediaInBackground.
ALTER TABLE discover_posts
  ADD COLUMN media_status VARCHAR(10) NOT NULL DEFAULT 'ready'
    CHECK (media_status IN ('pending', 'ready', 'failed')),
  ADD COLUMN media_error TEXT;

-- A pending video post has no video_url yet by design -- widen the
-- existing constraint (which required video_url on every video post) to
-- allow that one specific, temporary case.
ALTER TABLE discover_posts DROP CONSTRAINT discover_post_video_requires_url;
ALTER TABLE discover_posts ADD CONSTRAINT discover_post_video_requires_url
  CHECK (media_type != 'video' OR video_url IS NOT NULL OR media_status = 'pending');

-- The public feed and admin's default list both need to filter out
-- not-yet-ready posts (see discover.controller.ts) -- partial index since
-- the overwhelming majority of rows will be 'ready' once processed.
CREATE INDEX IF NOT EXISTS idx_discover_posts_media_status
  ON discover_posts(media_status) WHERE media_status != 'ready';
