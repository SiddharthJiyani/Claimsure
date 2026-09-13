import { NotificationList } from "@/components/NotificationList";
import { PageHeader } from "@/components/PageHeader";

export default function InsuranceNotificationsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Healthcare"
        title="Alerts"
        description="Approval requests, agent completions, and escalation pings."
      />
      <NotificationList />
    </div>
  );
}
