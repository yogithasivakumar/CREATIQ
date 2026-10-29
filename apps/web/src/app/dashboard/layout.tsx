import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/sign-in?next=/dashboard");
  }

  return (
    <DashboardShell
      userEmail={data.user.email ?? "Signed in"}
      signOutSlot={<SignOutButton />}
    >
      {children}
    </DashboardShell>
  );
}
