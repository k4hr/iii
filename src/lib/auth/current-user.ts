import 'server-only';

import type {User} from '@prisma/client';
import {prisma} from '@/lib/db/prisma';

const developmentDemoEmail = process.env.DEV_DEMO_USER_EMAIL || 'demo@theoryforge.local';

export async function getCurrentUser(): Promise<User | null> {
  const configuredEmail = process.env.THEORYFORGE_USER_EMAIL?.trim().toLowerCase();

  if (configuredEmail) {
    return prisma.user.findUnique({where: {email: configuredEmail}});
  }

  if (process.env.NODE_ENV !== 'production') {
    return prisma.user.upsert({
      where: {email: developmentDemoEmail},
      update: {},
      create: {
        email: developmentDemoEmail,
        name: 'Demo Researcher',
        preferredLocale: 'RU',
      },
    });
  }

  return null;
}

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required. Configure the server-side auth adapter before accessing private research data.');
  }
  return user;
}
