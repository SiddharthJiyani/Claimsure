import { PageHeader } from "@/components/PageHeader";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function InsuranceSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Healthcare"
        title="Settings"
        description="Organization-scoped account. Patients never see this workspace."
      />
      <SettingsPanel />
    </div>
  );
}
