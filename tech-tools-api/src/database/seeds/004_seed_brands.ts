import { query } from '../connection'

const brands = [
  {
    name: 'AutoTech Pro',
    slug: 'autotech-pro',
    description:
      'Premium automotive electronics and accessories. Known for innovative dash cams, GPS systems, and smart car gadgets with industry-leading warranties.',
    website_url: 'https://autotechpro.com',
  },
  {
    name: 'DriveMaster',
    slug: 'drivemaster',
    description:
      'Performance parts and accessories for enthusiasts. Specializing in air intakes, exhaust systems, and engine tuning components.',
    website_url: 'https://drivemastergear.com',
  },
  {
    name: 'LuxeRide',
    slug: 'luxeride',
    description:
      'Luxury car interior accessories and comfort products. Premium seat covers, organizers, and comfort-enhancing products.',
    website_url: 'https://luxeride.com',
  },
  {
    name: 'SafeGuard Auto',
    slug: 'safeguard-auto',
    description:
      'Leading manufacturer of automotive safety and security products. Dash cams, alarms, and monitoring systems.',
    website_url: 'https://safeguardauto.com',
  },
  {
    name: 'BrightBeam',
    slug: 'brightbeam',
    description:
      'Automotive lighting specialists. LED headlights, fog lights, interior lighting, and accent lights for all vehicle types.',
    website_url: 'https://brightbeamauto.com',
  },
  {
    name: 'CarCare Plus',
    slug: 'carcare-plus',
    description:
      'Professional grade car care and detailing products. Ceramic coatings, polishes, waxes, and cleaning supplies.',
    website_url: 'https://carcareplus.com',
  },
  {
    name: 'PowerDrive',
    slug: 'powerdrive',
    description:
      'Portable power solutions for vehicles. Jump starters, tire inflators, and emergency equipment.',
    website_url: 'https://powerdrive.com',
  },
  {
    name: 'SoundWave Audio',
    slug: 'soundwave-audio',
    description:
      'High-fidelity car audio systems and components. Speakers, amplifiers, head units, and sound deadening materials.',
    website_url: 'https://soundwaveaudio.com',
  },
]

export async function seedBrands() {
  console.log('🌱 Seeding brands...')

  for (const brand of brands) {
    // Check if brand already exists
    const existing = await query('SELECT id FROM brands WHERE slug = $1', [
      brand.slug,
    ])

    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO brands (name, slug, description, website_url, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [brand.name, brand.slug, brand.description, brand.website_url],
      )
      console.log(`  ✅ Created brand: ${brand.name}`)
    } else {
      console.log(`  ⏭️  Brand already exists: ${brand.name}`)
    }
  }

  console.log('✅ Brands seeded successfully!')
}

// Run directly if executed as script
if (require.main === module) {
  seedBrands()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err)
      process.exit(1)
    })
}
