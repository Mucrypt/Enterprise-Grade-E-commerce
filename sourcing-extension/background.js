/**
 * TechTools Sourcing Importer -- background service worker (Manifest V3).
 *
 * The actual network calls to the TechTools API happen HERE, not in the
 * content scripts, so they run outside the host page's Content Security
 * Policy (an Alibaba/Amazon page's own CSP could otherwise block a
 * content-script fetch to a third-party origin) -- this is the standard
 * MV3 pattern for exactly this situation. Content scripts only read the
 * page DOM and send a message; this worker holds the stored API token
 * and performs the one outbound request.
 */

async function getSettings() {
  const stored = await chrome.storage.local.get(['apiBaseUrl', 'apiToken'])
  return {
    apiBaseUrl: (stored.apiBaseUrl || '').replace(/\/+$/, ''),
    apiToken: stored.apiToken || '',
  }
}

async function callApi(path, options) {
  const { apiBaseUrl, apiToken } = await getSettings()
  if (!apiBaseUrl || !apiToken) {
    return { ok: false, error: 'Not configured -- set the API URL and token in the extension options page.' }
  }

  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
        ...(options && options.headers),
      },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: (body && body.error) || `Request failed (HTTP ${res.status})` }
    }
    return { ok: true, data: body }
  } catch (error) {
    return { ok: false, error: 'Could not reach TechTools -- check the API URL and your network connection.' }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'TEST_CONNECTION') {
    callApi('/sourcing/verify', { method: 'GET' }).then(sendResponse)
    return true // keep the message channel open for the async response
  }

  if (message?.type === 'CAPTURE_PRODUCT') {
    callApi('/sourcing/captures', { method: 'POST', body: JSON.stringify(message.payload) }).then(sendResponse)
    return true
  }

  return false
})
