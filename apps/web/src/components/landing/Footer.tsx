import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Sign in", href: "/sign-in" },
  { label: "Sign up", href: "/sign-up" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-12">
      <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <Link href="/" className="text-xl font-bold text-white">
            CREATIQ<span className="text-marigold">.</span>
          </Link>
          <p className="mt-1 text-sm text-white/40">
            Your ideas, reimagined.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/60 transition hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <p className="text-sm text-white/40">
          &copy; {new Date().getFullYear()} CREATIQ
        </p>
      </div>
    </footer>
  );
}
