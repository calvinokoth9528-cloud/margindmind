import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateShopifyAuthUrl, exchangeShopifyCode } from '@/lib/shopify';

const STATE_COOKIE = 'shopify_oauth_state';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_orders,read_products';
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'http://localhost:3000';

// Initiate Shopify OAuth
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    let shop = searchParams.get('shop') || '';

    // If no shop provided, try to get from query params or use placeholder for demo
    if (!shop) {
      shop = 'demo-store.myshopify.com';
    }

    // Clean the shop URL to get just the store name
    shop = shop.replace('https://', '').replace('http://', '');
    if (!shop.includes('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }

    // Generate nonce for security and store it in an httpOnly cookie so the
    // callback can verify it (prevents OAuth CSRF).
    const nonce = crypto.randomUUID();
    const redirectUri = `${SHOPIFY_APP_URL}/api/shopify/callback`;

    const authUrl = generateShopifyAuthUrl(
      shop,
      SHOPIFY_API_KEY,
      SHOPIFY_SCOPES,
      redirectUri,
      nonce
    );

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes
    });

    return NextResponse.json({ authUrl, shop });
  } catch (error) {
    console.error('Shopify auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Shopify auth' },
      { status: 500 }
    );
  }
}

// Handle Shopify OAuth callback
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { shop, code } = body;

    if (!shop || !code) {
      return NextResponse.json(
        { error: 'Shop and code required' },
        { status: 400 }
      );
    }

    // Exchange code for access token
    const accessToken = await exchangeShopifyCode(
      shop,
      code,
      SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET
    );

    // Save shop to database
    const userId = (session.user as any).userId;
    const shopUrl = shop.replace('.myshopify.com', '').replace('https://', '').replace('http://', '');

    await prisma.shop.upsert({
      where: {
        userId_shopUrl: {
          userId,
          shopUrl,
        },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Shopify callback error:', error);
    return NextResponse.json(
      { error: 'Failed to connect Shopify store' },
      { status: 500 }
    );
  }
}
