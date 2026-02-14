import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Create database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'techtools',
  user: process.env.DB_USER || 'techtools_user',
  password: process.env.DB_PASSWORD || 'password',
})

// Migrations tracking table
const MIGRATIONS_TABLE = 'schema_migrations'

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query(
    `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY id`,
  )
  return result.rows.map((row) => row.filename)
}

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir)
  return files.filter((file) => file.endsWith('.sql')).sort() // Sort alphabetically (001_, 002_, etc.)
}

async function runMigration(filename: string): Promise<void> {
  const filePath = path.join(__dirname, 'migrations', filename)
  const sql = fs.readFileSync(filePath, 'utf8')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Execute the migration SQL
    await client.query(sql)

    // Record the migration
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
      [filename],
    )

    await client.query('COMMIT')
    console.log(`✅ Executed: ${filename}`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`❌ Failed: ${filename}`)
    throw error
  } finally {
    client.release()
  }
}

async function migrate(): Promise<void> {
  console.log('\n🚀 Running database migrations...\n')

  try {
    // Ensure migrations tracking table exists
    await ensureMigrationsTable()

    // Get already executed migrations
    const executedMigrations = await getExecutedMigrations()
    console.log(`📋 Already executed: ${executedMigrations.length} migrations`)

    // Get all migration files
    const migrationFiles = await getMigrationFiles()
    console.log(`📁 Found: ${migrationFiles.length} migration files\n`)

    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrations.includes(file),
    )

    if (pendingMigrations.length === 0) {
      console.log('✨ No pending migrations. Database is up to date!\n')
      return
    }

    console.log(`⏳ Pending migrations: ${pendingMigrations.length}\n`)

    // Run pending migrations
    for (const migration of pendingMigrations) {
      await runMigration(migration)
    }

    console.log('\n✅ All migrations completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

async function rollback(): Promise<void> {
  console.log('\n⏪ Rolling back last migration...\n')

  try {
    await ensureMigrationsTable()

    // Get the last executed migration
    const result = await pool.query(
      `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY id DESC LIMIT 1`,
    )

    if (result.rows.length === 0) {
      console.log('No migrations to rollback.\n')
      return
    }

    const lastMigration = result.rows[0].filename

    // Remove from tracking table
    await pool.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE filename = $1`, [
      lastMigration,
    ])

    console.log(`🔙 Rolled back: ${lastMigration}`)
    console.log('⚠️  Note: You may need to manually undo the SQL changes.\n')
  } catch (error) {
    console.error('\n❌ Rollback failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

async function status(): Promise<void> {
  console.log('\n📊 Migration Status\n')

  try {
    await ensureMigrationsTable()

    const executedMigrations = await getExecutedMigrations()
    const migrationFiles = await getMigrationFiles()

    console.log('Migration Files:')
    console.log('----------------')

    for (const file of migrationFiles) {
      const status = executedMigrations.includes(file) ? '✅' : '⏳'
      console.log(`${status} ${file}`)
    }

    console.log(
      `\nExecuted: ${executedMigrations.length}/${migrationFiles.length}\n`,
    )
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Main entry point
const command = process.argv[2] || 'up'

switch (command) {
  case 'up':
    migrate()
    break
  case 'down':
    rollback()
    break
  case 'status':
    status()
    break
  default:
    console.log('Usage: ts-node migrate.ts [up|down|status]')
    console.log('  up     - Run pending migrations (default)')
    console.log('  down   - Rollback last migration')
    console.log('  status - Show migration status')
    process.exit(1)
}
