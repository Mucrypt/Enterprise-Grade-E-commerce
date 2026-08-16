import { Router } from 'express'
import { handleTikTokShopWebhook } from './channel-webhook.controller'

const router = Router()

// Deliberately NOT behind authenticate() -- TikTok Shop calls this
// directly with no TechTools session/token, exactly like
// payments/payment.routes.ts's Stripe webhook. The HMAC signature
// (verified inside the handler, using req.rawBody captured globally in
// app.ts) IS the authentication for this route.
router.post('/webhook/tiktok-shop', handleTikTokShopWebhook)

export default router
