'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
} from 'date-fns'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import promotionService, { CampaignListItem } from '@/services/promotion.service'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * A hand-built month grid (date-fns, already a project dependency -- no
 * calendar/scheduling library added). Deliberately not a drag-to-
 * reschedule calendar this phase; click a day to see that day's
 * campaigns, click a campaign to open its detail page.
 */
function PromotionsCalendarPageContent() {
  const router = useRouter()
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', 'campaigns-for-calendar', format(month, 'yyyy-MM')],
    queryFn: () => promotionService.listCampaigns({ pageSize: 100 }),
  })

  const campaigns = data?.campaigns

  const campaignsByDay = useMemo(() => {
    const map = new Map<string, CampaignListItem[]>()
    for (const c of campaigns || []) {
      const dateValue = c.scheduledAt || c.publishedAt
      if (!dateValue) continue
      const key = format(new Date(dateValue), 'yyyy-MM-dd')
      const existing = map.get(key) || []
      existing.push(c)
      map.set(key, existing)
    }
    return map
  }, [campaigns])

  const gridStart = startOfWeek(startOfMonth(month))
  const gridEnd = endOfWeek(endOfMonth(month))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const selectedDayCampaigns = selectedDay ? campaignsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || [] : []

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold tracking-tight'>Promotion Calendar</h1>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='icon' onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <span className='w-32 text-center font-medium'>{format(month, 'MMMM yyyy')}</span>
          <Button variant='outline' size='icon' onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className='h-96 rounded-lg' />
      ) : (
        <div className='grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border'>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className='bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground'>
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayCampaigns = campaignsByDay.get(key) || []
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                className={`min-h-24 bg-background p-1.5 text-left align-top transition-colors hover:bg-muted/50 ${
                  !isSameMonth(day, month) ? 'text-muted-foreground/50' : ''
                } ${selectedDay && isSameDay(day, selectedDay) ? 'ring-2 ring-inset ring-primary' : ''}`}
              >
                <div className='text-xs font-medium'>{format(day, 'd')}</div>
                <div className='mt-1 space-y-0.5'>
                  {dayCampaigns.slice(0, 3).map((c) => (
                    <div key={c.id} className='truncate rounded bg-primary/10 px-1 text-[10px] text-primary'>
                      {c.name}
                    </div>
                  ))}
                  {dayCampaigns.length > 3 && <div className='text-[10px] text-muted-foreground'>+{dayCampaigns.length - 3} more</div>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedDay && (
        <div className='rounded-lg border p-4'>
          <h2 className='mb-2 font-semibold'>{format(selectedDay, 'MMMM d, yyyy')}</h2>
          {selectedDayCampaigns.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Nothing scheduled this day.</p>
          ) : (
            <ul className='space-y-1'>
              {selectedDayCampaigns.map((c) => (
                <li key={c.id}>
                  <button className='text-sm text-blue-600 hover:underline' onClick={() => router.push(`/dashboard/promotions/${c.id}`)}>
                    {c.name} -- {c.status.replace('_', ' ').toLowerCase()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function PromotionsCalendarPage() {
  return (
    <RequirePagePermission permission='campaigns.view'>
      <PromotionsCalendarPageContent />
    </RequirePagePermission>
  )
}
