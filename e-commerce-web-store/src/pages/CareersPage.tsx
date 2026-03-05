// ============================================
// Careers Page - Production Ready
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Heart,
  Zap,
  Users,
  Globe,
  Coffee,
  Laptop,
  GraduationCap,
  Plane,
  ChevronDown,
  Search,
  Building,
} from 'lucide-react'

interface JobListing {
  id: string
  title: string
  department: string
  location: string
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Remote'
  salary: string
  posted: string
  description: string
}

const benefits = [
  {
    icon: Heart,
    title: 'Health & Wellness',
    description:
      'Comprehensive health, dental, and vision insurance for you and your family',
  },
  {
    icon: DollarSign,
    title: 'Competitive Pay',
    description:
      'Industry-leading salaries with annual performance bonuses and equity options',
  },
  {
    icon: Laptop,
    title: 'Remote Flexibility',
    description:
      'Work from anywhere with flexible hours and home office stipend',
  },
  {
    icon: GraduationCap,
    title: 'Learning Budget',
    description:
      '$2,000 annual learning stipend for courses, conferences, and books',
  },
  {
    icon: Plane,
    title: 'Generous PTO',
    description:
      '25 days paid time off plus company holidays and mental health days',
  },
  {
    icon: Coffee,
    title: 'Team Culture',
    description: 'Regular team events, hackathons, and annual company retreats',
  },
]

const departments = [
  'All Departments',
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Operations',
  'Customer Success',
  'Finance',
]

const locations = [
  'All Locations',
  'San Francisco, CA',
  'New York, NY',
  'London, UK',
  'Berlin, Germany',
  'Remote',
]

const jobListings: JobListing[] = [
  {
    id: '1',
    title: 'Senior Full Stack Engineer',
    department: 'Engineering',
    location: 'San Francisco, CA (Hybrid)',
    type: 'Full-time',
    salary: '$150K - $200K',
    posted: '2 days ago',
    description:
      'Join our engineering team to build and scale our e-commerce platform serving millions of customers.',
  },
  {
    id: '2',
    title: 'Product Manager - Mobile',
    department: 'Product',
    location: 'Remote',
    type: 'Full-time',
    salary: '$130K - $170K',
    posted: '1 week ago',
    description:
      'Lead the product strategy for our iOS and Android mobile applications.',
  },
  {
    id: '3',
    title: 'UX Designer',
    department: 'Design',
    location: 'New York, NY (Hybrid)',
    type: 'Full-time',
    salary: '$100K - $140K',
    posted: '3 days ago',
    description:
      'Shape the user experience of our platform and create delightful shopping experiences.',
  },
  {
    id: '4',
    title: 'DevOps Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    salary: '$140K - $180K',
    posted: '5 days ago',
    description:
      'Build and maintain our cloud infrastructure to ensure 99.99% uptime.',
  },
  {
    id: '5',
    title: 'Marketing Manager',
    department: 'Marketing',
    location: 'London, UK',
    type: 'Full-time',
    salary: '£70K - £90K',
    posted: '1 week ago',
    description:
      'Drive brand awareness and customer acquisition across European markets.',
  },
  {
    id: '6',
    title: 'Customer Success Lead',
    department: 'Customer Success',
    location: 'San Francisco, CA',
    type: 'Full-time',
    salary: '$90K - $120K',
    posted: '4 days ago',
    description:
      'Lead our customer success team to ensure world-class support experience.',
  },
  {
    id: '7',
    title: 'Data Scientist',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    salary: '$140K - $190K',
    posted: '1 day ago',
    description:
      'Build ML models to personalize customer experiences and optimize operations.',
  },
  {
    id: '8',
    title: 'Operations Coordinator',
    department: 'Operations',
    location: 'Berlin, Germany',
    type: 'Full-time',
    salary: '€55K - €70K',
    posted: '1 week ago',
    description:
      'Coordinate logistics and supply chain operations for our European hub.',
  },
]

const testimonials = [
  {
    name: 'Alex Rivera',
    role: 'Senior Engineer, 2 years',
    image:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face',
    quote:
      "TechTools is where I've grown the most in my career. The team is incredibly supportive, and I get to work on challenging problems every day.",
  },
  {
    name: 'Priya Sharma',
    role: 'Product Designer, 1.5 years',
    image:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    quote:
      "The culture here is like nowhere else. We move fast, but we also take care of each other. It's the perfect balance.",
  },
  {
    name: 'James Wilson',
    role: 'Marketing Lead, 3 years',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    quote:
      "I've been here since we were 20 people. Watching the company grow while maintaining our values has been incredible.",
  },
]

export default function CareersPage() {
  const [selectedDepartment, setSelectedDepartment] =
    useState('All Departments')
  const [selectedLocation, setSelectedLocation] = useState('All Locations')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredJobs = jobListings.filter((job) => {
    const matchesDepartment =
      selectedDepartment === 'All Departments' ||
      job.department === selectedDepartment
    const matchesLocation =
      selectedLocation === 'All Locations' ||
      job.location.includes(selectedLocation.replace(' (Hybrid)', ''))
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesDepartment && matchesLocation && matchesSearch
  })

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-violet-600 via-purple-600 to-indigo-600 text-white'>
        <div className='container mx-auto px-4 py-20'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <Briefcase className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>
              Join Our Team
            </h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto mb-8'>
              Help us build the future of e-commerce. We are looking for
              passionate people to join our mission of making technology
              accessible to everyone.
            </p>
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <a
                href='#openings'
                className='px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-colors'
              >
                View Open Positions
              </a>
              <Link
                to='/about'
                className='px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors'
              >
                Learn About Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className='container mx-auto px-4 -mt-10'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto'>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <Users className='w-6 h-6 text-purple-500 mx-auto mb-2' />
            <div className='text-2xl font-bold text-gray-900'>100+</div>
            <div className='text-sm text-gray-500'>Team Members</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <Globe className='w-6 h-6 text-blue-500 mx-auto mb-2' />
            <div className='text-2xl font-bold text-gray-900'>4</div>
            <div className='text-sm text-gray-500'>Global Offices</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <Zap className='w-6 h-6 text-yellow-500 mx-auto mb-2' />
            <div className='text-2xl font-bold text-gray-900'>40%</div>
            <div className='text-sm text-gray-500'>Remote Workers</div>
          </div>
          <div className='bg-white rounded-xl p-5 shadow-lg text-center'>
            <Heart className='w-6 h-6 text-red-500 mx-auto mb-2' />
            <div className='text-2xl font-bold text-gray-900'>4.8/5</div>
            <div className='text-sm text-gray-500'>Glassdoor Rating</div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className='container mx-auto px-4 py-20'>
        <div className='max-w-6xl mx-auto'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Why Work With Us?
            </h2>
            <p className='text-gray-600 max-w-2xl mx-auto'>
              We offer competitive benefits designed to support you both at work
              and in life.
            </p>
          </div>

          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className='bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow'
              >
                <div className='w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4'>
                  <benefit.icon className='w-6 h-6 text-purple-600' />
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

      {/* Testimonials */}
      <div className='bg-purple-50 py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-6xl mx-auto'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Hear From Our Team
              </h2>
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
                  <p className='text-gray-600 italic'>"{testimonial.quote}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Job Listings */}
      <div id='openings' className='container mx-auto px-4 py-20'>
        <div className='max-w-6xl mx-auto'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl font-bold text-gray-900 mb-4'>
              Open Positions
            </h2>
            <p className='text-gray-600'>
              Find your next opportunity at TechTools
            </p>
          </div>

          {/* Filters */}
          <div className='bg-white rounded-2xl p-6 shadow-sm mb-8'>
            <div className='grid md:grid-cols-3 gap-4'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search positions...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
                />
              </div>

              <div className='relative'>
                <Building className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className='w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white'
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none' />
              </div>

              <div className='relative'>
                <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className='w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white'
                >
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none' />
              </div>
            </div>
          </div>

          {/* Job Cards */}
          <div className='space-y-4'>
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className='bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow'
                >
                  <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-3 mb-2'>
                        <h3 className='text-lg font-semibold text-gray-900'>
                          {job.title}
                        </h3>
                        <span className='px-2 py-1 bg-purple-100 text-purple-600 text-xs font-medium rounded'>
                          {job.type}
                        </span>
                      </div>
                      <p className='text-gray-600 text-sm mb-3'>
                        {job.description}
                      </p>
                      <div className='flex flex-wrap items-center gap-4 text-sm text-gray-500'>
                        <span className='flex items-center gap-1'>
                          <Building className='w-4 h-4' />
                          {job.department}
                        </span>
                        <span className='flex items-center gap-1'>
                          <MapPin className='w-4 h-4' />
                          {job.location}
                        </span>
                        <span className='flex items-center gap-1'>
                          <DollarSign className='w-4 h-4' />
                          {job.salary}
                        </span>
                        <span className='flex items-center gap-1'>
                          <Clock className='w-4 h-4' />
                          {job.posted}
                        </span>
                      </div>
                    </div>
                    <div className='shrink-0'>
                      <button className='px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors'>
                        Apply Now
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className='text-center py-12 bg-white rounded-xl'>
                <Briefcase className='w-12 h-12 text-gray-300 mx-auto mb-4' />
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>
                  No positions found
                </h3>
                <p className='text-gray-600'>
                  Try adjusting your filters or search query
                </p>
              </div>
            )}
          </div>

          {filteredJobs.length > 0 && (
            <p className='text-center text-gray-500 mt-6'>
              Showing {filteredJobs.length} of {jobListings.length} positions
            </p>
          )}
        </div>
      </div>

      {/* Application Process */}
      <div className='bg-gray-100 py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Our Hiring Process
              </h2>
              <p className='text-gray-600'>
                What to expect when you apply to TechTools
              </p>
            </div>

            <div className='grid md:grid-cols-4 gap-6'>
              {[
                {
                  step: 1,
                  title: 'Apply',
                  desc: 'Submit your application online',
                },
                {
                  step: 2,
                  title: 'Screen',
                  desc: '30-min call with our recruiter',
                },
                {
                  step: 3,
                  title: 'Interview',
                  desc: 'Meet with the team (2-3 rounds)',
                },
                {
                  step: 4,
                  title: 'Offer',
                  desc: 'Receive offer within a week',
                },
              ].map((item) => (
                <div key={item.step} className='text-center'>
                  <div className='w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold'>
                    {item.step}
                  </div>
                  <h3 className='font-semibold text-gray-900 mb-1'>
                    {item.title}
                  </h3>
                  <p className='text-sm text-gray-600'>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className='container mx-auto px-4 py-16'>
        <div className='max-w-4xl mx-auto text-center'>
          <h2 className='text-2xl font-bold text-gray-900 mb-4'>
            Do Not See a Perfect Fit?
          </h2>
          <p className='text-gray-600 mb-6'>
            We are always looking for talented people. Send us your resume and
            we will reach out when we have a matching role.
          </p>
          <a
            href='mailto:careers@techtools.com'
            className='inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors'
          >
            Send Your Resume
          </a>
        </div>
      </div>
    </div>
  )
}
