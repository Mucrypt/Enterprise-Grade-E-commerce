/**
 * TechTools Sourcing Importer -- Amazon product-detail page reader.
 *
 * Same honest caveat as alibaba.js: written without a live browser
 * session to test against. Amazon is well known to A/B-test its DOM by
 * marketplace/session, so the selectors below try several fallbacks per
 * field and never invent data -- if nothing matches, the shared
 * inject-button.js reports "could not read" rather than sending garbage.
 * Adjust the selectors here if the real page structure differs.
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
    const el = firstMatch(['#productTitle', '[data-testid="product-title"]', 'h1'])
    return el ? el.textContent.trim() : ''
  }

  function extractPriceTiers() {
    const el = firstMatch(['.a-price .a-offscreen', '#corePrice_feature_div .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice'])
    if (!el) return []

    const text = el.textContent || ''
    const match = text.match(/([$€£¥])\s?([\d,]+\.?\d*)/)
    if (!match) return []

    const price = parseFloat(match[2].replace(/,/g, ''))
    if (!Number.isFinite(price)) return []

    const currency = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' }[match[1]] || 'USD'
    return [{ minQty: 1, maxQty: null, price, currency }]
  }

  function fullResFromThumbnail(src) {
    // Amazon encodes the thumbnail size as a "._SXnnn_" (or similar)
    // suffix before the file extension -- stripping it returns the
    // full-resolution original.
    return src.replace(/\._[A-Z0-9,]+_\.(jpg|png|jpeg|webp)/i, '.$1')
  }

  function extractImages() {
    const urls = new Set()
    document.querySelectorAll('#altImages img, #imageBlock img, [data-a-image-name] img').forEach((img) => {
      if (img.src) urls.add(fullResFromThumbnail(img.src))
    })
    if (urls.size === 0) {
      const main = document.querySelector('#landingImage, #imgBlkFront')
      if (main && main.src) urls.add(main.src)
    }
    return Array.from(urls)
      .slice(0, 12)
      .map((url, i) => ({ url, position: i }))
  }

  function extractDescriptionHtml() {
    const aplus = document.querySelector('#aplus')
    if (aplus) return aplus.innerHTML

    const bullets = document.querySelectorAll('#feature-bullets li')
    if (bullets.length > 0) {
      const items = Array.from(bullets)
        .map((li) => `<li>${li.textContent.trim()}</li>`)
        .join('')
      return `<ul>${items}</ul>`
    }
    return null
  }

  function extractSpecs() {
    const specs = {}
    document.querySelectorAll('#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li').forEach((row) => {
      const text = (row.textContent || '').trim()
      const parts = text.split(/[:‏]/)
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        specs[parts[0].trim().slice(0, 100)] = parts.slice(1).join(':').trim().slice(0, 500)
      }
    })
    return specs
  }

  function extractSourceProductId() {
    const match = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/)
    return match ? match[1] : null
  }

  function buildPayload() {
    return {
      sourcePlatform: 'amazon',
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
