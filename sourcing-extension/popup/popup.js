async function init() {
  const stored = await chrome.storage.local.get(['apiBaseUrl', 'apiToken'])
  const statusEl = document.getElementById('configStatus')
  const configured = Boolean(stored.apiBaseUrl && stored.apiToken)
  statusEl.textContent = configured ? 'Configured and ready.' : 'Not configured yet -- open Settings.'
  statusEl.style.color = configured ? '#166534' : '#991b1b'

  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })

  document.getElementById('openDashboard').addEventListener('click', () => {
    if (stored.apiBaseUrl) {
      // The API URL is typically <origin>/api/v1 -- the dashboard lives
      // at the same origin, one path segment up.
      const dashboardOrigin = stored.apiBaseUrl.replace(/\/api\/v1\/?$/, '')
      chrome.tabs.create({ url: `${dashboardOrigin}/dashboard/sourcing` })
    } else {
      chrome.runtime.openOptionsPage()
    }
  })
}

init()
