/**
 * Guest Checkout Service
 * Handles guest order creation and tracking
 */

import { query } from '../database/connection'
import logger from '../utils/logger'
import crypto from 'crypto'

export interface GuestCheckoutData {
  email: string
  firstName: string
  lastName: string
  phone: string
  shippingAddress: Record<string, any>
  billingAddress: Record<string, any>
}

export interface GuestOrderResult {
  orderId: string
  orderNumber: string
  checkoutToken: string
  expiresAt: string
}

// Validate guest email format
export const validateGuestEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Generate secure checkout token
export const generateCheckoutToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// Check if email is already registered
export const isEmailRegistered = async (email: string): Promise<boolean> => {
  try {
    const result = await query('SELECT id FROM users WHERE email = $1', [email])
    return result.rows.length > 0
  } catch (error) {
    logger.error('Error checking email registration:', error)
    throw error
  }
}

// Create guest checkout session
export const createGuestCheckoutSession = async (
  email: string,
  clientIp?: string,
): Promise<string> => {
  try {
    const token = generateCheckoutToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await query(
      `INSERT INTO guest_checkouts (email, checkout_token, expires_at, created_by_ip)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET 
       checkout_token = $2, 
       expires_at = $3,
       created_at = NOW()`,
      [email, token, expiresAt, clientIp || null],
    )

    return token
  } catch (error) {
    logger.error('Error creating guest checkout session:', error)
    throw error
  }
}

// Verify guest checkout token
export const verifyCheckoutToken = async (
  email: string,
  token: string,
): Promise<boolean> => {
  try {
    const result = await query(
      `SELECT id FROM guest_checkouts 
       WHERE email = $1 AND checkout_token = $2 AND expires_at > NOW()`,
      [email, token],
    )

    return result.rows.length > 0
  } catch (error) {
    logger.error('Error verifying checkout token:', error)
    throw error
  }
}

// Get guest order by token
export const getGuestOrderByToken = async (
  email: string,
  token: string,
): Promise<any> => {
  try {
    const result = await query(
      `SELECT o.* FROM orders o
       JOIN guest_checkouts gc ON o.id = gc.order_id
       WHERE gc.email = $1 AND gc.checkout_token = $2 AND gc.expires_at > NOW()`,
      [email, token],
    )

    return result.rows[0] || null
  } catch (error) {
    logger.error('Error retrieving guest order:', error)
    throw error
  }
}

// Link order to guest checkout
export const linkOrderToGuestCheckout = async (
  orderId: string,
  email: string,
): Promise<void> => {
  try {
    await query(`UPDATE guest_checkouts SET order_id = $1 WHERE email = $2`, [
      orderId,
      email,
    ])
  } catch (error) {
    logger.error('Error linking order to guest checkout:', error)
    throw error
  }
}

// Verify guest email (mark as verified)
export const verifyGuestEmail = async (email: string): Promise<void> => {
  try {
    await query(
      `UPDATE guest_checkouts SET verified_at = NOW() WHERE email = $1`,
      [email],
    )
  } catch (error) {
    logger.error('Error verifying guest email:', error)
    throw error
  }
}

// Clean up expired guest sessions
export const cleanupExpiredSessions = async (): Promise<number> => {
  try {
    const result = await query(
      `DELETE FROM guest_checkouts WHERE expires_at < NOW()`,
    )
    return result.rowCount
  } catch (error) {
    logger.error('Error cleaning up expired sessions:', error)
    throw error
  }
}

// Get guest order summary (no auth needed, but requires token)
export const getGuestOrderSummary = async (
  email: string,
  token: string,
): Promise<any> => {
  try {
    const order = await getGuestOrderByToken(email, token)
    if (!order) {
      return null
    }

    // Get order items
    const itemsResult = await query(
      `SELECT oi.*, p.name, p.image_url FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id],
    )

    return {
      orderNumber: order.order_number,
      status: order.order_status,
      paymentStatus: order.payment_status,
      totalAmount: order.grand_total,
      shippingAddress: order.shipping_address,
      items: itemsResult.rows,
      createdAt: order.created_at,
      estimatedDelivery: order.estimated_delivery_date,
    }
  } catch (error) {
    logger.error('Error getting guest order summary:', error)
    throw error
  }
}
