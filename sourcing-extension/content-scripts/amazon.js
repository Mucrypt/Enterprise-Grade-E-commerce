/**
 * TechTools Sourcing Importer -- Amazon product-detail page reader.
 *
 * Same honest caveat as alibaba.js: Amazon is well known to A/B-test its
 * DOM by marketplace/session, so selectors try several fallbacks per
 * field. Two real bugs fixed here after a live test (2026-08-20) on an
 * amazon.it listing: (1) extractSpecs() only checked two table IDs that
 * don't match Amazon's current "Product information" table markup, so it
 * captured zero specs; (2) extractDescriptionHtml() returned #aplus's
 * innerHTML unfiltered, which on a listing with an embedded A+ video
 * module leaks the video player's own UI chrome text ("Click to play
 * video", "Mute", "Current Time 0:00", caption-track menu items) into
 * the description -- now stripped before capture.
 */
;(function () {
  function firstMatch(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el) return el
    }
    return null
  }

  function findSectionByHeading(headingPattern) {
    const headings = document.querySelectorAll('h1, h2, h3, h4, [class*="title" i], [class*="heading" i]')
    for (const heading of headings) {
      if (headingPattern.test((heading.textContent || '').trim())) {
        return heading.closest('div')?.parentElement || heading.nextElementSibling || heading.parentElement
      }
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
        // Malformed JSON-LD -- ignore and fall through to DOM heuristics.
      }
    }
    return null
  }

  function extractTitle(jsonLd) {
    if (jsonLd && jsonLd.name) return String(jsonLd.name).trim()
    const el = firstMatch(['#productTitle', '[data-testid="product-title"]', 'h1'])
    return el ? el.textContent.trim() : ''
  }

  function extractPriceTiers(jsonLd) {
    const el = firstMatch(['.a-price .a-offscreen', '#corePrice_feature_div .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice'])
    if (el) {
      const text = el.textContent || ''
      const match = text.match(/([$€£¥])\s?([\d,]+\.?\d*)/)
      if (match) {
        const price = parseFloat(match[2].replace(/,/g, ''))
        if (Number.isFinite(price)) {
          const currency = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' }[match[1]] || 'USD'
          return [{ minQty: 1, maxQty: null, price, currency }]
        }
      }
    }

    if (jsonLd && jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
      const price = parseFloat(offer && offer.price)
      if (Number.isFinite(price)) {
        return [{ minQty: 1, maxQty: null, price, currency: (offer.priceCurrency || 'USD').toUpperCase() }]
      }
    }

    return []
  }

  function fullResFromThumbnail(src) {
    // Amazon encodes the thumbnail size as a "._SXnnn_" (or similar)
    // suffix before the file extension -- stripping it returns the
    // full-resolution original.
    return src.replace(/\._[A-Z0-9,]+_\.(jpg|png|jpeg|webp)/i, '.$1')
  }

  function extractImages(jsonLd) {
    const urls = new Set()
    document.querySelectorAll('#altImages img, #imageBlock img, [data-a-image-name] img').forEach((img) => {
      if (img.src) urls.add(fullResFromThumbnail(img.src))
    })
    if (urls.size === 0 && jsonLd && jsonLd.image) {
      const jsonLdImages = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
      jsonLdImages.forEach((url) => urls.add(url))
    }
    if (urls.size === 0) {
      const main = document.querySelector('#landingImage, #imgBlkFront')
      if (main && main.src) urls.add(main.src)
    }
    return Array.from(urls)
      .slice(0, 12)
      .map((url, i) => ({ url, position: i }))
  }

  /**
   * Removes video players and their UI chrome (controls, caption-track
   * menus, "Click to play video" hint text) from a cloned A+ content
   * node before it's captured -- these render as ordinary text nodes in
   * Amazon's markup even though a real shopper would never read them.
   */
  function stripVideoChrome(root) {
    root.querySelectorAll('video, script, style, noscript, button, [role="button"], .a-button, input, select, [class*="video" i], [class*="player" i], [id*="video" i], [id*="player" i]').forEach((node) => node.remove())
    return root
  }

  function extractDescriptionHtml(jsonLd) {
    const parts = []
    if (jsonLd && jsonLd.description) parts.push(`<p>${String(jsonLd.description).trim()}</p>`)

    const aplus = document.querySelector('#aplus, #aplus_feature_div, #dpx-aplus-product-description_feature_div')
    if (aplus) {
      const cleaned = stripVideoChrome(aplus.cloneNode(true))
      if (cleaned.textContent.trim().length > 0) parts.push(cleaned.innerHTML)
    }

    if (parts.length === 0) {
      const bullets = document.querySelectorAll('#feature-bullets li')
      if (bullets.length > 0) {
        const items = Array.from(bullets)
          .map((li) => `<li>${li.textContent.trim()}</li>`)
          .join('')
        parts.push(`<ul>${items}</ul>`)
      }
    }

    return parts.length > 0 ? parts.join('\n') : null
  }

  function extractSpecs() {
    const specs = {}

    // Amazon's current "Product information" detail-bullets table --
    // th/td rows, this is the layout that a live test (2026-08-20) found
    // missing from the previous, narrower selector list.
    document.querySelectorAll('#productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr').forEach((row) => {
      const th = row.querySelector('th')
      const td = row.querySelector('td')
      if (th && td) {
        const label = th.textContent.trim()
        const value = td.textContent.trim()
        if (label && value) specs[label.slice(0, 100)] = value.slice(0, 500)
      }
    })
    if (Object.keys(specs).length > 0) return specs

    // Older "detail bullets" list layout (label: value pairs in <li> text).
    document.querySelectorAll('#detailBullets_feature_div li').forEach((row) => {
      const text = (row.textContent || '').trim()
      const parts = text.split(/[:‏]/)
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        specs[parts[0].trim().slice(0, 100)] = parts.slice(1).join(':').trim().slice(0, 500)
      }
    })
    if (Object.keys(specs).length > 0) return specs

    // Last resort: any table inside a section whose own heading says
    // "Product information"/"Product Details"/"Technical Details" --
    // layout-agnostic fallback for whatever variant the current session
    // happens to be A/B-tested into.
    const section = findSectionByHeading(/product (information|details)|technical details|informazioni sul prodotto|dettagli tecnici/i)
    if (section) {
      section.querySelectorAll('tr').forEach((row) => {
        const cells = row.querySelectorAll('th, td')
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim()
          const value = cells[1].textContent.trim()
          if (label && value) specs[label.slice(0, 100)] = value.slice(0, 500)
        }
      })
    }
    return specs
  }

  function extractSourceProductId() {
    const match = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/)
    return match ? match[1] : null
  }

  function buildPayload() {
    const jsonLd = readJsonLdProduct()
    return {
      sourcePlatform: 'amazon',
      sourceUrl: window.location.href,
      sourceProductId: extractSourceProductId(),
      title: extractTitle(jsonLd),
      descriptionHtml: extractDescriptionHtml(jsonLd),
      images: extractImages(jsonLd),
      priceTiers: extractPriceTiers(jsonLd),
      variantOptions: [],
      specs: extractSpecs(),
      currency: 'USD',
    }
  }

  window.__techToolsSourcing.registerCapture(buildPayload)
})()
