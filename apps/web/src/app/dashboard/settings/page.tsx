import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">Settings</h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Manage your account and workspace.
        </p>
      </header>

      <ComingSoon
        icon="settings"
        title="Settings is on its way"
        description="Account details, workspace members, and preferences will live here in a future phase."
      />
    </div>
  );
}
