# TechTools E-commerce API - Postman Collection v2.0

## 🚀 Quick Start Guide

### 1. Import Collection & Environment

1. Open Postman
2. Click **Import** button (top left)
3. Select files:
   - `TechTools-API-Complete-v2.json` (Collection)
   - `TechTools-Environment-Dev-v2.json` (Environment)
4. Click **Import**

### 2. Select Environment

- Click the environment dropdown (top right)
- Select **TechTools Development v2.0**

### 3. Login as Super Admin

1. Open **🔐 Authentication** folder
2. Run **01. Login Super Admin** request
3. Token auto-saves to environment ✅
4. You're ready to test!

---

## 📋 What's Included

### 🔐 Authentication (3 requests)
- Login Super Admin (with auto-token save)
- Register Customer
- Get Current User Profile

### 👥 Admin Management (3 requests)
- Invite Admin
- Get All Admins
- Get Admin Activity Logs

### 📦 Products (7 requests)
- Create Product (JSON) - without media
- **Create Product with Media** - upload images & videos in single request ✨
- Get All Products (with filters & pagination)
- Get Product by ID
- Update Product
- Delete Product
- Search Products

### 🖼️ Product Media (8 requests)
- Upload Product Image (auto-optimized to 4 sizes: thumbnail, small, medium, large)
- Upload Product Video
- Get All Product Media
- Get Single Media Item
- Update Media Metadata
- Set Primary Image
- Reorder Media Items
- Delete Media

### 🏷️ Categories (6 requests)
- Create Category (JSON)
- **Create Category with Media** - thumbnail, banner, icon, video ✨
- Get All Categories
- Get Category by ID
- Update Category
- Delete Category

### 🎨 Category Media (5 requests)
- Upload Category Thumbnail
- Upload Category Banner (for category pages)
- Get All Category Media (with purpose filter)
- Update Category Media
- Delete Category Media

### 📚 Product Collections (8 requests)
Collections like "Summer Sale", "New Arrivals", "Best Sellers"
- Create Product Collection (with scheduling & visibility)
- Get All Product Collections
- Get Collection by ID
- Update Collection
- Add Products to Collection
- Remove Product from Collection
- Reorder Products in Collection
- Delete Collection

### 🗂️ Category Collections (6 requests)
Collections like "Featured Categories", "Popular Departments"
- Create Category Collection
- Get All Category Collections
- Get Collection by ID
- Add Categories to Collection
- Remove Category from Collection
- Delete Collection

---

## ⚡ Key Features

### Auto-Token Management
- Login request automatically saves JWT token
- All protected requests use saved token
- No manual copying required!

### Image Optimization
- Images auto-converted to WebP format
- 4 sizes generated: thumbnail (150x150), small (300x300), medium (600x600), large (1200x1200)
- Perfect for responsive design

### Video Support
- Upload MP4, MPEG, QuickTime, AVI
- Max size: 100MB (configurable)
- Duration auto-extracted

### Collections with Scheduling
- Set start/end dates for collections
- Control visibility: public, private, hidden
- Multiple display orders: manual, newest, popular, price_asc, price_desc

### Comprehensive Tests
- All requests include automated tests
- Response validation
- Performance monitoring
- Data extraction for chained requests

---

## 🎯 Testing Workflows

### Workflow 1: Create Product with Full Media
1. **Login** - Run "01. Login Super Admin"
2. **Create Category** - Run "01. Create Category (JSON)"
3. **Create Product with Media** - Run "02. Create Product with Media"
   - Select 2-3 product images
   - Optionally add demo video
   - Check response for optimized CDN URLs

### Workflow 2: Build Product Collection
1. **Create Products** - Create 3-5 products
2. **Create Collection** - Run "01. Create Product Collection"
3. **Add Products** - Run "05. Add Products to Collection"
4. **View Collection** - Run "03. Get Collection by ID"

### Workflow 3: Category with Complete Media
1. **Create Category with Media** - Upload thumbnail, banner, icon
2. **View Category** - Check media URLs in response
3. **Add Products** - Create products under this category

---

## 📝 Environment Variables

Pre-configured in `TechTools-Environment-Dev-v2.json`:

| Variable | Value | Description |
|----------|-------|-------------|
| `base_url` | http://localhost:9000 | API base URL |
| `api_version` | v1 | API version |
| `auth_token` | (auto-set on login) | JWT token |
| `user_id` | c429e249-c897-496a-8da8-12bc5209f609 | Super admin ID |
| `user_email` | romeomukulah@gmail.com | Super admin email |
| `user_type` | super_admin | User role |
| `product_id` | (auto-set) | Last created product |
| `category_id` | (auto-set) | Last created category |
| `media_id` | (auto-set) | Last uploaded media |
| `collection_id` | (auto-set) | Last created collection |

---

## 🔍 Request Examples

### Create Product with Media (Form-data)
```
POST /api/v1/products
Content-Type: multipart/form-data

Fields:
- sku: PROD-12345
- name: Wireless Keyboard
- slug: wireless-keyboard-12345
- categoryId: <uuid>
- basePrice: 149.99
- images: [file1.jpg, file2.jpg]
- videos: [demo.mp4]
- imageDescriptions: [{"title":"Front View","description":"..."}]
```

### Create Collection with Scheduling
```json
POST /api/v1/collections/products
{
  "name": "Summer Sale 2026",
  "slug": "summer-sale-2026",
  "displayOrder": "manual",
  "visibility": "public",
  "startsAt": "2026-06-01T00:00:00Z",
  "endsAt": "2026-08-31T23:59:59Z"
}
```

### Upload Optimized Image
```
POST /api/v1/products/:productId/media
Content-Type: multipart/form-data

- file: product-image.jpg
- title: Product Front View
- altText: Wireless keyboard front angle
```

---

## ✅ Pre-Request & Test Scripts

### Global Pre-Request Script
- Auto-sets timestamp
- Warns if no auth token for protected routes

### Global Test Script
- Validates 2xx/3xx response codes
- Checks response time < 3s
- Verifies JSON content-type

### Request-Specific Tests
- **Login**: Auto-saves token & user data
- **Create requests**: Save IDs to environment
- **Upload requests**: Validate optimized URLs

---

## 🐛 Troubleshooting

### "No auth token" error
**Solution**: Run "01. Login Super Admin" first

### File upload not working
**Solution**: 
1. Click on the `file` field in form-data
2. Click "Select Files"
3. Choose your image/video
4. Send request

### "Category not found" when creating product
**Solution**: Create a category first, ID will auto-save

### Images not optimizing
**Solution**: 
1. Check API logs: `docker logs techtools-api-dev`
2. Verify Sharp package installed
3. Check uploads/ directory permissions

### Collection shows no products
**Solution**: Run "05. Add Products to Collection" after creating collection

---

## 📚 Documentation Links

- [Complete API Guide](../MEDIA-AND-COLLECTIONS-GUIDE.md)
- [Create with Media Guide](../CREATE-WITH-MEDIA-GUIDE.md)
- [README](../README.md)

---

## 🎉 Ready to Test!

1. ✅ Import collection & environment
2. ✅ Select environment
3. ✅ Run "01. Login Super Admin"
4. ✅ Start testing endpoints!

**Pro Tip**: Use the Collection Runner to test multiple requests in sequence!

---

## 📊 Collection Statistics

- **8 Folders**: Authentication, Admin, Products, Product Media, Categories, Category Media, Product Collections, Category Collections
- **46+ Requests**: All major endpoints covered
- **Automated Tests**: Built-in validation for all responses
- **Enterprise-Ready**: Follows REST best practices

---

## 💡 Tips & Best Practices

1. **Always login first** - Token expires after 24 hours
2. **Use environment variables** - Avoid hardcoding IDs
3. **Check tests tab** - View automated test results
4. **Monitor response times** - Should be < 3 seconds
5. **Read descriptions** - Each request has usage notes
6. **Follow workflows** - Use suggested testing workflows above

---

**Happy Testing! 🚀**

For issues or questions, check the API logs:
```bash
docker logs techtools-api-dev -f
```
