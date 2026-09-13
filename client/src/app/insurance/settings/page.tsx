import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function InsuranceSettingsPage() {
  return (
    <WorkspaceFrame width="medium">
      <PageHeader
        eyebrow="Healthcare"
        title="Settings"
        description="Organization-scoped account. Patients never see this workspace."
      />
      <SettingsPanel />
    </WorkspaceFrame>
  );
}
