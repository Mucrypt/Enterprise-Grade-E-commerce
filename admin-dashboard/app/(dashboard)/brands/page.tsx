'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tag, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BrandsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">
            Manage product brands for your store
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Brand
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Brands Management
          </CardTitle>
          <CardDescription>
            This page is under development. Brand management features coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You can currently manage brands through the API at <code>/api/v1/brands</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
