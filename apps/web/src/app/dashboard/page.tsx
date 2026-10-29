import { createClient } from "@/lib/supabase/server";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { NAV_ITEMS } from "@/components/dashboard/nav";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  const featureItems = NAV_ITEMS.filter((item) => item.href !== "/dashboard");
  const firstName = data.user?.email?.split("@")[0] ?? "there";

  return (
    <div className="mx-auto max-w-6xl">
      <section className="rounded-3xl bg-aubergine px-6 py-10 text-white sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">
          Welcome back
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Hey, {firstName}.
        </h1>
        <p className="mt-3 max-w-xl text-white/70">
          This is your CREATIQ workspace. Jump into a tool below, or pick up
          where you left off.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-aubergine">Quick actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureItems.map((item) => (
            <FeatureCard key={item.href} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
