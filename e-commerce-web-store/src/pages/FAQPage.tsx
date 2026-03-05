// ============================================
// FAQ Page - Production Ready
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HelpCircle,
  ChevronDown,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  User,
  Shield,
  Search,
  MessageSquare,
} from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  id: string
  title: string
  icon: React.ElementType
  faqs: FAQItem[]
}

const faqCategories: FAQCategory[] = [
  {
    id: 'orders',
    title: 'Orders & Purchases',
    icon: Package,
    faqs: [
      {
        question: 'How do I place an order?',
        answer:
          "Placing an order is easy! Simply browse our products, add items to your cart, and proceed to checkout. You'll need to provide your shipping address and payment information. Once your order is confirmed, you'll receive an email confirmation with your order details.",
      },
      {
        question: 'Can I modify or cancel my order after placing it?',
        answer:
          'You can modify or cancel your order within 1 hour of placing it, as long as it hasn\'t been processed yet. To do this, go to your account dashboard, find the order, and click "Modify" or "Cancel". If the option isn\'t available, please contact our support team immediately.',
      },
      {
        question: 'How do I track my order?',
        answer:
          'Once your order ships, you\'ll receive an email with a tracking number and link. You can also track your order by logging into your account and visiting the "Orders" section, or by using our Track Order page with your order number and email.',
      },
      {
        question: 'What happens if an item is out of stock?',
        answer:
          "If an item becomes unavailable after you've placed your order, we'll notify you immediately and offer alternatives: wait for restock (with estimated date), choose a similar product, or receive a full refund for that item.",
      },
      {
        question: 'Can I order as a guest without creating an account?',
        answer:
          'Yes! You can checkout as a guest. However, creating an account gives you benefits like order tracking, faster checkout, order history, wishlist, and exclusive member discounts.',
      },
    ],
  },
  {
    id: 'payment',
    title: 'Payment & Billing',
    icon: CreditCard,
    faqs: [
      {
        question: 'What payment methods do you accept?',
        answer:
          'We accept all major credit/debit cards (Visa, Mastercard, American Express, Discover), PayPal, Apple Pay, Google Pay, and bank transfers in select regions. All payments are processed securely.',
      },
      {
        question: 'Is my payment information secure?',
        answer:
          "Absolutely! We use industry-standard SSL encryption and are PCI-DSS compliant. Your payment information is never stored on our servers - it's processed directly by our secure payment partners.",
      },
      {
        question: 'When will I be charged for my order?',
        answer:
          "Your payment method is charged when you place your order. For pre-orders, you'll be charged when the item ships. If there's an issue with your order, any applicable refunds will be processed to your original payment method.",
      },
      {
        question: 'Can I use multiple payment methods for one order?',
        answer:
          'Currently, we support one payment method per order. However, you can combine a gift card with another payment method - the gift card balance will be applied first, and the remaining amount charged to your selected payment method.',
      },
      {
        question: 'How do I get an invoice for my order?',
        answer:
          'Invoices are automatically sent to your email after purchase. You can also download invoices from your account dashboard under "Order History". For business accounts or custom invoice requests, contact our billing department.',
      },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping & Delivery',
    icon: Truck,
    faqs: [
      {
        question: 'What are your shipping options and costs?',
        answer:
          'We offer Standard Shipping (5-7 business days, free over €50), Express Shipping (2-3 business days, €9.99), and Next Day Delivery (1 business day, €14.99). International shipping rates vary by destination.',
      },
      {
        question: 'Do you ship internationally?',
        answer:
          'Yes! We ship to over 100 countries worldwide. International shipping times typically range from 7-21 business days depending on the destination. Additional customs fees may apply and are the responsibility of the recipient.',
      },
      {
        question: 'How long will it take to receive my order?',
        answer:
          'Processing takes 1-2 business days. After that, delivery time depends on your chosen shipping method and location. Standard domestic shipping is 5-7 business days, Express is 2-3 days, and Next Day is the following business day.',
      },
      {
        question: 'Can I change my shipping address after ordering?',
        answer:
          'Yes, but only before the order ships. Log into your account, go to your order, and click "Edit Shipping Address". If the order has already shipped, you may need to contact the carrier directly or wait to receive and return the package.',
      },
      {
        question: 'What happens if my package is lost or damaged?',
        answer:
          "If your package is lost or arrives damaged, contact us immediately with your order number and photos of any damage. We'll work with the carrier to resolve the issue and either send a replacement or issue a full refund.",
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns & Refunds',
    icon: RotateCcw,
    faqs: [
      {
        question: 'What is your return policy?',
        answer:
          'We offer a 30-day return policy on most items. Products must be unused, in original packaging, with all tags attached. Some items like personalized products, opened electronics, and final sale items cannot be returned.',
      },
      {
        question: 'How do I start a return?',
        answer:
          'Log into your account, go to "Orders", select the order, and click "Return Items". Choose the items to return, select a reason, and we\'ll email you a prepaid return label. Pack the items securely and drop off at the specified carrier.',
      },
      {
        question: 'How long do refunds take to process?',
        answer:
          'Once we receive your return, we inspect items within 2-3 business days. Approved refunds are processed within 24 hours, but may take 5-10 business days to appear on your statement depending on your bank.',
      },
      {
        question: 'Can I exchange an item instead of returning it?',
        answer:
          'Yes! During the return process, you can select "Exchange" instead of "Refund". Choose the new size/color/variant you want. If there\'s a price difference, we\'ll charge or refund the difference accordingly.',
      },
      {
        question: 'Who pays for return shipping?',
        answer:
          'Return shipping is free for defective items, wrong items sent, or quality issues. For change-of-mind returns, a flat fee of €4.99 is deducted from your refund, or you can use your own shipping method.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Profile',
    icon: User,
    faqs: [
      {
        question: 'How do I create an account?',
        answer:
          'Click "Sign Up" in the header, enter your email and create a password. You can also sign up using Google, Facebook, or Apple for faster registration. Verify your email to activate your account.',
      },
      {
        question: 'I forgot my password. How do I reset it?',
        answer:
          'Click "Login", then "Forgot Password". Enter your email address and we\'ll send you a password reset link. The link expires in 24 hours. If you don\'t receive the email, check your spam folder.',
      },
      {
        question: 'How do I update my account information?',
        answer:
          'Log into your account and go to "Profile" or "Settings". You can update your name, email, phone number, password, and communication preferences. Some changes may require email verification.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'Go to Settings > Privacy > "Delete Account". Note that this action is permanent and will delete all your order history, saved addresses, and preferences. Active orders must be completed first.',
      },
      {
        question: 'Can I have multiple addresses saved?',
        answer:
          'Yes! You can save multiple shipping and billing addresses in your account. Go to "Addresses" in your profile to add, edit, or remove addresses. You can also set a default address for faster checkout.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    icon: Shield,
    faqs: [
      {
        question: 'How do you protect my personal information?',
        answer:
          'We use industry-standard encryption (SSL/TLS), secure data centers, and strict access controls. We never sell your personal information. Read our Privacy Policy for complete details on how we collect, use, and protect your data.',
      },
      {
        question: 'Do you share my information with third parties?',
        answer:
          'We only share information necessary to process your orders (payment processors, shipping carriers). We never sell your data to marketers. You can opt out of marketing communications at any time.',
      },
      {
        question: 'How do I opt out of marketing emails?',
        answer:
          'Click "Unsubscribe" at the bottom of any marketing email, or go to Account Settings > Communication Preferences. Note that you\'ll still receive transactional emails about your orders.',
      },
      {
        question: 'Is your website safe to browse?',
        answer:
          "Yes! Our website uses HTTPS encryption, is regularly scanned for vulnerabilities, and we follow security best practices. Look for the padlock icon in your browser's address bar.",
      },
      {
        question: 'What data do you collect about me?',
        answer:
          'We collect information you provide (name, email, addresses), transaction data (orders, payments), and usage data (browsing behavior, device info). This helps us improve your experience and provide better service.',
      },
    ],
  },
]

function FAQAccordion({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className='border border-gray-200 rounded-xl overflow-hidden'>
      <button
        onClick={onToggle}
        className='w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors'
      >
        <span className='font-medium text-gray-900 pr-4'>{faq.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className='px-4 pb-4'>
          <p className='text-gray-600 leading-relaxed'>{faq.answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('orders')
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const toggleFAQ = (categoryId: string, index: number) => {
    const key = `${categoryId}-${index}`
    setOpenFAQs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const filteredCategories = faqCategories
    .map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => category.faqs.length > 0)

  const currentCategory = faqCategories.find((c) => c.id === activeCategory)

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-blue-600 via-indigo-600 to-purple-600 text-white'>
        <div className='container mx-auto px-4 py-16'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <HelpCircle className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>
              Frequently Asked Questions
            </h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto mb-8'>
              Find quick answers to common questions about orders, shipping,
              returns, and more.
            </p>

            {/* Search Box */}
            <div className='max-w-xl mx-auto relative'>
              <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search for answers...'
                className='w-full pl-12 pr-4 py-4 bg-white text-gray-900 rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50'
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='container mx-auto px-4 py-12'>
        <div className='max-w-6xl mx-auto'>
          {searchQuery ? (
            // Search Results
            <div className='space-y-8'>
              <div className='flex items-center justify-between'>
                <h2 className='text-xl font-semibold text-gray-900'>
                  Search Results for "{searchQuery}"
                </h2>
                <button
                  onClick={() => setSearchQuery('')}
                  className='text-sm text-orange-600 hover:underline'
                >
                  Clear Search
                </button>
              </div>

              {filteredCategories.length > 0 ? (
                filteredCategories.map((category) => (
                  <div
                    key={category.id}
                    className='bg-white rounded-2xl p-6 shadow-sm'
                  >
                    <div className='flex items-center gap-3 mb-4'>
                      <div className='w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center'>
                        <category.icon className='w-5 h-5 text-gray-600' />
                      </div>
                      <h3 className='text-lg font-semibold text-gray-900'>
                        {category.title}
                      </h3>
                    </div>
                    <div className='space-y-3'>
                      {category.faqs.map((faq, index) => (
                        <FAQAccordion
                          key={index}
                          faq={faq}
                          isOpen={openFAQs.has(`${category.id}-${index}`)}
                          onToggle={() => toggleFAQ(category.id, index)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className='text-center py-12 bg-white rounded-2xl shadow-sm'>
                  <HelpCircle className='w-12 h-12 text-gray-300 mx-auto mb-4' />
                  <h3 className='text-lg font-semibold text-gray-900 mb-2'>
                    No Results Found
                  </h3>
                  <p className='text-gray-600 mb-6'>
                    We couldn't find any FAQs matching your search. Try
                    different keywords or browse by category.
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className='text-orange-600 font-medium hover:underline'
                  >
                    Browse All FAQs
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Category View
            <div className='grid lg:grid-cols-4 gap-8'>
              {/* Category Sidebar */}
              <div className='lg:col-span-1'>
                <div className='bg-white rounded-2xl p-4 shadow-sm sticky top-4'>
                  <h3 className='font-semibold text-gray-900 mb-4 px-2'>
                    Categories
                  </h3>
                  <nav className='space-y-1'>
                    {faqCategories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          activeCategory === category.id
                            ? 'bg-orange-50 text-orange-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <category.icon className='w-5 h-5' />
                        <span className='font-medium'>{category.title}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* FAQ Content */}
              <div className='lg:col-span-3'>
                {currentCategory && (
                  <div className='bg-white rounded-2xl p-6 shadow-sm'>
                    <div className='flex items-center gap-4 mb-6'>
                      <div className='w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center'>
                        <currentCategory.icon className='w-6 h-6 text-orange-600' />
                      </div>
                      <h2 className='text-2xl font-bold text-gray-900'>
                        {currentCategory.title}
                      </h2>
                    </div>

                    <div className='space-y-3'>
                      {currentCategory.faqs.map((faq, index) => (
                        <FAQAccordion
                          key={index}
                          faq={faq}
                          isOpen={openFAQs.has(
                            `${currentCategory.id}-${index}`,
                          )}
                          onToggle={() => toggleFAQ(currentCategory.id, index)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Still Need Help */}
      <div className='bg-gray-100 py-16'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto text-center'>
            <MessageSquare className='w-12 h-12 text-gray-400 mx-auto mb-4' />
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>
              Still Have Questions?
            </h2>
            <p className='text-gray-600 mb-8 max-w-xl mx-auto'>
              Can't find the answer you're looking for? Our friendly support
              team is here to help you.
            </p>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <Link
                to='/contact'
                className='inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors'
              >
                Contact Support
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
              <a
                href='mailto:support@techtools.com'
                className='inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors'
              >
                Email Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
