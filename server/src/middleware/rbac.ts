import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./error-handler.js";
import type { AuthedRequest, UserRole } from "../types.js";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(user.profile.role)) {
      next(new HttpError(403, `Requires role: ${roles.join(" or ")}`));
      return;
    }
    next();
  };
}

export function assertCaseScope(
  role: UserRole,
  userId: string,
  orgId: string | null,
  patientId: string,
  insurerOrgId: string,
) {
  if (role === "patient" && patientId !== userId) {
    throw new HttpError(403, "Patients can only access their own cases");
  }
  if (role === "insurance_provider" && (!orgId || insurerOrgId !== orgId)) {
    throw new HttpError(
      403,
      "Insurers can only access cases assigned to their organization",
    );
  }
}
