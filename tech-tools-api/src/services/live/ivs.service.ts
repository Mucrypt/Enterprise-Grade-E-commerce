/**
 * Thin AWS IVS (+ IVS Chat) wrapper -- matches media-storage.service.ts's
 * R2/S3 client shape (lazy singleton, explicit env-var credentials, not
 * the default provider chain) rather than introducing a different AWS
 * SDK pattern into this codebase.
 *
 * Every call here is real infrastructure with real cost -- nothing in
 * this file fabricates a channel, stream, or chat room. A failure
 * throws (never returns a fake success), matching how the rest of this
 * codebase treats a paid external API (Stripe, R2).
 */
import {
  IvsClient,
  CreateChannelCommand,
  DeleteChannelCommand,
  GetStreamCommand,
  GetStreamKeyCommand,
  StopStreamCommand,
} from '@aws-sdk/client-ivs'
import {
  IvschatClient,
  CreateRoomCommand,
  DeleteRoomCommand,
  CreateChatTokenCommand,
} from '@aws-sdk/client-ivschat'
import logger from '../../utils/logger'

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for AWS IVS live streaming`)
  }
  return value
}

let ivsClient: IvsClient | null = null
function getIvsClient(): IvsClient {
  if (ivsClient) return ivsClient
  ivsClient = new IvsClient({
    region: process.env.AWS_IVS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: getRequiredEnv('AWS_IVS_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('AWS_IVS_SECRET_ACCESS_KEY'),
    },
  })
  return ivsClient
}

let ivsChatClient: IvschatClient | null = null
function getIvsChatClient(): IvschatClient {
  if (ivsChatClient) return ivsChatClient
  ivsChatClient = new IvschatClient({
    region: process.env.AWS_IVS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: getRequiredEnv('AWS_IVS_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('AWS_IVS_SECRET_ACCESS_KEY'),
    },
  })
  return ivsChatClient
}

export interface CreatedChannel {
  channelArn: string
  ingestEndpoint: string
  playbackUrl: string
  streamKeyArn: string
  streamKeyValue: string
}

/** One IVS channel per live session (not reused across sessions) -- keeps stream keys and playback history cleanly scoped to a single broadcast. */
export async function createChannel(name: string): Promise<CreatedChannel> {
  const client = getIvsClient()
  const result = await client.send(
    new CreateChannelCommand({
      name,
      type: 'STANDARD',
      latencyMode: 'LOW',
    }),
  )

  const channel = result.channel
  const streamKey = result.streamKey
  if (!channel?.arn || !channel.ingestEndpoint || !channel.playbackUrl || !streamKey?.arn || !streamKey.value) {
    throw new Error('AWS IVS CreateChannel returned an incomplete channel/stream key')
  }

  return {
    channelArn: channel.arn,
    ingestEndpoint: channel.ingestEndpoint,
    playbackUrl: channel.playbackUrl,
    streamKeyArn: streamKey.arn,
    streamKeyValue: streamKey.value,
  }
}

export async function deleteChannel(channelArn: string): Promise<void> {
  const client = getIvsClient()
  await client.send(new DeleteChannelCommand({ arn: channelArn }))
}

/** The stream key VALUE is never persisted in our DB -- fetched fresh via its ARN only when a seller needs to (re)view it. */
export async function getStreamKeyValue(streamKeyArn: string): Promise<string | null> {
  const client = getIvsClient()
  const result = await client.send(new GetStreamKeyCommand({ arn: streamKeyArn }))
  return result.streamKey?.value ?? null
}

export interface LiveStreamState {
  isLive: boolean
  viewerCount: number
  startedAt: Date | null
}

/**
 * GetStream throws a "NotBroadcasting" error (not a benign offline
 * state) when nothing is currently live on the channel -- documented
 * AWS behavior, not an edge case to let bubble as an unhandled 500.
 */
export async function getStreamState(channelArn: string): Promise<LiveStreamState> {
  const client = getIvsClient()
  try {
    const result = await client.send(new GetStreamCommand({ channelArn }))
    return {
      isLive: result.stream?.state === 'LIVE',
      viewerCount: result.stream?.viewerCount ?? 0,
      startedAt: result.stream?.startTime ?? null,
    }
  } catch (error: any) {
    if (error?.name === 'ChannelNotBroadcasting' || error?.name === 'NotBroadcasting') {
      return { isLive: false, viewerCount: 0, startedAt: null }
    }
    logger.error('[IVS] getStreamState failed', error)
    throw error
  }
}

/** The actual kill-switch call -- used by both a seller's own "End stream" and admin's force-end. */
export async function stopStream(channelArn: string): Promise<void> {
  const client = getIvsClient()
  try {
    await client.send(new StopStreamCommand({ channelArn }))
  } catch (error: any) {
    // Stopping a channel that isn't currently live is a no-op from the
    // caller's perspective (the session is already effectively ended),
    // not a failure worth surfacing.
    if (error?.name === 'ChannelNotBroadcasting' || error?.name === 'NotBroadcasting') return
    throw error
  }
}

export interface CreatedChatRoom {
  roomArn: string
}

export async function createChatRoom(name: string): Promise<CreatedChatRoom> {
  const client = getIvsChatClient()
  const result = await client.send(
    new CreateRoomCommand({
      name,
      maximumMessageRatePerSecond: 10,
      maximumMessageLength: 500,
    }),
  )
  if (!result.arn) {
    throw new Error('AWS IVS Chat CreateRoom returned no room ARN')
  }
  return { roomArn: result.arn }
}

export async function deleteChatRoom(roomArn: string): Promise<void> {
  const client = getIvsChatClient()
  await client.send(new DeleteRoomCommand({ identifier: roomArn }))
}

/**
 * Short-lived, per-user, per-room token -- never a shared/static chat
 * credential. A moderator (the broadcasting seller) additionally gets
 * DELETE_MESSAGE/DISCONNECT_USER; a viewer only gets SEND_MESSAGE
 * (reading is implicit for every token, per IVS Chat's own model).
 */
export async function createChatToken(
  roomArn: string,
  userId: string,
  options: { isModerator: boolean },
): Promise<{ token: string; expiresAt: Date | null }> {
  const client = getIvsChatClient()
  const result = await client.send(
    new CreateChatTokenCommand({
      roomIdentifier: roomArn,
      userId,
      capabilities: options.isModerator
        ? ['SEND_MESSAGE', 'DELETE_MESSAGE', 'DISCONNECT_USER']
        : ['SEND_MESSAGE'],
      sessionDurationInMinutes: 180,
    }),
  )
  if (!result.token) {
    throw new Error('AWS IVS Chat CreateChatToken returned no token')
  }
  return { token: result.token, expiresAt: result.tokenExpirationTime ?? null }
}
