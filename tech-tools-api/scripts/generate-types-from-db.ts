import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()
// For CommonJS compatibility with ts-node
declare const __dirname: string

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

    // Generate interface for each table
    for (const [tableName, columns] of Object.entries(tables)) {
      const interfaceName = toPascalCase(tableName)

      output += `export interface ${interfaceName} {\n`

      columns.forEach((col) => {
        let tsType = pgToTsType[col.data_type] || 'any'

        // Handle array types
        if (col.udt_name.startsWith('_')) {
          tsType = `${pgToTsType[col.udt_name.substring(1)] || 'any'}[]`
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

    // Save to API types folder
    const apiTypesPath = path.join(__dirname, '../src/types/generated.ts')
    fs.writeFileSync(apiTypesPath, output)
    console.log(`✅ API types saved to: ${apiTypesPath}`)

    // Save to admin-dashboard types folder
    const adminDashboardPath = path.join(
      __dirname,
      '../../admin-dashboard/types/generated.ts',
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
    console.log(`   - Interfaces generated: ${Object.keys(tables).length}`)
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
