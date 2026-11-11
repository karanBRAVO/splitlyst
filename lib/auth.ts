import { type NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { compare, hash } from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashRecoveryCode, verifyTotp } from '@/lib/totp';

export const TOTP_REQUIRED = 'TOTP_REQUIRED';
export const TOTP_INVALID = 'Invalid authentication code';

const googleEnabled = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

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
        totp: { label: 'Authentication code', type: 'text' },
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

        if (user.totpEnabled && user.totpSecret) {
          const code = credentials.totp?.trim();
          if (!code) throw new Error(TOTP_REQUIRED);

          let ok = verifyTotp(user.totpSecret, code);
          if (!ok) {
            // Fall back to a single-use recovery code
            const hashed = hashRecoveryCode(code);
            const codes = (user.recoveryCodes as string[] | null) ?? [];
            if (codes.includes(hashed)) {
              await prisma.user.update({
                where: { id: user.id },
                data: { recoveryCodes: codes.filter((c) => c !== hashed) },
              });
              ok = true;
            }
          }
          if (!ok) throw new Error(TOTP_INVALID);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar ?? null,
          currency: user.currency,
          locale: user.locale,
        };
      },
    }),
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = (profile as { email?: string; email_verified?: boolean } | undefined)?.email;
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
      if (!email || !verified) return false;

      // Find or create a local user for this Google account.
      let dbUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            name: user.name || email.split('@')[0],
            avatar: user.image ?? null,
            password: await hash(crypto.randomUUID(), 12), // unusable password; use "reset password" to set one
            emailVerified: new Date(),
          },
        });
      } else if (!dbUser.emailVerified) {
        await prisma.user.update({ where: { id: dbUser.id }, data: { emailVerified: new Date() } });
      }
      if (dbUser.totpEnabled) return false; // 2FA accounts must use password + code
      // Hand the local identity to the jwt callback
      (user as { id: string }).id = dbUser.id;
      (user as unknown as { currency: string }).currency = dbUser.currency;
      (user as unknown as { locale: string }).locale = dbUser.locale;
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.currency = (user as unknown as { currency: string }).currency;
        token.locale = (user as unknown as { locale: string }).locale;
      }
      if (trigger === 'update' && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
        if (session.currency !== undefined) token.currency = session.currency;
        if (session.locale !== undefined) token.locale = session.locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.currency = token.currency as string;
        session.user.locale = (token.locale as string) || 'en';
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
      currency: string;
      locale: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    currency: string;
    locale: string;
  }
}
