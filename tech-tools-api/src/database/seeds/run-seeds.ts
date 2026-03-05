import { seedCategories } from './002_seed_categories'
import { seedProducts } from './003_seed_products'
import { seedBrands } from './004_seed_brands'
import { seedCollections } from './005_seed_collections'
import { seedBlog } from './006_seed_blog'

async function runAllSeeds() {
  console.log('🚀 Starting database seeding...\n')

  try {
    // Seed in order (brands and categories first, then products, then collections)
    await seedBrands()
    console.log('')
    await seedCategories()
    console.log('')
    await seedProducts()
    console.log('')
    await seedCollections()
    console.log('')
    await seedBlog()

    console.log('\n🎉 All seeds completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

runAllSeeds()
