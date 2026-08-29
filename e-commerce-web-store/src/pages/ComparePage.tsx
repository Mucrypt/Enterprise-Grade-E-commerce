// ============================================
// Product Comparison Page
// ============================================
// A real spec table -- price, rating, stock, and real attribute_values
// rows. Never a fabricated field for a product that lacks one; a missing
// value renders as "—", not a guess.

import { Link } from 'react-router-dom'
import { X, ArrowLeft } from 'lucide-react'
import { useCompareStore } from '../stores'
import { formatPrice, getProductImage } from '../utils'
import { getDisplayPricing } from '../utils/pricing'
import { StarRating } from '../components/ui/StarRating'
import { EmptyState } from '../components/ui/EmptyState'

export default function ComparePage() {
  const { items, removeItem, clearCompare } = useCompareStore()

  // Union of every attribute name present across the selected products,
  // in a stable order -- so the table has one row per real attribute
  // rather than one row per product's own (possibly differently-ordered) list.
  const attributeNames = Array.from(
    new Set(
      items.flatMap((p) => (p.attribute_values || []).map((av) => av.name)),
    ),
  )

  if (items.length === 0) {
    return (
      <div className='mx-auto max-w-3xl px-4 py-16'>
        <EmptyState
          title='Nothing to compare yet'
          description='Add products to comparison from any product card, then come back here.'
        />
        <div className='mt-6 text-center'>
          <Link to='/products' className='text-orange-500 hover:underline'>
            Browse products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-7xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <Link to='/products' className='flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500'>
            <ArrowLeft className='h-4 w-4' /> Back to products
          </Link>
          <h1 className='mt-2 text-2xl font-bold text-gray-900'>Compare Products</h1>
        </div>
        <button
          type='button'
          onClick={clearCompare}
          className='text-sm text-gray-500 hover:text-gray-700'
        >
          Clear all
        </button>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full min-w-160 border-separate border-spacing-0'>
          <thead>
            <tr>
              <th className='w-40' />
              {items.map((product) => (
                <th key={product.id} className='p-4 text-left align-top'>
                  <div className='relative'>
                    <button
                      type='button'
                      onClick={() => removeItem(product.id)}
                      aria-label={`Remove ${product.name} from comparison`}
                      className='absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200'
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                    <Link to={`/product/${product.slug}`}>
                      <img
                        src={getProductImage(product, { w: 160, h: 160 })}
                        alt={product.name}
                        className='mx-auto h-28 w-28 rounded-lg border object-contain p-2'
                      />
                      <p className='mt-2 line-clamp-2 text-sm font-medium text-gray-900 hover:text-orange-600'>
                        {product.name}
                      </p>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='divide-y'>
            <tr>
              <td className='p-4 text-sm font-medium text-gray-500'>Price</td>
              {items.map((product) => {
                const pricing = getDisplayPricing(product.base_price, product.sale_price)
                return (
                  <td key={product.id} className='p-4'>
                    <span className='font-bold text-orange-600'>{formatPrice(pricing.sellingPrice)}</span>
                    {pricing.compareAtPrice !== null && (
                      <span className='ml-2 text-sm text-gray-400 line-through'>
                        {formatPrice(pricing.compareAtPrice)}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>

            <tr>
              <td className='p-4 text-sm font-medium text-gray-500'>Rating</td>
              {items.map((product) => {
                const rating = typeof product.average_rating === 'string' ? parseFloat(product.average_rating) : product.average_rating
                const reviewCount = typeof product.review_count === 'string' ? parseInt(product.review_count, 10) : product.review_count
                const hasRealRating = !!rating && !!reviewCount && reviewCount > 0
                return (
                  <td key={product.id} className='p-4'>
                    {hasRealRating ? (
                      <div className='flex items-center gap-2'>
                        <StarRating rating={rating!} size='sm' />
                        <span className='text-sm text-gray-500'>({reviewCount})</span>
                      </div>
                    ) : (
                      <span className='text-sm text-gray-400'>—</span>
                    )}
                  </td>
                )
              })}
            </tr>

            <tr>
              <td className='p-4 text-sm font-medium text-gray-500'>Stock</td>
              {items.map((product) => (
                <td key={product.id} className='p-4 text-sm'>
                  {product.total_stock > 0 ? (
                    <span className='text-green-600'>In Stock</span>
                  ) : (
                    <span className='text-red-500'>Out of Stock</span>
                  )}
                </td>
              ))}
            </tr>

            <tr>
              <td className='p-4 text-sm font-medium text-gray-500'>Brand</td>
              {items.map((product) => (
                <td key={product.id} className='p-4 text-sm text-gray-700'>
                  {product.brand_name || '—'}
                </td>
              ))}
            </tr>

            {attributeNames.map((name) => (
              <tr key={name}>
                <td className='p-4 text-sm font-medium text-gray-500'>{name}</td>
                {items.map((product) => {
                  const value = (product.attribute_values || []).find((av) => av.name === name)
                  return (
                    <td key={product.id} className='p-4 text-sm text-gray-700'>
                      {value ? `${value.value}${value.unit ? ` ${value.unit}` : ''}` : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
