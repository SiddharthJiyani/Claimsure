/**
 * Database query helpers for notifications.
 */

import { supabase } from '../supabase.js';
import type { Notification, NotificationChannel, NotificationType } from '../../types/index.js';

export interface CreateNotificationInput {
  user_id: string;
  case_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ ...input, sent_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Notification;
}

export async function getNotificationsForUser(
  userId: string,
  onlyUnread = false,
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(50);

  if (onlyUnread) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('channel', 'in_app')
    .eq('is_read', false);

  if (error) throw new Error(error.message);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('channel', 'in_app')
    .eq('is_read', false);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
