// ============================================
// TechTools Mobile App - Seller Earnings Screen
// ============================================
// Mobile port of the web dashboard's "Earnings" section -- same
// /seller/earnings/* endpoints, same real balances computed live from
// the seller_payout_ledger (never a client-side estimate).

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  sellerEarningsApi,
  type SellerEarningsSummary,
  type SellerLedgerEntry,
} from '@/api'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'

const REASON_LABEL: Record<string, string> = {
  earning_confirmed: 'Earning confirmed',
  earning_clawback: 'Clawed back',
  payout_sent: 'Payout sent',
}

export default function SellerEarningsScreen() {
  const router = useRouter()

  const [summary, setSummary] = useState<SellerEarningsSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [ledger, setLedger] = useState<SellerLedgerEntry[]>([])
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerHasMore, setLedgerHasMore] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadLedger = async (page: number) => {
    if (page === 1) setLedgerLoading(true)
    try {
      const result = await sellerEarningsApi.getLedger({ page, limit: 20 })
      setLedger((current) => (page === 1 ? result.entries : [...current, ...result.entries]))
      setLedgerPage(result.page)
      setLedgerHasMore(result.hasMore)
    } catch {
      // Soft failure -- the rest of the screen still works.
    } finally {
      setLedgerLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setSummaryLoading(true)
      try {
        setSummary(await sellerEarningsApi.getSummary())
      } catch {
        // Soft failure -- the rest of the screen still works.
      } finally {
        setSummaryLoading(false)
      }

      setLedgerLoading(true)
      try {
        const result = await sellerEarningsApi.getLedger({ page: 1, limit: 20 })
        setLedger(result.entries)
        setLedgerPage(result.page)
        setLedgerHasMore(result.hasMore)
      } catch {
        // Soft failure -- the rest of the screen still works.
      } finally {
        setLedgerLoading(false)
      }
    }
    init()
  }, [])

  const handleLoadMore = async () => {
    if (!ledgerHasMore || loadingMore) return
    setLoadingMore(true)
    try {
      await loadLedger(ledgerPage + 1)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={AppColors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your balance</Text>
          <Text style={styles.cardSubtitle}>
            Computed live from your real payout history -- never an estimate.
          </Text>

          {summaryLoading ? (
            <ActivityIndicator color={AppColors.primary} style={{ marginTop: AppSpacing.md }} />
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Pending</Text>
                  <Text style={styles.summaryValue}>
                    ${(summary?.pendingBalance ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Owed to you</Text>
                  <Text style={[styles.summaryValue, styles.summaryValueEmerald]}>
                    ${(summary?.confirmedUnpaidBalance ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Lifetime paid</Text>
                  <Text style={styles.summaryValue}>
                    ${(summary?.lifetimePaid ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {summary?.tier && (
                <Text style={styles.tierNote}>
                  Current tier: <Text style={styles.tierNoteBold}>{summary.tier}</Text>
                  {summary.commissionRate !== null &&
                    ` -- ${summary.commissionRate}% platform commission on new sales.`}
                </Text>
              )}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payout history</Text>

          {ledgerLoading ? (
            <ActivityIndicator color={AppColors.primary} style={{ marginTop: AppSpacing.md }} />
          ) : ledger.length === 0 ? (
            <Text style={styles.emptyText}>
              Nothing here yet -- entries appear once an order confirms and clears its hold
              period.
            </Text>
          ) : (
            ledger.map((entry) => {
              const amount = Number(entry.delta_amount)
              return (
                <View key={entry.id} style={styles.ledgerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ledgerReason}>
                      {REASON_LABEL[entry.reason] || entry.reason}
                    </Text>
                    <Text style={styles.ledgerDate}>
                      {new Date(entry.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.ledgerAmount,
                      amount >= 0 ? styles.ledgerAmountPositive : styles.ledgerAmountNegative,
                    ]}
                  >
                    {amount >= 0 ? '+' : ''}${amount.toFixed(2)}
                  </Text>
                </View>
              )
            })
          )}

          {ledgerHasMore && (
            <TouchableOpacity onPress={handleLoadMore} disabled={loadingMore} style={styles.loadMoreButton}>
              {loadingMore ? (
                <ActivityIndicator color={AppColors.gray700} />
              ) : (
                <Text style={styles.loadMoreText}>Load more history</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  scrollContent: {
    padding: AppSpacing.base,
    gap: AppSpacing.base,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.base,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  cardSubtitle: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    marginTop: AppSpacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    padding: AppSpacing.sm,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.gray500,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
    marginTop: 2,
  },
  summaryValueEmerald: {
    color: '#047857',
  },
  tierNote: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: AppSpacing.md,
  },
  tierNoteBold: {
    fontWeight: '700',
    color: AppColors.gray700,
  },
  emptyText: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: AppSpacing.sm,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    paddingVertical: AppSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    marginTop: AppSpacing.sm,
  },
  ledgerReason: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  ledgerDate: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  ledgerAmountPositive: {
    color: '#047857',
  },
  ledgerAmountNegative: {
    color: AppColors.error,
  },
  loadMoreButton: {
    marginTop: AppSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.sm + 2,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray700,
  },
})
