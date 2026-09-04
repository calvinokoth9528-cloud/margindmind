import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { exchangeShopifyCode } from '@/lib/shopify';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!shop || !code) {
    return NextResponse.redirect('/dashboard?error=missing_params');
  }

  try {
    // Exchange code for access token
    const accessToken = await exchangeShopifyCode(
      shop,
      code,
      SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET
    );

    // Note: In production, you'd verify the state/nonce here
    // For now, we'll redirect to dashboard where user can see connection status

    return NextResponse.redirect(`/dashboard?shop=${shop}&connected=true`);
  } catch (error) {
    console.error('Shopify callback error:', error);
    return NextResponse.redirect('/dashboard?error=connection_failed');
  }
}
