import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { exchangeShopifyCode } from '@/lib/shopify';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const STATE_COOKIE = 'shopify_oauth_state';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const shopParam = shop || '';

  // Sanitize shop to prevent host header injection in redirects
  const safeShop = shopParam.replace(/[^a-zA-Z0-9.-]/g, '');
  const redirectBase = '/stores';

  const failRedirect = (reason: string) =>
    NextResponse.redirect(
      new URL(`${redirectBase}?error=${reason}`, request.url)
    );

  if (!safeShop || !code) {
    return failRedirect('missing_params');
  }

  try {
    // Verify the OAuth state nonce to prevent CSRF
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STATE_COOKIE)?.value;
    cookieStore.delete(STATE_COOKIE);

    if (!expectedState || !state || state !== expectedState) {
      return failRedirect('state_mismatch');
    }

    // Exchange code for access token
    const accessToken = await exchangeShopifyCode(
      safeShop,
      code,
      SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET
    );

    // Associate the connection with the logged-in user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return failRedirect('unauthorized');
    }
    const userId = (session.user as any).userId;

    const shopUrl = safeShop
      .replace('.myshopify.com', '')
      .replace(/^https?:\/\//, '');

    await prisma.shop.upsert({
      where: {
        userId_shopUrl: { userId, shopUrl },
      },
      update: {
        accessToken,
        lastSync: new Date(),
      },
      create: {
        userId,
        shopUrl,
        platform: 'SHOPIFY',
        accessToken,
      },
    });

    return NextResponse.redirect(
      new URL(`${redirectBase}?connected=${encodeURIComponent(shopUrl)}`, request.url)
    );
  } catch (error) {
    console.error('Shopify callback error:', error);
    return failRedirect('connection_failed');
  }
}