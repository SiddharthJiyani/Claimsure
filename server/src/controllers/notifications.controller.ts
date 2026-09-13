/**
 * Notifications controller — in-app notifications for the current user.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from '../database/queries/notifications.js';
import { sendSuccess } from '../lib/response.js';

// ─── List Notifications ───────────────────────────────────────────────────────

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const onlyUnread = req.query['unread'] === 'true';

    const notifications = await getNotificationsForUser(user.id, onlyUnread);
    const unreadCount = await getUnreadCount(user.id);

    sendSuccess(res, { notifications, unread_count: unreadCount });
  } catch (err) {
    next(err);
  }
}

// ─── Mark One as Read ─────────────────────────────────────────────────────────

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const { id } = req.params;

    await markNotificationRead(id, user.id);
    sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

// ─── Mark All as Read ─────────────────────────────────────────────────────────

export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    await markAllNotificationsRead(user.id);
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
}
