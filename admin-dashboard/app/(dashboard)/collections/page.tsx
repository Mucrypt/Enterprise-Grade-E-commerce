'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Layers, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CollectionsPage() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Collections</h1>
          <p className='text-muted-foreground'>
            Manage product collections for your store
          </p>
        </div>
        <Button>
          <Plus className='h-4 w-4 mr-2' />
          Add Collection
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Layers className='h-5 w-5' />
            Collections Management
          </CardTitle>
          <CardDescription>
            This page is under development. Collection management features
            coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>
            You can currently manage collections through the API at{' '}
            <code>/api/v1/collections/products</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
