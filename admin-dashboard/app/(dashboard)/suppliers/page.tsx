'use client'

import { Dispatch, SetStateAction, useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import supplierService, {
  SupplierProfile,
  SupplierSourcePlatform,
  ImportBatch,
  ImportPreviewRow,
  ImportRowError,
} from '@/services/supplier.service'
import { productService } from '@/services/product.service'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

type SupplierFormState = {
  companyName: string
  contactName: string
  email: string
  phone: string
  sourcePlatform: SupplierSourcePlatform
  countryCode: string
  status: 'active' | 'watchlist' | 'blocked'
  paymentTerms: string
  leadTimeDays: string
  rating: string
  onTimeRate: string
  defectRate: string
  refundRate: string
}

const EMPTY_SUPPLIER_FORM: SupplierFormState = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  sourcePlatform: 'other',
  countryCode: '',
  status: 'active',
  paymentTerms: '',
  leadTimeDays: '7',
  rating: '',
  onTimeRate: '',
  defectRate: '',
  refundRate: '',
}

export default function SuppliersPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<string>('')
  const [createForm, setCreateForm] =
    useState<SupplierFormState>(EMPTY_SUPPLIER_FORM)
  const [editForm, setEditForm] =
    useState<SupplierFormState>(EMPTY_SUPPLIER_FORM)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importSupplierId, setImportSupplierId] = useState<string>('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{
    batch: ImportBatch
    rowsToCreate: ImportPreviewRow[]
    rowsToUpdate: ImportPreviewRow[]
    errors: ImportRowError[]
  } | null>(null)
  const [economicsProductId, setEconomicsProductId] = useState<string>('')
  const [offerForm, setOfferForm] = useState({
    productId: '',
    supplierSku: '',
    costPrice: '',
    shippingCost: '',
    stockQuantity: '',
    minOrderQuantity: '1',
    leadTimeDays: '',
    estimatedDeliveryDays: '',
    currencyCode: 'EUR',
    supplierUrl: '',
    isPrimary: false,
    isAvailable: true,
  })

  const { data: suppliersResponse, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['suppliers-scorecard', statusFilter, sourceFilter, search],
    queryFn: () =>
      supplierService.getSuppliers({
        page: 1,
        limit: 100,
        status: statusFilter === 'all' ? undefined : (statusFilter as any),
        sourcePlatform:
          sourceFilter === 'all' ? undefined : (sourceFilter as any),
        search: search.trim() || undefined,
      }),
    staleTime: 30_000,
  })

  const { data: offersResponse, isLoading: isLoadingOffers } = useQuery({
    queryKey: ['supplier-offers', selectedSupplierId],
    queryFn: () => supplierService.getSupplierProducts(selectedSupplierId),
    enabled: Boolean(selectedSupplierId),
  })

  const { data: productsResponse } = useQuery({
    queryKey: ['supplier-offer-products'],
    queryFn: () =>
      productService.getProducts({
        page: 1,
        limit: 100,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      }),
    staleTime: 60_000,
  })

  const suppliers = suppliersResponse?.data?.suppliers || []
  const offers = offersResponse?.data?.products || []
  const productOptions = (productsResponse?.data?.items || []) as Array<{
    id: string
    name: string
  }>

  const selectedSupplier = useMemo(
    () => suppliers.find((item: any) => item.id === selectedSupplierId),
    [suppliers, selectedSupplierId],
  )

  const updateStatusMutation = useMutation({
    mutationFn: ({ supplierId, status }: { supplierId: string; status: string }) =>
      supplierService.updateSupplier(supplierId, { status: status as any }),
    onSuccess: () => {
      toast.success('Supplier status updated')
      queryClient.invalidateQueries({ queryKey: ['suppliers-scorecard'] })
    },
    onError: () => {
      toast.error('Failed to update supplier status')
    },
  })

  const createSupplierMutation = useMutation({
    mutationFn: () =>
      supplierService.createSupplier({
        companyName: createForm.companyName,
        contactName: createForm.contactName || undefined,
        email: createForm.email,
        phone: createForm.phone || undefined,
        sourcePlatform: createForm.sourcePlatform,
        countryCode: createForm.countryCode || undefined,
        status: createForm.status,
        paymentTerms: createForm.paymentTerms || undefined,
        leadTimeDays: createForm.leadTimeDays
          ? Number(createForm.leadTimeDays)
          : undefined,
      }),
    onSuccess: () => {
      toast.success('Supplier created successfully')
      queryClient.invalidateQueries({ queryKey: ['suppliers-scorecard'] })
      setIsCreateDialogOpen(false)
      setCreateForm(EMPTY_SUPPLIER_FORM)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create supplier')
    },
  })

  const editSupplierMutation = useMutation({
    mutationFn: () =>
      supplierService.updateSupplier(editingSupplierId, {
        companyName: editForm.companyName,
        contactName: editForm.contactName || undefined,
        email: editForm.email,
        phone: editForm.phone || undefined,
        sourcePlatform: editForm.sourcePlatform,
        countryCode: editForm.countryCode || undefined,
        status: editForm.status,
        paymentTerms: editForm.paymentTerms || undefined,
        leadTimeDays: editForm.leadTimeDays
          ? Number(editForm.leadTimeDays)
          : undefined,
        rating: editForm.rating ? Number(editForm.rating) : undefined,
        onTimeRate: editForm.onTimeRate ? Number(editForm.onTimeRate) : undefined,
        defectRate: editForm.defectRate ? Number(editForm.defectRate) : undefined,
        refundRate: editForm.refundRate ? Number(editForm.refundRate) : undefined,
      }),
    onSuccess: () => {
      toast.success('Supplier updated successfully')
      queryClient.invalidateQueries({ queryKey: ['suppliers-scorecard'] })
      setIsEditDialogOpen(false)
      setEditingSupplierId('')
      setEditForm(EMPTY_SUPPLIER_FORM)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update supplier')
    },
  })

  const upsertOfferMutation = useMutation({
    mutationFn: () => {
      if (!selectedSupplierId || !offerForm.productId || !offerForm.costPrice) {
        throw new Error('Supplier, product, and cost are required')
      }

      return supplierService.upsertSupplierOffer(selectedSupplierId, {
        productId: offerForm.productId,
        supplierSku: offerForm.supplierSku || undefined,
        costPrice: Number(offerForm.costPrice),
        shippingCost: offerForm.shippingCost
          ? Number(offerForm.shippingCost)
          : undefined,
        stockQuantity: offerForm.stockQuantity
          ? Number(offerForm.stockQuantity)
          : undefined,
        minOrderQuantity: offerForm.minOrderQuantity
          ? Number(offerForm.minOrderQuantity)
          : 1,
        leadTimeDays: offerForm.leadTimeDays
          ? Number(offerForm.leadTimeDays)
          : undefined,
        estimatedDeliveryDays: offerForm.estimatedDeliveryDays
          ? Number(offerForm.estimatedDeliveryDays)
          : undefined,
        currencyCode: offerForm.currencyCode,
        supplierUrl: offerForm.supplierUrl || undefined,
        isPrimary: offerForm.isPrimary,
        isAvailable: offerForm.isAvailable,
      })
    },
    onSuccess: () => {
      toast.success('Supplier offer saved')
      queryClient.invalidateQueries({
        queryKey: ['supplier-offers', selectedSupplierId],
      })
      setOfferForm((prev) => ({
        ...prev,
        productId: '',
        supplierSku: '',
        costPrice: '',
        shippingCost: '',
        stockQuantity: '',
        leadTimeDays: '',
        estimatedDeliveryDays: '',
        supplierUrl: '',
      }))
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save supplier offer')
    },
  })

  const previewImportMutation = useMutation({
    mutationFn: () => {
      if (!importSupplierId || !importFile) {
        throw new Error('Choose a supplier and a CSV file first')
      }
      return supplierService.previewImport(importSupplierId, importFile)
    },
    onSuccess: (response) => {
      setImportPreview(response.data || null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to preview import')
      setImportPreview(null)
    },
  })

  const commitImportMutation = useMutation({
    mutationFn: () => {
      if (!importSupplierId || !importPreview) {
        throw new Error('Preview an import first')
      }
      return supplierService.commitImport(importSupplierId, importPreview.batch.id)
    },
    onSuccess: (response) => {
      toast.success(
        `Import committed: ${response.data?.createdCount ?? 0} created, ${response.data?.updatedCount ?? 0} updated`,
      )
      queryClient.invalidateQueries({ queryKey: ['supplier-offers', importSupplierId] })
      queryClient.invalidateQueries({ queryKey: ['supplier-offer-products'] })
      setIsImportDialogOpen(false)
      setImportFile(null)
      setImportPreview(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to commit import')
    },
  })

  const onImportDrop = useCallback((acceptedFiles: File[]) => {
    setImportPreview(null)
    setImportFile(acceptedFiles[0] || null)
  }, [])

  const {
    getRootProps: getImportRootProps,
    getInputProps: getImportInputProps,
    isDragActive: isImportDragActive,
  } = useDropzone({
    onDrop: onImportDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    disabled: previewImportMutation.isPending || commitImportMutation.isPending,
  })

  const openImportDialog = (supplierId: string) => {
    setImportSupplierId(supplierId)
    setImportFile(null)
    setImportPreview(null)
    setIsImportDialogOpen(true)
  }

  const {
    data: economicsResponse,
    isFetching: isLoadingEconomics,
    refetch: refetchEconomics,
  } = useQuery({
    queryKey: ['product-economics', economicsProductId],
    queryFn: () => supplierService.getProductEconomics(economicsProductId),
    enabled: false,
  })

  const recomputeEconomicsMutation = useMutation({
    mutationFn: () => supplierService.recomputeProductEconomics(economicsProductId),
    onSuccess: () => {
      toast.success('Economics recomputed')
      refetchEconomics()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to recompute economics')
    },
  })

  const evaluateAutoPauseMutation = useMutation({
    mutationFn: () => supplierService.evaluateProductAutoPause(economicsProductId),
    onSuccess: (response) => {
      const shouldPause = response.data?.shouldPause ?? false
      toast[shouldPause ? 'error' : 'success'](
        shouldPause
          ? 'Product would be auto-paused: margin below floor'
          : 'Margin is healthy, no pause needed',
      )
      queryClient.invalidateQueries({ queryKey: ['auto-paused-products'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to evaluate auto-pause')
    },
  })

  const { data: autoPausedResponse, isLoading: isLoadingAutoPaused } = useQuery({
    queryKey: ['auto-paused-products'],
    queryFn: () => supplierService.getAutoPausedProducts(20),
    staleTime: 30_000,
  })

  const autoPausedProducts = autoPausedResponse?.data?.items || []
  const economics = economicsResponse?.data?.economics
  const economicsFlags = economicsResponse?.data?.flags

  const openEditDialog = (supplier: SupplierProfile) => {
    setEditingSupplierId(supplier.id)
    setEditForm({
      companyName: supplier.company_name || '',
      contactName: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      sourcePlatform: supplier.source_platform || 'other',
      countryCode: supplier.country_code || '',
      status: supplier.status || 'active',
      paymentTerms: '',
      leadTimeDays: supplier.lead_time_days ? String(supplier.lead_time_days) : '7',
      rating:
        supplier.rating !== undefined && supplier.rating !== null
          ? String(supplier.rating)
          : '',
      onTimeRate:
        supplier.on_time_rate !== undefined && supplier.on_time_rate !== null
          ? String(supplier.on_time_rate)
          : '',
      defectRate:
        supplier.defect_rate !== undefined && supplier.defect_rate !== null
          ? String(supplier.defect_rate)
          : '',
      refundRate:
        supplier.refund_rate !== undefined && supplier.refund_rate !== null
          ? String(supplier.refund_rate)
          : '',
    })
    setIsEditDialogOpen(true)
  }

  const renderSupplierForm = (
    form: SupplierFormState,
    setForm: Dispatch<SetStateAction<SupplierFormState>>,
  ) => (
    <div className='grid gap-3 md:grid-cols-2'>
      <div className='space-y-1'>
        <Label>Company Name</Label>
        <Input
          value={form.companyName}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, companyName: event.target.value }))
          }
          placeholder='Supplier Co.'
        />
      </div>
      <div className='space-y-1'>
        <Label>Contact Name</Label>
        <Input
          value={form.contactName}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, contactName: event.target.value }))
          }
          placeholder='Contact person'
        />
      </div>
      <div className='space-y-1'>
        <Label>Email</Label>
        <Input
          value={form.email}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, email: event.target.value }))
          }
          placeholder='supplier@example.com'
        />
      </div>
      <div className='space-y-1'>
        <Label>Phone</Label>
        <Input
          value={form.phone}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, phone: event.target.value }))
          }
          placeholder='+1...'
        />
      </div>
      <div className='space-y-1'>
        <Label>Source Platform</Label>
        <Select
          value={form.sourcePlatform}
          onValueChange={(value: SupplierSourcePlatform) =>
            setForm((prev) => ({ ...prev, sourcePlatform: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='wholesale_distributor'>
              Wholesale Distributor
            </SelectItem>
            <SelectItem value='brand_manufacturer'>Brand / Manufacturer</SelectItem>
            <SelectItem value='amazon'>Amazon</SelectItem>
            <SelectItem value='alibaba'>Alibaba</SelectItem>
            <SelectItem value='other'>Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-1'>
        <Label>Status</Label>
        <Select
          value={form.status}
          onValueChange={(value: 'active' | 'watchlist' | 'blocked') =>
            setForm((prev) => ({ ...prev, status: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='active'>Active</SelectItem>
            <SelectItem value='watchlist'>Watchlist</SelectItem>
            <SelectItem value='blocked'>Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-1'>
        <Label>Country Code</Label>
        <Input
          value={form.countryCode}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              countryCode: event.target.value.toUpperCase(),
            }))
          }
          placeholder='US'
        />
      </div>
      <div className='space-y-1'>
        <Label>Lead Time (days)</Label>
        <Input
          type='number'
          value={form.leadTimeDays}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, leadTimeDays: event.target.value }))
          }
          placeholder='7'
        />
      </div>
      <div className='space-y-1'>
        <Label>Rating</Label>
        <Input
          type='number'
          value={form.rating}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, rating: event.target.value }))
          }
          placeholder='4.5'
        />
      </div>
      <div className='space-y-1'>
        <Label>On-time %</Label>
        <Input
          type='number'
          value={form.onTimeRate}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, onTimeRate: event.target.value }))
          }
          placeholder='95'
        />
      </div>
      <div className='space-y-1'>
        <Label>Defect %</Label>
        <Input
          type='number'
          value={form.defectRate}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, defectRate: event.target.value }))
          }
          placeholder='1.2'
        />
      </div>
      <div className='space-y-1'>
        <Label>Refund %</Label>
        <Input
          type='number'
          value={form.refundRate}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, refundRate: event.target.value }))
          }
          placeholder='0.8'
        />
      </div>
      <div className='space-y-1 md:col-span-2'>
        <Label>Payment Terms</Label>
        <Input
          value={form.paymentTerms}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, paymentTerms: event.target.value }))
          }
          placeholder='Net 30'
        />
      </div>
    </div>
  )

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Supplier Scorecard</h1>
          <p className='text-muted-foreground'>
            Track supplier quality, control status, and maintain product offers.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>Add Supplier</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Filters</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-3 md:grid-cols-4'>
          <div className='space-y-1'>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='watchlist'>Watchlist</SelectItem>
                <SelectItem value='blocked'>Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label>Source</Label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All</SelectItem>
                <SelectItem value='wholesale_distributor'>
                  Wholesale Distributor
                </SelectItem>
                <SelectItem value='brand_manufacturer'>Brand / Manufacturer</SelectItem>
                <SelectItem value='amazon'>Amazon</SelectItem>
                <SelectItem value='alibaba'>Alibaba</SelectItem>
                <SelectItem value='other'>Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1 md:col-span-2'>
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Company, contact, email...'
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Supplier Table</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSuppliers ? (
            <div className='space-y-2'>
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Rates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier: any) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div>
                        <p className='font-medium'>{supplier.company_name}</p>
                        <p className='text-xs text-muted-foreground'>
                          {supplier.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className='capitalize'>
                      {supplier.source_platform || 'other'}
                    </TableCell>
                    <TableCell>
                      Rating {Number(supplier.rating || 0).toFixed(1)}
                    </TableCell>
                    <TableCell className='text-xs'>
                      On-time {Number(supplier.on_time_rate || 0).toFixed(1)}% ·
                      Defect {Number(supplier.defect_rate || 0).toFixed(1)}% ·
                      Refund {Number(supplier.refund_rate || 0).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          supplier.status === 'blocked'
                            ? 'destructive'
                            : supplier.status === 'watchlist'
                              ? 'secondary'
                              : 'default'
                        }
                      >
                        {supplier.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Select
                          value={supplier.status || 'active'}
                          onValueChange={(nextStatus: string) =>
                            updateStatusMutation.mutate({
                              supplierId: supplier.id,
                              status: nextStatus,
                            })
                          }
                        >
                          <SelectTrigger className='w-32.5 h-8'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='active'>Active</SelectItem>
                            <SelectItem value='watchlist'>Watchlist</SelectItem>
                            <SelectItem value='blocked'>Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setSelectedSupplierId(supplier.id)}
                        >
                          Offers
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => openImportDialog(supplier.id)}
                        >
                          Import Products
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => openEditDialog(supplier)}
                        >
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Offer Editor</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {!selectedSupplierId ? (
            <p className='text-sm text-muted-foreground'>
              Select a supplier row and click Offers to edit product offers.
            </p>
          ) : (
            <>
              <div className='rounded-md border p-3 text-sm'>
                Editing offers for{' '}
                <span className='font-semibold'>
                  {selectedSupplier?.company_name || selectedSupplierId}
                </span>
              </div>

              <div className='grid gap-3 md:grid-cols-3'>
                <div className='space-y-1 md:col-span-2'>
                  <Label>Product</Label>
                  <Select
                    value={offerForm.productId}
                    onValueChange={(value: string) =>
                      setOfferForm((prev) => ({ ...prev, productId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select product' />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label>Supplier SKU</Label>
                  <Input
                    value={offerForm.supplierSku}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        supplierSku: event.target.value,
                      }))
                    }
                    placeholder='AMZ-123'
                  />
                </div>
              </div>

              <div className='grid gap-3 md:grid-cols-4'>
                <div className='space-y-1'>
                  <Label>Cost Price</Label>
                  <Input
                    type='number'
                    value={offerForm.costPrice}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        costPrice: event.target.value,
                      }))
                    }
                    placeholder='0.00'
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Shipping Cost</Label>
                  <Input
                    type='number'
                    value={offerForm.shippingCost}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        shippingCost: event.target.value,
                      }))
                    }
                    placeholder='0.00'
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Stock Qty</Label>
                  <Input
                    type='number'
                    value={offerForm.stockQuantity}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        stockQuantity: event.target.value,
                      }))
                    }
                    placeholder='0'
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Currency</Label>
                  <Input
                    value={offerForm.currencyCode}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        currencyCode: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder='USD'
                  />
                </div>
              </div>

              <div className='grid gap-3 md:grid-cols-4'>
                <div className='space-y-1'>
                  <Label>Lead Time (days)</Label>
                  <Input
                    type='number'
                    value={offerForm.leadTimeDays}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        leadTimeDays: event.target.value,
                      }))
                    }
                    placeholder='7'
                  />
                </div>
                <div className='space-y-1'>
                  <Label>ETA (days)</Label>
                  <Input
                    type='number'
                    value={offerForm.estimatedDeliveryDays}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        estimatedDeliveryDays: event.target.value,
                      }))
                    }
                    placeholder='10'
                  />
                </div>
                <div className='space-y-1'>
                  <Label>MOQ</Label>
                  <Input
                    type='number'
                    value={offerForm.minOrderQuantity}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        minOrderQuantity: event.target.value,
                      }))
                    }
                    placeholder='1'
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Supplier URL</Label>
                  <Input
                    value={offerForm.supplierUrl}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        supplierUrl: event.target.value,
                      }))
                    }
                    placeholder='https://...'
                  />
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-5 text-sm'>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={offerForm.isPrimary}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        isPrimary: event.target.checked,
                      }))
                    }
                  />
                  Primary Offer
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={offerForm.isAvailable}
                    onChange={(event) =>
                      setOfferForm((prev) => ({
                        ...prev,
                        isAvailable: event.target.checked,
                      }))
                    }
                  />
                  Available
                </label>
                <Button
                  onClick={() => upsertOfferMutation.mutate()}
                  disabled={upsertOfferMutation.isPending}
                >
                  {upsertOfferMutation.isPending ? 'Saving...' : 'Save Offer'}
                </Button>
              </div>

              <div className='rounded-lg border p-3'>
                <p className='mb-2 text-sm font-semibold'>Current Offers</p>
                {isLoadingOffers ? (
                  <Skeleton className='h-8 w-full' />
                ) : offers.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    No offers yet for this supplier.
                  </p>
                ) : (
                  <div className='space-y-2'>
                    {offers.map((offer: any) => (
                      <div
                        key={offer.id}
                        className='flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm'
                      >
                        <div>
                          <p className='font-medium'>{offer.product_name}</p>
                          <p className='text-xs text-muted-foreground'>
                            SKU: {offer.supplier_sku || '-'} · Stock:{' '}
                            {offer.stock_quantity}
                          </p>
                        </div>
                        <div>
                          ${Number(offer.cost_price || 0).toFixed(2)} + ${' '}
                          {Number(offer.shipping_cost || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Product Economics &amp; Auto-Pause</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-3'>
            <div className='space-y-1 md:col-span-2'>
              <Label>Product</Label>
              <Select
                value={economicsProductId}
                onValueChange={(value: string) => setEconomicsProductId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select product' />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-end gap-2'>
              <Button
                variant='outline'
                disabled={!economicsProductId || recomputeEconomicsMutation.isPending}
                onClick={() => recomputeEconomicsMutation.mutate()}
              >
                {recomputeEconomicsMutation.isPending ? 'Computing...' : 'Recompute'}
              </Button>
              <Button
                variant='outline'
                disabled={!economicsProductId || evaluateAutoPauseMutation.isPending}
                onClick={() => evaluateAutoPauseMutation.mutate()}
              >
                Evaluate Pause
              </Button>
            </div>
          </div>

          {isLoadingEconomics ? (
            <Skeleton className='h-16 w-full' />
          ) : economics ? (
            <div className='grid gap-2 rounded-md border p-3 text-sm md:grid-cols-4'>
              <div>
                Sell price{' '}
                <span className='font-semibold'>
                  €{Number(economics.sell_price || 0).toFixed(2)}
                </span>
              </div>
              <div>
                Landed cost{' '}
                <span className='font-semibold'>
                  €{Number(economics.landed_cost || 0).toFixed(2)}
                </span>
              </div>
              <div>
                Margin{' '}
                <span className='font-semibold'>
                  {Number(economics.margin_percent || 0).toFixed(1)}%
                </span>
              </div>
              <div>
                {economicsFlags?.auto_pause ? (
                  <Badge variant='destructive'>Auto-paused</Badge>
                ) : (
                  <Badge variant='default'>Active</Badge>
                )}
              </div>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Select a product, then Recompute to view its margin.
            </p>
          )}

          <div className='rounded-lg border p-3'>
            <p className='mb-2 text-sm font-semibold'>Currently Auto-Paused Products</p>
            {isLoadingAutoPaused ? (
              <Skeleton className='h-8 w-full' />
            ) : autoPausedProducts.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No products are currently auto-paused for low margin.
              </p>
            ) : (
              <div className='space-y-2'>
                {autoPausedProducts.map((item) => (
                  <div
                    key={item.product_id}
                    className='flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm'
                  >
                    <div>
                      <p className='font-medium'>{item.product_name}</p>
                      <p className='text-xs text-muted-foreground'>
                        {item.pause_reason || 'Margin below floor'}
                      </p>
                    </div>
                    <Badge variant='destructive'>
                      {Number(item.margin_percent || 0).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Create Supplier</DialogTitle>
          </DialogHeader>
          {renderSupplierForm(createForm, setCreateForm)}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              onClick={() => createSupplierMutation.mutate()}
              disabled={createSupplierMutation.isPending}
            >
              {createSupplierMutation.isPending ? 'Saving...' : 'Create Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          {renderSupplierForm(editForm, setEditForm)}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              onClick={() => editSupplierMutation.mutate()}
              disabled={editSupplierMutation.isPending || !editingSupplierId}
            >
              {editSupplierMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Import Supplier Catalogue (CSV)</DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              Required columns: <code>sku, product_name, cost_price,
              stock_quantity, lead_time_days</code>. Optional: <code>currency_code</code>{' '}
              (defaults to EUR). New SKUs are created as inactive drafts for review
              before they go live.
            </p>

            <div
              {...getImportRootProps()}
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                isImportDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50',
              )}
            >
              <input {...getImportInputProps()} />
              <Upload className='mx-auto mb-3 h-8 w-8 text-muted-foreground' />
              <p className='mb-1 text-sm text-muted-foreground'>
                {importFile
                  ? importFile.name
                  : isImportDragActive
                    ? 'Drop the CSV file here...'
                    : 'Drag & drop a .csv file here, or click to select'}
              </p>
            </div>

            {!importPreview ? (
              <Button
                onClick={() => previewImportMutation.mutate()}
                disabled={!importFile || previewImportMutation.isPending}
              >
                {previewImportMutation.isPending ? 'Parsing...' : 'Preview Import'}
              </Button>
            ) : (
              <div className='space-y-3'>
                <div className='grid grid-cols-3 gap-2 text-sm'>
                  <div className='rounded border p-2 text-center'>
                    <p className='font-semibold'>{importPreview.rowsToCreate.length}</p>
                    <p className='text-muted-foreground'>To create</p>
                  </div>
                  <div className='rounded border p-2 text-center'>
                    <p className='font-semibold'>{importPreview.rowsToUpdate.length}</p>
                    <p className='text-muted-foreground'>To update</p>
                  </div>
                  <div className='rounded border p-2 text-center'>
                    <p className='font-semibold'>{importPreview.errors.length}</p>
                    <p className='text-muted-foreground'>Errors</p>
                  </div>
                </div>

                {importPreview.errors.length > 0 && (
                  <div className='max-h-40 overflow-y-auto rounded border p-2 text-xs'>
                    {importPreview.errors.map((rowError) => (
                      <p key={rowError.rowNumber} className='text-destructive'>
                        Row {rowError.rowNumber}: {rowError.reason}
                      </p>
                    ))}
                  </div>
                )}

                <div className='max-h-52 overflow-y-auto rounded border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...importPreview.rowsToCreate, ...importPreview.rowsToUpdate].map(
                        (row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.sku}</TableCell>
                            <TableCell>{row.productName}</TableCell>
                            <TableCell>
                              {row.currencyCode} {row.costPrice.toFixed(2)}
                            </TableCell>
                            <TableCell>{row.stockQuantity}</TableCell>
                            <TableCell className='capitalize'>{row.action}</TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setIsImportDialogOpen(false)
                setImportFile(null)
                setImportPreview(null)
              }}
            >
              Cancel
            </Button>
            {importPreview && (
              <Button
                type='button'
                onClick={() => commitImportMutation.mutate()}
                disabled={
                  commitImportMutation.isPending ||
                  (importPreview.rowsToCreate.length === 0 &&
                    importPreview.rowsToUpdate.length === 0)
                }
              >
                {commitImportMutation.isPending ? 'Committing...' : 'Confirm Import'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
