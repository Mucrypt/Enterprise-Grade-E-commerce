# 🚀 TechTools API - Postman Collection

Complete, professional Postman collection for the TechTools Enterprise E-commerce API.

## 📦 What's Included

- **TechTools-API-Collection.json** - Complete API collection with all endpoints
- **TechTools-Environment-Development.json** - Development environment variables
- **TechTools-Environment-Production.json** - Production environment variables (update the base_url)

---

## 📥 How to Import into Postman

### Method 1: Direct Import (Recommended)

1. **Open Postman**
2. Click **Import** button (top left)
3. Click **Upload Files** or drag and drop
4. Select all 3 JSON files:
   - `TechTools-API-Collection.json`
   - `TechTools-Environment-Development.json`
   - `TechTools-Environment-Production.json`
5. Click **Import**

### Method 2: Import from File

1. Open Postman
2. Go to **Collections** → **Import** → **File**
3. Browse and select the collection JSON file
4. Repeat for environment files

---

## 🎯 Quick Start Guide

### Step 1: Select Environment

1. Click the **Environment dropdown** (top right in Postman)
2. Select **"TechTools - Development"**

### Step 2: Verify API is Running

1. Open the **"🏥 Health & System"** folder
2. Click **"API Health Check"**
3. Click **Send**
4. You should see: `{ "status": "OK", ... }`

### Step 3: Register a User

1. Open **"🔐 Authentication"** folder
2. Click **"Register New User"**
3. Click **Send**
4. User is created and `user_id` is automatically saved to environment

### Step 4: Login

1. Click **"Login User"**
2. Click **Send**
3. ✅ **Auth token is automatically extracted and saved!**
4. Now all protected endpoints will work

### Step 5: Test Protected Endpoints

1. Open **"👤 User Management"** folder
2. Click **"Get User Profile"**
3. Click **Send**
4. You should see your user profile data

---

## 🔐 Authentication Flow

The collection is configured with **automatic token management**:

1. **Login** → Token automatically extracted and saved to `{{auth_token}}`
2. **All protected endpoints** automatically use the token via Bearer Auth
3. Token persists across all requests until you logout or it expires

### Manual Token Setup (if needed)

If automatic extraction doesn't work:

1. Login and copy the `accessToken` from response
2. Go to **Environments** → **TechTools - Development**
3. Paste token into `auth_token` variable
4. Save

---

## 📋 Collection Features

### ✅ Automatic Token Management
- Login automatically extracts and saves JWT token
- All authenticated endpoints use the token automatically

### ✅ Dynamic Variables
- `{{base_url}}` - API base URL (changes per environment)
- `{{auth_token}}` - JWT access token
- `{{user_id}}` - Current user ID
- `{{product_id}}` - Product ID (auto-saved when creating/viewing products)
- `{{category_id}}` - Category ID (auto-saved)
- `{{order_id}}` - Order ID (auto-saved)
- `{{supplier_id}}` - Supplier ID (auto-saved)
- `{{admin_id}}` - Admin ID (auto-saved when viewing/managing admins)
- `{{admin_invitation_token}}` - Admin invitation token (auto-saved when sending invitation)
- `{{invited_admin_email}}` - Email of invited admin (auto-saved)

### ✅ Pre-populated Request Bodies
All POST/PUT requests include complete example data:
- Realistic product information
- Valid address formats
- Proper validation-ready data

### ✅ Automated Tests
Each request includes tests that:
- Verify response status codes
- Extract and save IDs automatically
- Check response times
- Validate required fields

---

## 📚 Endpoint Categories

### 🏥 Health & System (3 endpoints)
- API Health Check
- API v1 Health Check
- API Documentation

### 🔐 Authentication (6 endpoints)
- Register New User
- Login User
- Logout User
- Verify Email
- Forgot Password
- Reset Password

### 👤 User Management (6 endpoints)
- Get User Profile
- Update User Profile
- Get User Addresses
- Add User Address
- Update User Address
- Delete User Address

### 📦 Products (8 endpoints)
- Get All Products (with filters)
- Search Products
- Get Product By ID
- Create Product (Admin)
- Update Product (Admin)
- Delete Product (Admin)
- Get Product Variations
- Add Product Variation (Admin)

### 🏷️ Categories (6 endpoints)
- Get All Categories
- Get Category By ID
- Get Category Products
- Create Category (Admin)
- Update Category (Admin)
- Delete Category (Admin)

### 🛒 Orders (6 endpoints)
- Get User Orders
- Get Order By ID
- Create Order
- Get Order Items
- Cancel Order
- Update Order Status (Admin)

### 💳 Payments (6 endpoints)
- Create Payment Intent
- Confirm Payment
- Get Payment Methods
- Add Payment Method
- Remove Payment Method
- Get Payment History

### 🏭 Suppliers (7 endpoints - Admin Only)
- Get All Suppliers
- Get Supplier By ID
- Create Supplier
- Update Supplier
- Delete Supplier
- Get Supplier Products
- Sync Supplier Products

### 🔐 Admin Management (8 endpoints - Super Admin)
- **Invite Admin** - Send invitation to create admin account
- **Accept Admin Invitation** - Complete admin account setup with token
- **Get All Admins** - List all admins with filters and pagination
- **Get Admin By ID** - View specific admin details
- **Update Admin** - Modify admin role, name, or status
- **Delete Admin** - Remove admin account
- **Get Admin Activity Logs** - View comprehensive audit trail
- **Get Role Permissions** - See permissions for admin or super_admin roles

**Security Features:**
- ✅ Invitation-only admin creation (no direct registration)
- ✅ 48-hour expiring invitation tokens
- ✅ Complete audit logging of all admin actions
- ✅ Role-based permissions (19 granular permissions)
- ✅ Super admin protection (cannot delete last super_admin)

---

## 🧪 Recommended Testing Flow

### 1️⃣ Setup Phase
```
✓ Health Check
✓ Register User
✓ Login User (saves token)
```

### 2️⃣ Category Management (Admin)
```
✓ Create Category
✓ Get All Categories
✓ Get Category By ID
```

### 3️⃣ Product Management (Admin)
```
✓ Create Product
✓ Get All Products
✓ Search Products
✓ Get Product By ID
✓ Update Product
```

### 4️⃣ User Features (Customer)
```
✓ Get User Profile
✓ Update User Profile
✓ Add User Address
✓ Get User Addresses
```

### 5️⃣ Shopping Flow (Customer)
```
✓ Browse Products
✓ Create Order
✓ Get Order By ID
✓ Get User Orders
### 8️⃣ Admin Management (Super Admin Only)
```
✓ Get All Admins (saves first admin_id)
✓ Invite New Admin (saves invitation token)
✓ Accept Admin Invitation (creates admin account)
✓ Get Admin By ID
✓ Get Admin Activity Logs (see audit trail)
✓ Get Role Permissions
✓ Update Admin (change role or status)
✓ Delete Admin
```

**🔒 Admin Security Flow:**
1. Login as super_admin (use your existing account: romeomukulah@gmail.com)
2. admin_id` | Last admin ID | ✅ Auto (view/manage admins) |
| `admin_invitation_token` | Admin invite token | ✅ Auto (invite admin) |
| `invited_admin_email` | Invited admin email | ✅ Auto (invite admin) |
| `Invite new admin → token auto-saved to `{{admin_invitation_token}}`
3. Accept invitation → creates admin account with secure password
4. New admin can now login and access admin endpoints
5. View audit logs to track all admin actions

```

### 6️⃣ Payment Flow (Customer)
```
✓ Add Payment Method
✓ Create Payment Intent
✓ Confirm Payment
✓ Get Payment History
```

### 7️⃣ Admin Operations
```
✓ Update Order Status
✓ Create Supplier
✓ Sync Supplier Products
```

---

## 🔧 Environment Variables Reference

| Variable | Description | Auto-Set |
|----------|-------------|----------|
| `base_url` | API base URL | Manual |
| `auth_token` | JWT access token | ✅ Auto (on login) |
| `refresh_token` | JWT refresh token | ✅ Auto (on login) |
| `user_id` | Current user ID | ✅ Auto (on register/login) |
| `product_id` | Last product ID | ✅ Auto (create/view product) |
| `category_id` | Last category ID | ✅ Auto (create/view category) |
| `order_id` | Last order ID | ✅ Auto (create/view order) |
| `supplier_id` | Last supplier ID | ✅ Auto (create/view supplier) |
| `payment_intent_id` | Payment intent ID | ✅ Auto (create intent) |
| `timestamp` | Request timestamp | ✅ Auto (every request) |

---

## 🌐 Switching Environments

### Development (Local)
```
Environment: TechTools - Development
base_url: http://localhost:9000
```

### Production (Hetzner)
```
Environment: TechTools - Production
base_url: https://api.yourdomain.com
```

To switch:
1. Click environment dropdown (top right)
2. Select environmentor super_admin role

**Option 1: Login with existing super_admin account**
```
Email: romeomukulah@gmail.com
Password: [your password]
```

**Option 2: Create new super_admin (first time setup)**
```bash
cd tech-tools-api
npm run seed:superadmin
# Follow prompts to create account
```

**Option 3: Admin invitation flow (secure)**
1. Login as super_admin
2. Use "Invite Admin" endpoint
3. Check email for invitation token (or copy from Postman response)
4. Use "Accept Admin Invitation" endpoint with token
5. New admin can now login

**⚠️ Security Note:** Direct admin registration via `/api/v1/auth/register` is blocked for security. Admins must be invited by super_admin.

## 🚨 Troubleshooting

### ❌ "Could not send request" Error
**Solution:** Make sure your API is running
```bash
cd /home/mukulah/Enterprise-Grade-E-commerce/tech-tools-api/infra/docker/development
docker-compose ps
# API should be "Up"
```

### ❌ "401 Unauthorized" Error
**Solution:** Token expired or not set
1. Run **Login User** request again
2. Token will be automatically refreshed
3. Retry your request

### ❌ "403 Forbidden" Error (Admin endpoints)
**Solution:** You need admin role
1. Register a new user
2. Manually set role to `admin` in database
3. Login with admin account

### ❌ Variables not auto-saving
**Solution:** Check Tests tab
1. Open request
2. Go to **Tests** tab
3. Verify script is present
4. Check Postman Console for errors

---

## 💡 Pro Tips

### 1. Use Collection Runner
Run entire folder to test multiple endpoints:
1. Right-click folder → **Run collection**
2. Select environment
3. Click **Run**
4. See all results at once

### 2. Save Example Responses
After successful requests:
1. Click **Save Response** → **Save as example**
2. Helps team members see expected responses

### 3. Use Pre-request Scripts
Add dynamic data to requests:
```javascript
pm.environment.set('random_email', `test${Date.now()}@example.com`);
```

### 4. Export Collection for Team
1. Right-click collection → **Export**
2. Choose **Collection v2.1**
3. Share with team via Git

---

## 📝 Notes

- **Admin Endpoints:** Some endpoints require `admin` or `super_admin` role
- **Rate Limiting:** API has rate limiting (check Nginx config)
- **CORS:** Development allows localhost origins
- **File Uploads:** Not included in v1 (use multipart/form-data when implemented)

---

## 🎉 You're Ready!

Your professional Postman collection is ready to use. Happy testing!

**Next Steps:**
1. Import the collection
2. Run Health Check
3. Register → Login
4. Test all endpoints
5. Build your admin dashboard
6. Build your store frontend
7. Build your mobile app
8. **Quit that 9-5! 💪**

---

## 📞 Support

If you encounter issues:
1. Check API logs: `docker-compose logs -f api`
2. Check database: Access pgAdmin at http://localhost:8080
3. Check Redis: Access Redis Commander at http://localhost:8081
4. Review `.env` configuration

---

**Happy Building! 🚀**
