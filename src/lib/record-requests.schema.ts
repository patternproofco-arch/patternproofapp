import { z } from "zod";

/** Client-safe validation shapes for the record-request workflow. */

export const RECORD_REQUEST_STATUSES = [
  "draft", "pending_survivor", "approved", "modified",
  "declined", "expired", "revoked", "cancelled",
] as const;

export const FOLLOW_UP_STATUSES = [
  "offered", "accepted", "scheduled", "completed", "declined",
] as const;

export const REFERRAL_ENGAGEMENT_STATUSES = [
  "offered", "received", "accepted", "scheduled", "completed", "declined",
] as const;

export const createRequestSchema = z.object({
  survivor_user_id: z.string().uuid(),
  purpose: z.string().trim().min(5).max(1000),
  date_start: z.string().date().nullable().optional(),
  date_end: z.string().date().nullable().optional(),
  topics: z.array(z.string().max(60)).max(30).default([]),
  source_types: z.array(z.string().max(40)).max(20).default([]),
  include_incidents: z.boolean().default(true),
  include_evidence: z.boolean().default(true),
  expires_at: z.string().datetime().nullable().optional(),
  download_allowed: z.boolean().default(false),
  submit: z.boolean().default(false),
});

export const respondSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "modify", "decline"]),
  note: z.string().trim().max(1000).optional(),
  date_start: z.string().date().nullable().optional(),
  date_end: z.string().date().nullable().optional(),
  topics: z.array(z.string().max(60)).max(30).optional(),
  source_types: z.array(z.string().max(40)).max(20).optional(),
  incident_ids: z.array(z.string().uuid()).max(500).nullable().optional(),
  evidence_ids: z.array(z.string().uuid()).max(500).nullable().optional(),
  include_incidents: z.boolean().optional(),
  include_evidence: z.boolean().optional(),
  download_allowed: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export const idSchema = z.object({ id: z.string().uuid() });
export const grantIdSchema = z.object({ grant_id: z.string().uuid() });
export const revokeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export const downloadSchema = z.object({
  grant_id: z.string().uuid(),
  evidence_id: z.string().uuid(),
});
export const sealSchema = z.object({
  evidence_id: z.string().uuid(),
  sealed: z.boolean(),
});

export const followUpCreateSchema = z.object({
  survivor_user_id: z.string().uuid().nullable().optional(),
  grant_id: z.string().uuid().nullable().optional(),
  reference_label: z.string().trim().max(160).optional(),
  resource_reference: z.string().trim().max(200).optional(),
  status: z.enum(FOLLOW_UP_STATUSES).default("offered"),
  due_at: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const followUpUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
  due_at: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const referralEngagementCreateSchema = z.object({
  survivor_user_id: z.string().uuid().nullable().optional(),
  referral_code: z.string().trim().max(64).optional(),
  status: z.enum(REFERRAL_ENGAGEMENT_STATUSES).default("offered"),
  note: z.string().trim().max(1000).optional(),
});

export const referralEngagementUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REFERRAL_ENGAGEMENT_STATUSES),
  note: z.string().trim().max(1000).optional(),
});
