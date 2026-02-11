# 🚀 Quick Start Testing Guide

## ✅ Prerequisites Checklist

- [x] API is running on http://localhost:9000
- [x] Database is connected and migrations are applied
- [x] Super Admin account exists (romeomukulah@gmail.com)
- [x] Postman collection imported

## 📋 Step-by-Step Testing Guide

### 1️⃣ Import Collection into Postman

**Option A: Import from File**

1. Open Postman
2. Click **Import** button (top left)
3. Select `TechTools-API-Complete-v3-Enterprise.json`
4. Click **Import**

**Option B: Import from URL**

```
File path: /home/mukulah/Enterprise-Grade-E-commerce/tech-tools-api/postman/TechTools-API-Complete-v3-Enterprise.json
```

### 2️⃣ Authenticate (REQUIRED FIRST)

**Run this request first:**

```
🔐 Authentication > Login Super Admin
```

**Credentials:**

- Email: `romeomukulah@gmail.com`
- Password: `YourSecurePassword123!` (use your actual password)

**What happens:**

- ✅ Returns access token
- ✅ Token is auto-saved to collection variable `{{accessToken}}`
- ✅ All subsequent requests use this token automatically
- ✅ Token valid for 24 hours

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "user": {
      "id": "c429e249-c897-496a-8da8-12bc5209f609",
      "email": "romeomukulah@gmail.com",
      "userType": "super_admin"
    }
  }
}
```

---

## 3️⃣ Testing Workflow (Recommended Order)

### A. Create Category First

**Why:** Products require a category ID

```
📁 Categories with Media > Create Category (No Media)
```

**Result:** Category ID is auto-saved to `{{categoryId}}`

### B. Create Product with Images

**📚 IMPORTANT:** See detailed guide: [HOW-TO-CREATE-PRODUCTS-WITH-IMAGES.md](../HOW-TO-CREATE-PRODUCTS-WITH-IMAGES.md)

**Two approaches available:**

#### **Option 1: Two-Step Process (Recommended for Admin Dashboards)**

**Step 1 - Create Product:**
```
📦 Products with Media > Create Product (No Media)
```
- Uses JSON request body
- ❌ **Do NOT include image URLs** - we upload actual files
- ✅ Product ID auto-saved to `{{productId}}`

**Step 2 - Upload Images:**
```
🖼️ Product Media > Upload Product Image
```
- Click "Select Files" to attach images from your computer
- Images auto-optimized to 4 sizes (150, 300, 600, 1200px)
- Converted to WebP format automatically
- Set first image with `isPrimary: true`
- Repeat for each additional image

---

#### **Option 2: Create with Media in One Request (Fastest)**

```
📦 Products with Media > Create Product with Media
```

**Before running:**

1. Update `categoryId` field to use the saved `{{categoryId}}`
2. In Body → form-data section:
   - Find `images` fields → Click "Select Files" → Choose 2-10 images from computer
   - Find `videos` field → Click "Select Files" → Choose video (optional)
3. Update `imageDescriptions` JSON to describe each image
4. Fill all product details (name, price, etc.)
5. Click **Send**

**Result:** Product created with all media optimized and ready!

### C. Upload Additional Media Anytime

```
🖼️ Product Media > Upload Product Image
```

**Select a file** from your computer (JPG, PNG, WebP)

**Result:** Media ID auto-saved to `{{mediaId}}`

### D. Create Product Collection

```
📚 Product Collections > Create Product Collection
```

**Then add products:**

```
📚 Product Collections > Add Products to Collection
```

---

## 4️⃣ Complete Testing Scenarios

### 🎯 Scenario 1: Basic Product Setup

1. ✅ Create category (no media)
2. ✅ Create product (no media)
3. ✅ Upload product images
4. ✅ Set primary image
5. ✅ Get product by ID (verify media attached)

### 🎯 Scenario 2: Create Product with Everything

1. ✅ Create category with all media (thumbnail, banner, icon, video)
2. ✅ Create product with images and video in one request
3. ✅ Verify media is optimized (check 4 image sizes)
4. ✅ Update media metadata (alt text, titles)

### 🎯 Scenario 3: Collections & Grouping

1. ✅ Create multiple products
2. ✅ Create "Summer Sale" collection
3. ✅ Add products to collection
4. ✅ Reorder products in collection
5. ✅ Get collection with all products

### 🎯 Scenario 4: Admin Management

1. ✅ Get admin permissions
2. ✅ Invite new admin
3. ✅ View activity logs
4. ✅ Get all admins

---

## 5️⃣ Key Testing Tips

### 🔑 Auto-Saved Variables

These are automatically saved after running requests:

- `accessToken` - After login
- `productId` - After creating product
- `categoryId` - After creating category
- `mediaId` - After uploading media
- `collectionId` - After creating collection

### 📸 Image Upload Testing

**Supported Formats:**

- JPG, PNG, WebP, GIF
- Max size: 10MB per image
- Auto-optimized to 4 sizes (150, 300, 600, 1200px)
- Converted to WebP for better compression

**Test with:**

```bash
# Sample images (if you have them)
- Product photo 1: Front view
- Product photo 2: Side angle
- Product photo 3: In use
```

### 🎬 Video Upload Testing

**Supported Formats:**

- MP4, MOV, AVI, MPEG
- Max size: 100MB per video
- Duration auto-extracted

### 📊 Response Testing

Every request includes **automated tests**:

- ✅ Status code validation
- ✅ Response structure validation
- ✅ Auto-save important IDs
- ✅ Console logging for debugging

**View test results:**

- Click on request
- Go to "Test Results" tab
- See which tests passed/failed

---

## 6️⃣ Common Issues & Solutions

### ❌ "Unauthorized" Error

**Solution:** Run login request again

```
🔐 Authentication > Login Super Admin
```

### ❌ "Category not found"

**Solution:**

1. Create a category first
2. Check `{{categoryId}}` variable is set
3. Use the correct category ID in product creation

### ❌ "Invalid file type"

**Solution:**

- Use JPG, PNG, WebP, or GIF for images
- Use MP4, MOV, or AVI for videos
- Check file size limits

### ❌ "Product not found"

**Solution:**

1. Create a product first
2. Check `{{productId}}` variable
3. Verify product exists: `GET /products/{{productId}}`

### ❌ Token Expired

**Solution:** Re-authenticate

- Tokens valid for 24 hours
- Run login request to get new token

---

## 7️⃣ Advanced Testing

### Test Media Optimization

```bash
# After uploading image, check:
GET /products/{{productId}}/media

# Response includes CDN URLs for all sizes:
{
  "cdnUrls": {
    "thumbnail": "/media/products/images/thumb_...",
    "small": "/media/products/images/small_...",
    "medium": "/media/products/images/medium_...",
    "large": "/media/products/images/large_..."
  }
}
```

### Test Collections Scheduling

```json
{
  "name": "Black Friday 2026",
  "startsAt": "2026-11-27T00:00:00Z",
  "endsAt": "2026-11-30T23:59:59Z",
  "visibility": "public"
}
```

### Test Media Reordering

```json
{
  "mediaOrder": [
    { "mediaId": "id-1", "position": 0 },
    { "mediaId": "id-2", "position": 1 },
    { "mediaId": "id-3", "position": 2 }
  ]
}
```

---

## 8️⃣ Verification Checklist

After testing, verify:

### Database

```bash
# Check products
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools \
  -c "SELECT id, name, base_price, sale_price FROM products LIMIT 5;"

# Check media
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools \
  -c "SELECT id, product_id, media_type, is_primary FROM product_media LIMIT 5;"

# Check collections
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools \
  -c "SELECT id, name, items_count FROM product_collections LIMIT 5;"
```

### File System

```bash
# Check uploaded files
ls -lah uploads/products/images/
ls -lah uploads/categories/images/

# Check image optimization (multiple sizes)
ls -lah uploads/products/images/ | grep thumb_
ls -lah uploads/products/images/ | grep small_
ls -lah uploads/products/images/ | grep medium_
ls -lah uploads/products/images/ | grep large_
```

### API Logs

```bash
# Check API logs for errors
docker logs techtools-api-dev --tail 100

# Follow logs in real-time
docker logs techtools-api-dev -f
```

---

## 9️⃣ Performance Testing

### Bulk Product Creation

Use Postman Collection Runner:

1. Select folder: "📦 Products with Media"
2. Click "Run" button
3. Set iterations: 10
4. Run collection
5. View results summary

### Load Testing (Optional)

```bash
# Install Artillery (if not installed)
npm install -g artillery

# Create load test
artillery quick --count 10 --num 100 http://localhost:9000/api/v1/products
```

---

## 🆘 Need Help?

### Check API Status

```bash
# Health check
curl http://localhost:9000/health

# API info
curl http://localhost:9000/api/v1
```

### View Logs

```bash
# API logs
docker logs techtools-api-dev

# Database logs
docker logs techtools-postgres-dev

# All logs
docker-compose logs -f
```

### Restart Services

```bash
# Restart API
docker restart techtools-api-dev

# Restart all
docker-compose restart

# Full rebuild
docker-compose down
docker-compose up -d --build
```

---

## 📚 Reference Documents

- **Complete API Guide:** `MEDIA-AND-COLLECTIONS-GUIDE.md`
- **Create with Media Guide:** `CREATE-WITH-MEDIA-GUIDE.md`
- **Postman Guide:** `POSTMAN-GUIDE-v2.md`
- **README:** `README.md`

---

## ✅ Success Indicators

You'll know testing is successful when:

1. ✅ Login returns access token
2. ✅ Can create categories and products
3. ✅ Images upload and get optimized (4 sizes)
4. ✅ Videos upload successfully
5. ✅ Collections created and products added
6. ✅ Media appears in responses with CDN URLs
7. ✅ Can set primary images
8. ✅ Can reorder media
9. ✅ Admin activity is logged
10. ✅ All Postman tests pass (green checkmarks)

---

## 🎉 All Set!

Your enterprise-grade API is ready for comprehensive testing. Start with the authentication request and work through the scenarios above.

**Happy Testing! 🚀**
