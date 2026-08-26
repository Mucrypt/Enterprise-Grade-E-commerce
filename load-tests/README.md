# Load testing

`browsing-load-test.js` simulates realistic shopper *browsing* traffic against the API — homepage, category listing, product listing/pagination, product detail pages, search. It's read-only by design: it never touches cart, checkout, or auth, so it's safe to run against production without creating fake orders/customers or sending real emails.

## One-time setup

Install k6: https://k6.io/docs/get-started/installation/ (a single static binary, no root needed — `curl -L <release-url> | tar xz` works fine if you can't install a package).

## Running it

**Run it from a different machine than the production server** — your laptop, or a small separate VM. Running it *from* the server would have k6 compete with the API for the same CPU cores it's trying to measure, which contaminates the result.

1. **Temporarily disable rate limiting on the server** for the duration of the test. k6 simulates thousands of concurrent "virtual users" from one real source IP; the API's rate limiter (300 req/min per IP as of this change) would otherwise throttle the test itself almost immediately — you'd be measuring the rate limiter, not the server.

   ```bash
   # on the server
   cd ~/Enterprise-Grade-E-commerce
   echo "DISABLE_RATE_LIMIT=true" >> .env
   docker compose -f infrastructure/docker-compose.prod.yml up -d api
   ```

2. **Pick a quiet time** — the middle of the night, or before you've announced anything. This generates genuine load against the real site.

3. **Run the test** (from your own machine):

   ```bash
   k6 run -e BASE_URL=https://techtoolstore.com/api/v1 browsing-load-test.js
   ```

4. **Watch the server while it runs**, in a second terminal on the server:

   ```bash
   docker stats
   ```

   Watch the `api` container's CPU% specifically — with clustering in place it should spread across all 4 cores (up to ~400% in `docker stats`' per-container accounting) rather than pegging at ~100%.

5. **Re-enable rate limiting the moment the test ends** — never leave it disabled outside a planned test window:

   ```bash
   # on the server
   sed -i '/DISABLE_RATE_LIMIT/d' .env
   docker compose -f infrastructure/docker-compose.prod.yml up -d api
   ```

## Reading the results

k6 prints a summary at the end. The two numbers that matter most:

- **`http_req_duration` p(95)`** — 95% of requests were faster than this. Under ~500ms is great, under ~1.5s is fine, climbing past that means pages are visibly slow.
- **`http_req_failed`** — the error rate. This should stay near 0% until the server is genuinely overwhelmed.

The test ramps through 50 → 300 → 500 → 2,000 → 5,000 virtual users over ~10 minutes, deliberately crossing the concurrency checkpoints from the infrastructure report. Watch k6's live output (not just the final summary) to see *which stage* is where `http_req_duration` starts climbing and `http_req_failed` stops being ~0% — that transition point is the real, measured ceiling, replacing the estimates in the report with an actual number.

If a threshold fails, k6 exits non-zero and marks it with a red `✗` in the summary — that's your answer to "can this handle it," not a guess.
