import type {DefaultSession} from 'next-auth';

declare module 'next-auth' {
  interface User {
    locale?: string;
  }

  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      locale: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    locale?: string;
  }
}
