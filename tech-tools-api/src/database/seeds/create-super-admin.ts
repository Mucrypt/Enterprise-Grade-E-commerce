#!/usr/bin/env ts-node

/**
 * Create Initial Super Admin
 * 
 * This script creates the first super admin account.
 * Run once during initial deployment.
 * 
 * Usage:
 *   npm run seed:superadmin
 *   or
 *   ts-node src/database/seeds/create-super-admin.ts
 */

import * as dotenv from 'dotenv'
import * as readline from 'readline'
import bcrypt from 'bcrypt'
import { query } from '../connection'

dotenv.config()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

const createSuperAdmin = async () => {
  console.log('\n==============================================')
  console.log('🔐 Create Initial Super Admin Account')
  console.log('==============================================\n')

  try {
    // Check if super admin already exists
    const existingAdmin = await query(
      "SELECT id, email FROM users WHERE user_type = 'super_admin' LIMIT 1",
    )

    if (existingAdmin.rows.length > 0) {
      console.log(
        '⚠️  Warning: A super admin already exists:',
        existingAdmin.rows[0].email,
      )
      const proceed = await question(
        '\nDo you want to create another super admin? (yes/no): ',
      )
      if (proceed.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled.')
        rl.close()
        process.exit(0)
      }
    }

    // Get super admin details
    const email = await question('Enter super admin email: ')
    const firstName = await question('Enter first name: ')
    const lastName = await question('Enter last name: ')
    const phone = await question('Enter phone (optional): ')
    const password = await question('Enter password (min 8 characters): ')
    const confirmPassword = await question('Confirm password: ')

    // Validation
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address')
    }

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required')
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match')
    }

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [
      email,
    ])

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create super admin
    const result = await query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, phone,
        user_type, email_verified, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
      RETURNING id, email, first_name, last_name, user_type, created_at`,
      [email, passwordHash, firstName, lastName, phone || null, 'super_admin'],
    )

    const superAdmin = result.rows[0]

    console.log('\n✅ Super Admin Created Successfully!\n')
    console.log('==============================================')
    console.log('ID:', superAdmin.id)
    console.log('Email:', superAdmin.email)
    console.log('Name:', `${superAdmin.first_name} ${superAdmin.last_name}`)
    console.log('Role:', superAdmin.user_type)
    console.log('Created:', superAdmin.created_at)
    console.log('==============================================\n')
    console.log('🔐 Please save these credentials securely!')
    console.log(
      '📧 You can now login at: http://localhost:9000/api/v1/auth/login\n',
    )

    rl.close()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error creating super admin:', error)
    rl.close()
    process.exit(1)
  }
}

// Run the script
createSuperAdmin()
