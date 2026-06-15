'use server';

import {AuthError} from 'next-auth';
import {hash} from 'bcryptjs';
import {Prisma} from '@prisma/client';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {signIn, signOut} from '@/auth';
import {prisma} from '@/lib/db/prisma';
import {isLocale} from '@/i18n/routing';
import {normalizeLocale} from '@/lib/prisma/normalize-enums';

const loginSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const registrationSchema = loginSchema.extend({
  name: z.string().trim().max(80).optional().transform(value => value || undefined),
});

export async function loginAction(locale: string, formData: FormData) {
  const normalizedLocale = isLocale(locale) ? locale : 'en';
  const parsed = loginSchema.safeParse({email: formData.get('email'), password: formData.get('password')});
  if (!parsed.success) redirect(`/${normalizedLocale}/login?error=invalid_input`);

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: `/${normalizedLocale}/dashboard`,
    });
  } catch (error) {
    if (error instanceof AuthError) redirect(`/${normalizedLocale}/login?error=invalid_credentials`);
    throw error;
  }
}

export async function registerAction(locale: string, formData: FormData) {
  const normalizedLocale = isLocale(locale) ? locale : 'en';
  const parsed = registrationSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) redirect(`/${normalizedLocale}/register?error=invalid_input`);

  const existing = await prisma.user.findUnique({where: {email: parsed.data.email}, select: {id: true}});
  if (existing) redirect(`/${normalizedLocale}/register?error=email_exists`);

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        ...(parsed.data.name ? {name: parsed.data.name} : {}),
        passwordHash: await hash(parsed.data.password, 12),
        locale: normalizeLocale(normalizedLocale.toUpperCase()),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      redirect(`/${normalizedLocale}/register?error=email_exists`);
    }
    throw error;
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: `/${normalizedLocale}/dashboard`,
    });
  } catch (error) {
    if (error instanceof AuthError) redirect(`/${normalizedLocale}/login?registered=1`);
    throw error;
  }
}

export async function logoutAction(locale: string) {
  await signOut({redirectTo: `/${isLocale(locale) ? locale : 'en'}/login`});
}
