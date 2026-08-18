/**
 * TechTools Sourcing Importer -- Alibaba product-detail page reader.
 *
 * IMPORTANT, HONEST CAVEAT: this was written without access to a live
 * browser session to test against the real, current Alibaba DOM (this
 * extension was built in an environment with no browser automation
 * available). The selectors below are deliberately layered and
 * defensive (multiple fallback strategies per field, generic
 * price/quantity pattern-matching rather than one brittle class name) so
 * a DOM change degrades gracefully instead of silently sending garbage --
 * but Alibaba, like most large e-commerce sites, may change its markup
 * over time. If the "Import to TechTools" button ever reports "could not
 * read a title/price from this page," that's this file needing an
 * update, not a bug elsewhere in the system. Test against a real product
 * page after installing and adjust the selectors in extractX() below if
 * needed -- everything is isolated to this one file.
 */
;(function () {
  function firstMatch(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el) return el
    }
    return null
  }

  function extractTitle() {
    const el = firstMatch(['h1', '[class*="title"] h1', '[class*="product-title"]', '[data-testid*="title"]'])
    return el ? el.textContent.trim() : ''
  }

  function extractImages() {
    const urls = new Set()

    // Gallery thumbnails often only carry the full-res URL as a data-src
    // (the visible <img src> is a low-res thumbnail) -- prefer data-src.
    document.querySelectorAll('[class*="thumb"] img, [class*="gallery"] img, [class*="image-list"] img').forEach((img) => {
      const full = img.getAttribute('data-src') || img.getAttribute('data-original') || img.src
      if (full && !full.startsWith('data:')) urls.add(full)
    })

    // Fallback: the single large main-image element, if thumbnails weren't found.
    if (urls.size === 0) {
      const main = firstMatch(['[class*="main-image"] img', '[class*="image-viewer"] img'])
      if (main && main.src) urls.add(main.src)
    }

    return Array.from(urls)
      .slice(0, 12)
      .map((url, i) => ({ url, position: i }))
  }

  function extractDescriptionHtml() {
    const el = firstMatch(['[class*="detailDesc"]', '[class*="product-description"]', '[id*="description"]', '[class*="detail-desc"]'])
    return el ? el.innerHTML : null
  }

  function extractPriceTiers() {
    // Generic pattern-match: find every element whose text looks like a
    // currency amount, then look for a quantity range in a nearby
    // sibling/ancestor. Deliberately not tied to one specific class name,
    // since Alibaba's own markup for the MOQ price-tier table varies by
    // template.
    const priceRegex = /([$€£¥])\s?([\d,]+\.?\d*)/
    const qtyRegex = /(\d+)\s*[-–]\s*(\d+|\+)?\s*(pieces?|pcs?|units?)/i

    const tiers = []
    const candidates = document.querySelectorAll('[class*="price"]')
    candidates.forEach((el) => {
      const text = el.textContent || ''
      const priceMatch = text.match(priceRegex)
      if (!priceMatch) return

      const price = parseFloat(priceMatch[2].replace(/,/g, ''))
      if (!Number.isFinite(price)) return

      const currency = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'CNY' }[priceMatch[1]] || 'USD'

      // Look for a quantity range in this element or its parent's text.
      const context = (el.closest('li, tr, div') || el).textContent || ''
      const qtyMatch = context.match(qtyRegex)
      const minQty = qtyMatch ? parseInt(qtyMatch[1], 10) : tiers.length === 0 ? 1 : null
      const maxQty = qtyMatch && qtyMatch[2] && qtyMatch[2] !== '+' ? parseInt(qtyMatch[2], 10) : null

      if (minQty !== null) {
        tiers.push({ minQty, maxQty, price, currency })
      }
    })

    // Dedupe by minQty, keep the first occurrence, sort ascending.
    const seen = new Set()
    const deduped = tiers.filter((t) => {
      if (seen.has(t.minQty)) return false
      seen.add(t.minQty)
      return true
    })
    deduped.sort((a, b) => a.minQty - b.minQty)

    return deduped
  }

  function extractSpecs() {
    const specs = {}
    // Common "attribute list" pattern: a container of key/value pairs,
    // each a small block with two text nodes (label, value).
    document.querySelectorAll('[class*="attribute"] li, [class*="spec"] li, [class*="property"] li').forEach((li) => {
      const text = (li.textContent || '').trim()
      const parts = text.split(':')
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        specs[parts[0].trim().slice(0, 100)] = parts[1].trim().slice(0, 500)
      }
    })
    return specs
  }

  function extractSourceProductId() {
    const match = window.location.pathname.match(/(\d{8,})\.html/)
    return match ? match[1] : null
  }

  function buildPayload() {
    return {
      sourcePlatform: 'alibaba',
      sourceUrl: window.location.href,
      sourceProductId: extractSourceProductId(),
      title: extractTitle(),
      descriptionHtml: extractDescriptionHtml(),
      images: extractImages(),
      priceTiers: extractPriceTiers(),
      variantOptions: [],
      specs: extractSpecs(),
      currency: 'USD',
    }
  }

  window.__techToolsSourcing.registerCapture(buildPayload)
})()
