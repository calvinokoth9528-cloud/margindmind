// Seeds a second demo store (Nairobi Gifts, Kenya) with KES orders and
// M-Pesa fee profile. Run: DATABASE_URL=<url> npx vite-node prisma/seed-kenya.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Typical Nairobi souvenir-shop SKUs, priced in KES
const PRODUCTS = [
  { externalId: 'ke_prod_1', title: 'Maasai Blanket', sku: 'KE-MBL-001', cost: 1200, price: 3500 },
  { externalId: 'ke_prod_2', title: 'Soapstone Elephant', sku: 'KE-SOS-002', cost: 450, price: 1500 },
  { externalId: 'ke_prod_3', title: 'Kenyan Coffee 250g', sku: 'KE-COF-003', cost: 380, price: 950 },
  { externalId: 'ke_prod_4', title: 'Kiondo Basket', sku: 'KE-KBD-004', cost: 600, price: 1800 },
];

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@margindmind.com' },
    update: {},
    create: {
      email: 'demo@margindmind.com',
      name: 'Demo User',
      password: hashedPassword,
      subscription: { create: { plan: 'PRO', status: 'active' } },
    },
  });

  // Kenya store: KES, M-Pesa, 16% VAT
  const shop = await prisma.shop.upsert({
    where: { userId_shopUrl: { userId: user.id, shopUrl: 'nairobi-gifts' } },
    update: {},
    create: {
      userId: user.id,
      shopUrl: 'nairobi-gifts',
      platform: 'CSV',
      accessToken: '',
      country: 'KE',
      currency: 'KES',
      paymentProvider: 'mpesa',
      taxRate: 16,
      lastSync: new Date(),
    },
  });

  const existing = await prisma.order.findMany({
    where: { shopId: shop.id },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: existing.map((o) => o.id) } },
    });
    await prisma.order.deleteMany({ where: { shopId: shop.id } });
  }

  const productIds = new Map<string, string>();
  for (const p of PRODUCTS) {
    const saved = await prisma.product.upsert({
      where: { shopId_externalId: { shopId: shop.id, externalId: p.externalId } },
      update: {},
      create: { shopId: shop.id, ...p },
    });
    productIds.set(p.externalId, saved.id);
  }

  const now = new Date();
  const list = Array.from(productIds.values());

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const numOrders = Math.floor(Math.random() * 4) + 1;

    for (let j = 0; j < numOrders; j++) {
      const product = await prisma.product.findUnique({
        where: { id: list[Math.floor(Math.random() * list.length)] },
      });
      if (!product) continue;

      const quantity = Math.floor(Math.random() * 3) + 1;
      const revenue = product.price * quantity;
      const productCost = product.cost * quantity;
      const shippingCost = Math.random() > 0.6 ? 250 : 0; // KES, boda delivery
      // M-Pesa: 1.5% + KES 1
      const transactionFee = revenue * 0.015 + 1;
      const taxAmount = revenue * 0.16; // Kenya VAT
      const adSpend = Math.random() > 0.5 ? Math.round(revenue * 0.08) : 0;
      const netProfit =
        revenue - productCost - shippingCost - transactionFee - taxAmount - adSpend;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      await prisma.order.create({
        data: {
          shopId: shop.id,
          externalId: `ke_order_${i}_${j}`,
          orderNumber: `#KE${1000 + i * 10 + j}`,
          totalRevenue: revenue,
          totalCost: productCost,
          shippingCost,
          transactionFee,
          taxAmount,
          adSpend,
          netProfit,
          profitMargin,
          status: 'paid',
          orderDate: date,
          items: {
            create: [
              {
                productId: product.id,
                quantity,
                price: product.price,
                cost: product.cost,
              },
            ],
          },
        },
      });
    }
  }

  console.log('Kenya demo store seeded: nairobi-gifts (KES / M-Pesa / 16% VAT)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
