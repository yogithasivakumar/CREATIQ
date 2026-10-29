import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function CreativeEditorPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">Creative Editor</h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Compose and refine your designs.
        </p>
      </header>

      <ComingSoon
        icon="edit"
        title="Creative Editor is on its way"
        description="A full design canvas for arranging layers, text, and generated assets into finished creative — coming in a future phase."
      />
    </div>
  );
}
