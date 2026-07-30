export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type RpcDefinition<Args, Returns> = { Args: Args; Returns: Returns };

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<{
        id: string;
        username: string | null;
        display_name: string | null;
        bio: string | null;
        gender: Database['public']['Enums']['gender_identity'];
        province_id: number | null;
        interests: string[];
        avatar_media_id: string | null;
        profile_status: Database['public']['Enums']['profile_status'];
        discovery_enabled: boolean;
        nearby_enabled: boolean;
        is_creator: boolean;
        last_active_at: string | null;
        username_changed_at: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      creator_profiles: TableDefinition<{
        user_id: string;
        creator_status: Database['public']['Enums']['creator_status'];
        creator_bio: string | null;
        fan_threshold_units: number;
        payout_eligible: boolean;
        joined_at: string;
        approved_at: string | null;
        suspended_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      administrative_areas: TableDefinition<{
        id: number;
        code: string;
        name_vi: string;
        name_en: string | null;
        area_type: string;
        parent_id: number | null;
        country_code: string;
        sort_order: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      friendships: TableDefinition<{
        id: string;
        requester_id: string;
        addressee_id: string;
        pair_low_id: string | null;
        pair_high_id: string | null;
        status: Database['public']['Enums']['friendship_status'];
        greeting_message: string | null;
        created_at: string;
        responded_at: string | null;
        updated_at: string;
      }>;
      user_blocks: TableDefinition<{
        blocker_id: string;
        blocked_id: string;
        reason_code: string | null;
        created_at: string;
      }>;
      reports: TableDefinition<{
        id: string;
        reporter_id: string;
        target_user_id: string | null;
        target_media_id: string | null;
        target_message_id: string | null;
        reason_code: string;
        description: string | null;
        evidence_json: Json;
        status: Database['public']['Enums']['report_status'];
        created_at: string;
        updated_at: string;
      }>;
      conversations: TableDefinition<{
        id: string;
        friendship_id: string;
        conversation_type: 'direct';
        last_message_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      conversation_members: TableDefinition<{
        conversation_id: string;
        user_id: string;
        joined_at: string;
        last_read_message_id: string | null;
        last_read_at: string | null;
        is_muted: boolean;
        created_at: string;
        updated_at: string;
      }>;
      messages: TableDefinition<{
        id: string;
        conversation_id: string;
        sender_id: string;
        message_type: Database['public']['Enums']['message_type'];
        body: string | null;
        gift_transaction_id: string | null;
        client_message_id: string;
        moderation_status: Database['public']['Enums']['message_moderation_status'];
        sent_at: string;
        deleted_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      media_assets: TableDefinition<{
        id: string;
        owner_id: string;
        storage_bucket: string;
        storage_path: string;
        media_type: 'image' | 'document';
        mime_type: string;
        file_size_bytes: number;
        width: number | null;
        height: number | null;
        sha256: string | null;
        visibility: Database['public']['Enums']['media_visibility'];
        moderation_status: Database['public']['Enums']['media_moderation_status'];
        moderation_reason_code: string | null;
        uploaded_at: string | null;
        approved_at: string | null;
        approved_by: string | null;
        rejected_at: string | null;
        deleted_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      albums: TableDefinition<{
        id: string;
        owner_id: string;
        name: string;
        album_type: Database['public']['Enums']['album_type'];
        fan_threshold_units: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      album_media: TableDefinition<{
        album_id: string;
        media_id: string;
        sort_order: number;
        created_at: string;
      }>;
      gift_catalog: TableDefinition<{
        id: string;
        slug: string;
        name_vi: string;
        name_en: string;
        icon_media_id: string | null;
        heart_price_units: number;
        display_hearts: number;
        is_active: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      get_public_app_config: RpcDefinition<Record<string, never>, Array<{
        key: string;
        value_json: Json;
        value_type: string;
        updated_at: string;
      }>>;
      get_my_onboarding_status: RpcDefinition<Record<string, never>, Array<{
        user_id: string;
        age_verified: boolean;
        policies_accepted: boolean;
        creator_terms_accepted: boolean;
        account_status: string;
        profile_status: string;
      }>>;
      complete_my_onboarding: RpcDefinition<Record<string, unknown>, Array<{
        user_id: string;
        age_verified: boolean;
        account_status: string;
        completed_at: string;
      }>>;
      update_my_profile: RpcDefinition<{
        p_username: string;
        p_display_name: string;
        p_bio?: string | null;
        p_gender?: Database['public']['Enums']['gender_identity'];
        p_province_id?: number | null;
        p_interests?: string[];
        p_discovery_enabled?: boolean;
        p_nearby_enabled?: boolean;
      }, Database['public']['Tables']['profiles']['Row']>;
      prepare_media_upload: RpcDefinition<{
        p_visibility: Database['public']['Enums']['media_visibility'];
        p_mime_type: string;
        p_file_size_bytes: number;
        p_width: number;
        p_height: number;
        p_sha256?: string | null;
        p_extension?: string;
      }, Array<{
        media_id: string;
        storage_bucket: string;
        storage_path: string;
        moderation_status: Database['public']['Enums']['media_moderation_status'];
      }>>;
      finalize_media_upload: RpcDefinition<{
        p_media_id: string;
      }, Database['public']['Tables']['media_assets']['Row']>;
      list_my_media: RpcDefinition<{
        p_limit?: number;
        p_cursor?: string | null;
      }, Array<{
        id: string;
        storage_bucket: string;
        storage_path: string;
        media_type: 'image' | 'document';
        mime_type: string;
        file_size_bytes: number;
        width: number | null;
        height: number | null;
        visibility: Database['public']['Enums']['media_visibility'];
        moderation_status: Database['public']['Enums']['media_moderation_status'];
        moderation_reason_code: string | null;
        uploaded_at: string | null;
        approved_at: string | null;
        rejected_at: string | null;
        deleted_at: string | null;
        created_at: string;
      }>>;
      list_profile_album_media: RpcDefinition<{
        p_owner_id: string;
        p_album_type?: Database['public']['Enums']['album_type'] | null;
      }, Array<{
        album_id: string;
        album_name: string;
        album_type: Database['public']['Enums']['album_type'];
        fan_threshold_units: number;
        media_id: string;
        storage_bucket: string;
        storage_path: string;
        media_type: 'image' | 'document';
        mime_type: string;
        width: number | null;
        height: number | null;
        visibility: Database['public']['Enums']['media_visibility'];
        sort_order: number;
        uploaded_at: string | null;
        approved_at: string | null;
      }>>;
      set_my_avatar: RpcDefinition<{ p_media_id: string }, boolean>;
      delete_my_media: RpcDefinition<{
        p_media_id: string;
        p_request_id: string;
      }, Database['public']['Tables']['media_assets']['Row']>;
      set_my_location: RpcDefinition<Record<string, unknown>, Array<{
        is_enabled: boolean;
        captured_at: string;
        expires_at: string;
      }>>;
      disable_my_location: RpcDefinition<Record<string, never>, boolean>;
      find_nearby_profiles: RpcDefinition<Record<string, unknown>, Array<{
        id: string;
        username: string;
        display_name: string;
        bio: string;
        gender: Database['public']['Enums']['gender_identity'];
        province_id: number;
        avatar_media_id: string;
        is_creator: boolean;
        distance_bucket: string;
      }>>;
      find_province_profiles: RpcDefinition<Record<string, unknown>, Database['public']['Tables']['profiles']['Row'][]>;
      send_friend_request: RpcDefinition<Record<string, unknown>, Database['public']['Tables']['friendships']['Row']>;
      respond_to_friend_request: RpcDefinition<Record<string, unknown>, Database['public']['Tables']['friendships']['Row']>;
      cancel_friend_request: RpcDefinition<{ p_friendship_id: string }, boolean>;
      block_user: RpcDefinition<Record<string, unknown>, boolean>;
      unblock_user: RpcDefinition<{ p_blocked_id: string }, boolean>;
      create_report: RpcDefinition<Record<string, unknown>, string>;
      send_message: RpcDefinition<Record<string, unknown>, Database['public']['Tables']['messages']['Row']>;
      get_my_economy_summary: RpcDefinition<Record<string, never>, Array<{
        user_id: string;
        heart_available_units: number;
        heart_held_units: number;
        creator_pending_units: number;
        creator_available_units: number;
        creator_held_units: number;
        creator_paid_units: number;
        creator_frozen: boolean;
      }>>;
      get_my_account_deletion_status: RpcDefinition<Record<string, never>, Array<{
        id: string;
        status: string;
        requested_at: string;
        scheduled_delete_at: string;
        cancelled_at: string | null;
        processed_at: string | null;
        legal_hold: boolean;
      }>>;
      request_account_deletion: RpcDefinition<Record<string, unknown>, Array<{
        deletion_request_id: string;
        status: string;
        scheduled_delete_at: string;
        legal_hold: boolean;
        already_processed: boolean;
      }>>;
    };
    Enums: {
      gender_identity: 'female' | 'male' | 'non_binary' | 'other' | 'prefer_not_to_say';
      profile_status: 'incomplete' | 'pending_review' | 'active' | 'suspended' | 'deactivated' | 'deleted';
      creator_status: 'not_applied' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'closed';
      friendship_status: 'pending' | 'accepted' | 'declined' | 'cancelled';
      media_visibility: 'avatar' | 'public' | 'fan' | 'private' | 'kyc';
      media_moderation_status: 'pending_upload' | 'pending_review' | 'approved' | 'rejected' | 'quarantined' | 'deleted';
      album_type: 'public' | 'fan';
      message_type: 'text' | 'gift' | 'system';
      message_moderation_status: 'unreviewed' | 'approved' | 'flagged' | 'removed';
      report_status: 'submitted' | 'triaged' | 'in_review' | 'resolved' | 'dismissed';
    };
    CompositeTypes: Record<string, never>;
  };
};
