-- Add explicit format key for digital asset variants (pdf, epub, mobi, etc.).

ALTER TABLE digital_assets
ADD COLUMN IF NOT EXISTS format_key VARCHAR(20);

UPDATE digital_assets
SET format_key = CASE
  WHEN mime_type ILIKE '%pdf%' THEN 'pdf'
  WHEN mime_type ILIKE '%epub%' THEN 'epub'
  WHEN mime_type ILIKE '%mobi%' THEN 'mobi'
  WHEN mime_type ILIKE '%azw%' THEN 'azw3'
  ELSE NULL
END
WHERE format_key IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'digital_assets_format_key_check'
  ) THEN
    ALTER TABLE digital_assets
    ADD CONSTRAINT digital_assets_format_key_check
    CHECK (
      format_key IS NULL OR
      format_key IN ('pdf', 'epub', 'mobi', 'azw3', 'html', 'audio')
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_digital_assets_product_format_active
  ON digital_assets(product_id, format_key, is_active);