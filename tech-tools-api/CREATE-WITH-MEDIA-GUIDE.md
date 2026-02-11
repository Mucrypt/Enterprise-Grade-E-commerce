# Create Products & Categories with Media Upload

This guide explains how to create products and categories with images and videos in a single request.

## ✨ Overview

The create endpoints now support multipart/form-data, allowing you to:

- **Products**: Upload up to **10 images** and **3 videos** during creation
- **Categories**: Upload **thumbnail**, **banner**, **icon**, and **video** during creation

All images are automatically optimized, converted to WebP, and resized to multiple dimensions for responsive design.

---

## 📦 Create Product with Media

### Endpoint

```
POST /api/v1/products
```

### Headers

```
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

### Form Fields

#### Required Product Fields

- `sku` (string) - Unique product identifier
- `name` (string) - Product name
- `slug` (string) - URL-friendly slug
- `description` (text) - Full product description
- `categoryId` (uuid) - Category ID
- `basePrice` (decimal) - Base price

#### Optional Product Fields

- `shortDescription` (text) - Brief description
- `brandId` (uuid) - Brand ID
- `salePrice` (decimal) - Sale/discounted price
- `costPrice` (decimal) - Cost price
- `taxRate` (decimal) - Tax rate (default: 0)
- `weight` (decimal) - Product weight
- `weightUnit` (string) - Weight unit (default: 'kg')
- `length`, `width`, `height` (decimal) - Dimensions
- `dimensionsUnit` (string) - Unit (default: 'cm')
- `isActive` (boolean) - Active status (default: true)
- `isDigital` (boolean) - Digital product flag (default: false)
- `isFeatured` (boolean) - Featured flag (default: false)
- `isBackorderAllowed` (boolean) - Backorder flag (default: false)
- `minOrderQuantity` (number) - Min order qty (default: 1)
- `maxOrderQuantity` (number) - Max order qty
- `metaTitle` (string) - SEO meta title
- `metaDescription` (text) - SEO meta description

#### Media Fields

- `images` (files[]) - Array of image files (max 10)
  - Supported: JPG, PNG, WebP, GIF
  - Max size: 10MB per file
  - Auto-optimized to 4 sizes
- `videos` (files[]) - Array of video files (max 3)
  - Supported: MP4, MPEG, QuickTime, AVI
  - Max size: 100MB per file
- `imageDescriptions` (JSON string) - Descriptions for each image
  ```json
  [
    { "title": "Front View", "description": "Product from front" },
    { "title": "Side View", "description": "Product from side" }
  ]
  ```
- `videoTitle` (string) - Video title
- `videoDescription` (string) - Video description
- `videoPurpose` (string) - Video purpose (demo, tutorial, unboxing, etc.)

### Example using cURL

```bash
curl -X POST http://localhost:9000/api/v1/products \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "sku=PROD-001" \
  -F "name=Wireless Keyboard" \
  -F "slug=wireless-keyboard" \
  -F "description=Premium wireless keyboard with RGB lighting" \
  -F "shortDescription=RGB wireless keyboard" \
  -F "categoryId=123e4567-e89b-12d3-a456-426614174000" \
  -F "basePrice=79.99" \
  -F "salePrice=59.99" \
  -F "weight=500" \
  -F "isFeatured=true" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "images=@/path/to/image3.jpg" \
  -F "videos=@/path/to/demo.mp4" \
  -F 'imageDescriptions=[{"title":"Front View","description":"Keyboard from front"},{"title":"Side View","description":"Side angle"},{"title":"In Use","description":"Person typing"}]' \
  -F "videoTitle=Product Demo" \
  -F "videoDescription=See the keyboard in action"
```

### Example using JavaScript (Fetch API)

```javascript
const formData = new FormData()

// Product details
formData.append('sku', 'PROD-001')
formData.append('name', 'Wireless Keyboard')
formData.append('slug', 'wireless-keyboard')
formData.append('description', 'Premium wireless keyboard with RGB lighting')
formData.append('shortDescription', 'RGB wireless keyboard')
formData.append('categoryId', '123e4567-e89b-12d3-a456-426614174000')
formData.append('basePrice', '79.99')
formData.append('salePrice', '59.99')
formData.append('weight', '500')
formData.append('isFeatured', 'true')

// Images
const imageFiles = document.querySelector('#imageInput').files
for (let i = 0; i < imageFiles.length; i++) {
  formData.append('images', imageFiles[i])
}

// Image descriptions
const imageDescs = [
  { title: 'Front View', description: 'Keyboard from front' },
  { title: 'Side View', description: 'Side angle' },
  { title: 'In Use', description: 'Person typing' },
]
formData.append('imageDescriptions', JSON.stringify(imageDescs))

// Videos
const videoFile = document.querySelector('#videoInput').files[0]
if (videoFile) {
  formData.append('videos', videoFile)
  formData.append('videoTitle', 'Product Demo')
  formData.append('videoDescription', 'See the keyboard in action')
}

// Submit
const response = await fetch('http://localhost:9000/api/v1/products', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminToken}`,
  },
  body: formData,
})

const result = await response.json()
console.log(result)
```

### Example using Postman

1. Create a new POST request to `http://localhost:9000/api/v1/products`
2. Add Authorization header with Bearer token
3. In Body tab, select **form-data**
4. Add text fields:
   - `sku`: PROD-001
   - `name`: Wireless Keyboard
   - `slug`: wireless-keyboard
   - `description`: Premium wireless keyboard...
   - `categoryId`: <category-uuid>
   - `basePrice`: 79.99
   - etc.
5. Add file fields:
   - `images`: Select File (can add multiple)
   - `videos`: Select File (can add multiple)
6. Add JSON field:
   - `imageDescriptions`: `[{"title":"Front","description":"Front view"}]`
7. Send request

### Success Response

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sku": "PROD-001",
      "name": "Wireless Keyboard",
      "slug": "wireless-keyboard",
      "description": "Premium wireless keyboard...",
      "base_price": "79.99",
      "sale_price": "59.99",
      "is_featured": true,
      "created_at": "2026-02-09T10:30:00Z",
      "media": [
        {
          "id": "media-uuid-1",
          "media_type": "image",
          "is_primary": true,
          "position": 0,
          "cdn_urls": {
            "original": "/media/products/images/...",
            "thumbnail": "/media/products/images/...",
            "small": "/media/products/images/...",
            "medium": "/media/products/images/...",
            "large": "/media/products/images/..."
          },
          "file_size": 245678,
          "title": "Front View"
        },
        {
          "id": "media-uuid-2",
          "media_type": "video",
          "position": 3,
          "cdn_urls": {
            "original": "/media/products/videos/..."
          },
          "file_size": 5242880,
          "video_duration": 45
        }
      ]
    }
  },
  "message": "Product created successfully with 4 media file(s)"
}
```

---

## 📁 Create Category with Media

### Endpoint

```
POST /api/v1/categories
```

### Headers

```
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

### Form Fields

#### Required Category Fields

- `name` (string) - Category name

#### Optional Category Fields

- `description` (text) - Category description
- `parentId` (uuid) - Parent category ID for subcategories

#### Media Fields

- `thumbnail` (file) - Thumbnail image for listings
  - Used in category grids/listings
  - Recommended: 300x300px
- `banner` (file) - Banner image for category pages
  - Used at top of category pages
  - Recommended: 1920x400px
- `icon` (file) - Icon image for navigation
  - Used in menus/navigation
  - Recommended: 64x64px
- `video` (file) - Category video
  - Promotional/marketing video
  - Max size: 100MB

#### Media Metadata Fields

- `thumbnailTitle` (string) - Thumbnail title
- `thumbnailAlt` (string) - Thumbnail alt text
- `bannerTitle` (string) - Banner title
- `bannerAlt` (string) - Banner alt text
- `iconTitle` (string) - Icon title
- `iconAlt` (string) - Icon alt text
- `videoTitle` (string) - Video title
- `videoDescription` (string) - Video description

### Example using cURL

```bash
curl -X POST http://localhost:9000/api/v1/categories \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "name=Electronics" \
  -F "description=All electronic devices and accessories" \
  -F "thumbnail=@/path/to/thumbnail.jpg" \
  -F "banner=@/path/to/banner.jpg" \
  -F "icon=@/path/to/icon.png" \
  -F "thumbnailAlt=Electronics category thumbnail" \
  -F "bannerAlt=Electronics banner" \
  -F "iconAlt=Electronics icon"
```

### Example using JavaScript

```javascript
const formData = new FormData()

// Category details
formData.append('name', 'Electronics')
formData.append('description', 'All electronic devices and accessories')

// Media files
const thumbnailFile = document.querySelector('#thumbnailInput').files[0]
const bannerFile = document.querySelector('#bannerInput').files[0]
const iconFile = document.querySelector('#iconInput').files[0]

if (thumbnailFile) {
  formData.append('thumbnail', thumbnailFile)
  formData.append('thumbnailAlt', 'Electronics category thumbnail')
}

if (bannerFile) {
  formData.append('banner', bannerFile)
  formData.append('bannerAlt', 'Electronics banner')
}

if (iconFile) {
  formData.append('icon', iconFile)
  formData.append('iconAlt', 'Electronics icon')
}

// Submit
const response = await fetch('http://localhost:9000/api/v1/categories', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminToken}`,
  },
  body: formData,
})

const result = await response.json()
console.log(result)
```

### Success Response

```json
{
  "success": true,
  "data": {
    "category": {
      "id": "cat-uuid-123",
      "name": "Electronics",
      "description": "All electronic devices...",
      "parent_id": null,
      "created_at": "2026-02-09T10:30:00Z",
      "media": [
        {
          "id": "media-uuid-1",
          "media_type": "image",
          "media_purpose": "thumbnail",
          "position": 0,
          "cdn_urls": {
            "thumbnail": "/media/categories/images/...",
            "small": "/media/categories/images/...",
            "medium": "/media/categories/images/...",
            "large": "/media/categories/images/..."
          },
          "alt_text": "Electronics category thumbnail"
        },
        {
          "id": "media-uuid-2",
          "media_type": "image",
          "media_purpose": "banner",
          "position": 1,
          "cdn_urls": {
            "large": "/media/categories/images/..."
          }
        }
      ]
    }
  },
  "message": "Category created successfully with 3 media file(s)"
}
```

---

## 🎯 Image Processing Details

### Automatic Optimization

All uploaded images are automatically:

1. ✅ Converted to **WebP** format (smaller size, better quality)
2. ✅ Resized to **4 sizes** for responsive design:
   - **Thumbnail**: 150x150px (cover fit)
   - **Small**: 300x300px
   - **Medium**: 600x600px
   - **Large**: 1200x1200px
3. ✅ Compressed for optimal file size
4. ✅ Stored with CDN-ready URLs

### Using Optimized Images in Frontend

#### React/Next.js Example with Responsive Images

```jsx
function ProductImage({ product }) {
  const primaryImage = product.media?.find(
    (m) => m.is_primary && m.media_type === 'image',
  )

  if (!primaryImage) return null

  return (
    <img
      src={primaryImage.cdn_urls.medium}
      srcSet={`
        ${primaryImage.cdn_urls.small} 300w,
        ${primaryImage.cdn_urls.medium} 600w,
        ${primaryImage.cdn_urls.large} 1200w
      `}
      sizes='(max-width: 640px) 300px, (max-width: 1024px) 600px, 1200px'
      alt={primaryImage.alt_text}
      loading='lazy'
    />
  )
}
```

#### React Native Example

```jsx
import FastImage from 'react-native-fast-image'

function ProductImage({ product }) {
  const primaryImage = product.media?.find((m) => m.is_primary)

  return (
    <FastImage
      source={{
        uri: primaryImage?.cdn_urls.medium,
        priority: FastImage.priority.high,
      }}
      style={{ width: 300, height: 300 }}
      resizeMode={FastImage.resizeMode.contain}
    />
  )
}
```

---

## 🎬 Video Handling

### Video Processing

- Videos are stored in original format (no transcoding yet)
- Supports: MP4, MPEG, QuickTime, AVI
- Max size: 100MB (configurable via `MAX_VIDEO_SIZE` env var)
- Duration is automatically extracted and stored

### Recommended: Production Video Processing

For production, consider implementing:

- **FFmpeg** for video transcoding
- **AWS Elemental MediaConvert** for cloud processing
- Generate multiple formats (MP4, WebM)
- Create video thumbnails
- Adaptive bitrate streaming (HLS/DASH)

---

## ⚠️ Important Notes

### Error Handling

- If media processing fails, the product/category is **still created**
- Media errors are logged, admin can add media later via media endpoints
- This ensures product creation isn't blocked by media issues

### File Size Limits

- **Images**: 10MB per file (configurable via `MAX_FILE_SIZE`)
- **Videos**: 100MB per file (configurable via `MAX_VIDEO_SIZE`)
- Limits enforced at multer level

### First Image is Primary

For products, the **first uploaded image** is automatically set as `is_primary: true`

- Primary image shown in listings, search results
- Can be changed later via media update endpoint

### Media Order

- Images maintain upload order via `position` field
- Videos positioned after all images
- Can be reordered later via reorder endpoint

### Validation

- Existing validation schemas still apply
- Media fields are optional
- Products/categories can be created without media

---

## 🔄 Alternative: Two-Step Approach

If you prefer separating creation and media upload:

### Step 1: Create Product

```bash
POST /api/v1/products
Content-Type: application/json

{
  "sku": "PROD-001",
  "name": "Wireless Keyboard",
  ...
}
```

### Step 2: Upload Media

```bash
POST /api/v1/products/{productId}/media
Content-Type: multipart/form-data

- file: image1.jpg
- title: Front View
- mediaType: image
```

Both approaches are supported and valid.

---

## 🚀 Testing

### Test Create Product with Media

```bash
# Navigate to project directory
cd /home/mukulah/Enterprise-Grade-E-commerce/tech-tools-api

# Restart API to load changes
docker restart techtools-api-dev

# Test with sample images
curl -X POST http://localhost:9000/api/v1/products \
  -H "Authorization: Bearer <your-admin-token>" \
  -F "sku=TEST-001" \
  -F "name=Test Product" \
  -F "slug=test-product" \
  -F "description=Test description" \
  -F "categoryId=<valid-category-id>" \
  -F "basePrice=9.99" \
  -F "images=@test-image.jpg"
```

### Verify Media Storage

```bash
# Check uploads directory
ls -la uploads/products/images/

# Check database
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools \
  -c "SELECT id, product_id, media_type, file_size, is_primary FROM product_media LIMIT 5;"
```

---

## 📚 Related Documentation

- [MEDIA-AND-COLLECTIONS-GUIDE.md](./MEDIA-AND-COLLECTIONS-GUIDE.md) - Complete media API reference
- [README.md](./README.md) - Project overview and setup

---

## 🆘 Troubleshooting

### "Invalid file type" Error

- Check that file MIME type matches allowed types
- Ensure image is JPG, PNG, WebP, or GIF
- Ensure video is MP4, MPEG, QuickTime, or AVI

### "File too large" Error

- Images must be ≤ 10MB
- Videos must be ≤ 100MB
- Compress large files before upload

### Media Not Processed

- Check API logs: `docker logs techtools-api-dev`
- Product/category still created, media can be added later
- Verify Sharp package installed: `npm list sharp`

### Images Not Optimized

- Check Sharp installation and configuration
- Verify uploads directory has write permissions
- Check `/media` static route is configured in app.ts

---

## 📞 Support

For issues or questions, check:

- Application logs: `docker logs techtools-api-dev`
- Database queries for debugging
- Sharp documentation: https://sharp.pixelplumbing.com/
