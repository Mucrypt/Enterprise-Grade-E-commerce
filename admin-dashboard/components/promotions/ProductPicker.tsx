'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import type { Product } from '@/types'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ProductPickerProps {
  selectedProductIds: string[]
  onChange: (productIds: string[]) => void
}

/**
 * No reusable product picker existed before this phase (confirmed during
 * the build's own audit of the coupons page) -- built fresh here against
 * the existing GET /products endpoint, not a new one.
 */
export function ProductPicker({ selectedProductIds, onChange }: ProductPickerProps) {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'product-picker', search],
    queryFn: () => productService.getProducts({ search: search || undefined, limit: 25 }),
  })

  const products = data?.data?.items || []

  const toggle = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      onChange(selectedProductIds.filter((id) => id !== productId))
    } else {
      onChange([...selectedProductIds, productId])
    }
  }

  return (
    <div className='space-y-2'>
      <Input placeholder='Search products by name or SKU...' value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className='flex flex-wrap gap-1'>
        {selectedProductIds.map((id) => {
          const product = products.find((p: Product) => p.id === id)
          return (
            <Badge key={id} variant='secondary' className='cursor-pointer' onClick={() => toggle(id)}>
              {product?.name || id} &times;
            </Badge>
          )
        })}
      </div>
      <ScrollArea className='h-64 rounded-md border'>
        {isLoading ? (
          <p className='p-4 text-sm text-muted-foreground'>Loading products...</p>
        ) : products.length === 0 ? (
          <p className='p-4 text-sm text-muted-foreground'>No products found.</p>
        ) : (
          <ul className='divide-y'>
            {products.filter((product: Product): product is Product & { id: string } => Boolean(product.id)).map((product) => (
              <li key={product.id} className='flex items-center gap-3 px-3 py-2 hover:bg-muted/50'>
                <Checkbox
                  checked={selectedProductIds.includes(product.id)}
                  onCheckedChange={() => toggle(product.id)}
                  id={`product-${product.id}`}
                />
                <label htmlFor={`product-${product.id}`} className='flex-1 cursor-pointer text-sm'>
                  <div className='font-medium'>{product.name}</div>
                  <div className='text-xs text-muted-foreground'>{product.sku}</div>
                </label>
                <span className='text-sm tabular-nums'>
                  {typeof (product.salePrice ?? product.basePrice) === 'number' ? `€${(product.salePrice ?? product.basePrice).toFixed(2)}` : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
