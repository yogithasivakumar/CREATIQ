import { NavIcon } from "@/components/dashboard/NavIcon";

const FEATURES = [
  {
    icon: "sparkles",
    title: "AI Image Generation",
    description:
      "Describe your vision in plain language and generate original images in seconds.",
    available: true,
  },
  {
    icon: "edit",
    title: "Creative Editor",
    description:
      "Arrange layers, text, and generated assets into finished creative on a visual canvas.",
    available: false,
  },
  {
    icon: "folder",
    title: "Asset Library",
    description:
      "Every image you generate, organized by project and workspace, with tagging and search.",
    available: false,
  },
  {
    icon: "message",
    title: "AI Captions",
    description:
      "Generate on-brand captions for your posts directly from your creative assets.",
    available: false,
  },
  {
    icon: "instagram",
    title: "Instagram Publishing",
    description:
      "Connect your account and publish generated creative straight to Instagram.",
    available: false,
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">
            Everything in one workspace
          </p>
          <h2 className="mt-3 text-4xl font-bold text-white">
            Built for the full creative workflow
          </h2>
          <p className="mt-4 text-white/60">
            From first prompt to published post — CREATIQ is growing into a
            complete AI creative toolkit.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition hover:border-marigold/50 hover:bg-white/[0.06]"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-marigold/10 text-marigold">
                  <NavIcon name={feature.icon} className="h-6 w-6" />
                </span>
                {!feature.available && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                    Coming soon
                  </span>
                )}
              </div>

              <h3 className="mt-5 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/60">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
