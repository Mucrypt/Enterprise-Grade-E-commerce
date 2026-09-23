// ============================================
// TechTools Mobile App - Live Viewer Screen
// ============================================
// Real AWS IVS playback (amazon-ivs-react-native-player), real IVS Chat
// (amazon-ivs-chat-messaging -- its own WebSocket connection, entirely
// separate from the app's Socket.io, by design), and real-time pinned-
// product/session-ended events over the app's existing Socket.io
// live:<sessionId> room (live-socket.service.ts). Buying uses the exact
// same cartStore.addItem path Discover's product cards already use,
// just with sourceLiveSessionId instead of sourceDiscoverPostId.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import IVSPlayer from 'amazon-ivs-react-native-player'
import { ChatRoom, SendMessageRequest, type ChatMessage } from 'amazon-ivs-chat-messaging'
import {
  liveApi,
  type LiveSessionViewerDetail,
  type LiveSessionProduct,
} from '@/api'
import { joinLiveSession } from '@/services/live-socket.service'
import { useCartStore } from '@/stores'
import { formatPrice } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'

interface LocalChatMessage {
  id: string
  senderId: string
  content: string
}

export default function LiveViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)

  const [detail, setDetail] = useState<LiveSessionViewerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pinnedProduct, setPinnedProduct] = useState<LiveSessionProduct | null>(null)
  const [streamEnded, setStreamEnded] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [messages, setMessages] = useState<LocalChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatConnected, setChatConnected] = useState(false)

  const chatRoomRef = useRef<ChatRoom | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    liveApi
      .getSessionDetail(id)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setPinnedProduct(data.pinnedProduct)
      })
      .catch(() => {
        if (!cancelled) setLoadError('This stream could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  // Real-time pin/unpin + session-ended events over the app's own
  // Socket.io room -- independent of the IVS Chat connection below.
  useEffect(() => {
    if (!id) return
    const leave = joinLiveSession(id, {
      onProductPinned: (event) => setPinnedProduct(event.product as LiveSessionProduct),
      onProductUnpinned: (event) => {
        setPinnedProduct((current) => (current?.id === event.productId ? null : current))
      },
      onSessionEnded: () => setStreamEnded(true),
    })
    return leave
  }, [id])

  // Real IVS Chat connection -- a separate WebSocket from Socket.io,
  // using the short-lived, per-viewer token the backend already issued
  // in getSessionDetail (never a shared/static credential).
  useEffect(() => {
    if (!detail) return

    const room = new ChatRoom({
      regionOrUrl: detail.chatRegion,
      tokenProvider: async () => ({
        token: detail.chatToken,
        sessionExpirationTime: new Date(Date.now() + 1000 * 60 * 60 * 3),
        tokenExpirationTime: new Date(Date.now() + 1000 * 60 * 60 * 3),
      }),
    })
    chatRoomRef.current = room

    const removeConnect = room.addListener('connect', () => setChatConnected(true))
    const removeDisconnect = room.addListener('disconnect', () => setChatConnected(false))
    const removeMessage = room.addListener('message', (message: ChatMessage) => {
      setMessages((prev) => [
        ...prev.slice(-99),
        { id: message.id, senderId: message.sender.userId, content: message.content },
      ])
    })

    room.connect()

    return () => {
      removeConnect()
      removeDisconnect()
      removeMessage()
      room.disconnect()
      chatRoomRef.current = null
    }
  }, [detail])

  const handleSendChat = () => {
    const text = chatInput.trim()
    if (!text || !chatRoomRef.current) return
    setChatInput('')
    chatRoomRef.current.sendMessage(new SendMessageRequest(text)).catch(() => {
      // Best-effort -- a dropped chat message isn't worth surfacing an
      // error over; the room's own connect state already shows connectivity.
    })
  }

  const handleBuyNow = () => {
    if (!pinnedProduct || !id) return
    addItem(
      {
        id: pinnedProduct.id,
        name: pinnedProduct.name,
        slug: pinnedProduct.slug,
        base_price: pinnedProduct.base_price,
        sale_price: pinnedProduct.sale_price,
        images: pinnedProduct.image_url ? [{ url: pinnedProduct.image_url, is_primary: true }] : [],
      } as any,
      1,
      undefined,
      undefined,
      id,
    )
    setJustAdded(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setTimeout(() => setJustAdded(false), 1800)
  }

  const displayPrice = useMemo(() => {
    if (!pinnedProduct) return null
    return pinnedProduct.sale_price
      ? formatPrice(pinnedProduct.sale_price)
      : formatPrice(pinnedProduct.base_price)
  }, [pinnedProduct])

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={AppColors.white} />
      </SafeAreaView>
    )
  }

  if (loadError || !detail) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{loadError || 'Stream not found.'}</Text>
        <TouchableOpacity style={styles.backButtonInline} onPress={() => router.back()}>
          <Text style={styles.backButtonInlineText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.container}>
      <IVSPlayer
        style={StyleSheet.absoluteFillObject}
        streamUrl={detail.session.ivsPlaybackUrl ?? undefined}
        autoplay
        liveLowLatency
        muted={false}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name='close' size={22} color={AppColors.white} />
          </TouchableOpacity>

          <View style={styles.sellerBadge}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {detail.session.sellerDisplayName || detail.session.title}
            </Text>
          </View>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>{detail.isLive ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
          <View style={styles.viewerBadge}>
            <Ionicons name='eye' size={12} color={AppColors.white} />
            <Text style={styles.viewerBadgeText}>{detail.viewerCount}</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        {streamEnded && (
          <View style={styles.endedBanner}>
            <Text style={styles.endedBannerText}>This stream has ended</Text>
          </View>
        )}

        {pinnedProduct && (
          <View style={styles.productCard}>
            <Image
              source={{ uri: pinnedProduct.image_url || undefined }}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>
                {pinnedProduct.name}
              </Text>
              <Text style={styles.productPrice}>{displayPrice}</Text>
            </View>
            <TouchableOpacity
              style={[styles.buyButton, justAdded && styles.buyButtonSuccess]}
              onPress={handleBuyNow}
              activeOpacity={0.85}
            >
              {justAdded ? (
                <Ionicons name='checkmark' size={18} color={AppColors.white} />
              ) : (
                <Text style={styles.buyButtonText}>Add to Cart</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.chatWrap}>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              inverted
              style={styles.chatList}
              renderItem={({ item }) => (
                <Text style={styles.chatMessage} numberOfLines={2}>
                  <Text style={styles.chatSender}>{item.senderId.slice(0, 8)}: </Text>
                  {item.content}
                </Text>
              )}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder={chatConnected ? 'Say something...' : 'Connecting to chat...'}
                placeholderTextColor='rgba(255,255,255,0.5)'
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendChat}
                editable={chatConnected}
                returnKeyType='send'
              />
              <TouchableOpacity onPress={handleSendChat} disabled={!chatConnected || !chatInput.trim()}>
                <Ionicons name='send' size={20} color={AppColors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: AppSpacing.md },
  errorText: { color: AppColors.white, fontSize: 14 },
  backButtonInline: { paddingVertical: AppSpacing.sm, paddingHorizontal: AppSpacing.base },
  backButtonInlineText: { color: AppColors.primary, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerBadge: { flex: 1 },
  sellerName: { color: AppColors.white, fontWeight: '700', fontSize: 14 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.sm,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AppColors.white },
  liveBadgeText: { color: AppColors.white, fontSize: 11, fontWeight: '800' },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.sm,
  },
  viewerBadgeText: { color: AppColors.white, fontSize: 11, fontWeight: '700' },
  spacer: { flex: 1 },
  endedBanner: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    marginBottom: AppSpacing.sm,
  },
  endedBannerText: { color: AppColors.white, fontWeight: '700' },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,20,32,0.85)',
    marginHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.sm,
    padding: AppSpacing.sm,
    borderRadius: AppBorderRadius.lg,
    gap: AppSpacing.sm,
  },
  productImage: { width: 48, height: 48, borderRadius: AppBorderRadius.md, backgroundColor: '#222' },
  productInfo: { flex: 1 },
  productName: { color: AppColors.white, fontWeight: '700', fontSize: 13 },
  productPrice: { color: AppColors.primary, fontWeight: '800', fontSize: 14, marginTop: 2 },
  buyButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
  },
  buyButtonSuccess: { backgroundColor: AppColors.success },
  buyButtonText: { color: AppColors.white, fontWeight: '700', fontSize: 12 },
  chatWrap: { maxHeight: 220, paddingHorizontal: AppSpacing.base, paddingBottom: AppSpacing.sm },
  chatList: { maxHeight: 140 },
  chatMessage: { color: AppColors.white, fontSize: 12, marginVertical: 2 },
  chatSender: { fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 8,
    marginTop: AppSpacing.xs,
  },
  chatInput: { flex: 1, color: AppColors.white, fontSize: 13 },
})
