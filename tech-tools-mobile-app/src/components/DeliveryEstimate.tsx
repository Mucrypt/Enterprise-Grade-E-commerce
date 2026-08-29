// ============================================
// TechTools Mobile App - Delivery Estimate widget
// ============================================
// Amazon-style "Standard delivery Thursday, 3 September" block on the
// product detail screen, resolved from the admin's delivery-template
// configuration (see tech-tools-api's shipping_delivery_templates,
// precedence: product override -> category -> location -> global). Mirrors
// the web storefront's DeliveryEstimate.tsx content/logic 1:1. Never
// blocks the rest of the screen: any fetch failure just renders nothing.

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { productsApi, DeliveryEstimate as DeliveryEstimateData } from '@/api'
import { formatPrice } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

interface DeliveryEstimateProps {
  productId: string
}

export default function DeliveryEstimate({ productId }: DeliveryEstimateProps) {
  const [estimate, setEstimate] = useState<DeliveryEstimateData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    productsApi
      .getDeliveryEstimate(productId)
      .then((data) => {
        if (!cancelled) setEstimate(data)
      })
      .catch(() => {
        if (!cancelled) setEstimate(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonLine} />
      </View>
    )
  }

  if (!estimate) return null

  const sameDay = estimate.standardDateFrom === estimate.standardDateTo

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons
          name='car-outline'
          size={16}
          color={AppColors.success}
          style={styles.icon}
        />
        <Text style={styles.text}>
          <Text style={styles.standardLabel}>{estimate.standardLabel}</Text>{' '}
          <Text style={styles.emphasis}>
            {formatDate(estimate.standardDateTo)}
          </Text>
          {!sameDay && (
            <Text style={styles.muted}>
              {' '}
              (as early as {formatDate(estimate.standardDateFrom)})
            </Text>
          )}
        </Text>
      </View>

      {estimate.expressDate && (
        <View style={styles.row}>
          <Ionicons
            name='flash-outline'
            size={16}
            color={AppColors.orangeAccent}
            style={styles.icon}
          />
          <Text style={styles.text}>
            {estimate.expressLabel}{' '}
            <Text style={styles.emphasis}>
              {formatDate(estimate.expressDate)}
            </Text>
          </Text>
        </View>
      )}

      {/* Real, admin-configured threshold -- omitted entirely (rather than
          a fabricated number) when no threshold is configured. */}
      {estimate.freeShippingThreshold != null && (
        <View style={styles.row}>
          <Ionicons
            name='cube-outline'
            size={16}
            color={AppColors.success}
            style={styles.icon}
          />
          <Text style={styles.text}>
            Free shipping on orders over{' '}
            <Text style={styles.emphasis}>
              {formatPrice(estimate.freeShippingThreshold)}
            </Text>
          </Text>
        </View>
      )}

      {estimate.resolvedCountryName && (
        <View style={styles.row}>
          <Ionicons
            name='location-outline'
            size={16}
            color={AppColors.gray400}
            style={styles.icon}
          />
          <Text style={styles.mutedText}>
            Delivering to {estimate.resolvedCountryName}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: AppSpacing.sm,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.gray100,
    padding: AppSpacing.md,
  },
  skeletonLine: {
    height: 14,
    width: '70%',
    borderRadius: AppBorderRadius.sm,
    backgroundColor: AppColors.gray200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginTop: 2,
    marginRight: AppSpacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.gray700,
  },
  standardLabel: {
    fontWeight: '700',
    color: AppColors.success,
  },
  emphasis: {
    fontWeight: '600',
    color: AppColors.gray900,
  },
  muted: {
    color: AppColors.gray500,
  },
  mutedText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.gray600,
  },
})
