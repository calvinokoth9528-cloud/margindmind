# MarginMind — The Definitive Guide

*A complete guide to understanding, using, and building the e-commerce profit analytics platform.*

**Live app:** https://margindmind.vercel.app · Demo login: `demo@margindmind.com` / `password123`

---

## Table of Contents

**Part I — For Users (how to run your business with MarginMind)**

1. [Why True Profit Matters](#1-why-true-profit-matters)
2. [Getting Started](#2-getting-started)
3. [Connecting Your Stores](#3-connecting-your-stores)
4. [Importing Orders from CSV](#4-importing-orders-from-csv)
5. [Understanding the Dashboard](#5-understanding-the-dashboard)
6. [Money In, Money Out: The Profit Formula](#6-money-in-money-out-the-profit-formula)
7. [Payment Provider Fees](#7-payment-provider-fees)
8. [Taxes: VAT and Sales Tax](#8-taxes-vat-and-sales-tax)
9. [Refunds and Returns](#9-refunds-and-returns)
10. [Ad Spend: Meta and Google Ads](#10-ad-spend-meta-and-google-ads)
11. [Multi-Currency Selling](#11-multi-currency-selling)
12. [Exporting Your Data](#12-exporting-your-data)

**Part II — For Builders (how it works inside)**

13. [Architecture Overview](#13-architecture-overview)
14. [Data Model](#14-data-model)
15. [The Profit Engine](#15-the-profit-engine)
16. [API Reference](#16-api-reference)
17. [Authentication and Security](#17-authentication-and-security)
18. [Deployment Guide](#18-deployment-guide)
19. [Testing](#19-testing)
20. [Roadmap](#20-roadmap)

---

# Part I — For Users

---

## 1. Why True Profit Matters

Your store dashboard says you made $40,000 this month. Sounds great. But how much of that is actually *yours*?

Revenue is not profit. Between the sale landing in your bank account and the money being truly yours, a lot of hands reach into the jar:

| Cost | Typical size | Where it hides |
|---|---|---|
| **Product cost (COGS)** | 20–60% of revenue | Your supplier invoices |
| **Shipping** | 5–15% | Carrier bills, fulfillment fees |
| **Payment processing** | 2–4% + $0.30/order | Buried in payout statements |
| **Taxes (VAT/sales tax)** | 0–27% *of revenue* | Collected from customers, owed to governments |
| **Ad spend** | 10–40% (or much more) | Meta/Google Ads dashboards, separate from sales data |

A store doing $40k/month with 45% product cost, 8% shipping, 3% fees, 7% tax, and 20% ad spend keeps:

```
$40,000 − $18,000 − $3,200 − $1,200 − $2,800 − $8,000 = $6,800  (17% margin)
```

That $40k "revenue" business is really a $6,800/month business. MarginMind's job is to make that number — and every order's contribution to it — visible and accurate.

**The core idea:** every order is recorded with *all* of its costs. Profit is computed per order, then rolled up into days, products, and periods. When any cost assumption changes (you switch payment processors, raise a product cost, refund an order), history is recalculated so your margins always reflect reality.

---

## 2. Getting Started

### Sign up

1. Go to **https://margindmind.vercel.app** and click **Sign Up**.
2. Enter your name, email, and a password (stored hashed with bcrypt — nobody, including us, can read it).
3. You land on the dashboard, empty and ready for your first store.

Or explore with the demo account: `demo@margindmind.com` / `password123` — it comes loaded with 30 days of sample orders, refunds, and tax data.

### The layout

- **Dashboard** — KPIs, trends, top products, break-even and projections
- **Orders** — every order with full cost breakdown, refund actions, export
- **Products** — per-product profitability; edit product costs here
- **Stores** — connect stores, import CSVs, configure fees/currency/tax per store
- **Settings** — account and notification preferences

---

## 3. Connecting Your Stores

### Shopify (OAuth)

1. **Stores → Add Store.**
2. Enter your store URL (`your-store.myshopify.com`) and pick the store's **country** — this sets the currency and sensible fee/tax defaults automatically.
3. You're redirected to Shopify to authorize read access (`read_orders`, `read_products`), then bounced back to MarginMind.
4. Click **Sync** any time to pull new orders and products since the last sync.

Behind the scenes the OAuth flow uses a signed state cookie (CSRF protection), and your access token is stored against *your* account only.

> **Note on product costs:** Shopify's public product API doesn't expose what *you* pay for your products. Imported products start at cost $0 — set real costs on the **Products** page and every affected historical order is recalculated instantly.

### CSV import (any platform)

No API access? Selling on Etsy, Amazon, WooCommerce, or a spreadsheet? The CSV importer accepts both the MarginMind template and Shopify order exports as-is — columns are auto-detected with loose name matching (`Order ID`, `order_id`, and `orderid` all work). See [section 4](#4-importing-orders-from-csv).

---

## 4. Importing Orders from CSV

**Stores → Import CSV**, then:

1. **Name** the store (e.g. "My Etsy Shop").
2. Pick **country, currency, and payment provider** — choosing a country auto-fills the currency and suggests a region-appropriate provider (Germany → iDEAL, Belgium → Bancontact). All three can be overridden.
3. Upload a `.csv` up to 5 MB / 10,000 rows.
4. Review the result: orders created/updated, rows skipped (with reasons).

### What the importer understands

| Column | Accepted names (examples) |
|---|---|
| Order ID | `Order ID`, `Name`, `Order` |
| Date | `Paid at`, `Created at`, `Order Date`, `Date` |
| Status | `Financial Status`, `Status` |
| Product | `Lineitem name`, `Product Title`, `Title` |
| SKU | `Lineitem SKU`, `SKU` |
| Quantity | `Lineitem quantity`, `Qty`, `Units` |
| Unit price | `Lineitem price`, `Unit Price`, `Price` |
| Unit cost | `Cost`, `Unit Cost`, `COGS`, `Landed Cost` |
| Shipping | `Shipping`, `Total Shipping` |
| Ad spend | `Ad Spend`, `Advertising`, `Marketing Spend` |
| Order total | `Total`, `Total Revenue`, `Order Total` |

**Multi-line orders** (Shopify repeats an order once per line item) are grouped back into a single order, with the total counted once.

**Dates:** US `M/D/Y` by default; EU `D/M/Y` is auto-detected when unambiguous (e.g. `31/12/2026`). ISO dates always work. Unparseable dates are reported and skipped, never guessed.

**Fees:** the fee shown on imported orders comes from the payment provider you picked in step 2 — not a hardcoded rate. Re-importing the same file updates existing orders by ID.

---

## 5. Understanding the Dashboard

### KPI cards

- **Total Revenue** — gross order revenue in the period
- **Net Profit** — what's left after *all* costs (product, shipping, fees, tax, ads)
- **Average Order Value** — revenue ÷ orders
- **Total Orders** — count

Each card compares against the **equally-sized window immediately before** the selected one. "vs prev. 30d" on a 30-day view means the previous 30 days. No baseline data → no misleading percentage.

### Filters

- **Period presets:** 7/30/90/365 days
- **Calendar button:** any custom from/to range — the comparison still uses the preceding window of the same length
- **Store picker** (appears with 2+ stores): isolate one store's metrics, currency, and fee profile

### Trend and activity charts

Daily revenue/profit line and orders bar. Refunded orders are excluded from trends (see [section 9](#9-refunds-and-returns)).

### Tax & refunds summary

Shown when the period contains tax or refunds: estimated tax collected, and refund totals with counts.

### Top products

Ranked by *profit*, not revenue — computed from order line items, so it reflects real contribution after costs.

### Break-even and projections

Enter fixed monthly costs (rent, tools, salaries) and the calculator shows the revenue needed to break even at your current margin. The projection line compounds your current profit at a growth rate you control.

---

## 6. Money In, Money Out: The Profit Formula

Every order in MarginMind stores its full cost breakdown:

```
netProfit = revenue
          − productCost      (COGS for the items sold)
          − shippingCost     (what shipping cost YOU, or what you charged if bundled)
          − transactionFee   (from your payment provider's profile)
          − taxAmount        (VAT/sales tax on the revenue)
          − adSpend          (your attributed share of the day's ad spend)
```

`profitMargin = netProfit / revenue × 100`

Because every component is stored per order — not just the final number — MarginMind can answer questions like "what happens to last quarter's profit if I switch from Shopify Payments to PayPal?" by recomputing only the fee line across history.

### Why tax is subtracted

VAT and sales tax are collected from customers but owed to tax authorities — while you hold it, it isn't yours. Subtracting it shows the profit that's genuinely yours to keep. (MarginMind computes an *estimate* for planning; your accountant does the real thing.)

---

## 7. Payment Provider Fees

Every store has a **payment provider profile** that determines the fee on each order: a percentage plus a fixed amount per transaction.

### Built-in profiles

| Provider | Percent | Fixed | Typical market |
|---|---|---|---|
| Shopify Payments | 2.9% | $0.30 | US/CA/UK/AU Shopify stores |
| Stripe | 2.9% | $0.30 | Global, direct integrations |
| PayPal | 3.49% | $0.49 | Cross-border, consumer-heavy stores |
| Square | 2.9% | $0.30 | Omnichannel US |
| Klarna | 3.29% | $0.30 | BNPL-heavy checkouts (EU/US) |
| iDEAL | 0% | €0.29 | Netherlands |
| Bancontact | 0% | €0.30 | Belgium |
| SEPA Direct Debit | 0% | €0.35 | Eurozone bank transfers |
| **M-Pesa** | 1.5% | 1 | Kenya, Tanzania, DR Congo, South Sudan |
| **MTN MoMo** | 1.5% | 1 | Uganda, Rwanda, DR Congo |
| **telebirr** | 0.5% | 0.5 | Ethiopia |
| **Flutterwave** | 2.8% | $0.30 | Pan-African card/mobile aggregator |
| No processing | 0% | 0 | Manual/offline payments |
| Other / custom | 2.9% | $0.30 | Anything else |

### Changing a store's provider

**Stores → pencil icon → Payment provider → Save.** Two things happen:

1. The store's profile is updated.
2. **Every historical order is recalculated** with the new fee — so the question "what would margins have looked like on PayPal?" is answered with real numbers in seconds.

### Custom rates

Using a processor we don't list (Paddle, Adyen, Mollie, local gateways)? Tick **"Use custom fee rate"** in the store editor and enter your exact percent + fixed fee. Custom values always override the preset.

A useful rule of thumb when comparing providers on a $30 average order:

```
Shopify Payments: 30 × 0.029 + 0.30 = $1.17  (3.90%)
PayPal:           30 × 0.0349 + 0.49 = $1.54  (5.13%)
iDEAL:                                 $0.29  (0.97%)
```

---

## 8. Taxes: VAT and Sales Tax

### Where the rate comes from

Each store's tax rate resolves in this order:

1. **Shop-level override** — an exact rate you set in the store editor (e.g. your registered state/nation rate)
2. **Country default** — MarginMind's built-in standard rates
3. **US 7%** — fallback if the country is unknown

### Built-in country defaults

| Country | Rate | | Country | Rate |
|---|---|---|---|---|
| Germany | 19% | | Australia | 10% |
| UK | 20% | | Japan | 10% |
| France | 20% | | Singapore | 9% |
| Netherlands | 21% | | Sweden | 25% |
| Spain | 21% | | Denmark | 25% |
| Italy | 22% | | Norway | 25% |
| Ireland | 23% | | Poland | 23% |
| Belgium | 21% | | Mexico | 16% |
| Switzerland | 8.1% | | Brazil | 17% |
| Canada | 13% | | India | 18% |
| USA | 7% (est.) | | New Zealand | 15% |
| **Kenya** | 16% | | **Ethiopia** | 15% |
| **Tanzania** | 18% | | **Uganda** | 18% |
| **Rwanda** | 18% | | **DR Congo** | 16% |
| **Burundi** | 18% | | **Djibouti** | 10% |
| **South Sudan** | 18% | | **Somalia** | 5% |

*US rates vary 0–10% by state; 7% is a planning default — set your exact rate in the store editor.*

### What gets taxed

The rate applies to **order revenue**. The collected tax shows as a summary card on the dashboard and a per-order line in exports.

### Changing rates

Edit the tax rate in the store editor and save — historical orders are recalculated with the new rate (alongside any fee change). Useful when you register for VAT, cross a threshold, or want to model "what if" scenarios.

---

## 9. Refunds and Returns

Refunded sales must not count as profitable sales — and pretending otherwise is one of the most common ways sellers overestimate their business.

### Recording a refund

**Orders → Refund** on any order:

- **Full refund** (default): reverses all revenue
- **Partial refund**: enter any amount up to the order total (a 20% "keep the sale" gesture on a defective item, for example)
- **Reason**: recorded for later analysis

### The accounting logic

When you refund, MarginMind assumes the realistic outcome:

- **Revenue is reversed** — you gave the money back
- **Costs are NOT recovered** — the product was already made and shipped, the gateway kept its fee, the tax may already be reported, and the ad spend already happened

So a fully refunded $100 order that cost you $45 in product, $3.20 in fees, $7 tax and $5 ads shows as **−$60.20**, not $0. That's the real hit.

### Where refunds show up

- **Orders table:** status pill turns red (`refunded`), with an **Undo** action if you made a mistake
- **Dashboard trends:** refunded orders are **excluded** from revenue/profit trends — trends show the health of sales you kept
- **Refund summary card:** totals and counts, so the damage is always visible
- **CSV export:** refund amount as its own column

### Undo

Refunded in error? **Orders → Undo** restores the order to its pre-refund state with profit recalculated.

---

## 10. Ad Spend: Meta and Google Ads

Ad platforms report spend in *their* dashboards; your store reports sales. MarginMind joins the two by day.

### Importing

1. **Stores → Ad Spend** (top right).
2. Choose the store.
3. Upload a daily-spend CSV:
   - **Meta Ads:** export with `Day` + `Amount spent` columns — works as-is
   - **Google Ads:** export with `Day` + `Cost` columns — works as-is
   - **Generic:** `Date, Amount, Platform` (see the sample template in the modal)
4. Confirm — MarginMind reports days imported and orders updated.

### How daily spend becomes per-order spend

Each day's total is **split evenly across that day's orders** for the store:

```
Day total: $120 across 4 orders → $30 attributed per order
```

Every affected order's profit is recalculated with its share included. It's an allocation, not attribution (no click-level tracking) — but it answers the crucial question: *"after ads, is this business actually profitable?"*

Re-importing a period **overwrites** the previous allocation, so corrections are easy. Days with spend but no orders aren't lost — they're visible in the platform's own reporting and roll into the day's totals.

---

## 11. Multi-Currency Selling

### Per-store currency

Each store declares its **country and currency** (26 currencies supported — USD, EUR, GBP, JPY, the East African shillings/francs (KES, TZS, UGX, RWF, ETB, BIF, SSP, SOS, DJF, CDF), and more). Country selection sets the default; both are editable.

### What currency do dashboards show?

With multiple stores, pages display amounts in the **most common currency across your stores** and all formatting (symbols, separators) follows that currency via native internationalization.

**Honest limitation:** multi-currency totals are shown in one display currency without FX conversion — amounts are displayed as recorded, in the shop's own denominations. If you sell in EUR and USD, pick the store filter to view each store's true numbers in isolation. Per-order FX conversion is on the [roadmap](#20-roadmap).

### Setting it up

- **New CSV import:** pick country/currency in the import modal
- **New Shopify connection:** pick country in the connect modal
- **Existing store:** Stores → pencil icon

---

## 12. Exporting Your Data

**Orders → Export** downloads the current view as CSV, honoring every filter you've set (store, date range):

### Orders export columns

`Order Number, Order Date, Status, Store, Revenue, Product Cost, Shipping, Transaction Fee, Tax, Ad Spend, Refund Amount, Net Profit, Margin %`

### Products export columns

`Title, SKU, Store, Price, Cost, Units Sold, Revenue, Profit, Margin %`

The export is yours to drop into a spreadsheet, hand to your accountant, or archive. The API endpoint (`/api/export/csv`) works with any HTTP client too — see [section 16](#16-api-reference).

---

# Part II — For Builders

---

## 13. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 16 App Router (React 19, TypeScript)           │
│                                                         │
│  app/                      components/                  │
│    page.tsx (landing)        ConnectStoreModal          │
│    dashboard/orders/…        ImportCsvModal             │
│    stores/products/…         AdSpendModal               │
│    api/… (route handlers)    SessionProvider            │
│                                                         │
│  lib/                                                   │
│    fees.ts      fee profiles, currencies, countries, tax│
│    profit.ts    profit math, aggregation, refunds        │
│    shopify.ts   Admin API client, transforms            │
│    csv.ts       dependency-free CSV parse/serialize     │
│    import.ts    column mapping, order grouping          │
│    ads.ts       ad-spend parsing + backfill             │
│    stripe.ts    subscription plans                      │
│    auth.ts/db.ts  NextAuth / Prisma singleton           │
└──────────────────────┬──────────────────────────────────┘
                       │ Prisma
                ┌──────▼──────┐
                │  PostgreSQL  │  (Neon serverless)
                └─────────────┘
```

**Key decision:** all profit math lives in pure functions in `lib/profit.ts` and `lib/fees.ts` — no database, no framework, no I/O. They run identically in Node, serverless functions, and unit tests. The API routes orchestrate; the libs compute.

---

## 14. Data Model

```prisma
User            account, hashed password, stripeId
Subscription    plan, status, stripe subscription ids
UserSettings    notification preferences
Shop            one connected store per row
  country / currency / paymentProvider   commerce identity
  feePercent / feeFixed                  custom fee override (nullable)
  taxRate                                shop tax override (nullable)
Product         externalId, title, sku, cost, price
Order           one per sale, full cost breakdown
  totalRevenue, totalCost, shippingCost,
  transactionFee, taxAmount, adSpend,
  netProfit, profitMargin, status
  refundedAt / refundAmount / refundReason
OrderItem       line items, linked to Product
AdSpendDay      canonical daily ad spend per shop (shopId+date unique)
```

Design notes:

- **Money as Float** — deliberate simplification for a demo/analytics tool; a production payments system would use integer cents.
- **Denormalized profit on Order** — the computed `netProfit` is stored, making list endpoints fast; recomputation happens on cost/fee/tax/refund changes.
- **`@@unique([shopId, externalId])`** on Order and Product gives idempotent upserts — re-syncing or re-importing never duplicates.
- **AdSpendDay is the source of truth** for ad spend; `Order.adSpend` is the per-order allocation snapshot derived from it.

---

## 15. The Profit Engine

### `lib/fees.ts`

- `FEE_PROFILES` — the provider catalog (percent + fixed per provider)
- `resolveFeeProfile(provider, custom)` — custom rates win over presets
- `calculateProviderFee(amount, provider, custom)` — the fee for one transaction
- `CURRENCIES` / `COUNTRIES` / `COUNTRY_TAX_RATES` — the commerce catalog
- `resolveCurrency`, `resolveTaxRate`, `suggestProviderForCountry` — defaults resolution
- Regional providers (iDEAL → NL, Bancontact → BE, SEPA → eurozone) are suggested only where they dominate

### `lib/profit.ts`

- `calculateOrderProfit({revenue, productCost, shippingCost, fee, tax, adSpend})` — the single-order formula
- `applyRefund({order, refundAmount})` — post-refund economics (revenue reversed, costs kept)
- `aggregateMetrics(orders, {includeRefunded})` — period rollups; refunds excluded by default, tax/refund totals surfaced
- `aggregateProductMetrics(orders)` — per-product revenue/cost/profit from line items
- `comparePeriods(current, previous)` — percentage deltas with `null` when there's no baseline

### Recomputation triggers

History is recalculated when:

| Trigger | What's recomputed |
|---|---|
| Product cost edit (`PATCH /api/products/[id]`) | Every order that sold the product |
| Fee/tax change (`PATCH /api/shops/[id]`) | Every order of the shop |
| Refund (`POST /api/orders/[id]/refund`) | That order |
| Ad-spend import (`POST /api/shops/[id]/adspend`) | Every order on affected days |
| Shopify sync | Orders in the synced range |

---

## 16. API Reference

All endpoints are session-gated (`getServerSession`); users only ever see their own data via `shop: { userId }` scoping.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard?period\|from,to&shopId` | Metrics, comparison, top products, refund/tax summary |
| GET | `/api/orders?period\|from,to&shopId` | Order list with refund fields |
| POST | `/api/orders/[id]/refund` | Full/partial refund, or `{undo: true}` |
| GET | `/api/products` | Per-product profitability |
| PATCH | `/api/products/[id]` | Set product cost → recompute affected orders |
| GET | `/api/shops` | List stores |
| PATCH | `/api/shops/[id]` | Country/currency/provider/custom fee/tax → optional recompute |
| DELETE | `/api/shops/[id]` | Remove store and all its data |
| POST | `/api/shops/[id]/sync` | Incremental Shopify sync |
| POST | `/api/shops/[id]/adspend` | Import ad-spend CSV → backfill orders |
| POST | `/api/import/csv` | Order CSV import (store auto-created) |
| GET | `/api/export/csv?type=orders\|products&shopId&from&to` | CSV download |
| GET | `/api/shopify?shop&country` | Start OAuth (sets state cookie) |
| GET | `/api/shopify/callback` | Verify state, exchange code, save shop |
| POST | `/api/register` | Signup (zod-validated, creates Stripe customer) |
| POST | `/api/stripe/checkout` | Subscription checkout session |
| POST | `/api/stripe/webhook` | Subscription lifecycle events |

Validation is zod everywhere inputs enter: schema-checked bodies, length/bounds limits on CSVs, ownership checks before every mutation.

---

## 17. Authentication and Security

- **NextAuth credentials provider**, bcrypt-hashed passwords (cost 12), JWT sessions
- **Shopify OAuth CSRF protection** — random nonce in an httpOnly cookie on initiation, verified on callback; shop domains sanitized against injection
- **Authorization** — every query/mutation scoped by `userId`; object IDs are never trusted from the client alone
- **Input validation** — zod schemas on all mutating endpoints; CSV size/row limits
- **Secrets** — DB credentials and OAuth keys live in environment variables; `DATABASE_URL` is stored as a hidden Vercel secret

---

## 18. Deployment Guide

The app runs on **Vercel + Neon Postgres** (current production):

```
Repo:    github.com/calvinokoth9528-cloud/margindmind
Live:    https://margindmind.vercel.app
Database: Neon serverless Postgres, production branch
```

### Deploy your own

1. **Database** — create a Neon project (free tier), copy the pooled connection string.
2. **Schema** — `DATABASE_URL="<neon-url>" npx prisma db push`
3. **Seed (optional)** — `DATABASE_URL="<neon-url>" npm run db:seed:pg`
4. **Hosting** — `vercel link && vercel deploy --prod` (or import the repo in the Vercel dashboard; Git pushes auto-deploy)
5. **Environment variables** (Vercel project settings):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `NEXTAUTH_URL` | `https://your-domain` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | for subscriptions |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_APP_URL` | for store connections |

6. **Webhooks** — point Stripe's endpoint at `/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

### Local development

```bash
npm install
cp .env.example .env      # set DATABASE_URL to your Postgres (or Neon) URL
npm run db:push
npm run db:seed:pg        # or db:seed for the legacy SQLite flow
npm run dev               # http://localhost:3000
```

> Local SQLite no longer matches the schema — Prisma's provider is `postgresql` everywhere. Point local dev at your Neon branch to keep environments identical.

---

## 19. Testing

87 unit tests across 7 suites, run with Node's built-in runner:

```bash
npm test
```

| Suite | Covers |
|---|---|
| `profit.test.ts` | order math, aggregation, period comparison, refund-aware rollups, break-even, projections |
| `fees.test.ts` | provider catalog integrity, custom overrides, currency/country resolution, regional provider suggestions |
| `ads.test.ts` | Meta/Google CSV parsing, platform detection, even-split backfill, overwrite rules |
| `shopify.test.ts` | fee calculation, order/product transforms, provider-aware fees, webhook HMAC verification |
| `import.test.ts` | column detection, multi-line grouping, date parsing rules, provider-specific import fees |
| `csv.test.ts` | parser edge cases (quoting, delimiters, BOM), currency/date parsing |
| `stripe.test.ts` | plan configuration sanity |

The suite is deliberately hermetic — pure functions only, no database or network — so it runs in seconds anywhere.

---

## 20. Roadmap

**Shipped**

- [x] Shopify OAuth sync + CSV import (template & Shopify exports)
- [x] Product cost editor with historical recompute
- [x] Payment-provider fee profiles + custom rates
- [x] Multi-currency stores, country defaults
- [x] VAT/sales tax modeling
- [x] Refunds (full/partial/undo) with trend exclusion
- [x] Meta/Google ad-spend import with per-order allocation
- [x] Per-store dashboard filters, custom date ranges
- [x] CSV export of filtered data
- [x] Stripe subscriptions (Starter $29 / Pro $79 / Enterprise $199)

**Next**

- [ ] Live Meta Ads + Google Ads API pulls (replacing CSV upload)
- [ ] Per-order FX conversion for true multi-currency rollups
- [ ] Amazon / Etsy / WooCommerce native connectors
- [ ] Order-level break-even and cohort charts
- [ ] Email reports (weekly margin digest)
- [ ] Real per-country tax engine (state-level US, reduced VAT categories)

---

*Built with Next.js 16, React 19, Prisma, Neon Postgres, Tailwind CSS v4, and Recharts. This book is generated from the codebase — when the code changes, so should it.*
