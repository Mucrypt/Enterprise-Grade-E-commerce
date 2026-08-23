'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService, { SourcingPricingRule } from '@/services/sourcing.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Star, Calculator } from 'lucide-react'

type RuleType = 'margin_percent' | 'cost_plus_fixed'
type RoundingMode = 'none' | 'charm' | 'nearest_1'

interface RuleForm {
  name: string
  ruleType: RuleType
  marginPercent: string
  fixedMarkup: string
  roundingMode: RoundingMode
  isDefault: boolean
}

const EMPTY_FORM: RuleForm = { name: '', ruleType: 'margin_percent', marginPercent: '40', fixedMarkup: '10', roundingMode: 'charm', isDefault: false }

const ROUNDING_LABEL: Record<RoundingMode, string> = {
  none: 'No rounding (exact)',
  charm: 'Charm pricing (round up to .99)',
  nearest_1: 'Nearest whole number',
}

/** Mirrors sourcing-pricing.service.ts's computeSuggestedPrice() exactly, for the live preview only -- the backend remains the source of truth at actual capture time. */
function previewPrice(costPrice: number, form: RuleForm): { salePrice: number; marginPercent: number } {
  let raw: number
  if (form.ruleType === 'margin_percent') {
    const margin = Number(form.marginPercent) || 0
    raw = margin > 0 && margin < 100 ? costPrice / (1 - margin / 100) : costPrice
  } else {
    raw = costPrice + (Number(form.fixedMarkup) || 0)
  }

  let salePrice: number
  if (form.roundingMode === 'nearest_1') {
    salePrice = Math.round(raw)
  } else if (form.roundingMode === 'charm') {
    const wholeUnit = Math.ceil(raw)
    const charmed = Math.round((wholeUnit - 0.01) * 100) / 100
    salePrice = charmed >= raw ? charmed : wholeUnit
  } else {
    salePrice = Math.round(raw * 100) / 100
  }

  const marginPercent = salePrice > 0 ? Math.round(((salePrice - costPrice) / salePrice) * 10000) / 100 : 0
  return { salePrice, marginPercent }
}

function SourcingPricingRulesPageContent() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM)
  const [previewCost, setPreviewCost] = useState('20')

  const { data, isLoading } = useQuery({
    queryKey: ['sourcing', 'pricing-rules'],
    queryFn: () => sourcingService.listPricingRules(),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      sourcingService.createPricingRule({
        name: form.name,
        ruleType: form.ruleType,
        marginPercent: form.ruleType === 'margin_percent' ? Number(form.marginPercent) : undefined,
        fixedMarkup: form.ruleType === 'cost_plus_fixed' ? Number(form.fixedMarkup) : undefined,
        roundingMode: form.roundingMode,
        isDefault: form.isDefault,
      }),
    onSuccess: () => {
      toast.success('Pricing rule created.')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['sourcing', 'pricing-rules'] })
    },
    onError: () => toast.error('Failed to create pricing rule.'),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      sourcingService.updatePricingRule(editingId!, {
        name: form.name,
        marginPercent: form.ruleType === 'margin_percent' ? Number(form.marginPercent) : undefined,
        fixedMarkup: form.ruleType === 'cost_plus_fixed' ? Number(form.fixedMarkup) : undefined,
        roundingMode: form.roundingMode,
        isDefault: form.isDefault,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Pricing rule updated.')
        setDialogOpen(false)
        queryClient.invalidateQueries({ queryKey: ['sourcing', 'pricing-rules'] })
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to update pricing rule.'),
  })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (rule: SourcingPricingRule) => {
    setEditingId(rule.id)
    setForm({
      name: rule.name,
      ruleType: rule.rule_type,
      marginPercent: rule.margin_percent ?? '40',
      fixedMarkup: rule.fixed_markup ?? '10',
      roundingMode: rule.rounding_mode,
      isDefault: rule.is_default,
    })
    setDialogOpen(true)
  }

  const preview = useMemo(() => previewPrice(Number(previewCost) || 0, form), [previewCost, form])

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Pricing rules</h1>
          <p className='text-muted-foreground'>How sale prices and profit margins are suggested automatically when a product is captured.</p>
        </div>
        <Button className='gap-1.5' onClick={openCreate}>
          <Plus className='h-4 w-4' /> New rule
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-48 rounded-lg' />
      ) : (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {(data?.rules || []).map((rule) => (
            <Card key={rule.id} className={rule.is_default ? 'border-orange-300' : ''}>
              <CardHeader className='flex flex-row items-start justify-between'>
                <div>
                  <CardTitle className='flex items-center gap-1.5 text-base'>
                    {rule.name}
                    {rule.is_default && <Star className='h-3.5 w-3.5 fill-orange-400 text-orange-400' />}
                  </CardTitle>
                  <CardDescription>
                    {rule.rule_type === 'margin_percent' ? `${Number(rule.margin_percent).toFixed(0)}% margin` : `+€${Number(rule.fixed_markup).toFixed(2)} fixed`}
                    {' · '}
                    {ROUNDING_LABEL[rule.rounding_mode].split(' (')[0]}
                  </CardDescription>
                </div>
                <Button variant='ghost' size='icon' onClick={() => openEdit(rule)}>
                  <Pencil className='h-4 w-4' />
                </Button>
              </CardHeader>
              <CardContent>
                {rule.is_default ? (
                  <Badge variant='outline' className='border-orange-300 text-orange-600'>
                    Applied to every new capture
                  </Badge>
                ) : (
                  <p className='text-xs text-muted-foreground'>Available to pick manually on a draft.</p>
                )}
              </CardContent>
            </Card>
          ))}
          {(data?.rules || []).length === 0 && (
            <Card className='md:col-span-2 lg:col-span-3'>
              <CardContent className='py-12 text-center text-sm text-muted-foreground'>
                No pricing rules yet -- create one to control how sale prices get suggested.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit pricing rule' : 'New pricing rule'}</DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder='e.g. "Standard 40% margin"' />
            </div>

            <div className='space-y-1.5'>
              <Label>Type</Label>
              <Select value={form.ruleType} onValueChange={(v: string) => setForm((f) => ({ ...f, ruleType: v as RuleType }))} disabled={!!editingId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='margin_percent'>Target margin %</SelectItem>
                  <SelectItem value='cost_plus_fixed'>Cost + fixed markup</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.ruleType === 'margin_percent' ? (
              <div className='space-y-1.5'>
                <Label>Margin %</Label>
                <Input
                  type='number'
                  step='1'
                  min='1'
                  max='99'
                  value={form.marginPercent}
                  onChange={(e) => setForm((f) => ({ ...f, marginPercent: e.target.value }))}
                />
              </div>
            ) : (
              <div className='space-y-1.5'>
                <Label>Fixed markup (EUR)</Label>
                <Input
                  type='number'
                  step='0.5'
                  value={form.fixedMarkup}
                  onChange={(e) => setForm((f) => ({ ...f, fixedMarkup: e.target.value }))}
                />
              </div>
            )}

            <div className='space-y-1.5'>
              <Label>Rounding</Label>
              <Select value={form.roundingMode} onValueChange={(v: string) => setForm((f) => ({ ...f, roundingMode: v as RoundingMode }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROUNDING_LABEL) as RoundingMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {ROUNDING_LABEL[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className='flex items-center gap-2 text-sm'>
              <Checkbox checked={form.isDefault} onCheckedChange={(v: boolean | 'indeterminate') => setForm((f) => ({ ...f, isDefault: !!v }))} />
              Set as the default rule (applied automatically to every new capture)
            </label>

            <Card className='bg-muted/40'>
              <CardContent className='space-y-2 p-3'>
                <div className='flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
                  <Calculator className='h-3.5 w-3.5' /> Live preview
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-muted-foreground'>If cost is</span>
                  <Input
                    type='number'
                    step='0.01'
                    value={previewCost}
                    onChange={(e) => setPreviewCost(e.target.value)}
                    className='h-8 w-24'
                  />
                  <span className='text-sm text-muted-foreground'>EUR, sale price is</span>
                </div>
                <p className='text-lg font-semibold'>
                  €{preview.salePrice.toFixed(2)} <span className='text-sm font-normal text-green-600'>({preview.marginPercent}% margin)</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
              disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingId ? 'Save changes' : 'Create rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SourcingPricingRulesPage() {
  return (
    <RequirePagePermission permission='sourcing.manage'>
      <SourcingPricingRulesPageContent />
    </RequirePagePermission>
  )
}
