'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import promotionService, { CampaignStatus } from '@/services/promotion.service'
import { CampaignStatusBadge } from '@/components/promotions/CampaignStatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Calendar as CalendarIcon, Link2 } from 'lucide-react'

const STATUS_OPTIONS: (CampaignStatus | 'all')[] = ['all', 'DRAFT', 'SCHEDULED', 'PUBLISHING', 'PARTIAL_SUCCESS', 'PUBLISHED', 'FAILED', 'CANCELLED']

function PromotionsPageContent() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CampaignStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'campaigns', { search, status, page }],
    queryFn: () => promotionService.listCampaigns({ search: search || undefined, status: status === 'all' ? undefined : status, page, pageSize: 25 }),
  })

  const campaigns = data?.campaigns || []
  const pagination = data?.pagination

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Promotions</h1>
          <p className='text-muted-foreground'>Create, schedule, and monitor marketing campaigns across every channel.</p>
        </div>
        <div className='flex items-center gap-2'>
          <Link href='/dashboard/promotions/calendar'>
            <Button variant='outline'>
              <CalendarIcon className='mr-1.5 h-4 w-4' /> Calendar
            </Button>
          </Link>
          <Link href='/dashboard/promotions/connections'>
            <Button variant='outline'>
              <Link2 className='mr-1.5 h-4 w-4' /> Connections
            </Button>
          </Link>
          <Link href='/dashboard/promotions/new'>
            <Button>
              <Plus className='mr-1.5 h-4 w-4' /> New Promotion
            </Button>
          </Link>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <Input placeholder='Search campaigns...' value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className='max-w-sm' />
        <Select value={status} onValueChange={(v: string) => { setStatus(v as CampaignStatus | 'all'); setPage(1) }}>
          <SelectTrigger className='w-48'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : campaigns.length === 0 ? (
        <div className='rounded-lg border border-dashed p-12 text-center text-muted-foreground'>
          No campaigns yet. <Link href='/dashboard/promotions/new' className='underline'>Create your first promotion</Link>.
        </div>
      ) : (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Objective</TableHead>
                <TableHead className='text-right'>Channels</TableHead>
                <TableHead className='text-right'>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id} className='cursor-pointer' onClick={() => router.push(`/dashboard/promotions/${c.id}`)}>
                  <TableCell className='font-medium'>{c.name}</TableCell>
                  <TableCell className='text-muted-foreground'>{c.objective || '—'}</TableCell>
                  <TableCell className='text-right'>{c.channelCount}</TableCell>
                  <TableCell className='text-right'>{c.productCount}</TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{c.createdBy.slice(0, 8)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.total > pagination.pageSize && (
        <div className='flex items-center justify-between text-sm text-muted-foreground'>
          <span>
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)} ({pagination.total} campaigns)
          </span>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PromotionsPage() {
  return (
    <RequirePagePermission permission='campaigns.view'>
      <PromotionsPageContent />
    </RequirePagePermission>
  )
}
