import { NotificationList } from "@/components/NotificationList";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";

export default function InsuranceNotificationsPage() {
  return (
    <WorkspaceFrame width="medium">
      <PageHeader
        eyebrow="Healthcare"
        title="Alerts"
        description="Approval requests, agent completions, and escalation pings for your organization."
      />
      <NotificationList />
    </WorkspaceFrame>
  );
}
