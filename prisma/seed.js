const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const hashedPassword = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@margindmind.com' },
    update: {},
    create: {
      email: 'demo@margindmind.com',
      name: 'Demo User',
      password: hashedPassword,
      stripeId: 'cus_demo123',
      subscription: {
        create: {
          plan: 'PRO',
          status: 'active',
        },
      },
      shops: {
        create: {
          platform: 'SHOPIFY',
          shopUrl: 'demo-store',
          accessToken: 'shpat_demo_token',
          lastSync: new Date(),
        },
      },
    },
  });

  // Create demo products
  const shop = await prisma.shop.findFirst({
    where: { userId: user.id },
  });

  if (shop) {
    const products = [
      { externalId: 'prod_1', title: 'Premium Widget', sku: 'WDG-001', cost: 15, price: 49.99 },
      { externalId: 'prod_2', title: 'Basic Gadget', sku: 'GDG-001', cost: 8, price: 29.99 },
      { externalId: 'prod_3', title: 'Deluxe Thingamajig', sku: 'THG-001', cost: 25, price: 79.99 },
      { externalId: 'prod_4', title: 'Super Doohickey', sku: 'DOH-001', cost: 12, price: 39.99 },
      { externalId: 'prod_5', title: 'Mega Whatsit', sku: 'WHT-001', cost: 30, price: 99.99 },
    ];

    for (const product of products) {
      await prisma.product.upsert({
        where: {
          shopId_externalId: {
            shopId: shop.id,
            externalId: product.externalId,
          },
        },
        update: {},
        create: {
          shopId: shop.id,
          externalId: product.externalId,
          title: product.title,
          sku: product.sku,
          cost: product.cost,
          price: product.price,
        },
      });
    }

    // Create demo orders for the last 30 days
    const orders = [];
    const now = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const numOrders = Math.floor(Math.random() * 5) + 1;

      for (let j = 0; j < numOrders; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const revenue = product.price * quantity;
        const productCost = product.cost * quantity;
        const shippingCost = Math.random() > 0.5 ? 5.99 : 0;
        const transactionFee = revenue * 0.029 + 0.30;
        const adSpend = revenue * (Math.random() * 0.15 + 0.05);
        const netProfit = revenue - productCost - shippingCost - transactionFee - adSpend;
        const profitMargin = (netProfit / revenue) * 100;

        orders.push({
          shopId: shop.id,
          externalId: `order_${i}_${j}`,
          orderNumber: `#${1000 + i * 10 + j}`,
          totalRevenue: revenue,
          totalCost: productCost,
          shippingCost,
          transactionFee,
          adSpend,
          netProfit,
          profitMargin,
          status: 'paid',
          orderDate: date,
        });
      }
    }

    for (const order of orders) {
      await prisma.order.create({
        data: order,
      });
    }
  }

  console.log('Seed data created successfully!');
  console.log('Demo login: demo@margindmind.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
