"use client";

import { useState, type ReactNode } from "react";
import { SidebarNav } from "./Sidebar";

export function DashboardShell({
  userEmail,
  signOutSlot,
  children,
}: {
  userEmail: string;
  signOutSlot: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-silver">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-aubergine/10 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg border border-aubergine/15 p-2 text-aubergine"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-lg font-bold text-aubergine">
          CREATIQ<span className="text-marigold">.</span>
        </span>
        <div className="w-9" aria-hidden="true" />
      </div>

      <div className="flex h-[calc(100dvh-3.5rem)] lg:h-dvh">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-aubergine/10 bg-white px-5 py-6 lg:flex lg:flex-col">
          <SidebarHeader />
          <div className="mt-8 flex-1">
            <SidebarNav />
          </div>
          <SidebarFooter userEmail={userEmail} signOutSlot={signOutSlot} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-aubergine/40"
            />
            <aside className="relative z-50 flex h-full w-72 flex-col bg-white px-5 py-6 shadow-xl">
              <SidebarHeader />
              <div className="mt-8 flex-1">
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
              </div>
              <SidebarFooter userEmail={userEmail} signOutSlot={signOutSlot} />
            </aside>
          </div>
        )}

        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarHeader() {
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <span className="text-xl font-bold text-aubergine">
        CREATIQ<span className="text-marigold">.</span>
      </span>
    </div>
  );
}

function SidebarFooter({
  userEmail,
  signOutSlot,
}: {
  userEmail: string;
  signOutSlot: ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-aubergine/10 pt-4">
      <p className="truncate text-xs text-aubergine/60">{userEmail}</p>
      <div className="mt-3">{signOutSlot}</div>
    </div>
  );
}
