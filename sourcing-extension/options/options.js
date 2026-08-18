const apiBaseUrlInput = document.getElementById('apiBaseUrl')
const apiTokenInput = document.getElementById('apiToken')
const statusEl = document.getElementById('status')

function showStatus(message, kind) {
  statusEl.textContent = message
  statusEl.className = kind
}

async function load() {
  const stored = await chrome.storage.local.get(['apiBaseUrl', 'apiToken'])
  apiBaseUrlInput.value = stored.apiBaseUrl || ''
  apiTokenInput.value = stored.apiToken || ''
}

document.getElementById('saveButton').addEventListener('click', async () => {
  const apiBaseUrl = apiBaseUrlInput.value.trim().replace(/\/+$/, '')
  const apiToken = apiTokenInput.value.trim()

  if (!apiBaseUrl || !apiToken) {
    showStatus('Both fields are required.', 'error')
    return
  }

  await chrome.storage.local.set({ apiBaseUrl, apiToken })
  showStatus('Saved.', 'success')
})

document.getElementById('testButton').addEventListener('click', async () => {
  // Save first so the background worker's test uses whatever is
  // currently in the fields, even if "Save" wasn't clicked separately.
  const apiBaseUrl = apiBaseUrlInput.value.trim().replace(/\/+$/, '')
  const apiToken = apiTokenInput.value.trim()
  await chrome.storage.local.set({ apiBaseUrl, apiToken })

  showStatus('Testing...', 'success')
  chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (response) => {
    if (response && response.ok) {
      showStatus('Connected as ' + (response.data && response.data.email ? response.data.email : 'unknown user') + '.', 'success')
    } else {
      showStatus('Connection failed: ' + (response && response.error ? response.error : 'unknown error'), 'error')
    }
  })
})

load()
