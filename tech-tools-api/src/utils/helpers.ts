import { Request } from 'express'
import crypto from 'crypto'

/**
 * Generate a unique order number
 */
export const generateOrderNumber = (): string => {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const random = Math.floor(1000 + Math.random() * 9000)

  return `ORD-${year}${month}${day}-${random}`
}

/**
 * Generate a unique SKU
 */
export const generateSKU = (
  categoryCode: string,
  brandCode: string,
): string => {
  const random = Math.floor(1000 + Math.random() * 9000)
  return `${categoryCode}-${brandCode}-${random}`
}

/**
 * Format currency
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Calculate tax amount
 */
export const calculateTax = (amount: number, taxRate: number): number => {
  return amount * (taxRate / 100)
}

/**
 * Generate random string
 */
export const generateRandomString = (length = 32): string => {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Get client IP address
 */
export const getClientIp = (req: Request): string => {
  return (
    req.ip ||
    (req.headers['x-forwarded-for'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  )
}

/**
 * Sanitize input
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
}

/**
 * Parse JSON safely
 */
export const safeParseJSON = (jsonString: string): any => {
  try {
    return JSON.parse(jsonString)
  } catch {
    return null
  }
}

/**
 * Delay execution
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Truncate string
 */
export const truncateString = (str: string, length: number): string => {
  if (str.length <= length) return str
  return str.substring(0, length - 3) + '...'
}

/**
 * Convert string to slug
 */
export const toSlug = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
