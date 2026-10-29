import Link from "next/link";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "./nav";

export function FeatureCard({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      className="group flex flex-col gap-3 rounded-2xl border border-aubergine/10 bg-white p-5 transition hover:border-marigold hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-aubergine/5 text-aubergine group-hover:bg-marigold/15 group-hover:text-marigold">
          <NavIcon name={item.icon} className="h-5 w-5" />
        </span>
        {!item.implemented && (
          <span className="rounded-full bg-marigold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-marigold">
            Coming soon
          </span>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-aubergine">{item.label}</h3>
        <p className="mt-1 text-sm text-aubergine/70">{item.description}</p>
      </div>
    </Link>
  );
}
