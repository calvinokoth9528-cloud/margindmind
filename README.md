# MarginMind - E-commerce Profit Analytics Platform

**Know your true profit on every sale.**

MarginMind connects to your Shopify, Amazon, Etsy, and WooCommerce stores to automatically calculate and visualize your real profit margins after all fees, shipping, and ad spend.

> 📖 **Full documentation book:** See `MarginMind_Book.md` in this repository for a comprehensive guide covering architecture, profit calculation logic, API endpoints, pricing strategy, and deployment instructions.

## Features

- **True Profit Calculation**: Automatically deducts platform fees, shipping costs, transaction fees, and ad spend
- **Multi-Platform Support**: Connect Shopify, Amazon, Etsy, WooCommerce, and more
- **Real-Time Analytics**: Live dashboards showing revenue, profit trends, and top products
- **Order Management**: View all orders with detailed profit breakdowns
- **Subscription Tiers**: Free, Starter ($29/mo), Pro ($79/mo), and Enterprise ($199/mo)

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials + JWT
- **Payments**: Stripe (subscriptions + billing portal)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Validation**: Zod

## Project Structure

```
margindmind/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth configuration
│   │   ├── dashboard/route.ts             # Dashboard data API
│   │   ├── register/route.ts              # User registration
│   │   ├── shopify/                       # Shopify OAuth + webhooks
│   │   └── stripe/                        # Stripe checkout + webhooks
│   ├── dashboard/page.tsx                 # Main dashboard UI
│   ├── login/page.tsx                     # Login/Register page
│   ├── globals.css                        # Global styles
│   ├── layout.tsx                         # Root layout
│   └── page.tsx                           # Landing page
├── components/                            # Reusable UI components
├── lib/
│   ├── auth.ts                            # Auth utilities + NextAuth config
│   ├── db.ts                              # Prisma client singleton
│   ├── profit.ts                          # Profit calculation functions
│   ├── shopify.ts                         # Shopify API integration
│   └── stripe.ts                          # Stripe integration + plans
├── prisma/
│   └── schema.prisma                      # Database schema
├── .env.example                           # Environment variables template
├── next.config.js                         # Next.js configuration
├── tailwind.config.js                     # Tailwind configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account (for payments)
- Shopify Partner account (for Shopify integration)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd margindmind
   yarn install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Fill in your database URL, Stripe keys, etc.
   ```

3. **Set up the database**
   ```bash
   yarn db:push        # Push schema to database
   yarn db:generate    # Generate Prisma client
   ```

4. **Run the development server**
   ```bash
   yarn dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:3000`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random string for JWT signing |
| `NEXTAUTH_URL` | Your app URL |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_STARTER_PRICE_ID` | Stripe price ID for Starter plan |
| `STRIPE_PRO_PRICE_ID` | Stripe price ID for Pro plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe price ID for Enterprise plan |
| `SHOPIFY_API_KEY` | Shopify app API key |
| `SHOPIFY_API_SECRET` | Shopify app secret |
| `SHOPIFY_APP_URL` | Your app URL for Shopify OAuth |

## Profit Calculation Formula

```
Net Profit = Revenue - Product Cost - Shipping - Transaction Fees - Ad Spend

Profit Margin = (Net Profit / Revenue) × 100
```

### Fee Assumptions (configurable per store)

- **Shopify**: 2.9% + $0.30 (Basic), 2.6% + $0.30 (Shopify), 2.4% + $0.30 (Advanced)
- **Amazon**: Varies by category (typically 8-15%)
- **Etsy**: 6.5% transaction fee + $0.20 listing fee

## API Endpoints

### Authentication
- `POST /api/register` - Create new account
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Dashboard
- `GET /api/dashboard?period=30` - Get aggregated metrics

### Shopify
- `GET /api/shopify?shop=storename` - Initiate OAuth
- `POST /api/shopify` - Handle OAuth callback

### Stripe
- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/webhook` - Handle Stripe webhooks

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Database Options

- **Railway**: Easy PostgreSQL setup
- **Supabase**: Free tier available
- **Neon**: Serverless PostgreSQL

## Monetization Strategy

| Plan | Price | Target Customer |
|------|-------|-----------------|
| **Free** | $0 | Trial users, small sellers |
| **Starter** | $29/mo | Growing stores (<$10k/mo) |
| **Pro** | $79/mo | Established stores ($10k-50k/mo) |
| **Enterprise** | $199/mo | High-volume sellers ($50k+/mo) |

## Marketing Strategy

1. **SEO**: Target "shopify profit calculator", "ecommerce profit margin"
2. **Content**: Blog posts on e-commerce profitability
3. **Communities**: Reddit r/ecommerce, r/shoplify, Facebook groups
4. **Product Hunt**: Launch on PH for initial traction
5. **Affiliates**: Partner with e-commerce influencers

## License

MIT
