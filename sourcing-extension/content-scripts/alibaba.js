/**
 * TechTools Sourcing Importer -- Alibaba product-detail page reader.
 *
 * IMPORTANT, HONEST CAVEAT: written without a live browser session to
 * test against. Strategy, in order of preference:
 *   1. schema.org JSON-LD structured data (<script type="application/
 *      ld+json">) if the page includes it -- this is meant for search
 *      engines, so it's far more stable than any CSS class name and is
 *      tried first for title/description/images/price.
 *   2. Layout-agnostic DOM heuristics (heading-text matching, image-size
 *      filtering) rather than guessing specific class names, since a
 *      first real test (2026-08-18) showed Alibaba's actual markup
 *      doesn't match several of the narrower selectors this file
 *      originally guessed -- the "Key attributes" table and most gallery
 *      images were missed on a real product page.
 * If the button ever reports "could not read a title/price," that's
 * this file needing an update, not a bug elsewhere in the system.
 */
;(function () {
  function firstMatch(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el) return el
    }
    return null
  }

  function readJsonLdProduct() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent)
        const candidates = Array.isArray(data) ? data : data['@graph'] || [data]
        const product = candidates.find((item) => item && (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product'))))
        if (product) return product
      } catch (error) {
        // Malformed JSON-LD on the page -- ignore and fall through to DOM heuristics.
      }
    }
    return null
  }

  function extractTitle(jsonLd) {
    if (jsonLd && jsonLd.name) return String(jsonLd.name).trim()
    const el = firstMatch(['h1', '[class*="title"] h1', '[class*="product-title"]', '[data-testid*="title"]'])
    return el ? el.textContent.trim() : ''
  }

  function extractSupplierName(jsonLd) {
    if (jsonLd && jsonLd.brand && jsonLd.brand.name) return String(jsonLd.brand.name).trim()
    if (jsonLd && jsonLd.seller && jsonLd.seller.name) return String(jsonLd.seller.name).trim()

    // Alibaba's own SEO boilerplate reliably includes this exact phrase
    // in the page body text (confirmed on a live capture) -- more stable
    // than guessing a company-info panel's class name.
    const bodyText = document.body.innerText || ''
    const boilerplateMatch = bodyText.match(/from\s+([A-Z][A-Za-z0-9.,&'\s-]{2,80}?)\.?\s+Supplier or Manufacturer on Alibaba\.com/)
    if (boilerplateMatch) return boilerplateMatch[1].trim()

    const el = firstMatch(['[class*="company-name" i]', '[class*="supplier-name" i]', 'a[href*="/company/"]'])
    return el ? el.textContent.trim() : null
  }

  function isLikelyProductImage(url) {
    if (!url || url.startsWith('data:')) return false
    // Filter out obvious non-product assets (site chrome, ads, tiny icons)
    // without depending on a specific gallery container class.
    const lower = url.toLowerCase()
    if (/logo|icon|sprite|avatar|banner-ad|placeholder/.test(lower)) return false
    return true
  }

  function extractImages(jsonLd) {
    const urls = new Set()

    if (jsonLd && jsonLd.image) {
      const jsonLdImages = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
      jsonLdImages.forEach((url) => {
        if (isLikelyProductImage(url)) urls.add(url)
      })
    }

    // DOM fallback/supplement: scan every <img> on the page whose element
    // (or an ancestor within 4 levels) has a class/id suggesting it's part
    // of a gallery/thumbnail/image-viewer area, preferring data-src (the
    // full-res URL on hover-swap thumbnails) over the visible low-res src.
    // Deliberately broad (not one specific class name) since narrower
    // guesses (thumb/gallery/image-list only) missed most of the real
    // gallery on a first live test.
    document.querySelectorAll('img').forEach((img) => {
      const relevant = img.closest('[class*="gallery" i], [class*="thumb" i], [class*="image-view" i], [class*="media" i], [class*="slider" i]')
      if (!relevant) return
      const full = img.getAttribute('data-src') || img.getAttribute('data-original') || img.currentSrc || img.src
      if (isLikelyProductImage(full)) urls.add(full)
    })

    // Last-resort fallback: the single largest visible image near the top
    // of the page (likely the main product photo), if nothing else matched.
    if (urls.size === 0) {
      const images = Array.from(document.querySelectorAll('img')).filter((img) => img.naturalWidth > 200 && img.naturalHeight > 200)
      images.sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)
      if (images[0]) urls.add(images[0].currentSrc || images[0].src)
    }

    return Array.from(urls)
      .slice(0, 20)
      .map((url, i) => ({ url, position: i }))
  }

  function findSectionByHeading(headingPattern) {
    const headings = document.querySelectorAll('h1, h2, h3, h4, strong, [class*="title" i], [class*="heading" i]')
    for (const heading of headings) {
      if (headingPattern.test((heading.textContent || '').trim())) {
        // The section's real content is usually the heading's next
        // sibling, or its parent container if the heading is nested
        // inside its own wrapper.
        return heading.nextElementSibling || heading.parentElement
      }
    }
    return null
  }

  /**
   * Strips anything that would try to load an external resource once
   * this captured HTML is later rendered elsewhere (TechTools' own admin
   * dashboard, and eventually the storefront) -- a live test on Amazon's
   * equivalent A+ content (2026-08-21) found <link rel="stylesheet">
   * tags pointing at the source site's own CDN, captured as literal
   * markup and then blocked by CSP with console errors downstream.
   * TechTools' render paths also sanitize with DOMPurify as a second
   * layer, since this list can never be exhaustive against a third-party
   * page's markup.
   */
  function stripExternalResourceTags(root) {
    root.querySelectorAll('script, style, link, meta, base, iframe, object, embed, video').forEach((node) => node.remove())
    return root
  }

  function extractDescriptionHtml(jsonLd) {
    const parts = []

    if (jsonLd && jsonLd.description) {
      parts.push(`<p>${String(jsonLd.description).trim()}</p>`)
    }

    const detailSection = firstMatch(['[class*="detailDesc" i]', '[class*="product-description" i]', '[id*="description" i]', '[class*="detail-desc" i]'])
    if (detailSection) parts.push(stripExternalResourceTags(detailSection.cloneNode(true)).innerHTML)

    // "Product descriptions from the supplier" is a real, distinctly
    // labeled section on Alibaba product pages (confirmed on a live test)
    // containing supplier-authored marketing content/images, separate
    // from the shorter structured description above -- captured too so
    // nothing the supplier actually wrote is silently dropped.
    const supplierSection = findSectionByHeading(/product descriptions? from the supplier/i)
    if (supplierSection) parts.push(stripExternalResourceTags(supplierSection.cloneNode(true)).innerHTML)

    return parts.length > 0 ? parts.join('\n') : null
  }

  function extractPriceTiers(jsonLd) {
    const priceRegex = /([$€£¥])\s?([\d,]+\.?\d*)/
    const qtyRegex = /(\d+)\s*[-–]\s*(\d+|\+)?\s*(pieces?|pcs?|units?)/i

    const tiers = []
    const candidates = document.querySelectorAll('[class*="price" i]')
    candidates.forEach((el) => {
      const text = el.textContent || ''
      const priceMatch = text.match(priceRegex)
      if (!priceMatch) return

      const price = parseFloat(priceMatch[2].replace(/,/g, ''))
      if (!Number.isFinite(price)) return

      const currency = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'CNY' }[priceMatch[1]] || 'USD'

      const context = (el.closest('li, tr, div') || el).textContent || ''
      const qtyMatch = context.match(qtyRegex)
      const minQty = qtyMatch ? parseInt(qtyMatch[1], 10) : tiers.length === 0 ? 1 : null
      const maxQty = qtyMatch && qtyMatch[2] && qtyMatch[2] !== '+' ? parseInt(qtyMatch[2], 10) : null

      if (minQty !== null) {
        tiers.push({ minQty, maxQty, price, currency })
      }
    })

    const seen = new Set()
    const deduped = tiers.filter((t) => {
      if (seen.has(t.minQty)) return false
      seen.add(t.minQty)
      return true
    })
    deduped.sort((a, b) => a.minQty - b.minQty)

    if (deduped.length > 0) return deduped

    // JSON-LD fallback: a single offers.price, if the DOM pattern-match
    // above found nothing (e.g. a page with only one flat price, no MOQ tiers).
    if (jsonLd && jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
      const price = parseFloat(offer && offer.price)
      if (Number.isFinite(price)) {
        return [{ minQty: 1, maxQty: null, price, currency: (offer.priceCurrency || 'USD').toUpperCase() }]
      }
    }

    return []
  }

  function extractSpecsFromLeafPairs(container) {
    // "Key attributes"-style grids are commonly rendered as a flat list
    // of alternating label/value leaf elements (a CSS grid, not a
    // semantic <table>/<dl>) -- confirmed on a live test where the
    // original <li>-based selector matched nothing. Walk every leaf
    // (childless) element with short text in document order and pair
    // them up: odd position = label, even = value.
    const leaves = Array.from(container.querySelectorAll('*')).filter((el) => el.children.length === 0 && el.textContent.trim().length > 0 && el.textContent.trim().length < 200)

    const specs = {}
    for (let i = 0; i + 1 < leaves.length; i += 2) {
      const label = leaves[i].textContent.trim()
      const value = leaves[i + 1].textContent.trim()
      if (label && value && label !== value) {
        specs[label.slice(0, 100)] = value.slice(0, 500)
      }
    }
    return specs
  }

  function extractSpecs() {
    // Preferred: a real <table> or <dl> of specs, if the page has one.
    const table = firstMatch(['[class*="attribute" i] table', '[class*="spec" i] table', 'table[class*="attribute" i]'])
    if (table) {
      const specs = {}
      table.querySelectorAll('tr').forEach((row) => {
        const cells = row.querySelectorAll('td, th')
        for (let i = 0; i + 1 < cells.length; i += 2) {
          const label = cells[i].textContent.trim()
          const value = cells[i + 1].textContent.trim()
          if (label && value) specs[label.slice(0, 100)] = value.slice(0, 500)
        }
      })
      if (Object.keys(specs).length > 0) return specs
    }

    // "Key attributes" is the real, confirmed section heading for
    // Alibaba's grade/model-number/material/etc. table.
    const keyAttributesSection = findSectionByHeading(/key attributes/i)
    if (keyAttributesSection) {
      const specs = extractSpecsFromLeafPairs(keyAttributesSection)
      if (Object.keys(specs).length > 0) return specs
    }

    // Original li-based fallback, kept in case a different Alibaba
    // template renders attributes as a list instead of a grid.
    const specs = {}
    document.querySelectorAll('[class*="attribute" i] li, [class*="spec" i] li, [class*="property" i] li').forEach((li) => {
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
    const jsonLd = readJsonLdProduct()
    return {
      sourcePlatform: 'alibaba',
      sourceUrl: window.location.href,
      sourceProductId: extractSourceProductId(),
      title: extractTitle(jsonLd),
      descriptionHtml: extractDescriptionHtml(jsonLd),
      images: extractImages(jsonLd),
      priceTiers: extractPriceTiers(jsonLd),
      variantOptions: [],
      specs: extractSpecs(),
      currency: 'USD',
      supplierName: extractSupplierName(jsonLd),
    }
  }

  window.__techToolsSourcing.registerCapture(buildPayload)
})()
