import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabase } from "@/lib/supabase";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events"
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === "google") {
        // Find existing user in our custom Supabase table
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email)
          .single();

        let userId = existingUser?.id;

        if (!existingUser) {
          // Create new user
          const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert([{ 
              email: user.email, 
              name: user.name,
              google_access_token: account.access_token,
              google_refresh_token: account.refresh_token
            }])
            .select()
            .single();
          
          if (insertError) {
            console.error("[NextAuth] Error creating user:", insertError);
            return false;
          }
          userId = newUser?.id;
        } else {
          // Update tokens for existing user
          const updateData = { google_access_token: account.access_token };
          // Google only sends refresh_token on the FIRST login (when prompt=consent is fully accepted)
          if (account.refresh_token) {
            updateData.google_refresh_token = account.refresh_token;
          }
          await supabase
            .from("users")
            .update(updateData)
            .eq("id", userId);
        }
        
        return true;
      }
      return false;
    },
    async session({ session }) {
      // Attach the DB user ID to the session so the frontend can query habits for this user
      if (session?.user?.email) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", session.user.email)
          .single();
          
        if (dbUser) {
          session.user.id = dbUser.id;
        }
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
