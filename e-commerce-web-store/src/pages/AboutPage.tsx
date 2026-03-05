// ============================================
// Our Story / About Page - Production Ready
// ============================================

import { Link } from 'react-router-dom'
import {
  Heart,
  Target,
  Users,
  Award,
  Zap,
  Globe,
  TrendingUp,
  Shield,
  Leaf,
  Star,
} from 'lucide-react'

const stats = [
  { value: '2019', label: 'Founded' },
  { value: '500K+', label: 'Happy Customers' },
  { value: '50K+', label: 'Products Sold' },
  { value: '25+', label: 'Countries Served' },
]

const values = [
  {
    icon: Heart,
    title: 'Customer First',
    description:
      'Every decision we make starts with one question: How does this benefit our customers?',
  },
  {
    icon: Shield,
    title: 'Quality Assured',
    description:
      'We meticulously test and curate every product to ensure it meets our high standards.',
  },
  {
    icon: Zap,
    title: 'Innovation Driven',
    description:
      'We constantly seek the latest technology and innovations to bring you cutting-edge products.',
  },
  {
    icon: Leaf,
    title: 'Sustainability',
    description:
      'We are committed to reducing our environmental impact through eco-friendly practices.',
  },
]

const milestones = [
  {
    year: '2019',
    title: 'The Beginning',
    description:
      'TechTools was founded in a small garage in San Francisco with a vision to make quality tech accessible to everyone.',
  },
  {
    year: '2020',
    title: 'Going Online',
    description:
      'Launched our e-commerce platform and shipped our first 10,000 orders despite global challenges.',
  },
  {
    year: '2021',
    title: 'Rapid Growth',
    description:
      'Expanded our product catalog to 5,000+ items and opened our first international warehouse in Europe.',
  },
  {
    year: '2022',
    title: 'Team Expansion',
    description:
      'Grew our team to 100+ employees and launched our mobile app for iOS and Android.',
  },
  {
    year: '2023',
    title: 'Industry Recognition',
    description:
      "Named 'Best E-Commerce Startup' and achieved B Corp certification for our sustainability efforts.",
  },
  {
    year: '2024',
    title: 'Global Reach',
    description:
      'Expanded to 25+ countries, launched same-day delivery in major cities, and hit 500K customers.',
  },
]

const team = [
  {
    name: 'Sarah Chen',
    role: 'Co-Founder & CEO',
    image:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
    bio: 'Former Google engineer with a passion for making technology accessible.',
  },
  {
    name: 'Michael Torres',
    role: 'Co-Founder & CTO',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    bio: '15+ years in tech, previously led engineering at multiple startups.',
  },
  {
    name: 'Emily Johnson',
    role: 'Chief Product Officer',
    image:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face',
    bio: 'Product visionary who has shaped the future of consumer electronics.',
  },
  {
    name: 'David Kim',
    role: 'Chief Operations Officer',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    bio: 'Operations expert ensuring seamless delivery to customers worldwide.',
  },
]

export default function AboutPage() {
  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden'>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className='container mx-auto px-4 py-20 relative'>
          <div className='max-w-4xl mx-auto text-center'>
            <span className='inline-block px-4 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium mb-6'>
              Our Story
            </span>
            <h1 className='text-4xl md:text-6xl font-bold mb-6'>
              Empowering Your{' '}
              <span className='text-orange-500'>Digital Life</span>
            </h1>
            <p className='text-white/80 text-lg md:text-xl max-w-2xl mx-auto'>
              From a small garage startup to serving over 500,000 customers
              worldwide, we are on a mission to make quality technology
              accessible to everyone.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className='container mx-auto px-4 -mt-10'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto'>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className='bg-white rounded-2xl p-6 shadow-lg text-center'
            >
              <div className='text-3xl font-bold text-orange-500 mb-1'>
                {stat.value}
              </div>
              <div className='text-gray-600 text-sm'>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mission Section */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-6xl mx-auto'>
          <div className='grid md:grid-cols-2 gap-12 items-center'>
            <div>
              <div className='flex items-center gap-3 mb-4'>
                <Target className='w-6 h-6 text-orange-500' />
                <span className='text-orange-500 font-semibold'>
                  Our Mission
                </span>
              </div>
              <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-6'>
                Making Technology Accessible to Everyone
              </h2>
              <p className='text-gray-600 mb-6 leading-relaxed'>
                We believe that everyone deserves access to quality technology
                products at fair prices. Our mission is to democratize tech by
                carefully curating the best products, negotiating competitive
                prices, and delivering an exceptional shopping experience.
              </p>
              <p className='text-gray-600 leading-relaxed'>
                Every product in our catalog goes through rigorous testing and
                quality checks. We do not just sell products — we stand behind
                them with our satisfaction guarantee and industry-leading
                customer support.
              </p>
            </div>
            <div className='relative'>
              <div className='aspect-square rounded-2xl bg-linear-to-br from-orange-100 to-orange-50 p-8 flex items-center justify-center'>
                <div className='grid grid-cols-2 gap-4 w-full max-w-sm'>
                  <div className='bg-white rounded-xl p-4 shadow-md'>
                    <Globe className='w-8 h-8 text-orange-500 mb-2' />
                    <div className='font-semibold text-gray-900'>
                      Global Reach
                    </div>
                    <div className='text-sm text-gray-500'>25+ Countries</div>
                  </div>
                  <div className='bg-white rounded-xl p-4 shadow-md'>
                    <TrendingUp className='w-8 h-8 text-green-500 mb-2' />
                    <div className='font-semibold text-gray-900'>
                      Fast Growth
                    </div>
                    <div className='text-sm text-gray-500'>200% YoY</div>
                  </div>
                  <div className='bg-white rounded-xl p-4 shadow-md'>
                    <Users className='w-8 h-8 text-blue-500 mb-2' />
                    <div className='font-semibold text-gray-900'>Our Team</div>
                    <div className='text-sm text-gray-500'>100+ Employees</div>
                  </div>
                  <div className='bg-white rounded-xl p-4 shadow-md'>
                    <Star className='w-8 h-8 text-yellow-500 mb-2' />
                    <div className='font-semibold text-gray-900'>Rating</div>
                    <div className='text-sm text-gray-500'>4.9/5 Stars</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className='bg-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-6xl mx-auto'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Our Core Values
              </h2>
              <p className='text-gray-600 max-w-2xl mx-auto'>
                These principles guide everything we do, from product selection
                to customer service.
              </p>
            </div>

            <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-6'>
              {values.map((value) => (
                <div
                  key={value.title}
                  className='bg-gray-50 rounded-2xl p-6 hover:shadow-lg transition-shadow'
                >
                  <div className='w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4'>
                    <value.icon className='w-6 h-6 text-orange-600' />
                  </div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-2'>
                    {value.title}
                  </h3>
                  <p className='text-gray-600 text-sm'>{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-4xl mx-auto'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Our Journey
            </h2>
            <p className='text-gray-600'>
              From humble beginnings to where we are today.
            </p>
          </div>

          <div className='relative'>
            {/* Timeline Line */}
            <div className='absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 -translate-x-1/2 hidden md:block' />

            <div className='space-y-8'>
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`flex items-center gap-8 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  <div
                    className={`flex-1 ${
                      index % 2 === 0 ? 'md:text-right' : 'md:text-left'
                    }`}
                  >
                    <div className='bg-white rounded-xl p-6 shadow-sm'>
                      <div className='text-orange-500 font-bold text-lg mb-1'>
                        {milestone.year}
                      </div>
                      <h3 className='font-semibold text-gray-900 mb-2'>
                        {milestone.title}
                      </h3>
                      <p className='text-sm text-gray-600'>
                        {milestone.description}
                      </p>
                    </div>
                  </div>
                  <div className='hidden md:flex w-4 h-4 bg-orange-500 rounded-full shrink-0 z-10' />
                  <div className='flex-1 hidden md:block' />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Section */}
      <div className='bg-gray-100 py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-6xl mx-auto'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Meet Our Leadership
              </h2>
              <p className='text-gray-600 max-w-2xl mx-auto'>
                The passionate team behind TechTools, dedicated to bringing you
                the best tech experience.
              </p>
            </div>

            <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-6'>
              {team.map((member) => (
                <div
                  key={member.name}
                  className='bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow'
                >
                  <img
                    src={member.image}
                    alt={member.name}
                    className='w-full aspect-square object-cover'
                  />
                  <div className='p-5'>
                    <h3 className='font-semibold text-gray-900'>
                      {member.name}
                    </h3>
                    <p className='text-orange-500 text-sm mb-2'>
                      {member.role}
                    </p>
                    <p className='text-gray-600 text-sm'>{member.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Awards Section */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-4xl mx-auto text-center'>
          <Award className='w-12 h-12 text-orange-500 mx-auto mb-4' />
          <h2 className='text-3xl font-bold text-gray-900 mb-4'>
            Recognition & Awards
          </h2>
          <p className='text-gray-600 mb-10'>
            We are honored to be recognized by industry leaders.
          </p>

          <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            <div className='bg-white rounded-xl p-6 shadow-sm'>
              <div className='text-2xl mb-2'>🏆</div>
              <div className='font-semibold text-gray-900 text-sm'>
                Best E-Commerce Startup
              </div>
              <div className='text-xs text-gray-500'>TechCrunch 2023</div>
            </div>
            <div className='bg-white rounded-xl p-6 shadow-sm'>
              <div className='text-2xl mb-2'>🌿</div>
              <div className='font-semibold text-gray-900 text-sm'>
                B Corp Certified
              </div>
              <div className='text-xs text-gray-500'>Since 2023</div>
            </div>
            <div className='bg-white rounded-xl p-6 shadow-sm'>
              <div className='text-2xl mb-2'>⭐</div>
              <div className='font-semibold text-gray-900 text-sm'>
                Top Rated Seller
              </div>
              <div className='text-xs text-gray-500'>Trustpilot 2024</div>
            </div>
            <div className='bg-white rounded-xl p-6 shadow-sm'>
              <div className='text-2xl mb-2'>🚀</div>
              <div className='font-semibold text-gray-900 text-sm'>
                Fastest Growing
              </div>
              <div className='text-xs text-gray-500'>Inc. 5000 2024</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className='bg-linear-to-br from-orange-500 to-red-500 py-16'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='text-3xl font-bold text-white mb-4'>
            Join Our Journey
          </h2>
          <p className='text-white/90 mb-8 max-w-xl mx-auto'>
            Want to be part of something amazing? Check out our open positions
            or start shopping today.
          </p>
          <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
            <Link
              to='/careers'
              className='px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors'
            >
              View Careers
            </Link>
            <Link
              to='/products'
              className='px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors border border-white/20'
            >
              Shop Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
