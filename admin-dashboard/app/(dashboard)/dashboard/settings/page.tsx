'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import newsletterService from '@/services/newsletter.service'
import {
  Settings,
  Store,
  Bell,
  Shield,
  Palette,
  Globe,
  CreditCard,
  Mail,
  Save,
  Image,
} from 'lucide-react'

export default function SettingsPage() {
  const queryClient = useQueryClient()

  const [brandName, setBrandName] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#f97316')
  const [supportEmail, setSupportEmail] = useState('')

  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['newsletter-settings-branding'],
    queryFn: newsletterService.getSettings,
  })

  useEffect(() => {
    const settings = settingsData?.data?.settings || {}
    if (!settingsData) return

    setBrandName(
      settings.brand_name?.value || settings.from_name?.value || 'TechTools Store',
    )
    setBrandLogoUrl(
      settings.brand_logo_url?.value || 'https://techtoolstore.com/favicon.svg',
    )
    setBrandPrimaryColor(settings.brand_primary_color?.value || '#f97316')
    setSupportEmail(settings.support_email?.value || settings.from_email?.value || '')
  }, [settingsData])

  const saveBrandingMutation = useMutation({
    mutationFn: async () => {
      return newsletterService.updateSettings({
        brand_name: brandName,
        brand_logo_url: brandLogoUrl,
        brand_primary_color: brandPrimaryColor,
        support_email: supportEmail,
        from_name: brandName,
      })
    },
    onSuccess: () => {
      toast.success('Communication branding settings saved.')
      queryClient.invalidateQueries({ queryKey: ['newsletter-settings-branding'] })
    },
    onError: () => {
      toast.error('Failed to save communication branding settings')
    },
  })

  const logoPreview = useMemo(() => {
    if (!brandLogoUrl || !/^https?:\/\//.test(brandLogoUrl)) {
      return null
    }
    return brandLogoUrl
  }, [brandLogoUrl])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Settings</h1>
        <p className='text-muted-foreground'>Configure your store settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Mail className='h-5 w-5 text-orange-500' />
            Communication Brand Config
          </CardTitle>
          <CardDescription>
            Configure logo and brand identity used in AI replies and promotional emails.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='brand-name'>Brand Name</Label>
              <Input
                id='brand-name'
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder='TechTools Store'
                disabled={isLoadingSettings}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='support-email'>Support Email</Label>
              <Input
                id='support-email'
                type='email'
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder='support@techtoolstore.com'
                disabled={isLoadingSettings}
              />
            </div>
            <div className='space-y-2 md:col-span-2'>
              <Label htmlFor='brand-logo-url'>Brand Logo URL</Label>
              <Input
                id='brand-logo-url'
                value={brandLogoUrl}
                onChange={(e) => setBrandLogoUrl(e.target.value)}
                placeholder='https://techtoolstore.com/assets/logo-email.png'
                disabled={isLoadingSettings}
              />
              {logoPreview ? (
                <div className='mt-2 rounded-lg border bg-muted/40 p-3'>
                  <img
                    src={logoPreview}
                    alt='Brand logo preview'
                    className='h-10 object-contain'
                  />
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>
                  Add an absolute URL to preview and embed logo in outbound emails.
                </p>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='brand-primary-color'>Brand Primary Color</Label>
              <div className='flex items-center gap-2'>
                <Input
                  id='brand-primary-color'
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  placeholder='#f97316'
                  disabled={isLoadingSettings}
                />
                <span
                  className='h-8 w-8 rounded border'
                  style={{ backgroundColor: brandPrimaryColor || '#f97316' }}
                  aria-label='Selected color preview'
                />
              </div>
            </div>
          </div>

          <div className='flex justify-end'>
            <Button
              onClick={() => saveBrandingMutation.mutate()}
              disabled={saveBrandingMutation.isPending || isLoadingSettings}
            >
              <Save className='mr-2 h-4 w-4' />
              {saveBrandingMutation.isPending ? 'Saving…' : 'Save Communication Branding'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Store className='h-5 w-5 text-blue-500' />
              Store Settings
            </CardTitle>
            <CardDescription>
              Configure your store name, logo, and basic information
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <CreditCard className='h-5 w-5 text-green-500' />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Set up payment gateways and configure payment options
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Image className='h-5 w-5 text-purple-500' />
              Email Templates
            </CardTitle>
            <CardDescription>
              Customize order confirmations and notification emails
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Bell className='h-5 w-5 text-yellow-500' />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure notification preferences and alerts
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Shield className='h-5 w-5 text-red-500' />
              Security
            </CardTitle>
            <CardDescription>
              Manage security settings and access controls
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Palette className='h-5 w-5 text-pink-500' />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of your store
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Globe className='h-5 w-5 text-cyan-500' />
              Localization
            </CardTitle>
            <CardDescription>
              Configure language, currency, and region settings
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='cursor-pointer hover:shadow-md transition-shadow'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Settings className='h-5 w-5 text-gray-500' />
              Advanced
            </CardTitle>
            <CardDescription>
              Advanced configuration options for developers
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
