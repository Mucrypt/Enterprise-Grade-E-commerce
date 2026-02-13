'use client'

import { EnhancedProductForm } from '@/components/products/EnhancedProductForm'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function NewProductPage() {
  return (
    <TooltipProvider>
      <EnhancedProductForm mode='create' />
    </TooltipProvider>
  )
}
