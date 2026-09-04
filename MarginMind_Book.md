# MarginMind - The Definitive Guide
*A complete guide to understanding and building an e-commerce profit analytics platform*

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [The Problem](#2-the-problem)
3. [The Solution](#3-the-solution)
4. [Architecture Overview](#4-architecture-overview)
5. [Technology Stack](#5-technology-stack)
6. [Data Model](#6-data-model)
7. [Profit Calculation Engine](#7-profit-calculation-engine)
8. [API Integrations](#8-api-integrations)
9. [Authentication & Security](#9-authentication--security)
10. [Subscription & Billing](#10-subscription--billing)
11. [Frontend Architecture](#11-frontend-architecture)
12. [API Endpoints Reference](#12-api-endpoints-reference)
13. [Deployment Guide](#13-deployment-guide)
14. [Monetization Strategy](#14-monetization-strategy)
15. [Marketing & Growth](#15-marketing--growth)
16. [Future Roadmap](#16-future-roadmap)

---

## 1. Introduction

### What is MarginMind?

**MarginMind** is a Software-as-a-Service (SaaS) platform designed to solve a critical pain point for e-commerce sellers: they don't know their true profit.

While platforms like Shopify and Amazon show revenue, they don't show what sellers actually keep after accounting for:
- Cost of goods sold (COGS)
- Shipping costs
- Platform transaction fees
- Payment processing fees
- Advertising spend

MarginMind integrates directly with e-commerce platforms via their APIs, pulls all relevant data, and presents clear, actionable profit metrics in an intuitive dashboard.

### Who is it for?

- **Shopify store owners** struggling to calculate true ROI
- **Amazon FBA sellers** managing complex fee structures
- **Etsy and multi-channel sellers** juggling multiple platforms
- **Marketing agencies** needing to prove client ROI
- **E-commerce managers** at DTC brands

### Key Value Proposition

> *"Stop guessing. Start knowing. MarginMind shows you exactly how much you're making on every sale."*

---

## 2. The Problem

### The Hidden Profit Crisis

Most e-commerce sellers operate with **incomplete financial visibility**. Here's why:

#### 2.1 The Math Doesn't Add Up

A typical seller sees:
- **Revenue:** $10,000
- **Platform Fee:** $290 (2.9%)
- **Payment Processing:** $320
- **COGS:** $4,000
- **Shipping:** $800
- **Ads:** $1,500

**Reported Profit (incorrect):** $10,000 - $4,000 = $6,000 (60% margin)
**Actual Profit:** $10,000 - $4,000 - $800 - $290 - $320 - $1,500 = $3,090 (30.9% margin)

That's a **30% overstatement** of profitability!

#### 2.2 Why Existing Tools Fall Short

| Tool | Revenue Tracking | Cost Tracking | Ad Spend | True Profit |
|------|------------------|---------------|----------|-------------|
| Shopify Analytics | Yes | No | No | No |
| Amazon Seller Central | Yes | Partial | No | No |
| QuickBooks | Yes | Manual | Manual | Manual |
| Excel Spreadsheets | Manual | Manual | Manual | Error-prone |
| **MarginMind** | **Auto** | **Auto** | **Auto** | **Auto** |

#### 2.3 The Impact

- **Overspending on ads** because profitability isn't clear
- **Poor pricing decisions** due to incomplete margin data
- **Cash flow problems** from misprojected profits
- **Missed optimization opportunities** on low-margin products

---

## 3. The Solution

### MarginMind's Approach

MarginMind solves this by providing a **single pane of glass** for all profit-related metrics.

#### Core Capabilities

1. **Automated Data Import** - Connects to Shopify, Amazon, and other platforms via API
2. **Cost Tracking** - Monitors product costs, shipping, and COGS
3. **Fee Calculation** - Automatically calculates platform-specific fees
4. **Ad Spend Integration** - (Planned) Connects to Facebook, TikTok, Google Ads
5. **Real-time Dashboard** - Visualizes profit trends with interactive charts
6. **Alerting System** - Notifies sellers when margins drop below thresholds

#### What Makes It Different

- **Platform-native integration** (not a browser extension)
- **Real profit calculation**, not just revenue
- **Designed for actionability** - not just reporting
- **Multi-platform aggregation** in one view

---

## 4. Architecture Overview

### System Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Shopify API   │     │   Amazon SP-API   │     │  WooCommerce    │
│  (REST/GraphQL) │     │     (REST)        │     │   API           │
└────────┬────────┘     └────────┬──────────┘     └──────┬──────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     MarginMind App      │
                    │   (Next.js API Routes)   │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐      ┌──────▼──────┐       ┌─────────▼─────────┐
│   Database      │      │   Stripe    │       │   NextAuth.js     │
│  (PostgreSQL)   │      │  (Billing)  │       │  (Auth/Sessions)  │
│   (Prisma)      │      │             │       │                   │
└─────────────────┘      └─────────────┘       └───────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   Frontend (React/Tailwind) │
                    │   - Dashboard              │
                    │   - Orders Page            │
                    │   - Products Page          │
                    │   - Store Connect          │
                    │   - Settings Page          │
                    └────────────────────────────┘
```

### Data Flow

1. **User registers** → Account created in database + Stripe customer
2. **User connects store** → OAuth flow stores access token securely
3. **Background sync** → Periodically fetches orders/products from platforms
4. **Data processing** → Calculates profit metrics for each order
5. **Dashboard render** → Aggregates and visualizes profit data
6. **Subscription check** → Validates billing status before showing premium features

### Component Breakdown

#### Backend (Server-Side)
- **API Routes** (`app/api/`) - RESTful endpoints for all operations
- **Prisma ORM** (`lib/db.ts`) - Type-safe database client singleton
- **Auth Library** (`lib/auth.ts`) - NextAuth.js configuration with Credentials provider
- **Profit Engine** (`lib/profit.ts`) - Core calculation logic
- **Shopify SDK** (`lib/shopify.ts`) - API integration utilities
- **Stripe SDK** (`lib/stripe.ts`) - Billing and subscription management

#### Frontend (Client-Side)
- **Root Layout** (`app/layout.tsx`) - Global styles and session provider
- **Pages** (`app/*/page.tsx`) - Individual views
- **Components** - Reusable UI elements (via Tailwind components)
- **Hooks** - Client-side data fetching and state management

---

## 5. Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router) with Turbopack
- **Language:** TypeScript
- **UI Library:** Tailwind CSS v4
- **Icon Library:** Lucide React
- **Chart Library:** Recharts
- **Date Utilities:** date-fns
- **Form Validation:** Zod

### Backend
- **Runtime:** Node.js via Next.js API Routes
- **Database:** PostgreSQL (production) / SQLite (local dev)
- **ORM:** Prisma ORM v5
- **Authentication:** NextAuth.js v4
- **Password Hashing:** bcryptjs

### Infrastructure
- **Payments:** Stripe Checkout + Billing Portal
- **E-Commerce APIs:** Shopify Admin API, Amazon SP-API
- **Deployment:** Vercel (frontend) + Railway/Supabase (database)
- **Email:** (Planned - SendGrid/Postmark for notifications)

---

## 6. Data Model

### Entity Relationship Diagram

```
User (1) ────┬
             │
             ├─── (1) Subscription
             │
             └─── (Many) Shop ──── (Many) Product
                                 └─── (Many) Order ──── (Many) OrderItem
```

### Database Schema

#### User
The core entity representing a MarginMind account.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (CUID) |
| `email` | string | Unique email for login |
| `name` | string? | Display name |
| `password` | string | bcrypt-hashed password |
| `stripeId` | string? | Stripe customer ID |
| `createdAt` | DateTime | Account creation timestamp |
| `updatedAt` | DateTime | Last profile update |

#### Subscription
Tracks the user's billing plan and Stripe subscription.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `userId` | string | Links to User |
| `stripeSubId` | string? | Stripe subscription ID |
| `stripePriceId` | string? | Stripe price tier |
| `status` | string | active/inactive/canceled |
| `currentPeriodEnd` | DateTime? | End of billing period |
| `plan` | string | FREE/STARTER/PRO/ENTERPRISE |

#### Shop
Represents a connected e-commerce store.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `userId` | string | Owner |
| `platform` | Platform | SHOPIFY/AMAZON/ETSY/WOOCOMMERCE |
| `shopUrl` | string | Store domain (e.g., mystore.myshopify.com) |
| `accessToken` | string | OAuth access token |
| `orders` | Order[] | Related orders |
| `lastSync` | DateTime? | Last data sync timestamp |

#### Product
Individual products from connected stores.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `shopId` | string | Belongs to Shop |
| `externalId` | string | Original platform ID |
| `title` | string | Product name |
| `sku` | string? | Stock keeping unit |
| `cost` | float | Your cost per unit |
| `price` | float | Selling price |

#### Order
Individual orders from connected stores.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `externalId` | string | - | Platform order ID |
| `orderNumber` | string | - | Human-readable number |
| `totalRevenue` | float | - | Gross order value |
| `totalCost` | float | 0.0 | Product COGS |
| `shippingCost` | float | 0.0 | Shipping expenses |
| `transactionFee` | float | 0.0 | Platform/payment fees |
| `adSpend` | float | 0.0 | Ad spend allocated |
| `netProfit` | float | 0.0 | **Calculated profit** |
| `profitMargin` | float | 0.0 | **Profit percentage** |
| `status` | string | 'pending' | Order status |
| `orderDate` | DateTime | - | When order was placed |

#### OrderItem
Individual line items within orders.

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | string | Parent Order |
| `productId` | string? | Related Product |
| `quantity` | int | Units sold |
| `price` | float | Unit price |
| `cost` | float | Unit cost |

---

## 7. Profit Calculation Engine

### Core Formula

```
Net Profit = Revenue - Product Cost - Shipping - Transaction Fees - Ad Spend
Profit Margin = (Net Profit / Revenue) × 100
```

### Platform Fee Structures

| Platform | Fee Structure |
|----------|---------------|
| **Shopify** | Basic: 2.9% + $0.30, Shopify: 2.6% + $0.30, Advanced: 2.4% + $0.30 |
| **Amazon** | Typical 8-15% referral fee depending on category |
| **Etsy** | 6.5% transaction fee + $0.20 listing fee |
| **WooCommerce** | Varies by payment processor |

### Implementation

```typescript
// lib/profit.ts
export function calculateOrderProfit(params: {
  revenue: number;
  productCost: number;
  shippingCost: number;
  transactionFeePercent?: number;
  adSpend?: number;
}): OrderMetrics {
  const { revenue, productCost, shippingCost, 
          transactionFeePercent = 2.9, adSpend = 0 } = params;
  
  const transactionFee = revenue * (transactionFeePercent / 100) + 0.30;
  const totalCost = productCost + shippingCost + transactionFee + adSpend;
  const netProfit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return { totalRevenue: revenue, totalCost, shippingCost, 
           transactionFee, adSpend, netProfit, profitMargin };
}
```

### Margin Classification

Orders are color-coded based on profit margin:
- **Green (≥20%)** - Healthy profit
- **Yellow (10-20%)** - Monitor closely
- **Red (<10%)** - Potential loss leader

---

## 8. API Integrations

### Shopify Integration

MarginMind connects to Shopify stores using OAuth 2.0:

1. **Initiation:** User enters their store URL
2. **OAuth Flow:** Redirect to Shopify for authorization
3. **Token Exchange:** Receive access token
4. **Data Sync:** 
   - Fetch orders via `GET /admin/api/2024-01/orders.json`
   - Fetch products via `GET /admin/api/2024-01/products.json`
   - Calculate Shopify-specific fees

#### Permissions Required
- `read_orders` - Access to order data
- `read_products` - Access to product catalog
- `read_analytics` - Access to financial reports

### Amazon Integration (Planned)

Uses the **Selling Partner API (SP-API)**:
- `orders-api` for order data
- `products-api` for product details
- Fee calculation based on category-specific rates

### Etsy & WooCommerce (Planned)

- **Etsy:** Uses REST API with OAuth 1.0a
- **WooCommerce:** Connects via REST API with consumer key/secret

### Webhook Handling

Stripe webhooks handle:
- `checkout.session.completed` - Activate trial
- `customer.subscription.updated` - Update plan
- `customer.subscription.deleted` - Downgrade to free

---

## 9. Authentication & Security

### Authentication Flow

1. **Registration:**
   - User submits email, password, name
   - Password hashed with bcrypt (12 rounds)
   - Stripe customer created
   - Subscription created (FREE plan)
   - JWT token issued via NextAuth.js

2. **Login:**
   - Credentials checked against database
   - On success, NextAuth.js issues JWT session
   - Session stored in encrypted cookie

3. **Session Management:**
   - JWT tokens with 7-day expiry
   - Automatic session refresh
   - Client-side session polling via `useSession`

### Security Measures

| Threat | Mitigation |
|--------|------------|
| Password exposure | bcrypt hashing with 12 rounds |
| Session hijacking | JWT with secure, HttpOnly cookies |
| SQL injection | Prisma ORM parameterized queries |
| XSS | React's built-in XSS protection |
| CSRF | NextAuth.js CSRF tokens |
| API credential exposure | Encrypted storage, OAuth tokens |
| Rate limiting | (Planned) API rate limiting |

### Environment Variables

Never commit `.env` files. Required variables:

```
DATABASE_URL          - PostgreSQL/SQ connection string
NEXTAUTH_SECRET       - Random 32+ char string for JWT signing
STRIPE_SECRET_KEY     - Your Stripe secret key
STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret
SHOPIFY_API_KEY       - Shopify app API key
SHOPIFY_API_SECRET    - Shopify app API secret
```

---

## 10. Subscription & Billing

### Pricing Tiers

| Tier | Price | Shops | Orders/Month | Features |
|------|-------|-------|--------------|----------|
| Free | $0 | 1 | 100 | Basic metrics, email support |
| Starter | $29 | 3 | 1,000 | Advanced analytics, product-level tracking |
| Pro | $79 | 10 | Unlimited | Ad spend tracking, API access, priority support |
| Enterprise | $199 | Unlimited | Unlimited | Custom integrations, white-label, dedicated manager |

### Billing Flow

1. User selects a paid plan on the Settings or Pricing page
2. Frontend calls `/api/stripe/checkout` with selected plan
3. Stripe Checkout is created with 14-day trial
4. User enters payment details on Stripe-hosted page
5. After redirect back, webhook `checkout.session.completed` fires
6. User's subscription upgraded in database
7. User accesses premium features

### Stripe Integration

```typescript
// Create checkout session
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  payment_method_types: ['card'],
  line_items: [{ price: priceId, quantity: 1 }],
  subscription_data: { trial_period_days: 14 },
  success_url: '/dashboard?subscription=success',
  cancel_url: '/dashboard?subscription=cancel',
});
```

---

## 11. Frontend Architecture

### File Structure

```
app/
├── api/                    # API route handlers
│   ├── auth/[...nextauth]/ # NextAuth routes
│   ├── dashboard/         # Dashboard data
│   ├── orders/            # Orders API
│   ├── products/          # Products API
│   ├── shops/             # Store management
│   ├── shopify/           # Shopify OAuth
│   └── stripe/            # Checkout/webhooks
├── login/                 # Authentication page
├── dashboard/             # Main analytics dashboard
├── orders/                # Order management
├── products/              # Product analytics
├── stores/                # Store connections
├── settings/              # User settings
├── layout.tsx             # Root layout
├── page.tsx               # Landing page
└── globals.css            # Tailwind styles

lib/
├── auth.ts                # NextAuth config + JWT utilities
├── db.ts                  # Prisma client singleton
├── profit.ts              # Profit calculation functions
├── shopify.ts             # Shopify API wrapper
└── stripe.ts              # Stripe utilities + plan definitions

prisma/
├── schema.prisma          # Database schema
└── seed.js                # Demo data generator

components/
└── SessionProvider.tsx    # Wraps app with NextAuth session provider
```

### State Management

- **Server State:** Fetched via API routes with `fetch`
- **Client State:** React `useState` / `useEffect`
- **Session State:** `useSession()` hook from NextAuth
- **Form State:** React state + Zod validation

### Styling

- **Tailwind CSS v4** with JIT compilation
- **Component classes:** Custom `.card`, `.btn-primary`, `.btn-secondary`
- **Responsive design:** Mobile-first with `grid-cols-1 md:grid-cols-*`
- **Theme colors:** Brand green palette (`brand-50` through `brand-900`)

---

## 12. API Endpoints Reference

### Authentication

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | No | NextAuth session, callbacks, providers |
| `/api/register` | POST | No | User registration |

### Data APIs

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/dashboard` | GET | Yes | Aggregated profit metrics & charts |
| `/api/orders` | GET | Yes | Paginated order list with filters |
| `/api/products` | GET | Yes | Product catalog with profitability |
| `/api/shops` | GET | Yes | Connected store list |

### Integration APIs

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/shopify` | GET/POST | Yes | Shopify OAuth initiation/callback |
| `/api/shopify/callback` | GET | No | OAuth callback handler |
| `/api/stripe/checkout` | POST | Yes | Create subscription checkout |
| `/api/stripe/webhook` | POST | No | Stripe webhook (raw body) |

---

## 13. Deployment Guide

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (production) or SQLite (dev)
- Stripe account
- Shopify Partner account
- Vercel or similar hosting

### Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL="postgresql://user:pass@host:5432/margindmind"
NEXTAUTH_URL="https://yourapp.com"
NEXTAUTH_SECRET="your-32-char-secret"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_ENTERPRISE_PRICE_ID="price_..."
SHOPIFY_API_KEY="your-key"
SHOPIFY_API_SECRET="your-secret"
SHOPIFY_APP_URL="https://yourapp.com"
```

### Deployment Steps

1. **Database Setup:**
   ```bash
   npx prisma db push
   ```

2. **Seed Demo Data (optional):**
   ```bash
   node prisma/seed.js
   ```

3. **Deploy to Vercel:**
   ```bash
   git push origin main
   ```

4. **Configure Stripe Webhooks:**
   - Endpoint: `https://yourapp.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

5. **Configure Shopify OAuth:**
   - App URL: Your domain
   - Redirect URLs: `https://yourapp.com/api/shopify/callback`

### Monitoring

- Use `console.error()` for development debugging
- Add Sentry or LogRocket for production error tracking
- Monitor Stripe dashboard for payment issues

---

## 14. Monetization Strategy

### Revenue Model

MarginMind uses a **tiered subscription** model with a freemium entry point.

#### Why This Works

1. **Immediate value** - Even free tier shows real profit insights
2. **Natural upgrade path** - Power users hit store/order limits quickly
3. **High willingness to pay** - Sellers see direct ROI correlation
4. **Recurring revenue** - Predictable MRR with low churn (stickiness)

#### Customer Segments

| Segment | Monthly Revenue | Target Plan |
|---------|----------------|-------------|
| Hobby seller | <$1K | Free |
| Growing store | $1K-10K | Starter ($29) |
| Scaling brand | $10K-50K | Pro ($79) |
| Enterprise | $50K+ | Enterprise ($199) |

#### Projected Economics

| Users | Plan | ARPU | Monthly Revenue |
|-------|------|------|-----------------|
| 100 Free | 5% paid = 5 | $29 avg | $145 |
| 1,000 | 15% paid = 150 |  | $4,350 |
| 10,000 | 25% paid = 2,500 | | $72,500 |
| 100,000 | 35% paid = 35,000 | | $1,015,000 |

### Pricing Rationale

- **$0 Free** - No barrier to entry, viral coefficient through data value
- **$29 Starter** - 10x the value for sellers making $5K+/month
- **$79 Pro** - Worth it for brands spending $500+/month on ads
- **$199 Enterprise** - Captures large brand revenue at premium

---

## 15. Marketing & Growth

### Target Customer Personas

1. **The Etsy Seller** (Sarah)
   - Handmade products, 50-200 orders/month
   - Uses spreadsheets for tracking
   - Values simplicity and affordability

2. **The Shopify Store Owner** (Mike)
   - Private label products, 200-1000 orders/month
   - Uses multiple tools already
   - Values automation and accuracy

3. **The Amazon FBA Seller** (Jennifer)
   - High-volume, thin margins
   - Needs to track PPC spend
   - Values competitive pricing

### Go-to-Market Channels

#### 1. Content Marketing
- Blog posts: "How to Calculate True Profit on Shopify"
- YouTube: "E-commerce Profit Calculator Explained"
- SEO keywords: "shopify profit calculator", "ecommerce profit margin"

#### 2. Community Engagement
- Reddit: r/ecommerce, r/Shopify, r/FulfillmentByAmazon
- Facebook Groups: Shopify sellers, Amazon FBA
- Discord: Provide value, offer free profit audits

#### 3. Product-Led Growth
- 14-day free trial on paid plans
- Shareable profit calculations
- Viral loops through team features

#### 4. Affiliate Program
- 30% commission for e-commerce influencers
- Tutorials creators, course instructors
- Tools comparison sites

#### 5. Paid Acquisition
- Google Ads: Target "profit calculator" keywords
- TikTok/Instagram: Short demos for new sellers
- Facebook retargeting: Free trial abandonment

### Success Metrics

| Metric | Target |
|--------|--------|
| Conversion rate (landing → signup) | 3% |
| Trial to paid conversion | 8% |
| Monthly churn | <5% |
| LTV/CAC ratio | >3x |
| ARPU growth | 10% QoQ |

---

## 16. Future Roadmap

### Phase 1 (MVP - Complete)
- ✅ Basic profit calculation
- ✅ Shopify integration
- ✅ Dashboard with charts
- ✅ Authentication
- ✅ Stripe subscriptions

### Phase 2 (Growth)
- [ ] Amazon SP-API integration
- [ ] Etsy integration
- [ ] WooCommerce integration
- [ ] Ad spend import (Facebook, Google, TikTok)
- [ ] Email alerts for low-margin products
- [ ] Product-level profitability insights

### Phase 3 (Scale)
- [ ] Mobile app (React Native)
- [ ] Team accounts (multi-user access)
- [ ] Financial reporting (P&L export)
- [ ] AI-powered profit optimization suggestions
- [ ] White-label reseller program

### Phase 4 (Enterprise)
- [ ] Custom integrations
- [ ] Advanced analytics (cohorts, LTV)
- [ ] Role-based access control
- [ ] Private cloud deployment option
- [ ] Dedicated customer success

---

*This book is maintained by the MarginMind team. For questions or contributions, visit the GitHub repository.*

**Repository:** https://github.com/calvinokoth9528-cloud/margindmind  
**License:** MIT
