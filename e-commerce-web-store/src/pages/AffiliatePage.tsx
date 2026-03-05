// ============================================
// Affiliate Program Page - Production Ready
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  DollarSign,
  TrendingUp,
  Gift,
  CheckCircle,
  Zap,
  Globe,
  BarChart3,
  Link2,
  Wallet,
  Clock,
  Star,
  HelpCircle,
  ChevronDown,
} from 'lucide-react'

const benefits = [
  {
    icon: DollarSign,
    title: 'Up to 10% Commission',
    description:
      'Earn competitive commissions on every sale you refer, with higher rates for top performers.',
  },
  {
    icon: Clock,
    title: '30-Day Cookie Window',
    description:
      'Get credited for sales made up to 30 days after a customer clicks your affiliate link.',
  },
  {
    icon: Wallet,
    title: 'Monthly Payouts',
    description:
      'Receive payments via PayPal, bank transfer, or store credit with a low $50 minimum threshold.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Dashboard',
    description:
      'Track clicks, conversions, and earnings in real-time with our comprehensive analytics dashboard.',
  },
  {
    icon: Link2,
    title: 'Unique Tracking Links',
    description:
      'Get personalized links and deep linking capabilities to track all your referrals accurately.',
  },
  {
    icon: Gift,
    title: 'Exclusive Promotions',
    description:
      'Access exclusive coupons and early bird promotions to share with your audience.',
  },
]

const commissionTiers = [
  {
    tier: 'Starter',
    sales: '0-10 sales/month',
    commission: '5%',
    color: 'bg-gray-100 text-gray-700',
  },
  {
    tier: 'Bronze',
    sales: '11-50 sales/month',
    commission: '6%',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    tier: 'Silver',
    sales: '51-100 sales/month',
    commission: '7%',
    color: 'bg-gray-200 text-gray-700',
  },
  {
    tier: 'Gold',
    sales: '101-250 sales/month',
    commission: '8%',
    color: 'bg-yellow-100 text-yellow-700',
  },
  {
    tier: 'Platinum',
    sales: '251+ sales/month',
    commission: '10%',
    color: 'bg-purple-100 text-purple-700',
  },
]

const steps = [
  {
    step: 1,
    title: 'Sign Up',
    description:
      'Fill out our simple application form. Approval typically takes 24-48 hours.',
    icon: Users,
  },
  {
    step: 2,
    title: 'Get Your Links',
    description:
      'Access your unique affiliate links and promotional materials from your dashboard.',
    icon: Link2,
  },
  {
    step: 3,
    title: 'Promote & Share',
    description:
      'Share your links on your blog, social media, YouTube channel, or email list.',
    icon: Globe,
  },
  {
    step: 4,
    title: 'Earn Money',
    description:
      'Earn commissions on every qualifying sale and receive monthly payouts.',
    icon: DollarSign,
  },
]

const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Tech Blogger',
    image:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    quote:
      'I have been a TechTools affiliate for 2 years and consistently earn $2,000+ monthly. Their tracking is reliable and payouts are always on time.',
    earnings: '$2,500/month average',
  },
  {
    name: 'Mike Chen',
    role: 'YouTube Creator',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    quote:
      'The 30-day cookie window is amazing. Even if viewers buy a week after watching my review, I still get the commission.',
    earnings: '$4,200/month average',
  },
  {
    name: 'Jessica R.',
    role: 'Instagram Influencer',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    quote:
      'The exclusive discount codes help boost my conversion rates. My followers love saving money and I love earning commissions!',
    earnings: '$1,800/month average',
  },
]

const faqs = [
  {
    question: 'Who can join the affiliate program?',
    answer:
      'Anyone with an online presence can apply! This includes bloggers, content creators, influencers, website owners, and social media personalities. We review each application to ensure a good fit.',
  },
  {
    question: 'How much can I earn?',
    answer:
      'Your earnings depend on your traffic and conversion rates. Our top affiliates earn $5,000+ per month. With commission rates up to 10% and an average order value of $150, the earning potential is significant.',
  },
  {
    question: 'When and how do I get paid?',
    answer:
      "Payments are processed monthly, around the 15th of each month, for the previous month's confirmed commissions. We pay via PayPal, direct bank transfer, or store credit. Minimum payout threshold is $50.",
  },
  {
    question: 'What marketing materials do you provide?',
    answer:
      'We provide banners, product images, text links, email templates, and exclusive discount codes. You will also get access to our product feed for dynamic content integration.',
  },
  {
    question: 'Can I promote TechTools on social media?',
    answer:
      'Absolutely! Social media is encouraged. You can share your affiliate links on Instagram, TikTok, YouTube, Twitter, Facebook, and other platforms. Just make sure to follow FTC disclosure guidelines.',
  },
  {
    question: 'What products can I promote?',
    answer:
      'You can promote any product in our catalog! You will have access to deep linking tools so you can link directly to any product page and earn commissions on the entire cart.',
  },
]

export default function AffiliatePage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    website: '',
    socialMedia: '',
    audience: '',
    howHeard: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white'>
        <div className='container mx-auto px-4 py-20'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <TrendingUp className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>
              Earn Money With TechTools
            </h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto mb-8'>
              Join our affiliate program and earn up to 10% commission on every
              sale. Partner with a trusted brand and monetize your audience
              today.
            </p>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <a
                href='#apply'
                className='px-8 py-4 bg-white text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50 transition-colors'
              >
                Apply Now - It is Free
              </a>
              <a
                href='#how-it-works'
                className='px-8 py-4 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors'
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className='container mx-auto px-4 -mt-10'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto'>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <div className='text-2xl font-bold text-emerald-600'>10%</div>
            <div className='text-sm text-gray-500'>Max Commission</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <div className='text-2xl font-bold text-emerald-600'>30 Days</div>
            <div className='text-sm text-gray-500'>Cookie Duration</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <div className='text-2xl font-bold text-emerald-600'>$150</div>
            <div className='text-sm text-gray-500'>Avg Order Value</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <div className='text-2xl font-bold text-emerald-600'>5,000+</div>
            <div className='text-sm text-gray-500'>Active Affiliates</div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-6xl mx-auto'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Why Partner With Us?
            </h2>
            <p className='text-gray-600 max-w-2xl mx-auto'>
              We offer one of the most competitive affiliate programs in the
              tech e-commerce space.
            </p>
          </div>

          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className='bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow'
              >
                <div className='w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4'>
                  <benefit.icon className='w-6 h-6 text-emerald-600' />
                </div>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>
                  {benefit.title}
                </h3>
                <p className='text-gray-600 text-sm'>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Commission Tiers */}
      <div className='bg-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Commission Structure
              </h2>
              <p className='text-gray-600'>
                The more you sell, the more you earn with our tiered commission
                system.
              </p>
            </div>

            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-gray-200'>
                    <th className='text-left py-4 px-4 font-semibold text-gray-900'>
                      Tier
                    </th>
                    <th className='text-left py-4 px-4 font-semibold text-gray-900'>
                      Monthly Sales
                    </th>
                    <th className='text-center py-4 px-4 font-semibold text-gray-900'>
                      Commission Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {commissionTiers.map((tier) => (
                    <tr
                      key={tier.tier}
                      className='border-b border-gray-100 hover:bg-gray-50'
                    >
                      <td className='py-4 px-4'>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${tier.color}`}
                        >
                          {tier.tier}
                        </span>
                      </td>
                      <td className='py-4 px-4 text-gray-600'>{tier.sales}</td>
                      <td className='py-4 px-4 text-center'>
                        <span className='text-2xl font-bold text-emerald-600'>
                          {tier.commission}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id='how-it-works' className='container mx-auto px-4 py-20'>
        <div className='max-w-5xl mx-auto'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              How It Works
            </h2>
            <p className='text-gray-600'>
              Get started in minutes and start earning commissions today.
            </p>
          </div>

          <div className='grid md:grid-cols-4 gap-8'>
            {steps.map((step, index) => (
              <div key={step.step} className='relative'>
                <div className='text-center'>
                  <div className='w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                    <step.icon className='w-8 h-8 text-emerald-600' />
                  </div>
                  <div className='w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto -mt-10 mb-4 text-sm font-bold relative z-10'>
                    {step.step}
                  </div>
                  <h3 className='font-semibold text-gray-900 mb-2'>
                    {step.title}
                  </h3>
                  <p className='text-sm text-gray-600'>{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className='hidden md:block absolute top-8 left-full w-full h-0.5 bg-emerald-200 -translate-x-1/2' />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className='bg-emerald-50 py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-6xl mx-auto'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Success Stories
              </h2>
              <p className='text-gray-600'>
                Hear from our top-performing affiliates
              </p>
            </div>

            <div className='grid md:grid-cols-3 gap-6'>
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.name}
                  className='bg-white rounded-2xl p-6 shadow-sm'
                >
                  <div className='flex items-center gap-3 mb-4'>
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className='w-12 h-12 rounded-full object-cover'
                    />
                    <div>
                      <div className='font-semibold text-gray-900'>
                        {testimonial.name}
                      </div>
                      <div className='text-sm text-gray-500'>
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                  <p className='text-gray-600 italic mb-4'>
                    "{testimonial.quote}"
                  </p>
                  <div className='flex items-center gap-2 text-emerald-600 font-semibold'>
                    <Star className='w-4 h-4 fill-current' />
                    {testimonial.earnings}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Application Form */}
      <div id='apply' className='container mx-auto px-4 py-20'>
        <div className='max-w-2xl mx-auto'>
          <div className='text-center mb-10'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>Apply Now</h2>
            <p className='text-gray-600'>
              Join thousands of affiliates earning with TechTools
            </p>
          </div>

          <div className='bg-white rounded-2xl p-8 shadow-sm'>
            {isSubmitted ? (
              <div className='text-center py-8'>
                <div className='w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <CheckCircle className='w-8 h-8 text-emerald-600' />
                </div>
                <h3 className='text-xl font-semibold text-gray-900 mb-2'>
                  Application Submitted!
                </h3>
                <p className='text-gray-600'>
                  Thank you for applying! We review applications within 24-48
                  hours. Check your email for next steps.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className='space-y-6'>
                <div className='grid md:grid-cols-2 gap-6'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Full Name *
                    </label>
                    <input
                      type='text'
                      name='name'
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                      placeholder='John Doe'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Email Address *
                    </label>
                    <input
                      type='email'
                      name='email'
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                      placeholder='john@example.com'
                    />
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Website / Blog URL
                  </label>
                  <input
                    type='url'
                    name='website'
                    value={formData.website}
                    onChange={handleChange}
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                    placeholder='https://yourwebsite.com'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Social Media Profiles
                  </label>
                  <input
                    type='text'
                    name='socialMedia'
                    value={formData.socialMedia}
                    onChange={handleChange}
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                    placeholder='@username on Instagram, YouTube channel, etc.'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Estimated Monthly Audience *
                  </label>
                  <select
                    name='audience'
                    value={formData.audience}
                    onChange={handleChange}
                    required
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                  >
                    <option value=''>Select audience size</option>
                    <option value='1-1000'>1 - 1,000</option>
                    <option value='1000-10000'>1,000 - 10,000</option>
                    <option value='10000-50000'>10,000 - 50,000</option>
                    <option value='50000-100000'>50,000 - 100,000</option>
                    <option value='100000+'>100,000+</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    How did you hear about us?
                  </label>
                  <select
                    name='howHeard'
                    value={formData.howHeard}
                    onChange={handleChange}
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                  >
                    <option value=''>Select an option</option>
                    <option value='search'>Search Engine</option>
                    <option value='social'>Social Media</option>
                    <option value='referral'>Referral</option>
                    <option value='existing'>Already a Customer</option>
                    <option value='other'>Other</option>
                  </select>
                </div>

                <button
                  type='submit'
                  disabled={isSubmitting}
                  className='w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors'
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className='animate-spin w-5 h-5'
                        fill='none'
                        viewBox='0 0 24 24'
                      >
                        <circle
                          className='opacity-25'
                          cx='12'
                          cy='12'
                          r='10'
                          stroke='currentColor'
                          strokeWidth='4'
                        />
                        <path
                          className='opacity-75'
                          fill='currentColor'
                          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                        />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Zap className='w-5 h-5' />
                      Submit Application
                    </>
                  )}
                </button>

                <p className='text-xs text-gray-500 text-center'>
                  By applying, you agree to our{' '}
                  <Link
                    to='/terms'
                    className='text-emerald-600 hover:underline'
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    to='/privacy'
                    className='text-emerald-600 hover:underline'
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className='bg-gray-100 py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-3xl mx-auto'>
            <div className='text-center mb-12'>
              <HelpCircle className='w-10 h-10 text-emerald-600 mx-auto mb-4' />
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Frequently Asked Questions
              </h2>
            </div>

            <div className='space-y-3'>
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className='bg-white rounded-xl overflow-hidden'
                >
                  <button
                    onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                    className='w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors'
                  >
                    <span className='font-medium text-gray-900'>
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        openFAQ === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFAQ === index && (
                    <div className='px-5 pb-5'>
                      <p className='text-gray-600'>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contact CTA */}
      <div className='container mx-auto px-4 py-16'>
        <div className='max-w-4xl mx-auto text-center'>
          <h2 className='text-2xl font-bold text-gray-900 mb-4'>
            Have Questions?
          </h2>
          <p className='text-gray-600 mb-6'>
            Our affiliate team is here to help you succeed.
          </p>
          <a
            href='mailto:affiliates@techtools.com'
            className='inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors'
          >
            Contact Affiliate Team
          </a>
        </div>
      </div>
    </div>
  )
}
