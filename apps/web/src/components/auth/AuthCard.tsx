import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-silver px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-aubergine/10 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-aubergine">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-aubergine/70">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
