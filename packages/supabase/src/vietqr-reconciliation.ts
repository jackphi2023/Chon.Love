import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

export const vietqrReconciliationStatusSchema = z.enum([
  'unmatched',
  'matched',
  'needs_review',
  'settled',
  'ignored',
  'rejected',
]);

export const vietqrReconciliationDecisionSchema = z.enum(['match', 'settle', 'ignore', 'reject']);

const queueItemSchema = z.object({
  transaction_id: z.string().uuid(),
  provider: z.string().min(2).max(32),
  provider_transaction_ref: z.string().min(3).max(160),
  amount_vnd: z.coerce.number().int().positive(),
  transfer_content_raw: z.string().min(1).max(500),
  occurred_at: z.string(),
  status: vietqrReconciliationStatusSchema,
  matched_order_id: z.string().uuid().nullable(),
  order_code: z.string().nullable(),
  expected_amount_vnd: z.coerce.number().int().positive().nullable(),
  order_status: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  display_name: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
  review_reason_code: z.string().nullable(),
  total_count: z.coerce.number().int().nonnegative(),
});

const importResultSchema = z.object({
  transaction_id: z.string().uuid(),
  status: vietqrReconciliationStatusSchema,
  matched_order_id: z.string().uuid().nullable(),
  order_code: z.string().nullable(),
  amount_vnd: z.coerce.number().int().positive(),
  expected_amount_vnd: z.coerce.number().int().positive().nullable(),
  already_imported: z.boolean(),
  requestId: z.string().uuid(),
});

const decisionResultSchema = z.object({
  transaction_id: z.string().uuid(),
  status: vietqrReconciliationStatusSchema,
  matched_order_id: z.string().uuid().nullable(),
  purchase_id: z.string().uuid().nullable(),
  balance_after_units: z.coerce.number().int().nonnegative().nullable(),
  already_processed: z.boolean(),
  requestId: z.string().uuid(),
});

const listResultSchema = z.object({
  items: z.array(queueItemSchema),
  requestId: z.string().uuid(),
});

const edgeErrorSchema = z.object({ error: z.string().min(1) });

type Client = SupabaseClient<Database>;
export type VietqrReconciliationStatus = z.infer<typeof vietqrReconciliationStatusSchema>;
export type VietqrReconciliationDecision = z.infer<typeof vietqrReconciliationDecisionSchema>;
export type VietqrReconciliationQueueItem = z.infer<typeof queueItemSchema>;
export type VietqrReconciliationImportResult = z.infer<typeof importResultSchema>;
export type VietqrReconciliationDecisionResult = z.infer<typeof decisionResultSchema>;

export const vietqrReconciliationQueryKeys = {
  all: ['vietqr-reconciliation'] as const,
  queue: (status: VietqrReconciliationStatus | null) => ['vietqr-reconciliation', 'queue', status] as const,
};

async function invokeAdmin(client: Client, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.functions.invoke('vietqr-reconciliation-admin', { body });
  if (error) {
    const parsed = edgeErrorSchema.safeParse(data);
    throw new Error(parsed.success ? parsed.data.error : error.message);
  }
  const parsedError = edgeErrorSchema.safeParse(data);
  if (parsedError.success) throw new Error(parsedError.data.error);
  return data;
}

export async function listVietqrReconciliationQueue(
  client: Client,
  input: { status?: VietqrReconciliationStatus | null; limit?: number; offset?: number } = {},
): Promise<VietqrReconciliationQueueItem[]> {
  const data = await invokeAdmin(client, {
    action: 'list',
    status: input.status ?? null,
    limit: input.limit ?? 100,
    offset: input.offset ?? 0,
  });
  return listResultSchema.parse(data).items;
}

export async function importVietqrBankTransaction(
  client: Client,
  input: {
    provider: string;
    transactionRef: string;
    amountVnd: number;
    transferContent: string;
    occurredAt: string;
    payloadSha256?: string | null;
    requestId?: string;
  },
): Promise<VietqrReconciliationImportResult> {
  const data = await invokeAdmin(client, {
    action: 'import',
    provider: input.provider,
    transactionRef: input.transactionRef,
    amountVnd: input.amountVnd,
    transferContent: input.transferContent,
    occurredAt: input.occurredAt,
    payloadSha256: input.payloadSha256 ?? null,
    requestId: input.requestId ?? crypto.randomUUID(),
  });
  return importResultSchema.parse(data);
}

export async function decideVietqrReconciliation(
  client: Client,
  input: {
    transactionId: string;
    decision: VietqrReconciliationDecision;
    orderId?: string | null;
    reasonCode?: string | null;
    requestId?: string;
  },
): Promise<VietqrReconciliationDecisionResult> {
  const data = await invokeAdmin(client, {
    action: 'decide',
    transactionId: input.transactionId,
    decision: vietqrReconciliationDecisionSchema.parse(input.decision),
    orderId: input.orderId ?? null,
    reasonCode: input.reasonCode ?? null,
    requestId: input.requestId ?? crypto.randomUUID(),
  });
  return decisionResultSchema.parse(data);
}

export function getVietqrReconciliationStatusLabel(status: VietqrReconciliationStatus): string {
  switch (status) {
    case 'unmatched': return 'Chưa khớp';
    case 'matched': return 'Đã khớp';
    case 'needs_review': return 'Cần kiểm tra';
    case 'settled': return 'Đã ghi có';
    case 'ignored': return 'Đã bỏ qua';
    case 'rejected': return 'Đã từ chối';
  }
}
