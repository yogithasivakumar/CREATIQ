import { ArtPanel } from "./ArtPanel";
import { CtaLink } from "./CtaLink";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-aubergine/40 blur-3xl" />
        <div className="absolute right-[-10%] top-1/3 h-72 w-72 rounded-full bg-marigold/20 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-marigold">
            AI Creative Studio
          </p>

          <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-6xl">
            Turn your ideas into{" "}
            <span className="text-marigold">striking visuals.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-white/70">
            CREATIQ is the AI creative platform for generating on-brand
            images, editing them, and publishing your best work — all from
            one workspace.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <CtaLink className="rounded-xl bg-marigold px-7 py-4 text-center font-semibold text-[#1a1206] transition hover:brightness-110">
              Start creating — it&apos;s free
            </CtaLink>
            <a
              href="#features"
              className="rounded-xl border border-white/20 px-7 py-4 text-center font-semibold text-white transition hover:bg-white/5"
            >
              Explore features
            </a>
          </div>

          <p className="mt-5 text-sm text-white/40">
            No credit card required. Cancel anytime.
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-4">
          <ArtPanel
            variant="aurora"
            label="Illustrative composition: a glowing marigold aurora over a deep aubergine gradient, evoking AI-generated visual art."
            className="col-span-2 aspect-[16/10] shadow-2xl shadow-aubergine/30"
          />
          <ArtPanel
            variant="orbit"
            label="Illustrative composition: concentric orbital rings around a marigold core, suggesting generative design."
            className="aspect-square"
          />
          <ArtPanel
            variant="prism"
            label="Illustrative composition: a layered geometric prism in marigold and silver tones."
            className="aspect-square"
          />
        </div>
      </div>
    </section>
  );
}
