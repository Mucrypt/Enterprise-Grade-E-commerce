'use client'

import { ProductForm } from '@/components/products/ProductForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NewProductPage() {
  return (
    <div className='space-y-6 max-w-4xl'>
      <div className='flex items-center gap-4'>
        <Link href='/products'>
          <Button variant='ghost' size='icon'>
            <ArrowLeft className='w-5 h-5' />
          </Button>
        </Link>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
            Create New Product
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-2'>
            Add a new product to your catalog with images and details
          </p>
        </div>
      </div>

      <ProductForm />
    </div>
  )
}
