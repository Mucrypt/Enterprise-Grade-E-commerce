import { Request, Response } from 'express'
import aiOrchestrator from '../../../services/ai.orchestrator'
import logger from '../../../utils/logger'

interface AuthRequest extends Request {
  user?: { id: string; email: string; userType: string }
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

// ─── Generate AI Draft ────────────────────────────────────────
export const generateDraft = async (req: AuthRequest, res: Response) => {
  try {
    const { channel, prompt, recipientEmail, recipientPhone, recipientName, customerId, contactId, scheduledAt } = req.body

    if (!channel || !prompt) {
      return res.status(400).json({ error: 'channel and prompt are required' })
    }

    const validChannels = ['email', 'whatsapp', 'newsletter', 'contact_reply']
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: `channel must be one of: ${validChannels.join(', ')}` })
    }

    if (typeof prompt !== 'string' || prompt.length < 10 || prompt.length > 2000) {
      return res.status(400).json({ error: 'prompt must be between 10 and 2000 characters' })
    }

    // Validate email/phone presence per channel
    if (channel === 'email' && !recipientEmail) {
      return res.status(400).json({ error: 'recipientEmail is required for email channel' })
    }
    if (channel === 'whatsapp' && !recipientPhone) {
      return res.status(400).json({ error: 'recipientPhone is required for whatsapp channel' })
    }

    const draft = await aiOrchestrator.generateDraft({
      channel,
      prompt,
      recipientEmail,
      recipientPhone,
      recipientName,
      customerId,
      contactId,
      scheduledAt,
      actorId: req.user!.id,
      actorIp: req.ip,
      actorAgent: req.headers['user-agent'],
    })

    return res.status(201).json({ draft })
  } catch (err: any) {
    const errorMessage = getErrorMessage(err)
    logger.error(`[AI] generateDraft error: ${errorMessage}`)
    if (errorMessage.includes('Rate limit')) {
      return res.status(429).json({ error: errorMessage })
    }
    if (errorMessage.includes('OPENAI_API_KEY')) {
      return res.status(503).json({ error: 'AI service is not configured. Contact your administrator.' })
    }
    if (errorMessage.includes('OpenAI API error')) {
      return res.status(502).json({ error: errorMessage })
    }
    return res.status(500).json({ error: `Failed to generate AI draft: ${errorMessage}` })
  }
}

// ─── List Drafts ──────────────────────────────────────────────
export const listDrafts = async (req: AuthRequest, res: Response) => {
  try {
    const { status, channel, page, limit } = req.query
    const result = await aiOrchestrator.listDrafts({
      status: status as string,
      channel: channel as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    })
    return res.json(result)
  } catch (err: any) {
    logger.error('[AI] listDrafts error:', err.message)
    return res.status(500).json({
      error: 'Failed to fetch drafts',
      hint: 'Ensure AI migration 021_ai_orchestrator.sql has been applied',
    })
  }
}

// ─── Approve Draft ────────────────────────────────────────────
export const approveDraft = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const result = await aiOrchestrator.approveDraft(id, req.user!.id, req.ip)
    return res.json(result)
  } catch (err: any) {
    logger.error('[AI] approveDraft error:', err.message)
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    return res.status(500).json({ error: err.message })
  }
}

// ─── Reject Draft ─────────────────────────────────────────────
export const rejectDraft = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'reason is required' })
    }
    await aiOrchestrator.rejectDraft(id, req.user!.id, reason, req.ip)
    return res.json({ success: true })
  } catch (err: any) {
    logger.error('[AI] rejectDraft error:', err.message)
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    return res.status(500).json({ error: 'Failed to reject draft' })
  }
}

// ─── Customer Context ─────────────────────────────────────────
export const getCustomerContext = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params
    const ctx = await aiOrchestrator.loadCustomerContext(customerId)
    if (!ctx) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    return res.json({ context: ctx })
  } catch (err: any) {
    logger.error('[AI] getCustomerContext error:', err.message)
    return res.status(500).json({ error: 'Failed to load customer context' })
  }
}

// ─── Communication Timeline ───────────────────────────────────
export const getTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params
    const page = parseInt((req.query.page as string) || '1')
    const limit = parseInt((req.query.limit as string) || '30')
    const result = await aiOrchestrator.getCustomerTimeline(customerId, page, limit)
    return res.json(result)
  } catch (err: any) {
    logger.error('[AI] getTimeline error:', err.message)
    return res.status(500).json({ error: 'Failed to load timeline' })
  }
}

// ─── AI Stats Dashboard ───────────────────────────────────────
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await aiOrchestrator.getAiStats()
    return res.json({ stats })
  } catch (err: any) {
    logger.error('[AI] getStats error:', err.message)
    return res.status(500).json({
      error: 'Failed to load AI stats',
      hint: 'Ensure AI migration 021_ai_orchestrator.sql has been applied',
    })
  }
}

// ─── AI Service Health ────────────────────────────────────────
export const getAiStatus = async (_req: Request, res: Response) => {
  const configured = Boolean(process.env.OPENAI_API_KEY)
  const model = process.env.AI_MODEL || 'gpt-5.5'
  return res.json({
    configured,
    model,
    status: configured ? 'ready' : 'unconfigured',
  })
}
