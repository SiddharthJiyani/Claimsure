import { PageHeader } from "@/components/PageHeader";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function PatientSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Patient"
        title="Settings"
        description="Account and role. Your workspace stays patient-only."
      />
      <SettingsPanel />
    </div>
  );
}
