-- Broadcast announcements to sellers -- a one-to-many message (a policy
-- change, a new feature), a genuinely different shape from the 1:1
-- support_tickets/support_messages thread (no back-and-forth, no
-- assignment). In-app only for this pass -- no bulk email. The codebase
-- already has a real rate-limited/retrying bulk-send queue
-- (newsletter.queue.ts) built for the much larger customer audience;
-- reusing that machinery for a much smaller, not-yet-proven seller
-- audience is more risk (untested mass-send path, SMTP limits, spam
-- flags) than value right now. Real per-seller read tracking still makes
-- this honest -- no fabricated "delivered" status, just a real read
-- count computed from seller_announcement_reads.

CREATE TABLE IF NOT EXISTS seller_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  -- NULL = every seller. Non-null restricts to sellers currently at that
  -- tier (evaluated at read time via seller_profiles.tier, not snapshotted
  -- -- an announcement about a tier's rules should stay visible to
  -- whoever is at that tier now, not just who was at it when it was sent).
  target_tier VARCHAR(20) CHECK (target_tier IN ('unverified', 'basic', 'trusted', 'pro')),
  created_by_admin_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_announcement_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES seller_announcements(id) ON DELETE CASCADE,
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (announcement_id, seller_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_announcements_created_at ON seller_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_announcement_reads_seller ON seller_announcement_reads(seller_profile_id);
