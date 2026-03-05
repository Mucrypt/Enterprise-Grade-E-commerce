// ============================================
// Blog Seed Data - Production Ready
// ============================================

import { query } from '../connection'

// Blog Categories
const blogCategories = [
  {
    name: 'Product Reviews',
    slug: 'product-reviews',
    description: 'In-depth reviews of our latest car accessories and tech products',
    display_order: 1,
    meta_title: 'Product Reviews | TechTools Blog',
    meta_description: 'Expert reviews of car accessories, tech gadgets, and automotive products.',
  },
  {
    name: 'How-To Guides',
    slug: 'how-to-guides',
    description: 'Step-by-step tutorials for installation and maintenance',
    display_order: 2,
    meta_title: 'How-To Guides | TechTools Blog',
    meta_description: 'Learn how to install and maintain your car accessories with our detailed guides.',
  },
  {
    name: 'Industry News',
    slug: 'industry-news',
    description: 'Latest news and trends in automotive technology and accessories',
    display_order: 3,
    meta_title: 'Industry News | TechTools Blog',
    meta_description: 'Stay updated with the latest automotive industry news and trends.',
  },
  {
    name: 'Tips & Tricks',
    slug: 'tips-tricks',
    description: 'Expert advice to get the most out of your car accessories',
    display_order: 4,
    meta_title: 'Tips & Tricks | TechTools Blog',
    meta_description: 'Pro tips and tricks for car enthusiasts and accessory lovers.',
  },
  {
    name: 'Comparisons',
    slug: 'comparisons',
    description: 'Side-by-side comparisons to help you make the right choice',
    display_order: 5,
    meta_title: 'Product Comparisons | TechTools Blog',
    meta_description: 'Compare car accessories and find the best products for your needs.',
  },
  {
    name: 'Buying Guides',
    slug: 'buying-guides',
    description: 'Comprehensive guides to help you choose the perfect products',
    display_order: 6,
    meta_title: 'Buying Guides | TechTools Blog',
    meta_description: 'Complete buying guides for car accessories and automotive products.',
  },
]

// Blog Tags
const blogTags = [
  { name: 'LED Lights', slug: 'led-lights', description: 'Articles about LED lighting products' },
  { name: 'Installation', slug: 'installation', description: 'Installation guides and tips' },
  { name: 'Maintenance', slug: 'maintenance', description: 'Maintenance and care guides' },
  { name: 'Car Audio', slug: 'car-audio', description: 'Car audio and entertainment' },
  { name: 'GPS', slug: 'gps', description: 'Navigation and GPS devices' },
  { name: 'Dash Cams', slug: 'dash-cams', description: 'Dashboard cameras and recording' },
  { name: 'Phone Mounts', slug: 'phone-mounts', description: 'Smartphone holders and mounts' },
  { name: 'Wireless Charging', slug: 'wireless-charging', description: 'Wireless charging solutions' },
  { name: 'Interior', slug: 'interior', description: 'Interior accessories and styling' },
  { name: 'Exterior', slug: 'exterior', description: 'Exterior accessories and styling' },
  { name: 'Safety', slug: 'safety', description: 'Safety products and tips' },
  { name: 'Performance', slug: 'performance', description: 'Performance parts and upgrades' },
  { name: 'Budget-Friendly', slug: 'budget-friendly', description: 'Affordable product recommendations' },
  { name: 'Premium', slug: 'premium', description: 'High-end products and luxury accessories' },
  { name: 'DIY', slug: 'diy', description: 'Do-it-yourself projects' },
  { name: 'Tesla', slug: 'tesla', description: 'Tesla-specific accessories' },
  { name: 'Trucks', slug: 'trucks', description: 'Truck-specific accessories' },
  { name: 'SUV', slug: 'suv', description: 'SUV-specific accessories' },
  { name: 'Electric Vehicles', slug: 'electric-vehicles', description: 'EV-specific content' },
  { name: 'Classic Cars', slug: 'classic-cars', description: 'Classic and vintage car accessories' },
]

// Blog Authors
const blogAuthors = [
  {
    display_name: 'TechTools Team',
    slug: 'techtools-team',
    bio: 'The official TechTools editorial team, bringing you the latest in automotive accessories and technology.',
    role: 'editor',
  },
  {
    display_name: 'Mike Richardson',
    slug: 'mike-richardson',
    bio: 'Senior automotive journalist with 15 years of experience reviewing car accessories and tech gadgets. Former mechanic turned writer.',
    twitter_handle: '@mikeautotech',
    role: 'author',
  },
  {
    display_name: 'Sarah Chen',
    slug: 'sarah-chen',
    bio: 'Tech enthusiast and car audio specialist. Has tested over 500 car audio systems and counting.',
    twitter_handle: '@sarahcaraudio',
    role: 'author',
  },
  {
    display_name: 'David Martinez',
    slug: 'david-martinez',
    bio: 'DIY expert and installation specialist. Makes complex installations simple with easy-to-follow guides.',
    role: 'contributor',
  },
  {
    display_name: 'Emma Wilson',
    slug: 'emma-wilson',
    bio: 'Electric vehicle specialist focusing on EV accessories and the future of automotive technology.',
    linkedin_url: 'https://linkedin.com/in/emmawilsonev',
    role: 'author',
  },
]

// Sample Blog Posts
const blogPosts = [
  {
    title: 'The Ultimate Guide to LED Headlight Upgrades in 2024',
    slug: 'ultimate-guide-led-headlight-upgrades-2024',
    excerpt: 'Everything you need to know about upgrading your factory headlights to modern LED technology. Brighter, safer, and more efficient.',
    content: `
# The Ultimate Guide to LED Headlight Upgrades in 2024

If you're still driving with factory halogen headlights, you're missing out on one of the most impactful upgrades you can make to your vehicle. LED headlights offer superior brightness, longer lifespan, and better energy efficiency.

## Why Upgrade to LED Headlights?

There are several compelling reasons to make the switch:

### 1. Superior Brightness
LED headlights produce up to 300% more light than traditional halogen bulbs. This means better visibility at night and in adverse weather conditions.

### 2. Energy Efficiency
LEDs consume less power from your vehicle's electrical system, which can help improve fuel efficiency slightly and reduce strain on your alternator.

### 3. Longer Lifespan
While halogen bulbs last around 1,000 hours, quality LED headlights can last 30,000+ hours - essentially the lifetime of your vehicle.

### 4. Cooler Operation
Despite producing more light, LEDs generate less heat than halogen bulbs, reducing wear on your headlight housings.

## What to Look for in LED Headlights

When shopping for LED headlight upgrades, consider these factors:

- **Lumen output**: Look for at least 6,000 lumens per bulb
- **Color temperature**: 6000K provides a bright white light ideal for most conditions
- **Heat management**: Quality LEDs include built-in fans or heat sinks
- **CANBUS compatibility**: Essential for modern vehicles with onboard computers
- **Beam pattern**: Must match your headlight housing for proper light distribution

## Installation Tips

Most LED headlight upgrades are plug-and-play, but keep these tips in mind:

1. Always disconnect your battery before working on electrical components
2. Handle LED bulbs by the base, not the LED chips
3. Ensure proper bulb orientation for correct beam pattern
4. Test both low and high beams after installation
5. Adjust your headlight aim if necessary

## Our Top Picks for 2024

We've tested dozens of LED headlight kits and these are our favorites based on brightness, durability, and value.
    `,
    content_html: '<h1>The Ultimate Guide to LED Headlight Upgrades in 2024</h1>...',
    category_slug: 'buying-guides',
    author_slug: 'mike-richardson',
    tags: ['led-lights', 'installation', 'safety'],
    status: 'published',
    is_featured: true,
    reading_time_minutes: 8,
    meta_title: 'Ultimate LED Headlight Upgrade Guide 2024 | TechTools',
    meta_description: 'Complete guide to upgrading your car headlights to LED. Learn about brightness, installation, and our top picks for 2024.',
  },
  {
    title: 'How to Install a Dash Cam: Complete Step-by-Step Guide',
    slug: 'how-to-install-dash-cam-complete-guide',
    excerpt: 'Learn how to professionally install a dash cam in your vehicle with our detailed guide. Includes hardwiring options for a clean look.',
    content: `
# How to Install a Dash Cam: Complete Step-by-Step Guide

A dash cam is one of the most valuable safety accessories you can add to your vehicle. This guide will walk you through both basic and advanced installation methods.

## Why You Need a Dash Cam

Before we dive into installation, here's why every driver should have a dash cam:

- **Evidence in accidents**: Protect yourself from false claims
- **Insurance benefits**: Some insurers offer discounts for dash cam users
- **Capture memorable moments**: Record scenic drives and road trips
- **Monitor parked vehicles**: Many cameras offer parking mode surveillance

## Basic Installation (Plug & Play)

The simplest method takes just 10 minutes:

### What You'll Need
- Dash cam with suction or adhesive mount
- 12V power adapter
- microSD card

### Steps
1. Clean your windshield where you'll mount the camera
2. Attach the mount behind your rearview mirror
3. Route the power cable along the headliner and down the A-pillar
4. Plug into your 12V outlet
5. Insert microSD card and configure settings

## Advanced Installation (Hardwiring)

For a cleaner look and parking mode functionality:

### Additional Tools Needed
- Add-a-fuse adapter
- Trim removal tools
- Hardwire kit with fuse taps

### Steps
1. Locate your vehicle's fuse box
2. Identify an ACC fuse for camera power
3. Find a constant 12V fuse for parking mode
4. Connect ground wire to chassis
5. Route all cables behind trim panels
6. Test all functions before finalizing

## Pro Tips for the Best Results

- Mount the camera center and high for the best view
- Ensure the camera doesn't obstruct your driving view
- Format your SD card monthly for optimal performance
- Consider a camera with GPS for speed and location data
    `,
    content_html: '<h1>How to Install a Dash Cam: Complete Step-by-Step Guide</h1>...',
    category_slug: 'how-to-guides',
    author_slug: 'david-martinez',
    tags: ['dash-cams', 'installation', 'diy', 'safety'],
    status: 'published',
    is_featured: false,
    reading_time_minutes: 12,
    meta_title: 'How to Install a Dash Cam | Step-by-Step Guide',
    meta_description: 'Professional dash cam installation guide. Learn plug-and-play and hardwiring methods for a clean, reliable setup.',
  },
  {
    title: 'Best Wireless Phone Chargers for Cars in 2024: Tested & Reviewed',
    slug: 'best-wireless-phone-chargers-cars-2024',
    excerpt: 'We tested 20 wireless car chargers to find the fastest, most reliable options. Here are our top picks for every budget.',
    content: `
# Best Wireless Phone Chargers for Cars in 2024

Gone are the days of fumbling with cables while driving. Modern wireless car chargers offer fast, convenient charging while keeping your phone accessible for navigation.

## How We Tested

We evaluated 20 wireless car chargers over 6 months, testing:

- Charging speed with various phones
- Mount stability on rough roads  
- Heat management during charging
- Ease of one-handed operation
- Build quality and durability

## Our Top Picks

### Best Overall: ProMount Qi Max 15W

**Price**: $49.99 | **Rating**: ★★★★★

This mount delivers it all - 15W fast charging, rock-solid stability, and a premium build. The auto-sensing arms grip your phone instantly and the infrared sensor releases with a touch.

**Pros:**
- True 15W fast charging for compatible devices
- Extremely stable even on rough roads
- Premium aluminum construction

**Cons:**
- Higher price point
- Large size may not fit all vehicles

### Best Value: ChargeTech Classic

**Price**: $24.99 | **Rating**: ★★★★☆

Don't let the price fool you - this charger outperformed many premium options in our testing. Perfect for buyers who want reliable wireless charging without breaking the bank.

### Best for Trucks & SUVs: MagnaDock Pro

**Price**: $59.99 | **Rating**: ★★★★★

Designed for larger vehicles with its extra-long gooseneck arm and heavy-duty suction mount. The magnetic alignment ensures perfect placement every time.

## Wireless Charging FAQ

**Q: Will wireless charging damage my phone's battery?**
A: No, modern phones have built-in safeguards. However, remove thick cases for best charging speeds.

**Q: How fast is wireless charging compared to cable?**
A: With a 15W charger and compatible phone, you'll get about 80% of wired charging speeds.
    `,
    content_html: '<h1>Best Wireless Phone Chargers for Cars in 2024</h1>...',
    category_slug: 'product-reviews',
    author_slug: 'sarah-chen',
    tags: ['wireless-charging', 'phone-mounts', 'interior'],
    status: 'published',
    is_featured: true,
    reading_time_minutes: 10,
    meta_title: 'Best Wireless Car Phone Chargers 2024 | Expert Reviews',
    meta_description: '20 wireless car chargers tested and reviewed. Find the best wireless phone charger for your car with our buying guide.',
  },
  {
    title: 'Tesla Accessories Every Owner Should Have',
    slug: 'tesla-accessories-every-owner-should-have',
    excerpt: 'From must-have essentials to cool gadgets, these Tesla accessories will enhance your EV ownership experience.',
    content: `
# Tesla Accessories Every Owner Should Have

Congratulations on your Tesla! While these vehicles come packed with features, there are several accessories that can make ownership even better.

## Must-Have Essentials

### 1. All-Weather Floor Mats

Your Tesla's carpet floor mats are great for showrooms but not so much for real life. Quality all-weather mats protect against rain, snow, mud, and spills.

**Our Pick**: TeslaShield 3D Floor Mats - $149

### 2. Screen Protector

That beautiful touchscreen is central to your Tesla experience. A tempered glass protector prevents scratches and reduces glare.

### 3. Center Console Organizer

The Model 3 and Y have deep center consoles that can become black holes for small items. An organizer adds compartments for coins, cards, and more.

### 4. Charging Port Adapter

If you're traveling outside the Supercharger network, a J1772 adapter ensures you can charge anywhere.

## Cool Gadgets

### Wireless Controller for Gaming

Tesla's built-in video games are more fun with a proper controller. Any Bluetooth controller works - we recommend PlayStation or Xbox controllers.

### USB SSD for Dashcam & Sentry Mode

Stop relying on cheap USB drives. A quality SSD offers faster, more reliable recording for TeslaCam footage.

### Ambient Lighting Kits

Want to add some mood lighting? LED strips designed for Tesla integrate seamlessly and add interior ambiance.

## Exterior Upgrades

### Ceramic Coating

Protect that paint! A professional ceramic coating makes cleaning easier and adds years of protection.

### Wheel Covers & Caps

Upgrade from the stock aero wheels or add center caps displaying your preferred logo.
    `,
    content_html: '<h1>Tesla Accessories Every Owner Should Have</h1>...',
    category_slug: 'buying-guides',
    author_slug: 'emma-wilson',
    tags: ['tesla', 'electric-vehicles', 'interior', 'exterior'],
    status: 'published',
    is_featured: false,
    reading_time_minutes: 7,
    meta_title: 'Best Tesla Accessories 2024 | Must-Have Essentials',
    meta_description: 'Essential Tesla accessories every owner needs. Floor mats, screen protectors, charging accessories and more.',
  },
  {
    title: 'Car Audio 101: Understanding Speakers, Amplifiers, and Subwoofers',
    slug: 'car-audio-101-speakers-amplifiers-subwoofers',
    excerpt: 'New to car audio? This beginner\'s guide explains everything you need to know about upgrading your vehicle\'s sound system.',
    content: `
# Car Audio 101: Understanding Speakers, Amplifiers, and Subwoofers

Factory car audio systems are designed for cost, not quality. Even budget upgrades can dramatically improve your listening experience.

## Understanding Car Speakers

### Component vs. Coaxial

**Coaxial speakers** combine woofer, tweeter, and sometimes a midrange in one unit. They're affordable and easy to install.

**Component speakers** separate these elements for better sound staging but require more complex installation.

### Speaker Specifications Explained

- **RMS Power**: The continuous power a speaker can handle (more important than peak power)
- **Sensitivity**: How loud a speaker plays with a given amount of power
- **Frequency Response**: The range of sounds a speaker can reproduce

## Amplifiers: Why You Need One

Even upgraded speakers benefit from a dedicated amplifier:

### Benefits of Adding an Amplifier

1. Cleaner power delivery
2. Higher volume without distortion
3. Better bass response
4. Improved overall sound quality

### How to Size Your Amp

Match your amplifier's RMS output to your speakers' RMS handling for optimal performance.

## Subwoofers: Adding Bass

A subwoofer reproduces low frequencies that regular speakers can't handle:

### Types of Subwoofers

- **Enclosed subs**: Ready to install, take up cargo space
- **Under-seat subs**: Compact, minimal installation
- **Custom installations**: Best sound, most work

### Subwoofer Specifications

- **Size**: 10" and 12" are most popular
- **Enclosure type**: Sealed (tight bass) vs. ported (louder bass)
- **Power handling**: Match to your amplifier

## Building Your System

Start with speakers, add an amplifier, then consider a subwoofer. This progression gives you the best return on investment while building toward a complete system.
    `,
    content_html: '<h1>Car Audio 101: Understanding Speakers, Amplifiers, and Subwoofers</h1>...',
    category_slug: 'how-to-guides',
    author_slug: 'sarah-chen',
    tags: ['car-audio', 'installation', 'interior'],
    status: 'published',
    is_featured: false,
    reading_time_minutes: 9,
    meta_title: 'Car Audio 101 | Speakers, Amps & Subs Explained',
    meta_description: 'Beginner guide to car audio upgrades. Learn about speakers, amplifiers, and subwoofers to build your perfect sound system.',
  },
  {
    title: '2024 Automotive Tech Trends: What\'s Coming Next',
    slug: '2024-automotive-tech-trends-whats-coming',
    excerpt: 'From AI-powered dash cams to advanced wireless charging, here\'s what\'s trending in automotive technology for 2024.',
    content: `
# 2024 Automotive Tech Trends: What's Coming Next

The automotive accessory market is evolving rapidly. Here are the trends shaping the future of car tech.

## AI-Powered Everything

### Smart Dash Cams

Modern dash cams are incorporating AI for features like:

- Automatic incident detection
- Driver fatigue monitoring
- Lane departure warnings
- Collision warnings

### Voice Assistants

Beyond factory systems, aftermarket voice assistants are becoming more capable and integrated.

## Advanced Connectivity

### 5G Integration

Future car accessories will leverage 5G for:

- Real-time cloud processing
- Over-the-air updates
- Enhanced streaming quality
- Vehicle-to-everything (V2X) communication

### Wireless Android Auto & CarPlay

More aftermarket head units now support wireless smartphone integration, eliminating cables completely.

## Sustainable Products

### Eco-Friendly Materials

Manufacturers are increasingly using:

- Recycled plastics
- Sustainable packaging
- Carbon-neutral production

### Solar-Powered Accessories

Solar-powered tire pressure monitors, battery maintainers, and even dash cams are entering the market.

## What This Means for Consumers

The best time to upgrade your vehicle's tech is now. Today's products are more capable, more connected, and more affordable than ever.

Stay tuned as we review and test these emerging technologies throughout the year.
    `,
    content_html: '<h1>2024 Automotive Tech Trends: What\'s Coming Next</h1>...',
    category_slug: 'industry-news',
    author_slug: 'techtools-team',
    tags: ['electric-vehicles', 'dash-cams', 'wireless-charging'],
    status: 'published',
    is_featured: false,
    reading_time_minutes: 6,
    meta_title: '2024 Automotive Tech Trends | TechTools Blog',
    meta_description: 'Discover the latest automotive technology trends for 2024. AI dash cams, 5G connectivity, and sustainable products.',
  },
]

// Seed function
export async function seedBlog() {
  console.log('🌱 Seeding blog data...')

  // Seed Categories
  console.log('  📁 Seeding blog categories...')
  const categoryIds: Record<string, string> = {}

  for (const category of blogCategories) {
    const existing = await query('SELECT id FROM blog_categories WHERE slug = $1', [category.slug])

    if (existing.rows.length === 0) {
      const result = await query(
        `INSERT INTO blog_categories (name, slug, description, display_order, meta_title, meta_description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id`,
        [category.name, category.slug, category.description, category.display_order, category.meta_title, category.meta_description]
      )
      categoryIds[category.slug] = result.rows[0].id
      console.log(`    ✅ Created category: ${category.name}`)
    } else {
      categoryIds[category.slug] = existing.rows[0].id
      console.log(`    ⏭️  Category exists: ${category.name}`)
    }
  }

  // Seed Tags
  console.log('  🏷️  Seeding blog tags...')
  const tagIds: Record<string, string> = {}

  for (const tag of blogTags) {
    const existing = await query('SELECT id FROM blog_tags WHERE slug = $1', [tag.slug])

    if (existing.rows.length === 0) {
      const result = await query(
        `INSERT INTO blog_tags (name, slug, description)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [tag.name, tag.slug, tag.description]
      )
      tagIds[tag.slug] = result.rows[0].id
      console.log(`    ✅ Created tag: ${tag.name}`)
    } else {
      tagIds[tag.slug] = existing.rows[0].id
      console.log(`    ⏭️  Tag exists: ${tag.name}`)
    }
  }

  // Seed Authors
  console.log('  ✍️  Seeding blog authors...')
  const authorIds: Record<string, string> = {}

  for (const author of blogAuthors) {
    const existing = await query('SELECT id FROM blog_authors WHERE slug = $1', [author.slug])

    if (existing.rows.length === 0) {
      const result = await query(
        `INSERT INTO blog_authors (display_name, slug, bio, twitter_handle, linkedin_url, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id`,
        [author.display_name, author.slug, author.bio, author.twitter_handle || null, author.linkedin_url || null, author.role]
      )
      authorIds[author.slug] = result.rows[0].id
      console.log(`    ✅ Created author: ${author.display_name}`)
    } else {
      authorIds[author.slug] = existing.rows[0].id
      console.log(`    ⏭️  Author exists: ${author.display_name}`)
    }
  }

  // Seed Posts
  console.log('  📝 Seeding blog posts...')

  for (const post of blogPosts) {
    const existing = await query('SELECT id FROM blog_posts WHERE slug = $1', [post.slug])

    if (existing.rows.length === 0) {
      const categoryId = categoryIds[post.category_slug]
      const authorId = authorIds[post.author_slug]

      if (!categoryId || !authorId) {
        console.log(`    ⚠️  Skipping post (missing category or author): ${post.title}`)
        continue
      }

      const result = await query(
        `INSERT INTO blog_posts (
          title, slug, excerpt, content, content_html,
          category_id, author_id, status, is_featured,
          reading_time_minutes, meta_title, meta_description,
          published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          post.title, post.slug, post.excerpt, post.content, post.content_html,
          categoryId, authorId, post.status, post.is_featured,
          post.reading_time_minutes, post.meta_title, post.meta_description
        ]
      )

      const postId = result.rows[0].id

      // Add tags
      for (const tagSlug of post.tags) {
        const tagId = tagIds[tagSlug]
        if (tagId) {
          await query(
            'INSERT INTO blog_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [postId, tagId]
          )
        }
      }

      console.log(`    ✅ Created post: ${post.title}`)
    } else {
      console.log(`    ⏭️  Post exists: ${post.title}`)
    }
  }

  console.log('✅ Blog data seeded successfully!')
}

// Run directly if executed as script
if (require.main === module) {
  seedBlog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Blog seed failed:', err)
      process.exit(1)
    })
}
