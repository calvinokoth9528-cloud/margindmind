# MarginMind — E-commerce Profit Analytics

Track your **true net profit** on every sale. MarginMind connects to your Shopify store,
imports orders and products, and automatically calculates profit after product costs,
shipping, transaction fees, and ad spend.

**Live demo:** https://margindmind.vercel.app — sign in with `demo@margindmind.com` / `password123`

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database:** Prisma + SQLite (local dev) — swap `DATABASE_URL` for Postgres in production
- **Auth:** NextAuth (credentials, JWT sessions) with bcrypt
- **Payments:** Stripe subscriptions (checkout + webhooks)
- **Store data:** Shopify Admin API (OAuth, orders, products) **or CSV import** (template + Shopify export columns auto-detected)
- **Multi-currency:** per-store country/currency/payment-provider with fee profiles and VAT/sales-tax defaults
- **Ad spend:** Meta Ads / Google Ads daily-spend CSV import, split across each day's orders
- **Charts:** Recharts
- **Styling:** Tailwind CSS v4
- **Tests:** Node's built-in test runner (`node --test`)

## Getting Started

```bash
npm install
cp .env.example .env        # fill in values (SQLite works out of the box)
npm run db:push             # create the database schema
npm run db:seed             # demo user + 30 days of sample orders
npm run dev                 # http://localhost:3000
```

**Demo login:** `demo@margindmind.com` / `password123`

## Scripts

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the dev server                          |
| `npm run build`    | Production build                              |
| `npm run start`    | Serve the production build                    |
| `npm test`         | Run unit tests (profit, shopify, stripe, csv, import libs) |
| `npm run db:push`  | Apply the Prisma schema to the database       |
| `npm run db:seed`  | Load demo data                                |
| `npm run db:studio`| Open Prisma Studio                            |

## Architecture

```
app/
  page.tsx              Landing page + pricing
  login/page.tsx        Sign in
  dashboard/page.tsx    KPIs, trends, top products, recent orders
  orders/               Order table with period filter + search
  products/             Product cards with per-product profit
  stores/               Connected stores (sync / remove)
  settings/             Account settings
  api/
    dashboard/          Aggregated metrics + period comparison
    orders/ products/   List endpoints (auth-gated)
    register/           Signup (zod-validated, Stripe customer)
    auth/[...nextauth]/ NextAuth credentials flow
    shopify/            OAuth start (sets state cookie)
    shopify/callback/   OAuth callback (verifies state, saves shop)
    shops/[id]/sync/    Import products + orders from Shopify
    shops/[id]/         DELETE a store and its data
    import/csv/         Upload order CSVs (template or Shopify exports)
    stripe/checkout/    Create subscription checkout session
    stripe/webhook/     Handle subscription lifecycle events
components/
  ConnectStoreModal.tsx Shared "connect store" modal (Dashboard + Stores)
  ImportCsvModal.tsx   CSV upload flow with template download
lib/
  csv.ts               Dependency-free CSV parser (delimiters, quoting, dates)
  import.ts            Column auto-mapping, multi-line order grouping, profit math
  template.ts          Client-safe import template generator
lib/
  profit.ts             Profit math: order metrics, aggregation, product metrics,
                        period comparison, break-even, projections
  shopify.ts            Shopify API client + transforms + webhook verify
  stripe.ts             Stripe client + plan configuration
  auth.ts / db.ts       NextAuth options / Prisma singleton
prisma/schema.prisma    User, Subscription, Shop, Product, Order, OrderItem
```

## Key Design Decisions

- **Profit formula:** `netProfit = revenue − productCost − shipping − transactionFee − tax − adSpend`.
  Transaction fees come from the shop's payment-provider profile (Shopify Payments, Stripe,
  PayPal, iDEAL, …) or a custom percent + fixed override; tax uses the shop's rate or the
  country default (e.g. DE 19% VAT, US 7% sales tax).
- **Refunds:** a full or partial refund keeps revenue only for the unrefunded portion while
  costs (product, shipping, gateway fee, tax, ads) stay spent — margins reflect reality.
  Refunded orders are excluded from period trends; refunds are summarized separately.
- **Ad spend:** daily CSV exports from Meta Ads ("Amount spent") or Google Ads ("Cost") are
  upserted into `AdSpendDay`, then each day's spend is split evenly across that day's orders.
- **Period comparison:** the dashboard compares the selected window (presets or custom
  from/to range) against the identical window immediately before it (`comparePeriods`).
- **Product analytics:** per-product profit is aggregated from order line items
  (`aggregateProductMetrics`) — the top-5 by profit are ranked on the dashboard.
- **Per-store isolation:** dashboard/orders accept a `shopId` filter so each store's
  metrics, currency, and fee profile can be viewed in isolation.
- **CSV export:** filtered orders/products download via `GET /api/export/csv`.
- **OAuth security:** the Shopify flow stores a random nonce in an httpOnly cookie when
  initiating auth and verifies it on callback (CSRF protection). The callback saves the
  access token against the logged-in user's account.
- **Sync model:** `POST /api/shops/[id]/sync` upserts products and orders incrementally
  (since `lastSync`), rebuilding line items so data mirrors the source store.

## Deploying to Production

### 1. Database

SQLite works locally but **will not work on serverless hosts** (ephemeral filesystem).
Before deploying, create a Postgres database (e.g. Neon, Supabase, Railway) and set:

```
DATABASE_URL="postgresql://user:password@host/db?schema=public"
```

Then run migrations:

```bash
npm run db:push
```

### 2. Environment Variables

Copy `.env.example` and fill in real values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (prod) |
| `NEXTAUTH_URL` | Your deployed URL |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe test/live keys |
| `STRIPE_*_PRICE_ID` | Stripe price IDs for each plan |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Your Shopify app credentials |
| `SHOPIFY_APP_URL` | Your deployed URL (OAuth redirect base) |

### 3. Shopify App Setup

1. Create a **custom app** in your Shopify admin (Settings → Apps → Develop apps).
2. Scopes: `read_orders`, `read_products` (add `read_analytics` for ad data later).
3. Set the OAuth redirect URL to `https://your-domain.com/api/shopify/callback`.
4. Copy the API key/secret into your env vars.

> Note: Shopify doesn't expose landed product **cost** through the basic product API, so
> imported products start at cost `0`. A "set product cost" editor is the natural next
> feature to make per-product profit accurate.

### 4. Stripe

- Create the three subscription products/prices (Starter $29, Pro $79, Enterprise $199).
- Configure the webhook endpoint `https://your-domain.com/api/stripe/webhook` with events
  `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

### 5. Hosting

Deploy to Vercel (or any Next.js host):

```bash
vercel --prod
```

Set all env vars in the platform dashboard. Run `npm run db:push` against your production
database once before the first deploy.

## Importing Data from CSV

No Shopify API keys? Sellers can upload a store's order export directly (Stores →
**Import CSV**):

1. Click **Import CSV** on the Stores page (download the sample template if you like).
2. Name the store and choose the `.csv` file. Column names are matched loosely, so
   **Shopify order exports work as-is** (Name, Paid at, Lineitem quantity/name/sku/price,
   Total, …) as do template-style files (Order ID, Order Date, Product Title, Quantity,
   Unit Price, Unit Cost, Shipping, Ad Spend).
3. The importer groups multi-line orders, computes fees and net profit with the same
   engine as Shopify sync, then upserts products/orders into a store labeled `CSV import`.

Rules & limits: `.csv` up to 5 MB / 10,000 rows; US dates default to `M/D/Y` (EU `D/M/Y`
is detected when unambiguous, e.g. `31/12/2026`); rows with unparseable dates are
reported and skipped; re-uploading the same file updates existing orders by ID.

## Testing

```bash
npm test
```

Runs the unit test suite covering:

- `lib/profit` — order profit math, aggregation, product metrics, period comparison,
  break-even, projections
- `lib/shopify` — fee calculation, order/product transforms, webhook signature verification
- `lib/stripe` — plan configuration sanity (limits, pricing)

## Roadmap Ideas

- [x] Product cost editor (landed-cost tracking)
- [x] CSV order import (template + Shopify exports)
- [ ] Ad spend import (Meta/Google Ads)
- [ ] Amazon / Etsy / WooCommerce native connectors
- [ ] Order-level break-even and projection charts
- [ ] Email reports