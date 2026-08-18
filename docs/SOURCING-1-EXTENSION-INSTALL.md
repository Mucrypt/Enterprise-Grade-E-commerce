# Sourcing Extension -- Install & Usage

The TechTools Sourcing Importer is a Chrome/Edge browser extension that reads a real Alibaba or Amazon product page you're already viewing (logged in as yourself) and sends the captured title/images/price to TechTools for review. **TechTools' own servers never fetch alibaba.com or amazon.\* directly** -- all of that happens in your own browser tab, the same way a person copying data from a page would.

Installed in "developer mode" (load unpacked) for now -- no Chrome Web Store submission, per the founder's own choice. This means: no review wait, completely private to you, and it's a one-time, one-minute setup.

---

## 1. Generate an API token

1. Log into the TechTools admin dashboard.
2. Go to **Sourcing → Extension Tokens**.
3. Click **Generate token**, give it a name (e.g. "My laptop"), and click Generate.
4. **Copy the token immediately** -- it's shown exactly once and can never be viewed again (if you lose it, just generate a new one and revoke the old one).

## 2. Install the extension

1. Open Chrome (or Edge) and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `sourcing-extension/` folder from this project.
5. The "TechTools Sourcing Importer" extension now appears in your extensions list and toolbar.

## 3. Configure the extension

1. Click the extension's icon in the toolbar, then **Settings** (or right-click the icon → Options).
2. **TechTools API URL**: your API's base URL plus `/api/v1` (e.g. `https://your-domain.com/api/v1`). Ask whoever set up the server if you're not sure of the exact domain.
3. **API Token**: paste the token from step 1.
4. Click **Save**, then **Test connection** -- it should say "Connected as your@email.com".

## 4. Import a product

1. Browse to a real Alibaba or Amazon product page (a `product-detail` page on Alibaba, or a `/dp/` page on Amazon).
2. A black **"Import to TechTools"** button appears in the top-right corner of the page.
3. Click it. A toast confirms success or explains what went wrong.
4. Go to TechTools → **Sourcing** in the dashboard -- your new draft appears there, with an AI-rewritten title/description filling in within about a minute (the "Regenerate rewrite" button on the draft's page can re-run it any time).
5. Review, edit anything you want, check the suggested price on the Pricing tab, then click **Commit as Product** when you're happy with it. The new product starts inactive (not visible on your storefront) with 0 stock and backorders allowed -- go to the normal Products page to activate it and set real stock once you're ready to sell it.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Import to TechTools" button never appears | You're not on a recognized product-detail page, or the site changed its page structure since this extension was built -- see the honest caveat at the top of `content-scripts/alibaba.js`/`amazon.js` |
| Toast says "could not read a title/price from this page" | Same as above -- the page's layout doesn't match what the extension expects. Nothing was sent. |
| "Test connection" fails | Double-check the API URL (must include `/api/v1`) and that the token hasn't been revoked/expired on the Extension Tokens page |
| Draft never gets an AI rewrite | The server's `OPENAI_API_KEY` may not be configured, or the rewrite worker may be disabled -- you can still review/edit/commit using the raw captured text regardless |

## If Alibaba or Amazon changes their page layout

The extension's page-reading logic lives entirely in two files: `content-scripts/alibaba.js` and `content-scripts/amazon.js`. If a real product page stops working, that's the file to update -- nothing else in TechTools needs to change. Each file's own header comment explains exactly what it's trying to read and where.
