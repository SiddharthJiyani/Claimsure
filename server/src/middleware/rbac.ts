/**
 * RBAC middleware — role and organization-scoped access control.
 * Use AFTER requireAuth. Backend enforces permissions — not just the UI.
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types/index.js';
import { ForbiddenError, AuthenticationError } from '../lib/errors.js';

/**
 * requireRole — only allows requests from users with the specified role(s).
 * 
 * Usage: router.get('/route', requireAuth, requireRole('insurance_provider'), controller)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `This action requires one of the following roles: ${roles.join(', ')}`,
        ),
      );
      return;
    }

    next();
  };
}

/**
 * requireOrgAccess — ensures the insurance_provider user belongs to the org
 * that owns the resource. Call this after requireRole('insurance_provider').
 * 
 * @param getOrgId - A function that extracts the target org ID from the request.
 * 
 * Usage: 
 *   router.get('/:id', requireAuth, requireOrgAccess(req => req.params.orgId), controller)
 */
export function requireOrgAccess(getOrgId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError());
      return;
    }

    // Patients don't have an org, so org-scope checks don't apply
    if (req.user.role === 'patient') {
      next();
      return;
    }

    const targetOrgId = getOrgId(req);

    if (!targetOrgId) {
      next(new ForbiddenError('Organization context is required'));
      return;
    }

    if (req.user.organization_id !== targetOrgId) {
      next(new ForbiddenError('You do not have access to resources from this organization'));
      return;
    }

    next();
  };
}

/**
 * requireSelfOrRole — allows access if the user is accessing their own resource
 * OR if they have the specified role.
 * 
 * Usage for patient accessing their own case:
 *   requireSelfOrRole(req => req.resourceOwnerId, 'insurance_provider')
 */
export function requireSelfOrRole(
  getOwnerId: (req: Request) => string | undefined,
  ...roles: UserRole[]
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError());
      return;
    }

    const ownerId = getOwnerId(req);

    if (req.user.id === ownerId || roles.includes(req.user.role)) {
      next();
      return;
    }

    next(new ForbiddenError('Access denied'));
  };
}
