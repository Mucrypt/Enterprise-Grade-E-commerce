-- =====================================================
-- FIX CATEGORY_MEDIA TABLE SCHEMA
-- Aligns column names with application code expectations
-- =====================================================

-- Add mime_type column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'mime_type'
    ) THEN
        ALTER TABLE category_media ADD COLUMN mime_type VARCHAR(100);
    END IF;
END $$;

-- Add description column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'description'
    ) THEN
        ALTER TABLE category_media ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add video_duration column if not exists  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'video_duration'
    ) THEN
        ALTER TABLE category_media ADD COLUMN video_duration INTEGER;
    END IF;
END $$;

-- Rename 'type' to 'media_type' if 'type' exists and 'media_type' doesn't
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'media_type'
    ) THEN
        ALTER TABLE category_media RENAME COLUMN type TO media_type;
    END IF;
END $$;

-- Rename 'url' to 'file_path' if 'url' exists and 'file_path' doesn't
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'url'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'file_path'
    ) THEN
        ALTER TABLE category_media RENAME COLUMN url TO file_path;
    END IF;
END $$;

-- Add media_type column if it doesn't exist at all (fresh setup)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'media_type'
    ) THEN
        ALTER TABLE category_media ADD COLUMN media_type VARCHAR(20) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video'));
    END IF;
END $$;

-- Add file_path column if it doesn't exist at all (fresh setup)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'category_media' AND column_name = 'file_path'
    ) THEN
        ALTER TABLE category_media ADD COLUMN file_path TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Update index to use new column name if needed
DROP INDEX IF EXISTS idx_category_media_type;
CREATE INDEX IF NOT EXISTS idx_category_media_media_type ON category_media(media_type);

-- =====================================================
-- VERIFY FINAL SCHEMA
-- =====================================================
-- Expected columns after migration:
-- id, category_id, media_type, media_purpose, file_path, cdn_urls, 
-- file_size, mime_type, alt_text, title, position, description,
-- video_duration, thumbnail_url, width, height, format, duration,
-- created_at, updated_at
