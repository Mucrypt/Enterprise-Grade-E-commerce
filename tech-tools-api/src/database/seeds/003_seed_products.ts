import { query } from '../connection'

interface ProductSeed {
  sku: string
  name: string
  slug: string
  description: string
  short_description: string
  category_slug: string
  brand_slug?: string
  base_price: number
  sale_price?: number
  cost_price: number
  weight: number
  is_featured?: boolean
  initial_stock: number
  specifications?: Record<string, string>
}

const products: ProductSeed[] = [
  {
    sku: 'CAR-AUD-001',
    name: 'Premium 7" Touchscreen Car Stereo with Apple CarPlay & Android Auto',
    slug: 'premium-7inch-touchscreen-car-stereo',
    description: `Transform your driving experience with this premium 7-inch touchscreen car stereo. Features seamless integration with Apple CarPlay and Android Auto for hands-free navigation, calls, and music. High-resolution IPS display with anti-glare coating for perfect visibility in any lighting condition.`,
    short_description:
      '7" HD touchscreen stereo with wireless CarPlay & Android Auto, Bluetooth 5.0, and backup camera input.',
    category_slug: 'audio-entertainment',
    brand_slug: 'soundwave-audio',
    base_price: 249.99,
    sale_price: 199.99,
    cost_price: 120.0,
    weight: 1.2,
    is_featured: true,
    initial_stock: 50,
    specifications: {
      'Screen Size': '7 inches',
      Resolution: '1024x600 HD',
      Bluetooth: '5.0',
      'USB Ports': '2',
      'Power Output': '4x50W',
    },
  },
  {
    sku: 'CAR-DASH-002',
    name: '4K Dual Dash Cam with Night Vision & GPS',
    slug: '4k-dual-dash-cam-night-vision-gps',
    description: `Protect yourself on the road with this professional-grade 4K dual dash cam system. Records both front and rear simultaneously in stunning 4K resolution. Advanced Sony STARVIS sensor provides crystal clear night vision. Built-in GPS tracks your location and speed. Includes parking mode with motion detection.`,
    short_description:
      'Dual 4K dash cam with Sony STARVIS night vision, GPS tracking, and 24/7 parking surveillance.',
    category_slug: 'safety-security',
    brand_slug: 'safeguard-auto',
    base_price: 189.99,
    sale_price: 159.99,
    cost_price: 85.0,
    weight: 0.35,
    is_featured: true,
    initial_stock: 75,
    specifications: {
      'Front Resolution': '4K UHD (3840x2160)',
      'Rear Resolution': '1080P Full HD',
      'Field of View': '170° Front, 140° Rear',
      Storage: 'Up to 256GB microSD',
      GPS: 'Built-in',
    },
  },
  {
    sku: 'CAR-LED-003',
    name: 'H11 LED Headlight Bulbs 20000LM 6500K White (Pair)',
    slug: 'h11-led-headlight-bulbs-20000lm',
    description: `Upgrade your vehicle's visibility with these ultra-bright H11 LED headlight bulbs. Producing 20,000 lumens per pair with a crisp 6500K white light, these bulbs are 300% brighter than halogen. Fanless design ensures silent operation and longer lifespan. Plug-and-play installation in under 10 minutes.`,
    short_description:
      'H11 LED bulbs with 20000LM brightness, 6500K white light, fanless design, and 50000hr lifespan.',
    category_slug: 'lighting',
    brand_slug: 'brightbeam',
    base_price: 59.99,
    sale_price: 44.99,
    cost_price: 18.0,
    weight: 0.25,
    is_featured: false,
    initial_stock: 200,
    specifications: {
      'Bulb Type': 'H11/H8/H9',
      Lumens: '20000LM (per pair)',
      'Color Temperature': '6500K White',
      Lifespan: '50000 hours',
      Wattage: '60W (per pair)',
    },
  },
  {
    sku: 'CAR-CHRG-004',
    name: 'Wireless Car Charger Mount with Auto-Clamping',
    slug: 'wireless-car-charger-mount-auto-clamping',
    description: `The ultimate phone mount and charger combo. Auto-clamping mechanism secures your phone with one hand. Delivers 15W fast wireless charging for Qi-enabled devices. 360° rotation for perfect viewing angle. Includes both dashboard mount and air vent clip.`,
    short_description:
      '15W fast wireless car charger with auto-clamping, 360° rotation, and dual mounting options.',
    category_slug: 'phone-gps-mounts',
    brand_slug: 'autotech-pro',
    base_price: 49.99,
    sale_price: 39.99,
    cost_price: 15.0,
    weight: 0.3,
    is_featured: true,
    initial_stock: 120,
    specifications: {
      'Charging Power': '15W/10W/7.5W/5W',
      Compatibility: 'All Qi-enabled phones',
      'Mount Type': 'Dashboard & Air Vent',
      Rotation: '360°',
      'Auto-Clamp': 'Yes',
    },
  },
  {
    sku: 'CAR-SEAT-005',
    name: 'Heated & Cooled Car Seat Cushion with Massage',
    slug: 'heated-cooled-car-seat-cushion-massage',
    description: `Experience ultimate comfort on every drive. This premium seat cushion features both heating and cooling functions with 3 intensity levels each. Built-in vibration massage targets key pressure points. Memory foam construction with breathable mesh cover. Universal fit for most vehicles.`,
    short_description:
      'All-season car seat cushion with heating, cooling, massage, and premium memory foam construction.',
    category_slug: 'interior-comfort',
    brand_slug: 'luxeride',
    base_price: 89.99,
    sale_price: 74.99,
    cost_price: 35.0,
    weight: 1.8,
    is_featured: false,
    initial_stock: 60,
    specifications: {
      'Heating Levels': '3 (Low/Med/High)',
      'Cooling Levels': '3 (Low/Med/High)',
      'Massage Zones': '6',
      Material: 'Memory Foam + Breathable Mesh',
      Power: '12V DC',
    },
  },
  {
    sku: 'CAR-TIRE-006',
    name: 'Digital Tire Inflator Portable Air Compressor',
    slug: 'digital-tire-inflator-portable-compressor',
    description: `Never get stranded with a flat tire again. This powerful portable air compressor inflates a standard car tire in under 5 minutes. Digital LCD display for accurate pressure reading. Auto-shutoff at preset pressure. Includes multiple nozzles for bikes, sports equipment, and inflatables.`,
    short_description:
      'Portable 150 PSI air compressor with digital gauge, auto-shutoff, and LED emergency light.',
    category_slug: 'tools-emergency',
    brand_slug: 'powerdrive',
    base_price: 44.99,
    cost_price: 18.0,
    weight: 0.9,
    is_featured: false,
    initial_stock: 90,
    specifications: {
      'Max Pressure': '150 PSI',
      'Air Flow': '35L/min',
      'Power Source': '12V DC + Rechargeable Battery',
      Display: 'LCD Digital',
      'Auto Shutoff': 'Yes',
    },
  },
  {
    sku: 'CAR-COAT-007',
    name: 'Ceramic Coating Spray 9H Hardness Protection',
    slug: 'ceramic-coating-spray-9h-protection',
    description: `Professional-grade ceramic coating in an easy spray-on formula. Creates a hydrophobic barrier with 9H hardness to protect your paint from scratches, UV damage, and contaminants. Lasts up to 12 months with proper maintenance. Safe for all paint types and clear coats.`,
    short_description:
      'Professional ceramic spray coating with 9H hardness, hydrophobic protection, and 12-month durability.',
    category_slug: 'cleaning-maintenance',
    brand_slug: 'carcare-plus',
    base_price: 34.99,
    sale_price: 29.99,
    cost_price: 12.0,
    weight: 0.5,
    is_featured: false,
    initial_stock: 150,
    specifications: {
      Hardness: '9H',
      Duration: 'Up to 12 months',
      Coverage: '2-3 vehicles per bottle',
      Volume: '500ml',
      'Water Contact Angle': '110°+',
    },
  },
  {
    sku: 'CAR-PERF-008',
    name: 'Cold Air Intake Kit with High-Flow Filter',
    slug: 'cold-air-intake-kit-high-flow-filter',
    description: `Unlock your engine's true potential with this cold air intake system. High-flow washable filter increases airflow by up to 50%. Mandrel-bent aluminum tubing for smooth air delivery. Dyno-proven gains of 10-15 horsepower. Reusable filter saves money over time.`,
    short_description:
      'Performance cold air intake with washable K&N-style filter for 10-15 HP gains.',
    category_slug: 'performance-parts',
    brand_slug: 'drivemaster',
    base_price: 149.99,
    sale_price: 124.99,
    cost_price: 55.0,
    weight: 3.5,
    is_featured: true,
    initial_stock: 35,
    specifications: {
      Material: '6061 Aluminum',
      Filter: 'High-Flow Washable Cotton',
      'HP Gain': '10-15 HP',
      Fitment: 'Universal (2.5" to 4" inlet)',
      Includes: 'All mounting hardware & hoses',
    },
  },
  {
    sku: 'CAR-MIRR-009',
    name: 'Wide Angle Blind Spot Mirror Set (2-Pack)',
    slug: 'wide-angle-blind-spot-mirror-set',
    description: `Eliminate dangerous blind spots with these convex mirrors. 360° adjustable rotation for perfect positioning. Premium HD glass with anti-glare coating. Waterproof and weather-resistant. Strong adhesive backing for easy installation on any side mirror.`,
    short_description:
      '360° adjustable blind spot mirrors with HD anti-glare glass and waterproof design.',
    category_slug: 'exterior-accessories',
    brand_slug: 'autotech-pro',
    base_price: 12.99,
    sale_price: 9.99,
    cost_price: 3.0,
    weight: 0.1,
    is_featured: false,
    initial_stock: 300,
    specifications: {
      Shape: 'Round Convex',
      Diameter: '2 inches',
      Adjustment: '360° Rotation',
      Material: 'HD Glass + ABS Frame',
      Quantity: '2 Pack',
    },
  },
  {
    sku: 'CAR-JUMP-010',
    name: 'Portable Jump Starter Power Bank 2000A Peak',
    slug: 'portable-jump-starter-power-bank-2000a',
    description: `The ultimate emergency power solution. Jump starts up to 8.0L gas or 6.0L diesel engines with 2000A peak power. Built-in 20000mAh power bank charges all your devices. LED flashlight with strobe and SOS modes. Compact enough to fit in your glove box.`,
    short_description:
      '2000A portable jump starter with 20000mAh power bank, LED flashlight, and safety protection.',
    category_slug: 'tools-emergency',
    brand_slug: 'powerdrive',
    base_price: 99.99,
    sale_price: 79.99,
    cost_price: 40.0,
    weight: 0.8,
    is_featured: true,
    initial_stock: 80,
    specifications: {
      'Peak Current': '2000A',
      'Battery Capacity': '20000mAh',
      'Engine Support': 'Up to 8.0L Gas / 6.0L Diesel',
      'USB Outputs': 'USB-A QC3.0 + USB-C PD',
      'LED Flashlight': 'Yes (with SOS mode)',
    },
  },
]

export async function seedProducts() {
  console.log('🌱 Seeding products...')

  for (const product of products) {
    // Check if product already exists
    const existing = await query('SELECT id FROM products WHERE sku = $1', [
      product.sku,
    ])

    if (existing.rows.length > 0) {
      console.log(`  ⏭️  Product already exists: ${product.name}`)
      continue
    }

    // Get category ID
    const categoryResult = await query(
      'SELECT id FROM categories WHERE slug = $1',
      [product.category_slug],
    )

    if (categoryResult.rows.length === 0) {
      console.log(
        `  ⚠️  Category not found: ${product.category_slug}, skipping ${product.name}`,
      )
      continue
    }

    const categoryId = categoryResult.rows[0].id

    // Get brand ID if specified
    let brandId = null
    if (product.brand_slug) {
      const brandResult = await query('SELECT id FROM brands WHERE slug = $1', [
        product.brand_slug,
      ])
      if (brandResult.rows.length > 0) {
        brandId = brandResult.rows[0].id
      }
    }

    // Insert product
    const productResult = await query(
      `INSERT INTO products (
        sku, name, slug, description, short_description,
        category_id, brand_id, base_price, sale_price, cost_price,
        weight, weight_unit, is_active, is_featured
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'kg', true, $12)
      RETURNING id`,
      [
        product.sku,
        product.name,
        product.slug,
        product.description,
        product.short_description,
        categoryId,
        brandId,
        product.base_price,
        product.sale_price || null,
        product.cost_price,
        product.weight,
        product.is_featured || false,
      ],
    )

    const productId = productResult.rows[0].id

    // Insert inventory
    await query(
      `INSERT INTO inventory (product_id, warehouse_location, current_stock, low_stock_threshold)
       VALUES ($1, 'Main Warehouse', $2, 10)`,
      [productId, product.initial_stock],
    )

    // Insert specifications if any
    if (product.specifications) {
      for (const [key, value] of Object.entries(product.specifications)) {
        await query(
          `INSERT INTO product_specifications (product_id, spec_name, spec_value)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [productId, key, value],
        )
      }
    }

    console.log(`  ✅ Created product: ${product.name}`)
  }

  console.log('✅ Products seeded successfully!')
}

// Run directly if executed as script
if (require.main === module) {
  seedProducts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err)
      process.exit(1)
    })
}
