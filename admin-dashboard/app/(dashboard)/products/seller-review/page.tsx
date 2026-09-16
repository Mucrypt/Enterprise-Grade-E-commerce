'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Package, Check, Trash2, Store, ImageIcon } from 'lucide-react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { getAbsoluteMediaUrl } from '@/lib/utils'
import { sellerService, SellerPendingProduct } from '@/services/seller.service'

export default function SellerProductReviewPage() {
  return (
    <RequirePagePermission permission="catalog.view">
      <SellerProductReviewContent />
    </RequirePagePermission>
  )
}

function SellerProductReviewContent() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['seller-products-pending'],
    queryFn: () => sellerService.getPendingProducts(),
  })
  const products: SellerPendingProduct[] = data?.data || []

  const approveMutation = useMutation({
    mutationFn: (id: string) => sellerService.approveProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-products-pending'] })
      toast.success('Product approved and published')
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to approve product'),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => sellerService.rejectProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-products-pending'] })
      toast.success('Product rejected')
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to reject product'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="h-6 w-6" />
          Seller Products -- Pending Review
        </h1>
        <p className="text-sm text-muted-foreground">
          Real products a verified seller listed themselves. Nothing here is visible to shoppers
          or purchasable until you approve it.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Nothing pending review</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Products sellers list themselves will show up here for approval.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const thumbnail = getAbsoluteMediaUrl(
                product.images?.find((img) => img.is_primary)?.url || product.images?.[0]?.url,
              )
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    {thumbnail ? (
                      <Image src={thumbnail} alt={product.name} width={40} height={40} className="rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground">{product.sku}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Store className="h-3.5 w-3.5 text-muted-foreground" />
                      {product.seller_display_name || 'Seller'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">${Number(product.sale_price ?? product.base_price).toFixed(2)}</span>
                      {!!product.sale_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          ${Number(product.base_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{product.total_stock ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-600"
                        title="Approve and publish"
                        onClick={() => approveMutation.mutate(product.id)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Reject"
                        onClick={() => rejectMutation.mutate(product.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
