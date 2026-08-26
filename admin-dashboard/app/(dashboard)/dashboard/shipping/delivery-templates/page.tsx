'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import deliveryTemplateService, { DeliveryTemplate, DeliveryTemplateScope } from '@/services/delivery-template.service'
import { categoryService } from '@/services/category.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Star, Globe, MapPin, Tag, Truck } from 'lucide-react'

interface TemplateForm {
  name: string
  scopeType: DeliveryTemplateScope
  countries: string
  categoryIds: string[]
  processingDaysMin: string
  processingDaysMax: string
  transitDaysMin: string
  transitDaysMax: string
  hasExpress: boolean
  expressTransitDaysMin: string
  expressTransitDaysMax: string
  skipWeekends: boolean
  standardLabel: string
  expressLabel: string
  isActive: boolean
}

const EMPTY_FORM: TemplateForm = {
  name: '',
  scopeType: 'location',
  countries: '',
  categoryIds: [],
  processingDaysMin: '1',
  processingDaysMax: '2',
  transitDaysMin: '3',
  transitDaysMax: '5',
  hasExpress: false,
  expressTransitDaysMin: '1',
  expressTransitDaysMax: '2',
  skipWeekends: true,
  standardLabel: 'FREE Delivery',
  expressLabel: 'Or fastest delivery',
  isActive: true,
}

const SCOPE_META: Record<DeliveryTemplateScope, { label: string; icon: typeof Globe }> = {
  global: { label: 'Global fallback', icon: Globe },
  location: { label: 'Location', icon: MapPin },
  category: { label: 'Category', icon: Tag },
}

function daysSummary(t: Pick<DeliveryTemplate, 'processing_days_min' | 'processing_days_max' | 'transit_days_min' | 'transit_days_max'>) {
  return `${t.processing_days_min}-${t.processing_days_max}d processing + ${t.transit_days_min}-${t.transit_days_max}d transit`
}

function DeliveryTemplatesPageContent() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-templates'],
    queryFn: () => deliveryTemplateService.listTemplates(),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response?.data?.categories || []
    },
  })
  const categories = categoriesData || []

  const templates = data?.templates || []

  const buildPayload = () => ({
    name: form.name,
    scopeType: form.scopeType,
    countries: form.scopeType === 'location' ? form.countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) : [],
    categoryIds: form.scopeType === 'category' ? form.categoryIds : [],
    processingDaysMin: Number(form.processingDaysMin),
    processingDaysMax: Number(form.processingDaysMax),
    transitDaysMin: Number(form.transitDaysMin),
    transitDaysMax: Number(form.transitDaysMax),
    expressTransitDaysMin: form.hasExpress ? Number(form.expressTransitDaysMin) : null,
    expressTransitDaysMax: form.hasExpress ? Number(form.expressTransitDaysMax) : null,
    skipWeekends: form.skipWeekends,
    standardLabel: form.standardLabel,
    expressLabel: form.expressLabel,
    isActive: form.isActive,
  })

  // The API rejects (throws) on any non-2xx response -- including the 400s
  // our own validation guards return (e.g. "reassign the default first") --
  // so those specific messages must be read from onError, not onSuccess.
  const createMutation = useMutation({
    mutationFn: () => deliveryTemplateService.createTemplate(buildPayload()),
    onSuccess: () => {
      toast.success('Delivery template created.')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['delivery-templates'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to create delivery template.'),
  })

  const updateMutation = useMutation({
    mutationFn: () => deliveryTemplateService.updateTemplate(editingId!, buildPayload()),
    onSuccess: () => {
      toast.success('Delivery template updated.')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['delivery-templates'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to update delivery template.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deliveryTemplateService.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Delivery template deleted.')
      queryClient.invalidateQueries({ queryKey: ['delivery-templates'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to delete delivery template.'),
  })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (t: DeliveryTemplate) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      scopeType: t.scope_type,
      countries: t.countries.join(', '),
      categoryIds: t.category_ids,
      processingDaysMin: String(t.processing_days_min),
      processingDaysMax: String(t.processing_days_max),
      transitDaysMin: String(t.transit_days_min),
      transitDaysMax: String(t.transit_days_max),
      hasExpress: t.express_transit_days_min !== null,
      expressTransitDaysMin: String(t.express_transit_days_min ?? '1'),
      expressTransitDaysMax: String(t.express_transit_days_max ?? '2'),
      skipWeekends: t.skip_weekends,
      standardLabel: t.standard_label,
      expressLabel: t.express_label,
      isActive: t.is_active,
    })
    setDialogOpen(true)
  }

  const categoryNameById = useMemo(() => new Map(categories.map((c: any) => [c.id, c.name])), [categories])

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Delivery estimates</h1>
          <p className='text-muted-foreground'>
            Admin-editable "FREE Delivery Thursday, 3 September" date ranges shown on the storefront product page -- resolved per
            product by override, then category, then customer location, then this global fallback.
          </p>
        </div>
        <Button className='gap-1.5' onClick={openCreate}>
          <Plus className='h-4 w-4' /> New template
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-48 rounded-lg' />
      ) : (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {templates.map((t) => {
            const ScopeIcon = SCOPE_META[t.scope_type].icon
            return (
              <Card key={t.id} className={!t.is_active ? 'opacity-60' : t.is_default ? 'border-orange-300' : ''}>
                <CardHeader className='flex flex-row items-start justify-between pb-3'>
                  <div>
                    <CardTitle className='flex items-center gap-1.5 text-base'>
                      {t.name}
                      {t.is_default && <Star className='h-3.5 w-3.5 fill-orange-400 text-orange-400' />}
                    </CardTitle>
                    <CardDescription className='flex items-center gap-1'>
                      <ScopeIcon className='h-3 w-3' /> {SCOPE_META[t.scope_type].label}
                    </CardDescription>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button variant='ghost' size='icon' onClick={() => openEdit(t)}>
                      <Pencil className='h-4 w-4' />
                    </Button>
                    {!t.is_default && (
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id)
                        }}
                      >
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className='space-y-2'>
                  {t.scope_type === 'location' && (
                    <div className='flex flex-wrap gap-1'>
                      {t.countries.length > 0 ? (
                        t.countries.map((c) => (
                          <Badge key={c} variant='outline' className='text-xs'>
                            {c}
                          </Badge>
                        ))
                      ) : (
                        <span className='text-xs text-muted-foreground'>No countries assigned yet</span>
                      )}
                    </div>
                  )}
                  {t.scope_type === 'category' && (
                    <div className='flex flex-wrap gap-1'>
                      {t.category_ids.length > 0 ? (
                        t.category_ids.map((id) => (
                          <Badge key={id} variant='outline' className='text-xs'>
                            {categoryNameById.get(id) || id}
                          </Badge>
                        ))
                      ) : (
                        <span className='text-xs text-muted-foreground'>No categories assigned yet</span>
                      )}
                    </div>
                  )}
                  <p className='text-sm text-muted-foreground'>{daysSummary(t)}</p>
                  {t.express_transit_days_min !== null && (
                    <p className='text-xs text-muted-foreground'>
                      Fastest: +{t.express_transit_days_min}-{t.express_transit_days_max}d transit
                    </p>
                  )}
                  {!t.is_active && (
                    <Badge variant='secondary' className='text-xs'>
                      Inactive
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {templates.length === 0 && (
            <Card className='md:col-span-2 lg:col-span-3'>
              <CardContent className='py-12 text-center text-sm text-muted-foreground'>No delivery templates yet.</CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Truck className='h-4 w-4' /> {editingId ? 'Edit delivery template' : 'New delivery template'}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder='e.g. "EU Standard"' />
            </div>

            <div className='space-y-1.5'>
              <Label>Scope</Label>
              <Select value={form.scopeType} onValueChange={(v: string) => setForm((f) => ({ ...f, scopeType: v as DeliveryTemplateScope }))} disabled={!!editingId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='location'>Location -- applies to specific countries</SelectItem>
                  <SelectItem value='category'>Category -- applies to specific product categories</SelectItem>
                  <SelectItem value='global'>Global fallback -- used when nothing more specific matches</SelectItem>
                </SelectContent>
              </Select>
              {editingId && <p className='text-xs text-muted-foreground'>Scope can&apos;t be changed after creation -- create a new template instead.</p>}
            </div>

            {form.scopeType === 'location' && (
              <div className='space-y-1.5'>
                <Label>Countries (ISO codes, comma-separated)</Label>
                <Input value={form.countries} onChange={(e) => setForm((f) => ({ ...f, countries: e.target.value }))} placeholder='IT, FR, DE' />
              </div>
            )}

            {form.scopeType === 'category' && (
              <div className='space-y-1.5'>
                <Label>Categories</Label>
                <ScrollArea className='h-40 rounded-md border p-2'>
                  <div className='space-y-2'>
                    {categories.map((c: any) => (
                      <label key={c.id} className='flex items-center gap-2 text-sm'>
                        <Checkbox
                          checked={form.categoryIds.includes(c.id)}
                          onCheckedChange={(checked: boolean | 'indeterminate') =>
                            setForm((f) => ({
                              ...f,
                              categoryIds: checked ? [...f.categoryIds, c.id] : f.categoryIds.filter((id) => id !== c.id),
                            }))
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator />

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label>Processing days (min-max)</Label>
                <div className='flex items-center gap-2'>
                  <Input type='number' min='0' value={form.processingDaysMin} onChange={(e) => setForm((f) => ({ ...f, processingDaysMin: e.target.value }))} />
                  <span className='text-muted-foreground'>–</span>
                  <Input type='number' min='0' value={form.processingDaysMax} onChange={(e) => setForm((f) => ({ ...f, processingDaysMax: e.target.value }))} />
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label>Transit days (min-max)</Label>
                <div className='flex items-center gap-2'>
                  <Input type='number' min='0' value={form.transitDaysMin} onChange={(e) => setForm((f) => ({ ...f, transitDaysMin: e.target.value }))} />
                  <span className='text-muted-foreground'>–</span>
                  <Input type='number' min='0' value={form.transitDaysMax} onChange={(e) => setForm((f) => ({ ...f, transitDaysMax: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className='flex items-center justify-between rounded-lg border p-3'>
              <div>
                <Label>Skip weekends</Label>
                <p className='text-xs text-muted-foreground'>Saturday/Sunday don&apos;t count toward the estimate</p>
              </div>
              <Switch checked={form.skipWeekends} onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, skipWeekends: v }))} />
            </div>

            <div className='flex items-center justify-between rounded-lg border p-3'>
              <div>
                <Label>Offer a "fastest delivery" option</Label>
                <p className='text-xs text-muted-foreground'>Shows a second, faster date on the product page</p>
              </div>
              <Switch checked={form.hasExpress} onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, hasExpress: v }))} />
            </div>

            {form.hasExpress && (
              <div className='space-y-1.5'>
                <Label>Express transit days (min-max)</Label>
                <div className='flex items-center gap-2'>
                  <Input type='number' min='0' value={form.expressTransitDaysMin} onChange={(e) => setForm((f) => ({ ...f, expressTransitDaysMin: e.target.value }))} />
                  <span className='text-muted-foreground'>–</span>
                  <Input type='number' min='0' value={form.expressTransitDaysMax} onChange={(e) => setForm((f) => ({ ...f, expressTransitDaysMax: e.target.value }))} />
                </div>
              </div>
            )}

            <Separator />

            <div className='grid grid-cols-1 gap-4'>
              <div className='space-y-1.5'>
                <Label>Standard delivery label</Label>
                <Input value={form.standardLabel} onChange={(e) => setForm((f) => ({ ...f, standardLabel: e.target.value }))} />
              </div>
              {form.hasExpress && (
                <div className='space-y-1.5'>
                  <Label>Express delivery label</Label>
                  <Input value={form.expressLabel} onChange={(e) => setForm((f) => ({ ...f, expressLabel: e.target.value }))} />
                </div>
              )}
            </div>

            {editingId && (
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, isActive: v }))} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
              disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingId ? 'Save changes' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function DeliveryTemplatesPage() {
  return (
    <RequirePagePermission permission='shipping.manage'>
      <DeliveryTemplatesPageContent />
    </RequirePagePermission>
  )
}
