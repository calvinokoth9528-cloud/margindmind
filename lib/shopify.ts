// Shopify API integration for MarginMind

const SHOPIFY_API_VERSION = '2024-01';

interface ShopifyConfig {
  shopUrl: string;
  accessToken: string;
}

interface ShopifyOrder {
  id: string;
  name: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_shipping: string;
  processing_fee: string;
  financial_status: string;
  created_at: string;
  line_items: Array<{
    id: string;
    product_id: string;
    title: string;
    quantity: number;
    price: string;
    sku: string;
  }>;
}

interface ShopifyProduct {
  id: string;
  title: string;
  variants: Array<{
    id: string;
    sku: string;
    price: string;
  }>;
}

// Fetch orders from Shopify
export async function fetchShopifyOrders(
  config: ShopifyConfig,
  since?: Date
): Promise<ShopifyOrder[]> {
  const { shopUrl, accessToken } = config;
  const baseUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}`;

  let url = `${baseUrl}/orders.json?status=any&limit=250&fields=id,name,total_price,subtotal_price,total_tax,total_shipping,processing_fee,financial_status,created_at,line_items`;

  if (since) {
    url += `&created_at_min=${since.toISOString()}`;
  }

  const orders: ShopifyOrder[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    orders.push(...data.orders);

    // Handle pagination
    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
      nextUrl = nextMatch ? nextMatch[1] : null;
    } else {
      nextUrl = null;
    }
  }

  return orders;
}

// Fetch products from Shopify
export async function fetchShopifyProducts(
  config: ShopifyConfig
): Promise<ShopifyProduct[]> {
  const { shopUrl, accessToken } = config;
  const baseUrl = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}`;

  const response = await fetch(
    `${baseUrl}/products.json?limit=250&fields=id,title,variants`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.products;
}

// Calculate Shopify transaction fee
export function calculateShopifyFee(totalPrice: number, plan: string = 'basic'): number {
  const feePercentages: Record<string, number> = {
    basic: 2.9,
    shopify: 2.6,
    advanced: 2.4,
  };

  const percentage = feePercentages[plan] || 2.9;
  return totalPrice * (percentage / 100) + 0.30;
}

// Transform Shopify order to our format
export function transformShopifyOrder(
  shopifyOrder: ShopifyOrder,
  productCosts: Map<string, number>
) {
  const totalRevenue = parseFloat(shopifyOrder.total_price);
  const shippingCost = parseFloat(shopifyOrder.total_shipping || '0');

  // Calculate product costs from line items
  let totalProductCost = 0;
  shopifyOrder.line_items.forEach((item) => {
    const cost = productCosts.get(item.product_id) || 0;
    totalProductCost += cost * item.quantity;
  });

  const transactionFee = calculateShopifyFee(totalRevenue);
  const netProfit = totalRevenue - totalProductCost - shippingCost - transactionFee;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    externalId: shopifyOrder.id.toString(),
    orderNumber: shopifyOrder.name,
    totalRevenue,
    totalCost: totalProductCost,
    shippingCost,
    transactionFee,
    adSpend: 0, // Would need to fetch from ad platforms
    netProfit,
    profitMargin,
    status: shopifyOrder.financial_status,
    orderDate: new Date(shopifyOrder.created_at),
    items: shopifyOrder.line_items.map((item) => ({
      externalId: item.id.toString(),
      productId: item.product_id,
      quantity: item.quantity,
      price: parseFloat(item.price),
      cost: productCosts.get(item.product_id) || 0,
    })),
  };
}

// Verify Shopify webhook
export function verifyShopifyWebhook(payload: string, signature: string, secret: string): boolean {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(hmac.update(payload).digest('hex'), 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');

  if (digest.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digest, signatureBuffer);
}

// Generate Shopify OAuth URL
export function generateShopifyAuthUrl(
  shop: string,
  apiKey: string,
  scopes: string,
  redirectUri: string,
  nonce: string
): string {
  const baseUrl = `https://${shop}/admin/oauth/authorize`;
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state: nonce,
  });

  return `${baseUrl}?${params.toString()}`;
}

// Exchange OAuth code for access token
export async function exchangeShopifyCode(
  shop: string,
  code: string,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange Shopify OAuth code');
  }

  const data = await response.json();
  return data.access_token;
}
