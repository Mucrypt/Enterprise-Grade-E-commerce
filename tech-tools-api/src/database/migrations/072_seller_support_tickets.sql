-- Seller support ticketing -- a real threaded conversation between a
-- seller and admin staff, assignable to a specific staff member.
--
-- The existing customer /contact flow is NOT a real ticketing system --
-- it writes one row per submission into the generic email_messages
-- table (email_type='contact_form'), and a reply just overwrites a
-- single "lastReply*" summary in that row's metadata JSONB. There is no
-- thread, no status workflow beyond email-delivery state, no
-- assignment, and no way to tell a message came from a seller at all.
-- This is a clean, seller-only, real ticket schema -- deliberately not
-- reusing/migrating the customer contact-form data, per the founder's
-- explicit "seller-only system for now" decision.
--
-- support.view/support.manage already exist in staff-permissions.config.ts
-- (granted to ADMIN/MARKET_MANAGER/SUPPORT_AGENT) but nothing has ever
-- checked them -- this is the first real consumer.

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  -- Denormalized for convenience (avoids a join on every list/detail
  -- query) -- the seller's own user id, same seller_profiles.user_id.
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (category IN ('payouts', 'verification', 'product_listing', 'technical', 'other')),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  -- Nullable: an unassigned ticket sits in the shared queue until a
  -- staff member (or admin) claims it via the assign action.
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('seller', 'staff')),
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  -- Staff-only note, never shown to the seller -- cheap to add given the
  -- table already exists, and a real thing staff will want on day one.
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_seller ON support_tickets(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);
