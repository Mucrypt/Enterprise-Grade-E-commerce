// ============================================
// Press Page - Production Ready
// ============================================

import { Link } from 'react-router-dom'
import {
  Newspaper,
  Download,
  Mail,
  Calendar,
  ExternalLink,
  Award,
  TrendingUp,
  Users,
  Image,
  FileText,
} from 'lucide-react'

const pressReleases = [
  {
    id: 1,
    date: 'February 28, 2026',
    title:
      'TechTools Announces Expansion to 10 New Markets in Asia Pacific Region',
    summary:
      'TechTools expands its global footprint with new operations in Japan, South Korea, Singapore, and more, bringing total market presence to 35 countries.',
    category: 'Expansion',
  },
  {
    id: 2,
    date: 'January 15, 2026',
    title: 'TechTools Achieves Carbon Neutrality Ahead of Schedule',
    summary:
      'The company reaches its sustainability milestone two years early through renewable energy investments and carbon offset programs.',
    category: 'Sustainability',
  },
  {
    id: 3,
    date: 'December 5, 2025',
    title: 'TechTools Raises $50M Series C to Accelerate AI-Powered Shopping',
    summary:
      'New funding round led by Sequoia Capital will fuel development of personalized AI shopping experiences and same-day delivery expansion.',
    category: 'Funding',
  },
  {
    id: 4,
    date: 'November 20, 2025',
    title: 'TechTools Launches Revolutionary AR Try-Before-You-Buy Feature',
    summary:
      'New augmented reality feature allows customers to visualize products in their space before purchasing, reducing returns by 40%.',
    category: 'Product',
  },
  {
    id: 5,
    date: 'October 8, 2025',
    title: 'TechTools Partners with Leading Tech Brands for Exclusive Launches',
    summary:
      'Strategic partnerships with Apple, Samsung, and Sony bring exclusive product launches and early access to TechTools customers.',
    category: 'Partnership',
  },
  {
    id: 6,
    date: 'September 1, 2025',
    title: 'TechTools Celebrates 500,000 Customer Milestone',
    summary:
      'Company reaches half a million satisfied customers while maintaining industry-leading 4.9-star customer satisfaction rating.',
    category: 'Milestone',
  },
]

const mediaFeatures = [
  {
    outlet: 'TechCrunch',
    logo: 'TC',
    title: 'TechTools is revolutionizing how we shop for electronics',
    date: 'Feb 2026',
    link: '#',
  },
  {
    outlet: 'Forbes',
    logo: 'F',
    title: "30 Under 30: TechTools' founders making waves in e-commerce",
    date: 'Jan 2026',
    link: '#',
  },
  {
    outlet: 'Wired',
    logo: 'W',
    title: 'How TechTools uses AI to personalize your shopping experience',
    date: 'Dec 2025',
    link: '#',
  },
  {
    outlet: 'The Verge',
    logo: 'V',
    title: "TechTools' AR feature is a glimpse into the future of retail",
    date: 'Nov 2025',
    link: '#',
  },
  {
    outlet: 'Inc.',
    logo: 'Inc',
    title: 'Inc. 5000: TechTools ranked among fastest-growing companies',
    date: 'Oct 2025',
    link: '#',
  },
  {
    outlet: 'Bloomberg',
    logo: 'B',
    title: 'E-commerce startup TechTools eyes global expansion',
    date: 'Sep 2025',
    link: '#',
  },
]

const companyStats = [
  { value: '500K+', label: 'Customers Worldwide', icon: Users },
  { value: '35', label: 'Countries Served', icon: TrendingUp },
  { value: '$50M', label: 'Series C Funding', icon: TrendingUp },
  { value: '4.9/5', label: 'Customer Rating', icon: Award },
]

const brandAssets = [
  {
    name: 'Logo Package',
    description: 'Primary and secondary logos in various formats',
    formats: 'PNG, SVG, EPS',
    icon: Image,
  },
  {
    name: 'Brand Guidelines',
    description: 'Complete brand identity and usage guidelines',
    formats: 'PDF',
    icon: FileText,
  },
  {
    name: 'Product Images',
    description: 'High-resolution product photography',
    formats: 'JPG, PNG',
    icon: Image,
  },
  {
    name: 'Executive Photos',
    description: 'Leadership team professional headshots',
    formats: 'JPG',
    icon: Image,
  },
]

export default function PressPage() {
  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white'>
        <div className='container mx-auto px-4 py-20'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <Newspaper className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>Press Room</h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto mb-8'>
              Get the latest news, press releases, and media resources from
              TechTools. For press inquiries, please contact our media relations
              team.
            </p>
            <a
              href='mailto:press@techtools.com'
              className='inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors'
            >
              <Mail className='w-5 h-5' />
              Contact Press Team
            </a>
          </div>
        </div>
      </div>

      {/* Company Stats */}
      <div className='container mx-auto px-4 -mt-10'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto'>
          {companyStats.map((stat) => (
            <div
              key={stat.label}
              className='bg-white rounded-xl p-5 shadow-lg text-center'
            >
              <stat.icon className='w-6 h-6 text-orange-500 mx-auto mb-2' />
              <div className='text-2xl font-bold text-gray-900'>
                {stat.value}
              </div>
              <div className='text-sm text-gray-500'>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Press Releases */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-5xl mx-auto'>
          <div className='flex items-center justify-between mb-10'>
            <div>
              <h2 className='text-3xl font-bold text-gray-900 mb-2'>
                Press Releases
              </h2>
              <p className='text-gray-600'>
                Latest announcements and company news
              </p>
            </div>
          </div>

          <div className='space-y-4'>
            {pressReleases.map((release) => (
              <div
                key={release.id}
                className='bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow'
              >
                <div className='flex flex-col md:flex-row md:items-start gap-4'>
                  <div className='shrink-0'>
                    <div className='flex items-center gap-2 text-sm text-gray-500 mb-2'>
                      <Calendar className='w-4 h-4' />
                      {release.date}
                    </div>
                    <span className='inline-block px-3 py-1 bg-orange-100 text-orange-600 text-xs font-medium rounded-full'>
                      {release.category}
                    </span>
                  </div>
                  <div className='flex-1'>
                    <h3 className='text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 cursor-pointer'>
                      {release.title}
                    </h3>
                    <p className='text-gray-600 text-sm'>{release.summary}</p>
                  </div>
                  <button className='shrink-0 text-orange-600 font-medium text-sm hover:underline flex items-center gap-1'>
                    Read More
                    <ExternalLink className='w-4 h-4' />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className='text-center mt-8'>
            <button className='px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors'>
              View All Press Releases
            </button>
          </div>
        </div>
      </div>

      {/* Media Features */}
      <div className='bg-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-5xl mx-auto'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                In the News
              </h2>
              <p className='text-gray-600'>
                See what leading publications are saying about TechTools
              </p>
            </div>

            <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {mediaFeatures.map((feature, index) => (
                <a
                  key={index}
                  href={feature.link}
                  className='bg-gray-50 rounded-xl p-6 hover:shadow-md transition-shadow group'
                >
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='w-10 h-10 bg-gray-900 text-white rounded-lg flex items-center justify-center text-xs font-bold'>
                      {feature.logo}
                    </div>
                    <div>
                      <div className='font-semibold text-gray-900'>
                        {feature.outlet}
                      </div>
                      <div className='text-xs text-gray-500'>
                        {feature.date}
                      </div>
                    </div>
                  </div>
                  <p className='text-gray-700 group-hover:text-orange-600 transition-colors'>
                    {feature.title}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Brand Assets */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-5xl mx-auto'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Brand Assets
            </h2>
            <p className='text-gray-600'>
              Download official TechTools logos, images, and brand guidelines
            </p>
          </div>

          <div className='grid md:grid-cols-2 gap-6'>
            {brandAssets.map((asset) => (
              <div
                key={asset.name}
                className='bg-white rounded-xl p-6 shadow-sm flex items-start gap-4'
              >
                <div className='w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0'>
                  <asset.icon className='w-6 h-6 text-gray-600' />
                </div>
                <div className='flex-1'>
                  <h3 className='font-semibold text-gray-900 mb-1'>
                    {asset.name}
                  </h3>
                  <p className='text-sm text-gray-600 mb-2'>
                    {asset.description}
                  </p>
                  <p className='text-xs text-gray-400'>
                    Formats: {asset.formats}
                  </p>
                </div>
                <button className='shrink-0 p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors'>
                  <Download className='w-5 h-5' />
                </button>
              </div>
            ))}
          </div>

          <div className='text-center mt-8'>
            <button className='inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors'>
              <Download className='w-5 h-5' />
              Download Press Kit
            </button>
          </div>
        </div>
      </div>

      {/* Company Boilerplate */}
      <div className='bg-gray-100 py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto'>
            <h2 className='text-2xl font-bold text-gray-900 mb-6'>
              About TechTools
            </h2>
            <div className='bg-white rounded-xl p-8 shadow-sm'>
              <p className='text-gray-600 leading-relaxed mb-4'>
                TechTools is a leading e-commerce platform dedicated to making
                quality technology accessible to everyone. Founded in 2019 in
                San Francisco, the company has grown to serve over 500,000
                customers across 35 countries.
              </p>
              <p className='text-gray-600 leading-relaxed mb-4'>
                The company offers a carefully curated selection of consumer
                electronics, gadgets, and tech accessories, with a focus on
                quality, value, and customer experience. TechTools is known for
                its innovative features including AR product visualization,
                personalized AI recommendations, and industry-leading customer
                support.
              </p>
              <p className='text-gray-600 leading-relaxed'>
                TechTools is a certified B Corporation and has achieved carbon
                neutrality as part of its commitment to sustainability. The
                company has been recognized as one of the fastest-growing
                companies by Inc. 5000 and named Best E-Commerce Startup by
                TechCrunch.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Press Contact */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-4xl mx-auto'>
          <div className='bg-linear-to-br from-orange-500 to-red-500 rounded-2xl p-8 md:p-12 text-white text-center'>
            <Mail className='w-12 h-12 mx-auto mb-4 opacity-80' />
            <h2 className='text-2xl md:text-3xl font-bold mb-4'>
              Media Inquiries
            </h2>
            <p className='text-white/90 mb-6 max-w-xl mx-auto'>
              For press inquiries, interview requests, or additional
              information, please contact our media relations team.
            </p>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <a
                href='mailto:press@techtools.com'
                className='px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors'
              >
                press@techtools.com
              </a>
              <a
                href='tel:+14155551234'
                className='px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors'
              >
                +1 (415) 555-1234
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Links */}
      <div className='bg-gray-50 border-t border-gray-200 py-12'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6'>
            <Link
              to='/about'
              className='text-gray-600 hover:text-orange-600 font-medium'
            >
              Our Story
            </Link>
            <Link
              to='/careers'
              className='text-gray-600 hover:text-orange-600 font-medium'
            >
              Careers
            </Link>
            <Link
              to='/affiliates'
              className='text-gray-600 hover:text-orange-600 font-medium'
            >
              Affiliate Program
            </Link>
            <Link
              to='/contact'
              className='text-gray-600 hover:text-orange-600 font-medium'
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
