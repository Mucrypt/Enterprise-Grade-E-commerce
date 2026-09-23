/**
 * AWS IVS stream lifecycle events (start/end/failure -- including a
 * seller's encoder crashing without our own /end endpoint ever being
 * called) are delivered via EventBridge -> SNS -> this HTTPS endpoint,
 * not a direct webhook from IVS itself. Every inbound message is
 * cryptographically verified with sns-validator (the AWS-recommended
 * Node.js library for exactly this) before anything in its payload is
 * trusted -- an unverified POST to this URL must never be able to mark
 * an arbitrary session as live/ended.
 */
import { Request, Response } from 'express'
import MessageValidator from 'sns-validator'
import logger from '../../../utils/logger'
import * as liveSessionService from '../../../services/live/live-session.service'

const validator = new MessageValidator()

function validateSnsMessage(message: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    validator.validate(message as any, (err: Error | null, validated: any) => {
      if (err) reject(err)
      else resolve(validated)
    })
  })
}

interface IvsStreamStateDetail {
  stream_id?: string
  channel_name?: string
  state?: 'Stream Start' | 'Stream End' | 'Stream Failure' | 'Recording Start' | 'Recording End'
}

export const handleIvsSnsEvent = async (req: Request & { rawBody?: Buffer }, res: Response) => {
  try {
    if (!req.rawBody) {
      logger.error('[Live] IVS SNS webhook received without a captured raw body')
      return res.status(400).json({ error: 'Missing raw request body' })
    }

    let snsMessage: any
    try {
      snsMessage = JSON.parse(req.rawBody.toString('utf-8'))
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }

    let verified: any
    try {
      verified = await validateSnsMessage(snsMessage)
    } catch (error) {
      logger.error('[Live] IVS SNS webhook failed signature verification', error)
      return res.status(400).json({ error: 'Invalid SNS signature' })
    }

    const expectedTopicArn = process.env.AWS_IVS_SNS_TOPIC_ARN
    if (expectedTopicArn && verified.TopicArn !== expectedTopicArn) {
      logger.error(`[Live] IVS SNS webhook TopicArn mismatch: ${verified.TopicArn}`)
      return res.status(400).json({ error: 'Unexpected topic' })
    }

    // One-time handshake AWS SNS requires on first subscribing this
    // endpoint -- must visit SubscribeURL (a GET) or no Notification
    // ever arrives here.
    if (verified.Type === 'SubscriptionConfirmation') {
      if (verified.SubscribeURL) {
        await fetch(verified.SubscribeURL)
        logger.info('[Live] Confirmed AWS SNS subscription for IVS stream events')
      }
      return res.status(200).json({ received: true })
    }

    if (verified.Type !== 'Notification') {
      return res.status(200).json({ received: true })
    }

    const event = JSON.parse(verified.Message)
    if (event['detail-type'] !== 'IVS Stream State Change') {
      return res.status(200).json({ received: true })
    }

    const detail: IvsStreamStateDetail = event.detail || {}
    const channelArn: string | undefined = event.resources?.[0]
    if (!channelArn) {
      return res.status(200).json({ received: true })
    }

    const sessionId = await liveSessionService.findSessionIdByChannelArn(channelArn)
    if (!sessionId) {
      // A stream event for a channel we don't have an open session for
      // -- not an error, just nothing for us to do (e.g. a stale/
      // already-ended session, or test traffic on the channel).
      return res.status(200).json({ received: true })
    }

    if (detail.state === 'Stream Start') {
      await liveSessionService.startSession(sessionId)
      logger.info(`[Live] Session ${sessionId} confirmed live via IVS webhook`)
    } else if (detail.state === 'Stream End' || detail.state === 'Stream Failure') {
      await liveSessionService.endSession(sessionId, 'webhook')
      logger.info(`[Live] Session ${sessionId} ended via IVS webhook (${detail.state})`)
    }

    res.status(200).json({ received: true })
  } catch (error: any) {
    logger.error('[Live] Error handling IVS SNS webhook', error)
    // Still 200 -- SNS retries aggressively on non-2xx, and a bug here
    // shouldn't cause a retry storm against our own logs/DB.
    res.status(200).json({ received: false })
  }
}
