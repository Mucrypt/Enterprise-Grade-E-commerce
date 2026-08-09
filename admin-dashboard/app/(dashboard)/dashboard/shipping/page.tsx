'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Truck,
  Package,
  Settings,
  Search,
  RefreshCcw,
  Check,
  X,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  MapPin,
  Clock,
  DollarSign,
  Plane,
  Ship,
  Building2,
  Eye,
  EyeOff,
  Save,
  TestTube,
  Zap,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  getCarrierConfigs,
  getShippingSettings,
  updateCarrierConfig,
  updateShippingSettings,
  getShippingRates,
  trackShipment,
  getCarrierServices,
  validateAddress,
  CarrierConfig,
  ShippingSettings,
  ShippingRate,
  TrackingInfo,
  ShippingAddress,
  Package as PackageType,
  formatDeliveryTime,
  getTrackingUrl,
} from '@/services/shipping.service'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'

export default function ShippingPage() {
  return (
    <RequirePagePermission permission='shipping.view'>
      <ShippingPageContent />
    </RequirePagePermission>
  )
}

function ShippingPageContent() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('carriers')
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierConfig | null>(
    null,
  )
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false)
  const [isTrackDialogOpen, setIsTrackDialogOpen] = useState(false)
  const [showCredentials, setShowCredentials] = useState<
    Record<string, boolean>
  >({})

  // Form states
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingCarrier, setTrackingCarrier] = useState<
    'fedex' | 'ups' | 'dhl'
  >('fedex')
  const [trackingResult, setTrackingResult] = useState<TrackingInfo | null>(
    null,
  )
  const [rateResults, setRateResults] = useState<ShippingRate[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  // Rate test form
  const [fromAddress, setFromAddress] = useState<Partial<ShippingAddress>>({
    name: 'Test Warehouse',
    street1: '123 Commerce St',
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90001',
    country: 'US',
  })

  const [toAddress, setToAddress] = useState<Partial<ShippingAddress>>({
    name: 'Test Customer',
    street1: '456 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
  })

  const [testPackage, setTestPackage] = useState<Partial<PackageType>>({
    weight: 2,
    weightUnit: 'lb',
    length: 12,
    width: 8,
    height: 6,
    dimensionUnit: 'in',
  })

  // Queries
  const { data: carriers = [], isLoading: carriersLoading } = useQuery({
    queryKey: ['shipping-carriers'],
    queryFn: getCarrierConfigs,
  })

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['shipping-settings'],
    queryFn: getShippingSettings,
  })

  const { data: services } = useQuery({
    queryKey: ['carrier-services'],
    queryFn: () => getCarrierServices(),
  })

  // Mutations
  const updateCarrierMutation = useMutation({
    mutationFn: ({
      carrierCode,
      config,
    }: {
      carrierCode: string
      config: {
        isActive?: boolean
        isSandbox?: boolean
        credentials?: Record<string, string>
      }
    }) => updateCarrierConfig(carrierCode, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-carriers'] })
      toast.success('Carrier configuration updated')
      setIsConfigDialogOpen(false)
    },
    onError: () => {
      toast.error('Failed to update carrier configuration')
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: updateShippingSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-settings'] })
      toast.success('Shipping settings updated')
    },
    onError: () => {
      toast.error('Failed to update shipping settings')
    },
  })

  // Handlers
  const handleToggleCarrier = (carrier: CarrierConfig) => {
    updateCarrierMutation.mutate({
      carrierCode: carrier.carrier_code,
      config: { isActive: !carrier.is_active },
    })
  }

  const handleToggleSandbox = (carrier: CarrierConfig) => {
    updateCarrierMutation.mutate({
      carrierCode: carrier.carrier_code,
      config: { isSandbox: !carrier.is_sandbox },
    })
  }

  const handleCalculateRates = async () => {
    setIsCalculating(true)
    try {
      const result = await getShippingRates(
        fromAddress as ShippingAddress,
        toAddress as ShippingAddress,
        [testPackage as PackageType],
      )
      setRateResults(result.rates)
      if (result.rates.length === 0) {
        toast.info('No rates returned. Carriers may not be configured.')
      } else {
        toast.success(`Found ${result.rates.length} shipping rates`)
      }
    } catch (error) {
      toast.error('Failed to calculate shipping rates')
    } finally {
      setIsCalculating(false)
    }
  }

  const handleTrackShipment = async () => {
    if (!trackingNumber.trim()) {
      toast.error('Please enter a tracking number')
      return
    }
    setIsTracking(true)
    try {
      const result = await trackShipment(trackingNumber, trackingCarrier)
      setTrackingResult(result)
      toast.success('Tracking information retrieved')
    } catch (error) {
      toast.error('Failed to track shipment')
    } finally {
      setIsTracking(false)
    }
  }

  const handleValidateAddress = async (
    address: Partial<ShippingAddress>,
    type: 'from' | 'to',
  ) => {
    try {
      const result = await validateAddress(address as ShippingAddress, 'ups')
      if (result.valid) {
        toast.success('Address is valid')
        if (result.suggestions?.[0]) {
          if (type === 'from') {
            setFromAddress(result.suggestions[0])
          } else {
            setToAddress(result.suggestions[0])
          }
        }
      } else {
        toast.warning('Address could not be verified')
      }
    } catch (error) {
      toast.error('Address validation failed')
    }
  }

  const handleCopyTracking = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const getCarrierIcon = (carrierCode: string) => {
    switch (carrierCode) {
      case 'fedex':
        return <Plane className='h-5 w-5' />
      case 'ups':
        return <Truck className='h-5 w-5' />
      case 'dhl':
        return <Ship className='h-5 w-5' />
      default:
        return <Package className='h-5 w-5' />
    }
  }

  const getCarrierBgColor = (carrierCode: string) => {
    switch (carrierCode) {
      case 'fedex':
        return 'bg-purple-100 text-purple-700'
      case 'ups':
        return 'bg-amber-100 text-amber-700'
      case 'dhl':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const renderCredentialFields = (carrierCode: string) => {
    const isVisible = showCredentials[carrierCode]

    switch (carrierCode) {
      case 'fedex':
        return (
          <div className='space-y-4'>
            <div>
              <Label>Account Number</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='FedEx Account Number'
                id={`${carrierCode}-accountNumber`}
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='FedEx API Key'
                id={`${carrierCode}-apiKey`}
              />
            </div>
            <div>
              <Label>Secret Key</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='FedEx Secret Key'
                id={`${carrierCode}-secretKey`}
              />
            </div>
          </div>
        )
      case 'ups':
        return (
          <div className='space-y-4'>
            <div>
              <Label>Account Number</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='UPS Account Number'
                id={`${carrierCode}-accountNumber`}
              />
            </div>
            <div>
              <Label>Client ID</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='UPS Client ID'
                id={`${carrierCode}-clientId`}
              />
            </div>
            <div>
              <Label>Client Secret</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='UPS Client Secret'
                id={`${carrierCode}-clientSecret`}
              />
            </div>
          </div>
        )
      case 'dhl':
        return (
          <div className='space-y-4'>
            <div>
              <Label>Site ID</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='DHL Site ID'
                id={`${carrierCode}-siteId`}
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='DHL Password'
                id={`${carrierCode}-password`}
              />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input
                type={isVisible ? 'text' : 'password'}
                placeholder='DHL Account Number'
                id={`${carrierCode}-accountNumber`}
              />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Shipping</h1>
          <p className='text-muted-foreground'>
            Configure shipping carriers, calculate rates, and track shipments
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            onClick={() => setIsTrackDialogOpen(true)}
            className='gap-2'
          >
            <Search className='h-4 w-4' />
            Track Shipment
          </Button>
          <Button onClick={() => setIsRateDialogOpen(true)} className='gap-2'>
            <DollarSign className='h-4 w-4' />
            Calculate Rates
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Active Carriers
            </CardTitle>
            <Truck className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {carriers.filter((c) => c.is_active).length}
            </div>
            <p className='text-xs text-muted-foreground'>
              of {carriers.length} total carriers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Configured</CardTitle>
            <Check className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {carriers.filter((c) => c.is_configured).length}
            </div>
            <p className='text-xs text-muted-foreground'>
              carriers with credentials
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Test Mode</CardTitle>
            <TestTube className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {carriers.filter((c) => c.is_sandbox).length}
            </div>
            <p className='text-xs text-muted-foreground'>in sandbox mode</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Free Shipping</CardTitle>
            <Zap className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {settings?.free_shipping_threshold
                ? `$${settings.free_shipping_threshold}`
                : 'Disabled'}
            </div>
            <p className='text-xs text-muted-foreground'>threshold amount</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='carriers' className='gap-2'>
            <Truck className='h-4 w-4' />
            Carriers
          </TabsTrigger>
          <TabsTrigger value='settings' className='gap-2'>
            <Settings className='h-4 w-4' />
            Settings
          </TabsTrigger>
          <TabsTrigger value='services' className='gap-2'>
            <Package className='h-4 w-4' />
            Services
          </TabsTrigger>
        </TabsList>

        {/* Carriers Tab */}
        <TabsContent value='carriers' className='space-y-4'>
          {carriersLoading ? (
            <div className='flex items-center justify-center py-12'>
              <RefreshCcw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : (
            <div className='grid gap-4 md:grid-cols-3'>
              {carriers.map((carrier) => (
                <Card
                  key={carrier.id}
                  className={carrier.is_active ? '' : 'opacity-60'}
                >
                  <CardHeader className='pb-3'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div
                          className={`p-2 rounded-lg ${getCarrierBgColor(
                            carrier.carrier_code,
                          )}`}
                        >
                          {getCarrierIcon(carrier.carrier_code)}
                        </div>
                        <div>
                          <CardTitle className='text-lg'>
                            {carrier.carrier_name}
                          </CardTitle>
                          <CardDescription className='text-xs uppercase'>
                            {carrier.carrier_code}
                          </CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={carrier.is_active}
                        onCheckedChange={() => handleToggleCarrier(carrier)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Status</span>
                      <Badge
                        variant={carrier.is_active ? 'default' : 'secondary'}
                      >
                        {carrier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Mode</span>
                      <Badge
                        variant={carrier.is_sandbox ? 'outline' : 'default'}
                      >
                        {carrier.is_sandbox ? 'Sandbox' : 'Production'}
                      </Badge>
                    </div>

                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Credentials</span>
                      {carrier.is_configured ? (
                        <Badge
                          variant='outline'
                          className='gap-1 text-green-600'
                        >
                          <Check className='h-3 w-3' /> Configured
                        </Badge>
                      ) : (
                        <Badge
                          variant='outline'
                          className='gap-1 text-amber-600'
                        >
                          <AlertCircle className='h-3 w-3' /> Not Set
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='flex-1'
                        onClick={() => {
                          setSelectedCarrier(carrier)
                          setIsConfigDialogOpen(true)
                        }}
                      >
                        <Settings className='h-4 w-4 mr-1' />
                        Configure
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleToggleSandbox(carrier)}
                      >
                        {carrier.is_sandbox ? (
                          <TestTube className='h-4 w-4' />
                        ) : (
                          <Zap className='h-4 w-4' />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value='settings' className='space-y-6'>
          {settingsLoading ? (
            <div className='flex items-center justify-center py-12'>
              <RefreshCcw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : (
            <div className='grid gap-6 md:grid-cols-2'>
              {/* Default Units */}
              <Card>
                <CardHeader>
                  <CardTitle>Default Units</CardTitle>
                  <CardDescription>
                    Set default measurement units for shipping
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid gap-4 grid-cols-2'>
                    <div>
                      <Label>Weight Unit</Label>
                      <Select
                        defaultValue={settings?.default_weight_unit || 'lb'}
                        onValueChange={(value: string) =>
                          updateSettingsMutation.mutate({
                            defaultWeightUnit: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='lb'>Pounds (lb)</SelectItem>
                          <SelectItem value='kg'>Kilograms (kg)</SelectItem>
                          <SelectItem value='oz'>Ounces (oz)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Dimension Unit</Label>
                      <Select
                        defaultValue={settings?.default_dimension_unit || 'in'}
                        onValueChange={(value: string) =>
                          updateSettingsMutation.mutate({
                            defaultDimensionUnit: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='in'>Inches (in)</SelectItem>
                          <SelectItem value='cm'>Centimeters (cm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Default Country</Label>
                    <Select
                      defaultValue={settings?.default_country || 'US'}
                      onValueChange={(value: string) =>
                        updateSettingsMutation.mutate({ defaultCountry: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='US'>United States</SelectItem>
                        <SelectItem value='CA'>Canada</SelectItem>
                        <SelectItem value='GB'>United Kingdom</SelectItem>
                        <SelectItem value='DE'>Germany</SelectItem>
                        <SelectItem value='FR'>France</SelectItem>
                        <SelectItem value='AU'>Australia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Options</CardTitle>
                  <CardDescription>Configure shipping behavior</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div>
                    <Label>Free Shipping Threshold ($)</Label>
                    <Input
                      type='number'
                      placeholder='e.g., 100'
                      defaultValue={settings?.free_shipping_threshold || ''}
                      onChange={(e) => {
                        const value = e.target.value
                          ? parseFloat(e.target.value)
                          : null
                        updateSettingsMutation.mutate({
                          freeShippingThreshold: value,
                        })
                      }}
                    />
                    <p className='text-xs text-muted-foreground mt-1'>
                      Leave empty to disable free shipping
                    </p>
                  </div>
                  <div>
                    <Label>Handling Fee ($)</Label>
                    <Input
                      type='number'
                      step='0.01'
                      placeholder='0.00'
                      defaultValue={settings?.handling_fee || 0}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          handlingFee: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <div>
                      <Label>Require Signature</Label>
                      <p className='text-xs text-muted-foreground'>
                        Require signature on delivery
                      </p>
                    </div>
                    <Switch
                      checked={settings?.signature_required || false}
                      onCheckedChange={(checked: boolean) =>
                        updateSettingsMutation.mutate({
                          signatureRequired: checked,
                        })
                      }
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <div>
                      <Label>Enable Insurance</Label>
                      <p className='text-xs text-muted-foreground'>
                        Add shipping insurance
                      </p>
                    </div>
                    <Switch
                      checked={settings?.insurance_enabled || false}
                      onCheckedChange={(checked: boolean) =>
                        updateSettingsMutation.mutate({
                          insuranceEnabled: checked,
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Origin Address */}
              <Card className='md:col-span-2'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Building2 className='h-5 w-5' />
                    Origin Address (Warehouse)
                  </CardTitle>
                  <CardDescription>
                    Default ship-from address for all shipments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='grid gap-4 md:grid-cols-3'>
                    <div className='md:col-span-3'>
                      <Label>Business Name</Label>
                      <Input placeholder='Company or warehouse name' />
                    </div>
                    <div className='md:col-span-2'>
                      <Label>Street Address</Label>
                      <Input placeholder='123 Commerce St' />
                    </div>
                    <div>
                      <Label>Suite/Unit</Label>
                      <Input placeholder='Suite 100' />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input placeholder='Los Angeles' />
                    </div>
                    <div>
                      <Label>State/Province</Label>
                      <Input placeholder='CA' />
                    </div>
                    <div>
                      <Label>Postal Code</Label>
                      <Input placeholder='90001' />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Select defaultValue='US'>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='US'>United States</SelectItem>
                          <SelectItem value='CA'>Canada</SelectItem>
                          <SelectItem value='GB'>United Kingdom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input placeholder='+1 (555) 000-0000' />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type='email' placeholder='shipping@company.com' />
                    </div>
                  </div>
                  <div className='mt-4'>
                    <Button>
                      <Save className='h-4 w-4 mr-2' />
                      Save Origin Address
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value='services' className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-3'>
            {services &&
              Object.entries(services).map(([carrier, serviceList]) => (
                <Card key={carrier}>
                  <CardHeader>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`p-2 rounded-lg ${getCarrierBgColor(
                          carrier,
                        )}`}
                      >
                        {getCarrierIcon(carrier)}
                      </div>
                      <CardTitle className='capitalize'>
                        {carrier} Services
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-2 max-h-64 overflow-y-auto'>
                      {serviceList.map((service) => (
                        <div
                          key={service.code}
                          className='flex items-center justify-between p-2 rounded-md bg-muted/50'
                        >
                          <span className='text-sm'>{service.name}</span>
                          <Badge
                            variant='outline'
                            className='text-xs font-mono'
                          >
                            {service.code}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Configure Carrier Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              {selectedCarrier && (
                <div
                  className={`p-2 rounded-lg ${getCarrierBgColor(
                    selectedCarrier.carrier_code,
                  )}`}
                >
                  {getCarrierIcon(selectedCarrier.carrier_code)}
                </div>
              )}
              Configure {selectedCarrier?.carrier_name}
            </DialogTitle>
            <DialogDescription>
              Enter your API credentials for {selectedCarrier?.carrier_name}
            </DialogDescription>
          </DialogHeader>

          {selectedCarrier && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <Label>Show Credentials</Label>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    setShowCredentials((prev) => ({
                      ...prev,
                      [selectedCarrier.carrier_code]:
                        !prev[selectedCarrier.carrier_code],
                    }))
                  }
                >
                  {showCredentials[selectedCarrier.carrier_code] ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </Button>
              </div>

              {renderCredentialFields(selectedCarrier.carrier_code)}

              <Separator />

              <div className='flex items-center justify-between'>
                <div>
                  <Label>Sandbox Mode</Label>
                  <p className='text-xs text-muted-foreground'>
                    Use test environment
                  </p>
                </div>
                <Switch
                  checked={selectedCarrier.is_sandbox}
                  onCheckedChange={() => handleToggleSandbox(selectedCarrier)}
                />
              </div>

              <div className='flex justify-end gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setIsConfigDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const carrierCode = selectedCarrier.carrier_code
                    const credentials: Record<string, string> = {}

                    // Collect credentials from form
                    const fields = [
                      'accountNumber',
                      'apiKey',
                      'secretKey',
                      'clientId',
                      'clientSecret',
                      'siteId',
                      'password',
                    ]
                    fields.forEach((field) => {
                      const input = document.getElementById(
                        `${carrierCode}-${field}`,
                      ) as HTMLInputElement
                      if (input?.value) {
                        credentials[field] = input.value
                      }
                    })

                    updateCarrierMutation.mutate({
                      carrierCode,
                      config: { credentials },
                    })
                  }}
                  disabled={updateCarrierMutation.isPending}
                >
                  {updateCarrierMutation.isPending ? (
                    <RefreshCcw className='h-4 w-4 animate-spin mr-2' />
                  ) : (
                    <Save className='h-4 w-4 mr-2' />
                  )}
                  Save Credentials
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Calculate Rates Dialog */}
      <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Calculate Shipping Rates</DialogTitle>
            <DialogDescription>
              Get live shipping rates from all enabled carriers
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-6 md:grid-cols-2'>
            {/* From Address */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <Building2 className='h-4 w-4' />
                  Ship From
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Input
                  placeholder='Name'
                  value={fromAddress.name || ''}
                  onChange={(e) =>
                    setFromAddress({ ...fromAddress, name: e.target.value })
                  }
                />
                <Input
                  placeholder='Street Address'
                  value={fromAddress.street1 || ''}
                  onChange={(e) =>
                    setFromAddress({ ...fromAddress, street1: e.target.value })
                  }
                />
                <div className='grid grid-cols-2 gap-2'>
                  <Input
                    placeholder='City'
                    value={fromAddress.city || ''}
                    onChange={(e) =>
                      setFromAddress({ ...fromAddress, city: e.target.value })
                    }
                  />
                  <Input
                    placeholder='State'
                    value={fromAddress.state || ''}
                    onChange={(e) =>
                      setFromAddress({ ...fromAddress, state: e.target.value })
                    }
                  />
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <Input
                    placeholder='Postal Code'
                    value={fromAddress.postalCode || ''}
                    onChange={(e) =>
                      setFromAddress({
                        ...fromAddress,
                        postalCode: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder='Country'
                    value={fromAddress.country || ''}
                    onChange={(e) =>
                      setFromAddress({
                        ...fromAddress,
                        country: e.target.value,
                      })
                    }
                  />
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='w-full'
                  onClick={() => handleValidateAddress(fromAddress, 'from')}
                >
                  <MapPin className='h-4 w-4 mr-2' />
                  Validate Address
                </Button>
              </CardContent>
            </Card>

            {/* To Address */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <MapPin className='h-4 w-4' />
                  Ship To
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Input
                  placeholder='Name'
                  value={toAddress.name || ''}
                  onChange={(e) =>
                    setToAddress({ ...toAddress, name: e.target.value })
                  }
                />
                <Input
                  placeholder='Street Address'
                  value={toAddress.street1 || ''}
                  onChange={(e) =>
                    setToAddress({ ...toAddress, street1: e.target.value })
                  }
                />
                <div className='grid grid-cols-2 gap-2'>
                  <Input
                    placeholder='City'
                    value={toAddress.city || ''}
                    onChange={(e) =>
                      setToAddress({ ...toAddress, city: e.target.value })
                    }
                  />
                  <Input
                    placeholder='State'
                    value={toAddress.state || ''}
                    onChange={(e) =>
                      setToAddress({ ...toAddress, state: e.target.value })
                    }
                  />
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <Input
                    placeholder='Postal Code'
                    value={toAddress.postalCode || ''}
                    onChange={(e) =>
                      setToAddress({ ...toAddress, postalCode: e.target.value })
                    }
                  />
                  <Input
                    placeholder='Country'
                    value={toAddress.country || ''}
                    onChange={(e) =>
                      setToAddress({ ...toAddress, country: e.target.value })
                    }
                  />
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='w-full'
                  onClick={() => handleValidateAddress(toAddress, 'to')}
                >
                  <MapPin className='h-4 w-4 mr-2' />
                  Validate Address
                </Button>
              </CardContent>
            </Card>

            {/* Package Details */}
            <Card className='md:col-span-2'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <Package className='h-4 w-4' />
                  Package Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 md:grid-cols-6'>
                  <div>
                    <Label className='text-xs'>Weight</Label>
                    <Input
                      type='number'
                      value={testPackage.weight || ''}
                      onChange={(e) =>
                        setTestPackage({
                          ...testPackage,
                          weight: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className='text-xs'>Unit</Label>
                    <Select
                      value={testPackage.weightUnit}
                      onValueChange={(v: string) =>
                        setTestPackage({
                          ...testPackage,
                          weightUnit: v as 'lb' | 'kg',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='lb'>lb</SelectItem>
                        <SelectItem value='kg'>kg</SelectItem>
                        <SelectItem value='oz'>oz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className='text-xs'>Length</Label>
                    <Input
                      type='number'
                      value={testPackage.length || ''}
                      onChange={(e) =>
                        setTestPackage({
                          ...testPackage,
                          length: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className='text-xs'>Width</Label>
                    <Input
                      type='number'
                      value={testPackage.width || ''}
                      onChange={(e) =>
                        setTestPackage({
                          ...testPackage,
                          width: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className='text-xs'>Height</Label>
                    <Input
                      type='number'
                      value={testPackage.height || ''}
                      onChange={(e) =>
                        setTestPackage({
                          ...testPackage,
                          height: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className='text-xs'>Dim Unit</Label>
                    <Select
                      value={testPackage.dimensionUnit}
                      onValueChange={(v: string) =>
                        setTestPackage({
                          ...testPackage,
                          dimensionUnit: v as 'in' | 'cm',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='in'>in</SelectItem>
                        <SelectItem value='cm'>cm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button
            onClick={handleCalculateRates}
            disabled={isCalculating}
            className='w-full'
          >
            {isCalculating ? (
              <RefreshCcw className='h-4 w-4 animate-spin mr-2' />
            ) : (
              <DollarSign className='h-4 w-4 mr-2' />
            )}
            Calculate Rates
          </Button>

          {/* Rate Results */}
          {rateResults.length > 0 && (
            <div className='space-y-3'>
              <h4 className='font-medium'>
                Available Rates ({rateResults.length})
              </h4>
              <div className='space-y-2 max-h-64 overflow-y-auto'>
                {rateResults.map((rate, index) => (
                  <div
                    key={`${rate.carrier}-${rate.serviceCode}-${index}`}
                    className='flex items-center justify-between p-3 rounded-lg border'
                  >
                    <div className='flex items-center gap-3'>
                      <div
                        className={`p-2 rounded-lg ${getCarrierBgColor(
                          rate.carrier,
                        )}`}
                      >
                        {getCarrierIcon(rate.carrier)}
                      </div>
                      <div>
                        <p className='font-medium'>{rate.serviceName}</p>
                        <p className='text-sm text-muted-foreground'>
                          {formatDeliveryTime(rate.deliveryDays)}
                          {rate.guaranteed && (
                            <Badge variant='outline' className='ml-2 text-xs'>
                              Guaranteed
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='text-lg font-bold'>
                        ${rate.totalPrice.toFixed(2)}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {rate.currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Track Shipment Dialog */}
      <Dialog open={isTrackDialogOpen} onOpenChange={setIsTrackDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Track Shipment</DialogTitle>
            <DialogDescription>
              Enter a tracking number to get real-time status
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='flex gap-2'>
              <Select
                value={trackingCarrier}
                onValueChange={(v: string) =>
                  setTrackingCarrier(v as 'fedex' | 'ups' | 'dhl')
                }
              >
                <SelectTrigger className='w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='fedex'>FedEx</SelectItem>
                  <SelectItem value='ups'>UPS</SelectItem>
                  <SelectItem value='dhl'>DHL</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder='Enter tracking number'
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className='flex-1'
              />
              <Button onClick={handleTrackShipment} disabled={isTracking}>
                {isTracking ? (
                  <RefreshCcw className='h-4 w-4 animate-spin' />
                ) : (
                  <Search className='h- w-4' />
                )}
              </Button>
            </div>

            {/* Tracking Result */}
            {trackingResult && (
              <Card>
                <CardHeader className='pb-3'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`p-2 rounded-lg ${getCarrierBgColor(
                          trackingResult.carrier,
                        )}`}
                      >
                        {getCarrierIcon(trackingResult.carrier)}
                      </div>
                      <div>
                        <CardTitle className='flex items-center gap-2'>
                          {trackingResult.trackingNumber}
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-6 w-6'
                            onClick={() =>
                              handleCopyTracking(trackingResult.trackingNumber)
                            }
                          >
                            <Copy className='h-3 w-3' />
                          </Button>
                        </CardTitle>
                        <CardDescription>
                          {trackingResult.statusDescription}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        window.open(
                          getTrackingUrl(
                            trackingResult.carrier,
                            trackingResult.trackingNumber,
                          ),
                          '_blank',
                        )
                      }
                    >
                      <ExternalLink className='h-4 w-4 mr-1' />
                      View on Carrier
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='grid gap-4 md:grid-cols-3 mb-4'>
                    <div>
                      <p className='text-xs text-muted-foreground'>Status</p>
                      <p className='font-medium'>{trackingResult.status}</p>
                    </div>
                    <div>
                      <p className='text-xs text-muted-foreground'>
                        Est. Delivery
                      </p>
                      <p className='font-medium'>
                        {trackingResult.estimatedDelivery
                          ? format(
                              new Date(trackingResult.estimatedDelivery),
                              'MMM d, yyyy',
                            )
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs text-muted-foreground'>Signed By</p>
                      <p className='font-medium'>
                        {trackingResult.signedBy || '-'}
                      </p>
                    </div>
                  </div>

                  <Separator className='my-4' />

                  <div className='space-y-3'>
                    <h4 className='font-medium text-sm'>Tracking History</h4>
                    <div className='space-y-3 max-h-60 overflow-y-auto'>
                      {trackingResult.events.map((event, index) => (
                        <div key={index} className='flex gap-3'>
                          <div className='flex flex-col items-center'>
                            <div
                              className={`w-3 h-3 rounded-full ${
                                index === 0 ? 'bg-primary' : 'bg-muted'
                              }`}
                            />
                            {index < trackingResult.events.length - 1 && (
                              <div className='w-0.5 h-full bg-muted flex-1' />
                            )}
                          </div>
                          <div className='pb-4'>
                            <p className='text-sm font-medium'>
                              {event.description}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              {event.location} •{' '}
                              {format(
                                new Date(event.timestamp),
                                'MMM d, yyyy h:mm a',
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
