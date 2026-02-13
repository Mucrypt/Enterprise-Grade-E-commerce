'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Settings,
  Store,
  Bell,
  Shield,
  Palette,
  Globe,
  CreditCard,
  Mail,
} from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Settings</h1>
        <p className='text-muted-foreground'>Configure your store settings</p>
      </div>

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
              <Mail className='h-5 w-5 text-purple-500' />
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
