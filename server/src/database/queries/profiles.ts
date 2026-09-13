/**
 * Database query helpers for user profiles.
 */

import { supabase } from '../supabase.js';
import type { Profile, UserRole } from '../../types/index.js';
import { NotFoundError } from '../../lib/errors.js';

export async function getProfileById(id: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();

  if (error || !data) throw new NotFoundError('Profile');
  return data as Profile;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export interface CreateProfileInput {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id?: string;
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').insert(input).select().single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function upsertProfile(input: CreateProfileInput): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(input, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function getProfilesByOrg(orgId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId);

  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}
