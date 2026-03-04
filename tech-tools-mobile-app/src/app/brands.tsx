// ============================================
// TechTools Mobile App - Brands Screen
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
} from '@/constants/appTheme'
import { brandsApi } from '@/api'
import { Brand } from '@/types'

export default function BrandsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [brands, setBrands] = useState<Brand[]>([])

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const data = await brandsApi.getAll()
        setBrands(data)
      } catch (error) {
        console.error('Error fetching brands:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchBrands()
  }, [])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Brands',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <FlatList
          data={brands}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.brandCard}
              onPress={() => router.push(`/products?brand=${item.slug}`)}
            >
              <View style={styles.brandLogo}>
                <Text style={styles.brandInitial}>{item.name.charAt(0)}</Text>
              </View>
              <Text style={styles.brandName} numberOfLines={2}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name='ribbon-outline'
                size={64}
                color={AppColors.gray300}
              />
              <Text style={styles.emptyText}>No brands found</Text>
            </View>
          }
        />
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  listContent: {
    padding: AppSpacing.base,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: AppSpacing.lg,
  },
  brandCard: {
    width: '30%',
    alignItems: 'center',
  },
  brandLogo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.sm,
    ...AppShadows.sm,
  },
  brandInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.primary,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '500',
    color: AppColors.gray700,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: AppColors.gray500,
    marginTop: AppSpacing.md,
  },
})
