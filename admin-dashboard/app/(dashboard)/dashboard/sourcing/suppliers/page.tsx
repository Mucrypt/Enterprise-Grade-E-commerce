'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService from '@/services/sourcing.service'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, ExternalLink, Search } from 'lucide-react'

/**
 * SOURCING-1 -- who you've actually been buying from. Alibaba pages
 * include the supplier/manufacturer name (see alibaba.js's
 * extractSupplierName), so this rolls that up across every capture --
 * directly serves the founder's original "build trust with suppliers"
 * goal by making repeat-supplier patterns visible instead of buried in
 * individual drafts.
 */
function SourcingSuppliersPageContent() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sourcing', 'suppliers'],
    queryFn: () => sourcingService.listSuppliers(),
  })

  const suppliers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = data?.suppliers || []
    if (!query) return rows
    return rows.filter((s) => s.supplierName.toLowerCase().includes(query))
  }, [data?.suppliers, search])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Suppliers</h1>
        <p className='text-muted-foreground'>Every supplier you've sourced a product from, rolled up across all your captures.</p>
      </div>

      <div className='relative max-w-xs'>
        <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
        <Input placeholder='Search suppliers...' value={search} onChange={(e) => setSearch(e.target.value)} className='pl-8' />
      </div>

      {isLoading ? (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-36 rounded-lg' />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className='py-16 text-center text-sm text-muted-foreground'>
            {search
              ? 'No suppliers match your search.'
              : "No suppliers captured yet -- they'll show up here automatically as you import Alibaba products."}
          </CardContent>
        </Card>
      ) : (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {suppliers.map((s) => (
            <Card key={`${s.supplierName}-${s.sourcePlatform}`}>
              <CardContent className='space-y-3 p-4'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex items-start gap-2'>
                    <Building2 className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                    <p className='text-sm font-medium leading-tight'>{s.supplierName}</p>
                  </div>
                  <Badge variant='outline' className='shrink-0 capitalize'>
                    {s.sourcePlatform}
                  </Badge>
                </div>

                <div className='grid grid-cols-2 gap-2 text-xs text-muted-foreground'>
                  <div>
                    <p className='text-base font-semibold text-foreground'>{s.totalSourced}</p>
                    Sourced
                  </div>
                  <div>
                    <p className='text-base font-semibold text-foreground'>{s.totalCommitted}</p>
                    Published
                  </div>
                </div>

                {s.avgMarginPercent !== null && (
                  <p className='text-xs text-muted-foreground'>
                    Avg. margin: <span className='font-medium text-green-600'>{s.avgMarginPercent}%</span>
                  </p>
                )}

                <div className='flex items-center justify-between border-t pt-2 text-xs text-muted-foreground'>
                  <span>Last sourced {new Date(s.lastCapturedAt).toLocaleDateString()}</span>
                  <a href={s.sampleSourceUrl} target='_blank' rel='noreferrer'>
                    <Button variant='ghost' size='sm' className='h-6 gap-1 px-1.5 text-xs'>
                      Visit <ExternalLink className='h-3 w-3' />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SourcingSuppliersPage() {
  return (
    <RequirePagePermission permission='sourcing.view'>
      <SourcingSuppliersPageContent />
    </RequirePagePermission>
  )
}
