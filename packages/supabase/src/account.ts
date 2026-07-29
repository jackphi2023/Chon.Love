import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';

export type PublicAppConfigEntry = {
  key: string;
  value_json: Json;
  value_type: string;
  updated_at: string;
};

export type AccountBootstrap = {
  user_id: string;
  profile_status: string;
  account_status: string;
  is_adult_verified: boolean;
  terms_accepted: boolean;
  community_rules_accepted: boolean;
  creator_status: string;
  is_creator: boolean;
  payout_eligible: boolean;
};

export type AdultOnboardingInput = {
  dateOfBirth: string;
  confirms18: boolean;
  termsVersion: string;
  communityRulesVersion: string;
  username: string;
  displayName: string;
  bio?: string | null;
  gender?: string | null;
  provinceId?: string | null;
};

export type AdultOnboardingResult = {
  profile_id: string;
  profile_status: string;
  account_status: string;
};

function firstOrThrow<T>(rows: T[] | null, operation: string): T {
  const first = rows?.[0];
  if (!first) {
    throw new Error(`${operation} returned no row.`);
  }
  return first;
}

export async function getPublicAppConfig(
  client: SupabaseClient<Database>,
): Promise<PublicAppConfigEntry[]> {
  const { data, error } = await client.rpc('get_public_app_config');
  if (error) throw error;
  return data ?? [];
}

export async function getMyAccountBootstrap(
  client: SupabaseClient<Database>,
): Promise<AccountBootstrap> {
  const { data, error } = await client.rpc('get_my_account_bootstrap');
  if (error) throw error;
  return firstOrThrow(data, 'get_my_account_bootstrap');
}

export async function completeAdultOnboarding(
  client: SupabaseClient<Database>,
  input: AdultOnboardingInput,
): Promise<AdultOnboardingResult> {
  const args: Database['public']['Functions']['complete_adult_onboarding']['Args'] = {
    p_date_of_birth: input.dateOfBirth,
    p_confirms_18: input.confirms18,
    p_terms_version: input.termsVersion,
    p_community_rules_version: input.communityRulesVersion,
    p_username: input.username,
    p_display_name: input.displayName,
    ...(input.bio == null ? {} : { p_bio: input.bio }),
    ...(input.gender == null ? {} : { p_gender: input.gender }),
    ...(input.provinceId == null ? {} : { p_province_id: input.provinceId }),
  };

  const { data, error } = await client.rpc('complete_adult_onboarding', args);
  if (error) throw error;
  return firstOrThrow(data, 'complete_adult_onboarding');
}

export async function acceptCreatorTerms(
  client: SupabaseClient<Database>,
  creatorTermsVersion: string,
): Promise<string> {
  const { data, error } = await client.rpc('accept_creator_terms', {
    p_creator_terms_version: creatorTermsVersion,
  });
  if (error) throw error;
  return data;
}

export async function applyForCreator(
  client: SupabaseClient<Database>,
  creatorBio: string,
  fanThresholdUnits?: number | null,
): Promise<'pending'> {
  const args: Database['public']['Functions']['apply_for_creator']['Args'] = {
    p_creator_bio: creatorBio,
    ...(fanThresholdUnits == null ? {} : { p_fan_threshold_units: fanThresholdUnits }),
  };

  const { data, error } = await client.rpc('apply_for_creator', args);
  if (error) throw error;
  if (data !== 'pending') {
    throw new Error('Unexpected Creator application status.');
  }
  return data;
}
