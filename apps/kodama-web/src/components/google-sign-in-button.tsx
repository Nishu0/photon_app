"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/icons";

export function GoogleSignInButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => signIn("google", { callbackUrl })}
      className="w-full"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}
