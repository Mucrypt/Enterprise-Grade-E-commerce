import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import {
  addressesApi,
  getApiErrorContext,
  getApiErrorMessage,
  securityApi,
  type UserAddress,
  type UserAddressInput,
} from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

const emptyForm: UserAddressInput = {
  addressType: 'shipping',
  fullName: '',
  addressLine1: '',
  city: '',
  state: '',
  country: 'Lithuania',
  postalCode: '',
  phone: '',
  isDefault: false,
}

export default function AddressesScreen() {
  const router = useRouter()
  const {
    isAuthenticated,
    isLoading: authLoading,
    hasHydrated,
  } = useAuthStore()

  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UserAddressInput>(emptyForm)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }

    if (!hasHydrated || !isAuthenticated) {
      return
    }

    loadAddresses()
  }, [authLoading, hasHydrated, isAuthenticated, router])

  const loadAddresses = async () => {
    try {
      setIsLoading(true)
      const list = await addressesApi.getAll()
      setAddresses(list)
    } catch (error: unknown) {
      const err = getApiErrorContext(
        error,
        'Please check your connection and try again.',
      )

      if (err.isAuthError) {
        router.replace('/(auth)/login')
        return
      }

      Alert.alert('Unable to load addresses', err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = useMemo(() => {
    return (
      form.fullName.trim().length >= 2 &&
      form.addressLine1.trim().length >= 5 &&
      form.city.trim().length >= 2 &&
      form.country.trim().length >= 2 &&
      form.postalCode.trim().length >= 3
    )
  }, [form])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const startEdit = (address: UserAddress) => {
    setEditingId(address.id)
    setForm({
      addressType: address.address_type,
      fullName: address.full_name,
      addressLine1: address.address_line1,
      addressLine2: address.address_line2 || '',
      city: address.city,
      state: address.state || '',
      country: address.country,
      postalCode: address.postal_code,
      phone: address.phone || '',
      isDefault: address.is_default,
    })
  }

  const saveAddress = async () => {
    if (!isFormValid) {
      Alert.alert('Invalid address', 'Please complete all required fields.')
      return
    }

    const payload: UserAddressInput = {
      addressType: form.addressType,
      fullName: form.fullName.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2?.trim() || undefined,
      city: form.city.trim(),
      state: form.state?.trim() || undefined,
      country: form.country.trim(),
      postalCode: form.postalCode.trim(),
      phone: form.phone?.trim() || undefined,
      isDefault: form.isDefault,
    }

    try {
      setIsSaving(true)

      if (editingId) {
        await addressesApi.update(editingId, payload)
        void securityApi.logSensitiveAction({
          action: 'profile.address.update',
          status: 'success',
          metadata: { addressId: editingId },
        })
      } else {
        await addressesApi.create(payload)
        void securityApi.logSensitiveAction({
          action: 'profile.address.create',
          status: 'success',
          metadata: { addressType: payload.addressType },
        })
      }

      await loadAddresses()
      resetForm()
      Alert.alert('Saved', 'Address details were updated.')
    } catch (error: unknown) {
      void securityApi.logSensitiveAction({
        action: editingId ? 'profile.address.update' : 'profile.address.create',
        status: 'failed',
      })

      Alert.alert(
        'Save failed',
        getApiErrorMessage(
          error,
          'We could not save this address. Please try again.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const removeAddress = (addressId: string) => {
    Alert.alert(
      'Delete address',
      'Are you sure you want to remove this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await addressesApi.delete(addressId)
              void securityApi.logSensitiveAction({
                action: 'profile.address.delete',
                status: 'success',
                metadata: { addressId },
              })

              if (editingId === addressId) {
                resetForm()
              }
              await loadAddresses()
            } catch (error: unknown) {
              void securityApi.logSensitiveAction({
                action: 'profile.address.delete',
                status: 'failed',
                metadata: { addressId },
              })

              Alert.alert(
                'Delete failed',
                getApiErrorMessage(
                  error,
                  'Could not delete this address right now.',
                ),
              )
            }
          },
        },
      ],
    )
  }

  const setDefault = async (addressId: string) => {
    try {
      await addressesApi.setDefault(addressId)
      void securityApi.logSensitiveAction({
        action: 'profile.address.set-default',
        status: 'success',
        metadata: { addressId },
      })
      await loadAddresses()
    } catch (error: unknown) {
      void securityApi.logSensitiveAction({
        action: 'profile.address.set-default',
        status: 'failed',
        metadata: { addressId },
      })

      Alert.alert(
        'Default update failed',
        getApiErrorMessage(error, 'Could not set this as the default address.'),
      )
    }
  }

  if (!hasHydrated || authLoading || isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Addresses</Text>
          <TouchableOpacity onPress={resetForm} style={styles.iconButton}>
            <Ionicons name='refresh' size={18} color={AppColors.gray700} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>
                {editingId ? 'Edit Address' : 'Add Address'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                Save verified address details for faster checkout and support.
              </Text>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.typeChip,
                    form.addressType === 'shipping' && styles.typeChipActive,
                  ]}
                  onPress={() =>
                    setForm((prev) => ({ ...prev, addressType: 'shipping' }))
                  }
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      form.addressType === 'shipping' &&
                        styles.typeChipTextActive,
                    ]}
                  >
                    Shipping
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeChip,
                    form.addressType === 'billing' && styles.typeChipActive,
                  ]}
                  onPress={() =>
                    setForm((prev) => ({ ...prev, addressType: 'billing' }))
                  }
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      form.addressType === 'billing' &&
                        styles.typeChipTextActive,
                    ]}
                  >
                    Billing
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder='Full name *'
                value={form.fullName}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, fullName: value }))
                }
                style={styles.input}
              />
              <TextInput
                placeholder='Address line 1 *'
                value={form.addressLine1}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, addressLine1: value }))
                }
                style={styles.input}
              />
              <TextInput
                placeholder='Address line 2'
                value={form.addressLine2}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, addressLine2: value }))
                }
                style={styles.input}
              />
              <TextInput
                placeholder='City *'
                value={form.city}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, city: value }))
                }
                style={styles.input}
              />
              <TextInput
                placeholder='State / Region'
                value={form.state}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, state: value }))
                }
                style={styles.input}
              />
              <TextInput
                placeholder='Postal code *'
                value={form.postalCode}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, postalCode: value }))
                }
                style={styles.input}
              />
              <TextInput
                placeholder='Country *'
                value={form.country}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, country: value }))
                }
                style={styles.input}
              />
              <TextInput
                placeholder='Phone'
                value={form.phone}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, phone: value }))
                }
                style={styles.input}
                keyboardType='phone-pad'
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setForm((prev) => ({ ...prev, isDefault: !prev.isDefault }))
                }
              >
                <Ionicons
                  name={form.isDefault ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={form.isDefault ? AppColors.primary : AppColors.gray500}
                />
                <Text style={styles.checkboxText}>Set as default</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!isFormValid || isSaving) && styles.disabled,
                ]}
                onPress={saveAddress}
                disabled={!isFormValid || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size='small' color={AppColors.white} />
                ) : (
                  <Text style={styles.saveText}>
                    {editingId ? 'Update Address' : 'Save Address'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.addressCard}>
              <View style={styles.addressTopRow}>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{item.address_type}</Text>
                </View>
                {item.is_default && (
                  <View style={styles.defaultPill}>
                    <Text style={styles.defaultPillText}>Default</Text>
                  </View>
                )}
              </View>

              <Text style={styles.addressName}>{item.full_name}</Text>
              <Text style={styles.addressLine}>{item.address_line1}</Text>
              {!!item.address_line2 && (
                <Text style={styles.addressLine}>{item.address_line2}</Text>
              )}
              <Text style={styles.addressLine}>
                {item.city}, {item.state || '-'} {item.postal_code}
              </Text>
              <Text style={styles.addressLine}>{item.country}</Text>
              {!!item.phone && (
                <Text style={styles.addressLine}>{item.phone}</Text>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => startEdit(item)}
                >
                  <Ionicons
                    name='create-outline'
                    size={16}
                    color={AppColors.info}
                  />
                  <Text style={[styles.actionText, { color: AppColors.info }]}>
                    Edit
                  </Text>
                </TouchableOpacity>
                {!item.is_default && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setDefault(item.id)}
                  >
                    <Ionicons
                      name='checkmark-circle-outline'
                      size={16}
                      color={AppColors.accent}
                    />
                    <Text
                      style={[styles.actionText, { color: AppColors.accent }]}
                    >
                      Default
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => removeAddress(item.id)}
                >
                  <Ionicons
                    name='trash-outline'
                    size={16}
                    color={AppColors.error}
                  />
                  <Text style={[styles.actionText, { color: AppColors.error }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name='location-outline'
                size={40}
                color={AppColors.gray400}
              />
              <Text style={styles.emptyTitle}>No addresses saved yet</Text>
              <Text style={styles.emptySubtitle}>
                Add a shipping or billing address to speed up checkout.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
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
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.gray100,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  content: {
    padding: AppSpacing.base,
    paddingBottom: 120,
    gap: AppSpacing.md,
  },
  formCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: AppSpacing.xs,
    marginBottom: AppSpacing.base,
  },
  row: {
    flexDirection: 'row',
    marginBottom: AppSpacing.sm,
    gap: AppSpacing.sm,
  },
  typeChip: {
    flex: 1,
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    backgroundColor: AppColors.gray50,
    alignItems: 'center',
    paddingVertical: 10,
  },
  typeChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: '#FFF1EC',
  },
  typeChipText: {
    color: AppColors.gray600,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typeChipTextActive: {
    color: AppColors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.gray50,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: 11,
    marginBottom: AppSpacing.sm,
    color: AppColors.gray900,
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: AppSpacing.xs,
    marginBottom: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  checkboxText: {
    color: AppColors.gray700,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  saveText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  addressCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  addressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.sm,
  },
  typePill: {
    backgroundColor: AppColors.gray100,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: {
    color: AppColors.gray700,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  defaultPill: {
    backgroundColor: '#E8F9F1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  defaultPillText: {
    color: AppColors.accent,
    fontWeight: '700',
    fontSize: 11,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 13,
    color: AppColors.gray600,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: AppSpacing.base,
    marginTop: AppSpacing.base,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: AppSpacing['3xl'],
  },
  emptyTitle: {
    marginTop: AppSpacing.base,
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray700,
  },
  emptySubtitle: {
    marginTop: AppSpacing.xs,
    fontSize: 13,
    color: AppColors.gray500,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
})
