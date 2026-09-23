// ============================================
// "Live Now" rail -- Discover feed's entry point into live shopping
// ============================================
// A thin, absolutely-positioned strip over the top of the vertical
// video feed (this screen has no spare vertical room to push content
// down for it -- see discover.tsx's slideHeight math) showing sellers
// currently live, story-circle style. Polls GET /live/sessions on a
// short interval rather than opening a second Socket.io connection just
// for a list that changes on the order of minutes, not seconds.

import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { liveApi, type LiveSessionSummary } from '@/api'
import { AppColors } from '@/constants/appTheme'

const POLL_INTERVAL_MS = 30_000

export default function LiveNowRail() {
  const router = useRouter()
  const [sessions, setSessions] = useState<LiveSessionSummary[]>([])

  useEffect(() => {
    let cancelled = false

    const load = () => {
      liveApi
        .getLiveNow()
        .then((result) => {
          if (!cancelled) setSessions(result)
        })
        .catch(() => {
          // Best-effort -- an empty rail just means no live badge shows,
          // never a broken Discover feed.
        })
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (sessions.length === 0) return null

  return (
    <View style={styles.container} pointerEvents='box-none'>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            activeOpacity={0.85}
            onPress={() => router.push(`/live/${item.id}` as never)}
          >
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitial}>
                  {(item.sellerDisplayName || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.liveDot}>
                <Text style={styles.liveDotText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {item.sellerDisplayName || 'Live'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  item: {
    alignItems: 'center',
    width: 60,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: AppColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  avatarInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: AppColors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  liveDot: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: AppColors.error,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liveDotText: {
    color: AppColors.white,
    fontSize: 7,
    fontWeight: '800',
  },
  name: {
    color: AppColors.white,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 2,
  },
})
