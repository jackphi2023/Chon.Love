import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;
type ProfileMediaRow = Database['public']['Tables']['media_assets']['Row'];

const dateOfBirthRowSchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable(),
});

const updatedDateOfBirthRowSchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  age_verified: z.boolean(),
});

function firstRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

export async function getMyDateOfBirth(client: Client): Promise<string | null> {
  const { data, error } = await client.rpc('get_my_date_of_birth_v2' as never);
  if (error) throw error;
  const parsed = dateOfBirthRowSchema.safeParse(firstRow(data));
  if (!parsed.success) throw new Error('profile_date_of_birth_response_invalid');
  return parsed.data.date_of_birth;
}

export async function updateMyDateOfBirth(client: Client, dateOfBirth: string): Promise<string> {
  const { data, error } = await client.rpc(
    'update_my_date_of_birth_v2' as never,
    { p_date_of_birth: dateOfBirth } as never,
  );
  if (error) throw error;
  const parsed = updatedDateOfBirthRowSchema.safeParse(firstRow(data));
  if (!parsed.success || !parsed.data.age_verified) throw new Error('profile_date_of_birth_update_failed');
  return parsed.data.date_of_birth;
}

export async function deleteMyMedia(client: Client, mediaId: string): Promise<ProfileMediaRow> {
  const { data, error } = await client.rpc('delete_my_media', {
    p_media_id: mediaId,
  });
  if (error) throw error;
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('profile_media_delete_failed');
  return data as ProfileMediaRow;
}
