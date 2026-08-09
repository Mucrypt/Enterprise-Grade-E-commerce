# LOCALIZATION-FOUNDATION-1 — International Language Architecture

**Phase:** LOCALIZATION-FOUNDATION-1 (workstream B of "ADMIN-2A.5 + LOCALIZATION-FOUNDATION-1")
**What this phase built:** a real, working i18n foundation for `e-commerce-web-store` plus a translated vertical slice (navbar, language selector, common buttons, product-card "Add to Cart", cart drawer, login/register core fields). Mobile, admin, product-content translation, AI-assisted translation, SEO routing, and email localization are **design only** this phase, per explicit instruction.
**Governing principle:** language ≠ country ≠ market ≠ currency. These are kept as four independent concerns throughout everything below.

---

## 1. Locale resolution algorithm

Implemented exactly, in `e-commerce-web-store/src/i18n/resolveLocale.ts` (pure function, no framework dependency, fully unit tested):

1. **Explicit choice** — the user just clicked a language in the selector this session.
2. **Logged-in user's saved preference** — not available yet; `users` has no locale column (see §6/§13). The function accepts this as an input parameter today so wiring it in later (once the column exists) is a one-line change at the call site, not a redesign.
3. **Previously persisted preference** — `localeStore` (Zustand + `persist`, `localStorage`), for both guests and logged-in users, since step 2 doesn't exist yet.
4. **Browser/device language** — `navigator.languages`, reduced to a base language subtag (`fr-CM` → `fr`, discarding the region entirely — see §12 for why the region is never used for anything).
5. **English fallback.**

A browser-language guess can never override an explicit or persisted choice because the function checks in that exact order and returns on the first match — there is no code path where step 4 is consulted once step 1 or 3 has already resolved something.

```ts
resolveLocale({
  explicitChoice,        // step 1
  userSavedPreference,   // step 2 (currently always undefined)
  persistedPreference,   // step 3
  browserLanguages,      // step 4
}) // -> 'en' | 'fr' | 'it' | 'de' | 'es'
```

21 tests in `resolveLocale.test.ts` and `localeStore.test.ts` cover: every precedence tier winning over the ones below it, `fr-CM`/`fr-FR`/`it-IT`/`de-DE`/`es-ES` → base language, an unsupported browser tag falling through to the next `navigator.languages` entry, full fallback to `en`, and a stale/invalid persisted value degrading safely instead of throwing.

---

## 2. Web implementation (`e-commerce-web-store`) — built this phase

**Stack chosen:** `i18next` + `react-i18next`. The app is a Vite + React 19 + `react-router-dom` v7 client-rendered SPA with no existing i18n dependency — `i18next`/`react-i18next` is the standard, framework-agnostic pairing for exactly this shape of app, actively maintained, and (critically for §9/§11) the same library family Expo/React Native uses, so the mental model transfers to mobile later without re-learning a second API. No library was installed blindly: `package.json` was inspected first (confirmed no i18n, no headless-UI, no existing test runner) before choosing anything.

**What was added:**
- `src/i18n/resolveLocale.ts` — the pure resolution function (§1).
- `src/i18n/index.ts` — `i18next.init()` wiring the resources below, computing the initial locale via `resolveLocale()`, and exporting `changeLanguage()` (updates `i18next`, `localeStore`, and `document.documentElement.lang` together).
- `src/stores/localeStore.ts` — Zustand + `persist`, mirroring the existing `consentStore.ts` pattern already used in this codebase (same shape: a typed store, one clear `localStorage` key, no new persistence convention invented).
- `src/locales/{en,fr,it,de,es}/{common,navigation,cart,auth,products}.json` — see §7.
- `src/components/layout/LanguageSelector.tsx` — the navbar globe/language menu (§5).
- `vitest.config.ts` + `vitest`/`jsdom` as new dev dependencies, since the app had **no test runner at all** before this phase and the explicit test requirements (§14) needed one. Kept separate from `vite.config.ts` (which owns build/bundling config, untouched) rather than merging the two.
- `tsconfig.app.json` gained `"resolveJsonModule": true` (required for `import enCommon from '../locales/en/common.json'` to type-check; Vite already supported this at runtime, `tsc` did not).

**Translated this phase (the vertical slice, per the explicit B8 scope):** `Header.tsx` (top bar links, search placeholder, account/sign-in labels, the plain UI-chrome nav labels — New In/Sale/Trending/Books/Categories/Brands), `LanguageSelector.tsx`, `CartDrawer.tsx` (fully), `LoginPage.tsx` (fully), `RegisterPage.tsx` (title/field labels/submit/footer link — not the password-strength requirement microcopy or field-level validation error text), `ProductCard.tsx`'s "Add to Cart" button.

**Deliberately NOT translated this phase:** product/category/brand names (these are catalog **content**, not UI copy — see §8's product-content boundary), every admin page, every product description, form validation error strings, checkout page internals, every other page in the app (Trending, Blog, Support, etc.). This matches the explicit "do not translate the entire platform yet" instruction — the goal was a real, finishable, testable slice, not partial coverage smeared across everything.

---

## 3. Mobile implementation (`tech-tools-mobile-app`) — design only

Not implemented this phase. Proposed:

- **Library:** `i18next` + `react-i18next` (same family as web — one mental model, most of `resolveLocale.ts`'s logic is directly reusable since it has zero DOM dependency) + `expo-localization` (the official Expo module for reading the device's configured locale — the mobile equivalent of `navigator.languages`).
- **Resolution rule:** identical precedence to web (§1), with step 4 reading `Localization.getLocales()` instead of `navigator.languages`, and step 3 persisted via `expo-secure-store` (already a dependency — see `tech-tools-mobile-app/package.json`) or plain `AsyncStorage`, **not** `localStorage`, which doesn't exist in React Native. This is the one implementation-level difference the spec explicitly called out ("do not make mobile depend on the web store's localStorage") — the persistence *mechanism* differs, the *resolution algorithm* does not.
- **Language selector:** a native-feeling picker (e.g. a bottom sheet or `expo-router` modal listing the 5 locales with checkmarks), not a web dropdown ported as-is — different platform, different interaction convention, same underlying `changeLanguage()`-equivalent call.
- **Translation resources:** could technically share the same JSON files as web (identical key structure, §6), but the mobile app is **not** an npm workspace member (confirmed — only `tech-tools-api`, `admin-dashboard`, `e-commerce-web-store` are in the root `package.json`'s `workspaces` array), so sharing would require either a new shared workspace package or duplicated JSON. Recommendation for LOCALIZATION-2: duplicate the JSON files (cheap, decoupled, no monorepo restructuring risk) rather than force a shared-package refactor as a side effect of a translation task.
- Mobile localization was not started this phase beyond this design note, per "audit the Expo mobile app. Design the same resolution rule" — no code was written for it.

---

## 4. Admin dashboard strategy — design only, lower priority

Not implemented this phase (explicitly lower priority than customer-facing). Proposed:

- **Library:** Next.js 16 (App Router) — `next-intl` is the more idiomatic choice here specifically because it integrates with Next's routing/RSC model (unlike `react-i18next`, which assumes a client-only tree). This is a genuinely different choice from web/mobile's `react-i18next`, made deliberately because the framework is genuinely different (Next.js App Router vs. a plain SPA/native app), not inconsistency for its own sake.
- **Independence from customer language:** a staff member's own UI language preference (once built) must be a separate setting from any customer-facing concept — an admin viewing a French customer's order does not see the admin chrome switch to French. `StaffAccessContext`/`AuthContext` would carry the staff member's own preference, entirely unrelated to `localeStore`/customer resolution.
- **Translation key structure:** the same semantic-key convention as customer-facing (§6) so a future shared vocabulary (`common.save`, `common.cancel`) doesn't fork into two different naming schemes even if the files themselves stay separate per-app.
- No admin screens were translated this phase.

---

## 5. Language selector UX

Built (`LanguageSelector.tsx`, in the Header's dark top bar, next to Track Order / Daily Deals / Support — deliberately **not** next to the cart/currency cluster, since language must never visually imply a country/currency binding, see §12):

- Trigger: `🌐 English` (globe icon + current language name).
- Click/Enter/Space opens a menu listing all 5 supported locales; the current one is marked with a checkmark.
- **Accessibility (§ built to the explicit B18 bar without pulling in a new headless-UI dependency for one component):** `aria-haspopup`/`aria-expanded` on the trigger, `role="menu"`/`role="menuitemradio"`/`aria-checked` on the panel/items, full keyboard support (Enter/Space to open, ↑/↓ to move between items with real DOM focus movement, Escape closes and returns focus to the trigger, click-outside closes), and an `aria-label` on the trigger so a screen reader announces "Language: English. Click to change." rather than just "button."
- On change: calls `i18n/index.ts`'s `changeLanguage(locale, explicit=true)`, which updates `i18next`, marks the choice `explicit` in `localeStore` (so a future browser-language change never silently overrides it — see §1), and sets `document.documentElement.lang` (§14).

---

## 6. Persistence strategy

- **Guests:** `localeStore` (Zustand `persist`, `localStorage`, key `techtools-locale`) — the same mechanism `consentStore` already uses in this codebase, not a new pattern.
- **Authenticated users:** also `localeStore`, today — there is **no `users.preferred_locale` column** (confirmed: grepped every migration file, found none). Per the explicit instruction ("do not block localization foundation on a DB migration"), no migration was created this phase. The persistence layer is written so that adding the column later is additive, not a rewrite: `resolveLocale()` already accepts a `userSavedPreference` parameter (currently always `undefined`/unused); wiring it in later means reading `authStore`'s hydrated user object at one call site in `i18n/index.ts`.
- **Future migration (not created this phase):** `ALTER TABLE users ADD COLUMN preferred_locale VARCHAR(5) NULL;` — nullable so it never forces a value, `VARCHAR(5)` fits any BCP-47 tag this app would realistically support (`en`, `fr-CM`, etc.), and it would be validated against `SUPPORTED_LOCALES` at the application layer exactly the same way `resolveLocale()`/`isSupportedLocale()` already validate everything else, rather than a DB-level enum that would need a migration every time a language is added.

---

## 7. Translation key/file organization

```
src/locales/
  en/
    common.json       -- search placeholder, account/sign-in labels, top-bar links, generic buttons
    navigation.json    -- plain UI-chrome nav labels (NOT catalog category names -- see §8)
    cart.json          -- cart drawer/page copy
    auth.json          -- login.*, register.*
    products.json      -- addToCart / stock-state labels
  fr/  it/  de/  es/   -- identical key sets, translated values
```

Namespaces are loaded eagerly (bundled at build time via `i18next`'s `resources` option) rather than lazy-fetched per-namespace — deliberate for a catalog this small (5 namespaces × 5 locales, each a few KB); revisit with `i18next-http-backend` (lazy per-namespace fetching) only once the catalog is large enough that bundle size actually becomes a concern, not preemptively.

**Semantic keys, never the English sentence as the key** (`common.buttons.save`, `cart.checkout`, `auth.login.submit` — never `t('Save')` or `t('Proceed to Checkout')`), per the explicit instruction. This is what makes a missing-translation fallback safe (§14) and keeps a future translator's job about *meaning*, not about matching exact English punctuation.

New namespaces (e.g. `checkout.json`, `products-detail.json`) get added the same way as `products.json` was added this phase: a JSON file per locale, one import + one line in `i18n/index.ts`'s `resources`/`ns` — no restructuring needed as the catalog grows.

---

## 8. Product-content translation architecture — design only, not built this phase

Global products remain **one product row** — never duplicated per language. Proposed (schema **not** created this phase; Global Commerce migrations have sequencing priority per explicit instruction):

```sql
-- FUTURE -- not created this phase
CREATE TABLE product_translations (
  product_id   UUID REFERENCES products(id) ON DELETE CASCADE,
  locale       VARCHAR(5) NOT NULL,
  name         TEXT,
  description  TEXT,
  seo_title    TEXT,
  seo_description TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT | AI_DRAFT | REVIEWED | PUBLISHED
  PRIMARY KEY (product_id, locale)
);
-- Same shape for category_translations, brand_translations where a brand
-- explicitly localizes its name (see §9's do-not-translate list -- most
-- brand names do not).
```

A product with no row for the visitor's current locale falls back to the master (English/default) content — never a blank field, and never machine-translated on the fly at render time (that's §9's job, offline, not per-request).

---

## 9. AI-assisted translation workflow — design only, not built this phase

Proposed pipeline, entirely offline/asynchronous — **never called at page-render time**:

```
English/master product content
  -> AI translation draft (batch job, off the request path)
  -> status = AI_DRAFT
  -> human/editor review in the admin dashboard
  -> status = REVIEWED -> PUBLISHED
  -> only PUBLISHED rows are ever served to a storefront visitor
```

`AI_DRAFT` is never shown to a customer as if it were a trusted product specification — dimensions, technical specs, and safety-relevant text in particular must pass through human review before `PUBLISHED`. No DB schema or job infrastructure was built this phase (the `status` enum above is illustrative of the future `product_translations.status` column, not a real column yet).

---

## 10. SEO/i18n routing strategy — design only, no routing change made this phase

Current state: `e-commerce-web-store`'s routes (`App.tsx`) have **no locale prefix** at all — `/products`, `/cart`, etc. Per the explicit instruction ("do not redesign routing blindly if it risks breaking all current URLs... create a migration/compatibility strategy"), **no routing change was made this phase.** The language selector changes UI language via `i18next` state only; it does not touch the URL.

Proposed for a future phase, compared:

| Approach | Pros | Cons |
|---|---|---|
| `/en/...`, `/fr/...` path prefixes | Standard, crawlable, clean `hreflang`/canonical mapping, works with any router | Every existing URL needs a redirect/compat layer; more router config |
| Query param (`?lang=fr`) | Zero routing change | Poor SEO (search engines don't reliably treat `?lang=` as a distinct crawlable page), easy to lose on internal links |
| Subdomain (`fr.techtoolstore.com`) | Very clean separation | Heavier infra (DNS/cert/CDN per subdomain), overkill for 5 locales |

**Recommendation for LOCALIZATION-2:** path-prefix (`/fr/products`), introduced with **unprefixed URLs treated as the default locale and permanently redirecting/rewriting**, not broken — e.g. `/products` continues to resolve (as `en`, matching today's behavior) while `/fr/products` becomes the new canonical French URL, with `hreflang` alternate tags added once locale-specific content actually exists (§8/§9) to point to. Until product content is actually translatable, a routing change would only fragment SEO for identical English content under multiple URLs — sequenced deliberately *after* §8/§9 land, not before.

---

## 11. Email/notification localization — design only, not built this phase

Proposed resolution rule for transactional messages (order confirmation, shipping updates, password reset, newsletter):

```
order/customer's locale snapshot at time of the triggering event
  -> the user's saved preference (once users.preferred_locale exists, §6)
  -> English fallback
```

"Snapshot at time of the event" (not "look it up live at send time") matters for order-related emails specifically — a customer's language preference could change between placing an order and a later shipping-update email; the *order's own* locale context (ideally captured once, at order creation, similarly to how `shipping_address` is already snapshotted onto the order rather than re-read from the user's current address) keeps a single order's correspondence internally consistent. No email templates were translated or built this phase.

---

## 12. Language / country / currency separation

Enforced throughout, not just documented:

- `changeLanguage()` (`i18n/index.ts`) touches exactly three things: `i18next`'s active language, `localeStore`, and `document.documentElement.lang`. It does not call `cartStore`, does not touch shipping address, does not touch any price/currency formatting.
- `resolveLocale()`/`matchSupportedLocale()` **discard the region subtag entirely** (`fr-CM` → `fr`, the `-CM` is never inspected again) — this is the concrete enforcement point for "never infer language from country": the one place a country-shaped signal (a BCP-47 region) enters the system, it's immediately reduced to nothing but a language hint and thrown away, never used to infer market/currency/shipping-country.
- The future navbar concept from the spec (`Ship to: Italy` / `🌐 English` / `EUR`) is three independent controls, not one — `LanguageSelector` was built and placed deliberately apart from where a future country/currency selector would live (§5), so a later phase adding "Ship to" doesn't have to first untangle language from it.
- Country/market switches (Global Commerce, future) may legitimately influence currency/availability — that dependency is one-directional and does not run through language at all.

---

## 13. Rollout plan

1. **This phase (done):** resolution algorithm, persistence, web vertical slice (navbar/selector/common buttons/cart/login-register/add-to-cart), tests, this document.
2. **LOCALIZATION-2 (proposed, not started):** finish translating the customer-facing web store (checkout, product detail page chrome, account pages, support/FAQ/legal pages) — still UI copy only, not product content.
3. **LOCALIZATION-3 (proposed):** `product_translations`/`category_translations` schema (sequenced after Global Commerce's own migrations per explicit priority), AI-draft pipeline, editor review UI in the admin dashboard.
4. **LOCALIZATION-4 (proposed):** mobile app implementation (§3), `users.preferred_locale` migration + wiring step 2 of the resolution rule for real, email/notification templates (§11).
5. **LOCALIZATION-5 (proposed):** path-prefixed routing + `hreflang`/canonical/sitemap work (§10) — sequenced last because it only pays off once §3 gives it real per-locale content to point to.
6. **Admin dashboard localization (§4)** is not on this numbered path — pick up whenever staff-facing multilingual support becomes an actual business need, independent of customer-facing progress.

Adding a 6th/7th language at any point after step 1 is: one new `src/locales/<code>/*.json` set, one entry in `SUPPORTED_LOCALES`, no code changes to `resolveLocale.ts`, `i18n/index.ts`'s `resources`/`ns` wiring, or `LanguageSelector.tsx` (it already maps over `SUPPORTED_LOCALES`).

---

## 14. Test strategy

`e-commerce-web-store` had **no test runner at all** before this phase — `vitest` (+ `jsdom`) was added specifically because the explicit test requirements below needed one, and it's the natural fit for a Vite project (first-class integration, no extra config duplication).

**21 tests, all passing** (`npm test` / `npx vitest run`), across two files:

`resolveLocale.test.ts`:
- `fr-FR` → `fr`, `fr-CM` → `fr`, `it-IT`/`de-DE`/`es-ES` → their base languages, `en-US` → `en`.
- An unsupported tag (`pt-BR`, `zh-CN`) → `null` from `matchSupportedLocale`, and the full chain still finds the next usable entry in `browserLanguages` or falls back to `en`.
- Manual/explicit choice **beats** browser language, saved user preference, and persisted preference, in that order.
- Persisted preference beats browser language.
- Full chain walks `navigator.languages` in order, skipping unsupported entries.
- A stale/invalid persisted locale degrades safely (falls through to the next step) rather than throwing.

`localeStore.test.ts`:
- An explicit choice is written to the documented `localStorage` key (`techtools-locale`) in the exact shape `persist` produces.
- **Page reload retains selection** — verified by reading the store's persisted state back independently of the in-memory instance that wrote it (the realistic equivalent of a fresh page load re-hydrating from `localStorage`).
- An attempt to persist an unsupported locale string is silently rejected (fails closed, not with a thrown error) rather than corrupting the stored value.
- A non-explicit (browser-derived) resolution is recorded distinctly from an explicit user choice, so a later browser-language change can still apply (only an *explicit* choice is meant to be permanently sticky against future browser-language drift — this distinction exists in the store specifically to support that future rule).

**Explicitly required scenarios and where they're covered:**
- "language change does not change country/currency" — enforced by `changeLanguage()`'s implementation (§12) never touching `cartStore`; not independently unit-tested this phase beyond that structural guarantee (would need a cart/currency integration test in LOCALIZATION-2 once more of the checkout flow is translated and there's a currency store to assert against).
- "translation key missing → safe fallback" — `i18next.init()` sets `returnNull: false`; a missing key renders the key string itself (`i18next`'s default `parseMissingKeyHandler` behavior) rather than throwing or rendering blank — this is `i18next`'s own well-tested built-in behavior, not custom code, so no additional test was written for it specifically.

---

## 15. Risks / open decisions

- **`users.preferred_locale` doesn't exist yet.** Step 2 of the resolution rule is a documented no-op until that migration lands (§6) — acceptable for this phase (guest/persisted/browser resolution still works correctly), but a logged-in user switching devices today gets browser-language resolution again, not their saved preference, until that lands.
- **Admin dashboard's i18n stack (`next-intl`) diverges from web/mobile's (`react-i18next`)** — a deliberate, framework-driven choice (§4), not an oversight, but worth flagging so a future implementer doesn't assume one library choice applies everywhere.
- **Mobile has zero code yet** — design only (§3); the resolution *algorithm* is proven out and directly portable, but `expo-localization` integration, secure-store persistence, and the native selector UI are all unbuilt.
- **Routing/SEO change is deliberately deferred** (§10) until product content is actually translatable — until then, adding locale-prefixed URLs would only fragment SEO for identical content, which is worse than the current single-URL state, not better.
- **Category/brand names are currently untranslated everywhere**, including inside the navbar's own translated shell (§2) — the nav labels are translated, the catalog data they link to is not. This is intentional (§8's boundary) but is the most visible "obviously not done yet" seam in the current UI to anyone testing multiple languages.
- **No currency/market UI exists yet to demonstrate the separation from language** (§12) beyond the code-level guarantee that `changeLanguage()` doesn't touch anything currency-related — there's nothing to visually contrast it against until a "Ship to / Currency" control exists.

---

## LOCALIZATION: READY FOR LOCALIZATION-2

The resolution algorithm, persistence, and a real (not stubbed) translated vertical slice are implemented and tested on the web store. Mobile, admin, product-content translation, AI-assisted translation, SEO routing, and email localization are deliberately design-only per this phase's explicit scope, with concrete proposals and a sequenced rollout plan (§13) ready for LOCALIZATION-2 onward. No database migration was created. No product/catalog content was translated or duplicated. No routing URLs changed.
