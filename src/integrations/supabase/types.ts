export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      archive_episodes: {
        Row: {
          created_at: string
          episode: number
          id: string
          poster_url: string | null
          season: number
          series_title: string
          stream_url: string
          title: string | null
        }
        Insert: {
          created_at?: string
          episode: number
          id?: string
          poster_url?: string | null
          season: number
          series_title: string
          stream_url: string
          title?: string | null
        }
        Update: {
          created_at?: string
          episode?: number
          id?: string
          poster_url?: string | null
          season?: number
          series_title?: string
          stream_url?: string
          title?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          level: string
          message: string
          meta: Json
          source: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          level?: string
          message: string
          meta?: Json
          source?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          level?: string
          message?: string
          meta?: Json
          source?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          created_at: string
          enabled: boolean
          hit_count: number
          id: string
          match_field: string
          match_operator: string
          match_value: string
          name: string
          priority: number
          set_category: string | null
          set_country: string | null
          set_is_active: boolean | null
          set_is_foreign: boolean | null
          set_sub_category: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          hit_count?: number
          id?: string
          match_field?: string
          match_operator?: string
          match_value: string
          name: string
          priority?: number
          set_category?: string | null
          set_country?: string | null
          set_is_active?: boolean | null
          set_is_foreign?: boolean | null
          set_sub_category?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          hit_count?: number
          id?: string
          match_field?: string
          match_operator?: string
          match_value?: string
          name?: string
          priority?: number
          set_category?: string | null
          set_country?: string | null
          set_is_active?: boolean | null
          set_is_foreign?: boolean | null
          set_sub_category?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      epg_programmes: {
        Row: {
          category: string | null
          channel_id: string
          channel_name: string | null
          created_at: string
          description: string | null
          end_at: string
          id: string
          poster_url: string | null
          raw: Json
          source_id: string | null
          start_at: string
          stream_id: string | null
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          channel_id: string
          channel_name?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          poster_url?: string | null
          raw?: Json
          source_id?: string | null
          start_at: string
          stream_id?: string | null
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          poster_url?: string | null
          raw?: Json
          source_id?: string | null
          start_at?: string
          stream_id?: string | null
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epg_programmes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "epg_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      epg_sources: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          created_at: string
          disabled: boolean
          id: string
          last_error: string | null
          last_synced_at: string | null
          name: string
          stream_title_match: string | null
          timezone: string
          updated_at: string
          url: string
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          disabled?: boolean
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          stream_title_match?: string | null
          timezone?: string
          updated_at?: string
          url: string
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          disabled?: boolean
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          stream_title_match?: string | null
          timezone?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      home_row_items: {
        Row: {
          created_at: string
          id: string
          position: number
          row_id: string
          stream_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          row_id: string
          stream_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          row_id?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_row_items_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "home_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_row_items_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "user_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      home_rows: {
        Row: {
          created_at: string
          display: string
          enabled: boolean
          id: string
          kind: string
          max_items: number
          mode: string
          position: number
          rule: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display?: string
          enabled?: boolean
          id?: string
          kind?: string
          max_items?: number
          mode?: string
          position?: number
          rule?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display?: string
          enabled?: boolean
          id?: string
          kind?: string
          max_items?: number
          mode?: string
          position?: number
          rule?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      layout_sections: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          key: string
          kind: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          kind?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          kind?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          stream_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          stream_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          stream_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_imports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload: Json
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scraper_seeds: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          disabled: boolean
          failure_count: number
          force_category: string | null
          hint: string | null
          id: string
          last_error: string | null
          last_scanned_at: string | null
          priority: number
          success_count: number
          url: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          disabled?: boolean
          failure_count?: number
          force_category?: string | null
          hint?: string | null
          id?: string
          last_error?: string | null
          last_scanned_at?: string | null
          priority?: number
          success_count?: number
          url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          disabled?: boolean
          failure_count?: number
          force_category?: string | null
          hint?: string | null
          id?: string
          last_error?: string | null
          last_scanned_at?: string | null
          priority?: number
          success_count?: number
          url?: string
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          id: string
          meta: Json
          metric: string
          recorded_at: string
          unit: string | null
          value: number
        }
        Insert: {
          id?: string
          meta?: Json
          metric: string
          recorded_at?: string
          unit?: string | null
          value?: number
        }
        Update: {
          id?: string
          meta?: Json
          metric?: string
          recorded_at?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      tg_tv_schedule: {
        Row: {
          created_at: string
          description: string | null
          end_at: string
          id: string
          poster_url: string | null
          start_at: string
          stream_url: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          poster_url?: string | null
          start_at: string
          stream_url: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          poster_url?: string | null
          start_at?: string
          stream_url?: string
          title?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          label: string
          series_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          series_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          series_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streams: {
        Row: {
          ai_normalized_at: string | null
          backdrop_url: string | null
          backup_urls: Json
          bitrate_kbps: number | null
          cast_list: string[] | null
          category: string
          channel_group: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          duplicate_of: string | null
          episode: number | null
          failure_count: number
          fps: number | null
          health_score: number
          id: string
          imdb_rating: number | null
          is_active: boolean
          is_foreign: boolean
          last_checked_at: string | null
          last_error: string | null
          last_status_code: number | null
          logo_url: string | null
          manual_lock: boolean
          meta_enriched_at: string | null
          normalized_title: string | null
          origin: string | null
          poster_url: string | null
          promoted_at: string | null
          published_at: string
          quality_checked_at: string | null
          quality_label: string | null
          quarantine_reason: string | null
          referer: string | null
          release_year: number | null
          season: number | null
          series_title: string | null
          sort_order: number
          source_url: string
          status: string
          stream_type: string
          sub_category: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string
          tmdb_id: number | null
          updated_at: string
          user_agent: string | null
          video_height: number | null
          video_width: number | null
        }
        Insert: {
          ai_normalized_at?: string | null
          backdrop_url?: string | null
          backup_urls?: Json
          bitrate_kbps?: number | null
          cast_list?: string[] | null
          category: string
          channel_group?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          duplicate_of?: string | null
          episode?: number | null
          failure_count?: number
          fps?: number | null
          health_score?: number
          id?: string
          imdb_rating?: number | null
          is_active?: boolean
          is_foreign?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_status_code?: number | null
          logo_url?: string | null
          manual_lock?: boolean
          meta_enriched_at?: string | null
          normalized_title?: string | null
          origin?: string | null
          poster_url?: string | null
          promoted_at?: string | null
          published_at?: string
          quality_checked_at?: string | null
          quality_label?: string | null
          quarantine_reason?: string | null
          referer?: string | null
          release_year?: number | null
          season?: number | null
          series_title?: string | null
          sort_order?: number
          source_url: string
          status?: string
          stream_type: string
          sub_category?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
          user_agent?: string | null
          video_height?: number | null
          video_width?: number | null
        }
        Update: {
          ai_normalized_at?: string | null
          backdrop_url?: string | null
          backup_urls?: Json
          bitrate_kbps?: number | null
          cast_list?: string[] | null
          category?: string
          channel_group?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          duplicate_of?: string | null
          episode?: number | null
          failure_count?: number
          fps?: number | null
          health_score?: number
          id?: string
          imdb_rating?: number | null
          is_active?: boolean
          is_foreign?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_status_code?: number | null
          logo_url?: string | null
          manual_lock?: boolean
          meta_enriched_at?: string | null
          normalized_title?: string | null
          origin?: string | null
          poster_url?: string | null
          promoted_at?: string | null
          published_at?: string
          quality_checked_at?: string | null
          quality_label?: string | null
          quarantine_reason?: string | null
          referer?: string | null
          release_year?: number | null
          season?: number | null
          series_title?: string | null
          sort_order?: number
          source_url?: string
          status?: string
          stream_type?: string
          sub_category?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          user_agent?: string | null
          video_height?: number | null
          video_width?: number | null
        }
        Relationships: []
      }
      watch_events: {
        Row: {
          created_at: string
          id: string
          stream_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          stream_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          stream_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_events_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "user_streams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_system_status: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      stream_facets: {
        Args: never
        Returns: {
          kind: string
          n: number
          value: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "content_editor"
        | "tech_operator"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "user",
        "super_admin",
        "content_editor",
        "tech_operator",
      ],
    },
  },
} as const
