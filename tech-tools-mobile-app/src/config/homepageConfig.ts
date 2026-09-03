// ============================================
// Homepage Configuration
// Static brand copy and section settings for the
// professional tools & workshop equipment home screen.
//
// Mirrors e-commerce-web-store/src/config/homepage.config.ts
// verbatim (same copy, same section settings) so the mobile
// app reaches full content/tone parity with the web
// storefront's homepage, per the founder's decision. Routes
// are adapted to this app's actual Expo Router paths.
//
// This file intentionally holds only static, truthful copy
// and valid route strings -- never product records, prices,
// stock, ratings, review counts or unverified business
// claims. All dynamic data comes from the real
// product/category/brand/blog APIs.
// ============================================

export interface CtaConfig {
  label: string
  to: string
}

export const homepageConfig = {
  routes: {
    products: '/products',
    contact: '/contact-us',
    blog: '/blog',
  },

  hero: {
    eyebrow: 'PROFESSIONAL TOOLS & WORKSHOP EQUIPMENT',
    headline: 'Built for serious work.',
    description:
      'Professional tools, machinery and workshop equipment for woodworking, construction, metalworking and skilled trades.',
    primaryCta: { label: 'Shop Professional Tools', to: '/products' } as CtaConfig,
    secondaryCta: { label: 'Request a Quote', to: '/contact-us' } as CtaConfig,
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
    // Curated icon applied ONLY when a category with this exact real slug
    // is actually returned by the categories API (the store's real 12
    // top-level slugs, added via the taxonomy migration). Title/description
    // are intentionally NOT overridden here -- every category renders
    // honestly using its own real name/description from the API; nothing
    // here invents a category or its copy. Mirrors
    // e-commerce-web-store/src/config/homepage.config.ts's curatedBySlug
    // exactly (same slugs, same icon tags).
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

  featuredCollections: {
    // Admin-curated, is_featured=true product collections (Collections
    // admin page star toggle), each rendered as its own titled row using
    // the collection's own real name/description. Capped low -- mobile
    // screens are far more space-constrained than desktop (which shows up
    // to 3) -- so the home screen stays a tight scroll rather than a stack
    // of near-identical product shelves.
    maxCollections: 2,
    maxProductsPerRow: 8,
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
      to: '/contact-us',
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
    cta: { label: 'Talk to TechTools', to: '/contact-us' } as CtaConfig,
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
