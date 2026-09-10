'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Save, Sparkles, Factory, Building2, Mail } from 'lucide-react'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import {
  getHomepageSettings,
  updateHomepageSettings,
  type HeroSection,
  type BannerSection,
  type CtaSection,
  type NewsletterSection,
} from '@/services/homepage-settings.service'

export default function HomepageSettingsPage() {
  return (
    <RequirePagePermission permission='settings.view'>
      <HomepageSettingsContent />
    </RequirePagePermission>
  )
}

function HomepageSettingsContent() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['homepage-settings'],
    queryFn: getHomepageSettings,
  })

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/dashboard/settings'>
            <ArrowLeft className='h-4 w-4' />
          </Link>
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Homepage Content</h1>
          <p className='text-sm text-muted-foreground'>
            Edit the real headline, description and button copy shown on the
            web and mobile app homepages -- changes go live immediately, no
            deploy needed.
          </p>
        </div>
      </div>

      {isLoading || !settings ? (
        <div className='grid gap-6 lg:grid-cols-2'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-80 w-full' />
          ))}
        </div>
      ) : (
        <div className='grid gap-6 lg:grid-cols-2'>
          <HeroCard initial={settings.hero} />
          <BannerCard
            title='Workshop Equipment Banner'
            icon={<Factory className='h-5 w-5 text-orange-500' />}
            description='The compact promo banner between the featured products and the business-buyer section.'
            initial={settings.workshop_banner}
          />
          <CtaCard initial={settings.business_banner} />
          <NewsletterCard initial={settings.newsletter} />
        </div>
      )}
    </div>
  )
}

function useSectionForm<T extends object>(initial: T) {
  const [values, setValues] = useState<T>(initial)
  useEffect(() => {
    setValues(initial)
  }, [initial])
  const set =
    (key: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [key]: e.target.value }))
  return { values, set }
}

function HeroCard({ initial }: { initial: HeroSection }) {
  const queryClient = useQueryClient()
  const { values, set } = useSectionForm<HeroSection>(initial)

  const mutation = useMutation({
    mutationFn: () => updateHomepageSettings({ hero: values }),
    onSuccess: () => {
      toast.success('Hero section updated')
      queryClient.invalidateQueries({ queryKey: ['homepage-settings'] })
    },
    onError: () => toast.error('Failed to update hero section'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Sparkles className='h-5 w-5 text-orange-500' />
          Hero Section
        </CardTitle>
        <CardDescription>
          The first thing visitors see -- headline, description and both
          call-to-action buttons.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label>Eyebrow</Label>
          <Input value={values.eyebrow} onChange={set('eyebrow')} />
        </div>
        <div className='space-y-2'>
          <Label>Headline</Label>
          <Input value={values.headline} onChange={set('headline')} />
        </div>
        <div className='space-y-2'>
          <Label>Description</Label>
          <Textarea rows={3} value={values.description} onChange={set('description')} />
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-2'>
            <Label>Primary button label</Label>
            <Input value={values.primaryCtaLabel} onChange={set('primaryCtaLabel')} />
          </div>
          <div className='space-y-2'>
            <Label>Primary button link</Label>
            <Input value={values.primaryCtaTo} onChange={set('primaryCtaTo')} />
          </div>
          <div className='space-y-2'>
            <Label>Secondary button label</Label>
            <Input value={values.secondaryCtaLabel} onChange={set('secondaryCtaLabel')} />
          </div>
          <div className='space-y-2'>
            <Label>Secondary button link</Label>
            <Input value={values.secondaryCtaTo} onChange={set('secondaryCtaTo')} />
          </div>
        </div>
      </CardContent>
      <CardFooter className='justify-end'>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className='mr-2 h-4 w-4' />
          {mutation.isPending ? 'Saving…' : 'Save Hero Section'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function BannerCard({
  title,
  icon,
  description,
  initial,
}: {
  title: string
  icon: React.ReactNode
  description: string
  initial: BannerSection
}) {
  const queryClient = useQueryClient()
  const { values, set } = useSectionForm<BannerSection>(initial)

  const mutation = useMutation({
    mutationFn: () => updateHomepageSettings({ workshopBanner: values }),
    onSuccess: () => {
      toast.success(`${title} updated`)
      queryClient.invalidateQueries({ queryKey: ['homepage-settings'] })
    },
    onError: () => toast.error(`Failed to update ${title.toLowerCase()}`),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label>Eyebrow</Label>
          <Input value={values.eyebrow} onChange={set('eyebrow')} />
        </div>
        <div className='space-y-2'>
          <Label>Headline</Label>
          <Input value={values.headline} onChange={set('headline')} />
        </div>
        <div className='space-y-2'>
          <Label>Description</Label>
          <Textarea rows={3} value={values.description} onChange={set('description')} />
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-2'>
            <Label>Primary button label</Label>
            <Input value={values.primaryCtaLabel} onChange={set('primaryCtaLabel')} />
          </div>
          <div className='space-y-2'>
            <Label>Primary button link</Label>
            <Input value={values.primaryCtaTo} onChange={set('primaryCtaTo')} />
          </div>
          <div className='space-y-2'>
            <Label>Secondary button label</Label>
            <Input value={values.secondaryCtaLabel} onChange={set('secondaryCtaLabel')} />
          </div>
          <div className='space-y-2'>
            <Label>Secondary button link</Label>
            <Input value={values.secondaryCtaTo} onChange={set('secondaryCtaTo')} />
          </div>
        </div>
      </CardContent>
      <CardFooter className='justify-end'>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className='mr-2 h-4 w-4' />
          {mutation.isPending ? 'Saving…' : `Save ${title}`}
        </Button>
      </CardFooter>
    </Card>
  )
}

function CtaCard({ initial }: { initial: CtaSection }) {
  const queryClient = useQueryClient()
  const { values, set } = useSectionForm<CtaSection>(initial)

  const mutation = useMutation({
    mutationFn: () => updateHomepageSettings({ businessBanner: values }),
    onSuccess: () => {
      toast.success('Business buyer section updated')
      queryClient.invalidateQueries({ queryKey: ['homepage-settings'] })
    },
    onError: () => toast.error('Failed to update business buyer section'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Building2 className='h-5 w-5 text-orange-500' />
          Business Buyer Banner
        </CardTitle>
        <CardDescription>
          The B2B/bulk-order callout banner (heading, description, one button).
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label>Heading</Label>
          <Input value={values.heading} onChange={set('heading')} />
        </div>
        <div className='space-y-2'>
          <Label>Description</Label>
          <Textarea rows={3} value={values.description} onChange={set('description')} />
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-2'>
            <Label>Button label</Label>
            <Input value={values.ctaLabel} onChange={set('ctaLabel')} />
          </div>
          <div className='space-y-2'>
            <Label>Button link</Label>
            <Input value={values.ctaTo} onChange={set('ctaTo')} />
          </div>
        </div>
      </CardContent>
      <CardFooter className='justify-end'>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className='mr-2 h-4 w-4' />
          {mutation.isPending ? 'Saving…' : 'Save Business Buyer Banner'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function NewsletterCard({ initial }: { initial: NewsletterSection }) {
  const queryClient = useQueryClient()
  const { values, set } = useSectionForm<NewsletterSection>(initial)

  const mutation = useMutation({
    mutationFn: () => updateHomepageSettings({ newsletter: values }),
    onSuccess: () => {
      toast.success('Newsletter section updated')
      queryClient.invalidateQueries({ queryKey: ['homepage-settings'] })
    },
    onError: () => toast.error('Failed to update newsletter section'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Mail className='h-5 w-5 text-orange-500' />
          Newsletter Section
        </CardTitle>
        <CardDescription>
          The signup block shown on every page, just above the footer.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label>Heading</Label>
          <Input value={values.heading} onChange={set('heading')} />
        </div>
        <div className='space-y-2'>
          <Label>Description</Label>
          <Textarea rows={3} value={values.description} onChange={set('description')} />
        </div>
        <div className='space-y-2'>
          <Label>Button label</Label>
          <Input value={values.ctaLabel} onChange={set('ctaLabel')} />
        </div>
      </CardContent>
      <CardFooter className='justify-end'>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className='mr-2 h-4 w-4' />
          {mutation.isPending ? 'Saving…' : 'Save Newsletter Section'}
        </Button>
      </CardFooter>
    </Card>
  )
}
