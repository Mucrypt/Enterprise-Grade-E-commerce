'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  ShoppingCart,
  Users,
  Eye,
} from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Analytics</h1>
        <p className='text-muted-foreground'>Track your store performance</p>
      </div>

      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Revenue</CardTitle>
            <DollarSign className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>$0.00</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <TrendingUp className='h-3 w-3 text-green-500' />
              <span>0% from last month</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Orders</CardTitle>
            <ShoppingCart className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <Activity className='h-3 w-3' />
              <span>No orders yet</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Customers
            </CardTitle>
            <Users className='h-4 w-4 text-purple-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <TrendingUp className='h-3 w-3 text-green-500' />
              <span>0 new this week</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Page Views</CardTitle>
            <Eye className='h-4 w-4 text-orange-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
            <p className='text-xs text-muted-foreground flex items-center gap-1 mt-1'>
              <Activity className='h-3 w-3' />
              <span>Today</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <BarChart3 className='h-5 w-5' />
              Sales Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='h-64 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>
                Sales chart will appear here once you have orders
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <TrendingUp className='h-5 w-5' />
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='h-64 flex items-center justify-center border-2 border-dashed rounded-lg'>
              <p className='text-muted-foreground'>
                Top selling products will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-center py-8'>
            No activity recorded yet. Activity will appear here as customers
            interact with your store.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
