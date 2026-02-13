'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, ShieldCheck, ShieldAlert, UserCog } from 'lucide-react'

export default function AdminsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Admin Users</h1>
        <p className='text-muted-foreground'>Manage administrator accounts</p>
      </div>

      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Admins</CardTitle>
            <Shield className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>1</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Super Admins</CardTitle>
            <ShieldCheck className='h-4 w-4 text-purple-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>1</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Moderators</CardTitle>
            <UserCog className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Pending</CardTitle>
            <ShieldAlert className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 border rounded-lg'>
              <div className='flex items-center gap-4'>
                <div className='w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center'>
                  <ShieldCheck className='h-5 w-5 text-purple-600' />
                </div>
                <div>
                  <p className='font-medium'>Super Admin</p>
                  <p className='text-sm text-muted-foreground'>
                    admin@techtools.com
                  </p>
                </div>
              </div>
              <span className='px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700'>
                Super Admin
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
