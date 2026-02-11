# 📸 How to Create Products with Images - Complete Guide

## ⚡ Two Approaches Available

### **Approach 1: Create Product + Upload Media (Recommended for Admin Dashboards)** ✅

**Best for:** Admin panels where you create product first, then manage media separately

### **Approach 2: Create Product with Media in One Request (Quickest)** 🚀

**Best for:** Importing products, bulk uploads, or when you have all data ready

---

## 🎯 Approach 1: Two-Step Process (RECOMMENDED)

### Step 1: Create Product (JSON)

**Endpoint:** `POST /api/v1/products`  
**Content-Type:** `application/json`  
**Authentication:** Required (admin/super_admin)

**Request Body:**

```json
{
  "sku": "WH-1000XM5",
  "name": "Premium Wireless Headphones",
  "slug": "premium-wireless-headphones",
  "description": "High-quality wireless headphones with active noise cancellation. 30-hour battery life, premium sound quality, and comfortable design for all-day wear.",
  "shortDescription": "Premium noise-cancelling wireless headphones",
  "categoryId": "{{categoryId}}",
  "basePrice": 399.99,
  "salePrice": 349.99,
  "costPrice": 200.0,
  "taxRate": 0.08,
  "weight": 250,
  "weightUnit": "g",
  "length": 20,
  "width": 18,
  "height": 8,
  "dimensionsUnit": "cm",
  "isActive": true,
  "isFeatured": true,
  "minOrderQuantity": 1,
  "maxOrderQuantity": 5,
  "metaTitle": "Premium Wireless Headphones - 30hr Battery | TechTools",
  "metaDescription": "Shop premium wireless headphones with active noise cancellation. Free shipping on orders over $50."
}
```

**❌ DO NOT INCLUDE:**

```json
// ❌ WRONG - Don't use image URLs
{
  "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sku": "WH-1000XM5",
      "name": "Premium Wireless Headphones",
      ...
    }
  },
  "message": "Product created successfully"
}
```

**✅ Save the product ID!**

---

### Step 2: Upload Images

**Endpoint:** `POST /api/v1/products/{productId}/media`  
**Content-Type:** `multipart/form-data`  
**Authentication:** Required (admin/super_admin)

**Upload First Image (Primary):**

**Form Data:**

```
file: [SELECT IMAGE FILE] (JPG, PNG, WebP, GIF - max 10MB)
title: "Front View - Premium Headphones"
altText: "Premium wireless headphones front view"
description: "Main product image showing headphones from the front"
position: 0
isPrimary: true
```

**What Happens Automatically:**

- ✅ Image optimized and resized to 4 sizes:
  - Thumbnail: 150x150px
  - Small: 300x300px
  - Medium: 600x600px
  - Large: 1200x1200px
- ✅ Converted to WebP format
- ✅ CDN URLs generated for all sizes
- ✅ Original image preserved

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "media-uuid-123",
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "media_type": "image",
    "is_primary": true,
    "position": 0,
    "cdn_urls": {
      "thumbnail": "/media/products/images/thumb_abc123.webp",
      "small": "/media/products/images/small_abc123.webp",
      "medium": "/media/products/images/medium_abc123.webp",
      "large": "/media/products/images/large_abc123.webp"
    },
    "file_size": 245678,
    "title": "Front View - Premium Headphones",
    "alt_text": "Premium wireless headphones front view"
  },
  "message": "Media uploaded successfully"
}
```

---

### Step 3: Upload More Images (Repeat)

**Upload Second Image:**

```
file: [SELECT IMAGE FILE]
title: "Side Angle View"
altText: "Headphones side profile"
position: 1
isPrimary: false
```

**Upload Third Image:**

```
file: [SELECT IMAGE FILE]
title: "In Use"
altText: "Person wearing headphones"
position: 2
isPrimary: false
```

**Upload Product Video (Optional):**

```
file: [SELECT VIDEO FILE] (MP4, MOV - max 100MB)
title: "Product Demo & Features"
description: "See the headphones in action"
position: 3
```

---

## 🚀 Approach 2: Create Product with Images in One Request

### Single Request with Everything

**Endpoint:** `POST /api/v1/products`  
**Content-Type:** `multipart/form-data`  
**Authentication:** Required (admin/super_admin)

**Form Data:**

**Product Fields:**

```
sku: WH-1000XM5
name: Premium Wireless Headphones
slug: premium-wireless-headphones
description: High-quality wireless headphones with active noise cancellation...
shortDescription: Premium noise-cancelling wireless headphones
categoryId: {{categoryId}}
basePrice: 399.99
salePrice: 349.99
costPrice: 200.00
weight: 250
weightUnit: g
length: 20
width: 18
height: 8
dimensionsUnit: cm
isActive: true
isFeatured: true
minOrderQuantity: 1
maxOrderQuantity: 5
```

**Media Files (up to 10 images + 3 videos):**

```
images: [SELECT FILE 1] - Front view image
images: [SELECT FILE 2] - Side angle image
images: [SELECT FILE 3] - In use image
videos: [SELECT FILE] - Product demo video
```

**Media Metadata (JSON string):**

```
imageDescriptions: [{
  "title": "Front View",
  "description": "Premium headphones from front"
}, {
  "title": "Side Angle",
  "description": "Side profile showing design"
}, {
  "title": "In Use",
  "description": "Person wearing headphones"
}]

videoTitle: "Product Demo & Features"
videoDescription: "See the premium headphones in action"
videoPurpose: "demo"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sku": "WH-1000XM5",
      "name": "Premium Wireless Headphones",
      "media": [
        {
          "id": "media-1",
          "media_type": "image",
          "is_primary": true,
          "position": 0,
          "cdn_urls": { ... }
        },
        {
          "id": "media-2",
          "media_type": "image",
          "position": 1,
          "cdn_urls": { ... }
        },
        {
          "id": "media-3",
          "media_type": "video",
          "position": 2,
          "cdn_urls": { ... }
        }
      ]
    }
  },
  "message": "Product created successfully with 3 media file(s)"
}
```

---

## 📝 Testing in Postman

### For Approach 1 (Two Steps):

**Step 1 - Create Product:**

1. Open: `📦 Products with Media > Create Product (No Media)`
2. Update `categoryId` to a valid category
3. Click **Send**
4. ✅ Product ID auto-saved to `{{productId}}`

**Step 2 - Upload Images:**

1. Open: `🖼️ Product Media > Upload Product Image`
2. In Body tab → form-data
3. Find `file` field → Click "Select Files" → Choose image
4. Fill in title, altText, description
5. Set `isPrimary: true` for first image
6. Click **Send**
7. Repeat for more images

---

### For Approach 2 (One Request):

**Create Everything at Once:**

1. Open: `📦 Products with Media > Create Product with Media`
2. In Body tab → form-data
3. Fill all text fields (sku, name, description, etc.)
4. Find `images` fields → Click "Select Files" → Choose 2-3 images
5. Find `videos` field → Click "Select Files" → Choose video (optional)
6. Update `imageDescriptions` JSON for each image
7. Click **Send**
8. ✅ Product created with all media in one go!

---

## 🎨 Admin Dashboard Implementation

### Recommended UI Flow:

#### **Product Creation Form:**

```jsx
// React/Next.js Example
function CreateProductForm() {
  const [step, setStep] = useState(1)
  const [productId, setProductId] = useState(null)

  // Step 1: Product Details
  const createProduct = async (data) => {
    const response = await fetch('/api/v1/products', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()
    setProductId(result.data.product.id)
    setStep(2) // Move to image upload
  }

  // Step 2: Upload Images
  const uploadImages = async (files) => {
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name)
      formData.append('position', files.indexOf(file))
      formData.append('isPrimary', files.indexOf(file) === 0)

      await fetch(`/api/v1/products/${productId}/media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })
    }
  }

  return (
    <div>
      {step === 1 && <ProductDetailsForm onSubmit={createProduct} />}
      {step === 2 && <ImageUploadForm onSubmit={uploadImages} />}
    </div>
  )
}
```

---

## ✅ Best Practices

### 1. **Image Requirements**

- ✅ Format: JPG, PNG, WebP, GIF
- ✅ Max size: 10MB per image
- ✅ Recommended: Square images (1:1 ratio) work best
- ✅ Minimum: 800x800px for good quality
- ✅ Optimal: 2000x2000px (will be optimized automatically)

### 2. **Always Set Primary Image**

```json
{
  "isPrimary": true, // ✅ First image
  "position": 0
}
```

### 3. **Use Descriptive Alt Text (SEO)**

```json
{
  "altText": "Premium wireless headphones in black, front view", // ✅ Good
  "altText": "image1" // ❌ Bad
}
```

### 4. **Organize by Position**

```json
// ✅ Good ordering
Position 0: Primary product shot
Position 1: Side/angle view
Position 2: Detail shot (logo, buttons)
Position 3: In-use lifestyle shot
Position 4: Packaging/accessories
Position 5+: Additional angles
```

### 5. **Video Guidelines**

- ✅ Format: MP4 (H.264 codec) recommended
- ✅ Max size: 100MB
- ✅ Duration: 30-120 seconds ideal
- ✅ Resolution: 1080p or 4K
- ⚠️ Position videos after images (position 10+)

---

## 🔍 Verification

### Check Product with Media:

```bash
GET /api/v1/products/{productId}
```

**Response includes media:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "550e8400...",
      "name": "Premium Wireless Headphones",
      "media": [
        {
          "id": "media-1",
          "media_type": "image",
          "is_primary": true,
          "cdn_urls": {
            "thumbnail": "/media/products/images/thumb_...",
            "small": "/media/products/images/small_...",
            "medium": "/media/products/images/medium_...",
            "large": "/media/products/images/large_..."
          }
        }
      ]
    }
  }
}
```

### Check File System:

```bash
# View uploaded files
ls -lah uploads/products/images/

# You should see:
# - thumb_*.webp (150x150)
# - small_*.webp (300x300)
# - medium_*.webp (600x600)
# - large_*.webp (1200x1200)
```

---

## 📱 Frontend Display

### Responsive Image Display:

```jsx
// Use optimized sizes for responsive loading
<img
  src={product.media[0].cdn_urls.medium}
  srcSet={`
    ${product.media[0].cdn_urls.small} 300w,
    ${product.media[0].cdn_urls.medium} 600w,
    ${product.media[0].cdn_urls.large} 1200w
  `}
  sizes='(max-width: 640px) 300px, (max-width: 1024px) 600px, 1200px'
  alt={product.media[0].alt_text}
  loading='lazy'
/>
```

### Product Gallery:

```jsx
function ProductGallery({ media }) {
  const images = media.filter((m) => m.media_type === 'image')
  const videos = media.filter((m) => m.media_type === 'video')

  return (
    <div>
      {/* Main image */}
      <img src={images.find((i) => i.is_primary)?.cdn_urls.large} />

      {/* Thumbnails */}
      <div className='thumbnails'>
        {images.map((img) => (
          <img key={img.id} src={img.cdn_urls.thumbnail} />
        ))}
      </div>

      {/* Video player */}
      {videos.map((video) => (
        <video key={video.id} src={video.cdn_urls.original} controls />
      ))}
    </div>
  )
}
```

---

## 🎯 Summary

### **When to Use Approach 1 (Two-Step):**

- ✅ Building admin dashboards
- ✅ Need to review product before adding media
- ✅ Uploading images one by one with different metadata
- ✅ Managing media separately from product data

### **When to Use Approach 2 (Single Request):**

- ✅ Importing products from CSV/API
- ✅ Bulk product creation
- ✅ Have all data ready upfront
- ✅ Quick admin workflows

### **Key Points:**

- ❌ **Never** use image URL arrays in JSON body
- ✅ **Always** upload actual image files
- ✅ Images are automatically optimized (4 sizes)
- ✅ First image is automatically primary
- ✅ Use descriptive alt text for SEO
- ✅ Videos supported (max 100MB)

---

## 📚 Related Documentation

- [CREATE-WITH-MEDIA-GUIDE.md](./CREATE-WITH-MEDIA-GUIDE.md) - Technical implementation details
- [MEDIA-AND-COLLECTIONS-GUIDE.md](./MEDIA-AND-COLLECTIONS-GUIDE.md) - Complete media API reference
- [QUICK-START-TESTING.md](./postman/QUICK-START-TESTING.md) - Postman testing guide

---

**You're all set to create products with professional image management! 🚀**
