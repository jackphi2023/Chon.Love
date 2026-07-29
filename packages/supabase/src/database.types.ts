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
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          friendship_id: string
          id: string
          last_message_at: string | null
          updated_at: string
        }
        Insert: {
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          friendship_id: string
          id?: string
          last_message_at?: string | null
          updated_at?: string
        }
        Update: {
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          friendship_id?: string
          id?: string
          last_message_at?: string | null
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
        ]
      }
      creator_profiles: {
        Row: {
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
      profiles: {
        Row: {
          avatar_media_id: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          discovery_enabled: boolean
          display_name: string | null
          gender: Database["public"]["Enums"]["gender_identity"]
          id: string
          is_creator: boolean
          last_active_at: string | null
          nearby_enabled: boolean
          profile_status: Database["public"]["Enums"]["profile_status"]
          province_id: number | null
          updated_at: string
          username: string | null
          username_changed_at: string | null
        }
        Insert: {
          avatar_media_id?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          discovery_enabled?: boolean
          display_name?: string | null
          gender?: Database["public"]["Enums"]["gender_identity"]
          id: string
          is_creator?: boolean
          last_active_at?: string | null
          nearby_enabled?: boolean
          profile_status?: Database["public"]["Enums"]["profile_status"]
          province_id?: number | null
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
        }
        Update: {
          avatar_media_id?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          discovery_enabled?: boolean
          display_name?: string | null
          gender?: Database["public"]["Enums"]["gender_identity"]
          id?: string
          is_creator?: boolean
          last_active_at?: string | null
          nearby_enabled?: boolean
          profile_status?: Database["public"]["Enums"]["profile_status"]
          province_id?: number | null
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
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
          avatar_media_id: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          discovery_enabled: boolean
          display_name: string | null
          gender: Database["public"]["Enums"]["gender_identity"]
          id: string
          is_creator: boolean
          last_active_at: string | null
          nearby_enabled: boolean
          profile_status: Database["public"]["Enums"]["profile_status"]
          province_id: number | null
          updated_at: string
          username: string | null
          username_changed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
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
      get_public_app_config: {
        Args: never
        Returns: {
          key: string
          updated_at: string
          value_json: Json
          value_type: string
        }[]
      }
      is_current_user_adult: { Args: never; Returns: boolean }
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
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string; p_message_id?: string }
        Returns: boolean
      }
      mark_play_purchase_consumed: {
        Args: { p_consumed_at?: string; p_purchase_token_hash: string }
        Returns: boolean
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
      set_my_avatar: { Args: { p_media_id: string }; Returns: boolean }
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
      unblock_user: { Args: { p_blocked_id: string }; Returns: boolean }
      update_my_profile: {
        Args: {
          p_bio?: string
          p_discovery_enabled?: boolean
          p_display_name: string
          p_gender?: Database["public"]["Enums"]["gender_identity"]
          p_nearby_enabled?: boolean
          p_province_id?: number
          p_username: string
        }
        Returns: {
          avatar_media_id: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          discovery_enabled: boolean
          display_name: string | null
          gender: Database["public"]["Enums"]["gender_identity"]
          id: string
          is_creator: boolean
          last_active_at: string | null
          nearby_enabled: boolean
          profile_status: Database["public"]["Enums"]["profile_status"]
          province_id: number | null
          updated_at: string
          username: string | null
          username_changed_at: string | null
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
      conversation_type: "direct"
      creator_status:
        | "not_applied"
        | "pending"
        | "approved"
        | "rejected"
        | "suspended"
        | "closed"
      fan_membership_status: "active" | "revoked"
      friendship_status: "pending" | "accepted" | "declined" | "cancelled"
      gender_identity:
        | "female"
        | "male"
        | "non_binary"
        | "other"
        | "prefer_not_to_say"
      gift_transaction_status: "completed" | "partially_reversed" | "reversed"
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
      profile_status:
        | "incomplete"
        | "pending_review"
        | "active"
        | "suspended"
        | "deactivated"
        | "deleted"
      report_priority: "low" | "normal" | "high" | "urgent"
      report_status:
        | "submitted"
        | "triaged"
        | "in_review"
        | "resolved"
        | "dismissed"
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
      conversation_type: ["direct"],
      creator_status: [
        "not_applied",
        "pending",
        "approved",
        "rejected",
        "suspended",
        "closed",
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
      profile_status: [
        "incomplete",
        "pending_review",
        "active",
        "suspended",
        "deactivated",
        "deleted",
      ],
      report_priority: ["low", "normal", "high", "urgent"],
      report_status: [
        "submitted",
        "triaged",
        "in_review",
        "resolved",
        "dismissed",
      ],
    },
  },
} as const

