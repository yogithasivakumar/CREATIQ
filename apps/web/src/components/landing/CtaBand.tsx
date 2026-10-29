import { CtaLink } from "./CtaLink";

export function CtaBand() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-aubergine px-8 py-14 text-center sm:px-16">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Ready to create something new?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/70">
          Join CREATIQ and turn your first prompt into an image today.
        </p>
        <CtaLink className="mt-8 inline-block rounded-xl bg-marigold px-8 py-4 font-semibold text-[#1a1206] transition hover:brightness-110">
          Start creating — it&apos;s free
        </CtaLink>
      </div>
    </section>
  );
}
