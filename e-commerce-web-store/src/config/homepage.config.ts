// ============================================
// Homepage Configuration
// Static brand copy and section settings for the
// professional tools & workshop equipment homepage.
//
// This file intentionally holds only static, truthful
// copy and valid route strings — never product records,
// prices, stock, ratings, review counts or unverified
// business claims. All dynamic data comes from the real
// product/category/brand/blog APIs.
// ============================================

export interface CtaConfig {
  label: string
  to: string
}

export const homepageConfig = {
  routes: {
    products: '/products',
    contact: '/contact',
    blog: '/blog',
  },

  hero: {
    eyebrow: 'PROFESSIONAL TOOLS & WORKSHOP EQUIPMENT',
    headline: 'Built for serious work.',
    description:
      'Professional tools, machinery and workshop equipment for woodworking, construction, metalworking and skilled trades.',
    primaryCta: { label: 'Shop Professional Tools', to: '/products' } as CtaConfig,
    secondaryCta: { label: 'Request a Quote', to: '/contact' } as CtaConfig,
  },

  trustStrip: [
    {
      title: 'Professional Product Selection',
      description: 'Tools and equipment selected for demanding work.',
    },
    {
      title: 'Support for Business Buyers',
      description:
        'Assistance for workshops, contractors and trade customers.',
    },
    {
      title: 'Clear Pricing in EUR',
      description: 'Product pricing displayed clearly in euros.',
    },
    {
      title: 'Direct Customer Assistance',
      description: 'Contact TechTools for product and equipment enquiries.',
    },
  ],

  shopByTrade: {
    heading: 'Shop by Trade',
    description:
      'Find tools and equipment for your workshop, job site or professional trade.',
    displayLimit: 6,
    // Curated copy applied ONLY when a category with this exact slug is
    // actually returned by the real categories API. Categories that don't
    // match any entry below still render honestly using their own real
    // name/description from the API — nothing here invents a category.
    curatedBySlug: {
      woodworking: {
        title: 'Woodworking',
        description:
          'Machines, cutting tools and workshop essentials for wood professionals.',
        icon: 'woodworking',
      },
      construction: {
        title: 'Construction',
        description:
          'Reliable tools and site equipment for demanding building work.',
        icon: 'construction',
      },
      metalworking: {
        title: 'Metalworking',
        description: 'Cutting, grinding, welding and fabrication equipment.',
        icon: 'metalworking',
      },
      electrical: {
        title: 'Electrical',
        description:
          'Electrical tools, testing equipment and professional accessories.',
        icon: 'electrical',
      },
      'automotive-workshop': {
        title: 'Automotive Workshop',
        description: 'Diagnostic, repair and maintenance tools for workshops.',
        icon: 'automotive',
      },
      'safety-ppe': {
        title: 'Safety & PPE',
        description:
          'Protective equipment designed for professional work environments.',
        icon: 'safety',
      },
      'safety-security': {
        title: 'Safety & PPE',
        description:
          'Protective equipment designed for professional work environments.',
        icon: 'safety',
      },
      'work-safety-gear': {
        title: 'Safety & PPE',
        description:
          'Protective equipment designed for professional work environments.',
        icon: 'safety',
      },
    } as Record<string, { title: string; description: string; icon: string }>,
  },

  featuredTools: {
    heading: 'Professional Tools Selected for the Job',
    description:
      'Explore active products chosen for workshops, tradespeople and demanding projects.',
    fetchLimit: 12,
    displayLimit: 8,
  },

  workshopMachinery: {
    eyebrow: 'WORKSHOP EQUIPMENT',
    headline: 'Equip your workshop for the next level.',
    description:
      'Discover woodworking machinery, professional workshop equipment and systems for growing businesses.',
    primaryCta: { label: 'Explore Workshop Equipment', to: '/products' } as CtaConfig,
    secondaryCta: {
      label: 'Request Business Assistance',
      to: '/contact',
    } as CtaConfig,
  },

  businessBuyer: {
    heading: 'Buying for a business?',
    description:
      'Contact TechTools for product sourcing, bulk quantities, workshop equipment and professional purchasing enquiries.',
    customerTypes: [
      'Workshops',
      'Construction companies',
      'Tradespeople',
      'Contractors',
      'Small manufacturers',
      'Resellers',
      'Import/export buyers',
    ],
    cta: { label: 'Talk to TechTools', to: '/contact' } as CtaConfig,
  },

  brands: {
    heading: 'Professional Brands',
    description:
      'Explore tools and equipment from the brands available through TechTools.',
    displayLimit: 8,
  },

  knowledge: {
    heading: 'Tool Guides & Workshop Knowledge',
    description:
      'Practical information for choosing, using and maintaining professional tools and equipment.',
    displayLimit: 3,
  },

  newsletter: {
    heading: 'Stay equipped.',
    description:
      'Get tool guides, product updates and professional offers from TechTools.',
    ctaLabel: 'Subscribe',
    source: 'homepage',
  },
}

export type HomepageConfig = typeof homepageConfig
