-- Creator submission and admin moderation workflow for digital books.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS publication_status VARCHAR(30);

UPDATE products
SET publication_status = 'published'
WHERE publication_status IS NULL
  AND is_active = true
  AND deleted_at IS NULL;

UPDATE products
SET publication_status = 'draft'
WHERE publication_status IS NULL;

ALTER TABLE products
ALTER COLUMN publication_status SET DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_publication_status_check'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_publication_status_check
    CHECK (
      publication_status IN ('draft', 'pending_review', 'approved', 'rejected', 'published')
    );
  END IF;
END
$$;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS rights_declared BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS rights_declared_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS creator_terms_accepted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_products_publication_status
  ON products(publication_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_review_queue
  ON products(product_kind, publication_status, submitted_for_review_at DESC)
  WHERE deleted_at IS NULL;