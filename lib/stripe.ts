import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// Only initialize Stripe if we have a valid key
const stripe = stripeSecretKey && !stripeSecretKey.includes('placeholder')
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  : null;

export interface PlanConfig {
  id: string;
  name: string;
  priceId: string;
  price: number;
  interval: 'month';
  features: string[];
  orderLimit: number;
  shopLimit: number;
}

export const PLANS: Record<string, PlanConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    priceId: '',
    price: 0,
    interval: 'month',
    features: [
      '1 shop connection',
      'Up to 100 orders/month',
      'Basic profit metrics',
      '7-day data retention',
    ],
    orderLimit: 100,
    shopLimit: 1,
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    price: 29,
    interval: 'month',
    features: [
      '3 shop connections',
      'Up to 1,000 orders/month',
      'Advanced analytics',
      'Product-level profit tracking',
      'Email support',
    ],
    orderLimit: 1000,
    shopLimit: 3,
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    price: 79,
    interval: 'month',
    features: [
      '10 shop connections',
      'Unlimited orders',
      'All analytics features',
      'Ad spend tracking',
      'Priority support',
      'API access',
    ],
    orderLimit: -1,
    shopLimit: 10,
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
    price: 199,
    interval: 'month',
    features: [
      'Unlimited shops',
      'Unlimited orders',
      'Custom integrations',
      'Dedicated account manager',
      'White-label options',
      'SLA guarantee',
    ],
    orderLimit: -1,
    shopLimit: -1,
  },
};

// Create a Stripe checkout session
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 14,
    },
  });

  return session.url || '';
}

// Create a Stripe customer
export async function createCustomer(email: string, name?: string): Promise<string> {
  if (!stripe) {
    return 'cus_placeholder';
  }

  const customer = await stripe.customers.create({
    email,
    name,
  });
  return customer.id;
}

// Create a billing portal session
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// Get subscription details
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  return stripe.subscriptions.retrieve(subscriptionId);
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  await stripe.subscriptions.cancel(subscriptionId);
}

export default stripe;
