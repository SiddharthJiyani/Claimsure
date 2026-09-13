import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotifications,
  markRead,
  markAllRead,
} from '../controllers/notifications.controller.js';

const router: Router = Router();

router.use(requireAuth);

/**
 * GET /api/notifications
 * Get in-app notifications for the authenticated user.
 * Query: ?unread=true  (filter to unread only)
 * Returns: { notifications[], unread_count }
 */
router.get('/', listNotifications);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', markRead);

/**
 * PATCH /api/notifications/read-all
 * Mark all in-app notifications as read.
 */
router.patch('/read-all', markAllRead);

export default router;
