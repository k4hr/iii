import 'server-only';

import {auth} from '@/auth';
import {prisma} from '@/lib/db/prisma';

const safeUserSelect = {
  id: true,
  email: true,
  emailVerified: true,
  name: true,
  image: true,
  locale: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({where: {id: userId}, select: safeUserSelect});
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required.');
  return user;
}
