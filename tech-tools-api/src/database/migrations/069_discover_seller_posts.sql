-- Lets an approved seller author their own Discover posts (not just
-- admin/staff) -- discover_posts.seller_profile_id IS NULL still means
-- platform/admin content, exactly today's behavior. New posts created by
-- a seller are forced inactive until an admin approves them (see
-- discover.controller.ts's requireApprovedSeller + review endpoint).
ALTER TABLE discover_posts
  ADD COLUMN seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE SET NULL;

-- Mirrors brand_follows exactly -- a real per-user follow of a seller,
-- same shape as the existing brand-follow feature.
CREATE TABLE seller_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, seller_profile_id)
);
