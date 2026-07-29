export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      administrative_areas: {
        Row: {
          area_type: string;
          code: string;
          country_code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name_en: string | null;
          name_vi: string;
          parent_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          area_type: string;
          code: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_vi: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          area_type?: string;
          code?: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_vi?: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'administrative_areas_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'administrative_areas';
            referencedColumns: ['id'];
          },
        ];
      };
      creator_profiles: {
        Row: {
          approved_at: string | null;
          created_at: string;
          creator_bio: string | null;
          creator_status: string;
          fan_threshold_units: number;
          joined_at: string | null;
          payout_eligible: boolean;
          suspended_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          approved_at?: string | null;
          created_at?: string;
          creator_bio?: string | null;
          creator_status?: string;
          fan_threshold_units?: number;
          joined_at?: string | null;
          payout_eligible?: boolean;
          suspended_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          approved_at?: string | null;
          created_at?: string;
          creator_bio?: string | null;
          creator_status?: string;
          fan_threshold_units?: number;
          joined_at?: string | null;
          payout_eligible?: boolean;
          suspended_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'creator_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_media_id: string | null;
          bio: string | null;
          created_at: string;
          deleted_at: string | null;
          discovery_enabled: boolean;
          display_name: string | null;
          gender: string | null;
          id: string;
          is_creator: boolean;
          last_active_at: string | null;
          nearby_enabled: boolean;
          profile_status: string;
          province_id: string | null;
          updated_at: string;
          username: string | null;
          username_changed_at: string | null;
        };
        Insert: {
          avatar_media_id?: string | null;
          bio?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          discovery_enabled?: boolean;
          display_name?: string | null;
          gender?: string | null;
          id: string;
          is_creator?: boolean;
          last_active_at?: string | null;
          nearby_enabled?: boolean;
          profile_status?: string;
          province_id?: string | null;
          updated_at?: string;
          username?: string | null;
          username_changed_at?: string | null;
        };
        Update: {
          avatar_media_id?: string | null;
          bio?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          discovery_enabled?: boolean;
          display_name?: string | null;
          gender?: string | null;
          id?: string;
          is_creator?: boolean;
          last_active_at?: string | null;
          nearby_enabled?: boolean;
          profile_status?: string;
          province_id?: string | null;
          updated_at?: string;
          username?: string | null;
          username_changed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_province_id_fkey';
            columns: ['province_id'];
            isOneToOne: false;
            referencedRelation: 'administrative_areas';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      accept_creator_terms: {
        Args: { p_creator_terms_version: string };
        Returns: string;
      };
      apply_for_creator: {
        Args: {
          p_creator_bio: string;
          p_fan_threshold_units?: number | null;
        };
        Returns: string;
      };
      complete_adult_onboarding: {
        Args: {
          p_bio?: string | null;
          p_community_rules_version: string;
          p_confirms_18: boolean;
          p_date_of_birth: string;
          p_display_name: string;
          p_gender?: string | null;
          p_province_id?: string | null;
          p_terms_version: string;
          p_username: string;
        };
        Returns: {
          account_status: string;
          profile_id: string;
          profile_status: string;
        }[];
      };
      get_my_account_bootstrap: {
        Args: Record<PropertyKey, never>;
        Returns: {
          account_status: string;
          community_rules_accepted: boolean;
          creator_status: string;
          is_adult_verified: boolean;
          is_creator: boolean;
          payout_eligible: boolean;
          profile_status: string;
          terms_accepted: boolean;
          user_id: string;
        }[];
      };
      get_public_app_config: {
        Args: Record<PropertyKey, never>;
        Returns: {
          key: string;
          updated_at: string;
          value_json: Json;
          value_type: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;
