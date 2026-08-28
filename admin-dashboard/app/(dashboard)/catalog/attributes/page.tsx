'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import categoryAttributeService, {
  AttributeInputType,
  CategoryAttribute,
} from '@/services/category-attribute.service'
import { categoryService } from '@/services/category.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ListFilter } from 'lucide-react'

interface AttributeForm {
  name: string
  inputType: AttributeInputType
  options: string
  unit: string
  displayOrder: string
  isFilterable: boolean
}

const EMPTY_FORM: AttributeForm = {
  name: '',
  inputType: 'select',
  options: '',
  unit: '',
  displayOrder: '0',
  isFilterable: true,
}

const INPUT_TYPE_LABEL: Record<AttributeInputType, string> = {
  select: 'Select (controlled options -- filterable)',
  text: 'Free text (not filterable yet)',
  number: 'Number (not filterable yet)',
}

function CategoryAttributesPageContent() {
  const queryClient = useQueryClient()
  const [categoryId, setCategoryId] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AttributeForm>(EMPTY_FORM)

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryService.getCategories()
      return response?.data?.categories || []
    },
  })
  const categories = categoriesData || []

  const { data, isLoading } = useQuery({
    queryKey: ['category-attributes', categoryId],
    queryFn: () => categoryAttributeService.listForCategory(categoryId),
    enabled: !!categoryId,
  })
  const attributes: CategoryAttribute[] = data?.data?.attributes || []

  const buildPayload = () => ({
    categoryId,
    name: form.name.trim(),
    inputType: form.inputType,
    options:
      form.inputType === 'select'
        ? form.options.split(',').map((o) => o.trim()).filter(Boolean)
        : null,
    unit: form.unit.trim() || null,
    displayOrder: Number(form.displayOrder) || 0,
    isFilterable: form.isFilterable,
  })

  const createMutation = useMutation({
    mutationFn: () => categoryAttributeService.create(buildPayload()),
    onSuccess: () => {
      toast.success('Attribute created.')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['category-attributes', categoryId] })
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.error || 'Failed to create attribute.'),
  })

  const updateMutation = useMutation({
    mutationFn: () => categoryAttributeService.update(editingId!, buildPayload()),
    onSuccess: () => {
      toast.success('Attribute updated.')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['category-attributes', categoryId] })
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.error || 'Failed to update attribute.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryAttributeService.remove(id),
    onSuccess: () => {
      toast.success('Attribute deleted.')
      queryClient.invalidateQueries({ queryKey: ['category-attributes', categoryId] })
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.error || 'Failed to delete attribute.'),
  })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (attr: CategoryAttribute) => {
    setEditingId(attr.id)
    setForm({
      name: attr.name,
      inputType: attr.input_type,
      options: (attr.options || []).join(', '),
      unit: attr.unit || '',
      displayOrder: String(attr.display_order),
      isFilterable: attr.is_filterable,
    })
    setDialogOpen(true)
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Category attributes</h1>
        <p className='text-muted-foreground'>
          Define structured, typed attributes per category (Voltage, Material, Power Source...)
          for the storefront's filter sidebar. Deliberately separate from product descriptions/specs
          -- only "Select" attributes with a fixed set of options are filterable, since that's the
          one shape with a real controlled vocabulary.
        </p>
      </div>

      <Card>
        <CardContent className='pt-6'>
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className='mt-1.5'>
              <SelectValue placeholder='Choose a category to manage its attributes' />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!categoryId ? (
        <Card>
          <CardContent className='py-12 text-center text-sm text-muted-foreground'>
            Choose a category above to see or add its attributes.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-semibold'>
              {categories.find((c: any) => c.id === categoryId)?.name}'s attributes
            </h2>
            <Button className='gap-1.5' onClick={openCreate}>
              <Plus className='h-4 w-4' /> New attribute
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className='h-32 rounded-lg' />
          ) : (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {attributes.map((attr) => (
                <Card key={attr.id}>
                  <CardHeader className='flex flex-row items-start justify-between pb-3'>
                    <div>
                      <CardTitle className='flex items-center gap-1.5 text-base'>
                        <ListFilter className='h-3.5 w-3.5 text-muted-foreground' />
                        {attr.name}
                        {attr.unit && <span className='text-sm text-muted-foreground'>({attr.unit})</span>}
                      </CardTitle>
                      <CardDescription>{INPUT_TYPE_LABEL[attr.input_type]}</CardDescription>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Button variant='ghost' size='icon' onClick={() => openEdit(attr)}>
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          if (confirm(`Delete "${attr.name}"? This also removes every product's value for it.`)) {
                            deleteMutation.mutate(attr.id)
                          }
                        }}
                      >
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-2'>
                    {attr.input_type === 'select' && (
                      <div className='flex flex-wrap gap-1'>
                        {(attr.options || []).length > 0 ? (
                          attr.options!.map((o) => (
                            <Badge key={o} variant='outline' className='text-xs'>
                              {o}
                            </Badge>
                          ))
                        ) : (
                          <span className='text-xs text-muted-foreground'>No options set yet</span>
                        )}
                      </div>
                    )}
                    {!attr.is_filterable && (
                      <Badge variant='secondary' className='text-xs'>
                        Not filterable
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
              {attributes.length === 0 && (
                <Card className='md:col-span-2 lg:col-span-3'>
                  <CardContent className='py-12 text-center text-sm text-muted-foreground'>
                    No attributes defined for this category yet.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <ListFilter className='h-4 w-4' /> {editingId ? 'Edit attribute' : 'New attribute'}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='e.g. "Voltage"'
              />
            </div>

            <div className='space-y-1.5'>
              <Label>Type</Label>
              <Select
                value={form.inputType}
                onValueChange={(v: string) => setForm((f) => ({ ...f, inputType: v as AttributeInputType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='select'>{INPUT_TYPE_LABEL.select}</SelectItem>
                  <SelectItem value='text'>{INPUT_TYPE_LABEL.text}</SelectItem>
                  <SelectItem value='number'>{INPUT_TYPE_LABEL.number}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.inputType === 'select' && (
              <div className='space-y-1.5'>
                <Label>Options (comma-separated)</Label>
                <Input
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                  placeholder='12V, 18V, 20V'
                />
                <p className='text-xs text-muted-foreground'>
                  This is the controlled vocabulary shoppers filter by -- exact spelling matters.
                </p>
              </div>
            )}

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label>Unit (optional)</Label>
                <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder='V' />
              </div>
              <div className='space-y-1.5'>
                <Label>Display order</Label>
                <Input
                  type='number'
                  min='0'
                  value={form.displayOrder}
                  onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                />
              </div>
            </div>

            {form.inputType === 'select' && (
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <div>
                  <Label>Filterable</Label>
                  <p className='text-xs text-muted-foreground'>Shows as a filter option on the storefront</p>
                </div>
                <Switch
                  checked={form.isFilterable}
                  onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, isFilterable: v }))}
                />
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
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingId
                  ? 'Save changes'
                  : 'Create attribute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CategoryAttributesPage() {
  return (
    <RequirePagePermission permission='catalog.manage'>
      <CategoryAttributesPageContent />
    </RequirePagePermission>
  )
}
