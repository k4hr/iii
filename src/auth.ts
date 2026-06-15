import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {PrismaAdapter} from '@auth/prisma-adapter';
import {compare} from 'bcryptjs';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';

if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is required in production.');
}

const credentialsSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const {handlers, auth, signIn, signOut} = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {strategy: 'jwt'},
  providers: [
    Credentials({
      credentials: {
        email: {label: 'Email', type: 'email'},
        password: {label: 'Password', type: 'password'},
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: {email: parsed.data.email},
          select: {id: true, email: true, name: true, image: true, passwordHash: true, locale: true},
        });
        if (!user?.passwordHash || !await compare(parsed.data.password, user.passwordHash)) return null;

        return {id: user.id, email: user.email, name: user.name, image: user.image, locale: user.locale};
      },
    }),
  ],
  callbacks: {
    jwt({token, user}) {
      if (user?.id) token.id = user.id;
      if (user && 'locale' in user) token.locale = user.locale;
      return token;
    },
    session({session, token}) {
      if (session.user) {
        session.user.id = typeof token.id === 'string' ? token.id : token.sub || '';
        session.user.locale = typeof token.locale === 'string' ? token.locale : 'RU';
      }
      return session;
    },
  },
});
