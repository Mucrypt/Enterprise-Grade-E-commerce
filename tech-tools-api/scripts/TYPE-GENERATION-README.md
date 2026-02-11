# Database Type Generation

This directory contains scripts for automatically generating TypeScript types from your PostgreSQL database schema.

## 📝 Overview

The type generation system keeps your TypeScript interfaces in sync with your database schema, preventing type mismatches between frontend and backend.

## 🚀 Usage

### Generate Types Once

```bash
npm run generate:types
```

This will:

1. Connect to your PostgreSQL database
2. Query all tables and columns from the `public` schema
3. Generate TypeScript interfaces for each table
4. Save types to:
   - `tech-tools-api/src/types/generated.ts`
   - `admin-dashboard/types/generated.ts`

### Watch Mode (Auto-regenerate)

```bash
npm run types:watch
```

This will watch your migration files and automatically regenerate types when they change.

## 📂 Generated Files

### tech-tools-api/src/types/generated.ts

Contains all database table interfaces for the API:

```typescript
export interface Users {
  id: string
  email: string
  firstName: string
  lastName: string
  // ...
}

export interface Products {
  id: string
  name: string
  basePrice: number
  // ...
}
```

### admin-dashboard/types/generated.ts

Same interfaces copied for the admin dashboard to import.

## 🔄 Integration in Your Code

### In API (tech-tools-api)

```typescript
import { Users, Products, Categories } from './types/generated'
import { ApiResponse } from './types/generated'

// Use in controllers
export const getProduct = async (req: Request, res: Response) => {
  const product: Products = await db.query(...)
  const response: ApiResponse<Products> = {
    success: true,
    data: product
  }
  res.json(response)
}
```

### In Admin Dashboard

```typescript
import { User, Product, Category } from '@/types/generated'
import { ApiResponse, PaginatedResponse } from '@/types/generated'

// Use in services
export const getProducts = async (): Promise<PaginatedResponse<Product>> => {
  const response = await apiClient.get('/products')
  return response.data
}
```

## 🔧 Type Mappings

PostgreSQL types are automatically mapped to TypeScript:

| PostgreSQL Type          | TypeScript Type      |
| ------------------------ | -------------------- |
| varchar, text, uuid      | string               |
| integer, bigint, numeric | number               |
| boolean                  | boolean              |
| timestamp, date          | string (ISO format)  |
| json, jsonb              | any (or custom type) |
| Arrays                   | T[]                  |

## 🎯 Best Practices

1. **Run after migrations**: Always run `npm run generate:types` after creating or modifying migrations

2. **Commit generated files**: Include generated type files in version control so all team members have the same types

3. **Use in services**: Import and use generated types in your API controllers and frontend services

4. **Don't edit manually**: Never manually edit `generated.ts` files - they will be overwritten

5. **Extend when needed**: Create separate files for custom types that extend the generated ones:

```typescript
// types/custom.ts
import { Users } from './generated'

export interface UserWithProfile extends Users {
  profilePicture: string
  bio: string
}
```

## 🔄 Workflow

### When Creating New Tables

```bash
# 1. Create migration
nano src/database/migrations/004_new_table.sql

# 2. Run migration
npm run migrate:up

# 3. Generate types
npm run generate:types

# 4. Use in code
import { NewTable } from './types/generated'
```

### When Modifying Tables

```bash
# 1. Update migration
nano src/database/migrations/004_modify_table.sql

# 2. Run migration
npm run migrate:up

# 3. Regenerate types
npm run generate:types

# 4. Update code that uses the modified type
```

## 🛠️ Configuration

The generator connects using environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=techtools
DB_USER=techtools_user
DB_PASSWORD=ChangeMe123!
```

## 📋 Example Output

```typescript
// Auto-generated from PostgreSQL database schema
// Generated on: 2026-02-10T20:45:00.000Z
// DO NOT EDIT MANUALLY

export interface Users {
  id: string
  email: string
  password: string
  firstName: string
  lastName: string
  userType: string
  emailVerified: boolean
  createdAt: string
  updatedAt?: string
}

export interface Products {
  id: string
  sku: string
  name: string
  slug: string
  description: string
  categoryId: string
  basePrice: number
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: {
    items: T[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}
```

## 🐛 Troubleshooting

### "Cannot connect to database"

- Ensure PostgreSQL is running: `docker ps`
- Check `.env` file has correct database credentials
- Try connecting manually: `psql -h localhost -U techtools_user -d techtools`

### "No tables found"

- Run migrations first: `npm run migrate:up`
- Check tables exist: `docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools -c "\dt"`

### "Generated types don't match database"

- Run migrations: `npm run migrate:up`
- Regenerate types: `npm run generate:types`
- Clear Next.js cache: `cd admin-dashboard && rm -rf .next`

### "Type mismatch errors after generation"

- Restart your dev servers to pick up new types
- Clear TypeScript cache in VS Code: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

## 🔐 Security Note

The generator script uses database credentials from `.env`. Never commit `.env` files to version control.

## 🎉 Benefits

✅ **Type Safety**: Guaranteed sync between database and TypeScript  
✅ **Auto-completion**: Full IntelliSense for database fields  
✅ **Error Prevention**: Catch typos and missing fields at compile time  
✅ **Documentation**: Generated types serve as living documentation  
✅ **Consistency**: Both API and dashboard use identical types  
✅ **Time Saving**: No manual type maintenance required
