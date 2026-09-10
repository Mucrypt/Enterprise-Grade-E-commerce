/**
 * Homepage Settings Service
 * Real, admin-editable copy for the storefront homepage sections (hero,
 * workshop banner, business banner, newsletter) -- both web and mobile
 * read this instead of a hardcoded config file.
 */

import { apiClient } from '@/lib/api-client'

export interface HeroSection {
  eyebrow: string
  headline: string
  description: string
  primaryCtaLabel: string
  primaryCtaTo: string
  secondaryCtaLabel: string
  secondaryCtaTo: string
}

export interface BannerSection {
  eyebrow: string
  headline: string
  description: string
  primaryCtaLabel: string
  primaryCtaTo: string
  secondaryCtaLabel: string
  secondaryCtaTo: string
}

export interface CtaSection {
  heading: string
  description: string
  ctaLabel: string
  ctaTo: string
}

export interface NewsletterSection {
  heading: string
  description: string
  ctaLabel: string
}

export interface HomepageSettings {
  id: number
  hero: HeroSection
  workshop_banner: BannerSection
  business_banner: CtaSection
  newsletter: NewsletterSection
  updated_at: string
  updated_by: string | null
}

export async function getHomepageSettings(): Promise<HomepageSettings> {
  const response = await apiClient.get<{ data: HomepageSettings }>(
    '/settings/homepage/admin',
  )
  return response.data
}

export async function updateHomepageSettings(settings: {
  hero?: HeroSection
  workshopBanner?: BannerSection
  businessBanner?: CtaSection
  newsletter?: NewsletterSection
}): Promise<HomepageSettings> {
  const response = await apiClient.put<{ data: HomepageSettings }>(
    '/settings/homepage/admin',
    settings,
  )
  return response.data
}
