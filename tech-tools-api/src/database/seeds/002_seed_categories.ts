import { query } from '../connection'

const categories = [
  {
    name: 'Audio & Entertainment',
    slug: 'audio-entertainment',
    description:
      'Car speakers, head units, amplifiers, and entertainment systems',
    display_order: 5,
  },
  {
    name: 'Exterior Accessories',
    slug: 'exterior-accessories',
    description: 'Body kits, spoilers, mirrors, and exterior styling products',
    display_order: 6,
  },
  {
    name: 'Lighting',
    slug: 'lighting',
    description:
      'LED headlights, fog lights, interior lights, and accent lighting',
    display_order: 7,
  },
  {
    name: 'Cleaning & Maintenance',
    slug: 'cleaning-maintenance',
    description: 'Car wash supplies, polishes, waxes, and detailing products',
    display_order: 8,
  },
  {
    name: 'Phone & GPS Mounts',
    slug: 'phone-gps-mounts',
    description: 'Smartphone holders, GPS mounts, and wireless charging pads',
    display_order: 9,
  },
  {
    name: 'Performance Parts',
    slug: 'performance-parts',
    description: 'Air filters, exhausts, chip tuners, and performance upgrades',
    display_order: 10,
  },
]

export async function seedCategories() {
  console.log('🌱 Seeding categories...')

  for (const category of categories) {
    // Check if category already exists
    const existing = await query('SELECT id FROM categories WHERE slug = $1', [
      category.slug,
    ])

    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO categories (name, slug, description, display_order, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [
          category.name,
          category.slug,
          category.description,
          category.display_order,
        ],
      )
      console.log(`  ✅ Created category: ${category.name}`)
    } else {
      console.log(`  ⏭️  Category already exists: ${category.name}`)
    }
  }

  console.log('✅ Categories seeded successfully!')
}

// Run directly if executed as script
if (require.main === module) {
  seedCategories()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err)
      process.exit(1)
    })
}
