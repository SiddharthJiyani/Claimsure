import { NotificationList } from "@/components/NotificationList";
import { PageHeader } from "@/components/PageHeader";

export default function PatientNotificationsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Patient"
        title="Alerts"
        description="Status changes and requests for missing records."
      />
      <NotificationList />
    </div>
  );
}
