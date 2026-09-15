-- Reuses the exact Hero Slides CMS built for the homepage to also power
-- the Trending page's hero carousel, on both web and mobile -- an admin
-- picks which page a slide belongs to instead of two separate systems.
-- Existing rows backfill to 'homepage' via the column default, preserving
-- every slide that already exists.
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS placement VARCHAR(20) NOT NULL DEFAULT 'homepage';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hero_slides_placement_check'
  ) THEN
    ALTER TABLE hero_slides
      ADD CONSTRAINT hero_slides_placement_check CHECK (placement IN ('homepage', 'trending'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hero_slides_placement ON hero_slides(placement);
