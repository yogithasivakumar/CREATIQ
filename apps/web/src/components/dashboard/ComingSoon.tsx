import Link from "next/link";
import { NavIcon } from "./NavIcon";

export function ComingSoon({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-aubergine/20 bg-white px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aubergine/5 text-aubergine">
        <NavIcon name={icon} className="h-7 w-7" />
      </span>

      <h2 className="mt-5 text-xl font-bold text-aubergine">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-aubergine/70">{description}</p>

      <span className="mt-5 rounded-full bg-marigold/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-marigold">
        Coming soon
      </span>

      <Link
        href="/dashboard"
        className="mt-6 text-sm font-medium text-aubergine/70 hover:text-aubergine hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
