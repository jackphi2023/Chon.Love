import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

const listingApprovalStateSchema = z.enum(['not_started', 'pending', 'approved', 'rejected']);
const memberVisibilityStatusSchema = z.object({
  listing_status: listingApprovalStateSchema,
  listing_submitted_at: z.string().nullable(),
  listing_reviewed_at: z.string().nullable(),
  is_paid_override: z.boolean(),
  discovery_preference_enabled: z.boolean(),
  effective_discoverable: z.boolean(),
});

export type ListingApprovalState = z.infer<typeof listingApprovalStateSchema>;
export type MemberVisibilityStatus = z.infer<typeof memberVisibilityStatusSchema>;

function firstRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

export async function getMyMemberVisibilityStatus(client: Client): Promise<MemberVisibilityStatus> {
  const { data, error } = await client.rpc('get_my_listing_approval_status' as never);
  if (error) throw error;
  return memberVisibilityStatusSchema.parse(firstRow(data));
}

export function isMemberAwaitingListingApproval(status: MemberVisibilityStatus | null | undefined): boolean {
  return Boolean(status && status.listing_status === 'pending' && !status.is_paid_override);
}
