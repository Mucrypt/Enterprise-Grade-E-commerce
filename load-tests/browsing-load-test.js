// ============================================================
// TechTools storefront browsing load test (k6)
// ============================================================
// Simulates realistic shopper *browsing* traffic -- homepage/featured,
// category listing, product listing + pagination/filters, product detail,
// search -- weighted to roughly match how real visitors actually split
// their time. Deliberately GET-only: it never touches cart, checkout, or
// auth, so it can be run safely against production without creating real
// orders/customers or sending real emails.
//
// The concurrency stages below mirror the capacity checkpoints from the
// infrastructure report (~300-500 / ~500-2,000 / ~2,000-8,000 concurrent
// shoppers) so this test either confirms those estimates or corrects them
// with a real number.
//
// USAGE
//   Install k6:      https://k6.io/docs/get-started/installation/
//   Run against prod: k6 run -e BASE_URL=https://techtoolstore.com/api/v1 browsing-load-test.js
//   Run locally:      k6 run browsing-load-test.js   (defaults to http://localhost:9000/api/v1)
//
// BEFORE running against production:
//   1. Run this from a DIFFERENT machine than the production server itself
//      (your laptop, a small separate VM) -- running it FROM the server
//      would have k6 compete with the API for the same CPU cores it's
//      trying to measure, contaminating the result.
//   2. Temporarily set DISABLE_RATE_LIMIT=true in the server's .env and
//      restart the api container. k6 simulates many concurrent virtual
//      users from ONE real source IP; the rate limiter would otherwise
//      throttle the test itself almost immediately (testing the rate
//      limiter, not the server). Revert this the moment the test ends --
//      never leave it disabled outside a planned test window.
//   3. Do this during low real traffic (the middle of the night, or before
//      you've announced anything) -- it generates genuine load.
//
// After the run, watch `docker stats` on the server in a second terminal
// to see actual CPU/memory pressure per container while it happens.

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:9000/api/v1'

// Separate error/latency tracking per endpoint type, so a failure surfaces
// exactly which part of the browsing path degrades first rather than one
// blended number.
const listingErrors = new Rate('listing_errors')
const detailErrors = new Rate('detail_errors')
const searchErrors = new Rate('search_errors')
const detailLatency = new Trend('product_detail_duration')

export const options = {
  scenarios: {
    browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 }, // warm up
        { duration: '2m', target: 300 }, // "comfortable" checkpoint
        { duration: '2m', target: 500 }, // upper edge of "comfortable"
        { duration: '2m', target: 2000 }, // "slowing down" checkpoint
        { duration: '2m', target: 5000 }, // "timeouts" checkpoint
        { duration: '1m', target: 0 }, // ramp down
      ],
    },
  },
  thresholds: {
    // These are the pass/fail lines, not just numbers to eyeball -- k6
    // exits non-zero if browsing genuinely degrades past this.
    http_req_duration: ['p(95)<1500'], // 95% of requests under 1.5s
    http_req_failed: ['rate<0.02'], // fewer than 2% hard failures
    listing_errors: ['rate<0.02'],
    detail_errors: ['rate<0.02'],
    search_errors: ['rate<0.05'],
  },
}

// Runs once before the load starts -- grabs real product/category
// data so virtual users browse actual pages instead of hammering
// fake IDs that 404 immediately (which would test error-handling
// speed, not real page-load performance).
export function setup() {
  const productsRes = http.get(`${BASE_URL}/products?limit=50`)
  const categoriesRes = http.get(`${BASE_URL}/categories`)

  let productIds = []
  let productSlugs = []
  let categoryIds = []

  try {
    const products = JSON.parse(productsRes.body).data?.products || []
    productIds = products.map((p) => p.id).filter(Boolean)
    productSlugs = products.map((p) => p.slug).filter(Boolean)
  } catch (e) {
    console.error('setup(): failed to parse /products response -- is the API reachable?', e)
  }

  try {
    const categories = JSON.parse(categoriesRes.body).data?.categories || []
    categoryIds = categories.map((c) => c.id).filter(Boolean)
  } catch (e) {
    console.error('setup(): failed to parse /categories response')
  }

  if (productIds.length === 0) {
    throw new Error(
      `setup() found no real products at ${BASE_URL}/products -- aborting rather than running a meaningless test against fake data. Check BASE_URL and that the API is reachable.`,
    )
  }

  console.log(`setup(): loaded ${productIds.length} real products, ${categoryIds.length} real categories`)
  return { productIds, productSlugs, categoryIds }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function (data) {
  const roll = Math.random()

  if (roll < 0.2) {
    group('homepage / featured products', () => {
      const res = http.get(`${BASE_URL}/products?featured=true&limit=8`)
      const ok = check(res, { 'featured products 200': (r) => r.status === 200 })
      listingErrors.add(!ok)
    })
  } else if (roll < 0.4) {
    group('category browsing', () => {
      if (data.categoryIds.length === 0) return
      const categoryId = pick(data.categoryIds)
      const res = http.get(`${BASE_URL}/categories/${categoryId}/products?limit=20`)
      const ok = check(res, { 'category products 200': (r) => r.status === 200 })
      listingErrors.add(!ok)
    })
  } else if (roll < 0.65) {
    group('product listing + pagination', () => {
      const page = Math.floor(Math.random() * 5) + 1
      const res = http.get(`${BASE_URL}/products?page=${page}&limit=20`)
      const ok = check(res, { 'product listing 200': (r) => r.status === 200 })
      listingErrors.add(!ok)
    })
  } else if (roll < 0.9) {
    group('product detail page', () => {
      const idOrSlug = pick(data.productSlugs.length > 0 ? data.productSlugs : data.productIds)
      const res = http.get(`${BASE_URL}/products/${idOrSlug}`)
      const ok = check(res, { 'product detail 200': (r) => r.status === 200 })
      detailErrors.add(!ok)
      detailLatency.add(res.timings.duration)

      // Real product pages also fetch related products right after --
      // mirrors ProductDetailPage.tsx's actual behavior.
      if (ok) {
        sleep(0.3)
        const productId = pick(data.productIds)
        http.get(`${BASE_URL}/products/${productId}/related?limit=8`)
      }
    })
  } else {
    group('search', () => {
      const terms = ['tool', 'drill', 'wireless', 'kit', 'set', 'pro']
      const res = http.get(`${BASE_URL}/products/search?q=${pick(terms)}&limit=10`)
      const ok = check(res, { 'search 200': (r) => r.status === 200 })
      searchErrors.add(!ok)
    })
  }

  // Real shoppers read a page before clicking the next thing -- without
  // this, k6 would fire requests back-to-back far faster than any real
  // human, which understates how many actual concurrent shoppers a given
  // VU count represents.
  sleep(Math.random() * 3 + 1)
}
