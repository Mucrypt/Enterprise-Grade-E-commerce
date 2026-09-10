// ============================================
// Resolve Mobile Route
//
// Homepage CTA links (hero/workshop-banner/business-banner "to" fields)
// are stored once in a single shared homepage_settings table and
// consumed by both the web storefront and this app. Almost every real
// route matches between the two (e.g. /products, /sale, /contact), but
// a small number of screens are named differently on mobile (expo-router
// file-based routes) than on web (react-router paths) -- this maps the
// known real divergences so an admin editing a CTA link once in the
// dashboard still navigates correctly on both platforms. Anything not
// listed here passes through unchanged.
// ============================================

const WEB_TO_MOBILE_ROUTE: Record<string, string> = {
  '/contact': '/contact-us',
}

export function resolveMobileRoute(path: string): string {
  return WEB_TO_MOBILE_ROUTE[path] ?? path
}
