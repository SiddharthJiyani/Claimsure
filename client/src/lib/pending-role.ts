import { isUserRole, type UserRole } from "@/lib/types";

export const PENDING_ROLE_COOKIE = "claimsure_role";
export const PENDING_ORG_COOKIE = "claimsure_org";

export function rememberPendingRole(role: UserRole, organizationName = "") {
  document.cookie = `${PENDING_ROLE_COOKIE}=${role}; Path=/; Max-Age=3600; SameSite=Lax`;
  if (role === "insurance_provider" && organizationName) {
    document.cookie = `${PENDING_ORG_COOKIE}=${encodeURIComponent(organizationName)}; Path=/; Max-Age=3600; SameSite=Lax`;
  }
}

export function roleFromUnknown(value: unknown): UserRole | null {
  return typeof value === "string" && isUserRole(value) ? value : null;
}
