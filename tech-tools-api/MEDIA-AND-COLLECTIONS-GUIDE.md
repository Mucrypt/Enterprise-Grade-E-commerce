# Media & Collections API Guide

## Overview

This guide covers the enterprise-grade media management and collections system for products and categories. The system provides optimized image handling, video support, and flexible collections for organizing your e-commerce inventory.

## Features

### ✨ **Media Management**

- **Multi-format support**: Images (JPEG, PNG, WebP, GIF) and Videos (MP4, MOV, AVI)
- **Automatic optimization**: Generates multiple sizes (thumbnail, small, medium, large) for responsive design
- **WebP conversion**: Automatic conversion to WebP format for 30-40% better compression
- **CDN-ready**: URL structure optimized for CDN delivery
- **Fast serving**: Static file serving with caching headers (1-year cache)
- **Primary image support**: Mark one image as primary for product listings
- **Position-based ordering**: Drag-and-drop support with position management

### 🎯 **Collections**

- **Product Collections**: Group products (e.g., "Summer Sale", "New Arrivals", "Best Sellers")
- **Category Collections**: Organize categories (e.g., "Featured Categories", "Electronics")
- **Flexible ordering**: Manual, newest, popular, price-based (products), alphabetical (categories)
- **Scheduling**: Set start and end dates for time-limited collections
- **Visibility control**: Public, private, or hidden collections
- **Featured items**: Mark specific items as featured within collections
- **SEO optimization**: Meta title, description, and keywords for each collection

---

## Database Schema

### Tables Created

```sql
1. product_media          - Product images and videos
2. category_media         - Category thumbnails, banners, icons, videos
3. product_collections    - Product collection definitions
4. product_collection_items - Products in collections (junction table)
5. category_collections   - Category collection definitions
6. category_collection_items - Categories in collections (junction table)
```

### Key Fields

- **Media Tables**: `url`, `thumbnail_url`, `cdn_urls` (JSONB), `width`, `height`, `file_size`, `format`, `position`, `is_primary`
- **Collections Tables**: `name`, `slug`, `visibility`, `is_active`, `is_featured`, `display_order`, `starts_at`, `ends_at`, `items_count`

---

## API Endpoints

### 📸 **Product Media Endpoints**

#### Upload Product Media

```http
POST /api/v1/products/:productId/media
Authorization: Bearer {token} (Admin only)
Content-Type: multipart/form-data

Body:
- file: (binary) - Image or video file
- altText: (optional) Alternative text for accessibility
- title: (optional) Media title
- position: (optional) Display position (default: 0)
- isPrimary: (optional) Set as primary image (default: false)

Response: 201 Created
{
  "success": true,
  "message": "Media uploaded successfully",
  "data": {
    "id": "uuid",
    "product_id": "uuid",
    "type": "image",
    "url": "/media/products/images/original-uuid.webp",
    "thumbnail_url": "/media/products/images/thumbnail-uuid.webp",
    "cdn_urls": {
      "thumbnail": "http://localhost:9000/media/...",
      "small": "http://localhost:9000/media/...",
      "medium": "http://localhost:9000/media/...",
      "large": "http://localhost:9000/media/..."
    },
    "width": 1920,
    "height": 1080,
    "file_size": 245678,
    "format": "webp",
    "position": 0,
    "is_primary": false
  }
}
```

#### Get All Product Media

```http
GET /api/v1/products/:productId/media?type=image
Authorization: None (public)

Query Parameters:
- type: Filter by "image" or "video" (optional)

Response: 200 OK
{
  "success": true,
  "count": 5,
  "data": [...]
}
```

#### Update Product Media

```http
PUT /api/v1/products/:productId/media/:mediaId
Authorization: Bearer {token} (Admin only)
Content-Type: application/json

Body:
{
  "altText": "Updated alt text",
  "title": "Updated title",
  "position": 1,
  "isPrimary": true
}
```

#### Delete Product Media

```http
DELETE /api/v1/products/:productId/media/:mediaId
Authorization: Bearer {token} (Admin only)

Response: 200 OK
```

#### Reorder Product Media

```http
PUT /api/v1/products/:productId/media/reorder
Authorization: Bearer {token} (Admin only)

Body:
{
  "mediaOrder": [
    { "mediaId": "uuid1", "position": 0 },
    { "mediaId": "uuid2", "position": 1 },
    { "mediaId": "uuid3", "position": 2 }
  ]
}
```

#### Set Primary Image

```http
PUT /api/v1/products/:productId/media/:mediaId/set-primary
Authorization: Bearer {token} (Admin only)
```

---

### 📂 **Category Media Endpoints**

#### Upload Category Media

```http
POST /api/v1/categories/:categoryId/media
Authorization: Bearer {token} (Admin only)
Content-Type: multipart/form-data

Body:
- file: (binary)
- mediaPurpose: "thumbnail" | "banner" | "icon" | "video" (required)
- altText: (optional)
- title: (optional)
- position: (optional)
```

#### Get All Category Media

```http
GET /api/v1/categories/:categoryId/media?type=image&purpose=banner
Authorization: None (public)

Query Parameters:
- type: "image" or "video" (optional)
- purpose: "thumbnail" | "banner" | "icon" | "video" (optional)
```

Other endpoints (GET by ID, PUT, DELETE) follow the same pattern as product media.

---

### 🎨 **Product Collections Endpoints**

#### Create Product Collection

```http
POST /api/v1/collections/products
Authorization: Bearer {token} (Admin only)
Content-Type: application/json

Body:
{
  "name": "Summer Sale 2026",
  "slug": "summer-sale-2026",
  "description": "Hot deals for summer",
  "shortDescription": "Up to 50% off",
  "imageUrl": "/media/collections/summer-sale.jpg",
  "bannerUrl": "/media/collections/summer-banner.jpg",
  "isActive": true,
  "isFeatured": true,
  "visibility": "public",
  "position": 0,
  "displayOrder": "manual",
  "metaTitle": "Summer Sale - Up to 50% Off",
  "metaDescription": "Shop our summer collection",
  "metaKeywords": "summer, sale, discount",
  "startsAt": "2026-06-01T00:00:00Z",
  "endsAt": "2026-08-31T23:59:59Z"
}

Response: 201 Created
```

#### Get All Product Collections

```http
GET /api/v1/collections/products?page=1&limit=10&isActive=true&isFeatured=true
Authorization: None (public)

Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 10)
- visibility: "public" | "private" | "hidden"
- isActive: true | false
- isFeatured: true | false
- search: Search in name and description

Response: 200 OK
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 25,
    "totalPages": 3
  }
}
```

#### Get Collection with Products

```http
GET /api/v1/collections/products/:collectionId?includeProducts=true
Authorization: None (public)

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Summer Sale 2026",
    "slug": "summer-sale-2026",
    "items_count": 15,
    "products": [
      {
        "id": "product-uuid",
        "name": "Product Name",
        "price": 99.99,
        "collection_position": 0,
        "is_featured_in_collection": true
      }
    ]
  }
}
```

#### Update Collection

```http
PUT /api/v1/collections/products/:collectionId
Authorization: Bearer {token} (Admin only)

Body: (any fields to update)
{
  "name": "Updated Name",
  "isActive": false
}
```

#### Delete Collection

```http
DELETE /api/v1/collections/products/:collectionId
Authorization: Bearer {token} (Admin only)
```

#### Add Products to Collection

```http
POST /api/v1/collections/products/:collectionId/products
Authorization: Bearer {token} (Admin only)

Body:
{
  "productIds": ["uuid1", "uuid2", "uuid3"],
  "isFeatured": false
}

Response: 200 OK
```

#### Remove Product from Collection

```http
DELETE /api/v1/collections/products/:collectionId/products/:productId
Authorization: Bearer {token} (Admin only)
```

#### Reorder Products in Collection

```http
PUT /api/v1/collections/products/:collectionId/products/reorder
Authorization: Bearer {token} (Admin only)

Body:
{
  "productOrder": [
    { "productId": "uuid1", "position": 0 },
    { "productId": "uuid2", "position": 1 }
  ]
}
```

---

### 📁 **Category Collections Endpoints**

Category collections follow the same pattern as product collections:

- Base URL: `/api/v1/collections/categories`
- All endpoints mirror product collections
- Use `categoryIds` instead of `productIds`
- Use `categoryOrder` for reordering

---

## Usage Examples

### Example 1: Upload Product Images

```bash
# Upload primary product image
curl -X POST http://localhost:9000/api/v1/products/{productId}/media \
  -H "Authorization: Bearer {admin_token}" \
  -F "file=@product-main.jpg" \
  -F "altText=Product front view" \
  -F "isPrimary=true" \
  -F "position=0"

# Upload additional images
curl -X POST http://localhost:9000/api/v1/products/{productId}/media \
  -H "Authorization: Bearer {admin_token}" \
  -F "file=@product-side.jpg" \
  -F "altText=Product side view" \
  -F "position=1"
```

### Example 2: Create a "New Arrivals" Collection

```bash
# 1. Create collection
curl -X POST http://localhost:9000/api/v1/collections/products \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Arrivals",
    "slug": "new-arrivals",
    "description": "Check out our latest products",
    "isFeatured": true,
    "displayOrder": "newest"
  }'

# 2. Add products to collection
curl -X POST http://localhost:9000/api/v1/collections/products/{collectionId}/products \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": ["product-uuid-1", "product-uuid-2", "product-uuid-3"]
  }'
```

### Example 3: Fetch Collection for Frontend

```javascript
// React/Next.js example
const fetchCollection = async (slug) => {
  const response = await fetch(
    `http://localhost:9000/api/v1/collections/products?search=${slug}&includeProducts=true`,
  )
  const data = await response.json()
  return data.data[0] // First matching collection
}

// Display in component
const CollectionPage = ({ collection }) => {
  return (
    <div>
      <h1>{collection.name}</h1>
      <p>{collection.description}</p>
      <div className='products-grid'>
        {collection.products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            imageUrl={product.primary_image_url || product.first_image_url}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Performance Optimization

### Image Optimization

- **WebP format**: 30-40% smaller than JPEG/PNG
- **Multiple sizes**: Serve appropriate size based on device
  - Thumbnail: 150x150 (product grids)
  - Small: 300x300 (mobile listings)
  - Medium: 600x600 (tablet/desktop listings)
  - Large: 1200x1200 (product detail page)
  - Original: Full resolution (zoom feature)

### Caching Strategy

```javascript
// Static files served with:
Cache-Control: public, max-age=31536000  // 1 year
ETag: enabled
Last-Modified: enabled
```

### CDN Integration (Production)

1. Set `CDN_DOMAIN` in `.env`:
   ```
   CDN_DOMAIN=https://cdn.yourdomain.com
   ```
2. Upload media to CDN storage (S3, Cloudflare R2, etc.)
3. Update `cdn_urls` in database to point to CDN

### Database Views

Three optimized views are available:

```sql
products_with_media_stats          -- Products with media counts
categories_with_media_stats        -- Categories with media counts
active_product_collections_with_stats  -- Active collections with item counts
```

---

## Best Practices

### For Admins

1. **Always set a primary image** for products
2. **Use descriptive alt text** for accessibility and SEO
3. **Order images logically** (main → details → lifestyle)
4. **Use collections** to highlight seasonal products, sales, categories
5. **Schedule collections** for time-limited promotions
6. **Optimize images** before upload (recommended max: 2000x2000px)

### For Frontend Developers

1. **Use responsive images**:

   ```html
   <img
     srcset="
       ${cdn_urls.small}   300w,
       ${cdn_urls.medium}  600w,
       ${cdn_urls.large}  1200w
     "
     sizes="(max-width: 640px) 300px, (max-width: 1024px) 600px, 1200px"
     src="${cdn_urls.medium}"
     alt="${alt_text}"
   />
   ```

2. **Lazy load images**:

   ```html
   <img loading="lazy" ... />
   ```

3. **Implement image placeholder** while loading

4. **Cache collection data** on frontend (5-minute cache recommended)

### For Mobile Apps (React Native)

```jsx
import FastImage from 'react-native-fast-image'
;<FastImage
  source={{
    uri: product.cdn_urls.medium,
    priority: FastImage.priority.normal,
    cache: FastImage.cacheControl.immutable,
  }}
  style={{ width: 200, height: 200 }}
  resizeMode={FastImage.resizeMode.cover}
/>
```

---

## Troubleshooting

### Upload Fails

- **Check file size**: Max 10MB for images, 100MB for videos
- **Check file type**: Only JPEG, PNG, WebP, GIF, MP4, MOV, AVI allowed
- **Check permissions**: Ensure `uploads/` directory is writable

### Images Not Displaying

- **Check static serving**: Ensure `/media` route serves files correctly
- **Check CORS**: Add your frontend domain to `CORS_ORIGIN`
- **Check file exists**: Verify file on disk at `uploads/products/images/`

### Collections Not Showing

- **Check scheduling**: Ensure `starts_at` is in past and `ends_at` in future
- **Check visibility**: Public visibility for frontend display
- **Check isActive**: Must be `true`

---

## Migration Scripts

### Migrate Media Schema

```bash
# Run migration
docker exec -i techtools-postgres-dev psql -U techtools_user -d techtools < src/database/migrations/003_media_and_collections_schema.sql
```

### Verify Tables

```bash
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools -c "\dt *media*"
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools -c "\dt *collection*"
```

---

## Next Steps

1. **Test all endpoints** using Postman collection
2. **Upload test images** to products
3. **Create collections** for your product catalog
4. **Integrate with frontend** (Vite, Next.js, React Native)
5. **Set up CDN** for production (Cloudflare R2 recommended)
6. **Implement video transcoding** (AWS Elemental MediaConvert or FFmpeg)
7. **Add image compression** on client-side before upload (optional)

---

## Support

For issues or questions:

- Check logs: `docker logs techtools-api-dev -f`
- Database queries: Use PgAdmin4 at `http://localhost:8080`
- API health: `http://localhost:9000/health`
- API docs: `http://localhost:9000/api/v1/docs`

---

**Enterprise-grade media management is now ready! 🚀**
