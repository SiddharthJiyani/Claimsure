import { NotificationList } from "@/components/NotificationList";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";

export default function PatientNotificationsPage() {
  return (
    <WorkspaceFrame width="medium">
      <PageHeader
        eyebrow="Patient"
        title="Alerts"
        description="Status changes and requests for missing records."
      />
      <NotificationList />
    </WorkspaceFrame>
  );
}
