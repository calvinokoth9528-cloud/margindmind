import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyWebhookSignature, PLANS } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    const event = verifyWebhookSignature(body, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Update user subscription
        await prisma.user.update({
          where: { stripeId: customerId },
          data: {
            subscription: {
              update: {
                stripeSubId: subscriptionId,
                status: 'active',
              },
            },
          },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;

        // Find plan by price ID
        const plan = Object.values(PLANS).find((p) => p.priceId === priceId);
        if (!plan) break;

        await prisma.user.update({
          where: { stripeId: customerId },
          data: {
            subscription: {
              update: {
                stripeSubId: subscription.id,
                stripePriceId: priceId,
                status: subscription.status,
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                plan: plan.id,
              },
            },
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        await prisma.user.update({
          where: { stripeId: customerId },
          data: {
            subscription: {
              update: {
                status: 'canceled',
                plan: 'FREE',
              },
            },
          },
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
