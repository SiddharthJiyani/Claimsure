import type { Request } from "express";

export const USER_ROLES = ["patient", "insurance_provider"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
};

export type AuthedUser = {
  id: string;
  email: string;
  profile: Profile;
};

export type AuthedRequest = Request & {
  user: AuthedUser;
};

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}
