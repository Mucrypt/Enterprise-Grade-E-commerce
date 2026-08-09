# Global Commerce Architecture — TechTools

**Status: DESIGN ONLY.** No code, no migrations, nothing applied anywhere. This document proposes an additive schema and set of algorithms; it does not implement them. Table/column names below are proposals for review, grounded in what already exists in the repository (checked before writing, not guessed) — including, as of this revision, `order_items` already snapshotting `unit_price`/`product_name`/`sku`/`tax_rate` at purchase time, which the order-snapshot design in §9 builds on rather than duplicates.

---

## Pre-Implementation Architecture Review (Round 1)

The overall direction from the first pass was approved; this round revised thirteen specific structural issues before any implementation begins. Each is explained here with the reasoning, and the rest of the document below reflects the corrected design throughout (this is one document, not two — nothing below contradicts this section).

1. **EU ≠ one currency.** The original design let a `market` own a single `base_currency` and priced products at `(product_id, market_id)`. That breaks the moment a market contains countries with different currencies (the EU commercially shares VAT/regulatory infrastructure while several member states use non-euro currencies). **Fix:** pricing is no longer owned by `markets` at all. A new `price_lists`/`price_list_entries` layer, each price list carrying its own `currency` and scoped to either a market (the common/default case) or a specific country (the override case), replaces `product_markets.price_override`. A market stays a single commercial/policy grouping; currency becomes a property of the *price list*, not the market. See §7.
2. **Currency terminology was ambiguous.** "Base currency" meant two different things in the original draft (the company's own accounting currency, and a market's default currency). **Fix:** three explicitly separate, separately-named concepts — `platform_settings.accounting_currency` (platform level), `markets.default_currency` (a fallback/hint, not authoritative once a price list exists), and `orders.currency` (the existing column, now explicitly documented as immutable post-creation, the order transaction currency). No field is called "base currency" anymore. See §8.
3. **`ZERO` tax was wrongly treated as a safe default.** **Fix:** the *absence* of a configured tax strategy (`tax_strategy_id IS NULL`, on both `markets` and any `market_countries` override) is now the explicit "unconfigured" state, distinct from a deliberately-chosen `ZERO` strategy row. The activation checklist (§11) hard-fails a country's path to `ACTIVE` + public checkout if its resolved tax strategy is `NULL`. See §9.
4. **No market/country override mechanism existed.** **Fix:** rather than a separate `market_country_settings` table, the override columns live directly on a restructured `market_countries` (which already has to change for reason 5 below) — `tax_strategy_id`, `duties_policy`, `pricing_strategy`, each nullable and inheriting the market's default when unset. See §6 and the ownership matrix in §14.
5. **Market resolution wasn't deterministic.** `is_primary` on a many-to-many `market_countries` could let a country resolve to more than one "primary" market, or none, with no enforcement. **Fix:** `market_countries` becomes a time-ranged assignment (`effective_from`/`effective_to`) with a partial unique index guaranteeing at most one row per country where `effective_to IS NULL` — "current market for this country" becomes a single, enforced, unambiguous lookup. Rejected a priority-number scheme as unnecessary complexity for the same guarantee. See §6.
6. **No order-time commerce snapshot existed.** International configuration will keep changing after an order is placed; nothing preserved the *terms that were actually true* at checkout. **Fix:** a new, additive, 1:1 `order_commerce_snapshots` table, written once at order creation and never updated. Old orders simply have no row here — not a row full of nulls. See §9.
7. **Fulfilment and shipping were conflated.** `product_fulfillment_options.strategy` mixed "who supplies the goods" (`OWN_STOCK`) with "how they physically move" (`COURIER`) in one enum. **Fix:** split into supply strategy (`product_fulfillment_options.supply_strategy`: `OWN_STOCK | SUPPLIER_DIRECT | LOCAL_STOCK | CONSOLIDATION_HUB`) versus delivery method, which is resolved entirely through the *existing* `shipping_zones`/`shipping_methods`/`ShippingService` (extended with two new `method_type` values, not a parallel system). See §11.
8. **`SUPPLIER_DIRECT` had no real origin.** A single global fake "SUPPLIER-DIRECT" location would have made shipping-cost calculation impossible (every supplier is a different real country). **Fix:** `product_fulfillment_options` gets a nullable `supplier_id → suppliers(id)` (and optional `supplier_product_id`), used instead of `fulfillment_location_id` when `supply_strategy = 'SUPPLIER_DIRECT'` — origin resolves via the supplier's own real `country_code` (already exists), never a placeholder. See §12.
9. **Fake postal codes were proposed.** The original draft suggested synthesizing a placeholder to satisfy `postal_code NOT NULL`. **Fix:** that idea is removed entirely. `ALTER TABLE user_addresses ALTER COLUMN postal_code DROP NOT NULL` is a normal, always-safe constraint *relaxation* — it cannot invalidate any existing row, no staging is required at the database level. What actually needs to be staged is application validation logic becoming country-aware before/alongside that column change, so "not required" never silently becomes "required nowhere." See §13.
10. **Money precision needed review, not a rewrite.** Considered converting all monetary columns to integer minor units (Stripe-style). Rejected as disproportionate — Postgres `DECIMAL`/`NUMERIC` is already exact (no floating-point risk exists today), and a currency like XAF (Cameroon, the first pilot market) with zero minor units is still stored and rounded correctly as `DECIMAL(x, 2)` with two always-zero decimal digits — a display/rounding concern, not a storage-precision bug. **Fix:** widen new pricing columns to `DECIMAL(14,4)` for headroom (larger machinery-scale values, extra FX-derived precision), add a small `currency_minor_units` reference for correct display/Stripe-API rounding, and require every new monetary column to carry its currency alongside it explicitly. Existing `DECIMAL(10,2)` columns are left untouched — any future widening of those is its own, separately-reviewed change, not bundled here. See §10.
11. **No activation gate existed.** **Fix:** a server-side `validateCountryForActivation()` check, enforced (not just displayed) before any country can be flipped to `ACTIVE` + `checkout_enabled = true`. See §15.
12. **Staff scope needed a market-level path, not just country arrays forever.** **Fix:** documented (not built — `041` is unchanged) a future `staff_market_scopes` table supporting *either* a `country_id` *or* a `market_id` per row, so "EU Operations Manager" is one row referencing the EU market rather than an enumerated, manually-maintained list of 20+ country codes. See §19.
13. **Historical-configuration behavior wasn't explicit.** **Fix:** a dedicated section (§16) states the general rule plainly — configuration tables represent current/future state and can change freely; `order_items` (existing) and `order_commerce_snapshots` (new) represent what was true at purchase time and are never touched by later configuration changes, and every snapshot-side foreign key uses `ON DELETE SET NULL`, never `CASCADE`.

---

## 1. Executive architecture summary

TechTools today is architecturally single-market: one flat tax rate, one hardcoded currency path, one flat shipping formula, one address shape that assumes a postal code always exists. Every one of those is a *value*, not a *structure* — the fix is a configuration layer above data that's already mostly generic (products are already global; `shipping_zones`/`shipping_methods` already exist as an unused rate-rule engine; `suppliers.country_code` already exists; `order_items` already snapshots purchase-time price).

The architecture, revised, has five layers, additive on top of the current schema:

1. **`countries`** — every country the software *could* know about, each with an explicit lifecycle status.
2. **`markets`** — commercial/policy groupings of one or more countries, with `market_countries` deterministically resolving exactly one current market per country and allowing per-country overrides.
3. **`price_lists`** — currency-scoped pricing, attached to a market (default) or a specific country (override) — the piece that makes "EU market, but Poland prices in PLN" representable without splitting markets or duplicating products.
4. **`product_markets` / `product_fulfillment_options`** — per-market availability and per-market-or-country supply routing, layered on the existing global `products` row, never duplicating it.
5. **Checkout eligibility + order commerce snapshot** — a single server-side function decides whether a sale can happen and why not if it can't, and a single additive table preserves exactly what was true when it did.

Nothing here requires touching `products`, `orders`, `order_items`, `suppliers`, `seller_profiles`, or `inventory` as they exist today, beyond `user_addresses.postal_code` losing its `NOT NULL` (a pure relaxation) and a handful of new *nullable* foreign keys added in later phases.

---

## 2. Business / domain vocabulary

| Term | Definition |
|---|---|
| **Country** | A physical/legal destination — ISO 3166-1. Exists whether or not anyone can buy from it yet. |
| **Market** | A commercial/policy grouping — one or more countries sharing tax-strategy/fulfilment defaults. **Not a currency grouping** (Round 1 correction) — a market's countries may use different price lists/currencies. |
| **Price list** | A currency-scoped set of product prices, attached to a market (default for its countries) or a specific country (override). New concept, Round 1. |
| **Region** | Cosmetic-only grouping for admin navigation (Europe/Africa/Asia/North America/Oceania) — never used in business logic. |
| **Shipping zone** | An *operational* shipping grouping — already exists (`shipping_zones`, `countries TEXT[]`). A market can span multiple shipping zones. |
| **Fulfilment location** | A physical/logical origin for `OWN_STOCK`/`LOCAL_STOCK`/`CONSOLIDATION_HUB` supply — never used for `SUPPLIER_DIRECT`, which resolves origin via the real supplier instead (Round 1 correction, §12). |
| **Supply strategy** | *Who* sources the goods (`OWN_STOCK`/`SUPPLIER_DIRECT`/`LOCAL_STOCK`/`CONSOLIDATION_HUB`) — distinct from delivery method (Round 1 correction, §11). |
| **Delivery method** | *How* goods physically move — entirely the existing `shipping_methods`/`shipping_zones`/`ShippingService`, not a new concept. |
| **Order commerce snapshot** | An immutable, order-time-only record of the commercial context (market, tax strategy, duties policy, FX rate if any) a purchase was made under. New, Round 1. |
| **Supplier** | Existing, unchanged (`suppliers`/`supplier_products`). |
| **Seller** | Existing, unchanged (`seller_profiles`). Not merged with supplier. |

---

## 3. International ER / domain model

```
regions (cosmetic only)
   │ 1
   │ N
countries
   │ 1                                    │ referenced by (nullable, additive)
   │ N (time-ranged, deterministic)        user_addresses.country_id
market_countries ──────── N:1 ──── markets
   │  (tax_strategy_id, duties_policy,        │ 1
   │   pricing_strategy -- all nullable        │ N
   │   overrides; effective_from/to;      market default: tax_strategy_id,
   │   partial-unique on country_id           duties_policy, pricing_strategy,
   │   WHERE effective_to IS NULL)             default_currency (hint only)
   │
   ▼
price_lists ── scope: market_id OR country_id (currency-bearing, not markets/countries themselves)
   │ 1
   │ N
price_list_entries ── N:1 ── products (existing, untouched)

product_markets ── N:1 ── products            -- availability/visibility, not pricing
   │ 1
   │ N
product_fulfillment_options
   ├── N:1 (nullable) ── fulfillment_locations   -- for OWN_STOCK/LOCAL_STOCK/CONSOLIDATION_HUB
   └── N:1 (nullable) ── suppliers (existing)     -- for SUPPLIER_DIRECT (real origin, no fake location)

orders (existing, untouched) ── 1:1 (nullable) ── order_commerce_snapshots (new)
order_items (existing, unchanged) already carries unit_price/sku/product_name at purchase time

shipping_zones (existing) ── N:1 (new, optional) ── markets
shipping_methods (existing, method_type CHECK extended with
   'consolidated_freight' | 'local_delivery') ── N:1 ── shipping_zones (unchanged)

staff_memberships (from MARKET-OPS, unchanged) ── market_scope TEXT[] today;
   future staff_market_scopes ── country_id OR market_id per row (§19, not built)
```

Every new box is a new table; every new arrow into an existing table (`user_addresses`, `shipping_zones`, `shipping_methods`) is a nullable addition or a constraint relaxation — old rows stay valid unchanged.

---

## 4. Countries

Unchanged from the first draft — still the right shape:

```
id                        UUID PK
iso_alpha2 / iso_alpha3   CHAR(2)/CHAR(3) UNIQUE NOT NULL
name                      VARCHAR(100) NOT NULL
region_id                 SMALLINT REFERENCES regions(id)
status                    country_status_enum DEFAULT 'UNSUPPORTED'  -- UNSUPPORTED|SUPPORTED|TESTING|ACTIVE|SUSPENDED
checkout_enabled          BOOLEAN NOT NULL DEFAULT FALSE
seller_onboarding_enabled BOOLEAN NOT NULL DEFAULT FALSE
supported_locales         TEXT[] DEFAULT '{}'
phone_country_code        VARCHAR(5)
postal_code_required      BOOLEAN NOT NULL DEFAULT TRUE
address_rules             JSONB DEFAULT '{}'
shipping_supported        BOOLEAN NOT NULL DEFAULT FALSE
payment_supported         BOOLEAN NOT NULL DEFAULT FALSE
created_at / updated_at
```
`default_currency` (present in the first draft) is **removed from `countries`** — currency now flows entirely through `price_lists` (§7); a country never owns a currency value directly, only a resolved market/price-list does.

---

## 5. Platform-level settings

New, small, Round 1 addition, mirroring the existing `shipping_settings` singleton-row pattern already in this codebase:

```
platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    accounting_currency CHAR(3) NOT NULL,   -- e.g. 'EUR' -- the company's own reporting currency
    created_at / updated_at
)
```
This is the "PLATFORM ACCOUNTING CURRENCY" from Round 1 correction 2 — never shown to a customer, used only for internal reporting/margin math (`product_unit_economics`, already EUR-denominated today).

---

## 6. Markets and deterministic market resolution

```
markets (
    id                  UUID PK
    key                 VARCHAR(30) UNIQUE NOT NULL   -- 'EU','UK','US','CANADA','AUSTRALIA','CAMEROON'
    name                VARCHAR(100) NOT NULL
    status              market_status_enum DEFAULT 'UNSUPPORTED'
    default_currency    CHAR(3) NOT NULL   -- fallback/hint only, see §7 -- NOT authoritative pricing
    locale              VARCHAR(10)
    tax_strategy_id     UUID REFERENCES tax_strategies(id)   -- market-level default; NULL = unconfigured
    pricing_strategy    VARCHAR(30) NOT NULL DEFAULT 'MANUAL'
    duties_policy       VARCHAR(30) DEFAULT 'DUTIES_NOT_INCLUDED'
    created_at / updated_at
)

market_countries (
    id              UUID PK
    market_id       UUID NOT NULL REFERENCES markets(id)
    country_id      UUID NOT NULL REFERENCES countries(id)
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT now()
    effective_to    TIMESTAMPTZ NULL         -- NULL = currently in effect
    -- per-country overrides; NULL = inherit the market's default
    tax_strategy_id UUID REFERENCES tax_strategies(id)
    duties_policy   VARCHAR(30)
    pricing_strategy VARCHAR(30)
    created_at

    -- enforced: at most one row per country_id where effective_to IS NULL
    -- (partial unique index -- see below)
)
CREATE UNIQUE INDEX ux_market_countries_current
  ON market_countries (country_id) WHERE effective_to IS NULL;
```

**This is the Round 1 answer to deterministic resolution (issue 5).** "What is the current market for country X" is always exactly one row: `SELECT * FROM market_countries WHERE country_id = X AND effective_to IS NULL` — the partial unique index makes a second concurrent answer a constraint violation, not just an application bug waiting to happen. When a country moves markets: close the old row (`effective_to = now()`), insert a new one — a plain, auditable history, no priority numbers, no ambiguity.

**This is also the Round 1 answer to market/country overrides (issue 4).** Rather than a separate `market_country_settings` table, the three override columns live directly on the row that already has to exist and already has to be time-ranged for resolution to work — one table serves both jobs. `checkout_enabled`, `postal_code_required`, `address_rules`, and locale/phone data stay on `countries` directly (§4) — they were never market-relative and don't need this override mechanism.

---

## 7. Pricing model — the EU multi-currency fix

**This is Round 1 issue 1, the most structurally significant change.**

`product_markets.price_override` (first draft) assumed one price per `(product, market)`, which only works if a market has one currency. Compared against the alternatives from your brief:

- **(A) market_country overrides** — closer, but still ties price to market membership rather than to currency directly; doesn't cleanly generalize to "this country's price should just track its price list."
- **(B) price lists** — chosen. Decouples price entirely from the market/country hierarchy; a price list is *just* "a set of prices in a currency," attachable to whatever scope needs it.
- **(C) country-specific pricing policy beneath a market** — this is effectively what (B) becomes once a price list can be scoped to a country instead of a market; (B) subsumes (C).
- **(D) narrower markets (EUROZONE vs. individual non-euro countries)** — rejected: it solves pricing by fragmenting the *commercial* grouping, which then also fragments tax-strategy/fulfilment defaults that legitimately are shared EU-wide. Splitting the wrong dimension to fix the right one.

**Design:**
```
price_lists (
    id           UUID PK
    currency     CHAR(3) NOT NULL
    scope_type   VARCHAR(10) NOT NULL CHECK (scope_type IN ('MARKET','COUNTRY'))
    market_id    UUID REFERENCES markets(id)    -- set iff scope_type = 'MARKET'
    country_id   UUID REFERENCES countries(id)  -- set iff scope_type = 'COUNTRY'
    name         VARCHAR(100)
    status       VARCHAR(20) DEFAULT 'ACTIVE'
    created_at / updated_at
    CHECK ((scope_type = 'MARKET' AND market_id IS NOT NULL AND country_id IS NULL)
        OR (scope_type = 'COUNTRY' AND country_id IS NOT NULL AND market_id IS NULL))
)
CREATE UNIQUE INDEX ux_price_lists_market ON price_lists(market_id) WHERE scope_type = 'MARKET';
CREATE UNIQUE INDEX ux_price_lists_country ON price_lists(country_id) WHERE scope_type = 'COUNTRY';

price_list_entries (
    id             UUID PK
    price_list_id  UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE
    product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
    price          DECIMAL(14,4) NOT NULL     -- widened precision, see §10
    compare_at_price DECIMAL(14,4)
    UNIQUE (price_list_id, product_id)
)
```

**Resolution rule** (used everywhere a price is needed — checkout, product display): *look for a `price_lists` row scoped to the customer's specific `country_id` first; if none, fall back to the `price_lists` row scoped to that country's currently-resolved `market_id` (§6); if neither has a `price_list_entries` row for the product, the product is not priced in that market and is therefore not sellable there* — a safe, closed default, not an accidental fallback to some other currency's number.

**Worked example, directly answering the EU case:** the `EU` market has one `price_lists` row (`scope_type='MARKET', market_id=EU, currency='EUR'`), covering Germany/France/Italy/Spain/etc. Poland, still a `market_countries` member of `EU` for tax/fulfilment purposes, gets its *own* `price_lists` row (`scope_type='COUNTRY', country_id=Poland, currency='PLN'`) — an explicit override, not a market split. Adding Sweden (`SEK`) later is one more country-scoped price list, not a new market.

**Requirements check:** one global product stays one product (`price_list_entries.product_id` references it, never duplicates it) · no duplicated product rows · same product can have different price/currency per country (via the market-vs-country price list resolution) · backend remains sole pricing authority (resolution happens server-side at checkout-session creation, same choke point the existing `validateAndPriceOrderItems` already uses — no client-submitted price is ever trusted, extending, not weakening, that existing rule) · `MANUAL` (explicit `price_list_entries` rows, no FX math) remains the recommended first `pricing_strategy` — `product_markets.price_override`/`compare_at_price_override` are removed from `product_markets` entirely, superseded by this layer.

---

## 8. Currency terminology (Round 1 issue 2)

| Concept | Where it lives | Notes |
|---|---|---|
| **Platform accounting currency** | `platform_settings.accounting_currency` | Internal reporting only, e.g. `EUR`. Never customer-facing. |
| **Market default currency** | `markets.default_currency` | A *hint* — used for admin-UI defaults and as a documentation aid, not consulted at checkout once a real `price_lists` row exists for the resolved scope. |
| **Price list currency** | `price_lists.currency` | The actual, authoritative currency for any concrete price a customer sees. |
| **Order transaction currency** | `orders.currency` (existing, unchanged column) | Set once at order creation from the resolved price list's currency; **immutable after that** — no code path updates it post-creation, and this document doesn't introduce one. |

No field anywhere is named "base currency" after this revision — every one of the four concepts above has its own distinct name.

---

## 9. Tax strategy — UNCONFIGURED is not ZERO (Round 1 issue 3)

```
tax_strategies (
    id      UUID PK
    code    VARCHAR(30) UNIQUE   -- 'EU_VAT'|'UK_VAT'|'US_SALES_TAX'|'GST'|'ZERO'|'CUSTOM'|'EXTERNAL_PROVIDER'
    name    VARCHAR(100)
    config  JSONB DEFAULT '{}'   -- no real strategy math implemented this phase
)
```
There is deliberately **no `'UNCONFIGURED'` row** in this table. "Unconfigured" is represented by `tax_strategy_id IS NULL` on both `markets` and any `market_countries` override — the *absence* of a link, not a link to a row that means "nothing." This makes the distinction airtight: `NULL` = TechTools has never decided; a real `'ZERO'` row = TechTools deliberately decided to charge nothing. The activation checklist (§15) treats a resolved-`NULL` tax strategy as a hard blocker for `ACTIVE` + public `checkout_enabled` — a country can sit in `TESTING` indefinitely without tax being configured (internal-only access), but can never go live without it.

---

## 10. Money precision and minor units (Round 1 issue 10)

- New pricing columns (`price_list_entries.price`/`compare_at_price`) use `DECIMAL(14,4)` — four more max-value digits than the existing `DECIMAL(10,2)` (headroom for machinery/high-value equipment), and two extra decimal places (headroom for FX-derived or unusually precise figures later). This is **exact, arbitrary-precision arithmetic already** (Postgres `NUMERIC`), so no floating-point risk exists or is introduced.
- Existing monetary columns (`products.base_price`, `orders.total_amount`, `order_items.unit_price`, etc., all `DECIMAL(10,2)`) are **not touched** by this architecture. Widening them is possible later (a `NUMERIC` precision increase is itself a safe, non-lossy operation) but is a separate, independently-reviewed change — not bundled into any `GLOBAL-COMMERCE` migration group.
- **Currency minor units** (how many decimal places a currency actually uses — 2 for EUR/USD, 0 for JPY/XAF/XOF, 3 for a handful of others) is captured as a small static reference (a constant map in application code is sufficient — ISO 4217 minor-unit assignments essentially never change, so a full database table would be more ceremony than value). Used for two things: (a) display/rounding — never showing "15000.0000 XAF"; (b) the Stripe API boundary, which requires amounts as integer minor units regardless of how they're stored — `stripe.service.ts` converts using this same reference, consistently, for every currency, not just the EUR-shaped assumption it makes today.
- **Currency always travels with an amount.** `price_list_entries` sits under a `price_lists` row that owns `currency` — no monetary figure in the new schema is ever stored or passed around without an explicit, adjacent currency; nothing here reintroduces an "amount, currency assumed" pattern anywhere.

No FX conversion service is designed or implemented here (unchanged from the first draft) — `pricing_strategy = 'MANUAL'` remains the only implemented path.

---

## 11. Fulfilment vs. delivery — corrected separation (Round 1 issue 7)

**Supply strategy** (who sources the goods — `product_fulfillment_options.supply_strategy`): `OWN_STOCK | SUPPLIER_DIRECT | LOCAL_STOCK | CONSOLIDATION_HUB`. This is the *only* thing `product_fulfillment_options` decides.

**Delivery method** (how goods physically move) is resolved entirely through the *existing* `shipping_zones`/`shipping_methods`/`ShippingService` — not stored on `product_fulfillment_options` at all, and not a parallel enum. The one schema change: extend `shipping_methods.method_type`'s existing `CHECK` constraint (currently `'flat_rate','free','weight_based','price_based','carrier'`) with two more values, `'consolidated_freight'` and `'local_delivery'`, covering the two delivery concepts from your brief that don't already map onto an existing type. `'carrier'` (existing) already covers FedEx/UPS/DHL-style parcel delivery — no new concept needed there; "COURIER" as you used it maps onto the existing `'carrier'` method_type, not a new one.

```
Resolution at checkout:
  supply  = product_fulfillment_options.supply_strategy (+ location/supplier, §12)
  delivery = shipping_zones/shipping_methods, resolved independently from the
             destination country and package attributes (weight/dims/value),
             exactly as designed in the first draft's §11/§15 (unchanged) --
             the only change here is that 'strategy' no longer tries to also
             answer this question.
```

`markets.fulfilment_strategy` and `product_markets.fulfilment_strategy` (both present in the first draft) are **removed** — they were speculative and duplicated what `product_fulfillment_options.supply_strategy` now owns as the single source of truth, at the correct (product, market-or-country) grain.

---

## 12. Supplier-direct origin (Round 1 issue 8)

```
product_fulfillment_options (
    id                       UUID PK
    product_id               UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
    market_id                UUID REFERENCES markets(id)     -- nullable: a country-level override, see below
    country_id               UUID REFERENCES countries(id)   -- nullable: set when this row is country-specific
    supply_strategy          VARCHAR(30) NOT NULL  -- OWN_STOCK|SUPPLIER_DIRECT|LOCAL_STOCK|CONSOLIDATION_HUB
    fulfillment_location_id  UUID REFERENCES fulfillment_locations(id)  -- required iff supply_strategy != 'SUPPLIER_DIRECT'
    supplier_id               UUID REFERENCES suppliers(id)              -- required iff supply_strategy = 'SUPPLIER_DIRECT'
    supplier_product_id       UUID REFERENCES supplier_products(id)      -- optional, for cost/lead-time granularity
    lead_time_days            INTEGER
    is_active                 BOOLEAN DEFAULT TRUE
    CHECK (
      (supply_strategy = 'SUPPLIER_DIRECT' AND supplier_id IS NOT NULL AND fulfillment_location_id IS NULL)
      OR
      (supply_strategy != 'SUPPLIER_DIRECT' AND fulfillment_location_id IS NOT NULL AND supplier_id IS NULL)
    )
    CHECK (market_id IS NOT NULL OR country_id IS NOT NULL)  -- must target at least a market
)
```
For `SUPPLIER_DIRECT`, shipping-origin resolution uses `suppliers.country_code` (already exists, per the original supplier audit) — never a fake location. `fulfillment_locations` is reserved for company-controlled/known physical points (`OWN_STOCK`, `LOCAL_STOCK`, `CONSOLIDATION_HUB`); it is never used to represent "wherever the supplier happens to be," which was the flaw in the first draft's single global `SUPPLIER-DIRECT` row. No duplication of `suppliers`/`supplier_products` data — this table only references them.

---

## 13. Address architecture — corrected postal-code plan (Round 1 issue 9)

Unchanged additive columns on `user_addresses` (region/district/quarter/landmark/delivery_instructions/lat-lng — see the original §12 content, still valid). **What changed:** the plan to synthesize placeholder postal codes is removed entirely. Instead:

```sql
ALTER TABLE user_addresses ALTER COLUMN postal_code DROP NOT NULL;
```
This is a constraint *relaxation*, not a tightening — every existing row already has a non-null value, so this statement cannot invalidate any existing data; it simply stops requiring the column going forward. No staging is needed at the database level for this specific change.

What genuinely does need to land in careful order: **application-level validation** (the Joi schema currently unconditionally requiring `postalCode`, per the original audit) must become country-aware (`countries.postal_code_required`) *no later than* the column relaxation ships — otherwise a relaxed column with unchanged validation code accomplishes nothing (the app still rejects the empty value before it ever reaches the database). For any country not yet present in `countries` (edge case during rollout), the default is to keep requiring a postal code — matching current behavior, never silently relaxing validation for a country nobody has explicitly reviewed.

---

## 14. Ownership matrix (Round 1 issue 14 — new)

| Setting | Owner | Notes |
|---|---|---|
| Accounting currency | **Platform** (`platform_settings`) | Single row, internal only |
| Default/display currency hint | **Market** (`markets.default_currency`) | Not authoritative once a price list exists |
| Actual price + currency | **Price list** (`price_lists`/`price_list_entries`) | Scoped to market or country, never to product directly |
| Tax strategy | **Market** default, **Country** override | `market_countries.tax_strategy_id` inherits `markets.tax_strategy_id` when `NULL` |
| Duties policy | **Market** default, **Country** override | Same inheritance pattern |
| `checkout_enabled` | **Country** only | Never market-relative — a market can be `ACTIVE` while one of its countries individually isn't |
| Address rules / postal code requirement | **Country** only | `countries.address_rules`/`postal_code_required` |
| Payment methods | **Market** (`market_payment_methods`) | No country-level override built yet — deferred until real need appears, not spec'd speculatively |
| Availability / visible / sellable / qty limits | **Product-Market** (`product_markets`) | Market grain; a country-level override isn't designed yet (no evidence it's needed beyond price, which §7 already handles separately) |
| Supply strategy / fulfilment routing | **Product-Fulfilment-Option** (`product_fulfillment_options`) | Market or country grain, per row |
| Lead time | **Product-Fulfilment-Option** | Overrides any market-level hint |
| Inventory | **Fulfilment Location** | Existing `inventory` table, untouched this phase (§17 of the original draft, unchanged) |
| Manager scope | **Staff membership** | `market_scope TEXT[]` today; future `staff_market_scopes` (§19) |
| What was actually true at purchase | **Order** (`order_items`, existing) + **Order commerce snapshot** (new, §16) | Never touched by later configuration changes |

---

## 15. Checkout eligibility algorithm (revised)

```
function checkEligibility(destinationCountryId, productId, quantity, requestedPaymentMethod):

  country = countries.get(destinationCountryId)
  if country.status != 'ACTIVE' and not staffTestingOverride:
      return INELIGIBLE("Country not active")
  if not country.checkout_enabled:
      return INELIGIBLE("Checkout not enabled for this destination")

  marketCountry = market_countries.current(destinationCountryId)   -- effective_to IS NULL, §6
  if marketCountry is null:
      return INELIGIBLE("No market resolved for this country")
  market = markets.get(marketCountry.market_id)
  if market.status not in ('ACTIVE','TESTING'):
      return INELIGIBLE("Market not operational")

  priceList = price_lists.forCountry(destinationCountryId) ?? price_lists.forMarket(market.id)
  entry = priceList ? price_list_entries.find(priceList.id, productId) : null
  if entry is null:
      return INELIGIBLE("Product not priced in this market")

  pm = product_markets.get(productId, market.id)
  if pm is null or not pm.sellable:
      return INELIGIBLE("Product not sellable in this market")
  if quantity < pm.min_order_quantity or (pm.max_order_quantity and quantity > pm.max_order_quantity):
      return INELIGIBLE("Quantity outside allowed range")

  fulfilment = product_fulfillment_options.findActive(productId, market.id, destinationCountryId)
  if fulfilment is empty:
      return INELIGIBLE("No fulfilment route available")

  deliveryOption = resolveShippingMethod(country, fulfilment)   -- existing shipping_zones/shipping_methods, §11
  if deliveryOption is null:
      return INELIGIBLE("No delivery option available")

  paymentOption = market_payment_methods.findActive(market.id, requestedPaymentMethod)
  if paymentOption is null:
      return INELIGIBLE("Payment method not available in this market")

  resolvedTax = marketCountry.tax_strategy_id ?? market.tax_strategy_id
  if resolvedTax is null:
      return INELIGIBLE("Tax not configured for this destination")   -- should be unreachable if activation checklist (§15) was enforced, but checked again here as a hard runtime guarantee, not just an admin-time one

  addressCheck = validateAddress(submittedAddress, country.address_rules, country.postal_code_required)
  if not addressCheck.valid:
      return INELIGIBLE(addressCheck.reason)

  resolvedDuties = marketCountry.duties_policy ?? market.duties_policy

  return ELIGIBLE(market, entry.price, entry.currency, deliveryOption, paymentOption, resolvedTax, resolvedDuties)
```

On `ELIGIBLE`, at the same point the existing checkout-session logic already commits an order (the LAUNCH-FOUNDATION-1 checkout-safety choke point), the resolved values above are written into `order_commerce_snapshots` (§16) — once, at creation, never again.

---

## 16. Order commerce snapshot (Round 1 issue 6 — new, mandatory)

**Chosen design: hybrid, via a new 1:1 side table** — not explicit columns bolted onto the high-traffic `orders` table (would grow a core table with many rarely-queried fields), not a bare JSONB blob with no typed/indexable fields (hard to report on), not a fully normalized multi-table breakdown (overengineered for what's actually needed).

```
order_commerce_snapshots (
    id                    UUID PK
    order_id              UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE
    destination_country_id UUID REFERENCES countries(id) ON DELETE SET NULL
    market_id              UUID REFERENCES markets(id) ON DELETE SET NULL
    price_list_id           UUID REFERENCES price_lists(id) ON DELETE SET NULL
    tax_strategy_id         UUID REFERENCES tax_strategies(id) ON DELETE SET NULL
    duties_policy           VARCHAR(30)
    pricing_strategy        VARCHAR(30)
    fx_rate_used             DECIMAL(14,8)         -- NULL under MANUAL pricing (the only implemented strategy today)
    details                  JSONB DEFAULT '{}'    -- per-line resolved price_list_entry ids, resolved fulfilment routes, etc. -- anything not worth its own column
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
    -- no updated_at -- this row is written once and never updated, by convention;
    -- optionally hardened later with a DB rule/trigger rejecting UPDATE, not required for the design
)
```

**Why every FK uses `ON DELETE SET NULL`, never `CASCADE` or a hard requirement:** if a `market`/`country`/`tax_strategy` row is ever deleted years later, the *order* must still be readable — losing the FK's live join target should degrade the snapshot's drill-down convenience, never the order's own validity. `order_id` is the only FK that cascades (deleting an order legitimately removes its snapshot).

**Why 1:1 side table, not columns on `orders`:** old orders (everything before this architecture exists) simply have **no row** in this table — a `LEFT JOIN` returns nothing extra for them, which is the correct, honest representation of "this order predates market-aware commerce," distinct from "this order has a snapshot but some fields happen to be unknown." `orders` itself is never altered by this design.

**What this table does *not* duplicate:** line-item unit prices, product names, SKUs, and tax rates are already correctly snapshotted per-line on the existing `order_items` table (confirmed present: `unit_price`, `product_name`, `sku`, `tax_rate`, all captured at insert time) — this table captures the *surrounding* commercial context that currently has no home anywhere: which market/price-list/tax-strategy/duties-policy/FX-rate the order was placed under.

---

## 17. Warehouse / inventory integration

Unchanged from the first draft (§13 there) — `inventory.warehouse_location` stays free-text; a nullable `fulfillment_location_id` FK is proposed as a later, optional addition. Nothing in this revision touches the LAUNCH-FOUNDATION-1 inventory fixes.

---

## 18. Analytics, advertising-attribution readiness, backwards compatibility

Unchanged from the first draft (original §22/§23/§24) except: `order_commerce_snapshots.market_id`/`destination_country_id` are now available as join keys for market-scoped analytics, in addition to `user_sessions.country_code`, giving order-stage reporting a second, order-anchored path to the same breakdowns.

---

## 19. Staff scope future normalization (Round 1 issue 12)

`041_staff_memberships.sql` is **unchanged** — `market_scope TEXT[]` ships exactly as already designed, per your explicit instruction. The future path, once `countries`/`markets` exist, now explicitly supports both grains rather than country-codes-only:

```
staff_market_scopes (
    id                   UUID PK
    staff_membership_id  UUID NOT NULL REFERENCES staff_memberships(id) ON DELETE CASCADE
    scope_type           VARCHAR(10) NOT NULL CHECK (scope_type IN ('COUNTRY','MARKET'))
    country_id           UUID REFERENCES countries(id)
    market_id            UUID REFERENCES markets(id)
    CHECK ((scope_type = 'COUNTRY' AND country_id IS NOT NULL AND market_id IS NULL)
        OR (scope_type = 'MARKET' AND market_id IS NOT NULL AND country_id IS NULL))
)
```
A membership can hold multiple rows. `applyMarketScope()` resolves the *effective* country set by unioning: every `country_id` referenced directly, plus every country currently in any referenced `market_id` (via `market_countries`, §6). This makes every example from your brief a single row: `EU Operations Manager` → one `MARKET` row (`EU`); `Cameroon Manager` → one `COUNTRY` row (`CM`); a future `West Africa Manager` → three `COUNTRY` rows (or, once a "West Africa" market exists, one `MARKET` row); `Owner` → zero rows, treated as global by the existing role check, not by an empty-scope special case. **Not built this phase** — this is the documented migration path for whenever `countries`/`markets` land, backfilling from the existing `TEXT[]` by joining on `iso_alpha2`, with the `TEXT[]` column kept in place, deprecated, until every read path has moved over.

---

## 20. Historical configuration (Round 1 issue 13 — new)

General rule, stated once, applying uniformly to every kind of change below: **configuration tables (`countries`, `markets`, `market_countries`, `price_lists`/`price_list_entries`, `tax_strategies`, `market_payment_methods`, `shipping_zones`/`shipping_methods`, `fulfillment_locations`, `product_fulfillment_options`) represent current/future state and may change freely at any time. `order_items` (existing) and `order_commerce_snapshots` (new, §16) represent what was true at the moment of purchase and are never updated by a later configuration change** — the snapshot's FKs (all `ON DELETE SET NULL`) are for traceability/drill-down convenience, never the sole record of what an order says.

| Change | What happens |
|---|---|
| Country changes market | `market_countries`: old row gets `effective_to = now()`, new row inserted. Past orders' snapshots already captured the old `market_id` — unaffected. |
| Market/price-list currency changes | A new `price_lists` row (or a new `price_list_entries.price`) takes effect for *future* checkouts only. Past orders' `orders.currency`/snapshot `price_list_id` are untouched. |
| Product price changes | New `price_list_entries.price` value. `order_items.unit_price` on every existing order already has its own historical value — unaffected, no migration needed. |
| Shipping rules change | `shipping_methods`/`shipping_zones` updated for future resolution. `orders.shipping_amount` (existing column) on past orders is untouched. |
| Payment method disabled | `market_payment_methods.is_active = false` — stops being offered going forward. `orders.payment_method` (existing) on past orders is untouched. |
| Tax strategy changes | New `market_countries`/`markets.tax_strategy_id`. `orders.tax_amount` (existing) and the snapshot's `tax_strategy_id` on past orders are untouched. |
| Duties policy changes | Same pattern — snapshot captured it at order time. |
| Fulfilment location closes | `fulfillment_locations.is_active = false` — excluded from future `product_fulfillment_options` resolution. Past orders' snapshot still references the (now-inactive) location for audit purposes, via `ON DELETE SET NULL`, never a hard failure. |

---

## 21. Activation validation (Round 1 issue 11 — new)

A server-side check, not an admin checklist someone has to remember, enforced at the exact API call that would set `countries.status = 'ACTIVE'` **and** `checkout_enabled = true` together:

```
function validateCountryForActivation(countryId):
  checks = {}
  marketCountry = market_countries.current(countryId)
  checks.market_resolved = marketCountry != null
  if not checks.market_resolved: return { ready: false, checks }

  market = markets.get(marketCountry.market_id)
  resolvedTax = marketCountry.tax_strategy_id ?? market.tax_strategy_id
  checks.tax_configured = resolvedTax != null                                    -- Round 1 issue 3, enforced here
  checks.currency_configured = (price_lists.forCountry(countryId) ?? price_lists.forMarket(market.id)) != null
  checks.payment_method_configured = market_payment_methods.existsActive(market.id)
  checks.shipping_method_configured = shippingZonesCover(countryId)
  checks.fulfilment_route_exists = existsAnyActive(product_fulfillment_options, market.id, countryId)
  checks.address_validation_configured = countryHasExplicitAddressConfig(countryId)  -- not just the default
  checks.duties_policy_configured = (marketCountry.duties_policy ?? market.duties_policy) != null
  checks.no_manual_block = not countries.get(countryId).operational_block_flag       -- simple admin override escape hatch

  return { ready: all(checks.values()), checks }
```
Surfaced in the admin International Control Center's country page as a literal checklist widget (green/red per item) **and** enforced server-side on the activation endpoint — a `PATCH` attempting `status='ACTIVE', checkout_enabled=true` while any check fails is rejected with the specific failing reasons, not silently accepted. A country can freely sit in `TESTING` with some checks failing (internal/staff access only); it cannot reach public `ACTIVE` + `checkout_enabled` that way.

---

## 22. Security / privacy considerations

Unchanged from the first draft (original §29), plus: `order_commerce_snapshots` carries no new PII beyond what `orders`/`user_addresses` already hold (it references configuration rows by ID, not raw customer data), so no new sensitive-data-handling question is introduced by this table.

---

## 23. Revised migration sequence

Numbers remain **placeholders**, re-confirmed against `schema_migrations` immediately before each group is actually written, per your standing instruction. Sequenced by dependency, assuming `040`/`041` land first:

- **GLOBAL-COMMERCE-1A** — `regions`, `countries`, `platform_settings`, `markets`, `market_countries` (with the partial unique index from day one, not retrofitted). Seed `countries` from static ISO 3166 data; seed zero `markets` initially.
- **GLOBAL-COMMERCE-1B** — `tax_strategies`, `price_lists`, `price_list_entries`. Depends on `markets`/`countries`.
- **GLOBAL-COMMERCE-1C** *(new, split out from the original 1B)* — `product_markets` (availability grain only now — no pricing columns, per §7) and `order_commerce_snapshots` (§16). The snapshot table has no dependency on fulfilment/shipping tables, so it can land as soon as `markets`/`price_lists` exist, ahead of the fulfilment work below.
- **GLOBAL-COMMERCE-2** — `user_addresses` gains `country_id`/`region`/`district`/`quarter`/`landmark`/`delivery_instructions`/lat-lng (nullable), **and** `postal_code` loses its `NOT NULL` in the same migration as the application validation change ships (§13) — not before, not after, to avoid a window where the column is optional but the API still rejects omitting it (harmless but confusing) or vice versa (a real regression). Checkout-eligibility function (§15) implemented in application code alongside this.
- **GLOBAL-COMMERCE-3** — `fulfillment_locations`, `product_fulfillment_options` (with the `supply_strategy`/origin-source `CHECK` constraint from §12 from day one), `shipping_zones.market_id` (nullable addition), `shipping_methods.method_type` CHECK extended with `'consolidated_freight'`/`'local_delivery'`. `inventory.fulfillment_location_id` (nullable) only once real location data exists.
- **GLOBAL-COMMERCE-4** — `market_payment_methods`. `fx_rates` only if/when `BASE_CONVERTED` pricing is actually needed (may never be required).
- **Later, unnumbered** — `freight_shipments`/`freight_shipment_items` (unchanged from the first draft, still explicitly deferred to a real freight pilot); future `staff_market_scopes` (§19, unchanged, still not this phase).

Every group remains additive-only: new tables, nullable new columns, or a `NOT NULL`→nullable relaxation (never the reverse) on an existing column. None require a data backfill to remain valid.

---

## 24. Test strategy (updated)

All items from the first draft still apply (§27 there), plus, specific to this revision:
- **Market resolution determinism**: attempting to insert a second `market_countries` row for the same country with `effective_to IS NULL` must fail at the database level (partial unique index) — test this as a hard constraint, not just an application-level check.
- **Price list resolution order**: a country-scoped price list must always win over its market's price list when both exist for the same product; falling through to "not sellable" when neither exists must never silently show a price from an unrelated market.
- **Order snapshot immutability**: writing a snapshot at order creation, then asserting no code path anywhere updates that row afterward (a repo-wide grep for `UPDATE order_commerce_snapshots` finding zero application call sites is itself a valid regression test).
- **Activation checklist**: each of the eight checks individually forced to fail, confirming the activation endpoint rejects with that specific reason, and confirming a country can still be saved as `TESTING` with checks failing.
- **Regression, unchanged**: every existing order/product/checkout test continues to pass unmodified.

---

## 25. Rollback strategy

Unchanged principle from the first draft — every table here is new and additive, `DROP TABLE IF EXISTS` in reverse dependency order rolls back any group cleanly. The one addition this revision introduces: `ALTER TABLE user_addresses ALTER COLUMN postal_code DROP NOT NULL` rolls back with `ALTER TABLE user_addresses ALTER COLUMN postal_code SET NOT NULL` — **but only safely if every row still has a non-null value at rollback time**, which won't be true forever once countries with `postal_code_required=false` start accepting real orders without one. Recommendation: treat that specific column relaxation as a one-way door in practice (safe to roll back the *application validation* change immediately; the column constraint itself should only be reapplied if you're certain no null-postal-code row has been written yet) — flagged explicitly here so it isn't assumed symmetric with every other rollback in this document.

---

## 26. Rollout strategy

Unchanged from the first draft (§26 there) — Wave 1 (existing EU footprint) through the African/Asia pilots, still an initial proposal only, still not something the architecture depends on in a fixed order.

---

## 27. Risks / open founder decisions (revised)

Carried forward from the first draft, minus what this revision resolved (the EU-currency question, the tax-default question, and the market-determinism question are no longer open — they're designed above), plus what's newly surfaced:

1. **Currency display strategy** (unchanged) — `MANUAL` vs. `BASE_CONVERTED` timing; still recommend starting `MANUAL`-only.
2. **Tax strategy ownership** (unchanged) — real VAT/sales-tax math is a compliance question needing accounting/legal input before any strategy beyond `ZERO` goes live for a real `ACTIVE` market.
3. **Consolidated freight timing** (unchanged) — could the Cameroon pilot launch on `COURIER`/`SUPPLIER_DIRECT` alone first, deferring `CONSOLIDATION_HUB` volume until it's justified?
4. **New: does `product_markets` ever need a country-level override, not just market-level?** This revision kept availability/visibility at the market grain only (no evidence of a concrete need for finer granularity yet, per the ownership matrix in §14) — if a real case shows up (a product legal in Germany but restricted in France, both `EU` market), the same override pattern already used for tax/duties on `market_countries` generalizes directly to a `product_country_overrides` sparse table; not designed in full here since no concrete requirement exists yet.
5. **New: `market_payment_methods` country-level override** — deferred (§14) for the same reason as #4; the pattern to add it later is identical if/when a real need appears.
6. **Mobile money timing** (unchanged) — a founder call tied to the Cameroon pilot's actual payment-method needs, not an architecture question.

---

## Hardcoded assumptions this architecture is intended to eventually replace

Unchanged from the first draft, still accurate:

- `order.controller.ts`: `const taxRate = 0.08` → `tax_strategies`, resolved per market/country, `NULL`-checked at activation.
- `order.controller.ts`: `totalAmount >= 50 ? 0 : 5.99` → `shipping_zones`/`shipping_methods`, finally wired to checkout.
- `order.controller.ts`/`stripe.service.ts`: `'EUR'` hardcoded → resolved `price_lists.currency` per destination.
- `user_addresses.postal_code NOT NULL` enforced unconditionally → `countries.postal_code_required`-driven, column relaxed (§13).
- `payment.controller.ts`: implicit "Stripe is the only payment method" → `market_payment_methods`-driven.
- Web/mobile checkout: `country || 'US'` fallback patterns → resolved market/country required, not defaulted.
- `products` treated as globally sellable the instant `is_active=true` → `product_markets.sellable` is the real per-market gate, default closed.

---

## Status

**READY FOR GLOBAL-COMMERCE-1A** — all thirteen Round 1 issues are resolved in this design (not merely acknowledged); none of the three remaining open founder decisions (§27: FX-strategy timing, tax-law ownership, consolidated-freight timing) block starting `1A` (`regions`/`countries`/`platform_settings`/`markets`/`market_countries`), since that group depends on none of them.

Still explicitly contingent on `040` (analytics-alerts repair) and `041` (staff_memberships) landing first, per your standing migration-sequencing instruction — this revision does not change that ordering, and no migration number in §23 is final until re-checked against `schema_migrations` at implementation time.
