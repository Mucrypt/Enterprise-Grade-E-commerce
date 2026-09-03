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
    displayLimit: 8,
    // Icon applied ONLY when a real, top-level category with this exact
    // slug is actually returned by the categories API -- these are the
    // real slugs created in migration 055 (category taxonomy expansion),
    // not invented trade names. Title/description are intentionally
    // omitted here: the component always falls back to that category's
    // own real name/description from the API, so nothing here duplicates
    // or risks drifting from the real copy. Any other real, active
    // category (including one not listed here) still renders honestly
    // with a generic icon -- nothing is invented.
    curatedBySlug: {
      'home-improvement-tools': { icon: 'woodworking' },
      'car-electronics': { icon: 'automotive' },
      'interior-comfort': { icon: 'interior' },
      'safety-security': { icon: 'safety' },
      'tools-emergency': { icon: 'emergency' },
      'audio-entertainment': { icon: 'audio' },
      'exterior-accessories': { icon: 'exterior' },
      lighting: { icon: 'lighting' },
      'cleaning-maintenance': { icon: 'cleaning' },
      'phone-gps-mounts': { icon: 'mounts' },
      'performance-parts': { icon: 'performance' },
      'work-safety-gear': { icon: 'safety' },
    } as Record<string, { title?: string; description?: string; icon: string }>,
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

  // Rendered globally in Layout.tsx (every page, just above the footer),
  // not only the homepage -- source reflects that it's the site's one
  // newsletter capture point, not homepage-specific.
  newsletter: {
    heading: 'Stay equipped.',
    description:
      'Get tool guides, product updates and professional offers from TechTools.',
    ctaLabel: 'Subscribe',
    source: 'footer',
  },
}

export type HomepageConfig = typeof homepageConfig
