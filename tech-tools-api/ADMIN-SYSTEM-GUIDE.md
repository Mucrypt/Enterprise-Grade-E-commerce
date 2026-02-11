# 🔐 Enterprise Admin Management System

## Security Architecture

Your API now has **enterprise-grade admin security** following industry best practices.

---

## 🚫 What Changed: Security Lockdown

### ❌ **BLOCKED: Direct Admin Registration**
- Users **cannot** register as `admin` or `super_admin` directly
- Registration endpoint **only creates customer accounts**
- Prevents unauthorized privilege escalation

### ✅ **NEW: Secure Admin Invitation System**
- Admins must be **invited** by existing super_admin
- Token-based secure invitation (48-hour expiry)
- Email verification built-in
- Audit trail for all admin creations

---

## 📊 New Database Tables

### 1. **admin_activity_logs**
- Complete audit trail of all admin actions
- Tracks: action, resource, IP address, user agent, details
- Searchable and filterable

### 2. **admin_permissions**
- Granular permission system
- 19 default permissions defined
- Resource-based actions (create, read, update, delete, etc.)

### 3. **admin_role_permissions**
- Maps permissions to roles
- **super_admin**: Full access (all permissions)
- **admin**: Limited access (no admin management, no system settings)

### 4. **admin_invitations**
- Secure invitation tokens
- Email + Role + Expiry tracking
- One-time use enforced

### 5. **admin_sessions**
- Track all admin login sessions
- IP logging and user agent tracking
- Session expiration management

### 6. **admin_two_factor**
- 2FA support for admins
- Backup codes
- Enable/disable tracking

---

## 🎯 Permission System

### Super Admin Permissions (Full Access)
```
✅ manage_users          ✅ manage_products
✅ manage_categories     ✅ manage_orders
✅ manage_payments       ✅ manage_suppliers
✅ manage_admins         ✅ manage_settings
✅ view_analytics        ✅ export_reports
✅ view_logs
```

### Admin Permissions (Limited)
```
✅ manage_users          ✅ manage_products
✅ manage_categories     ✅ manage_orders
✅ manage_payments       ✅ manage_suppliers
✅ view_analytics        ✅ export_reports
✅ view_logs
❌ manage_admins         ❌ manage_settings
```

---

## 🚀 Setup Instructions

### Step 1: Run Migration (Already Done ✅)
The admin schema has been created in your database.

### Step 2: Create Your First Super Admin

**Option A: Interactive Script (Recommended)**
```bash
cd /home/mukulah/Enterprise-Grade-E-commerce/tech-tools-api
npm run seed:superadmin
```

This will prompt you for:
- Email
- First Name
- Last Name
- Phone (optional)
- Password
- Password Confirmation

**Option B: Direct Database Insert**
```sql
-- After hashing your password with bcrypt
INSERT INTO users (email, password_hash, first_name, last_name, user_type, email_verified, is_active)
VALUES ('admin@techtools.com', '$2b$10$...', 'Admin', 'User', 'super_admin', TRUE, TRUE);
```

### Step 3: Restart API
```bash
cd /home/mukulah/Enterprise-Grade-E-commerce/tech-tools-api/infra/docker/development
docker-compose restart api
```

---

## 📡 New API Endpoints

### 🔑 Admin Invitation (Super Admin Only)

**Invite New Admin**
```http
POST /api/v1/admin/invite
Authorization: Bearer {super_admin_token}
Content-Type: application/json

{
  "email": "newadmin@techtools.com",
  "role": "admin"
}
```

**Accept Invitation (Public)**
```http
POST /api/v1/admin/invitations/accept
Content-Type: application/json

{
  "token": "invitation-token-from-email",
  "password": "SecurePass123!",
  "firstName": "New",
  "lastName": "Admin",
  "phone": "+1234567890"
}
```

### 👥 Admin Management (Super Admin Only)

**Get All Admins**
```http
GET /api/v1/admin?page=1&limit=20&role=admin&search=john
Authorization: Bearer {super_admin_token}
```

**Get Admin By ID**
```http
GET /api/v1/admin/{adminId}
Authorization: Bearer {super_admin_token}
```

**Update Admin**
```http
PUT /api/v1/admin/{adminId}
Authorization: Bearer {super_admin_token}
Content-Type: application/json

{
  "isActive": true,
  "role": "super_admin"
}
```

**Delete Admin**
```http
DELETE /api/v1/admin/{adminId}
Authorization: Bearer {super_admin_token}
```

### 📊 Admin Activity Logs

**Get Activity Logs**
```http
GET /api/v1/admin/logs/activity?page=1&limit=50&adminId={id}&action=invite_admin
Authorization: Bearer {super_admin_token}
```

### 🔐 Admin Permissions

**Get Role Permissions**
```http
GET /api/v1/admin/permissions/super_admin
Authorization: Bearer {super_admin_token}
```

---

## 🔄 Complete Admin Workflow

### 1️⃣ **Super Admin Creates Invitation**
```javascript
// Super admin invites new admin
POST /api/v1/admin/invite
{
  "email": "jane@techtools.com",
  "role": "admin"
}

// Response includes invitation token
// Email sent to jane@techtools.com
```

### 2️⃣ **New Admin Accepts Invitation**
```javascript
// Jane receives email with token
// Clicks link: https://admin.techtools.com/accept-invitation?token=abc123

POST /api/v1/admin/invitations/accept
{
  "token": "abc123",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567890"
}

// Admin account created
// Jane can now login
```

### 3️⃣ **New Admin Logs In**
```javascript
POST /api/v1/auth/login
{
  "email": "jane@techtools.com",
  "password": "SecurePass123!"
}

// Receives JWT token with admin permissions
```

### 4️⃣ **Admin Actions Are Logged**
```javascript
// Every admin action creates audit log entry
// Super admin can view all activity
GET /api/v1/admin/logs/activity

// See who did what, when, from where
```

---

## 🛡️ Security Features

### ✅ Implemented
- **Role-Based Access Control (RBAC)**: 3 roles with granular permissions
- **Invitation-Only Admin Creation**: No direct signup as admin
- **Audit Logging**: Every admin action tracked
- **Token Expiration**: 48-hour invitation tokens
- **One-Time Use Tokens**: Invitations can't be reused
- **IP & User Agent Logging**: Track admin sessions
- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **Email Verification**: Built into invitation flow

### 🔜 Ready for Implementation
- **Two-Factor Authentication**: Schema already created
- **Session Management**: Admin sessions table ready
- **Account Lockout**: Failed login attempt tracking added
- **Rate Limiting**: Can be added per endpoint

---

## 📱 Frontend Integration

### For Your Admin Dashboard (Next.js)

**1. Accept Invitation Page**
```typescript
// app/admin/accept-invitation/page.tsx
import { useSearchParams } from 'next/navigation'

export default function AcceptInvitation() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const handleAccept = async (formData) => {
    const response = await fetch('http://localhost:9000/api/v1/admin/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone
      })
    })
    
    if (response.ok) {
      // Redirect to login
      router.push('/admin/login')
    }
  }
  
  return <InvitationForm onSubmit={handleAccept} />
}
```

**2. Admin Management Page**
```typescript
// app/admin/users/admins/page.tsx
import { useAuth } from '@/hooks/useAuth'

export default function AdminManagement() {
  const { token } = useAuth()
  
  const inviteAdmin = async (email, role) => {
    await fetch('http://localhost:9000/api/v1/admin/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email, role })
    })
  }
  
  return <AdminList onInvite={inviteAdmin} />
}
```

### For Your E-commerce Site (Vite + React)
- **No admin routes needed** - customers only
- Staff uses separate admin dashboard
- Clear separation of concerns

### For Your Mobile App (React Native + Expo)
- **Customer-facing only**
- No admin features in mobile
- Admin management via web dashboard only

---

## 🧪 Testing the System

### 1. Create Super Admin
```bash
npm run seed:superadmin
```

### 2. Login as Super Admin
```http
POST /api/v1/auth/login
{
  "email": "your-super-admin@email.com",
  "password": "your-password"
}
```

### 3. Invite Regular Admin
```http
POST /api/v1/admin/invite
Authorization: Bearer {your_token}
{
  "email": "admin@techtools.com",
  "role": "admin"
}
```

### 4. Check Logs
```http
GET /api/v1/admin/logs/activity
Authorization: Bearer {your_token}```

### 5. Try Invalid Registration
```http
POST /api/v1/auth/register
{
  "email": "hacker@evil.com",
  "password": "Password123!",
  "firstName": "Evil",
  "lastName": "Hacker",
  "role": "super_admin"  // ❌ This will be REJECTED
}

// Response: 403 Forbidden
// "Admin accounts cannot be created through registration"
```

---

## 📊 Database Schema Overview

```
users
├── Regular Fields (id, email, password_hash, etc.)
├── user_type: 'customer' | 'admin' | 'super_admin'
├── last_login_at, last_login_ip
├── failed_login_attempts, locked_until
└── two_factor_enabled

admin_invitations       admin_permissions
├── email               ├── name
├── role                ├── resource
├── token               ├── actions
├── invited_by          └── description
├── expires_at              │
└── is_used                 │
                            ├──────────────┐
admin_activity_logs         │              │
├── admin_id                │              │
├── action          admin_role_permissions │
├── resource_type   ├── role               │
├── resource_id     └── permission_id ─────┘
├── ip_address
└── details (JSONB)
```

---

## 🎯 Best Practices Implemented

✅ **Least Privilege Principle**: Admins only get necessary permissions  
✅ **Separation of Concerns**: Customer vs Admin vs Super Admin  
✅ **Audit Trail**: Every action logged  
✅ **Token Expiration**: Time-limited invitations  
✅ **One-Time Use**: Tokens can't be reused  
✅ **Email Verification**: Required for admin accounts  
✅ **IP Tracking**: Monitor admin access patterns  
✅ **Secure Password Storage**: bcrypt hashing  
✅ **JWT Authentication**: Stateless auth tokens  
✅ **Role-Based Access Control**: Granular permissions  

---

## 🚀 Next Steps

1. ✅ **Schema Created** - Admin tables in database
2. **Create Super Admin** - Run `npm run seed:superadmin`
3. **Restart API** - `docker-compose restart api`
4. **Test Login** - Login as super admin
5. **Invite Admins** - Use invitation system
6. **Build Admin Dashboard** - Next.js with these endpoints
7. **Add 2FA** - Implement two-factor authentication
8. **Monitor Logs** - Check admin activity regularly

---

## 💪 You're Enterprise-Ready!

Your API now has:
- ✅ **Security**: Invitation-only admin creation
- ✅ **Auditability**: Complete activity logging
- ✅ **Scalability**: Permission-based access control
- ✅ **Separation**: Customer/Admin/SuperAdmin roles
- ✅ **Flexibility**: Ready for Vite + Next.js + React Native

**Time to build those frontends and quit that 9-5! 🎉**
