-- ============================================
-- Blog System Schema - Production Ready
-- Supports rich content, media, SEO, categories, tags
-- ============================================

-- Blog Categories (separate from product categories)
CREATE TABLE blog_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    parent_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Tags
CREATE TABLE blog_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Authors (extends users table for author profiles)
CREATE TABLE blog_authors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    website_url VARCHAR(500),
    twitter_handle VARCHAR(100),
    linkedin_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'author' CHECK (role IN ('author', 'editor', 'contributor', 'guest')),
    is_active BOOLEAN DEFAULT TRUE,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Posts (main content table)
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    content_html TEXT, -- Rendered HTML from markdown/rich editor
    
    -- Featured Media
    featured_image_url VARCHAR(500),
    featured_image_alt VARCHAR(255),
    featured_video_url VARCHAR(500),
    featured_video_type VARCHAR(50), -- youtube, vimeo, uploaded
    
    -- Author & Category
    author_id UUID REFERENCES blog_authors(id) ON DELETE SET NULL,
    category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
    
    -- Publishing
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'scheduled', 'archived')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'password_protected')),
    password VARCHAR(255), -- For password protected posts
    published_at TIMESTAMP WITH TIME ZONE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),
    canonical_url VARCHAR(500),
    og_title VARCHAR(255),
    og_description TEXT,
    og_image_url VARCHAR(500),
    
    -- Reading & Engagement
    reading_time_minutes INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    
    -- Settings
    allow_comments BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    
    -- Tracking
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Blog Post Tags (many-to-many)
CREATE TABLE blog_post_tags (
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- Blog Post Media (images, videos, files within post content)
CREATE TABLE blog_post_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document', 'embed')),
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    title VARCHAR(255),
    alt_text VARCHAR(255),
    caption TEXT,
    description TEXT,
    
    -- For videos
    video_provider VARCHAR(50), -- youtube, vimeo, uploaded
    video_id VARCHAR(100),
    duration_seconds INTEGER,
    
    -- For embeds
    embed_code TEXT,
    embed_provider VARCHAR(100),
    
    -- Metadata
    file_name VARCHAR(255),
    file_size INTEGER, -- in bytes
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Comments
CREATE TABLE blog_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- For guest comments
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    author_website VARCHAR(500),
    author_ip VARCHAR(45),
    
    content TEXT NOT NULL,
    content_html TEXT,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'spam', 'trash')),
    like_count INTEGER DEFAULT 0,
    
    is_pinned BOOLEAN DEFAULT FALSE,
    is_author_reply BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Post Likes (for registered users)
CREATE TABLE blog_post_likes (
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

-- Blog Comment Likes
CREATE TABLE blog_comment_likes (
    comment_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id)
);

-- Blog Post Views (for analytics)
CREATE TABLE blog_post_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer VARCHAR(500),
    country VARCHAR(100),
    city VARCHAR(100),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Related Posts (manually curated or algorithm-based)
CREATE TABLE blog_related_posts (
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    related_post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) DEFAULT 'related' CHECK (relation_type IN ('related', 'series', 'sequel', 'prequel')),
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (post_id, related_post_id),
    CHECK (post_id != related_post_id)
);

-- Blog Series (for multi-part articles)
CREATE TABLE blog_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    cover_image_url VARCHAR(500),
    author_id UUID REFERENCES blog_authors(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Series Posts
CREATE TABLE blog_series_posts (
    series_id UUID REFERENCES blog_series(id) ON DELETE CASCADE,
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL,
    PRIMARY KEY (series_id, post_id)
);

-- Indexes for performance
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX idx_blog_posts_featured ON blog_posts(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_deleted ON blog_posts(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX idx_blog_categories_active ON blog_categories(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_blog_tags_slug ON blog_tags(slug);

CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_status ON blog_comments(status);
CREATE INDEX idx_blog_comments_parent ON blog_comments(parent_id);

CREATE INDEX idx_blog_post_views_post ON blog_post_views(post_id);
CREATE INDEX idx_blog_post_views_date ON blog_post_views(viewed_at);

CREATE INDEX idx_blog_authors_user ON blog_authors(user_id);
CREATE INDEX idx_blog_authors_slug ON blog_authors(slug);

-- Full-text search indexes
CREATE INDEX idx_blog_posts_search ON blog_posts USING gin(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || content));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

CREATE TRIGGER trigger_blog_categories_updated_at
    BEFORE UPDATE ON blog_categories
    FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

CREATE TRIGGER trigger_blog_authors_updated_at
    BEFORE UPDATE ON blog_authors
    FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

CREATE TRIGGER trigger_blog_comments_updated_at
    BEFORE UPDATE ON blog_comments
    FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

CREATE TRIGGER trigger_blog_series_updated_at
    BEFORE UPDATE ON blog_series
    FOR EACH ROW EXECUTE FUNCTION update_blog_updated_at();

-- Function to calculate reading time and word count
CREATE OR REPLACE FUNCTION calculate_blog_post_stats()
RETURNS TRIGGER AS $$
DECLARE
    words_per_minute INTEGER := 200;
BEGIN
    -- Calculate word count (rough estimate)
    NEW.word_count := array_length(regexp_split_to_array(regexp_replace(NEW.content, '<[^>]*>', '', 'g'), '\s+'), 1);
    
    -- Calculate reading time
    NEW.reading_time_minutes := GREATEST(1, CEIL(NEW.word_count::DECIMAL / words_per_minute));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blog_post_stats
    BEFORE INSERT OR UPDATE OF content ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION calculate_blog_post_stats();

-- Function to update category post count
CREATE OR REPLACE FUNCTION update_blog_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE blog_categories SET post_count = post_count + 1 WHERE id = NEW.category_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE blog_categories SET post_count = post_count - 1 WHERE id = OLD.category_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id THEN
        IF OLD.category_id IS NOT NULL THEN
            UPDATE blog_categories SET post_count = post_count - 1 WHERE id = OLD.category_id;
        END IF;
        IF NEW.category_id IS NOT NULL THEN
            UPDATE blog_categories SET post_count = post_count + 1 WHERE id = NEW.category_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_post_count
    AFTER INSERT OR DELETE OR UPDATE OF category_id ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_blog_category_post_count();

-- Function to update tag post count
CREATE OR REPLACE FUNCTION update_blog_tag_post_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE blog_tags SET post_count = post_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE blog_tags SET post_count = post_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_post_count
    AFTER INSERT OR DELETE ON blog_post_tags
    FOR EACH ROW EXECUTE FUNCTION update_blog_tag_post_count();

-- Function to update author post count
CREATE OR REPLACE FUNCTION update_blog_author_post_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
        UPDATE blog_authors SET post_count = post_count + 1 WHERE id = NEW.author_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'published' THEN
        UPDATE blog_authors SET post_count = post_count - 1 WHERE id = OLD.author_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'published' AND NEW.status = 'published' THEN
            UPDATE blog_authors SET post_count = post_count + 1 WHERE id = NEW.author_id;
        ELSIF OLD.status = 'published' AND NEW.status != 'published' THEN
            UPDATE blog_authors SET post_count = post_count - 1 WHERE id = OLD.author_id;
        ELSIF OLD.author_id IS DISTINCT FROM NEW.author_id AND NEW.status = 'published' THEN
            IF OLD.author_id IS NOT NULL THEN
                UPDATE blog_authors SET post_count = post_count - 1 WHERE id = OLD.author_id;
            END IF;
            IF NEW.author_id IS NOT NULL THEN
                UPDATE blog_authors SET post_count = post_count + 1 WHERE id = NEW.author_id;
            END IF;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_author_post_count
    AFTER INSERT OR DELETE OR UPDATE OF author_id, status ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_blog_author_post_count();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_blog_post_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE blog_posts SET view_count = view_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_view_count
    AFTER INSERT ON blog_post_views
    FOR EACH ROW EXECUTE FUNCTION increment_blog_post_view_count();

-- Function to update like count
CREATE OR REPLACE FUNCTION update_blog_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE blog_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE blog_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_like_count
    AFTER INSERT OR DELETE ON blog_post_likes
    FOR EACH ROW EXECUTE FUNCTION update_blog_post_like_count();

-- Function to update comment count
CREATE OR REPLACE FUNCTION update_blog_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
        UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
        UPDATE blog_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        IF NEW.status = 'approved' THEN
            UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        ELSIF OLD.status = 'approved' THEN
            UPDATE blog_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_count
    AFTER INSERT OR DELETE OR UPDATE OF status ON blog_comments
    FOR EACH ROW EXECUTE FUNCTION update_blog_post_comment_count();
