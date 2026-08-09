# Global Commerce Architecture — TechTools

**Status: DESIGN ONLY.** No code, no migrations, nothing applied anywhere. This document proposes an additive schema and set of algorithms; it does not implement them. Table/column names below are proposals for review, grounded in what already exists in the repository (checked before writing this, not guessed).

---

## 1. Executive architecture summary

TechTools today is architecturally single-market: one flat tax rate, one hardcoded currency path (`orders.currency` defaults `'USD'` in the schema but every real write path hardcodes `'EUR'`), one flat shipping formula, one address shape that assumes a postal code always exists. Every one of those is a *value*, not a *structure* — which is actually good news: the fix isn't a rewrite, it's adding a configuration layer above data that's already mostly generic (products are already global, `shipping_zones`/`shipping_methods` already exist as an unused rate-rule engine, `suppliers.country_code` already exists).

The architecture proposed here has four layers, additive on top of the current schema:

1. **`countries`** — every country the software *could* know about, each with an explicit lifecycle status. Existing, not automatically active.
2. **`markets`** — commercial groupings of one or more countries (EU, UK, US, CAMEROON, ...) that carry currency/tax/fulfilment *policy*.
3. **`product_markets`** — per-(product, market) overrides (price, availability, lead time) layered on top of the existing global `products` row, never duplicating it.
4. **Checkout eligibility** — a single server-side function that decides, for a given product + destination + customer, whether a sale can happen at all, and why not if it can't.

Nothing here requires touching `products`, `orders`, `suppliers`, `seller_profiles`, or `inventory` as they exist today. Everything is new tables plus a handful of new *nullable* foreign keys added in later phases.

---

## 2. Business / domain vocabulary

| Term | Definition |
|---|---|
| **Country** | A physical/legal destination — ISO 3166-1. Exists in the system whether or not anyone can buy from it yet. |
| **Market** | A commercial operating area — a named group of one or more countries that share currency/tax/fulfilment policy. Not always 1:1 with a country (EU is one market, many countries; the US is one market, one country). |
| **Region** | Optional cosmetic grouping for the admin UI (Europe/Africa/Asia/North America/Oceania) — not used in business logic, purely navigational. |
| **Shipping zone** | An *operational* shipping grouping — already exists (`shipping_zones`, `countries TEXT[]`). Distinct from a market: a market is a commercial/policy concept, a shipping zone is "which rate table applies." One market can span multiple shipping zones (e.g. US market: contiguous-US zone vs. Alaska/Hawaii zone). |
| **Fulfilment location** | Where goods physically or logically originate — a warehouse, a consolidation hub, or a marker meaning "ships direct from supplier." |
| **Warehouse** | A company-owned physical fulfilment location — a *kind* of fulfilment location, not a separate concept. |
| **Supplier** | Existing, unchanged — upstream B2B sourcing (`suppliers`/`supplier_products`). Not touched by this architecture beyond reading `suppliers.country_code`, which already exists and already does part of the job market-scoping needs. |
| **Seller** | Existing, unchanged — marketplace merchant (`seller_profiles`). Explicitly not merged with supplier, per your instruction and per the original audit's finding that they're already two unrelated, non-overlapping systems. |

---

## 3. International ER / domain model

```
regions (optional, cosmetic)
   │ 1
   │
   │ N
countries ──────────────┐
   │ N        N │        │
   │            │        │ referenced by
   │      market_countries      user_addresses.country (free text today,
   │            │        │      becomes country_id FK later, additively)
   │ 1          │ N      │
markets ─────────┘        │
   │ 1                    │
   │ N                    │
product_markets ── N:1 ── products (existing, untouched)
   │
   │ (references, doesn't own)
   ├── fulfillment_locations (N:1, optional per row)
   └── tax_strategy (via markets.tax_strategy_id)

markets ── 1:N ── market_payment_methods
markets ── N:1 ── tax_strategies

shipping_zones (existing) ── N:1 (new, optional) ── markets
shipping_methods (existing) ── N:1 ── shipping_zones (existing, unchanged)

fulfillment_locations ── 1:N ── inventory (existing table; new nullable FK column added later, replacing free-text warehouse_location — see §13)

staff_memberships (from MARKET-OPS) ── market_scope ── countries/markets (see §21)
```

Nothing in this diagram removes or renames an existing edge. Every new box is a new table; every new arrow into an existing table (`products`, `orders`, `inventory`, `user_addresses`) is a nullable FK added in a later phase, never a required one — old rows stay valid with the new column simply `NULL`.

---

## 4. Proposed tables and columns

### `regions` (optional — cosmetic only)
```
id            SMALLSERIAL PK
code          VARCHAR(20) UNIQUE   -- 'EUROPE','AFRICA','ASIA','NORTH_AMERICA','OCEANIA'
name          VARCHAR(100)
```

### `countries`
```
id                        UUID PK
iso_alpha2                CHAR(2)  UNIQUE NOT NULL
iso_alpha3                CHAR(3)  UNIQUE NOT NULL
name                      VARCHAR(100) NOT NULL
region_id                 SMALLINT REFERENCES regions(id)
status                    country_status_enum NOT NULL DEFAULT 'UNSUPPORTED'
                             -- UNSUPPORTED | SUPPORTED | TESTING | ACTIVE | SUSPENDED
checkout_enabled           BOOLEAN NOT NULL DEFAULT FALSE
seller_onboarding_enabled  BOOLEAN NOT NULL DEFAULT FALSE
default_currency           CHAR(3)          -- ISO 4217, e.g. 'EUR','USD','XAF'
supported_locales          TEXT[] DEFAULT '{}'
phone_country_code         VARCHAR(5)
postal_code_required       BOOLEAN NOT NULL DEFAULT TRUE
address_rules              JSONB DEFAULT '{}'   -- see §12
shipping_supported         BOOLEAN NOT NULL DEFAULT FALSE
payment_supported          BOOLEAN NOT NULL DEFAULT FALSE
created_at / updated_at
```
`status` and `checkout_enabled` are deliberately separate columns, not derived from each other — a country can be `TESTING` with `checkout_enabled=false` (staff can see/configure it, customers can't buy), which is exactly the Cameroon-pilot state described in §3 of your brief.

### `markets`
```
id                 UUID PK
key                VARCHAR(30) UNIQUE NOT NULL   -- 'EU','UK','US','CANADA','AUSTRALIA','CAMEROON'
name               VARCHAR(100) NOT NULL
status              market_status_enum NOT NULL DEFAULT 'UNSUPPORTED'  -- mirrors country_status_enum
base_currency       CHAR(3) NOT NULL
locale               VARCHAR(10)              -- default display locale, e.g. 'en-US','fr-CM'
pricing_strategy    VARCHAR(30) NOT NULL DEFAULT 'MANUAL'  -- 'MANUAL' | 'BASE_CONVERTED' (see §10)
tax_strategy_id     UUID REFERENCES tax_strategies(id)
fulfilment_strategy VARCHAR(30)               -- default strategy; product_markets/product_fulfillment_options can override per product
duties_policy       VARCHAR(30) DEFAULT 'DUTIES_NOT_INCLUDED'  -- see §17
created_at / updated_at
```

### `market_countries`
```
market_id   UUID REFERENCES markets(id)
country_id  UUID REFERENCES countries(id)
is_primary  BOOLEAN DEFAULT TRUE   -- for the rare case a country is relevant to >1 market during a transition
PRIMARY KEY (market_id, country_id)
```

### `product_markets` (replaces the need for `market_prices` as a separate table — see rationale below)
```
id                    UUID PK
product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
market_id             UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE
visible               BOOLEAN NOT NULL DEFAULT FALSE
sellable               BOOLEAN NOT NULL DEFAULT FALSE
price_override        DECIMAL(10,2)          -- NULL = fall back to products.base_price via pricing_strategy (§10)
compare_at_price_override DECIMAL(10,2)
min_order_quantity    INTEGER
max_order_quantity    INTEGER
lead_time_days        INTEGER
fulfilment_strategy    VARCHAR(30)            -- overrides markets.fulfilment_strategy for this product
availability_status    VARCHAR(30) DEFAULT 'AVAILABLE'  -- 'AVAILABLE'|'BACKORDER'|'CUSTOMS_RESTRICTED'|'UNAVAILABLE'
customs_restricted     BOOLEAN NOT NULL DEFAULT FALSE
metadata               JSONB DEFAULT '{}'
UNIQUE (product_id, market_id)
```
**Why no separate `market_prices` table:** a price is already 1:1 with (product, market) — the same grain `product_markets` is at. A separate table would just be `product_markets` split in two for no relational reason (no market has more than one price per product without also having more than one *market*, which is what the `markets` table itself already models). If a real future need shows up — e.g. showing a secondary currency alongside the primary one on a product page — that's a *display* concern, solvable with an FX conversion at read time (§10), not a second source-of-truth price table.

### `tax_strategies`
```
id       UUID PK
code     VARCHAR(30) UNIQUE  -- 'EU_VAT'|'UK_VAT'|'US_SALES_TAX'|'GST'|'ZERO'|'CUSTOM'|'EXTERNAL_PROVIDER'
name     VARCHAR(100)
config   JSONB DEFAULT '{}'   -- rate tables etc. -- NOT populated with real tax logic in this phase
```
`markets.tax_strategy_id` points here. The *strategy* exists as an architectural slot; no strategy's actual math is implemented in this phase (per your explicit instruction).

### `fulfillment_locations`
```
id            UUID PK
code          VARCHAR(50) UNIQUE  -- 'ITALY-WAREHOUSE-01','GERMANY-CONSOLIDATION-01','CAMEROON-DOUALA-01','SUPPLIER-DIRECT'
name          VARCHAR(150)
location_type VARCHAR(30) NOT NULL  -- 'WAREHOUSE'|'CONSOLIDATION_HUB'|'SUPPLIER_DIRECT'|'LOCAL_STOCK'
country_id    UUID REFERENCES countries(id)
address       JSONB
is_active     BOOLEAN DEFAULT TRUE
created_at / updated_at
```
A single row with `location_type='SUPPLIER_DIRECT'` and no real address stands in for "ships straight from the supplier, no company-controlled location" — so `product_fulfillment_options` (below) always points at *a* location, even when that location is conceptually "not a location."

### `product_fulfillment_options`
```
id                     UUID PK
product_id             UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
market_id              UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE
fulfillment_location_id UUID NOT NULL REFERENCES fulfillment_locations(id)
strategy               VARCHAR(30) NOT NULL  -- 'OWN_STOCK'|'SUPPLIER_DIRECT'|'COURIER'|'CONSOLIDATED_FREIGHT'|'LOCAL_STOCK'
lead_time_days         INTEGER
is_active              BOOLEAN DEFAULT TRUE
UNIQUE (product_id, market_id, fulfillment_location_id)
```
This is the table that answers "how does this specific product actually get to this specific market" — e.g. the drill example: `(drill, DE market, ITALY-WAREHOUSE-01, COURIER)` vs `(sewing machine, CAMEROON market, GERMANY-CONSOLIDATION-01, CONSOLIDATED_FREIGHT)`.

### `market_payment_methods`
```
id             UUID PK
market_id      UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE
provider_code  VARCHAR(30) NOT NULL   -- 'stripe_card'|'stripe_wallet'|'paypal'|'mtn_momo'|'orange_money'|'bank_transfer'
is_active      BOOLEAN DEFAULT FALSE
config         JSONB DEFAULT '{}'    -- non-secret config only; real credentials stay wherever the existing shipping_carriers.credentials-style pattern (or env/secrets manager) already keeps them -- never in this table
UNIQUE (market_id, provider_code)
```
No provider is globally assumed — checkout eligibility (§19) reads this table, not a hardcoded "Stripe everywhere" assumption.

### `shipping_zones` / `shipping_methods` — **reused, not duplicated**
Both already exist (`005_shipping.sql`) and are already close to what §6/§15 ask for: `shipping_zones.countries TEXT[]` already groups countries for rate purposes, and `shipping_methods` already supports `flat_rate | free | weight_based | price_based | carrier` typed rules per zone. The only gap is that **checkout never queries either table today** — it uses a hardcoded `totalAmount >= 50 ? 0 : 5.99` formula instead (found in the original audit). This architecture's shipping-engine work (§15) is about *wiring checkout to what already exists*, not building a new shipping-zone system. The one proposed additive change: a nullable `market_id UUID REFERENCES markets(id)` column on `shipping_zones`, so a market can be queried for "its" zones — optional, since `countries TEXT[]` can already answer the same question by set-overlap with `market_countries` without the FK, if you'd rather not add it yet.

### Consolidated freight (design only — explicitly not built in this phase)
```
freight_shipments
  id, origin_fulfillment_location_id, destination_fulfillment_location_id,
  cutoff_date, departure_date, estimated_arrival_date,
  freight_cost, total_weight_kg, total_volume_m3, status, created_at/updated_at

freight_shipment_items
  freight_shipment_id, shipping_label_id (existing table), added_at
```
This is a placeholder shape for §16, sized for review, not for building — it would be its own migration group (see §25) well after the core layers exist and have real data to move through them.

---

## 5. Country lifecycle / status model

```
UNSUPPORTED → SUPPORTED → TESTING → ACTIVE
                                  ↘  SUSPENDED (from ACTIVE or TESTING)
```
- **UNSUPPORTED**: exists as a row (for address/locale reference) but nothing else about it is configured. This is most of the world at any given time.
- **SUPPORTED**: architecture/config exists (currency, address rules, at least one fulfilment path *could* be configured) but the founder hasn't turned on real operations yet. Admin can configure it fully without customers seeing it.
- **TESTING**: a market manager (like the planned Cameroon manager) can operate against it, `checkout_enabled` may be true for internal/pilot testing, but it's not part of any public rollout wave.
- **ACTIVE**: fully live, publicly reachable, part of a rollout wave.
- **SUSPENDED**: was `ACTIVE`/`TESTING`, temporarily pulled (e.g. a carrier relationship broke, a payment method got disabled) — `checkout_enabled` forced false regardless of anything else, existing orders remain fully readable/manageable.

`checkout_enabled` is independently settable and is always the final gate (§19) — `status` communicates *why*/*intent* to admins, `checkout_enabled` is what the code actually checks.

---

## 6. Market model

A market is a **policy container**, not a shipping mechanism (that's `shipping_zones`, reused) and not a legal destination (that's `countries`). It groups countries that should be treated identically for currency, tax strategy, and default fulfilment — the EU market groups ~20 countries under one currency/VAT-strategy policy; the US market groups exactly one country because the US doesn't share policy with anyone. `market_countries` is a many-to-many join specifically so a country can move between markets over time (e.g. if the UK's relationship to an "EU market" changes) without ever needing to renumber or migrate historical data — you just repoint the join row.

---

## 7. Product-market model

`products` stays exactly as it is — one global row per product, same `id`, same `slug`, forever. `product_markets` is the layer that answers "is this product real *here*, and on what terms" — a product with zero `product_markets` rows is simply not sellable anywhere yet (safe default), not globally sellable by default (which would be the dangerous default). Every field on `product_markets` is an *override*; when `price_override IS NULL`, the pricing strategy (§10) decides what to show instead of duplicating a price that's identical to the base everywhere.

---

## 8. Pricing and currency model

Three distinct concepts, deliberately not conflated:

- **Base accounting currency**: the founder's own reporting currency (EUR, per the Italy-based-business rationale already in migration `038_checkout_payment_safety.sql`). Never shown to customers directly; used for internal margin/reporting math (`product_unit_economics`, already existing, already EUR-denominated).
- **Display currency**: what a customer *sees* while browsing — driven by `markets.base_currency` for whatever market they're currently in (§20).
- **Transaction currency**: what actually gets charged — must equal the display currency shown at the moment of checkout (never let a customer see one currency and get charged another). `orders.currency` (existing column, unchanged) continues to record this.

**The backend remains the sole source of truth for price, unconditionally** — `product_markets.price_override` (or the base price, converted) is read server-side at checkout-session-creation time, the same way the existing checkout-safety work (`038_checkout_payment_safety.sql`, `order.controller.ts`'s `validateAndPriceOrderItems`) already refuses to trust client-submitted prices. This architecture extends that same principle to market-aware pricing; it does not weaken it.

**`pricing_strategy` on `markets`:**
- `MANUAL` — every product's market price is an explicit `product_markets.price_override`; no FX math happens. Safest, most predictable, recommended default for every market until proven otherwise.
- `BASE_CONVERTED` — price = base currency price × FX rate × markup, computed at read time (not stored) when no explicit override exists. Requires an FX architecture:

```
fx_rates
  id, base_currency, quote_currency, rate, rate_source, rate_timestamp,
  created_at

market fields (already on `markets`, reused):
  base_currency  -- the quote_currency for that market's conversions
```
Rounding/markup rules live in `markets` (e.g. `fx_markup_percent`, `rounding_rule`) — not designed in full here since **no automatic FX service is implemented in this phase**, per your instruction; this is the slot it would plug into later, with a documented fallback (if no rate is fresh enough, fall back to `MANUAL`/last-known override rather than charging an unreviewed computed price).

---

## 9. Tax strategy abstraction

Covered in §4 (`tax_strategies` table) — the abstraction is a named strategy per market with a JSONB config slot. `order.controller.ts`'s current `const taxRate = 0.08` becomes, conceptually, `resolveTax(market, orderTotal) → taxAmount`, where `resolveTax` dispatches on `tax_strategies.code`. **No strategy's real math is implemented in this phase** — `ZERO` (always 0) is the only strategy that could safely be the *default* for any newly-`SUPPORTED` country, since it never overcharges; every other strategy requires deliberate configuration before a country leaves `TESTING`.

---

## 10. International address architecture

`user_addresses` (existing) keeps its columns; this is additive, not a rewrite:

```
user_addresses gains (nullable, backward compatible):
  country_id       UUID REFERENCES countries(id)   -- resolved from the existing free-text `country` column; both can coexist during transition
  region           VARCHAR(100)   -- state/province equivalent, already have `state`; `region` is for countries where that's the more natural term
  district         VARCHAR(100)
  quarter          VARCHAR(100)   -- meaningful in Cameroon/West-Africa addressing, not in most of Europe
  landmark         TEXT
  delivery_instructions TEXT
  latitude / longitude DECIMAL   -- optional, for locations where postal addressing alone isn't enough
```

`postal_code` stays `NOT NULL` at the column level for backward compatibility with every existing row, but the **application-level validation rule becomes country-driven**: `countries.postal_code_required` (§4) determines whether the checkout form actually requires it — for a country where it's `false`, the API accepts an empty string / synthesized placeholder rather than rejecting the order, closing the exact Cameroon-checkout gap the original audit flagged. `countries.address_rules JSONB` is the slot for anything more country-specific later (regex patterns, required-field lists) without needing a schema change per country.

---

## 11. Shipping-zone model

Already exists (`shipping_zones`, `shipping_methods` — §4). The architecture work here is entirely about **connecting checkout to it**, not building it:

```
Today:  checkout → hardcoded flat formula (order.controller.ts)
Target: checkout → resolve market from destination country
                  → resolve shipping_zones matching that country
                  → resolve shipping_methods for those zones
                  → for 'carrier' method_type, delegate to the existing
                    ShippingService (FedEx/UPS/DHL, already fixed to fail
                    loudly instead of faking rates — LAUNCH-FOUNDATION-1)
                  → for flat_rate/weight_based/price_based, compute from
                    shipping_methods' own columns (already there, unused)
```
Carriers remain exactly what they are today: one *option* within a zone/method, not the whole shipping architecture. Nothing about the DHL/UPS/FedEx integration changes.

---

## 12. Fulfilment model

Covered in §4 (`fulfillment_locations`, `product_fulfillment_options`). The five strategies you specified (`OWN_STOCK`, `SUPPLIER_DIRECT`, `COURIER`, `CONSOLIDATED_FREIGHT`, `LOCAL_STOCK`) map directly onto `product_fulfillment_options.strategy`. Checkout eligibility (§19) requires at least one active, matching `product_fulfillment_options` row for (product, market) to consider a purchase possible at all.

---

## 13. Warehouse / inventory integration

**Does not break the LAUNCH-FOUNDATION-1 inventory fixes.** `inventory.warehouse_location` (existing `VARCHAR(100)`, free text) is left exactly as it is in this phase. The proposed evolution, for a *later* phase once `fulfillment_locations` exists and has real data:

```
inventory gains (nullable, additive):
  fulfillment_location_id  UUID REFERENCES fulfillment_locations(id)
```
Existing rows keep their free-text `warehouse_location` untouched; new rows can optionally set the FK. `available_stock = current_stock - reserved_stock` (the generated column that's already the authoritative checkout-trusted value, per LAUNCH-FOUNDATION-1) is completely unaffected — this only adds a *location* dimension on top of a stock model that already works correctly. The inventory reconciliation script from that phase continues to work unmodified.

---

## 14. Supplier-direct / dropshipping model

No new supplier concept — `suppliers`/`supplier_products` stay exactly as they are (per your explicit instruction not to merge suppliers and sellers, and not to redesign what's working). The only new connective tissue is `product_fulfillment_options.strategy = 'SUPPLIER_DIRECT'` pointing at a `fulfillment_locations` row of `location_type='SUPPLIER_DIRECT'` — this lets the fulfilment layer say "this product, in this market, ships from a supplier, not company stock" without touching the supplier schema at all. `suppliers.country_code` (existing, from the profitability-controls migration) is what a future `applyMarketScope` (from MARKET-OPS) would already filter on for a market-scoped supplier view.

---

## 15. Consolidated-freight model

Covered in §4. Explicitly design-only, explicitly not built this phase, explicitly its own future migration group (§25/§27 — `GLOBAL-COMMERCE-3` or later, after core layers exist and there's a real African/heavy-goods pilot generating actual freight volume to model against).

---

## 16. Customs / duties model

`markets.duties_policy` (§4): `DUTIES_NOT_INCLUDED | DUTIES_ESTIMATED | DUTIES_INCLUDED`, with an optional per-product override on `product_markets` (via `metadata` or a dedicated column if this proves common enough — start with the market-level default, add product-level only if real data shows it's needed). Checkout eligibility (§19) surfaces this policy to the customer *before* payment, not as a surprise on delivery — exactly your framing: never pretend duties are exact when the system can't calculate them.

---

## 17. Payment capability model

Covered in §4 (`market_payment_methods`). Checkout eligibility (§19) queries this table for the customer's resolved market and only offers payment methods marked active there — Stripe stays the sole *implemented* provider in this phase (nothing here adds MTN MoMo/Orange Money code), but the schema means adding a provider later is a new `market_payment_methods` row plus one new provider adapter, not a rewrite of checkout.

---

## 18. Checkout eligibility algorithm

A single server-side function, called once at checkout-session creation (the same choke point the LAUNCH-FOUNDATION-1 checkout-safety work already established for price validation — this extends it, doesn't compete with it):

```
function checkEligibility(destinationCountryId, productId, quantity, requestedPaymentMethod):

  country = countries.get(destinationCountryId)
  if country.status != 'ACTIVE' and not (staffTestingOverride):
      return INELIGIBLE("Country not active")
  if not country.checkout_enabled:
      return INELIGIBLE("Checkout not enabled for this destination")

  market = resolveMarket(country)   -- via market_countries
  if market.status not in ('ACTIVE','TESTING'):
      return INELIGIBLE("Market not operational")

  pm = product_markets.get(productId, market.id)
  if pm is null or not pm.sellable:
      return INELIGIBLE("Product not sellable in this market")
  if quantity < pm.min_order_quantity or (pm.max_order_quantity and quantity > pm.max_order_quantity):
      return INELIGIBLE("Quantity outside allowed range")

  fulfilment = product_fulfillment_options.findActive(productId, market.id)
  if fulfilment is empty:
      return INELIGIBLE("No fulfilment option available")

  shippingOption = resolveShippingOption(country, fulfilment)  -- §11
  if shippingOption is null:
      return INELIGIBLE("No shipping option available")

  paymentOption = market_payment_methods.findActive(market.id, requestedPaymentMethod)
  if paymentOption is null:
      return INELIGIBLE("Payment method not available in this market")

  addressRuleCheck = validateAddress(submittedAddress, country.address_rules, country.postal_code_required)
  if not addressRuleCheck.valid:
      return INELIGIBLE(addressRuleCheck.reason)

  return ELIGIBLE(market, pm.effectivePrice, shippingOption, paymentOption, market.duties_policy)
```

Every `INELIGIBLE` carries a specific, real reason string — never a generic "checkout failed." This is one function, called from one place (the checkout-session endpoint), not scattered across frontend components — matching your explicit instruction.

---

## 19. Customer market-selection flow

1. **Default signal**: browser locale / IP-geolocation hint (advisory only, never authoritative).
2. **Explicit override**: a country/market selector, persisted to the customer's session (and to `users` for logged-in customers, e.g. a `preferred_country_id` — additive nullable column, not designed in full here since it's a small, obvious addition once `countries` exists).
3. **Authoritative signal**: once an address is entered at checkout, **the shipping destination country wins**, full stop — overriding whatever locale/IP/preference signal was used for browsing. This is the same principle as the existing `to.country || 'US'` fallback pattern in `shipping.controller.ts`, generalized: browsing-time signals are conveniences, checkout-time address is the fact the system acts on.

---

## 20. Admin International Control Center

**MVP (buildable once the schema above exists):**
- **Countries** — list + status/checkout-enabled toggles + address-rule editor. Read/write against `countries` only.
- **Markets** — list + currency/tax-strategy/fulfilment-strategy assignment + `market_countries` membership editor.
- **Product Availability** — a per-product view of its `product_markets` rows (visible/sellable/price toggles per market) — the highest-value screen, since it's what a Catalog Manager or Market Manager would actually use day to day.

**Later screens (not MVP):**
- Currencies/FX rate management (depends on `BASE_CONVERTED` pricing strategy actually being needed).
- Shipping Zones / Fulfilment Locations / Warehouses admin UI (the tables exist and are usable via direct DB/API access by an engineer in the meantime; a dedicated UI is a convenience, not a blocker).
- Payment Methods, Tax Profiles, Customs — configuration screens for tables that exist but whose *strategies* aren't implemented yet; building the UI before there's a real strategy to configure would be premature.
- Market Managers — this is exactly the `staff_memberships` admin UI already scoped in `MARKET-OPS-STAFF-ACCESS-AUDIT.md` §14 Phase 2; this Control Center's nav group is where it would live, not a separate build.

---

## 21. MARKET_MANAGER integration

**No hardcoded country checks, anywhere — confirmed as a hard requirement, not just a preference.** `staff_memberships.market_scope` (proposed in the original audit as `TEXT[]` of country codes) integrates with this architecture by having `applyMarketScope()` resolve against `countries`/`markets` instead of comparing raw strings: `WHERE country.iso_alpha2 = ANY(staff_membership.market_scope)` becomes the one place a country-code array is ever compared, not scattered `if (x === 'CM')` checks.

**`TEXT[]` vs. a normalized `staff_market_scope` join table — recommendation:** keep `market_scope TEXT[]` for the initial `staff_memberships` migration (`041`), **do not build the join table yet.** Reasoning:
- Right now, zero rows in `countries` exist (the table itself doesn't exist yet), so a `staff_market_scope.country_id → countries(id)` FK has nothing to reference — building the join table before `countries` exists would mean either forward-referencing a not-yet-real table or inventing a second, temporary country representation, either of which is worse than a plain `TEXT[]` for now.
- `TEXT[]` with ISO codes is trivially forward-compatible: once `countries` exists, a follow-up migration can (a) add `staff_market_scope(staff_membership_id, country_id)`, (b) backfill it from the existing `TEXT[]` by joining on `iso_alpha2`, and (c) leave the `TEXT[]` column in place, deprecated, until every read path has moved over — a clean, low-risk, fully reversible migration path, not a rewrite.
- The `West Africa Manager: ['CM','GH','NG']` / `EU Operations Manager: <EU market's countries>` examples both work fine against a `TEXT[]` today; a normalized table's main advantage (referential integrity against real country rows, easier set-based queries joining to `markets`) only starts to matter once `countries`/`markets` are real and being queried *together* with staff scope regularly — which is exactly the point at which the migration above should happen, not before.

**This document does not change the MARKET-OPS-1 schema** — `041_staff_memberships.sql`, when written, still uses `market_scope TEXT[]` exactly as already designed.

---

## 22. Analytics integration

**No second analytics system — extends `events_core`/`user_sessions`, per your instruction.** Both tables already carry most of what's needed:
- `user_sessions` already has `country_code`/`country_name`/`city` (added by `037_live_visitor_analytics.sql`) — a market can be derived from `country_code` via `market_countries` at query time, no new column required for that alone.
- `events_core` already has `order_id`, `product_id`, `session_id`, `payload JSONB` — a market/country breakdown of any existing event type is a `JOIN` through `user_sessions.country_code → market_countries → markets`, not new instrumentation.
- The one genuinely new field worth adding (additive, nullable): `events_core.currency` and/or reading it from `payload` for commerce events, so "revenue by market" doesn't require guessing a currency from country alone (a session's country and an order's transaction currency should usually agree, but shouldn't be *assumed* to).

The dashboard mockup in your brief (Cameroon / Germany / USA / global-owner, same metrics) is a `market_id` (or `country_code`) filter added to the existing `MARKET-OPS-DASHBOARD-PLAN.md` proposal — not a new proposal.

---

## 23. Advertising-attribution readiness

Not integrated this phase (explicitly out of scope), but made *answerable* by this architecture: "which market/country did this campaign target/generate" is answerable today already via `user_sessions.utm_*` + `country_code`; "what currency/revenue resulted" becomes answerable once `orders`/`events_core` can be joined to `markets` via the destination country, which this architecture provides the join path for without adding any ad-platform code. TechTools' own analytics remains the source of truth, per your instruction — this is purely about making sure the join keys exist when that integration work eventually happens.

---

## 24. Backwards compatibility

| Existing thing | What happens to it |
|---|---|
| `products.id` / `slug` | Unchanged, forever. `product_markets` references `product_id`; nothing about a product's identity changes. |
| Existing orders | Fully readable as-is. `orders.currency`/`shipping_address` keep their current meaning; no backfill required for old rows (a `market_id` column, if added later, is nullable — old orders simply have `NULL`, meaning "pre-market-architecture," not "broken"). |
| Existing inventory reservations | Untouched — `inventory.available_stock` (generated column) and the reservation logic from LAUNCH-FOUNDATION-1 don't reference anything in this document. |
| Legacy admin users (`user_type='admin'/'super_admin'`) | Fully operational, unchanged — this architecture and the MARKET-OPS staff system are both strictly additive to the existing `authorize()` model, per the original audit's design. |
| `shipping_zones`/`shipping_methods` | Reused as-is (§11) — existing rows (if any are configured) keep working; checkout gains the ability to query them, nothing about their shape changes. |
| `suppliers`/`seller_profiles` | Untouched (§14). |

---

## 25. Proposed migration sequence

Numbers are **placeholders** — re-confirm the actual next-free number against `schema_migrations` immediately before writing each group, per your own instruction; do not assume these survive until then.

Assuming `040` (analytics-alerts repair) and `041` (staff_memberships) land first:

- **GLOBAL-COMMERCE-1A** (`042`?) — `regions`, `countries`, `markets`, `market_countries`. Foundational, nothing depends on anything outside itself. Seed `countries` from a static ISO 3166 list; seed zero `markets` initially (founder configures the first ones deliberately, doesn't inherit any implicit ones).
- **GLOBAL-COMMERCE-1B** (`043`?) — `tax_strategies`, `product_markets`. Depends on `markets`.
- **GLOBAL-COMMERCE-2** (`044`?) — `user_addresses` gains `country_id`/`region`/`district`/`quarter`/`landmark`/`delivery_instructions`/lat-lng (all nullable). Checkout-eligibility function (§18) implemented in application code, not SQL — no migration content beyond this.
- **GLOBAL-COMMERCE-3** (`045`?) — `fulfillment_locations`, `product_fulfillment_options`, `shipping_zones.market_id` (nullable addition). `inventory.fulfillment_location_id` (nullable addition) — only once real fulfilment-location data exists to point at.
- **GLOBAL-COMMERCE-4** (`046`?) — `market_payment_methods`, `fx_rates` (only if/when `BASE_CONVERTED` pricing is actually needed — may never be required if `MANUAL` proves sufficient).
- **Later, not numbered yet** — `freight_shipments`/`freight_shipment_items` (§4/§15), only once a real consolidated-freight pilot exists to model.

Every group is additive-only: new tables, or nullable new columns on existing tables. None require an `ALTER ... NOT NULL` on an existing populated column, none require a data backfill to remain valid (nullable FKs default to `NULL`, which is a legitimate, meaningful "not yet categorized" state everywhere in this design).

---

## 26. Rollout strategy

Per your brief, as an *initial proposal only* — the architecture doesn't depend on this exact order, and country/market activation is always an explicit per-country action (§3), never inferred from a wave being "next":

1. **Wave 1**: formalize the existing EU footprint (Italy, Germany, France, Spain, ...) as the first real `markets` row — mechanically, this is the lowest-risk wave, since it's re-describing traffic that already exists rather than opening anything new.
2. **Wave 2**: UK, Switzerland, Norway — near-EU, likely similar fulfilment/payment story, `TESTING` → `ACTIVE` per the standard lifecycle.
3. **Wave 3**: US, Canada — first real currency (`USD`) and first real cross-Atlantic fulfilment decision.
4. **Wave 4**: Australia, New Zealand.
5. **African pilot**: Cameroon, as `TESTING`, operated by the planned `MARKET_MANAGER` — the concrete first use of `product_fulfillment_options.strategy='CONSOLIDATED_FREIGHT'` and `countries.postal_code_required=false`.
6. **Later Africa**: Ghana, Nigeria, Kenya, South Africa — each independently promoted from `SUPPORTED`/`TESTING`, informed by what the Cameroon pilot actually reveals about fulfilment/payment/customs friction.
7. **Selected Asia**: UAE, Singapore, Japan, South Korea, Malaysia — likely each needs its own `tax_strategies`/`market_payment_methods` configuration; no shared assumption across them.

---

## 27. Test strategy

Once any part of this is implemented (future phase, not this one):
- **Unit**: `checkEligibility()` (§18) — every `INELIGIBLE` branch individually, plus the happy path, using fixture `countries`/`markets`/`product_markets` rows (mirroring the pattern already established for `staff_memberships` permission tests in the MARKET-OPS design).
- **Integration**: a product visible/sellable in `market_id=A` but not `market_id=B` is correctly rejected for a `market_id=B` destination address, and correctly accepted for `market_id=A`.
- **Regression**: every existing order/product/checkout test (from LAUNCH-FOUNDATION-1 and earlier) continues to pass unmodified — this architecture must not require touching any existing test.
- **Data integrity**: no `product_markets`/`market_countries` row can reference a `product_id`/`country_id` that doesn't exist (standard FK enforcement) — and a query confirming every `ACTIVE` market has at least one `market_payment_methods` row and one `tax_strategy_id` set, run as a pre-activation checklist, not an app-level constraint (a market mid-configuration is allowed to be incomplete; an `ACTIVE` one shouldn't be).

---

## 28. Rollback strategy

Every table proposed here is new and additive — the rollback for any single migration group is `DROP TABLE IF EXISTS <new tables> [CASCADE]`, in reverse dependency order, exactly like the `040` repair migration's own rollback note. Nullable columns added to existing tables (`user_addresses`, `inventory`, `shipping_zones`) roll back with `ALTER TABLE ... DROP COLUMN IF EXISTS`, safe because nothing existing ever depended on them being present. No rollback in this entire architecture requires deleting or migrating existing customer/order/inventory data, because no phase of it ever writes to those rows — only reads them (to resolve a country/market) or adds new, optional rows/columns alongside them.

---

## 29. Security / privacy considerations

- `market_payment_methods.config` must never hold real credentials (§4) — same discipline already established for `shipping_carriers.credentials`, and the same credential-leak class of bug found and fixed in LAUNCH-FOUNDATION-1 (`getEnabledCarriers` was leaking `shipping_carriers.credentials` before that fix) must not be repeated for this new table — any future "list payment methods" endpoint must redact `config` the same way `getShippingCarriers` already correctly does.
- `fulfillment_locations.address` (a real physical warehouse/hub address) is operational data, not customer PII, but should still be admin-only-readable — same `authorize('admin','super_admin')` pattern as everything else in this area, no new exposure surface.
- Country/market data itself (`countries`, `markets`) is non-sensitive and could reasonably be public-readable (a storefront needs to know which countries to offer in a selector) — but the *admin* mutation endpoints (status changes, `checkout_enabled` toggles) are exactly the kind of action the `staff_memberships` permissions matrix (`MARKET-OPS-STAFF-ACCESS-AUDIT.md` §5) already reserves for `OWNER`/`SUPER_ADMIN`/`MARKET_MANAGER`-within-scope — this architecture doesn't need its own new permission model, it plugs into that one.
- Market-scoped analytics (§22) must respect the same market-scoping a `MARKET_MANAGER` has for orders/suppliers — a Cameroon manager's dashboard access to `events_core`/`user_sessions` should be filtered by `country_code`/market the same way their order access is, not a separate, wider analytics permission by accident.

---

## 30. Risks / open founder decisions

1. **Currency display strategy** — is `MANUAL` (explicit price per market) acceptable long-term, or will `BASE_CONVERTED` (live FX) be needed soon? This materially changes whether `fx_rates`/FX-provider work belongs in `GLOBAL-COMMERCE-4` or can be deferred indefinitely. Recommend starting `MANUAL`-only and revisiting once there are enough markets that manually pricing every product everywhere becomes the actual bottleneck.
2. **Tax strategy ownership** — real VAT/sales-tax math (`EU_VAT`, `US_SALES_TAX`, etc.) is a compliance question, not just an engineering one; likely needs either an external tax-calculation provider (`EXTERNAL_PROVIDER` strategy) or dedicated accounting/legal input before any strategy beyond `ZERO` is implemented for a real `ACTIVE` market. This architecture provides the slot; filling it is a founder + accountant decision, not something to default silently.
3. **`shipping_zones.market_id`** — add now (§11) or leave the `countries TEXT[]`-only relationship? Low-risk either way; recommend adding it only when the first real market-aware shipping query is actually being written, not speculatively.
4. **Consolidated freight** — is this genuinely near-term (needed for the Cameroon pilot to work at all) or a later-wave concern? The pilot could plausibly launch on `COURIER`/`SUPPLIER_DIRECT` alone for smaller/lighter goods first, deferring `CONSOLIDATED_FREIGHT` until volume justifies it — worth deciding before `GLOBAL-COMMERCE-3` is scoped in detail.
5. **`preferred_country_id` on `users`** (§19) — small, obvious, but not designed in full here since it's a one-column addition once `countries` exists; flagging so it isn't forgotten rather than silently assumed.
6. **Mobile money timing** — `market_payment_methods` makes adding MTN MoMo/Orange Money a config-plus-adapter change rather than a rewrite, but *when* that adapter work happens is a founder call tied to the Cameroon pilot's actual payment-method needs, not an architecture question.

---

## Hardcoded assumptions this architecture is intended to eventually replace

Listed explicitly, per your instruction — none of these are changed by this document itself, all are the concrete things each migration group above exists to remove:

- `order.controller.ts`: `const taxRate = 0.08` (flat, universal) → `tax_strategies` per market.
- `order.controller.ts`: `totalAmount >= 50 ? 0 : 5.99` (flat shipping) → `shipping_zones`/`shipping_methods`, finally wired to checkout.
- `order.controller.ts`/`stripe.service.ts`: `'EUR'` hardcoded at every order-creation/Stripe call site → `markets.base_currency` resolved per destination.
- `user_addresses.postal_code NOT NULL` enforced unconditionally in app validation → `countries.postal_code_required`-driven.
- `payment.controller.ts`: implicit "Stripe is the only payment method" → `market_payment_methods`-driven availability.
- Web/mobile checkout: `country || 'US'` fallback patterns → resolved market/country becomes explicit and required, not defaulted.
- `products` treated as globally, uniformly sellable the instant `is_active=true` → `product_markets.sellable` becomes the real per-market gate, defaulting closed, not open.

---

## Status

**READY FOR GLOBAL-COMMERCE-1A** — with the three open decisions in §30 (items 1, 2, 4) flagged as worth a founder call before `GLOBAL-COMMERCE-1B`/`3` are scoped in implementation detail; none of them block starting `1A` (`regions`/`countries`/`markets`/`market_countries`), since that group doesn't depend on any of those decisions being made yet.

This remains contingent on `040`/`041` (analytics-alerts repair, staff_memberships) actually landing first, per your own migration-sequencing instruction in §27/§5 of the phase brief — this document does not change that ordering.
