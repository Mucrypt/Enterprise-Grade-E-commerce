// ============================================
// Privacy Policy Page - Production Ready
// ============================================

import { Link } from 'react-router-dom'
import {
  Shield,
  Lock,
  Eye,
  Database,
  Mail,
  Globe,
  UserCheck,
  FileText,
} from 'lucide-react'

const sections = [
  {
    id: 'information-collection',
    title: 'Information We Collect',
    icon: Database,
  },
  {
    id: 'use-of-information',
    title: 'How We Use Your Information',
    icon: Eye,
  },
  {
    id: 'data-sharing',
    title: 'Data Sharing & Disclosure',
    icon: Globe,
  },
  {
    id: 'data-security',
    title: 'Data Security',
    icon: Lock,
  },
  {
    id: 'your-rights',
    title: 'Your Privacy Rights',
    icon: UserCheck,
  },
  {
    id: 'cookies',
    title: 'Cookies & Tracking',
    icon: FileText,
  },
  {
    id: 'contact',
    title: 'Contact Us',
    icon: Mail,
  },
]

export default function PrivacyPolicyPage() {
  const lastUpdated = 'March 1, 2026'
  const effectiveDate = 'March 1, 2026'

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 text-white'>
        <div className='container mx-auto px-4 py-16'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <Shield className='w-8 h-8 text-orange-500' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>
              Privacy Policy
            </h1>
            <p className='text-gray-400 text-lg max-w-2xl mx-auto'>
              Your privacy is important to us. This policy explains how
              TechTools collects, uses, and protects your personal information.
            </p>
            <div className='mt-6 flex items-center justify-center gap-6 text-sm text-gray-400'>
              <span>Last Updated: {lastUpdated}</span>
              <span className='w-1 h-1 bg-gray-600 rounded-full' />
              <span>Effective: {effectiveDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className='sticky top-0 bg-white border-b border-gray-200 z-10 shadow-sm'>
        <div className='container mx-auto px-4'>
          <div className='flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide'>
            <span className='text-sm text-gray-500 shrink-0'>Jump to:</span>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className='px-3 py-1.5 text-sm bg-gray-100 hover:bg-orange-100 hover:text-orange-600 rounded-full transition-colors shrink-0'
              >
                {section.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='container mx-auto px-4 py-12'>
        <div className='max-w-4xl mx-auto'>
          {/* Introduction */}
          <div className='bg-white rounded-2xl p-8 shadow-sm mb-8'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>
              Introduction
            </h2>
            <div className='prose prose-gray max-w-none'>
              <p className='text-gray-600 leading-relaxed'>
                Welcome to TechTools ("we," "our," or "us"). We are committed to
                protecting your personal information and your right to privacy.
                This Privacy Policy describes how we collect, use, store, and
                share your information when you use our website, mobile
                application, and services (collectively, the "Services").
              </p>
              <p className='text-gray-600 leading-relaxed mt-4'>
                By using our Services, you agree to the collection and use of
                information in accordance with this policy. If you do not agree
                with our policies and practices, please do not use our Services.
              </p>
            </div>
          </div>

          {/* Section 1: Information Collection */}
          <section
            id='information-collection'
            className='bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20'
          >
            <div className='flex items-center gap-4 mb-6'>
              <div className='w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center'>
                <Database className='w-6 h-6 text-orange-600' />
              </div>
              <h2 className='text-2xl font-bold text-gray-900'>
                1. Information We Collect
              </h2>
            </div>

            <div className='space-y-6'>
              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  Personal Information You Provide
                </h3>
                <p className='text-gray-600 mb-3'>
                  When you use our Services, you may provide us with:
                </p>
                <ul className='list-disc list-inside text-gray-600 space-y-2 ml-4'>
                  <li>
                    <strong>Account Information:</strong> Name, email address,
                    phone number, password, and profile picture
                  </li>
                  <li>
                    <strong>Payment Information:</strong> Credit/debit card
                    details, billing address, and payment history
                  </li>
                  <li>
                    <strong>Shipping Information:</strong> Delivery addresses,
                    contact details for delivery
                  </li>
                  <li>
                    <strong>Communications:</strong> Messages, reviews,
                    feedback, and customer support inquiries
                  </li>
                  <li>
                    <strong>Preferences:</strong> Product preferences, wishlist
                    items, and notification settings
                  </li>
                </ul>
              </div>

              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  Information Collected Automatically
                </h3>
                <p className='text-gray-600 mb-3'>
                  When you access our Services, we automatically collect:
                </p>
                <ul className='list-disc list-inside text-gray-600 space-y-2 ml-4'>
                  <li>
                    <strong>Device Information:</strong> Device type, operating
                    system, unique device identifiers, browser type
                  </li>
                  <li>
                    <strong>Usage Data:</strong> Pages viewed, time spent, click
                    patterns, search queries
                  </li>
                  <li>
                    <strong>Location Data:</strong> IP address, approximate
                    geographic location
                  </li>
                  <li>
                    <strong>Cookies & Tracking:</strong> Session cookies,
                    persistent cookies, pixel tags, and similar technologies
                  </li>
                </ul>
              </div>

              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  Information from Third Parties
                </h3>
                <p className='text-gray-600 mb-3'>
                  We may receive information from:
                </p>
                <ul className='list-disc list-inside text-gray-600 space-y-2 ml-4'>
                  <li>
                    <strong>Social Media:</strong> If you connect through social
                    accounts (Google, Facebook, Apple)
                  </li>
                  <li>
                    <strong>Payment Processors:</strong> Transaction
                    confirmations and fraud prevention data
                  </li>
                  <li>
                    <strong>Analytics Partners:</strong> Aggregated usage and
                    demographic data
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Use of Information */}
          <section
            id='use-of-information'
            className='bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20'
          >
            <div className='flex items-center gap-4 mb-6'>
              <div className='w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center'>
                <Eye className='w-6 h-6 text-blue-600' />
              </div>
              <h2 className='text-2xl font-bold text-gray-900'>
                2. How We Use Your Information
              </h2>
            </div>

            <div className='space-y-4'>
              <p className='text-gray-600'>
                We use the information we collect to:
              </p>

              <div className='grid md:grid-cols-2 gap-4'>
                <div className='bg-gray-50 rounded-xl p-4'>
                  <h4 className='font-semibold text-gray-900 mb-2'>
                    Provide Services
                  </h4>
                  <ul className='text-sm text-gray-600 space-y-1'>
                    <li>• Process orders and payments</li>
                    <li>• Deliver products to you</li>
                    <li>• Manage your account</li>
                    <li>• Provide customer support</li>
                  </ul>
                </div>

                <div className='bg-gray-50 rounded-xl p-4'>
                  <h4 className='font-semibold text-gray-900 mb-2'>
                    Improve Experience
                  </h4>
                  <ul className='text-sm text-gray-600 space-y-1'>
                    <li>• Personalize recommendations</li>
                    <li>• Analyze usage patterns</li>
                    <li>• Develop new features</li>
                    <li>• Conduct research</li>
                  </ul>
                </div>

                <div className='bg-gray-50 rounded-xl p-4'>
                  <h4 className='font-semibold text-gray-900 mb-2'>
                    Communications
                  </h4>
                  <ul className='text-sm text-gray-600 space-y-1'>
                    <li>• Send order updates</li>
                    <li>• Notify about promotions</li>
                    <li>• Respond to inquiries</li>
                    <li>• Send newsletters (opt-in)</li>
                  </ul>
                </div>

                <div className='bg-gray-50 rounded-xl p-4'>
                  <h4 className='font-semibold text-gray-900 mb-2'>
                    Security & Legal
                  </h4>
                  <ul className='text-sm text-gray-600 space-y-1'>
                    <li>• Prevent fraud</li>
                    <li>• Enforce terms of service</li>
                    <li>• Comply with laws</li>
                    <li>• Protect rights</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Data Sharing */}
          <section
            id='data-sharing'
            className='bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20'
          >
            <div className='flex items-center gap-4 mb-6'>
              <div className='w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center'>
                <Globe className='w-6 h-6 text-purple-600' />
              </div>
              <h2 className='text-2xl font-bold text-gray-900'>
                3. Data Sharing & Disclosure
              </h2>
            </div>

            <div className='space-y-6'>
              <p className='text-gray-600'>
                We do not sell your personal information. We may share your
                information in the following circumstances:
              </p>

              <div className='space-y-4'>
                <div className='border-l-4 border-orange-500 pl-4'>
                  <h4 className='font-semibold text-gray-900'>
                    Service Providers
                  </h4>
                  <p className='text-gray-600 text-sm mt-1'>
                    We share data with third-party vendors who help us operate
                    our business (payment processors, shipping carriers, cloud
                    hosting, analytics providers). These providers are
                    contractually bound to protect your data.
                  </p>
                </div>

                <div className='border-l-4 border-blue-500 pl-4'>
                  <h4 className='font-semibold text-gray-900'>
                    Business Transfers
                  </h4>
                  <p className='text-gray-600 text-sm mt-1'>
                    If we are involved in a merger, acquisition, or sale of
                    assets, your information may be transferred as part of that
                    transaction.
                  </p>
                </div>

                <div className='border-l-4 border-red-500 pl-4'>
                  <h4 className='font-semibold text-gray-900'>
                    Legal Requirements
                  </h4>
                  <p className='text-gray-600 text-sm mt-1'>
                    We may disclose information if required by law, court order,
                    or government request, or to protect the rights, property,
                    or safety of TechTools, our users, or others.
                  </p>
                </div>

                <div className='border-l-4 border-green-500 pl-4'>
                  <h4 className='font-semibold text-gray-900'>
                    With Your Consent
                  </h4>
                  <p className='text-gray-600 text-sm mt-1'>
                    We may share your information for other purposes with your
                    explicit consent.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Data Security */}
          <section
            id='data-security'
            className='bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20'
          >
            <div className='flex items-center gap-4 mb-6'>
              <div className='w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center'>
                <Lock className='w-6 h-6 text-green-600' />
              </div>
              <h2 className='text-2xl font-bold text-gray-900'>
                4. Data Security
              </h2>
            </div>

            <div className='space-y-4'>
              <p className='text-gray-600'>
                We implement robust security measures to protect your personal
                information:
              </p>

              <div className='grid md:grid-cols-2 gap-4'>
                <div className='flex items-start gap-3 p-4 bg-gray-50 rounded-xl'>
                  <div className='w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shrink-0'>
                    <svg
                      className='w-4 h-4 text-white'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      SSL/TLS Encryption
                    </h4>
                    <p className='text-sm text-gray-600'>
                      All data transmitted is encrypted using industry-standard
                      protocols
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-gray-50 rounded-xl'>
                  <div className='w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shrink-0'>
                    <svg
                      className='w-4 h-4 text-white'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      PCI-DSS Compliance
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Payment processing meets highest security standards
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-gray-50 rounded-xl'>
                  <div className='w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shrink-0'>
                    <svg
                      className='w-4 h-4 text-white'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Access Controls
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Strict employee access limitations and authentication
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-gray-50 rounded-xl'>
                  <div className='w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shrink-0'>
                    <svg
                      className='w-4 h-4 text-white'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Regular Audits
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Ongoing security assessments and vulnerability testing
                    </p>
                  </div>
                </div>
              </div>

              <div className='bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4'>
                <p className='text-sm text-yellow-800'>
                  <strong>Important:</strong> While we strive to protect your
                  data, no method of transmission over the Internet or
                  electronic storage is 100% secure. We cannot guarantee
                  absolute security.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Your Rights */}
          <section
            id='your-rights'
            className='bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20'
          >
            <div className='flex items-center gap-4 mb-6'>
              <div className='w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center'>
                <UserCheck className='w-6 h-6 text-indigo-600' />
              </div>
              <h2 className='text-2xl font-bold text-gray-900'>
                5. Your Privacy Rights
              </h2>
            </div>

            <div className='space-y-6'>
              <p className='text-gray-600'>
                Depending on your location, you may have the following rights
                regarding your personal data:
              </p>

              <div className='space-y-3'>
                <div className='flex items-start gap-3 p-4 bg-indigo-50 rounded-xl'>
                  <span className='text-xl'>📋</span>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Right to Access
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Request a copy of the personal data we hold about you
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-indigo-50 rounded-xl'>
                  <span className='text-xl'>✏️</span>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Right to Rectification
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Request correction of inaccurate or incomplete data
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-indigo-50 rounded-xl'>
                  <span className='text-xl'>🗑️</span>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Right to Erasure
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Request deletion of your personal data ("right to be
                      forgotten")
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-indigo-50 rounded-xl'>
                  <span className='text-xl'>⏸️</span>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Right to Restrict Processing
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Request limitation on how we use your data
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-indigo-50 rounded-xl'>
                  <span className='text-xl'>📦</span>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Right to Data Portability
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Receive your data in a structured, machine-readable format
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-indigo-50 rounded-xl'>
                  <span className='text-xl'>🚫</span>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Right to Object
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Object to processing of your data for certain purposes
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 p-4 bg-indigo-50 rounded-xl'>
                  <span className='text-xl'>🔄</span>
                  <div>
                    <h4 className='font-semibold text-gray-900'>
                      Right to Withdraw Consent
                    </h4>
                    <p className='text-sm text-gray-600'>
                      Withdraw previously given consent at any time
                    </p>
                  </div>
                </div>
              </div>

              <div className='bg-gray-100 rounded-xl p-4'>
                <p className='text-sm text-gray-700'>
                  To exercise any of these rights, please contact us at{' '}
                  <a
                    href='mailto:privacy@techtools.com'
                    className='text-orange-600 hover:underline'
                  >
                    privacy@techtools.com
                  </a>
                  . We will respond to your request within 30 days.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Cookies */}
          <section
            id='cookies'
            className='bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20'
          >
            <div className='flex items-center gap-4 mb-6'>
              <div className='w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center'>
                <FileText className='w-6 h-6 text-amber-600' />
              </div>
              <h2 className='text-2xl font-bold text-gray-900'>
                6. Cookies & Tracking Technologies
              </h2>
            </div>

            <div className='space-y-6'>
              <p className='text-gray-600'>
                We use cookies and similar tracking technologies to enhance your
                experience. Here's what you need to know:
              </p>

              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-gray-100'>
                      <th className='text-left p-3 rounded-tl-lg font-semibold'>
                        Cookie Type
                      </th>
                      <th className='text-left p-3 font-semibold'>Purpose</th>
                      <th className='text-left p-3 rounded-tr-lg font-semibold'>
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100'>
                    <tr>
                      <td className='p-3 font-medium'>Essential</td>
                      <td className='p-3 text-gray-600'>
                        Required for site functionality (cart, login)
                      </td>
                      <td className='p-3 text-gray-600'>Session</td>
                    </tr>
                    <tr>
                      <td className='p-3 font-medium'>Analytics</td>
                      <td className='p-3 text-gray-600'>
                        Understand how visitors use our site
                      </td>
                      <td className='p-3 text-gray-600'>2 years</td>
                    </tr>
                    <tr>
                      <td className='p-3 font-medium'>Functional</td>
                      <td className='p-3 text-gray-600'>
                        Remember preferences (language, region)
                      </td>
                      <td className='p-3 text-gray-600'>1 year</td>
                    </tr>
                    <tr>
                      <td className='p-3 font-medium'>Marketing</td>
                      <td className='p-3 text-gray-600'>
                        Deliver relevant advertisements
                      </td>
                      <td className='p-3 text-gray-600'>90 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className='text-gray-600'>
                You can manage cookie preferences through your browser settings.
                Note that disabling certain cookies may affect site
                functionality.
              </p>

              <Link
                to='/cookies'
                className='inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium'
              >
                View our full Cookie Policy
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
                    d='M9 5l7 7-7 7'
                  />
                </svg>
              </Link>
            </div>
          </section>

          {/* Section 7: Contact */}
          <section
            id='contact'
            className='bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20'
          >
            <div className='flex items-center gap-4 mb-6'>
              <div className='w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center'>
                <Mail className='w-6 h-6 text-red-600' />
              </div>
              <h2 className='text-2xl font-bold text-gray-900'>
                7. Contact Us
              </h2>
            </div>

            <div className='space-y-6'>
              <p className='text-gray-600'>
                If you have any questions about this Privacy Policy or our data
                practices, please contact us:
              </p>

              <div className='grid md:grid-cols-2 gap-4'>
                <div className='bg-gray-50 rounded-xl p-6'>
                  <h4 className='font-semibold text-gray-900 mb-3'>
                    Privacy Inquiries
                  </h4>
                  <div className='space-y-2 text-sm text-gray-600'>
                    <p>
                      <strong>Email:</strong>{' '}
                      <a
                        href='mailto:privacy@techtools.com'
                        className='text-orange-600 hover:underline'
                      >
                        privacy@techtools.com
                      </a>
                    </p>
                    <p>
                      <strong>Subject:</strong> Privacy Policy Inquiry
                    </p>
                  </div>
                </div>

                <div className='bg-gray-50 rounded-xl p-6'>
                  <h4 className='font-semibold text-gray-900 mb-3'>
                    General Support
                  </h4>
                  <div className='space-y-2 text-sm text-gray-600'>
                    <p>
                      <strong>Email:</strong>{' '}
                      <a
                        href='mailto:support@techtools.com'
                        className='text-orange-600 hover:underline'
                      >
                        support@techtools.com
                      </a>
                    </p>
                    <p>
                      <strong>Phone:</strong> +1 (234) 567-890
                    </p>
                  </div>
                </div>
              </div>

              <div className='bg-gray-50 rounded-xl p-6'>
                <h4 className='font-semibold text-gray-900 mb-3'>
                  Mailing Address
                </h4>
                <p className='text-gray-600'>
                  TechTools Inc.
                  <br />
                  Attn: Privacy Team
                  <br />
                  123 Tech Street
                  <br />
                  San Francisco, CA 94102
                  <br />
                  United States
                </p>
              </div>
            </div>
          </section>

          {/* Additional Sections */}
          <section className='bg-white rounded-2xl p-8 shadow-sm mb-8'>
            <h2 className='text-2xl font-bold text-gray-900 mb-6'>
              8. Additional Information
            </h2>

            <div className='space-y-6'>
              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  Children's Privacy
                </h3>
                <p className='text-gray-600'>
                  Our Services are not intended for children under 16 years of
                  age. We do not knowingly collect personal information from
                  children under 16. If you believe we have collected
                  information from a child under 16, please contact us
                  immediately.
                </p>
              </div>

              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  International Data Transfers
                </h3>
                <p className='text-gray-600'>
                  Your information may be transferred to and processed in
                  countries other than your own. We ensure appropriate
                  safeguards are in place to protect your data in accordance
                  with this Privacy Policy and applicable laws.
                </p>
              </div>

              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  Data Retention
                </h3>
                <p className='text-gray-600'>
                  We retain your personal information for as long as necessary
                  to fulfill the purposes outlined in this Privacy Policy,
                  unless a longer retention period is required by law. When data
                  is no longer needed, we securely delete or anonymize it.
                </p>
              </div>

              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  Changes to This Policy
                </h3>
                <p className='text-gray-600'>
                  We may update this Privacy Policy from time to time. We will
                  notify you of any material changes by posting the new Privacy
                  Policy on this page and updating the "Last Updated" date. We
                  encourage you to review this Privacy Policy periodically.
                </p>
              </div>
            </div>
          </section>

          {/* GDPR & CCPA Compliance */}
          <section className='bg-linear-to-br from-orange-50 to-amber-50 rounded-2xl p-8 shadow-sm mb-8'>
            <h2 className='text-2xl font-bold text-gray-900 mb-6'>
              Regional Privacy Rights
            </h2>

            <div className='grid md:grid-cols-2 gap-6'>
              <div className='bg-white rounded-xl p-6'>
                <div className='flex items-center gap-2 mb-4'>
                  <span className='text-2xl'>🇪🇺</span>
                  <h3 className='text-lg font-semibold text-gray-900'>
                    European Union (GDPR)
                  </h3>
                </div>
                <p className='text-sm text-gray-600 mb-3'>
                  If you are located in the European Economic Area, you have
                  additional rights under the General Data Protection Regulation
                  (GDPR), including:
                </p>
                <ul className='text-sm text-gray-600 space-y-1'>
                  <li>
                    • Right to lodge a complaint with a supervisory authority
                  </li>
                  <li>
                    • Right to receive information about automated
                    decision-making
                  </li>
                  <li>• Enhanced data portability rights</li>
                </ul>
              </div>

              <div className='bg-white rounded-xl p-6'>
                <div className='flex items-center gap-2 mb-4'>
                  <span className='text-2xl'>🇺🇸</span>
                  <h3 className='text-lg font-semibold text-gray-900'>
                    California (CCPA/CPRA)
                  </h3>
                </div>
                <p className='text-sm text-gray-600 mb-3'>
                  If you are a California resident, you have additional rights
                  under the California Consumer Privacy Act (CCPA) and
                  California Privacy Rights Act (CPRA):
                </p>
                <ul className='text-sm text-gray-600 space-y-1'>
                  <li>
                    • Right to know what personal information is collected
                  </li>
                  <li>• Right to opt-out of sale of personal information</li>
                  <li>• Right to non-discrimination for exercising rights</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <div className='text-center py-8'>
            <p className='text-gray-600 mb-4'>
              Have questions about our privacy practices?
            </p>
            <Link
              to='/contact'
              className='inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors'
            >
              Contact Our Privacy Team
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
        </div>
      </div>
    </div>
  )
}
