/**
 * TechTools Sourcing Importer -- shared button/toast injection, loaded on
 * every matched page before the platform-specific script (alibaba.js /
 * amazon.js), which calls window.__techToolsSourcing.registerCapture()
 * with its own DOM-reading function.
 */
;(function () {
  const STYLE_ID = 'techtools-sourcing-styles'
  const BUTTON_ID = 'techtools-sourcing-import-button'
  const TOAST_ID = 'techtools-sourcing-toast'

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed; top: 16px; right: 16px; z-index: 2147483647;
        background: #111827; color: #fff; border: none; border-radius: 8px;
        padding: 10px 16px; font: 600 14px/1.2 system-ui, sans-serif;
        cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      }
      #${BUTTON_ID}:hover { background: #1f2937; }
      #${BUTTON_ID}[disabled] { opacity: 0.6; cursor: default; }
      #${TOAST_ID} {
        position: fixed; top: 64px; right: 16px; z-index: 2147483647;
        background: #fff; color: #111827; border-radius: 8px; padding: 12px 16px;
        font: 500 13px/1.4 system-ui, sans-serif; max-width: 320px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25); border-left: 4px solid #111827;
      }
      #${TOAST_ID}.error { border-left-color: #dc2626; }
      #${TOAST_ID}.success { border-left-color: #16a34a; }
    `
    document.head.appendChild(style)
  }

  function showToast(message, kind) {
    let toast = document.getElementById(TOAST_ID)
    if (!toast) {
      toast = document.createElement('div')
      toast.id = TOAST_ID
      document.body.appendChild(toast)
    }
    toast.className = kind || ''
    toast.textContent = message
    toast.style.display = 'block'
    clearTimeout(toast._hideTimer)
    toast._hideTimer = setTimeout(() => {
      toast.style.display = 'none'
    }, 6000)
  }

  function registerCapture(buildPayload) {
    injectStyles()
    if (document.getElementById(BUTTON_ID)) return

    const button = document.createElement('button')
    button.id = BUTTON_ID
    button.textContent = 'Import to TechTools'
    document.body.appendChild(button)

    button.addEventListener('click', async () => {
      button.disabled = true
      button.textContent = 'Reading page...'

      let payload
      try {
        payload = buildPayload()
      } catch (error) {
        showToast('Could not read this page -- ' + (error && error.message ? error.message : 'unknown error'), 'error')
        button.disabled = false
        button.textContent = 'Import to TechTools'
        return
      }

      if (!payload || !payload.title || !payload.priceTiers || payload.priceTiers.length === 0) {
        showToast('Could not read a title/price from this page -- the site layout may have changed. Nothing was sent.', 'error')
        button.disabled = false
        button.textContent = 'Import to TechTools'
        return
      }

      button.textContent = 'Sending...'
      chrome.runtime.sendMessage({ type: 'CAPTURE_PRODUCT', payload }, (response) => {
        button.disabled = false
        button.textContent = 'Import to TechTools'
        if (!response || !response.ok) {
          showToast('Import failed: ' + (response && response.error ? response.error : 'unknown error'), 'error')
          return
        }
        showToast('Imported! Review it in TechTools → Sourcing.', 'success')
      })
    })
  }

  window.__techToolsSourcing = { registerCapture, showToast }
})()
