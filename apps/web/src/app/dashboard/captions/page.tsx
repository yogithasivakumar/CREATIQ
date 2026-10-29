import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function AiCaptionsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">AI Captions</h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Generate captions for your content.
        </p>
      </header>

      <ComingSoon
        icon="message"
        title="AI Captions is on its way"
        description="Generate on-brand captions for your posts directly from your creative assets — coming in a future phase."
      />
    </div>
  );
}
