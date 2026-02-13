'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Image, Upload, Folder, FileImage, HardDrive } from 'lucide-react'

export default function MediaPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Media Library</h1>
        <p className='text-muted-foreground'>Manage your images and files</p>
      </div>

      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Files</CardTitle>
            <FileImage className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Images</CardTitle>
            <Image className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Folders</CardTitle>
            <Folder className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Storage Used</CardTitle>
            <HardDrive className='h-4 w-4 text-purple-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>0 MB</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border-2 border-dashed rounded-lg p-12 text-center'>
            <Upload className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
            <p className='text-lg font-medium mb-2'>Drag and drop files here</p>
            <p className='text-muted-foreground mb-4'>or click to browse</p>
            <button className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'>
              Select Files
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media Files</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-center py-8'>
            No files uploaded yet. Upload images to use in your products and
            store.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
