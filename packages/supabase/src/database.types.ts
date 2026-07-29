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
      block_user: {
        Args: { p_blocked_id: string; p_reason_code?: string }
        Returns: boolean
      }
      can_moderate_content: { Args: never; Returns: boolean }
      can_view_media: { Args: { p_media_id: string }; Returns: boolean }
      cancel_friend_request: {
        Args: { p_friendship_id: string }
        Returns: boolean
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
      remove_media_from_album: {
        Args: { p_album_id: string; p_media_id: string }
        Returns: boolean
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
      friendship_status: "pending" | "accepted" | "declined" | "cancelled"
      gender_identity:
        | "female"
        | "male"
        | "non_binary"
        | "other"
        | "prefer_not_to_say"
      media_moderation_status:
        | "pending_upload"
        | "pending_review"
        | "approved"
        | "rejected"
        | "quarantined"
        | "deleted"
      media_type: "image"
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
      friendship_status: ["pending", "accepted", "declined", "cancelled"],
      gender_identity: [
        "female",
        "male",
        "non_binary",
        "other",
        "prefer_not_to_say",
      ],
      media_moderation_status: [
        "pending_upload",
        "pending_review",
        "approved",
        "rejected",
        "quarantined",
        "deleted",
      ],
      media_type: ["image"],
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

