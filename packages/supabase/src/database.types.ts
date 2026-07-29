export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
type ReportStatus = 'submitted' | 'triaged' | 'in_review' | 'resolved' | 'dismissed';
type ReportPriority = 'low' | 'normal' | 'high' | 'urgent';
type ConversationType = 'direct';
type MessageType = 'text' | 'gift' | 'system';
type MessageModerationStatus = 'unreviewed' | 'approved' | 'flagged' | 'removed';
type CreatorStatus = 'not_applied' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'closed';
type GenderIdentity = 'female' | 'male' | 'non_binary' | 'other' | 'prefer_not_to_say';
type ProfileStatus = 'incomplete' | 'pending_review' | 'active' | 'suspended' | 'deactivated' | 'deleted';

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      administrative_areas: {
        Row: { area_type: string; code: string; country_code: string; created_at: string; id: number; is_active: boolean; name_en: string | null; name_vi: string; parent_id: number | null; sort_order: number; updated_at: string };
        Insert: { area_type: string; code: string; country_code?: string; created_at?: string; id?: number; is_active?: boolean; name_en?: string | null; name_vi: string; parent_id?: number | null; sort_order?: number; updated_at?: string };
        Update: { area_type?: string; code?: string; country_code?: string; created_at?: string; id?: number; is_active?: boolean; name_en?: string | null; name_vi?: string; parent_id?: number | null; sort_order?: number; updated_at?: string };
        Relationships: [];
      };
      conversation_members: {
        Row: { conversation_id: string; created_at: string; is_muted: boolean; joined_at: string; last_read_at: string | null; last_read_message_id: string | null; updated_at: string; user_id: string };
        Insert: { conversation_id: string; created_at?: string; is_muted?: boolean; joined_at?: string; last_read_at?: string | null; last_read_message_id?: string | null; updated_at?: string; user_id: string };
        Update: { conversation_id?: string; created_at?: string; is_muted?: boolean; joined_at?: string; last_read_at?: string | null; last_read_message_id?: string | null; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      conversations: {
        Row: { conversation_type: ConversationType; created_at: string; friendship_id: string; id: string; last_message_at: string | null; updated_at: string };
        Insert: { conversation_type?: ConversationType; created_at?: string; friendship_id: string; id?: string; last_message_at?: string | null; updated_at?: string };
        Update: { conversation_type?: ConversationType; created_at?: string; friendship_id?: string; id?: string; last_message_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      creator_profiles: {
        Row: { approved_at: string | null; created_at: string; creator_bio: string | null; creator_status: CreatorStatus; fan_threshold_units: number; joined_at: string; payout_eligible: boolean; suspended_at: string | null; updated_at: string; user_id: string };
        Insert: { approved_at?: string | null; created_at?: string; creator_bio?: string | null; creator_status?: CreatorStatus; fan_threshold_units?: number; joined_at?: string; payout_eligible?: boolean; suspended_at?: string | null; updated_at?: string; user_id: string };
        Update: { approved_at?: string | null; created_at?: string; creator_bio?: string | null; creator_status?: CreatorStatus; fan_threshold_units?: number; joined_at?: string; payout_eligible?: boolean; suspended_at?: string | null; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      friendships: {
        Row: { addressee_id: string; created_at: string; greeting_message: string | null; id: string; pair_high_id: string | null; pair_low_id: string | null; requester_id: string; responded_at: string | null; status: FriendshipStatus; updated_at: string };
        Insert: { addressee_id: string; created_at?: string; greeting_message?: string | null; id?: string; requester_id: string; responded_at?: string | null; status?: FriendshipStatus; updated_at?: string };
        Update: { addressee_id?: string; created_at?: string; greeting_message?: string | null; id?: string; requester_id?: string; responded_at?: string | null; status?: FriendshipStatus; updated_at?: string };
        Relationships: [];
      };
      messages: {
        Row: { body: string | null; client_message_id: string; conversation_id: string; created_at: string; deleted_at: string | null; edited_at: string | null; gift_transaction_id: string | null; id: string; message_type: MessageType; moderation_status: MessageModerationStatus; sender_id: string; sent_at: string; updated_at: string };
        Insert: { body?: string | null; client_message_id: string; conversation_id: string; created_at?: string; deleted_at?: string | null; edited_at?: string | null; gift_transaction_id?: string | null; id?: string; message_type?: MessageType; moderation_status?: MessageModerationStatus; sender_id: string; sent_at?: string; updated_at?: string };
        Update: { body?: string | null; client_message_id?: string; conversation_id?: string; created_at?: string; deleted_at?: string | null; edited_at?: string | null; gift_transaction_id?: string | null; id?: string; message_type?: MessageType; moderation_status?: MessageModerationStatus; sender_id?: string; sent_at?: string; updated_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: { avatar_media_id: string | null; bio: string | null; created_at: string; deleted_at: string | null; discovery_enabled: boolean; display_name: string | null; gender: GenderIdentity; id: string; is_creator: boolean; last_active_at: string | null; nearby_enabled: boolean; profile_status: ProfileStatus; province_id: number | null; updated_at: string; username: string | null; username_changed_at: string | null };
        Insert: { avatar_media_id?: string | null; bio?: string | null; created_at?: string; deleted_at?: string | null; discovery_enabled?: boolean; display_name?: string | null; gender?: GenderIdentity; id: string; is_creator?: boolean; last_active_at?: string | null; nearby_enabled?: boolean; profile_status?: ProfileStatus; province_id?: number | null; updated_at?: string; username?: string | null; username_changed_at?: string | null };
        Update: { avatar_media_id?: string | null; bio?: string | null; created_at?: string; deleted_at?: string | null; discovery_enabled?: boolean; display_name?: string | null; gender?: GenderIdentity; id?: string; is_creator?: boolean; last_active_at?: string | null; nearby_enabled?: boolean; profile_status?: ProfileStatus; province_id?: number | null; updated_at?: string; username?: string | null; username_changed_at?: string | null };
        Relationships: [];
      };
      reports: {
        Row: { assigned_to: string | null; created_at: string; description: string | null; evidence_json: Json; id: string; priority: ReportPriority; reason_code: string; reporter_id: string; resolution_code: string | null; resolved_at: string | null; status: ReportStatus; target_media_id: string | null; target_message_id: string | null; target_user_id: string | null; updated_at: string };
        Insert: { assigned_to?: string | null; created_at?: string; description?: string | null; evidence_json?: Json; id?: string; priority?: ReportPriority; reason_code: string; reporter_id: string; resolution_code?: string | null; resolved_at?: string | null; status?: ReportStatus; target_media_id?: string | null; target_message_id?: string | null; target_user_id?: string | null; updated_at?: string };
        Update: { assigned_to?: string | null; created_at?: string; description?: string | null; evidence_json?: Json; id?: string; priority?: ReportPriority; reason_code?: string; reporter_id?: string; resolution_code?: string | null; resolved_at?: string | null; status?: ReportStatus; target_media_id?: string | null; target_message_id?: string | null; target_user_id?: string | null; updated_at?: string };
        Relationships: [];
      };
      user_blocks: {
        Row: { blocked_id: string; blocker_id: string; created_at: string; reason_code: string | null };
        Insert: { blocked_id: string; blocker_id: string; created_at?: string; reason_code?: string | null };
        Update: { blocked_id?: string; blocker_id?: string; created_at?: string; reason_code?: string | null };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      block_user: { Args: { p_blocked_id: string; p_reason_code?: string }; Returns: boolean };
      cancel_friend_request: { Args: { p_friendship_id: string }; Returns: boolean };
      complete_my_onboarding: { Args: { p_age_verification_method?: string; p_community_rules_version: string; p_date_of_birth: string; p_terms_version: string }; Returns: { account_status: string; age_verified: boolean; completed_at: string; user_id: string }[] };
      create_report: { Args: { p_description?: string; p_evidence_json?: Json; p_reason_code?: string; p_target_media_id?: string; p_target_message_id?: string; p_target_user_id?: string }; Returns: string };
      disable_my_location: { Args: never; Returns: boolean };
      find_nearby_profiles: { Args: { p_cursor?: string; p_limit?: number; p_radius_meters?: number }; Returns: { avatar_media_id: string; bio: string; display_name: string; distance_bucket: string; gender: GenderIdentity; id: string; is_creator: boolean; province_id: number; username: string }[] };
      find_province_profiles: { Args: { p_cursor?: string; p_limit?: number; p_province_id: number }; Returns: Database['public']['Tables']['profiles']['Row'][] };
      get_my_onboarding_status: { Args: never; Returns: { account_status: string; age_verified: boolean; creator_terms_accepted: boolean; policies_accepted: boolean; profile_status: string; user_id: string }[] };
      get_my_reports: { Args: { p_cursor?: string; p_limit?: number }; Returns: { created_at: string; id: string; reason_code: string; resolved_at: string | null; status: ReportStatus; target_type: string }[] };
      get_public_app_config: { Args: never; Returns: { key: string; updated_at: string; value_json: Json; value_type: string }[] };
      is_current_user_adult: { Args: never; Returns: boolean };
      mark_conversation_read: { Args: { p_conversation_id: string; p_message_id?: string }; Returns: boolean };
      respond_to_friend_request: { Args: { p_accept: boolean; p_friendship_id: string }; Returns: Database['public']['Tables']['friendships']['Row'] };
      send_friend_request: { Args: { p_addressee_id: string; p_greeting_message?: string }; Returns: Database['public']['Tables']['friendships']['Row'] };
      send_message: { Args: { p_body: string; p_client_message_id: string; p_conversation_id: string }; Returns: Database['public']['Tables']['messages']['Row'] };
      set_my_location: { Args: { p_accuracy_meters: number; p_captured_at: string; p_latitude: number; p_longitude: number; p_source?: string }; Returns: { captured_at: string; expires_at: string; is_enabled: boolean }[] };
      unblock_user: { Args: { p_blocked_id: string }; Returns: boolean };
      update_my_profile: { Args: { p_bio?: string; p_discovery_enabled?: boolean; p_display_name: string; p_gender?: GenderIdentity; p_nearby_enabled?: boolean; p_province_id?: number; p_username: string }; Returns: Database['public']['Tables']['profiles']['Row'] };
    };
    Enums: {
      conversation_type: ConversationType;
      creator_status: CreatorStatus;
      friendship_status: FriendshipStatus;
      gender_identity: GenderIdentity;
      message_moderation_status: MessageModerationStatus;
      message_type: MessageType;
      profile_status: ProfileStatus;
      report_priority: ReportPriority;
      report_status: ReportStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals['public'];
export type Tables<T extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])> = (DefaultSchema['Tables'] & DefaultSchema['Views'])[T] extends { Row: infer R } ? R : never;
export type TablesInsert<T extends keyof DefaultSchema['Tables']> = DefaultSchema['Tables'][T] extends { Insert: infer I } ? I : never;
export type TablesUpdate<T extends keyof DefaultSchema['Tables']> = DefaultSchema['Tables'][T] extends { Update: infer U } ? U : never;
export type Enums<T extends keyof DefaultSchema['Enums']> = DefaultSchema['Enums'][T];
export type CompositeTypes<T extends keyof DefaultSchema['CompositeTypes']> = DefaultSchema['CompositeTypes'][T];

export const Constants = {
  public: {
    Enums: {
      conversation_type: ['direct'],
      creator_status: ['not_applied', 'pending', 'approved', 'rejected', 'suspended', 'closed'],
      friendship_status: ['pending', 'accepted', 'declined', 'cancelled'],
      gender_identity: ['female', 'male', 'non_binary', 'other', 'prefer_not_to_say'],
      message_moderation_status: ['unreviewed', 'approved', 'flagged', 'removed'],
      message_type: ['text', 'gift', 'system'],
      profile_status: ['incomplete', 'pending_review', 'active', 'suspended', 'deactivated', 'deleted'],
      report_priority: ['low', 'normal', 'high', 'urgent'],
      report_status: ['submitted', 'triaged', 'in_review', 'resolved', 'dismissed'],
    },
  },
} as const;
