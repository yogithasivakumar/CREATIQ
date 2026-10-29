"use client";

import Link from "next/link";
import { useState } from "react";
import { CtaLink } from "./CtaLink";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "How it works", href: "#how-it-works" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b10]/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tight text-white">
          CREATIQ<span className="text-marigold">.</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/70 transition hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/sign-in"
            className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white"
          >
            Sign in
          </Link>
          <CtaLink className="rounded-full bg-marigold px-5 py-2 text-sm font-semibold text-[#1a1206] transition hover:brightness-110">
            Get started
          </CtaLink>
        </div>

        <button
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle navigation"
          className="rounded-lg border border-white/15 p-2 text-white md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            className="h-5 w-5"
          >
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6 6 18" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-white/70 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
            <Link
              href="/sign-in"
              onClick={() => setMobileOpen(false)}
              className="rounded-full border border-white/15 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Sign in
            </Link>
            <CtaLink className="rounded-full bg-marigold px-4 py-2 text-center text-sm font-semibold text-[#1a1206]">
              Get started
            </CtaLink>
          </div>
        </div>
      )}
    </header>
  );
}
