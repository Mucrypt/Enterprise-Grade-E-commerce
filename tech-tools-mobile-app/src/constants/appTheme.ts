// ============================================
// TechTools Mobile App - Extended Theme
// ============================================

export const AppColors = {
  // Primary colors
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  primaryLight: '#FF8A5B',

  // Secondary colors
  secondary: '#6366F1',
  secondaryDark: '#4F46E5',
  secondaryLight: '#818CF8',

  // Accent colors
  accent: '#10B981',
  accentDark: '#059669',
  accentLight: '#34D399',

  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  background: '#F8FAFC',
  surface: '#FFFFFF',

  // Gray scale
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Badge colors
  badgeHot: '#EF4444',
  badgeFlash: '#F59E0B',
  badgeDeal: '#8B5CF6',
  badgeNew: '#10B981',
  badgeSale: '#FF6B35',

  // Industrial / professional-tools tone (dark hero, workshop and
  // newsletter sections on the home screen) -- mirrors the web
  // storefront's slate/orange B2B palette.
  industrialDark: '#0F1420',
  slate900: '#0F172A',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  orangeAccent: '#FB923C',
}

// Gradients (as arrays for LinearGradient)
export const AppGradients = {
  primary: ['#FF6B35', '#FF8A5B'] as [string, string],
  secondary: ['#6366F1', '#8B5CF6'] as [string, string],
  accent: ['#10B981', '#34D399'] as [string, string],
  dark: ['#1F2937', '#374151'] as [string, string],
  flashDeal: ['#FF6B35', '#FF8A5B', '#FFA07A'] as [string, string, string],
  hero: ['#FF6B35', '#E55A2B'] as [string, string],

  // Dark industrial gradient used by the professional-tools home
  // sections (ToolsHero, WorkshopMachinerySection, HomepageNewsletter).
  industrial: ['#0F1420', '#1B2436'] as [string, string],
  workshop: ['#0F172A', '#1E293B'] as [string, string],
}

export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
}

export const AppBorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
}

export const AppShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
}

// Category icons mapping (for Ionicons)
export const CategoryIcons: Record<string, string> = {
  electronics: 'laptop-outline',
  phones: 'phone-portrait-outline',
  computers: 'desktop-outline',
  audio: 'headset-outline',
  gaming: 'game-controller-outline',
  cameras: 'camera-outline',
  accessories: 'watch-outline',
  networking: 'wifi-outline',
  storage: 'server-outline',
  software: 'code-slash-outline',
  default: 'cube-outline',
}

// Category colors
export const CategoryColors: Record<string, string> = {
  electronics: '#3B82F6',
  phones: '#8B5CF6',
  computers: '#10B981',
  audio: '#F59E0B',
  gaming: '#EF4444',
  cameras: '#EC4899',
  accessories: '#06B6D4',
  networking: '#6366F1',
  storage: '#14B8A6',
  software: '#6B7280',
  default: '#9CA3AF',
}

// Promo banners data
export const PromoBanners = [
  {
    id: '1',
    title: 'Free Shipping',
    subtitle: 'On orders over $50',
    icon: 'car-outline',
    gradient: ['#10B981', '#34D399'],
  },
  {
    id: '2',
    title: 'New Arrivals',
    subtitle: 'Shop the latest',
    icon: 'sparkles-outline',
    gradient: ['#8B5CF6', '#A78BFA'],
  },
  {
    id: '3',
    title: '2-Year Warranty',
    subtitle: 'Extended protection',
    icon: 'shield-checkmark-outline',
    gradient: ['#3B82F6', '#60A5FA'],
  },
  {
    id: '4',
    title: 'Bundle & Save',
    subtitle: 'Up to 30% off',
    icon: 'gift-outline',
    gradient: ['#EC4899', '#F472B6'],
  },
]
