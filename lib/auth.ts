import { type NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  // No database adapter — JWT sessions are self-contained.
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user) throw new Error('No account found with this email');

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) throw new Error('Incorrect password');

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar ?? null,
          isPro: user.isPro,
          currency: user.currency,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.isPro = (user as unknown as { isPro: boolean }).isPro;
        token.currency = (user as unknown as { currency: string }).currency;
      }
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.picture = session.image;
        token.isPro = session.isPro;
        token.currency = session.currency;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.isPro = token.isPro as boolean;
        session.user.currency = token.currency as string;
      }
      return session;
    },
  },
};

export const getAuth = () => getServerSession(authOptions);

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isPro: boolean;
      currency: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    isPro: boolean;
    currency: string;
  }
}
