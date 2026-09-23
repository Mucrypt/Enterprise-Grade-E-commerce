// ============================================
// TechTools Mobile App - Seller "Go Live" Screen
// ============================================
// This phase's actual broadcast mechanism: any standard RTMP encoder
// (OBS, Streamlabs) pointed at the ingest URL + stream key issued here
// -- an in-app camera broadcaster is real, scoped future work (see the
// live-shopping plan), not built in this pass. The backend doesn't
// care what pushes the RTMP stream, so this UI is the complete "can a
// seller go live" story for now.

import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { liveApi, sellerProductsApi, type LiveSessionSummary, type SellerProduct } from '@/api'
import { formatPrice } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius, AppShadows } from '@/constants/appTheme'

export default function SellerLiveScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<LiveSessionSummary | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [streamKey, setStreamKey] = useState<string | null>(null)
  const [keyRevealed, setKeyRevealed] = useState(false)
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadCurrentSession = useCallback(async () => {
    try {
      const current = await liveApi.getMyCurrentSession()
      setSession(current)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentSession()
  }, [loadCurrentSession])

  useEffect(() => {
    if (!session) {
      setStreamKey(null)
      return
    }
    liveApi
      .getStreamKey(session.id)
      .then(setStreamKey)
      .catch(() => setStreamKey(null))
  }, [session])

  useEffect(() => {
    sellerProductsApi
      .getMine()
      .then((data) => setProducts(data.filter((p) => p.is_active)))
      .catch(() => setProducts([]))
  }, [])

  const handleCreate = async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const created = await liveApi.createSession({ title: title.trim() })
      setSession(created)
    } catch (error: any) {
      Alert.alert(
        'Could not create live session',
        error?.response?.data?.message || 'Please try again in a moment.',
      )
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    Alert.alert('Copied', `${label} copied to clipboard.`)
  }

  const handleGoLive = async () => {
    if (!session) return
    setBusy(true)
    try {
      const updated = await liveApi.start(session.id)
      setSession(updated)
    } catch (error: any) {
      Alert.alert('Could not start', error?.response?.data?.message || 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleEnd = () => {
    if (!session) return
    Alert.alert('End this stream?', 'Viewers will be disconnected immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End stream',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          try {
            const updated = await liveApi.end(session.id)
            setSession(updated)
            setPinnedProductId(null)
          } catch (error: any) {
            Alert.alert('Could not end stream', error?.response?.data?.message || 'Please try again.')
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const handlePin = async (productId: string) => {
    if (!session) return
    try {
      await liveApi.pinProduct(session.id, productId)
      setPinnedProductId(productId)
      Haptics.selectionAsync().catch(() => {})
    } catch {
      Alert.alert('Could not pin product', 'Please try again.')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Go Live</Text>
        <View style={styles.iconButton} />
      </View>

      {!session ? (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Start a new live session</Text>
          <Text style={styles.sectionSubtitle}>
            Give it a title, then you&apos;ll get a stream key to use with OBS, Streamlabs, or any
            standard RTMP broadcasting app.
          </Text>
          <TextInput
            style={styles.input}
            placeholder='e.g. Friday Night Flash Sale'
            placeholderTextColor={AppColors.gray400}
            value={title}
            onChangeText={setTitle}
            maxLength={140}
          />
          <TouchableOpacity
            style={[styles.primaryButton, (!title.trim() || creating) && styles.primaryButtonDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || creating}
          >
            <Text style={styles.primaryButtonText}>{creating ? 'Creating...' : 'Create session'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={session.status === 'live' ? products : []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.content}>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, session.status === 'live' && styles.statusBadgeLive]}>
                  <Text style={styles.statusBadgeText}>{session.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.sessionTitle} numberOfLines={1}>
                  {session.title}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Server URL</Text>
                <TouchableOpacity
                  style={styles.copyRow}
                  onPress={() => session.ivsIngestEndpoint && handleCopy(session.ivsIngestEndpoint, 'Server URL')}
                >
                  <Text style={styles.copyValue} numberOfLines={1}>
                    {session.ivsIngestEndpoint || '—'}
                  </Text>
                  <Ionicons name='copy-outline' size={16} color={AppColors.gray500} />
                </TouchableOpacity>

                <Text style={[styles.cardLabel, { marginTop: AppSpacing.sm }]}>Stream Key</Text>
                <TouchableOpacity
                  style={styles.copyRow}
                  onPress={() => streamKey && handleCopy(streamKey, 'Stream key')}
                  onLongPress={() => setKeyRevealed((v) => !v)}
                >
                  <Text style={styles.copyValue} numberOfLines={1}>
                    {streamKey ? (keyRevealed ? streamKey : '•'.repeat(24)) : 'Loading...'}
                  </Text>
                  <Ionicons name='copy-outline' size={16} color={AppColors.gray500} />
                </TouchableOpacity>
                <Text style={styles.hint}>Tap to copy · long-press to reveal</Text>
              </View>

              {session.status === 'scheduled' && (
                <>
                  <Text style={styles.sectionSubtitle}>
                    Enter the server URL and stream key above into your broadcasting app, start
                    streaming there, then tap below once you&apos;re live.
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
                    onPress={handleGoLive}
                    disabled={busy}
                  >
                    <Text style={styles.primaryButtonText}>{busy ? 'Starting...' : "I'm broadcasting -- go live"}</Text>
                  </TouchableOpacity>
                </>
              )}

              {session.status === 'live' && (
                <>
                  <TouchableOpacity
                    style={[styles.endButton, busy && styles.primaryButtonDisabled]}
                    onPress={handleEnd}
                    disabled={busy}
                  >
                    <Text style={styles.endButtonText}>End stream</Text>
                  </TouchableOpacity>
                  <Text style={styles.sectionTitle}>Pin a product</Text>
                  <Text style={styles.sectionSubtitle}>
                    Viewers see the pinned product live, with a one-tap buy button.
                  </Text>
                </>
              )}

              {session.status === 'ended' && (
                <Text style={styles.sectionSubtitle}>This session has ended.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.productRow, pinnedProductId === item.id && styles.productRowPinned]}
              onPress={() => handlePin(item.id)}
            >
              <Image
                source={{ uri: item.images?.[0]?.url }}
                style={styles.productImage}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.productName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.productPrice}>{formatPrice(item.sale_price || item.base_price)}</Text>
              </View>
              {pinnedProductId === item.id ? (
                <Ionicons name='checkmark-circle' size={22} color={AppColors.success} />
              ) : (
                <Text style={styles.pinLabel}>Pin</Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: AppSpacing['2xl'] }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.background },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  iconButton: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: AppColors.gray900 },
  content: { padding: AppSpacing.base, gap: AppSpacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: AppColors.gray900 },
  sectionSubtitle: { fontSize: 13, color: AppColors.gray500, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm + 2,
    fontSize: 14,
    color: AppColors.gray900,
    backgroundColor: AppColors.white,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.sm + 4,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: AppColors.white, fontWeight: '700', fontSize: 14 },
  endButton: {
    backgroundColor: AppColors.error,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.sm + 4,
    alignItems: 'center',
  },
  endButtonText: { color: AppColors.white, fontWeight: '700', fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  statusBadge: {
    backgroundColor: AppColors.gray200,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: AppBorderRadius.sm,
  },
  statusBadgeLive: { backgroundColor: AppColors.error },
  statusBadgeText: { fontSize: 10, fontWeight: '800', color: AppColors.white },
  sessionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: AppColors.gray900 },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: AppColors.gray500, textTransform: 'uppercase' },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    marginTop: 4,
    gap: AppSpacing.sm,
  },
  copyValue: { flex: 1, fontSize: 13, color: AppColors.gray800, fontFamily: 'monospace' },
  hint: { fontSize: 11, color: AppColors.gray400, marginTop: 4 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    backgroundColor: AppColors.white,
    marginHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.sm,
    padding: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.gray100,
  },
  productRowPinned: { borderColor: AppColors.success, backgroundColor: '#F0FDF4' },
  productImage: { width: 40, height: 40, borderRadius: AppBorderRadius.sm, backgroundColor: AppColors.gray100 },
  productName: { fontSize: 13, fontWeight: '600', color: AppColors.gray900 },
  productPrice: { fontSize: 12, color: AppColors.primary, fontWeight: '700', marginTop: 2 },
  pinLabel: { fontSize: 12, fontWeight: '700', color: AppColors.primary },
})
