export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      administrative_areas: {
        Row: {
          area_type: string
          code: string
          country_code: string
          created_at: string
          id: number
          is_active: boolean
          name_en: string | null
          name_vi: string
          parent_id: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          area_type: string
          code: string
          country_code?: string
          created_at?: string
          id?: number
          is_active?: boolean
          name_en?: string | null
          name_vi: string
          parent_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area_type?: string
          code?: string
          country_code?: string
          created_at?: string
          id?: number
          is_active?: boolean
          name_en?: string | null
          name_vi?: string
          parent_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "administrative_areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "administrative_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      album_media: {
        Row: {
          album_id: string
          created_at: string
          media_id: string
          sort_order: number
        }
        Insert: {
          album_id: string
          created_at?: string
          media_id: string
          sort_order?: number
        }
        Update: {
          album_id?: string
          created_at?: string
          media_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "album_media_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          album_type: Database["public"]["Enums"]["album_type"]
          created_at: string
          deleted_at: string | null
          fan_threshold_units: number
          id: string
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          album_type: Database["public"]["Enums"]["album_type"]
          created_at?: string
          deleted_at?: string | null
          fan_threshold_units?: number
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          album_type?: Database["public"]["Enums"]["album_type"]
          created_at?: string
          deleted_at?: string | null
          fan_threshold_units?: number
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          created_at: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          last_read_message_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_last_read_message_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          auto_delete_messages_after_days: number | null
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          friendship_id: string
          id: string
          last_message_at: string | null
          message_retention_updated_at: string | null
          message_retention_updated_by: string | null
          updated_at: string
        }
        Insert: {
          auto_delete_messages_after_days?: number | null
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          friendship_id: string
          id?: string
          last_message_at?: string | null
          message_retention_updated_at?: string | null
          message_retention_updated_by?: string | null
          updated_at?: string
        }
        Update: {
          auto_delete_messages_after_days?: number | null
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          friendship_id?: string
          id?: string
          last_message_at?: string | null
          message_retention_updated_at?: string | null
          message_retention_updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_friendship_id_fkey"
            columns: ["friendship_id"]
            isOneToOne: true
            referencedRelation: "friendships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_message_retention_updated_by_fkey"
            columns: ["message_retention_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_post_media: {
        Row: {
          created_at: string
          media_id: string
          post_id: string
          preview_bucket: string
          preview_error_code: string | null
          preview_height: number | null
          preview_path: string | null
          preview_status: Database["public"]["Enums"]["creator_activity_preview_status"]
          preview_width: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          media_id: string
          post_id: string
          preview_bucket?: string
          preview_error_code?: string | null
          preview_height?: number | null
          preview_path?: string | null
          preview_status?: Database["public"]["Enums"]["creator_activity_preview_status"]
          preview_width?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          media_id?: string
          post_id?: string
          preview_bucket?: string
          preview_error_code?: string | null
          preview_height?: number | null
          preview_path?: string | null
          preview_status?: Database["public"]["Enums"]["creator_activity_preview_status"]
          preview_width?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_post_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "creator_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_posts: {
        Row: {
          archived_at: string | null
          body: string
          content_type: Database["public"]["Enums"]["creator_activity_content_type"]
          created_at: string
          creator_id: string
          deleted_at: string | null
          external_metadata: Json
          external_provider: string | null
          external_url: string | null
          external_video_id: string | null
          id: string
          image_access_mode: Database["public"]["Enums"]["creator_activity_image_access_mode"]
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["creator_activity_moderation_status"]
          published_at: string | null
          required_gift_id: string | null
          required_gift_units_snapshot: number | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          content_type: Database["public"]["Enums"]["creator_activity_content_type"]
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          external_metadata?: Json
          external_provider?: string | null
          external_url?: string | null
          external_video_id?: string | null
          id?: string
          image_access_mode?: Database["public"]["Enums"]["creator_activity_image_access_mode"]
          moderation_reason_code?: string | null
          moderation_status?: Database["public"]["Enums"]["creator_activity_moderation_status"]
          published_at?: string | null
          required_gift_id?: string | null
          required_gift_units_snapshot?: number | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          content_type?: Database["public"]["Enums"]["creator_activity_content_type"]
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          external_metadata?: Json
          external_provider?: string | null
          external_url?: string | null
          external_video_id?: string | null
          id?: string
          image_access_mode?: Database["public"]["Enums"]["creator_activity_image_access_mode"]
          moderation_reason_code?: string | null
          moderation_status?: Database["public"]["Enums"]["creator_activity_moderation_status"]
          published_at?: string | null
          required_gift_id?: string | null
          required_gift_units_snapshot?: number | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_posts_required_gift_id_fkey"
            columns: ["required_gift_id"]
            isOneToOne: false
            referencedRelation: "gift_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          activity_visibility: Database["public"]["Enums"]["creator_activity_visibility"]
          activity_visibility_updated_at: string
          approved_at: string | null
          created_at: string
          creator_bio: string | null
          creator_status: Database["public"]["Enums"]["creator_status"]
          fan_threshold_units: number
          joined_at: string
          payout_eligible: boolean
          suspended_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_visibility?: Database["public"]["Enums"]["creator_activity_visibility"]
          activity_visibility_updated_at?: string
          approved_at?: string | null
          created_at?: string
          creator_bio?: string | null
          creator_status?: Database["public"]["Enums"]["creator_status"]
          fan_threshold_units?: number
          joined_at?: string
          payout_eligible?: boolean
          suspended_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_visibility?: Database["public"]["Enums"]["creator_activity_visibility"]
          activity_visibility_updated_at?: string
          approved_at?: string | null
          created_at?: string
          creator_bio?: string | null
          creator_status?: Database["public"]["Enums"]["creator_status"]
          fan_threshold_units?: number
          joined_at?: string
          payout_eligible?: boolean
          suspended_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      economy_sync: {
        Row: {
          creator_account_version: number
          heart_account_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          creator_account_version?: number
          heart_account_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          creator_account_version?: number
          heart_account_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "economy_sync_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_memberships: {
        Row: {
          achieved_at: string
          created_at: string
          creator_id: string
          fan_user_id: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["fan_membership_status"]
          updated_at: string
        }
        Insert: {
          achieved_at: string
          created_at?: string
          creator_id: string
          fan_user_id: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["fan_membership_status"]
          updated_at?: string
        }
        Update: {
          achieved_at?: string
          created_at?: string
          creator_id?: string
          fan_user_id?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["fan_membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_memberships_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fan_memberships_fan_user_id_fkey"
            columns: ["fan_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_progress: {
        Row: {
          created_at: string
          creator_id: string
          eligible_units: number
          fan_user_id: string
          lifetime_supported_units: number
          threshold_units: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          eligible_units?: number
          fan_user_id: string
          lifetime_supported_units?: number
          threshold_units: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          eligible_units?: number
          fan_user_id?: string
          lifetime_supported_units?: number
          threshold_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_progress_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fan_progress_fan_user_id_fkey"
            columns: ["fan_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          greeting_message: string | null
          id: string
          pair_high_id: string | null
          pair_low_id: string | null
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          greeting_message?: string | null
          id?: string
          pair_high_id?: string | null
          pair_low_id?: string | null
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          greeting_message?: string | null
          id?: string
          pair_high_id?: string | null
          pair_low_id?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_catalog: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_hearts: number
          heart_price_units: number
          icon_emoji: string
          icon_media_id: string | null
          id: string
          is_active: boolean
          name_en: string
          name_vi: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_hearts: number
          heart_price_units: number
          icon_emoji: string
          icon_media_id?: string | null
          id?: string
          is_active?: boolean
          name_en: string
          name_vi: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_hearts?: number
          heart_price_units?: number
          icon_emoji?: string
          icon_media_id?: string | null
          id?: string
          is_active?: boolean
          name_en?: string
          name_vi?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_catalog_icon_media_id_fkey"
            columns: ["icon_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_transactions: {
        Row: {
          completed_at: string
          created_at: string
          creator_id: string
          creator_reward_units: number
          creator_share_bps: number
          gift_id: string
          gift_name_en_snapshot: string
          gift_name_vi_snapshot: string
          gift_slug_snapshot: string
          gross_heart_units: number
          id: string
          idempotency_key: string
          message_id: string | null
          platform_gross_units: number
          platform_share_bps: number
          quantity: number
          reversed_at: string | null
          reversed_creator_reward_units: number
          reversed_heart_units: number
          reversed_platform_units: number
          sender_id: string
          status: Database["public"]["Enums"]["gift_transaction_status"]
          unit_heart_units: number
          unlock_target_id: string | null
          unlock_target_type: string | null
        }
        Insert: {
          completed_at?: string
          created_at?: string
          creator_id: string
          creator_reward_units: number
          creator_share_bps: number
          gift_id: string
          gift_name_en_snapshot: string
          gift_name_vi_snapshot: string
          gift_slug_snapshot: string
          gross_heart_units: number
          id?: string
          idempotency_key: string
          message_id?: string | null
          platform_gross_units: number
          platform_share_bps: number
          quantity: number
          reversed_at?: string | null
          reversed_creator_reward_units?: number
          reversed_heart_units?: number
          reversed_platform_units?: number
          sender_id: string
          status?: Database["public"]["Enums"]["gift_transaction_status"]
          unit_heart_units: number
          unlock_target_id?: string | null
          unlock_target_type?: string | null
        }
        Update: {
          completed_at?: string
          created_at?: string
          creator_id?: string
          creator_reward_units?: number
          creator_share_bps?: number
          gift_id?: string
          gift_name_en_snapshot?: string
          gift_name_vi_snapshot?: string
          gift_slug_snapshot?: string
          gross_heart_units?: number
          id?: string
          idempotency_key?: string
          message_id?: string | null
          platform_gross_units?: number
          platform_share_bps?: number
          quantity?: number
          reversed_at?: string | null
          reversed_creator_reward_units?: number
          reversed_heart_units?: number
          reversed_platform_units?: number
          sender_id?: string
          status?: Database["public"]["Enums"]["gift_transaction_status"]
          unit_heart_units?: number
          unlock_target_id?: string | null
          unlock_target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gift_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_unlock_target_id_fkey"
            columns: ["unlock_target_id"]
            isOneToOne: false
            referencedRelation: "creator_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      heart_products: {
        Row: {
          created_at: string
          display_hearts: number
          google_product_id: string
          heart_units: number
          id: string
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_hearts: number
          google_product_id: string
          heart_units: number
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_hearts?: number
          google_product_id?: string
          heart_units?: number
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deleted_at: string | null
          file_size_bytes: number
          height: number | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          mime_type: string
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["media_moderation_status"]
          owner_id: string
          rejected_at: string | null
          sha256: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          uploaded_at: string | null
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size_bytes: number
          height?: number | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          mime_type: string
          moderation_reason_code?: string | null
          moderation_status?: Database["public"]["Enums"]["media_moderation_status"]
          owner_id: string
          rejected_at?: string | null
          sha256?: string | null
          storage_bucket: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string | null
          visibility: Database["public"]["Enums"]["media_visibility"]
          width?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size_bytes?: number
          height?: number | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          mime_type?: string
          moderation_reason_code?: string | null
          moderation_status?: Database["public"]["Enums"]["media_moderation_status"]
          owner_id?: string
          rejected_at?: string | null
          sha256?: string | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string | null
          visibility?: Database["public"]["Enums"]["media_visibility"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          client_message_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          gift_transaction_id: string | null
          id: string
          message_type: Database["public"]["Enums"]["message_type"]
          moderation_status: Database["public"]["Enums"]["message_moderation_status"]
          sender_id: string
          sent_at: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          client_message_id: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          gift_transaction_id?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          moderation_status?: Database["public"]["Enums"]["message_moderation_status"]
          sender_id: string
          sent_at?: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          client_message_id?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          gift_transaction_id?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          moderation_status?: Database["public"]["Enums"]["message_moderation_status"]
          sender_id?: string
          sent_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_gift_transaction_id_fkey"
            columns: ["gift_transaction_id"]
            isOneToOne: false
            referencedRelation: "gift_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          assigned_to: string | null
          automated_score_json: Json
          created_at: string
          decision: Database["public"]["Enums"]["moderation_decision"] | null
          decision_notes: string | null
          id: string
          media_id: string | null
          priority: Database["public"]["Enums"]["moderation_priority"]
          reported_message_id: string | null
          reported_user_id: string | null
          resolved_at: string | null
          rule_codes: string[]
          source: Database["public"]["Enums"]["moderation_source"]
          status: Database["public"]["Enums"]["moderation_case_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          automated_score_json?: Json
          created_at?: string
          decision?: Database["public"]["Enums"]["moderation_decision"] | null
          decision_notes?: string | null
          id?: string
          media_id?: string | null
          priority?: Database["public"]["Enums"]["moderation_priority"]
          reported_message_id?: string | null
          reported_user_id?: string | null
          resolved_at?: string | null
          rule_codes?: string[]
          source: Database["public"]["Enums"]["moderation_source"]
          status?: Database["public"]["Enums"]["moderation_case_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          automated_score_json?: Json
          created_at?: string
          decision?: Database["public"]["Enums"]["moderation_decision"] | null
          decision_notes?: string | null
          id?: string
          media_id?: string | null
          priority?: Database["public"]["Enums"]["moderation_priority"]
          reported_message_id?: string | null
          reported_user_id?: string | null
          resolved_at?: string | null
          rule_codes?: string[]
          source?: Database["public"]["Enums"]["moderation_source"]
          status?: Database["public"]["Enums"]["moderation_case_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_sync: {
        Row: {
          bank_version: number
          deletion_version: number
          kyc_version: number
          updated_at: string
          user_id: string
          withdrawal_version: number
        }
        Insert: {
          bank_version?: number
          deletion_version?: number
          kyc_version?: number
          updated_at?: string
          user_id: string
          withdrawal_version?: number
        }
        Update: {
          bank_version?: number
          deletion_version?: number
          kyc_version?: number
          updated_at?: string
          user_id?: string
          withdrawal_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_sync_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_favorites: {
        Row: {
          created_at: string
          favorite_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          favorite_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          favorite_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_favorites_favorite_id_fkey"
            columns: ["favorite_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_favorites_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          first_viewed_at: string
          last_viewed_at: string
          view_count: number
          viewed_id: string
          viewer_id: string
        }
        Insert: {
          first_viewed_at?: string
          last_viewed_at?: string
          view_count?: number
          viewed_id: string
          viewer_id: string
        }
        Update: {
          first_viewed_at?: string
          last_viewed_at?: string
          view_count?: number
          viewed_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_viewed_id_fkey"
            columns: ["viewed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_preference_max: number
          age_preference_min: number
          avatar_media_id: string | null
          bio: string | null
          children_status: Database["public"]["Enums"]["children_status"]
          created_at: string
          deleted_at: string | null
          discovery_enabled: boolean
          display_name: string | null
          drinking_status: Database["public"]["Enums"]["drinking_status"]
          education_level: Database["public"]["Enums"]["education_level"]
          gender: Database["public"]["Enums"]["gender_identity"]
          headline: string | null
          height_cm: number | null
          id: string
          interested_in: Database["public"]["Enums"]["dating_interest"]
          interests: string[]
          is_creator: boolean
          languages: string[]
          last_active_at: string | null
          lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          looking_for: string | null
          nearby_enabled: boolean
          occupation: string | null
          profile_status: Database["public"]["Enums"]["profile_status"]
          province_id: number | null
          relationship_status: Database["public"]["Enums"]["relationship_status"]
          smoking_status: Database["public"]["Enums"]["smoking_status"]
          updated_at: string
          username: string | null
          username_changed_at: string | null
          weight_kg: number | null
        }
        Insert: {
          age_preference_max?: number
          age_preference_min?: number
          avatar_media_id?: string | null
          bio?: string | null
          children_status?: Database["public"]["Enums"]["children_status"]
          created_at?: string
          deleted_at?: string | null
          discovery_enabled?: boolean
          display_name?: string | null
          drinking_status?: Database["public"]["Enums"]["drinking_status"]
          education_level?: Database["public"]["Enums"]["education_level"]
          gender?: Database["public"]["Enums"]["gender_identity"]
          headline?: string | null
          height_cm?: number | null
          id: string
          interested_in?: Database["public"]["Enums"]["dating_interest"]
          interests?: string[]
          is_creator?: boolean
          languages?: string[]
          last_active_at?: string | null
          lifestyle_tags?: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          looking_for?: string | null
          nearby_enabled?: boolean
          occupation?: string | null
          profile_status?: Database["public"]["Enums"]["profile_status"]
          province_id?: number | null
          relationship_status?: Database["public"]["Enums"]["relationship_status"]
          smoking_status?: Database["public"]["Enums"]["smoking_status"]
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          age_preference_max?: number
          age_preference_min?: number
          avatar_media_id?: string | null
          bio?: string | null
          children_status?: Database["public"]["Enums"]["children_status"]
          created_at?: string
          deleted_at?: string | null
          discovery_enabled?: boolean
          display_name?: string | null
          drinking_status?: Database["public"]["Enums"]["drinking_status"]
          education_level?: Database["public"]["Enums"]["education_level"]
          gender?: Database["public"]["Enums"]["gender_identity"]
          headline?: string | null
          height_cm?: number | null
          id?: string
          interested_in?: Database["public"]["Enums"]["dating_interest"]
          interests?: string[]
          is_creator?: boolean
          languages?: string[]
          last_active_at?: string | null
          lifestyle_tags?: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          looking_for?: string | null
          nearby_enabled?: boolean
          occupation?: string | null
          profile_status?: Database["public"]["Enums"]["profile_status"]
          province_id?: number | null
          relationship_status?: Database["public"]["Enums"]["relationship_status"]
          smoking_status?: Database["public"]["Enums"]["smoking_status"]
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_media_id_fkey"
            columns: ["avatar_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "administrative_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          evidence_json: Json
          id: string
          priority: Database["public"]["Enums"]["report_priority"]
          reason_code: string
          reporter_id: string
          resolution_code: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_creator_post_id: string | null
          target_media_id: string | null
          target_message_id: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          evidence_json?: Json
          id?: string
          priority?: Database["public"]["Enums"]["report_priority"]
          reason_code: string
          reporter_id: string
          resolution_code?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_creator_post_id?: string | null
          target_media_id?: string | null
          target_message_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          evidence_json?: Json
          id?: string
          priority?: Database["public"]["Enums"]["report_priority"]
          reason_code?: string
          reporter_id?: string
          resolution_code?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_creator_post_id?: string | null
          target_media_id?: string | null
          target_message_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_creator_post_id_fkey"
            columns: ["target_creator_post_id"]
            isOneToOne: false
            referencedRelation: "creator_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_media_id_fkey"
            columns: ["target_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_message_id_fkey"
            columns: ["target_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason_code: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason_code?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_media_to_album: {
        Args: { p_album_id: string; p_media_id: string; p_sort_order?: number }
        Returns: boolean
      }
      admin_create_account_hold: {
        Args: {
          p_actor_user_id: string
          p_ends_at: string
          p_hold_type: string
          p_reason_code: string
          p_request_id: string
          p_scope: string
          p_user_id: string
        }
        Returns: {
          already_processed: boolean
          ends_at: string
          hold_id: string
          scope: string
          starts_at: string
        }[]
      }
      admin_decide_vietqr_reconciliation: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_order_id: string
          p_reason_code: string
          p_request_id: string
          p_transaction_id: string
        }
        Returns: {
          already_processed: boolean
          balance_after_units: number
          matched_order_id: string
          purchase_id: string
          status: string
          transaction_id: string
        }[]
      }
      admin_decide_withdrawal: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_payment_reference: string
          p_reason_code: string
          p_request_id: string
          p_withdrawal_id: string
        }
        Returns: {
          already_processed: boolean
          held_balance_units: number
          paid_balance_units: number
          status: string
          withdrawal_id: string
        }[]
      }
      admin_import_vietqr_bank_transaction: {
        Args: {
          p_actor_user_id: string
          p_amount_vnd: number
          p_occurred_at: string
          p_payload_sha256: string
          p_provider: string
          p_provider_transaction_ref: string
          p_request_id: string
          p_transfer_content: string
        }
        Returns: {
          already_imported: boolean
          amount_vnd: number
          expected_amount_vnd: number
          matched_order_id: string
          order_code: string
          status: string
          transaction_id: string
        }[]
      }
      admin_list_bank_operational_queue: {
        Args: {
          p_actor_user_id: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          account_number_last4: string
          age_minutes: number
          assigned_to: string
          bank_account_id: string
          bank_code: string
          created_at: string
          display_name: string
          is_default: boolean
          review_due_at: string
          review_started_at: string
          status: string
          total_count: number
          user_id: string
        }[]
      }
      admin_list_kyc_operational_queue: {
        Args: {
          p_actor_user_id: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          age_minutes: number
          assigned_to: string
          country_code: string
          display_name: string
          document_count: number
          document_number_last4: string
          document_type: string
          kyc_profile_id: string
          review_due_at: string
          review_started_at: string
          status: string
          submitted_at: string
          total_count: number
          user_id: string
        }[]
      }
      admin_list_member_photo_verifications: {
        Args: { p_actor_user_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          automated_score_json: Json
          case_id: string
          case_status: string
          created_at: string
          declared_gender: string
          display_name: string
          max_similarity: number
          priority: string
          profile_status: string
          user_id: string
          username: string
        }[]
      }
      admin_list_vietqr_reconciliation_queue: {
        Args: {
          p_actor_user_id: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          amount_vnd: number
          created_at: string
          display_name: string
          expected_amount_vnd: number
          matched_order_id: string
          occurred_at: string
          order_code: string
          order_status: string
          provider: string
          provider_transaction_ref: string
          review_reason_code: string
          reviewed_at: string
          status: string
          total_count: number
          transaction_id: string
          transfer_content_raw: string
          user_id: string
        }[]
      }
      admin_list_withdrawal_operational_queue: {
        Args: {
          p_actor_user_id: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          age_minutes: number
          amount_vnd: number
          approved_by: string
          assigned_to: string
          bank_code: string
          bank_last4: string
          creator_id: string
          display_name: string
          payment_evidence_present: boolean
          payment_recorded_by: string
          payment_reference: string
          processing_started_by: string
          requested_at: string
          requested_reward_units: number
          review_due_at: string
          review_started_at: string
          status: string
          total_count: number
          withdrawal_id: string
        }[]
      }
      admin_operate_withdrawal: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_payment_evidence_sha256: string
          p_payment_reference: string
          p_reason_code: string
          p_request_id: string
          p_withdrawal_id: string
        }
        Returns: {
          already_processed: boolean
          approved_by: string
          held_balance_units: number
          paid_balance_units: number
          payment_recorded_by: string
          processing_started_by: string
          status: string
          withdrawal_id: string
        }[]
      }
      admin_process_account_deletion: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_deletion_request_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: {
          already_processed: boolean
          deletion_request_id: string
          status: string
        }[]
      }
      admin_release_account_hold: {
        Args: {
          p_actor_user_id: string
          p_hold_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: {
          already_processed: boolean
          hold_id: string
          released_at: string
        }[]
      }
      admin_review_bank_account: {
        Args: {
          p_actor_user_id: string
          p_bank_account_id: string
          p_decision: string
          p_reason_code: string
          p_request_id: string
        }
        Returns: {
          already_processed: boolean
          bank_account_id: string
          payout_eligible: boolean
          status: string
        }[]
      }
      admin_review_kyc: {
        Args: {
          p_actor_user_id: string
          p_decision: string
          p_expires_at: string
          p_kyc_profile_id: string
          p_reason_code: string
          p_request_id: string
        }
        Returns: {
          already_processed: boolean
          kyc_profile_id: string
          payout_eligible: boolean
          status: string
        }[]
      }
      admin_review_member_photo_verification: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_case_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: {
          case_id: string
          decision: string
          profile_status: string
          user_id: string
        }[]
      }
      admin_runtime_observability_snapshot: {
        Args: { p_actor_user_id: string; p_window_minutes?: number }
        Returns: {
          affected_users: number
          event_count: number
          event_name: string
          latest_at: string
          retryable_count: number
          severity: string
        }[]
      }
      admin_start_bank_review: {
        Args: {
          p_actor_user_id: string
          p_bank_account_id: string
          p_request_id: string
        }
        Returns: {
          already_processed: boolean
          assigned_to: string
          bank_account_id: string
          review_due_at: string
          status: string
        }[]
      }
      admin_start_kyc_review: {
        Args: {
          p_actor_user_id: string
          p_kyc_profile_id: string
          p_request_id: string
        }
        Returns: {
          already_processed: boolean
          assigned_to: string
          kyc_profile_id: string
          review_due_at: string
          status: string
        }[]
      }
      admin_start_withdrawal_review: {
        Args: {
          p_actor_user_id: string
          p_request_id: string
          p_withdrawal_id: string
        }
        Returns: {
          already_processed: boolean
          assigned_to: string
          review_due_at: string
          status: string
          withdrawal_id: string
        }[]
      }
      archive_creator_activity_post: {
        Args: { p_post_id: string }
        Returns: {
          archived_at: string | null
          body: string
          content_type: Database["public"]["Enums"]["creator_activity_content_type"]
          created_at: string
          creator_id: string
          deleted_at: string | null
          external_metadata: Json
          external_provider: string | null
          external_url: string | null
          external_video_id: string | null
          id: string
          image_access_mode: Database["public"]["Enums"]["creator_activity_image_access_mode"]
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["creator_activity_moderation_status"]
          published_at: string | null
          required_gift_id: string | null
          required_gift_units_snapshot: number | null
          submitted_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      block_user: {
        Args: { p_blocked_id: string; p_reason_code?: string }
        Returns: boolean
      }
      can_moderate_content: { Args: never; Returns: boolean }
      can_view_media: { Args: { p_media_id: string }; Returns: boolean }
      cancel_account_deletion: {
        Args: { p_deletion_request_id: string; p_request_id: string }
        Returns: {
          already_processed: boolean
          deletion_request_id: string
          status: string
        }[]
      }
      cancel_friend_request: {
        Args: { p_friendship_id: string }
        Returns: boolean
      }
      cancel_my_vietqr_heart_order: {
        Args: { p_order_id: string }
        Returns: string
      }
      cancel_my_withdrawal: {
        Args: { p_request_id: string; p_withdrawal_id: string }
        Returns: {
          already_processed: boolean
          available_balance_units: number
          status: string
          withdrawal_id: string
        }[]
      }
      complete_my_onboarding: {
        Args: {
          p_age_verification_method?: string
          p_community_rules_version: string
          p_date_of_birth: string
          p_terms_version: string
        }
        Returns: {
          account_status: string
          age_verified: boolean
          completed_at: string
          user_id: string
        }[]
      }
      create_album: {
        Args: {
          p_album_type: Database["public"]["Enums"]["album_type"]
          p_fan_threshold_units?: number
          p_name: string
        }
        Returns: {
          album_type: Database["public"]["Enums"]["album_type"]
          created_at: string
          deleted_at: string | null
          fan_threshold_units: number
          id: string
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "albums"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_creator_activity_post: {
        Args: {
          p_body: string
          p_external_url?: string
          p_image_access_mode?: string
          p_media_id?: string
          p_required_gift_id?: string
        }
        Returns: {
          archived_at: string | null
          body: string
          content_type: Database["public"]["Enums"]["creator_activity_content_type"]
          created_at: string
          creator_id: string
          deleted_at: string | null
          external_metadata: Json
          external_provider: string | null
          external_url: string | null
          external_video_id: string | null
          id: string
          image_access_mode: Database["public"]["Enums"]["creator_activity_image_access_mode"]
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["creator_activity_moderation_status"]
          published_at: string | null
          required_gift_id: string | null
          required_gift_units_snapshot: number | null
          submitted_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_luxy_upgrade_intent: {
        Args: {
          p_source?: string
          p_tier: Database["public"]["Enums"]["luxy_membership_tier"]
        }
        Returns: string
      }
      create_report: {
        Args: {
          p_description?: string
          p_evidence_json?: Json
          p_reason_code?: string
          p_target_media_id?: string
          p_target_message_id?: string
          p_target_user_id?: string
        }
        Returns: string
      }
      create_vietqr_heart_order: {
        Args: { p_product_id: string; p_request_id: string }
        Returns: {
          account_name: string
          account_no: string
          amount_vnd: number
          bank_bin: string
          bank_code: string
          bank_name: string
          created_at: string
          display_hearts: number
          expires_at: string
          heart_units: number
          order_code: string
          order_id: string
          product_id: string
          qr_image_url: string
          status: string
          transfer_content: string
        }[]
      }
      delete_creator_activity_post: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      delete_my_media: {
        Args: { p_media_id: string; p_request_id?: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deleted_at: string | null
          file_size_bytes: number
          height: number | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          mime_type: string
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["media_moderation_status"]
          owner_id: string
          rejected_at: string | null
          sha256: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          uploaded_at: string | null
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      disable_my_location: { Args: never; Returns: boolean }
      finalize_kyc_document_upload: {
        Args: { p_document_side: string; p_media_id: string }
        Returns: {
          kyc_document_id: string
          media_id: string
          status: string
        }[]
      }
      finalize_media_upload: {
        Args: { p_media_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deleted_at: string | null
          file_size_bytes: number
          height: number | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          mime_type: string
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["media_moderation_status"]
          owner_id: string
          rejected_at: string | null
          sha256: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          uploaded_at: string | null
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_nearby_profiles: {
        Args: { p_cursor?: string; p_limit?: number; p_radius_meters?: number }
        Returns: {
          avatar_media_id: string
          bio: string
          display_name: string
          distance_bucket: string
          gender: Database["public"]["Enums"]["gender_identity"]
          id: string
          is_creator: boolean
          province_id: number
          username: string
        }[]
      }
      find_province_profiles: {
        Args: { p_cursor?: string; p_limit?: number; p_province_id: number }
        Returns: {
          age_preference_max: number
          age_preference_min: number
          avatar_media_id: string | null
          bio: string | null
          children_status: Database["public"]["Enums"]["children_status"]
          created_at: string
          deleted_at: string | null
          discovery_enabled: boolean
          display_name: string | null
          drinking_status: Database["public"]["Enums"]["drinking_status"]
          education_level: Database["public"]["Enums"]["education_level"]
          gender: Database["public"]["Enums"]["gender_identity"]
          headline: string | null
          height_cm: number | null
          id: string
          interested_in: Database["public"]["Enums"]["dating_interest"]
          interests: string[]
          is_creator: boolean
          languages: string[]
          last_active_at: string | null
          lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          looking_for: string | null
          nearby_enabled: boolean
          occupation: string | null
          profile_status: Database["public"]["Enums"]["profile_status"]
          province_id: number | null
          relationship_status: Database["public"]["Enums"]["relationship_status"]
          smoking_status: Database["public"]["Enums"]["smoking_status"]
          updated_at: string
          username: string | null
          username_changed_at: string | null
          weight_kg: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_conversation_detail: {
        Args: { p_conversation_id: string }
        Returns: {
          avatar_media_id: string
          avatar_storage_bucket: string
          avatar_storage_path: string
          blocked_by_other: boolean
          blocked_by_viewer: boolean
          can_send: boolean
          conversation_id: string
          display_name: string
          friendship_id: string
          friendship_status: string
          is_creator: boolean
          last_read_at: string
          last_read_message_id: string
          message_max_characters: number
          other_user_id: string
          page_size: number
          province_name: string
          username: string
        }[]
      }
      get_conversation_retention: {
        Args: { p_conversation_id: string }
        Returns: {
          auto_delete_after_days: number
          auto_delete_enabled: boolean
          conversation_id: string
          updated_at: string
        }[]
      }
      get_creator_activity_access: {
        Args: { p_creator_username: string }
        Returns: {
          activity_visibility: string
          approved_image_count: number
          approved_post_count: number
          can_view: boolean
          creator_id: string
          fan_eligible_units: number
          fan_remaining_units: number
          fan_threshold_units: number
          gate_reason: string
          is_fan: boolean
          is_friend: boolean
          is_owner: boolean
          username: string
        }[]
      }
      get_creator_post_media_access: {
        Args: { p_post_id: string }
        Returns: {
          expires_in_seconds: number
          height: number
          media_id: string
          storage_bucket: string
          storage_path: string
          width: number
        }[]
      }
      get_direct_conversation: {
        Args: { p_other_user_id: string }
        Returns: string
      }
      get_luxy_member_profile: {
        Args: { p_username: string }
        Returns: {
          age: number
          avatar_media_id: string
          avatar_storage_bucket: string
          avatar_storage_path: string
          bio: string
          blocked_by_viewer: boolean
          children_status: Database["public"]["Enums"]["children_status"]
          display_name: string
          drinking_status: Database["public"]["Enums"]["drinking_status"]
          education_level: Database["public"]["Enums"]["education_level"]
          gender: Database["public"]["Enums"]["gender_identity"]
          headline: string
          height_cm: number
          id: string
          interested_in: Database["public"]["Enums"]["dating_interest"]
          interests: string[]
          languages: string[]
          last_active_at: string
          lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          looking_for: string
          member_since: string
          membership_badge_visible: boolean
          membership_tier: Database["public"]["Enums"]["luxy_membership_tier"]
          occupation: string
          private_photo_count: number
          province_id: number
          province_name: string
          public_photo_count: number
          relationship_status: Database["public"]["Enums"]["relationship_status"]
          smoking_status: Database["public"]["Enums"]["smoking_status"]
          username: string
          weight_kg: number
        }[]
      }
      get_my_account_deletion_status: {
        Args: never
        Returns: {
          cancelled_at: string
          id: string
          legal_hold: boolean
          processed_at: string
          requested_at: string
          scheduled_delete_at: string
          status: string
        }[]
      }
      get_my_discovery_context: {
        Args: never
        Returns: {
          cache_minutes: number
          discovery_enabled: boolean
          has_fresh_location: boolean
          location_captured_at: string
          max_results: number
          nearby_enabled: boolean
          page_size: number
          province_id: number
          user_id: string
        }[]
      }
      get_my_economy_summary: {
        Args: never
        Returns: {
          creator_available_units: number
          creator_frozen: boolean
          creator_held_units: number
          creator_paid_units: number
          creator_pending_units: number
          creator_reversed_units: number
          creator_version: number
          heart_available_units: number
          heart_held_units: number
          heart_version: number
          lifetime_purchased_units: number
          lifetime_reversed_units: number
          lifetime_spent_units: number
          user_id: string
        }[]
      }
      get_my_kyc_status: {
        Args: never
        Returns: {
          country_code: string
          document_count: number
          document_number_last4: string
          document_type: string
          expires_at: string
          kyc_profile_id: string
          rejection_reason_code: string
          reviewed_at: string
          status: string
          submitted_at: string
        }[]
      }
      get_my_luxy_membership_snapshot: {
        Args: never
        Returns: {
          can_message: boolean
          expires_at: string
          status: string
          tier: Database["public"]["Enums"]["luxy_membership_tier"]
        }[]
      }
      get_my_onboarding_status: {
        Args: never
        Returns: {
          account_status: string
          age_verified: boolean
          creator_terms_accepted: boolean
          policies_accepted: boolean
          profile_status: string
          user_id: string
        }[]
      }
      get_my_payout_summary: {
        Args: never
        Returns: {
          active_financial_hold: boolean
          creator_available_units: number
          creator_held_units: number
          creator_paid_units: number
          creator_status: string
          deletion_status: string
          kyc_status: string
          payout_eligible: boolean
          pending_withdrawals: number
          user_id: string
          verified_bank_accounts: number
        }[]
      }
      get_my_reports: {
        Args: { p_cursor?: string; p_limit?: number }
        Returns: {
          created_at: string
          id: string
          reason_code: string
          resolved_at: string
          status: Database["public"]["Enums"]["report_status"]
          target_type: string
        }[]
      }
      get_my_vietqr_heart_order: {
        Args: { p_order_id: string }
        Returns: {
          account_name: string
          account_no: string
          amount_vnd: number
          bank_bin: string
          bank_code: string
          bank_name: string
          created_at: string
          display_hearts: number
          expires_at: string
          heart_units: number
          order_code: string
          order_id: string
          paid_at: string
          product_id: string
          qr_image_url: string
          status: string
          submitted_at: string
          transfer_content: string
        }[]
      }
      get_profile_interest_state: {
        Args: { p_profile_id: string }
        Returns: {
          has_viewed_me: boolean
          is_favorited: boolean
          is_favorited_by: boolean
          is_match: boolean
          is_viewed: boolean
        }[]
      }
      get_profile_viewer: {
        Args: { p_username: string }
        Returns: {
          activity_can_view: boolean
          activity_gate_reason: string
          activity_image_count: number
          activity_post_count: number
          activity_visibility: string
          age_years: number
          avatar_media_id: string
          avatar_storage_bucket: string
          avatar_storage_path: string
          bio: string
          blocked_by_viewer: boolean
          creator_bio: string
          display_name: string
          distance_km: number
          fan_access_granted: boolean
          fan_album_available: boolean
          fan_eligible_units: number
          fan_remaining_units: number
          fan_threshold_units: number
          friendship_direction: string
          friendship_id: string
          friendship_status: string
          gender: Database["public"]["Enums"]["gender_identity"]
          id: string
          interests: string[]
          is_creator: boolean
          last_active_at: string
          presence_status: string
          province_id: number
          province_name: string
          public_album_count: number
          username: string
        }[]
      }
      get_public_app_config: {
        Args: never
        Returns: {
          key: string
          updated_at: string
          value_json: Json
          value_type: string
        }[]
      }
      hide_message_for_me: { Args: { p_message_id: string }; Returns: boolean }
      is_current_user_adult: { Args: never; Returns: boolean }
      list_conversation_messages: {
        Args: {
          p_before_id?: string
          p_before_sent_at?: string
          p_conversation_id: string
          p_limit?: number
        }
        Returns: {
          body: string
          client_message_id: string
          conversation_id: string
          edited_at: string
          gift_transaction_id: string
          id: string
          is_own: boolean
          is_read_by_other: boolean
          message_type: string
          removed: boolean
          sender_id: string
          sent_at: string
        }[]
      }
      list_creator_activity: {
        Args: {
          p_before_at?: string
          p_before_id?: string
          p_creator_username: string
          p_limit?: number
        }
        Returns: {
          avatar_bucket: string
          avatar_media_id: string
          avatar_path: string
          body: string
          content_type: string
          created_at: string
          creator_id: string
          display_name: string
          external_provider: string
          external_url: string
          external_video_id: string
          image_access_mode: string
          is_owner: boolean
          is_unlocked: boolean
          is_verified: boolean
          media_id: string
          moderation_status: string
          original_bucket: string
          original_height: number
          original_path: string
          original_width: number
          post_id: string
          preview_bucket: string
          preview_height: number
          preview_path: string
          preview_width: number
          published_at: string
          required_gift_active: boolean
          required_gift_hearts: number
          required_gift_icon_emoji: string
          required_gift_id: string
          required_gift_name_vi: string
          unlock_count: number
          unlock_status: string
          username: string
        }[]
      }
      list_creator_activity_album: {
        Args: {
          p_creator_username: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          body: string
          height: number
          media_id: string
          post_id: string
          published_at: string
          storage_bucket: string
          storage_path: string
          width: number
        }[]
      }
      list_creator_activity_moderation_queue: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          body: string
          content_type: string
          creator_id: string
          display_name: string
          external_provider: string
          external_url: string
          image_access_mode: string
          media_id: string
          media_moderation_status: string
          moderation_status: string
          original_bucket: string
          original_path: string
          post_id: string
          preview_bucket: string
          preview_path: string
          report_count: number
          required_gift_hearts: number
          required_gift_name_vi: string
          submitted_at: string
          unlock_count: number
          username: string
        }[]
      }
      list_discovery_profiles: {
        Args: {
          p_limit?: number
          p_mode?: string
          p_offset?: number
          p_province_id?: number
        }
        Returns: {
          avatar_media_id: string
          avatar_storage_bucket: string
          avatar_storage_path: string
          bio: string
          display_name: string
          distance_km: number
          gender: Database["public"]["Enums"]["gender_identity"]
          id: string
          interests: string[]
          is_creator: boolean
          last_active_at: string
          province_id: number
          province_name: string
          sort_tier: number
          username: string
        }[]
      }
      list_luxy_interests: {
        Args: { p_limit?: number; p_offset?: number; p_scope?: string }
        Returns: {
          age: number
          avatar_media_id: string
          avatar_storage_bucket: string
          avatar_storage_path: string
          display_name: string
          id: string
          interaction_at: string
          is_favorited: boolean
          is_favorited_by: boolean
          is_match: boolean
          is_online: boolean
          last_active_at: string
          photo_count: number
          province_name: string
          username: string
        }[]
      }
      list_my_bank_accounts: {
        Args: never
        Returns: {
          account_number_last4: string
          bank_code: string
          created_at: string
          id: string
          is_default: boolean
          rejection_reason_code: string
          status: string
          updated_at: string
          verified_at: string
        }[]
      }
      list_my_blocked_profiles: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          blocked_at: string
          blocked_user_id: string
          display_name: string
          reason_code: string
          username: string
        }[]
      }
      list_my_conversations: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          avatar_media_id: string
          avatar_storage_bucket: string
          avatar_storage_path: string
          blocked: boolean
          can_send: boolean
          conversation_id: string
          display_name: string
          friendship_id: string
          friendship_status: string
          is_creator: boolean
          last_message_body: string
          last_message_id: string
          last_message_sender_id: string
          last_message_sent_at: string
          last_message_type: string
          other_user_id: string
          province_name: string
          unread_count: number
          username: string
        }[]
      }
      list_my_gifts: {
        Args: { p_cursor?: string; p_limit?: number }
        Returns: {
          completed_at: string
          created_at: string
          creator_id: string
          creator_reward_units: number
          creator_share_bps: number
          gift_id: string
          gift_name_en_snapshot: string
          gift_name_vi_snapshot: string
          gift_slug_snapshot: string
          gross_heart_units: number
          id: string
          idempotency_key: string
          message_id: string | null
          platform_gross_units: number
          platform_share_bps: number
          quantity: number
          reversed_at: string | null
          reversed_creator_reward_units: number
          reversed_heart_units: number
          reversed_platform_units: number
          sender_id: string
          status: Database["public"]["Enums"]["gift_transaction_status"]
          unit_heart_units: number
          unlock_target_id: string | null
          unlock_target_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "gift_transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_my_media: {
        Args: { p_cursor?: string; p_limit?: number }
        Returns: {
          approved_at: string
          created_at: string
          deleted_at: string
          file_size_bytes: number
          height: number
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          mime_type: string
          moderation_reason_code: string
          moderation_status: Database["public"]["Enums"]["media_moderation_status"]
          rejected_at: string
          storage_bucket: string
          storage_path: string
          uploaded_at: string
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number
        }[]
      }
      list_my_play_purchases: {
        Args: { p_cursor?: string; p_limit?: number }
        Returns: {
          acknowledged_at: string
          consumed_at: string
          country_code: string
          created_at: string
          currency_code: string
          google_order_id: string
          google_product_id: string
          gross_amount_micros: number
          heart_units: number
          id: string
          is_test_purchase: boolean
          product_id: string
          purchase_state: string
          refunded_at: string
          revoked_at: string
          verified_at: string
        }[]
      }
      list_my_social_connections: {
        Args: { p_limit?: number; p_offset?: number; p_view?: string }
        Returns: {
          avatar_media_id: string
          avatar_storage_bucket: string
          avatar_storage_path: string
          bio: string
          created_at: string
          direction: string
          display_name: string
          friendship_id: string
          friendship_status: string
          greeting_message: string
          is_creator: boolean
          other_user_id: string
          province_name: string
          responded_at: string
          username: string
        }[]
      }
      list_my_withdrawals: {
        Args: { p_cursor?: string; p_limit?: number }
        Returns: {
          amount_vnd: number
          approved_at: string
          bank_account_id: string
          bank_account_last4_snapshot: string
          bank_code_snapshot: string
          created_at: string
          heart_vnd_rate_snapshot: number
          id: string
          paid_at: string
          payment_reference: string
          rejection_reason_code: string
          requested_at: string
          requested_reward_units: number
          reviewed_at: string
          status: string
        }[]
      }
      list_profile_album_media: {
        Args: {
          p_album_type?: Database["public"]["Enums"]["album_type"]
          p_owner_id: string
        }
        Returns: {
          album_id: string
          album_name: string
          album_type: Database["public"]["Enums"]["album_type"]
          approved_at: string
          fan_threshold_units: number
          height: number
          media_id: string
          media_type: Database["public"]["Enums"]["media_type"]
          mime_type: string
          sort_order: number
          storage_bucket: string
          storage_path: string
          uploaded_at: string
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number
        }[]
      }
      list_public_activity_highlights: {
        Args: { p_limit?: number }
        Returns: {
          avatar_bucket: string
          avatar_media_id: string
          avatar_path: string
          body: string
          content_type: string
          creator_id: string
          display_name: string
          external_provider: string
          external_url: string
          external_video_id: string
          media_bucket: string
          media_height: number
          media_id: string
          media_path: string
          media_width: number
          post_id: string
          published_at: string
          username: string
        }[]
      }
      list_public_featured_creators: {
        Args: { p_limit?: number }
        Returns: {
          avatar_bucket: string
          avatar_media_id: string
          avatar_path: string
          creator_bio: string
          creator_id: string
          display_name: string
          latest_activity_at: string
          public_activity_count: number
          username: string
        }[]
      }
      list_vietqr_heart_products: {
        Args: never
        Returns: {
          amount_vnd: number
          display_hearts: number
          google_product_id: string
          heart_units: number
          product_id: string
          sort_order: number
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string; p_message_id?: string }
        Returns: boolean
      }
      mark_my_vietqr_transfer_submitted: {
        Args: { p_order_id: string }
        Returns: string
      }
      mark_play_purchase_consumed: {
        Args: { p_consumed_at?: string; p_purchase_token_hash: string }
        Returns: boolean
      }
      moderate_creator_activity_post: {
        Args: {
          p_action: string
          p_notes?: string
          p_post_id: string
          p_reason_code: string
          p_request_id?: string
        }
        Returns: {
          archived_at: string | null
          body: string
          content_type: Database["public"]["Enums"]["creator_activity_content_type"]
          created_at: string
          creator_id: string
          deleted_at: string | null
          external_metadata: Json
          external_provider: string | null
          external_url: string | null
          external_video_id: string | null
          id: string
          image_access_mode: Database["public"]["Enums"]["creator_activity_image_access_mode"]
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["creator_activity_moderation_status"]
          published_at: string | null
          required_gift_id: string | null
          required_gift_units_snapshot: number | null
          submitted_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      moderate_media: {
        Args: {
          p_action: Database["public"]["Enums"]["moderation_decision"]
          p_destination_bucket?: string
          p_destination_path?: string
          p_media_id: string
          p_notes?: string
          p_reason_code: string
          p_request_id?: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deleted_at: string | null
          file_size_bytes: number
          height: number | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          mime_type: string
          moderation_reason_code: string | null
          moderation_status: Database["public"]["Enums"]["media_moderation_status"]
          owner_id: string
          rejected_at: string | null
          sha256: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          uploaded_at: string | null
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prepare_creator_activity_preview: {
        Args: { p_post_id: string }
        Returns: {
          file_size_bytes: number
          media_id: string
          mime_type: string
          owner_id: string
          post_id: string
          storage_bucket: string
          storage_path: string
        }[]
      }
      prepare_kyc_document_upload: {
        Args: {
          p_document_side: string
          p_extension?: string
          p_file_size_bytes: number
          p_height?: number
          p_mime_type: string
          p_sha256?: string
          p_width?: number
        }
        Returns: {
          document_side: string
          media_id: string
          storage_bucket: string
          storage_path: string
        }[]
      }
      prepare_media_upload: {
        Args: {
          p_extension?: string
          p_file_size_bytes: number
          p_height: number
          p_mime_type: string
          p_sha256?: string
          p_visibility: Database["public"]["Enums"]["media_visibility"]
          p_width: number
        }
        Returns: {
          media_id: string
          moderation_status: Database["public"]["Enums"]["media_moderation_status"]
          storage_bucket: string
          storage_path: string
        }[]
      }
      purge_expired_runtime_observability_events: {
        Args: { p_batch_size?: number }
        Returns: number
      }
      record_profile_view: { Args: { p_profile_id: string }; Returns: boolean }
      record_profile_view_by_username: {
        Args: { p_username: string }
        Returns: boolean
      }
      record_runtime_observability_event: {
        Args: {
          p_duration_ms?: number
          p_error_code?: string
          p_event_id: string
          p_event_name: string
          p_metadata_json?: Json
          p_platform: string
          p_release_channel: string
          p_route_group: string
          p_severity: string
        }
        Returns: {
          already_recorded: boolean
          observation_id: string
        }[]
      }
      record_verified_play_purchase: {
        Args: {
          p_country_code: string
          p_google_order_id: string
          p_google_product_id: string
          p_idempotency_key: string
          p_is_test_purchase: boolean
          p_obfuscated_external_account_id: string
          p_purchase_token_hash: string
          p_raw_response_encrypted?: string
          p_user_id: string
        }
        Returns: {
          already_recorded: boolean
          balance_after_units: number
          heart_units: number
          purchase_id: string
          purchase_state: string
        }[]
      }
      record_verified_vietqr_payment: {
        Args: {
          p_bank_transaction_ref: string
          p_order_id: string
          p_paid_amount_vnd: number
          p_verification_id: string
        }
        Returns: {
          already_recorded: boolean
          balance_after_units: number
          heart_units: number
          order_id: string
          purchase_id: string
          status: string
        }[]
      }
      release_due_creator_rewards: {
        Args: { p_limit?: number }
        Returns: {
          released_positions: number
          released_units: number
        }[]
      }
      remove_media_from_album: {
        Args: { p_album_id: string; p_media_id: string }
        Returns: boolean
      }
      report_creator_activity: {
        Args: {
          p_description?: string
          p_media_id?: string
          p_post_id: string
          p_reason_code?: string
          p_target_kind?: string
        }
        Returns: string
      }
      request_account_deletion: {
        Args: { p_idempotency_key: string; p_reason: string }
        Returns: {
          already_processed: boolean
          deletion_request_id: string
          legal_hold: boolean
          scheduled_delete_at: string
          status: string
        }[]
      }
      request_withdrawal: {
        Args: {
          p_bank_account_id: string
          p_idempotency_key: string
          p_requested_reward_units: number
        }
        Returns: {
          already_processed: boolean
          amount_vnd: number
          held_balance_units: number
          requested_reward_units: number
          status: string
          withdrawal_id: string
        }[]
      }
      respond_to_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string }
        Returns: {
          addressee_id: string
          created_at: string
          greeting_message: string | null
          id: string
          pair_high_id: string | null
          pair_low_id: string | null
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_play_purchase: {
        Args: {
          p_event_type: string
          p_idempotency_key: string
          p_purchase_token_hash: string
          p_reason_code: string
        }
        Returns: {
          already_processed: boolean
          creator_liability_units: number
          creator_reward_reversed_units: number
          purchase_id: string
          purchase_state: string
          spent_reversed_units: number
          unspent_debited_units: number
        }[]
      }
      search_luxy_profiles_v2:
        | {
            Args: {
              p_children_statuses?: Database["public"]["Enums"]["children_status"][]
              p_drinking_statuses?: Database["public"]["Enums"]["drinking_status"][]
              p_education_levels?: Database["public"]["Enums"]["education_level"][]
              p_favorite_scope?: string
              p_genders?: Database["public"]["Enums"]["gender_identity"][]
              p_has_photo?: boolean
              p_interests?: string[]
              p_languages?: string[]
              p_lifestyle_tags?: Database["public"]["Enums"]["profile_lifestyle_tag"][]
              p_limit?: number
              p_max_age?: number
              p_max_distance_km?: number
              p_max_height_cm?: number
              p_max_weight_kg?: number
              p_min_age?: number
              p_min_height_cm?: number
              p_min_weight_kg?: number
              p_occupation_text?: string
              p_offset?: number
              p_online_now?: boolean
              p_profile_text?: string
              p_province_id?: number
              p_relationship_statuses?: Database["public"]["Enums"]["relationship_status"][]
              p_smoking_statuses?: Database["public"]["Enums"]["smoking_status"][]
              p_sort?: string
              p_view_state?: string
            }
            Returns: {
              age: number
              avatar_media_id: string
              avatar_storage_bucket: string
              avatar_storage_path: string
              bio: string
              children_status: Database["public"]["Enums"]["children_status"]
              display_name: string
              distance_km: number
              drinking_status: Database["public"]["Enums"]["drinking_status"]
              education_level: Database["public"]["Enums"]["education_level"]
              gender: Database["public"]["Enums"]["gender_identity"]
              headline: string
              height_cm: number
              id: string
              interests: string[]
              is_favorited: boolean
              is_favorited_by: boolean
              is_online: boolean
              is_viewed: boolean
              languages: string[]
              last_active_at: string
              lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
              looking_for: string
              member_since: string
              occupation: string
              photo_count: number
              province_id: number
              province_name: string
              relationship_status: Database["public"]["Enums"]["relationship_status"]
              smoking_status: Database["public"]["Enums"]["smoking_status"]
              username: string
              weight_kg: number
            }[]
          }
        | {
            Args: {
              p_children_statuses: Database["public"]["Enums"]["children_status"][]
              p_drinking_statuses: Database["public"]["Enums"]["drinking_status"][]
              p_education_levels: Database["public"]["Enums"]["education_level"][]
              p_genders: Database["public"]["Enums"]["gender_identity"][]
              p_has_photo: boolean
              p_interests: string[]
              p_languages: string[]
              p_lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
              p_limit: number
              p_max_age: number
              p_max_distance_km: number
              p_max_height_cm: number
              p_max_weight_kg: number
              p_min_age: number
              p_min_height_cm: number
              p_min_weight_kg: number
              p_occupation_text: string
              p_offset: number
              p_online_now: boolean
              p_profile_text: string
              p_province_id: number
              p_relationship_statuses: Database["public"]["Enums"]["relationship_status"][]
              p_smoking_statuses: Database["public"]["Enums"]["smoking_status"][]
              p_sort: string
            }
            Returns: {
              age: number
              avatar_media_id: string
              avatar_storage_bucket: string
              avatar_storage_path: string
              bio: string
              children_status: Database["public"]["Enums"]["children_status"]
              display_name: string
              distance_km: number
              drinking_status: Database["public"]["Enums"]["drinking_status"]
              education_level: Database["public"]["Enums"]["education_level"]
              gender: Database["public"]["Enums"]["gender_identity"]
              headline: string
              height_cm: number
              id: string
              interests: string[]
              is_online: boolean
              languages: string[]
              last_active_at: string
              lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
              looking_for: string
              member_since: string
              occupation: string
              photo_count: number
              province_id: number
              province_name: string
              relationship_status: Database["public"]["Enums"]["relationship_status"]
              smoking_status: Database["public"]["Enums"]["smoking_status"]
              username: string
              weight_kg: number
            }[]
          }
      send_friend_request: {
        Args: { p_addressee_id: string; p_greeting_message?: string }
        Returns: {
          addressee_id: string
          created_at: string
          greeting_message: string | null
          id: string
          pair_high_id: string | null
          pair_low_id: string | null
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_gift: {
        Args: {
          p_client_message_id?: string
          p_conversation_id?: string
          p_creator_id: string
          p_gift_id: string
          p_idempotency_key: string
          p_quantity: number
        }
        Returns: {
          already_processed: boolean
          creator_id: string
          creator_reward_units: number
          fan_eligible_units: number
          fan_status: string
          fan_threshold_units: number
          gift_id: string
          gift_transaction_id: string
          gross_heart_units: number
          message_id: string
          platform_gross_units: number
          quantity: number
          reward_available_at: string
          sender_balance_units: number
          sender_id: string
        }[]
      }
      send_gift_and_unlock_creator_post: {
        Args: { p_idempotency_key: string; p_post_id: string }
        Returns: {
          already_processed: boolean
          already_unlocked: boolean
          entitlement_status: string
          gift_transaction_id: string
          post_id: string
          sender_balance_units: number
        }[]
      }
      send_message: {
        Args: {
          p_body: string
          p_client_message_id: string
          p_conversation_id: string
        }
        Returns: {
          body: string | null
          client_message_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          gift_transaction_id: string | null
          id: string
          message_type: Database["public"]["Enums"]["message_type"]
          moderation_status: Database["public"]["Enums"]["message_moderation_status"]
          sender_id: string
          sent_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      server_authorize_kyc_document_access: {
        Args: {
          p_actor_user_id: string
          p_kyc_document_id: string
          p_request_id: string
        }
        Returns: {
          document_side: string
          kyc_document_id: string
          mime_type: string
          storage_bucket: string
          storage_path: string
        }[]
      }
      server_get_bank_review_payload: {
        Args: {
          p_actor_user_id: string
          p_bank_account_id: string
          p_request_id: string
        }
        Returns: {
          account_holder_ciphertext: string
          account_number_ciphertext: string
          account_number_last4: string
          bank_account_id: string
          bank_code: string
          is_default: boolean
          status: string
          user_id: string
        }[]
      }
      server_get_kyc_review_payload: {
        Args: {
          p_actor_user_id: string
          p_kyc_profile_id: string
          p_request_id: string
        }
        Returns: {
          country_code: string
          document_ids: string[]
          document_number_ciphertext: string
          document_number_last4: string
          document_type: string
          kyc_profile_id: string
          legal_name_ciphertext: string
          status: string
          submitted_at: string
          user_id: string
        }[]
      }
      server_submit_kyc_profile: {
        Args: {
          p_country_code: string
          p_document_ids: string[]
          p_document_number_ciphertext: string
          p_document_number_last4: string
          p_document_type: string
          p_legal_name_ciphertext: string
          p_request_id: string
          p_user_id: string
        }
        Returns: {
          already_processed: boolean
          kyc_profile_id: string
          status: string
          submitted_at: string
        }[]
      }
      server_upsert_bank_account: {
        Args: {
          p_account_holder_ciphertext: string
          p_account_number_ciphertext: string
          p_account_number_last4: string
          p_bank_account_id: string
          p_bank_code: string
          p_is_default: boolean
          p_request_id: string
          p_user_id: string
        }
        Returns: {
          account_number_last4: string
          already_processed: boolean
          bank_account_id: string
          bank_code: string
          is_default: boolean
          status: string
        }[]
      }
      set_album_active: {
        Args: { p_album_id: string; p_is_active: boolean }
        Returns: {
          album_type: Database["public"]["Enums"]["album_type"]
          created_at: string
          deleted_at: string | null
          fan_threshold_units: number
          id: string
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "albums"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_conversation_auto_delete: {
        Args: { p_conversation_id: string; p_enabled: boolean }
        Returns: {
          auto_delete_after_days: number
          auto_delete_enabled: boolean
          conversation_id: string
          deleted_messages: number
          updated_at: string
        }[]
      }
      set_my_avatar: { Args: { p_media_id: string }; Returns: boolean }
      set_my_creator_activity_visibility: {
        Args: { p_visibility: string }
        Returns: {
          activity_visibility: string
          updated_at: string
        }[]
      }
      set_my_location: {
        Args: {
          p_accuracy_meters: number
          p_captured_at: string
          p_latitude: number
          p_longitude: number
          p_source?: string
        }
        Returns: {
          captured_at: string
          expires_at: string
          is_enabled: boolean
        }[]
      }
      set_profile_favorite: {
        Args: { p_favorited: boolean; p_profile_id: string }
        Returns: {
          is_favorited: boolean
          is_favorited_by: boolean
          is_match: boolean
        }[]
      }
      unblock_user: { Args: { p_blocked_id: string }; Returns: boolean }
      update_my_luxy_profile: {
        Args: {
          p_age_preference_max?: number
          p_age_preference_min?: number
          p_bio?: string
          p_children_status?: Database["public"]["Enums"]["children_status"]
          p_discovery_enabled?: boolean
          p_display_name: string
          p_drinking_status?: Database["public"]["Enums"]["drinking_status"]
          p_education_level?: Database["public"]["Enums"]["education_level"]
          p_gender?: Database["public"]["Enums"]["gender_identity"]
          p_headline?: string
          p_height_cm?: number
          p_interested_in?: Database["public"]["Enums"]["dating_interest"]
          p_interests?: string[]
          p_languages?: string[]
          p_lifestyle_tags?: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          p_looking_for?: string
          p_nearby_enabled?: boolean
          p_occupation?: string
          p_province_id?: number
          p_relationship_status?: Database["public"]["Enums"]["relationship_status"]
          p_smoking_status?: Database["public"]["Enums"]["smoking_status"]
          p_username: string
          p_weight_kg?: number
        }
        Returns: {
          age_preference_max: number
          age_preference_min: number
          avatar_media_id: string | null
          bio: string | null
          children_status: Database["public"]["Enums"]["children_status"]
          created_at: string
          deleted_at: string | null
          discovery_enabled: boolean
          display_name: string | null
          drinking_status: Database["public"]["Enums"]["drinking_status"]
          education_level: Database["public"]["Enums"]["education_level"]
          gender: Database["public"]["Enums"]["gender_identity"]
          headline: string | null
          height_cm: number | null
          id: string
          interested_in: Database["public"]["Enums"]["dating_interest"]
          interests: string[]
          is_creator: boolean
          languages: string[]
          last_active_at: string | null
          lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          looking_for: string | null
          nearby_enabled: boolean
          occupation: string | null
          profile_status: Database["public"]["Enums"]["profile_status"]
          province_id: number | null
          relationship_status: Database["public"]["Enums"]["relationship_status"]
          smoking_status: Database["public"]["Enums"]["smoking_status"]
          updated_at: string
          username: string | null
          username_changed_at: string | null
          weight_kg: number | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: {
          p_bio?: string
          p_discovery_enabled?: boolean
          p_display_name: string
          p_gender?: Database["public"]["Enums"]["gender_identity"]
          p_interests?: string[]
          p_nearby_enabled?: boolean
          p_province_id?: number
          p_username: string
        }
        Returns: {
          age_preference_max: number
          age_preference_min: number
          avatar_media_id: string | null
          bio: string | null
          children_status: Database["public"]["Enums"]["children_status"]
          created_at: string
          deleted_at: string | null
          discovery_enabled: boolean
          display_name: string | null
          drinking_status: Database["public"]["Enums"]["drinking_status"]
          education_level: Database["public"]["Enums"]["education_level"]
          gender: Database["public"]["Enums"]["gender_identity"]
          headline: string | null
          height_cm: number | null
          id: string
          interested_in: Database["public"]["Enums"]["dating_interest"]
          interests: string[]
          is_creator: boolean
          languages: string[]
          last_active_at: string | null
          lifestyle_tags: Database["public"]["Enums"]["profile_lifestyle_tag"][]
          looking_for: string | null
          nearby_enabled: boolean
          occupation: string | null
          profile_status: Database["public"]["Enums"]["profile_status"]
          province_id: number | null
          relationship_status: Database["public"]["Enums"]["relationship_status"]
          smoking_status: Database["public"]["Enums"]["smoking_status"]
          updated_at: string
          username: string | null
          username_changed_at: string | null
          weight_kg: number | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      album_type: "public" | "fan"
      children_status: "no_children" | "has_children" | "prefer_not_to_say"
      conversation_type: "direct"
      creator_activity_content_type: "text" | "image" | "video"
      creator_activity_image_access_mode: "public" | "gift_locked"
      creator_activity_moderation_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "archived"
        | "deleted"
      creator_activity_preview_status: "pending" | "ready" | "failed"
      creator_activity_visibility: "public" | "friends" | "fans"
      creator_status:
        | "not_applied"
        | "pending"
        | "approved"
        | "rejected"
        | "suspended"
        | "closed"
      dating_interest: "female" | "male" | "everyone"
      drinking_status: "never" | "socially" | "regularly" | "prefer_not_to_say"
      education_level:
        | "high_school"
        | "vocational"
        | "college"
        | "bachelors"
        | "masters"
        | "doctorate"
        | "other"
        | "prefer_not_to_say"
      fan_membership_status: "active" | "revoked"
      friendship_status: "pending" | "accepted" | "declined" | "cancelled"
      gender_identity:
        | "female"
        | "male"
        | "non_binary"
        | "other"
        | "prefer_not_to_say"
      gift_transaction_status: "completed" | "partially_reversed" | "reversed"
      luxy_membership_tier: "free" | "premium" | "diamond"
      media_moderation_status:
        | "pending_upload"
        | "pending_review"
        | "approved"
        | "rejected"
        | "quarantined"
        | "deleted"
      media_type: "image" | "document"
      media_visibility: "avatar" | "public" | "fan" | "private" | "kyc"
      message_moderation_status:
        | "unreviewed"
        | "approved"
        | "flagged"
        | "removed"
      message_type: "text" | "gift" | "system"
      moderation_case_status:
        | "open"
        | "queued"
        | "in_review"
        | "resolved"
        | "dismissed"
      moderation_decision:
        | "approve"
        | "reject"
        | "quarantine"
        | "restore"
        | "delete"
      moderation_priority: "low" | "normal" | "high" | "urgent"
      moderation_source:
        | "upload"
        | "user_report"
        | "automated_scan"
        | "admin_review"
        | "appeal"
      profile_lifestyle_tag:
        | "true_love"
        | "luxury_lifestyle"
        | "active_lifestyle"
        | "flexible_schedule"
        | "emotional_connection"
        | "refined"
        | "fine_dining"
        | "friendship"
        | "long_term"
        | "marriage_minded"
        | "monogamous"
        | "romantic"
        | "ready_to_travel"
        | "travel_companion"
        | "vacation"
        | "entertainment_events"
        | "platonic"
      profile_status:
        | "incomplete"
        | "pending_review"
        | "active"
        | "suspended"
        | "deactivated"
        | "deleted"
      relationship_status:
        | "single"
        | "divorced"
        | "widowed"
        | "open"
        | "complicated"
        | "prefer_not_to_say"
      report_priority: "low" | "normal" | "high" | "urgent"
      report_status:
        | "submitted"
        | "triaged"
        | "in_review"
        | "resolved"
        | "dismissed"
      smoking_status:
        | "never"
        | "socially"
        | "regularly"
        | "trying_to_quit"
        | "prefer_not_to_say"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      album_type: ["public", "fan"],
      children_status: ["no_children", "has_children", "prefer_not_to_say"],
      conversation_type: ["direct"],
      creator_activity_content_type: ["text", "image", "video"],
      creator_activity_image_access_mode: ["public", "gift_locked"],
      creator_activity_moderation_status: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "archived",
        "deleted",
      ],
      creator_activity_preview_status: ["pending", "ready", "failed"],
      creator_activity_visibility: ["public", "friends", "fans"],
      creator_status: [
        "not_applied",
        "pending",
        "approved",
        "rejected",
        "suspended",
        "closed",
      ],
      dating_interest: ["female", "male", "everyone"],
      drinking_status: ["never", "socially", "regularly", "prefer_not_to_say"],
      education_level: [
        "high_school",
        "vocational",
        "college",
        "bachelors",
        "masters",
        "doctorate",
        "other",
        "prefer_not_to_say",
      ],
      fan_membership_status: ["active", "revoked"],
      friendship_status: ["pending", "accepted", "declined", "cancelled"],
      gender_identity: [
        "female",
        "male",
        "non_binary",
        "other",
        "prefer_not_to_say",
      ],
      gift_transaction_status: ["completed", "partially_reversed", "reversed"],
      luxy_membership_tier: ["free", "premium", "diamond"],
      media_moderation_status: [
        "pending_upload",
        "pending_review",
        "approved",
        "rejected",
        "quarantined",
        "deleted",
      ],
      media_type: ["image", "document"],
      media_visibility: ["avatar", "public", "fan", "private", "kyc"],
      message_moderation_status: [
        "unreviewed",
        "approved",
        "flagged",
        "removed",
      ],
      message_type: ["text", "gift", "system"],
      moderation_case_status: [
        "open",
        "queued",
        "in_review",
        "resolved",
        "dismissed",
      ],
      moderation_decision: [
        "approve",
        "reject",
        "quarantine",
        "restore",
        "delete",
      ],
      moderation_priority: ["low", "normal", "high", "urgent"],
      moderation_source: [
        "upload",
        "user_report",
        "automated_scan",
        "admin_review",
        "appeal",
      ],
      profile_lifestyle_tag: [
        "true_love",
        "luxury_lifestyle",
        "active_lifestyle",
        "flexible_schedule",
        "emotional_connection",
        "refined",
        "fine_dining",
        "friendship",
        "long_term",
        "marriage_minded",
        "monogamous",
        "romantic",
        "ready_to_travel",
        "travel_companion",
        "vacation",
        "entertainment_events",
        "platonic",
      ],
      profile_status: [
        "incomplete",
        "pending_review",
        "active",
        "suspended",
        "deactivated",
        "deleted",
      ],
      relationship_status: [
        "single",
        "divorced",
        "widowed",
        "open",
        "complicated",
        "prefer_not_to_say",
      ],
      report_priority: ["low", "normal", "high", "urgent"],
      report_status: [
        "submitted",
        "triaged",
        "in_review",
        "resolved",
        "dismissed",
      ],
      smoking_status: [
        "never",
        "socially",
        "regularly",
        "trying_to_quit",
        "prefer_not_to_say",
      ],
    },
  },
} as const

