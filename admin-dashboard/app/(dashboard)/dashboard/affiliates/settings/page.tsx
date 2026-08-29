'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import affiliateService from '@/services/affiliate.service'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

interface SettingsForm {
  commissionRatePercent: string
  holdPeriodDays: string
  fallbackHoldPeriodDays: string
  programEnabled: boolean
}

const EMPTY_FORM: SettingsForm = {
  commissionRatePercent: '',
  holdPeriodDays: '',
  fallbackHoldPeriodDays: '',
  programEnabled: true,
}

function AffiliateSettingsPageContent() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM)

  // Hydrate the form from inside queryFn (not a useEffect watching `data`)
  // -- same pattern as dashboard/settings/notifications/page.tsx. Simpler
  // than an effect + "have we hydrated yet" flag, and side-steps triggering
  // a second render pass from a setState-in-effect.
  const { isLoading } = useQuery({
    queryKey: ['affiliate-settings'],
    queryFn: async () => {
      const response = await affiliateService.getSettings()
      const settings = response.data?.settings
      if (settings) {
        setForm({
          commissionRatePercent: String(Number(settings.commission_rate_percent)),
          holdPeriodDays: String(Number(settings.hold_period_days)),
          fallbackHoldPeriodDays: String(Number(settings.fallback_hold_period_days)),
          programEnabled: settings.program_enabled,
        })
      }
      return response
    },
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      affiliateService.updateSettings({
        commissionRatePercent: Number(form.commissionRatePercent),
        holdPeriodDays: Number(form.holdPeriodDays),
        fallbackHoldPeriodDays: Number(form.fallbackHoldPeriodDays),
        programEnabled: form.programEnabled,
      }),
    onSuccess: () => {
      toast.success('Affiliate settings saved.')
      queryClient.invalidateQueries({ queryKey: ['affiliate-settings'] })
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) =>
      toast.error(error.response?.data?.error || 'Failed to save affiliate settings.'),
  })

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Affiliate settings</h1>
        <p className='text-muted-foreground'>
          Program-wide defaults for commissions and click tracking. Changes apply to future
          activity only -- they don&apos;t retroactively alter conversions already recorded.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission &amp; hold periods</CardTitle>
          <CardDescription>
            How much affiliates earn, and how long a commission waits before it&apos;s confirmed and
            credited as store credit.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {isLoading ? (
            <div className='space-y-4'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : (
            <>
              <div className='space-y-1.5'>
                <Label>Commission rate</Label>
                <div className='relative max-w-50'>
                  <Input
                    type='number'
                    min='0'
                    max='100'
                    step='0.1'
                    value={form.commissionRatePercent}
                    onChange={(e) => setForm((f) => ({ ...f, commissionRatePercent: e.target.value }))}
                    className='pr-8'
                  />
                  <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
                    %
                  </span>
                </div>
                <p className='text-xs text-muted-foreground'>
                  Percentage of order value credited to the referring affiliate.
                </p>
              </div>

              <div className='space-y-1.5'>
                <Label>Hold period (days)</Label>
                <Input
                  type='number'
                  min='0'
                  className='max-w-50'
                  value={form.holdPeriodDays}
                  onChange={(e) => setForm((f) => ({ ...f, holdPeriodDays: e.target.value }))}
                />
                <p className='text-xs text-muted-foreground'>
                  Days after delivery before a commission is confirmed.
                </p>
              </div>

              <div className='space-y-1.5'>
                <Label>Fallback hold period (days)</Label>
                <Input
                  type='number'
                  min='0'
                  className='max-w-50'
                  value={form.fallbackHoldPeriodDays}
                  onChange={(e) => setForm((f) => ({ ...f, fallbackHoldPeriodDays: e.target.value }))}
                />
                <p className='text-xs text-muted-foreground'>
                  Days after order creation for orders that never reach &quot;delivered&quot; status.
                </p>
              </div>

              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div>
                  <Label>Program enabled</Label>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Turn off to stop new click tracking and referral attribution without a
                    deploy.
                  </p>
                </div>
                <Switch
                  checked={form.programEnabled}
                  onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, programEnabled: v }))}
                />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className='justify-end'>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={isLoading || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function AffiliateSettingsPage() {
  return (
    <RequirePagePermission permission='affiliates.manage'>
      <AffiliateSettingsPageContent />
    </RequirePagePermission>
  )
}
