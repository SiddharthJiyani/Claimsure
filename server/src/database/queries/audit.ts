/**
 * Database query helpers for the append-only audit log.
 * NEVER delete or update rows — only INSERT.
 */

import { supabase } from "../supabase.js";
import type { AuditLog, ActorType, PolicyCitation } from "../../types/index.js";

export interface CreateAuditLogInput {
  case_id?: string;
  actor_id?: string;
  actor_type: ActorType;
  action: string;
  node?: string;
  previous_state?: string;
  new_state?: string;
  ai_recommendation?: string;
  human_decision?: string;
  confidence?: number;
  citations?: PolicyCitation[];
  input_hash?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(
  input: CreateAuditLogInput,
): Promise<AuditLog> {
  const { data, error } = await supabase
    .from("audit_logs")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AuditLog;
}

export async function getAuditLogsByCase(caseId: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLog[];
}

export async function getAuditLogsByActor(
  actorId: string,
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("actor_id", actorId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLog[];
}
