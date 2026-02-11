# 🎯 Type Generation System

Automated TypeScript type generation from PostgreSQL database schema for both API and Admin Dashboard.

## 📋 Overview

This system automatically generates TypeScript interfaces from your database tables, ensuring perfect type safety between your database, API, and frontend.

## 🚀 Quick Start

### 1. Generate Types from Database

```bash
cd tech-tools-api
npm run generate:types
```

This will:
- Connect to PostgreSQL inside Docker
- Extract all table schemas
- Generate TypeScript interfaces
- Save to `tech-tools-api/src/types/generated.ts`
- Copy to `admin-dashboard/types/generated.ts`

### 2. Sync Types to Admin Dashboard (if needed)

```bash
cd admin-dashboard
npm run sync:types
```

### 3. Use Generated Types

**In API (tech-tools-api):**
```typescript
import { Users, Products, Categories } from './types/generated'

// All table names are PascalCase
const user: Users = { ... }
const product: Products = { ... }
```

**In Admin Dashboard:**
```typescript
import { Users, Products, ProductMedia } from '@/types'

// Use in components
const ProductCard = ({ product }: { product: Products }) => {
  ...
}
```

## 📂 Generated Files

```
tech-tools-api/
  └── src/types/
      ├── index.ts          # Manual types
      └── generated.ts      # Auto-generated (30 interfaces)

admin-dashboard/
  └── types/
      ├── index.ts          # Re-exports generated types
      └── generated.ts      # Copy of API generated types
```

## 🔄 Workflow

### When You Change Database Schema

```bash
# 1. Update migration files
nano tech-tools-api/src/database/migrations/004_new_feature.sql

# 2. Run migration
cd tech-tools-api
docker-compose -f docker-compose.dev.yml up -d
docker exec techtools-postgres-dev psql -U techtools_user -d techtools -f /docker-entrypoint-initdb.d/004_new_feature.sql

# 3. Regenerate types
npm run generate:types

# 4. Restart dev servers to pick up new types
cd ../admin-dashboard
rm -rf .next
npm run dev
```

## 📋 Type Mapping

| PostgreSQL | TypeScript |
|-----------|-----------|
| varchar, text, uuid | string |
| integer, bigint, numeric | number |
| boolean | boolean |
| timestamp, date | string (ISO) |
| json, jsonb | any |
| arrays | T[] |

## ✨ Features

### Automatic Features:
- ✅ **Field Optionality**: Nullable fields and fields with defaults are marked optional (`?`)
- ✅ **camelCase Conversion**: `user_type` becomes `userType`
- ✅ **PascalCase Interfaces**: `users` table becomes `Users` interface
- ✅ **Array Handling**: PostgreSQL arrays map to TypeScript arrays
- ✅ **JSONB Typing**: Known JSONB fields get proper structure (e.g., `cdn_urls`)

### Generated Response Types:
```typescript
// These are included in every generation
interface ApiResponse<T> { success: boolean; data: T }
interface PaginatedResponse<T> { success: boolean; data: { items: T[] } }
interface AuthResponse { success: boolean; data: { accessToken, refreshToken, user: Users } }
```

## 🛠️ Commands

### tech-tools-api

```bash
npm run generate:types        # Generate types from database
npm run generate:types:local  # Local generation (for container)
npm run types:watch            # Watch migrations and auto-regenerate
```

### admin-dashboard

```bash
npm run sync:types  # Copy types from API to dashboard
```

## 🔧 Configuration

The generator reads from `.env`:

```env
DB_HOST=postgres        # Use 'postgres' in Docker, 'localhost' from host
DB_PORT=5432
DB_NAME=techtools
DB_USER=techtools_user
DB_PASSWORD=ChangeMe123!
```

## 📖 Examples

### Example 1: Using Generated Types in API Controller

```typescript
// src/api/v1/products/product.controller.ts
import { Products, ProductMedia, ApiResponse } from '@/types/generated'

export const getProduct = async (req: Request, res: Response) => {
  const product: Products = await db.query(...)
  
  const response: ApiResponse<Products> = {
    success: true,
    data: product
  }
  
  res.json(response)
}
```

### Example 2: Using in Admin Dashboard Service

```typescript
// services/product.service.ts
import { Products, PaginatedResponse } from '@/types'
import apiClient from '@/lib/api-client'

export const getProducts = async (): Promise<PaginatedResponse<Products>> => {
  const response = await apiClient.get<PaginatedResponse<Products>>('/products')
  return response.data
}
```

### Example 3: Using in React Component

```typescript
// components/products/ProductForm.tsx
import { Products, Categories } from '@/types'
import { useState } from 'react'

export function ProductForm() {
  const [product, setProduct] = useState<Partial<Products>>({
    name: '',
    slug: '',
    basePrice: 0,
    isActive: true
  })
  
  // TypeScript knows all fields and their types!
  const handleSubmit = () => {
    // product.basePrice is number
    // product.isActive is boolean
    // Full autocomplete support!
  }
}
```

## 🚨 Troubleshooting

### Types not updating in VS Code
```bash
# Restart TypeScript server
# In VS Code: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Or clear Next.js cache
cd admin-dashboard
rm -rf .next
```

### "Module not found: generated.ts"
```bash
# Regenerate types
cd tech-tools-api
npm run generate:types

# Verify file exists
ls -la src/types/generated.ts
ls -la ../admin-dashboard/types/generated.ts
```

### Type mismatches after schema changes
```bash
# 1. Regenerate types
npm run generate:types

# 2. Clear caches
cd ../admin-dashboard
rm -rf .next

# 3. Restart both servers
```

## 💡 Best Practices

1. **Always regenerate after migrations**
   ```bash
   # After running migrations
   npm run generate:types
   ```

2. **Commit generated files**
   - Include `generated.ts` in version control
   - Ensures team has same types

3. **Don't edit generated.ts manually**
   - Changes will be overwritten
   - Extend types in `index.ts` instead

4. **Use generated types everywhere**
   ```typescript
   // ✅ Good
   import { Products } from '@/types'
   
   // ❌ Avoid
   interface Product { ... }  // Manual duplication
   ```

5. **Extend when needed**
   ```typescript
   // types/custom.ts
   import { Users } from './generated'
   
   export interface UserWithProfile extends Users {
     profileUrl: string
     bio: string
   }
   ```

## 📊 Current Schema

Generated from your database (as of last generation):

- **30 Tables** → 30 TypeScript Interfaces
- **376 Columns** → Fully typed properties
- Includes: Users, Products, Categories, Orders, Payments, Media, Collections, Admin Management, etc.

## 🎉 Benefits

✅ **100% Type Safe**: Database schema = TypeScript types  
✅ **Auto-complete**: Full IntelliSense in VS Code  
✅ **No Typos**: Catch field name errors at compile time  
✅ **Refactor Safely**: Rename fields with confidence  
✅ **Documentation**: Types serve as living documentation  
✅ **Consistency**: Same types in API and Dashboard  
✅ **Time Saving**: No manual type maintenance

## 🔗 Related Files

- [scripts/generate-types-from-db.ts](../scripts/generate-types-from-db.ts) - Generator script
- [scripts/TYPE-GENERATION-README.md](../scripts/TYPE-GENERATION-README.md) - Detailed technical docs
- [src/types/generated.ts](../src/types/generated.ts) - Generated types (API)
- [../admin-dashboard/types/generated.ts](../../admin-dashboard/types/generated.ts) - Generated types (Dashboard)
