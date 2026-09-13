import type { UserRole } from "@/lib/types";

export function notificationCaseHref(
  role: UserRole | undefined,
  caseId: string | null | undefined,
) {
  if (!caseId) return null;
  return role === "insurance_provider"
    ? `/insurance/cases/${caseId}`
    : `/patient/cases/${caseId}`;
}
