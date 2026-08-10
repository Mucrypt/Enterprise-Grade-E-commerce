'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import promotionService, { CampaignDetail, CreativeAsset } from '@/services/promotion.service'
import { apiClient } from '@/lib/api-client'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { X, Upload } from 'lucide-react'

interface StepProps {
  campaign: CampaignDetail
  isEditable: boolean
  onSaved: () => void
}

/**
 * Creative upload reuses the existing product-image upload pattern
 * (raw <input type="file"> + apiClient.postFormData()) -- no shared
 * <Uploader> component exists in this codebase to reuse (confirmed
 * during this build's own audit of /dashboard/media, which is a
 * placeholder). Images only this phase: no ffmpeg/video-processing
 * infrastructure exists in tech-tools-api to safely support video
 * derivatives, so video upload is a named next-phase item, not attempted
 * here.
 */
export function MessageCreativeStep({ campaign, isEditable, onSaved }: StepProps) {
  const [masterMessage, setMasterMessage] = useState(campaign.masterMessage)
  const [landingUrl, setLandingUrl] = useState(campaign.landingUrl || '')
  const [creativeAssets, setCreativeAssets] = useState<CreativeAsset[]>(campaign.creativeAssets)
  const [uploading, setUploading] = useState(false)

  const mutation = useMutation({
    mutationFn: () => promotionService.updateCampaign(campaign.id, { masterMessage, landingUrl: landingUrl || null, creativeAssets }),
    onSuccess: () => {
      toast.success('Message and creative saved.')
      onSaved()
    },
    onError: () => toast.error('Failed to save -- please try again.'),
  })

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('campaignId', campaign.id)
      const result = await apiClient.postFormData<{ success: true; asset: CreativeAsset }>('/promotions/campaigns/creative-upload', formData)
      setCreativeAssets((prev) => [...prev, result.asset])
    } catch {
      toast.error('Upload failed -- please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Master message</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Textarea
            rows={5}
            value={masterMessage}
            onChange={(e) => setMasterMessage(e.target.value)}
            placeholder='The base copy every channel starts from -- customize per-channel in the next step.'
            disabled={!isEditable}
          />
          <div>
            <Label htmlFor='landing-url'>Landing URL</Label>
            <Input
              id='landing-url'
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              placeholder='https://techtoolstore.com/p/cordless-drill'
              disabled={!isEditable}
            />
            <p className='mt-1 text-xs text-muted-foreground'>
              Every channel gets this link automatically tagged with its own UTM parameters when you schedule or publish.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Creative</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-wrap gap-3'>
            {creativeAssets.map((asset) => (
              <div key={asset.key} className='relative h-24 w-24 overflow-hidden rounded-md border'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt='' className='h-full w-full object-cover' />
                {isEditable && (
                  <button
                    className='absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white'
                    onClick={() => setCreativeAssets((prev) => prev.filter((a) => a.key !== asset.key))}
                  >
                    <X className='h-3 w-3' />
                  </button>
                )}
              </div>
            ))}
            {isEditable && (
              <label className='flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:bg-muted/50'>
                <Upload className='h-5 w-5' />
                <span className='text-xs'>{uploading ? 'Uploading...' : 'Add image'}</span>
                <input
                  type='file'
                  accept='image/png,image/jpeg,image/webp'
                  className='hidden'
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUpload(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>Images only this phase -- video/Reels creative is a planned next step.</p>
        </CardContent>
      </Card>

      {isEditable && (
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      )}
    </div>
  )
}
