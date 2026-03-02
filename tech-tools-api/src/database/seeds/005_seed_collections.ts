import { query } from '../connection'

const collections = [
  {
    name: 'Summer Road Trip Essentials',
    slug: 'summer-road-trip-essentials',
    description:
      'Everything you need for the perfect summer road trip. From entertainment systems to emergency gear, travel in comfort and style.',
    short_description:
      'Must-have gadgets and accessories for your summer adventures on the road.',
    is_featured: true,
    position: 1,
  },
  {
    name: 'Best Sellers',
    slug: 'best-sellers',
    description:
      'Our most popular products loved by thousands of customers. Top-rated items with proven performance and reliability.',
    short_description:
      'Customer favorites and top-rated automotive accessories.',
    is_featured: true,
    position: 2,
  },
  {
    name: 'New Arrivals',
    slug: 'new-arrivals',
    description:
      'Check out the latest additions to our catalog. Fresh products featuring the newest technology and innovations.',
    short_description: 'The latest products just added to our store.',
    is_featured: true,
    position: 3,
  },
  {
    name: 'Budget Friendly Picks',
    slug: 'budget-friendly-picks',
    description:
      "Quality automotive accessories that won't break the bank. Great value products without compromising on features.",
    short_description: 'Affordable accessories with excellent value for money.',
    is_featured: false,
    position: 4,
  },
  {
    name: 'Safety First Bundle',
    slug: 'safety-first-bundle',
    description:
      'Essential safety and security products for peace of mind on every journey. Dash cams, emergency tools, and monitoring systems.',
    short_description: 'Must-have safety equipment for your vehicle.',
    is_featured: true,
    position: 5,
  },
  {
    name: 'Tech Enthusiast Collection',
    slug: 'tech-enthusiast-collection',
    description:
      'Cutting-edge technology for the modern driver. Smart gadgets, connectivity solutions, and advanced electronics.',
    short_description: 'The latest tech gadgets for your connected car.',
    is_featured: false,
    position: 6,
  },
  {
    name: 'Interior Makeover',
    slug: 'interior-makeover',
    description:
      'Transform your car interior with premium accessories. Seat covers, organizers, lighting, and comfort upgrades.',
    short_description: 'Upgrade your car interior with style and comfort.',
    is_featured: false,
    position: 7,
  },
  {
    name: 'Weekend Warrior Kit',
    slug: 'weekend-warrior-kit',
    description:
      'For the weekend adventurer. Off-road accessories, recovery gear, and rugged equipment for any terrain.',
    short_description: 'Gear up for your off-road adventures.',
    is_featured: false,
    position: 8,
  },
]

export async function seedCollections() {
  console.log('🌱 Seeding collections...')

  for (const collection of collections) {
    // Check if collection already exists
    const existing = await query(
      'SELECT id FROM product_collections WHERE slug = $1',
      [collection.slug],
    )

    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO product_collections (
          name, slug, description, short_description, 
          is_active, is_featured, position, visibility
        ) VALUES ($1, $2, $3, $4, true, $5, $6, 'public')`,
        [
          collection.name,
          collection.slug,
          collection.description,
          collection.short_description,
          collection.is_featured,
          collection.position,
        ],
      )
      console.log(`  ✅ Created collection: ${collection.name}`)
    } else {
      console.log(`  ⏭️  Collection already exists: ${collection.name}`)
    }
  }

  console.log('✅ Collections seeded successfully!')
}

// Run directly if executed as script
if (require.main === module) {
  seedCollections()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err)
      process.exit(1)
    })
}
