"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// Resolves to /dashboard/generate for a signed-in visitor and
// /sign-in otherwise. Starts pointed at /sign-in (the safe default
// for a signed-out visitor) and swaps once the session check
// resolves, to avoid a hydration mismatch.
export function CtaLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [href, setHref] = useState("/sign-in");

  useEffect(() => {
    let isMounted = true;

    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (isMounted && data.session) {
          setHref("/dashboard/generate");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
