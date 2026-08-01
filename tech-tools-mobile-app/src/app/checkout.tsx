// ============================================
// TechTools Mobile App - Checkout Screen with Stripe
// Enterprise-grade payment integration
// ============================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  StripeProvider,
  useStripe,
  CardField,
  CardFieldInput,
} from '@stripe/stripe-react-native'
import { Input, Button } from '@/components'
import {
  countriesSortedByName,
  getCountryByCode,
  Country,
} from '@/data/countries'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
  AppGradients,
} from '@/constants/appTheme'
import { useCartStore, useAuthStore } from '@/stores'
import { formatPrice } from '@/utils'
import { paymentsApi, ordersApiNew } from '@/api'

type CheckoutStep = 'shipping' | 'payment' | 'review'

interface ShippingForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  apartment: string
  city: string
  state: string
  postalCode: string
  country: string
}

export default function CheckoutScreen() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCartStore()
  const { isAuthenticated, user } = useAuthStore()

  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [loading, setLoading] = useState(false)
  const [stripePublishableKey, setStripePublishableKey] = useState<string>('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  // Set once createPaymentIntent() creates the order draft + PaymentIntent
  // together on the server (before payment is confirmed) -- the order
  // already exists by the time the shopper reaches the payment step.
  const [orderDraft, setOrderDraft] = useState<{
    orderId: string
    orderNumber: string
    taxAmount: number
    shippingAmount: number
    grandTotal: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const cardValidatedRef = useRef(false) // Track if card was validated before moving to review

  // Shipping form
  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  })

  const total = subtotal()
  const shipping = total > 50 ? 0 : 5.99
  const tax = total * 0.08
  const grandTotal = total + shipping + tax

  const steps: { key: CheckoutStep; label: string; icon: string }[] = [
    { key: 'shipping', label: 'Shipping', icon: 'location-outline' },
    { key: 'payment', label: 'Payment', icon: 'card-outline' },
    { key: 'review', label: 'Confirm', icon: 'checkmark-circle-outline' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  // Require authentication for checkout
  useEffect(() => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to continue with checkout.', [
        {
          text: 'Login',
          onPress: () => router.replace('/login'),
        },
        {
          text: 'Cancel',
          onPress: () => router.back(),
          style: 'cancel',
        },
      ])
    }
  }, [isAuthenticated, router])

  // Redirect if not authenticated (guard)
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
          <Text style={styles.loadingText}>Checking authentication...</Text>
        </View>
      </SafeAreaView>
    )
  }

  // Initialize Stripe
  useEffect(() => {
    const initStripe = async () => {
      try {
        const config = await paymentsApi.getConfig()
        setStripePublishableKey(config.publishableKey)
      } catch (err) {
        console.error('Failed to get Stripe config:', err)
        setError('Payment service unavailable. Please try again later.')
      }
    }
    initStripe()
  }, [])

  // Update user info when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setShippingForm((prev) => ({
        ...prev,
        firstName: user.first_name || prev.firstName,
        lastName: user.last_name || prev.lastName,
        email: user.email || prev.email,
      }))
    }
  }, [isAuthenticated, user])

  // Create payment intent when moving to payment step
  const createPaymentIntent = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)

      // Double check authentication
      if (!isAuthenticated) {
        setError('Please login to continue.')
        router.replace('/login')
        return false
      }

      const orderItems = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))

      const result = await ordersApiNew.checkoutSession({
        items: orderItems,
        shippingAddress: {
          firstName: shippingForm.firstName,
          lastName: shippingForm.lastName,
          email: shippingForm.email,
          phone: shippingForm.phone,
          address: shippingForm.address,
          apartment: shippingForm.apartment,
          city: shippingForm.city,
          state: shippingForm.state,
          postalCode: shippingForm.postalCode,
          country: shippingForm.country,
        },
      })

      setClientSecret(result.clientSecret)
      setPaymentIntentId(result.paymentIntentId)
      setOrderDraft({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        taxAmount: result.taxAmount,
        shippingAmount: result.shippingAmount,
        grandTotal: result.grandTotal,
      })
      return true
    } catch (err: any) {
      console.error('Failed to create payment intent:', err)

      // Handle specific error types
      if (err?.response?.status === 401) {
        setError('Session expired. Please login again.')
        Alert.alert('Session Expired', 'Please login again to continue.', [
          { text: 'Login', onPress: () => router.replace('/login') },
        ])
      } else {
        const errorMsg =
          err?.response?.data?.error ||
          err?.message ||
          'Failed to initialize payment.'
        setError(errorMsg)
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [items, shippingForm, isAuthenticated, router])

  const validateShipping = (): boolean => {
    if (
      !shippingForm.firstName ||
      !shippingForm.lastName ||
      !shippingForm.email ||
      !shippingForm.address ||
      !shippingForm.city ||
      !shippingForm.postalCode
    ) {
      Alert.alert('Missing Information', 'Please fill in all required fields.')
      return false
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(shippingForm.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return false
    }

    return true
  }

  const handleContinue = async () => {
    setError(null)

    if (step === 'shipping') {
      if (!validateShipping()) return

      const success = await createPaymentIntent()
      if (success) {
        setStep('payment')
      }
    }
  }

  if (!stripePublishableKey) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
          <Text style={styles.loadingText}>Initializing payment...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <CheckoutContent
        step={step}
        setStep={setStep}
        steps={steps}
        currentStepIndex={currentStepIndex}
        shippingForm={shippingForm}
        setShippingForm={setShippingForm}
        total={total}
        shipping={shipping}
        tax={tax}
        grandTotal={grandTotal}
        items={items}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        orderDraft={orderDraft}
        cardComplete={cardComplete}
        setCardComplete={setCardComplete}
        cardValidatedRef={cardValidatedRef}
        handleContinue={handleContinue}
        clearCart={clearCart}
        router={router}
      />
    </StripeProvider>
  )
}

// Separate component to use Stripe hooks
function CheckoutContent({
  step,
  setStep,
  steps,
  currentStepIndex,
  shippingForm,
  setShippingForm,
  total,
  shipping,
  tax,
  grandTotal,
  items,
  loading,
  setLoading,
  error,
  setError,
  clientSecret,
  paymentIntentId,
  orderDraft,
  cardComplete,
  setCardComplete,
  cardValidatedRef,
  handleContinue,
  clearCart,
  router,
}: any) {
  const { confirmPayment } = useStripe()
  const [countryPickerVisible, setCountryPickerVisible] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')

  // Once the order draft exists, the server-computed totals are
  // authoritative -- the amount actually charged and the amount displayed
  // should never be able to diverge. Before that, show the client-side
  // estimate.
  const displayShipping = orderDraft?.shippingAmount ?? shipping
  const displayTax = orderDraft?.taxAmount ?? tax
  const displayGrandTotal = orderDraft?.grandTotal ?? grandTotal

  // Filter countries based on search
  const filteredCountries = countrySearch
    ? countriesSortedByName.filter(
        (c) =>
          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
          c.code.toLowerCase().includes(countrySearch.toLowerCase()),
      )
    : countriesSortedByName

  const selectedCountry = getCountryByCode(shippingForm.country)

  const handlePlaceOrder = async () => {
    if (!clientSecret || !paymentIntentId || !orderDraft) {
      Alert.alert('Error', 'Payment not initialized. Please try again.')
      return
    }

    // CardField stays mounted, so we can proceed directly
    // The card data is retained because we keep the CardField mounted during review step

    setLoading(true)
    setError(null)

    try {
      // Confirm the payment with Stripe
      const { error: stripeError, paymentIntent } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: `${shippingForm.firstName} ${shippingForm.lastName}`,
              email: shippingForm.email,
              phone: shippingForm.phone,
              address: {
                line1: shippingForm.address,
                line2: shippingForm.apartment,
                city: shippingForm.city,
                state: shippingForm.state,
                postalCode: shippingForm.postalCode,
                country: shippingForm.country,
              },
            },
          },
        },
      )

      if (stripeError) {
        setError(stripeError.message || 'Payment failed')
        Alert.alert('Payment Error', stripeError.message || 'Payment failed')
        return
      }

      if (paymentIntent?.status === 'Succeeded') {
        // The order already exists (created in createPaymentIntent() before
        // payment was attempted) -- final confirmation (payment_status ->
        // paid) happens server-side via the Stripe webhook, so this just
        // finalizes the UI using the order we already know about.
        clearCart()

        Alert.alert(
          'Order Placed!',
          `Order #${orderDraft.orderNumber} has been successfully placed. You will receive a confirmation email at ${shippingForm.email}.`,
          [
            {
              text: 'Continue Shopping',
              onPress: () => router.replace('/'),
            },
          ],
        )
      } else {
        setError(`Payment status: ${paymentIntent?.status}`)
        Alert.alert('Payment Issue', `Payment status: ${paymentIntent?.status}`)
      }
    } catch (err: any) {
      console.error('Order confirmation error:', err)
      const errorMessage =
        err?.response?.data?.error || err?.message || 'Failed to complete order'
      setError(errorMessage)
      Alert.alert('Error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map(
        (
          s: { key: CheckoutStep; label: string; icon: string },
          index: number,
        ) => (
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
                  index <= currentStepIndex
                    ? AppColors.white
                    : AppColors.gray400
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
        ),
      )}
    </View>
  )

  const renderShippingStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Shipping Address</Text>

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Input
            label='First Name *'
            placeholder='John'
            value={shippingForm.firstName}
            onChangeText={(text: string) =>
              setShippingForm({ ...shippingForm, firstName: text })
            }
          />
        </View>
        <View style={styles.formHalf}>
          <Input
            label='Last Name *'
            placeholder='Doe'
            value={shippingForm.lastName}
            onChangeText={(text: string) =>
              setShippingForm({ ...shippingForm, lastName: text })
            }
          />
        </View>
      </View>

      <Input
        label='Email *'
        placeholder='john@example.com'
        value={shippingForm.email}
        onChangeText={(text: string) =>
          setShippingForm({ ...shippingForm, email: text })
        }
        keyboardType='email-address'
        autoCapitalize='none'
      />

      <Input
        label='Phone'
        placeholder='+1 (555) 000-0000'
        value={shippingForm.phone}
        onChangeText={(text: string) =>
          setShippingForm({ ...shippingForm, phone: text })
        }
        keyboardType='phone-pad'
      />

      <Input
        label='Street Address *'
        placeholder='123 Main St'
        value={shippingForm.address}
        onChangeText={(text: string) =>
          setShippingForm({ ...shippingForm, address: text })
        }
      />

      <Input
        label='Apartment, suite, etc. (optional)'
        placeholder='Apt 4B'
        value={shippingForm.apartment}
        onChangeText={(text: string) =>
          setShippingForm({ ...shippingForm, apartment: text })
        }
      />

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Input
            label='City *'
            placeholder='New York'
            value={shippingForm.city}
            onChangeText={(text: string) =>
              setShippingForm({ ...shippingForm, city: text })
            }
          />
        </View>
        <View style={styles.formHalf}>
          <Input
            label='State / Region'
            placeholder='NY'
            value={shippingForm.state}
            onChangeText={(text: string) =>
              setShippingForm({ ...shippingForm, state: text })
            }
          />
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Input
            label='Postal Code *'
            placeholder='10001'
            value={shippingForm.postalCode}
            onChangeText={(text: string) =>
              setShippingForm({ ...shippingForm, postalCode: text })
            }
            keyboardType='numeric'
          />
        </View>
        <View style={styles.formHalf}>
          <Text style={styles.inputLabel}>Country *</Text>
          <TouchableOpacity
            style={styles.countryPicker}
            onPress={() => setCountryPickerVisible(true)}
          >
            <Text style={styles.countryFlag}>
              {selectedCountry?.flag || '🌍'}
            </Text>
            <Text style={styles.countryName} numberOfLines={1}>
              {selectedCountry?.name || 'Select country'}
            </Text>
            <Ionicons name='chevron-down' size={18} color={AppColors.gray500} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Shipping Method */}
      <View style={styles.shippingMethod}>
        <Text style={styles.shippingMethodTitle}>Shipping Method</Text>
        <View style={styles.shippingOption}>
          <View style={styles.shippingOptionLeft}>
            <Ionicons name='car-outline' size={24} color={AppColors.primary} />
            <View style={styles.shippingOptionInfo}>
              <Text style={styles.shippingOptionName}>Standard Shipping</Text>
              <Text style={styles.shippingOptionTime}>3-5 business days</Text>
            </View>
          </View>
          <Text style={styles.shippingOptionPrice}>
            {shipping === 0 ? 'FREE' : formatPrice(shipping)}
          </Text>
        </View>
      </View>
    </View>
  )

  const renderPaymentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Payment Details</Text>

      {/* Security Badge */}
      <View style={styles.securityBadge}>
        <Ionicons name='shield-checkmark' size={20} color={AppColors.accent} />
        <Text style={styles.securityText}>256-bit SSL encrypted payment</Text>
      </View>

      {/* Shipping Summary */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Shipping to</Text>
          <TouchableOpacity onPress={() => setStep('shipping')}>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.summaryText}>
          {shippingForm.firstName} {shippingForm.lastName}
        </Text>
        <Text style={styles.summaryText}>
          {shippingForm.address}
          {shippingForm.apartment && `, ${shippingForm.apartment}`}
        </Text>
        <Text style={styles.summaryText}>
          {shippingForm.city}, {shippingForm.state} {shippingForm.postalCode}
        </Text>
      </View>

      {/* Stripe Card Field */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardLabel}>Card Information</Text>
        <CardField
          postalCodeEnabled={false}
          placeholders={{
            number: '4242 4242 4242 4242',
            expiration: 'MM/YY',
            cvc: 'CVC',
          }}
          cardStyle={{
            backgroundColor: '#FFFFFF',
            textColor: '#1f2937',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            borderRadius: 8,
            fontSize: 16,
            placeholderColor: '#9ca3af',
          }}
          style={styles.cardField}
          onCardChange={(cardDetails: CardFieldInput.Details) => {
            setCardComplete(cardDetails.complete)
          }}
        />
        <Text style={styles.cardHint}>
          Enter your card number, expiry date (MM/YY), and CVC
        </Text>
      </View>

      {/* Accepted Cards */}
      <View style={styles.acceptedCards}>
        <Text style={styles.acceptedCardsLabel}>Accepted cards:</Text>
        <View style={styles.cardLogos}>
          <View style={styles.cardLogo}>
            <Text style={styles.cardLogoText}>Visa</Text>
          </View>
          <View style={styles.cardLogo}>
            <Text style={styles.cardLogoText}>MC</Text>
          </View>
          <View style={styles.cardLogo}>
            <Text style={styles.cardLogoText}>Amex</Text>
          </View>
          <View style={styles.cardLogo}>
            <Text style={styles.cardLogoText}>Discover</Text>
          </View>
        </View>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name='alert-circle' size={20} color={AppColors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  )

  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Order Review</Text>

      {/* Success indicator */}
      <View style={styles.successBox}>
        <Ionicons name='checkmark-circle' size={24} color={AppColors.accent} />
        <Text style={styles.successText}>Ready to place your order</Text>
      </View>

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
          <TouchableOpacity
            onPress={() => {
              cardValidatedRef.current = false // Reset validation when editing payment
              setStep('payment')
            }}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.paymentSummary}>
          <Ionicons name='card' size={20} color={AppColors.gray600} />
          <Text style={styles.reviewText}>Card ending in ****</Text>
        </View>
      </View>

      {/* Items Summary */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Items ({items.length})</Text>
        {items.map((item: any) => (
          <View key={item.id} style={styles.reviewItem}>
            <Text style={styles.reviewItemName} numberOfLines={1}>
              {item.product.name}
            </Text>
            <Text style={styles.reviewItemQty}>x{item.quantity}</Text>
            <Text style={styles.reviewItemPrice}>
              {formatPrice(
                (item.product.sale_price || item.product.base_price) *
                  item.quantity,
              )}
            </Text>
          </View>
        ))}
      </View>

      {/* Price Breakdown */}
      <View style={styles.priceBreakdown}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Subtotal</Text>
          <Text style={styles.priceValue}>{formatPrice(total)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Shipping</Text>
          <Text
            style={[
              styles.priceValue,
              displayShipping === 0 && styles.freeShipping,
            ]}
          >
            {displayShipping === 0 ? 'FREE' : formatPrice(displayShipping)}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Tax (8%)</Text>
          <Text style={styles.priceValue}>{formatPrice(displayTax)}</Text>
        </View>
        <View style={[styles.priceRow, styles.totalRowInner]}>
          <Text style={styles.totalLabelInner}>Total</Text>
          <Text style={styles.totalValueInner}>{formatPrice(displayGrandTotal)}</Text>
        </View>
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

        {/* Payment step - always render CardField when past shipping step to retain data */}
        {(step === 'payment' || step === 'review') && (
          <View style={step === 'review' ? styles.hiddenView : undefined}>
            {renderPaymentStep()}
          </View>
        )}

        {step === 'review' && renderReviewStep()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalValue}>{formatPrice(displayGrandTotal)}</Text>
        </View>

        {step === 'shipping' && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleContinue}
            disabled={loading}
          >
            <LinearGradient
              colors={AppGradients.primary as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.continueButton, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator size='small' color={AppColors.white} />
              ) : (
                <>
                  <Text style={styles.continueButtonText}>
                    Continue to Payment
                  </Text>
                  <Ionicons
                    name='arrow-forward'
                    size={20}
                    color={AppColors.white}
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {step === 'payment' && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              cardValidatedRef.current = true // Mark card as validated before moving to review
              setStep('review')
            }}
            disabled={!cardComplete}
          >
            <LinearGradient
              colors={AppGradients.primary as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.continueButton,
                !cardComplete && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.continueButtonText}>Review Order</Text>
              <Ionicons
                name='arrow-forward'
                size={20}
                color={AppColors.white}
              />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {step === 'review' && (
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
              {loading ? (
                <>
                  <ActivityIndicator size='small' color={AppColors.white} />
                  <Text style={styles.continueButtonText}>Processing...</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name='lock-closed'
                    size={18}
                    color={AppColors.white}
                  />
                  <Text style={styles.continueButtonText}>
                    Pay {formatPrice(displayGrandTotal)}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Back button for payment and review steps */}
        {step !== 'shipping' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step === 'payment' ? 'shipping' : 'payment')}
          >
            <Ionicons name='arrow-back' size={18} color={AppColors.gray600} />
            <Text style={styles.backButtonText}>
              Back to {step === 'payment' ? 'Shipping' : 'Payment'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Powered by Stripe */}
        <View style={styles.poweredBy}>
          <Ionicons
            name='shield-checkmark'
            size={14}
            color={AppColors.gray400}
          />
          <Text style={styles.poweredByText}>Secured by Stripe</Text>
        </View>
      </View>

      {/* Country Picker Modal */}
      <Modal
        visible={countryPickerVisible}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => {
                  setCountryPickerVisible(false)
                  setCountrySearch('')
                }}
              >
                <Ionicons name='close' size={24} color={AppColors.gray600} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name='search' size={20} color={AppColors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder='Search countries...'
                placeholderTextColor={AppColors.gray400}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCorrect={false}
              />
              {countrySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountrySearch('')}>
                  <Ionicons
                    name='close-circle'
                    size={20}
                    color={AppColors.gray400}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Country List */}
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }: { item: Country }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    shippingForm.country === item.code &&
                      styles.countryItemSelected,
                  ]}
                  onPress={() => {
                    setShippingForm({ ...shippingForm, country: item.code })
                    setCountryPickerVisible(false)
                    setCountrySearch('')
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  {shippingForm.country === item.code && (
                    <Ionicons
                      name='checkmark'
                      size={20}
                      color={AppColors.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.countryList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  },
  loadingText: {
    marginTop: AppSpacing.md,
    fontSize: 14,
    color: AppColors.gray600,
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
    paddingBottom: 220,
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
  shippingMethod: {
    marginTop: AppSpacing.lg,
    paddingTop: AppSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  shippingMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.gray900,
    marginBottom: AppSpacing.md,
  },
  shippingOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: AppSpacing.base,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  shippingOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  shippingOptionInfo: {
    gap: 2,
  },
  shippingOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  shippingOptionTime: {
    fontSize: 12,
    color: AppColors.gray500,
  },
  shippingOptionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    padding: AppSpacing.md,
    backgroundColor: '#ecfdf5',
    borderRadius: AppBorderRadius.md,
    marginBottom: AppSpacing.lg,
  },
  securityText: {
    fontSize: 13,
    color: AppColors.accent,
    fontWeight: '500',
  },
  summaryBox: {
    padding: AppSpacing.md,
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    marginBottom: AppSpacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.sm,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: AppColors.gray500,
    textTransform: 'uppercase',
  },
  changeText: {
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '500',
  },
  summaryText: {
    fontSize: 14,
    color: AppColors.gray700,
    marginBottom: 2,
  },
  cardContainer: {
    marginBottom: AppSpacing.lg,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.gray700,
    marginBottom: AppSpacing.sm,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  acceptedCards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  acceptedCardsLabel: {
    fontSize: 12,
    color: AppColors.gray500,
  },
  cardLogos: {
    flexDirection: 'row',
    gap: AppSpacing.xs,
  },
  cardLogo: {
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    backgroundColor: AppColors.gray100,
    borderRadius: 4,
  },
  cardLogoText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.gray600,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    padding: AppSpacing.md,
    backgroundColor: '#fef2f2',
    borderRadius: AppBorderRadius.md,
    marginTop: AppSpacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    padding: AppSpacing.md,
    backgroundColor: '#ecfdf5',
    borderRadius: AppBorderRadius.md,
    marginBottom: AppSpacing.lg,
  },
  successText: {
    fontSize: 14,
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
  paymentSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginHorizontal: AppSpacing.sm,
  },
  reviewItemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.gray700,
  },
  priceBreakdown: {
    marginTop: AppSpacing.lg,
    paddingTop: AppSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.sm,
  },
  priceLabel: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  priceValue: {
    fontSize: 14,
    color: AppColors.gray700,
  },
  freeShipping: {
    color: AppColors.accent,
    fontWeight: '500',
  },
  totalRowInner: {
    marginTop: AppSpacing.sm,
    paddingTop: AppSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray200,
  },
  totalLabelInner: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  totalValueInner: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppColors.white,
    borderTopLeftRadius: AppBorderRadius.xl,
    borderTopRightRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    paddingBottom: AppSpacing['2xl'],
    ...AppShadows.lg,
  },
  footerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.md,
  },
  footerTotalLabel: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  footerTotalValue: {
    fontSize: 18,
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
    opacity: 0.6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppSpacing.md,
    gap: AppSpacing.xs,
  },
  backButtonText: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppSpacing.md,
    gap: AppSpacing.xs,
  },
  poweredByText: {
    fontSize: 12,
    color: AppColors.gray400,
  },
  // Country Picker Styles
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.gray700,
    marginBottom: AppSpacing.sm,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: AppColors.gray700,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: AppColors.white,
    borderTopLeftRadius: AppBorderRadius.xl,
    borderTopRightRadius: AppBorderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: AppSpacing.base,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.gray50,
    margin: AppSpacing.base,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    gap: AppSpacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: AppColors.gray700,
    paddingVertical: AppSpacing.sm,
  },
  countryList: {
    paddingBottom: AppSpacing['2xl'],
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: AppSpacing.base,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray50,
  },
  countryItemSelected: {
    backgroundColor: AppColors.primaryLight || 'rgba(37, 99, 235, 0.05)',
  },
  countryItemFlag: {
    fontSize: 24,
    marginRight: AppSpacing.md,
  },
  countryItemName: {
    flex: 1,
    fontSize: 16,
    color: AppColors.gray700,
  },
  // Card Hint
  cardHint: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: AppSpacing.sm,
  },
  // Hidden view for keeping CardField mounted on review step
  hiddenView: {
    position: 'absolute',
    height: 0,
    width: 0,
    overflow: 'hidden',
    opacity: 0,
  },
})
