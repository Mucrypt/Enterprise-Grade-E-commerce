-- ============================================================
-- Migration 058: Homepage content settings
-- ============================================================
-- Real, admin-editable copy for the homepage sections that were
-- previously hardcoded in each frontend's homepage.config.ts (web) /
-- homepageConfig.ts (mobile) -- headline, description and CTA text for
-- the hero, workshop-equipment banner, business-buyer banner, and
-- newsletter sections. Singleton row, same convention as
-- shipping_settings (migration 005): id INTEGER PRIMARY KEY DEFAULT 1,
-- one JSONB column per editable section so a future new editable
-- section doesn't need another migration.
--
-- Seeded with the REAL copy already live on both frontends today, so
-- applying this migration changes nothing visually until an admin
-- actually edits a field -- the frontends switch from reading their
-- local config file to reading this table (falling back to that same
-- local config if the request fails), not from new/different copy.
-- ============================================================

CREATE TABLE IF NOT EXISTS homepage_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    hero JSONB NOT NULL DEFAULT '{}'::jsonb,
    workshop_banner JSONB NOT NULL DEFAULT '{}'::jsonb,
    business_banner JSONB NOT NULL DEFAULT '{}'::jsonb,
    newsletter JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

INSERT INTO homepage_settings (id, hero, workshop_banner, business_banner, newsletter)
VALUES (
  1,
  '{
    "eyebrow": "PROFESSIONAL TOOLS & WORKSHOP EQUIPMENT",
    "headline": "Built for serious work.",
    "description": "Professional tools, machinery and workshop equipment for woodworking, construction, metalworking and skilled trades.",
    "primaryCtaLabel": "Shop Professional Tools",
    "primaryCtaTo": "/products",
    "secondaryCtaLabel": "Request a Quote",
    "secondaryCtaTo": "/contact"
  }'::jsonb,
  '{
    "eyebrow": "WORKSHOP EQUIPMENT",
    "headline": "Equip your workshop for the next level.",
    "description": "Discover woodworking machinery, professional workshop equipment and systems for growing businesses.",
    "primaryCtaLabel": "Explore Workshop Equipment",
    "primaryCtaTo": "/products",
    "secondaryCtaLabel": "Request Business Assistance",
    "secondaryCtaTo": "/contact"
  }'::jsonb,
  '{
    "heading": "Buying for a business?",
    "description": "Contact TechTools for product sourcing, bulk quantities, workshop equipment and professional purchasing enquiries.",
    "ctaLabel": "Talk to TechTools",
    "ctaTo": "/contact"
  }'::jsonb,
  '{
    "heading": "Stay equipped.",
    "description": "Get tool guides, product updates and professional offers from TechTools.",
    "ctaLabel": "Subscribe"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
