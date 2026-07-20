"use client";

import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { Toaster } from "sonner";
import { ReactNode } from "react";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: ReactNode }) {
  const tree = (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ThemeProvider>
  );

  if (!googleClientId) return tree;
  return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = "signin_with",
}: {
  onSuccess: (credential: string) => void;
  onError?: () => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}) {
  if (!googleClientId) {
    return (
      <p className="text-center text-xs text-[var(--muted)] py-2">
        Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Sign-In
      </p>
    );
  }

  return (
    <div className="flex justify-center w-full [&>div]:w-full [&_iframe]:mx-auto">
      <GoogleLogin
        onSuccess={(res: CredentialResponse) => {
          if (res.credential) onSuccess(res.credential);
          else onError?.();
        }}
        onError={() => onError?.()}
        theme="outline"
        size="large"
        text={text}
        shape="pill"
        width="100%"
        useOneTap={false}
      />
    </div>
  );
}
