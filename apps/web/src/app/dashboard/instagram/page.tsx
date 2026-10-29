import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function InstagramPublishingPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">
          Instagram Publishing
        </h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Publish directly to Instagram from CREATIQ.
        </p>
      </header>

      <ComingSoon
        icon="instagram"
        title="Instagram Publishing is on its way"
        description="Connect your Instagram account and publish generated creative directly, with scheduling — coming in a future phase."
      />
    </div>
  );
}
