import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "bankonloop.com").split(",");

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const domain = user.email.split("@")[1];
      return allowedDomains.includes(domain);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
