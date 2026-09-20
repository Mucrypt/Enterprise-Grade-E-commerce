import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

// PostgreSQL to TypeScript type mapping
const pgToTsType: Record<string, string> = {
  'character varying': 'string',
  varchar: 'string',
  text: 'string',
  uuid: 'string',
  integer: 'number',
  bigint: 'number',
  smallint: 'number',
  numeric: 'number',
  decimal: 'number',
  real: 'number',
  'double precision': 'number',
  boolean: 'boolean',
  'timestamp without time zone': 'string',
  'timestamp with time zone': 'string',
  date: 'string',
  'time without time zone': 'string',
  json: 'any',
  jsonb: 'any',
  ARRAY: 'any[]',
}

interface ColumnInfo {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
  udt_name: string
}

interface EnumLabelRow {
  enum_type: string
  enum_label: string
}

interface TableInfo {
  [tableName: string]: ColumnInfo[]
}

// Convert snake_case to PascalCase
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

// Convert snake_case to camelCase
function toCamelCase(str: string): string {
  const parts = str.split('_')
  return (
    parts[0] +
    parts
      .slice(1)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  )
}

async function generateTypesFromDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'techtools',
    user: process.env.DB_USER || 'techtools_user',
    password: process.env.DB_PASSWORD || 'ChangeMe123!',
  })

  try {
    console.log('🔌 Connecting to database...')
    console.log(`   Host: ${process.env.DB_HOST || 'postgres'}`)
    console.log(`   Database: ${process.env.DB_NAME || 'techtools'}`)
    console.log(`   User: ${process.env.DB_USER || 'techtools_user'}`)

    // Query to get all columns from all tables
    const query = `
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.udt_name
      FROM
        information_schema.columns c
      JOIN
        information_schema.tables t ON c.table_name = t.table_name
      WHERE
        c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY
        c.table_name, c.ordinal_position
    `

    const result = await pool.query<ColumnInfo>(query)

    if (result.rows.length === 0) {
      console.log('⚠️  No tables found in the database')
      process.exit(1)
    }

    console.log(`✅ Found ${result.rows.length} columns in database`)

    // Every Postgres ENUM type's real ordered labels (pg_enum), keyed by
    // the type name exactly as columns reference it via udt_name. Before
    // this, a `data_type = 'USER-DEFINED'` column (every enum column in
    // this schema, including the whole seller-lifecycle status split)
    // fell through pgToTsType's lookup miss straight to 'any' -- silently
    // discarding the actual valid-value contract that is the entire
    // point of generating types from the database in the first place.
    // This is exactly the gap that let the admin dashboard, web store,
    // and mobile app each independently hand-write (and each
    // independently get wrong) the same enum's values as stale lowercase
    // strings after the seller-lifecycle migration moved them to
    // uppercase.
    const enumResult = await pool.query<EnumLabelRow>(`
      SELECT t.typname AS enum_type, e.enumlabel AS enum_label
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `)

    const enumLabelsByType = new Map<string, string[]>()
    enumResult.rows.forEach((row) => {
      const labels = enumLabelsByType.get(row.enum_type) || []
      labels.push(row.enum_label)
      enumLabelsByType.set(row.enum_type, labels)
    })

    console.log(`✅ Found ${enumLabelsByType.size} enum types in database`)

    // Group columns by table
    const tables: TableInfo = {}
    result.rows.forEach((row: ColumnInfo) => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = []
      }
      tables[row.table_name].push(row)
    })

    console.log(`📊 Processing ${Object.keys(tables).length} tables...`)

    // Generate TypeScript interfaces
    let output = '// Auto-generated from PostgreSQL database schema\n'
    output += `// Generated on: ${new Date().toISOString()}\n`
    output +=
      '// DO NOT EDIT MANUALLY - Run npm run generate:types to regenerate\n\n'

    // One exported named union type per Postgres ENUM type -- e.g.
    // seller_verification_case_status -> SellerVerificationCaseStatus,
    // with its real, current ordered label set. Emitted before the table
    // interfaces so every USER-DEFINED column below can reference it by
    // name instead of repeating (or worse, re-guessing) the union inline.
    if (enumLabelsByType.size > 0) {
      output += '// ---- Enum types (from pg_enum, real values, not guessed) ----\n\n'
      for (const [enumType, labels] of Array.from(enumLabelsByType.entries()).sort()) {
        const typeName = toPascalCase(enumType)
        const union = labels.map((label) => `'${label}'`).join(' | ')
        output += `export type ${typeName} = ${union}\n`
      }
      output += '\n'
    }

    // Generate interface for each table
    for (const [tableName, columns] of Object.entries(tables)) {
      const interfaceName = toPascalCase(tableName)

      output += `export interface ${interfaceName} {\n`

      columns.forEach((col) => {
        let tsType: string

        if (col.data_type === 'USER-DEFINED' && enumLabelsByType.has(col.udt_name)) {
          tsType = toPascalCase(col.udt_name)
        } else if (col.udt_name.startsWith('_')) {
          // Array types -- e.g. _text -> string[]. An array of a known
          // enum type resolves to that enum's named union array too,
          // not 'any[]'.
          const baseUdtName = col.udt_name.substring(1)
          const baseType = enumLabelsByType.has(baseUdtName)
            ? toPascalCase(baseUdtName)
            : pgToTsType[baseUdtName] || 'any'
          tsType = `${baseType}[]`
        } else {
          tsType = pgToTsType[col.data_type] || 'any'
        }

        // Handle JSONB with proper typing for known fields
        if (col.data_type === 'jsonb' && col.column_name === 'cdn_urls') {
          tsType = `{
    original?: string
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
  }`
        }

        // Determine if field is optional
        const isOptional =
          col.is_nullable === 'YES' || col.column_default !== null
        const optional = isOptional ? '?' : ''

        // Convert column name to camelCase
        const fieldName = toCamelCase(col.column_name)

        // Add JSDoc comment for clarity
        if (col.column_default) {
          output += `  // Default: ${col.column_default}\n`
        }

        output += `  ${fieldName}${optional}: ${tsType}\n`
      })

      output += '}\n\n'
    }

    // Add common response types
    output += `// API Response Types\nexport interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}\n\n`

    output += `export interface PaginatedResponse<T> {
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
}\n\n`

    output += `export interface AuthResponse {
  success: boolean
  data: {
    user: Users
    tokens: {
      accessToken: string
      refreshToken: string
    }
  }
}\n`

    // Paths are resolve()'d against the CURRENT WORKING DIRECTORY, not
    // __dirname -- this script runs from two very different locations
    // depending on environment: `ts-node src/scripts/...` locally (cwd
    // is tech-tools-api/'s root) and `node dist/scripts/...` inside the
    // production container (cwd is /app, which the API's own Dockerfile
    // build context maps 1:1 onto tech-tools-api/'s root). __dirname
    // would differ between the two (src/scripts vs dist/scripts) and
    // between environments where this file may or may not have been
    // compiled yet; cwd does not.
    // The production runtime image ships ONLY dist/ (the API's
    // Dockerfile final stage copies nothing else) -- src/types/ genuinely
    // does not exist as a directory in that container, confirmed live
    // ("ENOENT: no such file or directory, open '/app/src/types/generated.ts'").
    // Worse, /app itself is owned by root there -- only uploads/,
    // private-uploads/, and dist/ are explicitly chowned to the non-root
    // `nodejs` user this process runs as (deliberately narrow, to avoid
    // the cost of recursively chowning all of node_modules at build
    // time), so `nodejs` can't even mkdir a new directory directly under
    // /app. Confirmed live: EACCES creating /app/src/types.
    //
    // dist/types/ DOES already exist there (compiled from src/types/*.ts
    // as part of the image's own build, and copied in WITH --chown, so
    // it's writable) -- that's the fallback target inside a container
    // that can't write the "real" path. In local dev the real path is
    // always writable (a normal repo checkout owned by the developer),
    // so the fallback never triggers there.
    const apiTypesPath = path.resolve(process.cwd(), 'src/types/generated.ts')
    let actualApiTypesPath = apiTypesPath
    try {
      fs.mkdirSync(path.dirname(apiTypesPath), { recursive: true })
      fs.writeFileSync(apiTypesPath, output)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EACCES') throw error
      actualApiTypesPath = path.resolve(process.cwd(), 'dist/types/generated.ts')
      fs.mkdirSync(path.dirname(actualApiTypesPath), { recursive: true })
      fs.writeFileSync(actualApiTypesPath, output)
      console.log(
        `⚠️  ${apiTypesPath} is not writable here (expected inside the production container) -- wrote to ${actualApiTypesPath} instead.`,
      )
    }
    console.log(`✅ API types saved to: ${actualApiTypesPath}`)

    // Only reachable in a full monorepo checkout (local dev) -- the
    // production container's build context is tech-tools-api/ alone, so
    // admin-dashboard/ never exists as a sibling there. That's fine:
    // server-scripts/generate-types-prod.sh separately `docker cp`s this
    // same file out to admin-dashboard/types/generated.ts on the host
    // afterward, from outside the container.
    const adminDashboardPath = path.resolve(
      process.cwd(),
      '../admin-dashboard/types/generated.ts',
    )
    if (fs.existsSync(path.dirname(adminDashboardPath))) {
      fs.writeFileSync(adminDashboardPath, output)
      console.log(`✅ Admin dashboard types saved to: ${adminDashboardPath}`)
    } else {
      console.log(
        `⚠️  Admin dashboard path not found, skipping: ${adminDashboardPath}`,
      )
    }

    console.log('\n🎉 Type generation completed successfully!')
    console.log('\n📝 Summary:')
    console.log(`   - Tables processed: ${Object.keys(tables).length}`)
    console.log(`   - Enum types processed: ${enumLabelsByType.size}`)
    console.log('\n💡 Next steps:')
    console.log('   1. Review the generated types in src/types/generated.ts')
    console.log(
      '   2. Import them in your code: import { Product, User } from "@/types/generated"',
    )
    console.log(
      '   3. Re-run this script whenever your database schema changes\n',
    )
  } catch (error) {
    console.error('❌ Error generating types:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the generation
generateTypesFromDatabase()
