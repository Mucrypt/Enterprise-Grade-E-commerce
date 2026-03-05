// ============================================
// TechTools Mobile App - Checkout Screen
// ============================================

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Input, Button } from '@/components'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
  AppGradients,
} from '@/constants/appTheme'
import { useCartStore, useAuthStore } from '@/stores'
import { formatPrice } from '@/utils'

type CheckoutStep = 'shipping' | 'payment' | 'review'

export default function CheckoutScreen() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()

  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [loading, setLoading] = useState(false)

  // Shipping form
  const [shippingForm, setShippingForm] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
  })

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  })

  const total = subtotal()
  const shipping = total > 50 ? 0 : 5.99
  const tax = total * 0.08
  const grandTotal = total + shipping + tax

  const steps: { key: CheckoutStep; label: string; icon: string }[] = [
    { key: 'shipping', label: 'Shipping', icon: 'location-outline' },
    { key: 'payment', label: 'Payment', icon: 'card-outline' },
    { key: 'review', label: 'Review', icon: 'checkmark-circle-outline' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  const handleContinue = () => {
    if (step === 'shipping') {
      // Validate shipping
      if (
        !shippingForm.firstName ||
        !shippingForm.lastName ||
        !shippingForm.address ||
        !shippingForm.city
      ) {
        Alert.alert(
          'Missing Information',
          'Please fill in all required fields.',
        )
        return
      }
      setStep('payment')
    } else if (step === 'payment') {
      // Validate payment
      if (
        !paymentForm.cardNumber ||
        !paymentForm.cardName ||
        !paymentForm.expiry ||
        !paymentForm.cvv
      ) {
        Alert.alert(
          'Missing Information',
          'Please fill in all payment details.',
        )
        return
      }
      setStep('review')
    }
  }

  const handlePlaceOrder = async () => {
    setLoading(true)

    try {
      // Simulate order placement
      await new Promise((resolve) => setTimeout(resolve, 2000))

      clearCart()

      Alert.alert(
        'Order Placed!',
        'Your order has been successfully placed. You will receive a confirmation email shortly.',
        [
          {
            text: 'Continue Shopping',
            onPress: () => router.replace('/'),
          },
        ],
      )
    } catch (error) {
      Alert.alert('Error', 'Failed to place order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((s, index) => (
        <React.Fragment key={s.key}>
          <TouchableOpacity
            style={[
              styles.stepDot,
              index <= currentStepIndex && styles.stepDotActive,
            ]}
            onPress={() => index < currentStepIndex && setStep(s.key)}
            disabled={index > currentStepIndex}
          >
            <Ionicons
              name={s.icon as any}
              size={18}
              color={
                index <= currentStepIndex ? AppColors.white : AppColors.gray400
              }
            />
          </TouchableOpacity>
          {index < steps.length - 1 && (
            <View
              style={[
                styles.stepLine,
                index < currentStepIndex && styles.stepLineActive,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  )

  const renderShippingStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Shipping Address</Text>

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Input
            label='First Name'
            placeholder='John'
            value={shippingForm.firstName}
            onChangeText={(text) =>
              setShippingForm({ ...shippingForm, firstName: text })
            }
          />
        </View>
        <View style={styles.formHalf}>
          <Input
            label='Last Name'
            placeholder='Doe'
            value={shippingForm.lastName}
            onChangeText={(text) =>
              setShippingForm({ ...shippingForm, lastName: text })
            }
          />
        </View>
      </View>

      <Input
        label='Email'
        placeholder='john@example.com'
        value={shippingForm.email}
        onChangeText={(text) =>
          setShippingForm({ ...shippingForm, email: text })
        }
        keyboardType='email-address'
      />

      <Input
        label='Phone'
        placeholder='+1 (555) 000-0000'
        value={shippingForm.phone}
        onChangeText={(text) =>
          setShippingForm({ ...shippingForm, phone: text })
        }
        keyboardType='phone-pad'
      />

      <Input
        label='Street Address'
        placeholder='123 Main St'
        value={shippingForm.address}
        onChangeText={(text) =>
          setShippingForm({ ...shippingForm, address: text })
        }
      />

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Input
            label='City'
            placeholder='New York'
            value={shippingForm.city}
            onChangeText={(text) =>
              setShippingForm({ ...shippingForm, city: text })
            }
          />
        </View>
        <View style={styles.formHalf}>
          <Input
            label='State'
            placeholder='NY'
            value={shippingForm.state}
            onChangeText={(text) =>
              setShippingForm({ ...shippingForm, state: text })
            }
          />
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Input
            label='Postal Code'
            placeholder='10001'
            value={shippingForm.postalCode}
            onChangeText={(text) =>
              setShippingForm({ ...shippingForm, postalCode: text })
            }
            keyboardType='numeric'
          />
        </View>
        <View style={styles.formHalf}>
          <Input
            label='Country'
            placeholder='United States'
            value={shippingForm.country}
            onChangeText={(text) =>
              setShippingForm({ ...shippingForm, country: text })
            }
          />
        </View>
      </View>
    </View>
  )

  const renderPaymentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Payment Details</Text>

      <View style={styles.cardIcons}>
        <Ionicons name='card' size={32} color={AppColors.gray400} />
        <Text style={styles.secureText}>
          <Ionicons name='lock-closed' size={12} color={AppColors.accent} />{' '}
          Secure Payment
        </Text>
      </View>

      <Input
        label='Card Number'
        placeholder='1234 5678 9012 3456'
        value={paymentForm.cardNumber}
        onChangeText={(text) =>
          setPaymentForm({ ...paymentForm, cardNumber: text })
        }
        keyboardType='numeric'
        leftIcon='card-outline'
      />

      <Input
        label='Cardholder Name'
        placeholder='John Doe'
        value={paymentForm.cardName}
        onChangeText={(text) =>
          setPaymentForm({ ...paymentForm, cardName: text })
        }
      />

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Input
            label='Expiry Date'
            placeholder='MM/YY'
            value={paymentForm.expiry}
            onChangeText={(text) =>
              setPaymentForm({ ...paymentForm, expiry: text })
            }
          />
        </View>
        <View style={styles.formHalf}>
          <Input
            label='CVV'
            placeholder='123'
            value={paymentForm.cvv}
            onChangeText={(text) =>
              setPaymentForm({ ...paymentForm, cvv: text })
            }
            keyboardType='numeric'
            secureTextEntry
          />
        </View>
      </View>
    </View>
  )

  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Order Review</Text>

      {/* Shipping Summary */}
      <View style={styles.reviewSection}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewSectionTitle}>Shipping Address</Text>
          <TouchableOpacity onPress={() => setStep('shipping')}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.reviewText}>
          {shippingForm.firstName} {shippingForm.lastName}
        </Text>
        <Text style={styles.reviewText}>{shippingForm.address}</Text>
        <Text style={styles.reviewText}>
          {shippingForm.city}, {shippingForm.state} {shippingForm.postalCode}
        </Text>
      </View>

      {/* Payment Summary */}
      <View style={styles.reviewSection}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewSectionTitle}>Payment Method</Text>
          <TouchableOpacity onPress={() => setStep('payment')}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.reviewText}>
          •••• •••• •••• {paymentForm.cardNumber.slice(-4)}
        </Text>
      </View>

      {/* Items Summary */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Items ({items.length})</Text>
        {items.map((item) => (
          <View key={item.id} style={styles.reviewItem}>
            <Text style={styles.reviewItemName} numberOfLines={1}>
              {item.product.name}
            </Text>
            <Text style={styles.reviewItemQty}>x{item.quantity}</Text>
          </View>
        ))}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        {step === 'shipping' && renderShippingStep()}
        {step === 'payment' && renderPaymentStep()}
        {step === 'review' && renderReviewStep()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(grandTotal)}</Text>
        </View>

        {step === 'review' ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handlePlaceOrder}
            disabled={loading}
          >
            <LinearGradient
              colors={AppGradients.primary as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.continueButton, loading && styles.buttonDisabled]}
            >
              <Text style={styles.continueButtonText}>
                {loading ? 'Processing...' : 'Place Order'}
              </Text>
              {!loading && (
                <Ionicons name='checkmark' size={20} color={AppColors.white} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.9} onPress={handleContinue}>
            <LinearGradient
              colors={AppGradients.primary as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueButton}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons
                name='arrow-forward'
                size={20}
                color={AppColors.white}
              />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
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
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: AppSpacing.lg,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: AppColors.primary,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: AppColors.gray200,
  },
  stepLineActive: {
    backgroundColor: AppColors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: AppSpacing.base,
    paddingBottom: 180,
  },
  stepContent: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray900,
    marginBottom: AppSpacing.lg,
  },
  formRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  formHalf: {
    flex: 1,
  },
  cardIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.lg,
    padding: AppSpacing.md,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
  },
  secureText: {
    fontSize: 12,
    color: AppColors.accent,
    fontWeight: '500',
  },
  reviewSection: {
    paddingVertical: AppSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.sm,
  },
  reviewSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  editText: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '500',
  },
  reviewText: {
    fontSize: 14,
    color: AppColors.gray600,
    marginBottom: 2,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: AppSpacing.xs,
  },
  reviewItemName: {
    flex: 1,
    fontSize: 14,
    color: AppColors.gray600,
  },
  reviewItemQty: {
    fontSize: 14,
    color: AppColors.gray500,
    marginLeft: AppSpacing.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppColors.white,
    borderTopLeftRadius: AppBorderRadius.xl,
    borderTopRightRadius: AppBorderRadius.xl,
    padding: AppSpacing.lg,
    paddingBottom: AppSpacing['2xl'],
    ...AppShadows.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.base,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.primary,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: AppSpacing.base,
    borderRadius: AppBorderRadius.lg,
    gap: AppSpacing.sm,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.white,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
})
