import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z
    .object({
      emailNotifications: z.boolean().optional(),
      orderAlerts: z.boolean().optional(),
      weeklyReports: z.boolean().optional(),
      marketingEmails: z.boolean().optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        settings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      settings: user.settings ?? {
        emailNotifications: true,
        orderAlerts: true,
        weeklyReports: false,
        marketingEmails: false,
      },
      subscription: user.subscription
        ? {
            plan: user.subscription.plan,
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            stripePriceId: user.subscription.stripePriceId,
          }
        : null,
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).userId;
    const body = await request.json();
    const parsed = profileSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (parsed.name !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: parsed.name },
      });
    }

    if (parsed.settings) {
      await prisma.userSettings.upsert({
        where: { userId },
        update: parsed.settings,
        create: {
          userId,
          ...parsed.settings,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}