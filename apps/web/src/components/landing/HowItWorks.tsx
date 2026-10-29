const STEPS = [
  {
    number: "01",
    title: "Describe your idea",
    description:
      "Write a prompt for the image you're imagining — as simple or detailed as you like.",
  },
  {
    number: "02",
    title: "Generate instantly",
    description:
      "CREATIQ turns your prompt into an image in seconds, ready to review and refine.",
  },
  {
    number: "03",
    title: "Save and share",
    description:
      "Keep it in your workspace, or take it further as the editor and publishing tools roll out.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">
            Simple by design
          </p>
          <h2 className="mt-3 text-4xl font-bold text-white">
            From prompt to image in three steps
          </h2>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.number} className="relative">
              <span className="text-5xl font-bold text-white/10">
                {step.number}
              </span>
              <h3 className="mt-3 text-xl font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-white/60">{step.description}</p>

              {index < STEPS.length - 1 && (
                <div className="mt-8 hidden h-px bg-gradient-to-r from-marigold/40 to-transparent lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
