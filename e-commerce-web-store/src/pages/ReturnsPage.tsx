// ============================================
// Returns & Refunds Page - Production Ready
// ============================================

import { Link } from 'react-router-dom'
import {
  RotateCcw,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  Truck,
  HelpCircle,
  ArrowRight,
} from 'lucide-react'

const returnSteps = [
  {
    step: 1,
    title: 'Initiate Return',
    description:
      'Log into your account, go to Orders, and select the items you want to return',
    icon: '📝',
  },
  {
    step: 2,
    title: 'Print Label',
    description:
      'Download and print the prepaid return shipping label we provide',
    icon: '🏷️',
  },
  {
    step: 3,
    title: 'Pack Items',
    description:
      'Securely pack items in original packaging with all accessories',
    icon: '📦',
  },
  {
    step: 4,
    title: 'Ship Package',
    description: 'Drop off at any authorized carrier location',
    icon: '🚚',
  },
  {
    step: 5,
    title: 'Receive Refund',
    description:
      'Get your refund within 5-10 business days after we receive the return',
    icon: '💰',
  },
]

const returnableItems = [
  { item: 'Unopened products in original packaging', allowed: true },
  { item: 'Products with all tags and accessories', allowed: true },
  { item: 'Items within 30 days of delivery', allowed: true },
  { item: 'Defective or damaged items', allowed: true },
  { item: 'Wrong items received', allowed: true },
]

const nonReturnableItems = [
  { item: 'Personalized or customized products', allowed: false },
  { item: 'Items marked as "Final Sale"', allowed: false },
  { item: 'Opened electronics (unless defective)', allowed: false },
  { item: 'Products without original packaging', allowed: false },
  { item: 'Gift cards', allowed: false },
  { item: 'Downloaded software or digital products', allowed: false },
  { item: 'Items showing signs of use or wear', allowed: false },
]

const refundMethods = [
  {
    method: 'Original Payment',
    time: '5-10 business days',
    description: 'Refund to the original payment method used',
    icon: CreditCard,
  },
  {
    method: 'Store Credit',
    time: 'Instant',
    description: 'Receive store credit for future purchases (10% bonus)',
    icon: Package,
    bonus: true,
  },
  {
    method: 'Exchange',
    time: '3-5 business days',
    description: 'Swap for a different size, color, or product',
    icon: RotateCcw,
  },
]

export default function ReturnsPage() {
  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-teal-600 via-emerald-500 to-green-500 text-white'>
        <div className='container mx-auto px-4 py-16'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <RotateCcw className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>
              Returns & Refunds
            </h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto'>
              We want you to love your purchase. If you're not satisfied, we
              make returns easy with our hassle-free 30-day return policy.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className='container mx-auto px-4 -mt-8'>
        <div className='grid md:grid-cols-3 gap-4 max-w-4xl mx-auto'>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <div className='text-3xl font-bold text-teal-600'>30</div>
            <div className='text-gray-600'>Days Return Window</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <div className='text-3xl font-bold text-teal-600'>Free</div>
            <div className='text-gray-600'>Return Shipping*</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <div className='text-3xl font-bold text-teal-600'>5-10</div>
            <div className='text-gray-600'>Days for Refund</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='container mx-auto px-4 py-16'>
        <div className='max-w-5xl mx-auto'>
          {/* How to Return */}
          <section className='mb-16'>
            <h2 className='text-2xl font-bold text-gray-900 text-center mb-10'>
              How to Return an Item
            </h2>

            <div className='grid md:grid-cols-5 gap-4'>
              {returnSteps.map((step, index) => (
                <div key={step.step} className='relative'>
                  <div className='bg-white rounded-2xl p-5 shadow-sm text-center h-full'>
                    <div className='text-3xl mb-3'>{step.icon}</div>
                    <div className='w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2'>
                      <span className='text-sm font-bold text-teal-600'>
                        {step.step}
                      </span>
                    </div>
                    <h3 className='font-semibold text-gray-900 mb-1'>
                      {step.title}
                    </h3>
                    <p className='text-xs text-gray-500'>{step.description}</p>
                  </div>
                  {index < returnSteps.length - 1 && (
                    <div className='hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10'>
                      <ArrowRight className='w-4 h-4 text-gray-300' />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className='text-center mt-8'>
              <Link
                to='/orders'
                className='inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors'
              >
                Start a Return
                <ArrowRight className='w-4 h-4' />
              </Link>
            </div>
          </section>

          {/* What Can Be Returned */}
          <section className='mb-16'>
            <div className='grid md:grid-cols-2 gap-8'>
              {/* Returnable */}
              <div className='bg-white rounded-2xl p-6 shadow-sm'>
                <div className='flex items-center gap-3 mb-6'>
                  <div className='w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center'>
                    <CheckCircle className='w-5 h-5 text-green-600' />
                  </div>
                  <h3 className='text-xl font-bold text-gray-900'>
                    Eligible for Return
                  </h3>
                </div>
                <ul className='space-y-3'>
                  {returnableItems.map((item) => (
                    <li key={item.item} className='flex items-start gap-3'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span className='text-gray-600'>{item.item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Non-Returnable */}
              <div className='bg-white rounded-2xl p-6 shadow-sm'>
                <div className='flex items-center gap-3 mb-6'>
                  <div className='w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center'>
                    <XCircle className='w-5 h-5 text-red-600' />
                  </div>
                  <h3 className='text-xl font-bold text-gray-900'>
                    Not Eligible
                  </h3>
                </div>
                <ul className='space-y-3'>
                  {nonReturnableItems.map((item) => (
                    <li key={item.item} className='flex items-start gap-3'>
                      <XCircle className='w-5 h-5 text-red-400 shrink-0 mt-0.5' />
                      <span className='text-gray-600'>{item.item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Refund Options */}
          <section className='mb-16'>
            <h2 className='text-2xl font-bold text-gray-900 text-center mb-8'>
              Refund Options
            </h2>

            <div className='grid md:grid-cols-3 gap-6'>
              {refundMethods.map((method) => (
                <div
                  key={method.method}
                  className={`bg-white rounded-2xl p-6 shadow-sm relative ${
                    method.bonus ? 'ring-2 ring-teal-500' : ''
                  }`}
                >
                  {method.bonus && (
                    <div className='absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-teal-500 text-white text-xs font-semibold rounded-full'>
                      Best Value
                    </div>
                  )}
                  <div className='w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4'>
                    <method.icon className='w-6 h-6 text-gray-600' />
                  </div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-1'>
                    {method.method}
                  </h3>
                  <div className='flex items-center gap-2 mb-3'>
                    <Clock className='w-4 h-4 text-gray-400' />
                    <span className='text-sm text-gray-600'>{method.time}</span>
                  </div>
                  <p className='text-sm text-gray-500'>{method.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Return Shipping */}
          <section className='mb-16'>
            <div className='bg-white rounded-2xl p-8 shadow-sm'>
              <div className='flex items-center gap-3 mb-6'>
                <Truck className='w-6 h-6 text-teal-600' />
                <h2 className='text-2xl font-bold text-gray-900'>
                  Return Shipping
                </h2>
              </div>

              <div className='grid md:grid-cols-2 gap-8'>
                <div>
                  <h3 className='font-semibold text-gray-900 mb-3'>
                    Free Return Shipping
                  </h3>
                  <p className='text-gray-600 mb-4'>
                    We provide free return shipping for the following cases:
                  </p>
                  <ul className='space-y-2'>
                    <li className='flex items-start gap-2 text-gray-600'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>Defective or damaged products</span>
                    </li>
                    <li className='flex items-start gap-2 text-gray-600'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>Wrong item shipped</span>
                    </li>
                    <li className='flex items-start gap-2 text-gray-600'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>Quality issues</span>
                    </li>
                    <li className='flex items-start gap-2 text-gray-600'>
                      <CheckCircle className='w-5 h-5 text-green-500 shrink-0 mt-0.5' />
                      <span>Product not as described</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className='font-semibold text-gray-900 mb-3'>
                    Paid Return Shipping
                  </h3>
                  <p className='text-gray-600 mb-4'>
                    For change-of-mind returns (wrong size, changed preferences,
                    etc.):
                  </p>
                  <div className='bg-gray-50 rounded-xl p-4'>
                    <div className='flex justify-between items-center mb-2'>
                      <span className='text-gray-600'>Return shipping fee</span>
                      <span className='font-semibold text-gray-900'>€4.99</span>
                    </div>
                    <p className='text-sm text-gray-500'>
                      This flat fee is deducted from your refund. Alternatively,
                      you can use your own shipping method at your expense.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Refund Timeline */}
          <section className='mb-16'>
            <div className='bg-white rounded-2xl p-8 shadow-sm'>
              <div className='flex items-center gap-3 mb-6'>
                <Clock className='w-6 h-6 text-teal-600' />
                <h2 className='text-2xl font-bold text-gray-900'>
                  Refund Timeline
                </h2>
              </div>

              <div className='relative'>
                {/* Timeline */}
                <div className='absolute left-4 top-8 bottom-8 w-0.5 bg-gray-200' />

                <div className='space-y-8'>
                  <div className='flex gap-6'>
                    <div className='w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center shrink-0 z-10'>
                      <span className='text-sm font-bold text-teal-600'>1</span>
                    </div>
                    <div>
                      <h4 className='font-semibold text-gray-900'>
                        Return Initiated
                      </h4>
                      <p className='text-sm text-gray-600'>
                        You submit your return request online
                      </p>
                    </div>
                  </div>

                  <div className='flex gap-6'>
                    <div className='w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center shrink-0 z-10'>
                      <span className='text-sm font-bold text-teal-600'>2</span>
                    </div>
                    <div>
                      <h4 className='font-semibold text-gray-900'>
                        Package in Transit
                      </h4>
                      <p className='text-sm text-gray-600'>
                        3-7 business days depending on your location
                      </p>
                    </div>
                  </div>

                  <div className='flex gap-6'>
                    <div className='w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center shrink-0 z-10'>
                      <span className='text-sm font-bold text-teal-600'>3</span>
                    </div>
                    <div>
                      <h4 className='font-semibold text-gray-900'>
                        Return Received & Inspected
                      </h4>
                      <p className='text-sm text-gray-600'>
                        2-3 business days for quality inspection
                      </p>
                    </div>
                  </div>

                  <div className='flex gap-6'>
                    <div className='w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center shrink-0 z-10'>
                      <span className='text-sm font-bold text-teal-600'>4</span>
                    </div>
                    <div>
                      <h4 className='font-semibold text-gray-900'>
                        Refund Processed
                      </h4>
                      <p className='text-sm text-gray-600'>
                        Within 24 hours of approval
                      </p>
                    </div>
                  </div>

                  <div className='flex gap-6'>
                    <div className='w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0 z-10'>
                      <CheckCircle className='w-4 h-4 text-white' />
                    </div>
                    <div>
                      <h4 className='font-semibold text-gray-900'>
                        Refund Received
                      </h4>
                      <p className='text-sm text-gray-600'>
                        5-10 business days for funds to appear (depends on bank)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Important Notes */}
          <section className='mb-16'>
            <div className='bg-yellow-50 border border-yellow-200 rounded-2xl p-6'>
              <div className='flex items-start gap-4'>
                <AlertTriangle className='w-6 h-6 text-yellow-600 shrink-0' />
                <div>
                  <h3 className='font-semibold text-gray-900 mb-3'>
                    Important Information
                  </h3>
                  <ul className='space-y-2 text-sm text-gray-700'>
                    <li>
                      • Original shipping costs are non-refundable unless the
                      return is due to our error
                    </li>
                    <li>
                      • Items must be returned within 30 days of delivery date
                    </li>
                    <li>
                      • Please keep your return tracking number until the refund
                      is processed
                    </li>
                    <li>
                      • Refunds are always issued to the original payment method
                    </li>
                    <li>
                      • Partial refunds may apply if items show signs of use
                    </li>
                    <li>
                      • International returns may take additional time for
                      processing
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section>
            <div className='flex items-center gap-3 mb-6'>
              <HelpCircle className='w-6 h-6 text-teal-600' />
              <h2 className='text-2xl font-bold text-gray-900'>
                Common Questions
              </h2>
            </div>

            <div className='grid md:grid-cols-2 gap-4'>
              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Can I return an item without the original packaging?
                </h3>
                <p className='text-sm text-gray-600'>
                  We prefer items in original packaging, but we may accept
                  returns without it on a case-by-case basis. The refund amount
                  may be reduced.
                </p>
              </div>

              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  What if I received a defective item?
                </h3>
                <p className='text-sm text-gray-600'>
                  Contact us immediately! We'll send a prepaid return label and
                  either replace the item or issue a full refund, including
                  shipping costs.
                </p>
              </div>

              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  Can I exchange for a different product?
                </h3>
                <p className='text-sm text-gray-600'>
                  Yes! During the return process, select "Exchange" and choose
                  the new product. Price differences will be charged or refunded
                  accordingly.
                </p>
              </div>

              <div className='bg-white rounded-xl p-5 shadow-sm'>
                <h3 className='font-semibold text-gray-900 mb-2'>
                  My refund hasn't arrived yet. What should I do?
                </h3>
                <p className='text-sm text-gray-600'>
                  Please allow 5-10 business days for refunds to appear. If it's
                  been longer, contact your bank first, then reach out to our
                  support team.
                </p>
              </div>
            </div>

            <div className='text-center mt-8'>
              <Link
                to='/faq'
                className='text-teal-600 font-medium hover:underline'
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
            Need Help With a Return?
          </h2>
          <p className='text-gray-600 mb-6'>
            Our support team is here to make your return process smooth and
            easy.
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
