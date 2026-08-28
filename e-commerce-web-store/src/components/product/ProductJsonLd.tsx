import type { Product } from '../../types'
import { getDisplayPricing } from '../../utils/pricing'

interface ProductJsonLdProps {
  product: Product
  imageUrl: string
}

// Real fields only -- never emits average_rating/review_count into
// search-engine-visible markup unless the API actually returned real,
// review-backed values (same gate as RatingSummary).
export function ProductJsonLd({ product, imageUrl }: ProductJsonLdProps) {
  const pricing = getDisplayPricing(product.base_price, product.sale_price)
  const rating = typeof product.average_rating === 'string' ? parseFloat(product.average_rating) : product.average_rating
  const reviewCount = typeof product.review_count === 'string' ? parseInt(product.review_count, 10) : product.review_count
  const hasRealRating = !!rating && !!reviewCount && reviewCount > 0

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: imageUrl,
    description: product.short_description || product.description,
    sku: product.sku,
    ...(product.brand_name ? { brand: { '@type': 'Brand', name: product.brand_name } } : {}),
    offers: {
      '@type': 'Offer',
      price: pricing.sellingPrice.toFixed(2),
      priceCurrency: 'EUR',
      availability:
        product.total_stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(hasRealRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating!.toFixed(1),
            reviewCount: reviewCount,
          },
        }
      : {}),
  }

  return <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}
