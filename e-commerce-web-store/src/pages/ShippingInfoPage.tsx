// ============================================
// Shipping Info Page - Production Ready
// ============================================

import { Link } from 'react-router-dom'
import {
  Truck,
  Clock,
  Globe,
  Package,
  MapPin,
  Calculator,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'

const shippingMethods = [
  {
    name: 'Standard Shipping',
    price: 'FREE over €50 / €4.99',
    time: '5-7 business days',
    description: 'Our most economical option for non-urgent orders',
    features: ['Tracking included', 'Delivery to door', 'Carbon neutral'],
    icon: '📦',
  },
  {
    name: 'Express Shipping',
    price: '€9.99',
    time: '2-3 business days',
    description: 'Fast delivery for when you need it sooner',
    features: ['Priority handling', 'Full tracking', 'Delivery to door'],
    icon: '🚀',
    popular: true,
  },
  {
    name: 'Next Day Delivery',
    price: '€14.99',
    time: '1 business day',
    description: 'Order by 2PM for next business day delivery',
    features: ['Guaranteed delivery', 'Signature required', 'SMS updates'],
    icon: '⚡',
  },
]

const internationalZones = [
  {
    zone: 'Zone 1 - Europe',
    countries: 'UK, France, Germany, Spain, Italy, Netherlands, Belgium',
    standardTime: '7-10 business days',
    expressTime: '3-5 business days',
    standardPrice: 'From €9.99',
    expressPrice: 'From €19.99',
  },
  {
    zone: 'Zone 2 - North America',
    countries: 'USA, Canada, Mexico',
    standardTime: '10-14 business days',
    expressTime: '5-7 business days',
    standardPrice: 'From €14.99',
    expressPrice: 'From €29.99',
  },
  {
    zone: 'Zone 3 - Asia Pacific',
    countries: 'Australia, Japan, South Korea, Singapore',
    standardTime: '14-21 business days',
    expressTime: '7-10 business days',
    standardPrice: 'From €19.99',
    expressPrice: 'From €39.99',
  },
  {
    zone: 'Zone 4 - Rest of World',
    countries: 'All other countries',
    standardTime: '14-28 business days',
    expressTime: '10-14 business days',
    standardPrice: 'From €24.99',
    expressPrice: 'From €49.99',
  },
]

const shippingFeatures = [
  {
    icon: Truck,
    title: 'Free Shipping',
    description: 'On all domestic orders over €50',
  },
  {
    icon: Globe,
    title: 'Worldwide Delivery',
    description: 'We ship to 100+ countries',
  },
  {
    icon: Package,
    title: 'Secure Packaging',
    description: 'Items carefully packed for safe delivery',
  },
  {
    icon: Clock,
    title: 'Fast Processing',
    description: 'Orders processed within 1-2 business days',
  },
]

export default function ShippingInfoPage() {
  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-blue-600 via-cyan-500 to-teal-500 text-white'>
        <div className='container mx-auto px-4 py-16'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <Truck className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>
              Shipping Information
            </h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto'>
              Fast, reliable shipping to your doorstep. Learn about our shipping
              options, delivery times, and policies.
            </p>
          </div>
        </div>
      </div>

      {/* Features Bar */}
      <div className='container mx-auto px-4 -mt-8'>
        <div className='grid md:grid-cols-4 gap-4 max-w-5xl mx-auto'>
          {shippingFeatures.map((feature) => (
            <div
              key={feature.title}
              className='bg-white rounded-xl p-4 shadow-lg flex items-center gap-3'
            >
              <div className='w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0'>
                <feature.icon className='w-5 h-5 text-blue-600' />
              </div>
              <div>
                <h3 className='font-semibold text-gray-900 text-sm'>
                  {feature.title}
                </h3>
                <p className='text-xs text-gray-500'>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className='container mx-auto px-4 py-16'>
        <div className='max-w-5xl mx-auto'>
          {/* Domestic Shipping */}
          <section className='mb-16'>
            <div className='flex items-center gap-3 mb-6'>
              <MapPin className='w-6 h-6 text-blue-600' />
              <h2 className='text-2xl font-bold text-gray-900'>
                Domestic Shipping
              </h2>
            </div>

            <div className='grid md:grid-cols-3 gap-6'>
              {shippingMethods.map((method) => (
                <div
                  key={method.name}
                  className={`bg-white rounded-2xl p-6 shadow-sm relative ${
                    method.popular ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {method.popular && (
                    <div className='absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full'>
                      Most Popular
                    </div>
                  )}
                  <div className='text-3xl mb-3'>{method.icon}</div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-1'>
                    {method.name}
                  </h3>
                  <div className='flex items-baseline gap-2 mb-2'>
                    <span className='text-2xl font-bold text-blue-600'>
                      {method.price}
                    </span>
                  </div>
                  <div className='flex items-center gap-2 text-sm text-gray-600 mb-3'>
                    <Clock className='w-4 h-4' />
                    {method.time}
                  </div>
                  <p className='text-sm text-gray-500 mb-4'>
                    {method.description}
                  </p>
                  <ul className='space-y-2'>
                    {method.features.map((feature) => (
                      <li
                        key={feature}
                        className='flex items-center gap-2 text-sm text-gray-600'
                      >
                        <CheckCircle className='w-4 h-4 text-green-500' />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* International Shipping */}
          <section className='mb-16'>
            <div className='flex items-center gap-3 mb-6'>
              <Globe className='w-6 h-6 text-blue-600' />
              <h2 className='text-2xl font-bold text-gray-900'>
                International Shipping
              </h2>
            </div>

            <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='bg-gray-50 border-b border-gray-200'>
                      <th className='text-left p-4 font-semibold text-gray-900'>
                        Zone
                      </th>
                      <th className='text-left p-4 font-semibold text-gray-900'>
                        Standard
                      </th>
                      <th className='text-left p-4 font-semibold text-gray-900'>
                        Express
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100'>
                    {internationalZones.map((zone) => (
                      <tr key={zone.zone} className='hover:bg-gray-50'>
                        <td className='p-4'>
                          <div className='font-medium text-gray-900'>
                            {zone.zone}
                          </div>
                          <div className='text-sm text-gray-500'>
                            {zone.countries}
                          </div>
                        </td>
                        <td className='p-4'>
                          <div className='font-medium text-gray-900'>
                            {zone.standardPrice}
                          </div>
                          <div className='text-sm text-gray-500'>
                            {zone.standardTime}
                          </div>
                        </td>
                        <td className='p-4'>
                          <div className='font-medium text-gray-900'>
                            {zone.expressPrice}
                          </div>
                          <div className='text-sm text-gray-500'>
                            {zone.expressTime}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className='p-4 bg-yellow-50 border-t border-yellow-100'>
                <div className='flex items-start gap-3'>
                  <AlertTriangle className='w-5 h-5 text-yellow-600 shrink-0 mt-0.5' />
                  <div className='text-sm text-yellow-800'>
                    <strong>Important:</strong> International orders may be
                    subject to customs duties and taxes, which are the
                    responsibility of the recipient. Delivery times are
                    estimates and may vary due to customs processing.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Order Processing */}
          <section className='mb-16'>
            <div className='bg-white rounded-2xl p-8 shadow-sm'>
              <div className='flex items-center gap-3 mb-6'>
                <Package className='w-6 h-6 text-blue-600' />
                <h2 className='text-2xl font-bold text-gray-900'>
                  Order Processing
                </h2>
              </div>

              <div className='grid md:grid-cols-2 gap-8'>
                <div>
                  <h3 className='font-semibold text-gray-900 mb-3'>
                    Processing Times
                  </h3>
                  <ul className='space-y-3 text-gray-600'>
                    <li className='flex items-start gap-3'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>
                        Orders placed before 2PM EST are processed the same
                        business day
                      </span>
                    </li>
                    <li className='flex items-start gap-3'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>
                        Orders placed after 2PM EST are processed the next
                        business day
                      </span>
                    </li>
                    <li className='flex items-start gap-3'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>
                        Processing may take 1-2 additional days during peak
                        seasons
                      </span>
                    </li>
                    <li className='flex items-start gap-3'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>
                        You'll receive a shipping confirmation email with
                        tracking info
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className='font-semibold text-gray-900 mb-3'>
                    Business Days
                  </h3>
                  <p className='text-gray-600 mb-4'>
                    Business days are Monday through Friday, excluding public
                    holidays. Orders placed on weekends or holidays will be
                    processed on the next business day.
                  </p>
                  <div className='bg-gray-50 rounded-xl p-4'>
                    <h4 className='font-medium text-gray-900 mb-2'>
                      Cut-off Times (EST)
                    </h4>
                    <div className='space-y-1 text-sm text-gray-600'>
                      <div className='flex justify-between'>
                        <span>Next Day Delivery</span>
                        <span className='font-medium'>2:00 PM</span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Express Shipping</span>
                        <span className='font-medium'>4:00 PM</span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Standard Shipping</span>
                        <span className='font-medium'>5:00 PM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Shipping Policies */}
          <section className='mb-16'>
            <div className='bg-white rounded-2xl p-8 shadow-sm'>
              <h2 className='text-2xl font-bold text-gray-900 mb-6'>
                Shipping Policies
              </h2>

              <div className='space-y-6'>
                <div>
                  <h3 className='font-semibold text-gray-900 mb-2'>
                    Delivery Attempts
                  </h3>
                  <p className='text-gray-600'>
                    Our carriers will make up to 3 delivery attempts. If
                    delivery is unsuccessful, the package will be held at the
                    nearest carrier facility for pickup. You'll receive
                    notifications via email and SMS about delivery status.
                  </p>
                </div>

                <div>
                  <h3 className='font-semibold text-gray-900 mb-2'>
                    Signature Requirements
                  </h3>
                  <p className='text-gray-600'>
                    Orders over €100 require a signature upon delivery for
                    security purposes. If you won't be available, you can
                    authorize a safe delivery location or arrange for pickup at
                    a carrier facility.
                  </p>
                </div>

                <div>
                  <h3 className='font-semibold text-gray-900 mb-2'>
                    Address Accuracy
                  </h3>
                  <p className='text-gray-600'>
                    Please ensure your shipping address is accurate and
                    complete. We are not responsible for delays or failed
                    deliveries due to incorrect addresses. Address changes may
                    be possible before shipping but cannot be guaranteed.
                  </p>
                </div>

                <div>
                  <h3 className='font-semibold text-gray-900 mb-2'>
                    PO Boxes & APO/FPO
                  </h3>
                  <p className='text-gray-600'>
                    We ship to PO Boxes and APO/FPO addresses via USPS. Note
                    that express shipping options may not be available for these
                    addresses, and delivery times may be longer.
                  </p>
                </div>

                <div>
                  <h3 className='font-semibold text-gray-900 mb-2'>
                    Lost or Damaged Packages
                  </h3>
                  <p className='text-gray-600'>
                    If your package is lost or arrives damaged, please contact
                    us within 48 hours of the expected delivery date. We'll work
                    with the carrier to locate your package or process a claim
                    for damaged items.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Shipping Calculator CTA */}
          <section className='mb-16'>
            <div className='bg-linear-to-br from-blue-600 to-cyan-600 rounded-2xl p-8 text-white text-center'>
              <Calculator className='w-12 h-12 mx-auto mb-4 opacity-80' />
              <h2 className='text-2xl font-bold mb-2'>
                Calculate Shipping Cost
              </h2>
              <p className='text-white/80 mb-6 max-w-md mx-auto'>
                Add items to your cart to see exact shipping costs for your
                location at checkout.
              </p>
              <Link
                to='/products'
                className='inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors'
              >
                Start Shopping
                <svg
                  className='w-4 h-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M17 8l4 4m0 0l-4 4m4-4H3'
                  />
                </svg>
              </Link>
            </div>
          </section>

          {/* FAQ Section */}
          <section>
            <div className='flex items-center gap-3 mb-6'>
              <HelpCircle className='w-6 h-6 text-blue-600' />
              <h2 className='text-2xl font-bold text-gray-900'>
                Common Questions
              </h2>
            </div>

            <div className='grid md:grid-cols-2 gap-4'>
              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Can I change my shipping address?
                </h3>
                <p className='text-sm text-gray-600'>
                  Yes, you can change your shipping address before the order
                  ships. Log into your account or contact support to make
                  changes.
                </p>
              </div>

              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Do you ship to all countries?
                </h3>
                <p className='text-sm text-gray-600'>
                  We ship to over 100 countries. Some restrictions may apply due
                  to carrier limitations or customs regulations.
                </p>
              </div>

              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Why is my tracking not updating?
                </h3>
                <p className='text-sm text-gray-600'>
                  Tracking may take 24-48 hours to update after shipping. Delays
                  can occur during busy periods or with international shipments.
                </p>
              </div>

              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Can I pick up my order locally?
                </h3>
                <p className='text-sm text-gray-600'>
                  We currently don't offer local pickup. All orders are shipped
                  directly to your provided address.
                </p>
              </div>
            </div>

            <div className='text-center mt-8'>
              <Link
                to='/faq'
                className='text-blue-600 font-medium hover:underline'
              >
                View All FAQs →
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Contact CTA */}
      <div className='bg-gray-100 py-12'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='text-xl font-bold text-gray-900 mb-2'>
            Need Help With Shipping?
          </h2>
          <p className='text-gray-600 mb-6'>
            Our support team is ready to assist you with any shipping questions.
          </p>
          <Link
            to='/contact'
            className='inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors'
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  )
}
