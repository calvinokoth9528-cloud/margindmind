import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { createCheckoutSession, PLANS } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const selectedPlan = PLANS[plan];
    if (selectedPlan.price === 0) {
      return NextResponse.json({ error: 'Cannot checkout free plan' }, { status: 400 });
    }

    // Get user with Stripe ID
    const userId = (session.user as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=cancel`;

    const checkoutUrl = await createCheckoutSession(
      user.stripeId,
      selectedPlan.priceId,
      successUrl,
      cancelUrl
    );

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
