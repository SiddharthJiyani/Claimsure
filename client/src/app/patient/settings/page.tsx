import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function PatientSettingsPage() {
  return (
    <WorkspaceFrame width="medium">
      <PageHeader
        eyebrow="Patient"
        title="Settings"
        description="Account and role. Your workspace stays patient-only."
      />
      <SettingsPanel />
    </WorkspaceFrame>
  );
}
