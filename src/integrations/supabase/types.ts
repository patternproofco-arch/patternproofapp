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
      attorney_access: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          access_token: string
          attorney_email: string
          attorney_name: string
          attorney_type: Database["public"]["Enums"]["attorney_type"]
          created_at: string
          expires_at: string | null
          id: string
          include_escalation: boolean
          last_accessed_at: string | null
          revoked_at: string | null
          shared_evidence_ids: string[]
          shared_incident_ids: string[]
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          access_token?: string
          attorney_email: string
          attorney_name: string
          attorney_type?: Database["public"]["Enums"]["attorney_type"]
          created_at?: string
          expires_at?: string | null
          id?: string
          include_escalation?: boolean
          last_accessed_at?: string | null
          revoked_at?: string | null
          shared_evidence_ids?: string[]
          shared_incident_ids?: string[]
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          access_token?: string
          attorney_email?: string
          attorney_name?: string
          attorney_type?: Database["public"]["Enums"]["attorney_type"]
          created_at?: string
          expires_at?: string | null
          id?: string
          include_escalation?: boolean
          last_accessed_at?: string | null
          revoked_at?: string | null
          shared_evidence_ids?: string[]
          shared_incident_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action_type: string
          actor: string
          created_at: string
          entry_hash: string | null
          id: string
          record_reference: string | null
          timestamp_utc: string
          user_id: string
        }
        Insert: {
          action_type: string
          actor?: string
          created_at?: string
          entry_hash?: string | null
          id?: string
          record_reference?: string | null
          timestamp_utc?: string
          user_id: string
        }
        Update: {
          action_type?: string
          actor?: string
          created_at?: string
          entry_hash?: string | null
          id?: string
          record_reference?: string | null
          timestamp_utc?: string
          user_id?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          attached_evidence_ids: string[]
          case_types: string[]
          created_at: string
          highlighted_incident_ids: string[]
          id: string
          jurisdiction: string | null
          other_party: string | null
          pattern_summary: string | null
          relationship_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attached_evidence_ids?: string[]
          case_types?: string[]
          created_at?: string
          highlighted_incident_ids?: string[]
          id?: string
          jurisdiction?: string | null
          other_party?: string | null
          pattern_summary?: string | null
          relationship_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attached_evidence_ids?: string[]
          case_types?: string[]
          created_at?: string
          highlighted_incident_ids?: string[]
          id?: string
          jurisdiction?: string | null
          other_party?: string | null
          pattern_summary?: string | null
          relationship_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      escalation_flags: {
        Row: {
          created_at: string
          details: string | null
          dismissed_at: string | null
          flag_type: string
          id: string
          incident_id: string | null
          severity_tier: number
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          dismissed_at?: string | null
          flag_type: string
          id?: string
          incident_id?: string | null
          severity_tier: number
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          dismissed_at?: string | null
          flag_type?: string
          id?: string
          incident_id?: string | null
          severity_tier?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_flags_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          created_at: string
          date: string
          description: string | null
          file_type: string
          file_url: string
          id: string
          linked_incident_id: string | null
          linked_recording_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          file_type: string
          file_url: string
          id?: string
          linked_incident_id?: string | null
          linked_recording_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          file_type?: string
          file_url?: string
          id?: string
          linked_incident_id?: string | null
          linked_recording_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_linked_recording_id_fkey"
            columns: ["linked_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          abuse_types: string[]
          created_at: string
          date: string
          description: string
          emotional_impact: string | null
          has_escalation_flag: boolean
          id: string
          location: string | null
          severity_level: number | null
          time: string | null
          user_id: string
          witnesses: string | null
        }
        Insert: {
          abuse_types?: string[]
          created_at?: string
          date: string
          description: string
          emotional_impact?: string | null
          has_escalation_flag?: boolean
          id?: string
          location?: string | null
          severity_level?: number | null
          time?: string | null
          user_id: string
          witnesses?: string | null
        }
        Update: {
          abuse_types?: string[]
          created_at?: string
          date?: string
          description?: string
          emotional_impact?: string | null
          has_escalation_flag?: boolean
          id?: string
          location?: string | null
          severity_level?: number | null
          time?: string | null
          user_id?: string
          witnesses?: string | null
        }
        Relationships: []
      }
      opra_requests: {
        Row: {
          additional_details: string | null
          agency_address: string | null
          agency_name: string | null
          created_at: string
          custodian_title: string | null
          date_range_end: string | null
          date_range_start: string | null
          generated_letter: string | null
          id: string
          record_types: string[]
          status: Database["public"]["Enums"]["opra_status"]
          user_id: string
        }
        Insert: {
          additional_details?: string | null
          agency_address?: string | null
          agency_name?: string | null
          created_at?: string
          custodian_title?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          generated_letter?: string | null
          id?: string
          record_types?: string[]
          status?: Database["public"]["Enums"]["opra_status"]
          user_id: string
        }
        Update: {
          additional_details?: string | null
          agency_address?: string | null
          agency_name?: string | null
          created_at?: string
          custodian_title?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          generated_letter?: string | null
          id?: string
          record_types?: string[]
          status?: Database["public"]["Enums"]["opra_status"]
          user_id?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          audio_url: string
          created_at: string
          date: string
          duration_seconds: number | null
          id: string
          linked_incident_id: string | null
          recording_ended_at: string | null
          recording_started_at: string | null
          state_recorded_in: string | null
          title: string | null
          transcript: string | null
          user_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          date?: string
          duration_seconds?: number | null
          id?: string
          linked_incident_id?: string | null
          recording_ended_at?: string | null
          recording_started_at?: string | null
          state_recorded_in?: string | null
          title?: string | null
          transcript?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          date?: string
          duration_seconds?: number | null
          id?: string
          linked_incident_id?: string | null
          recording_ended_at?: string | null
          recording_started_at?: string | null
          state_recorded_in?: string | null
          title?: string | null
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_notes: {
        Row: {
          audio_url: string
          created_at: string
          date: string
          duration_seconds: number | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          date: string
          duration_seconds?: number | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          date?: string
          duration_seconds?: number | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      access_level:
        | "full"
        | "court_packet_only"
        | "incidents_only"
        | "evidence_only"
      attorney_type: "attorney" | "advocate"
      opra_status: "draft" | "sent" | "response_received"
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
      access_level: [
        "full",
        "court_packet_only",
        "incidents_only",
        "evidence_only",
      ],
      attorney_type: ["attorney", "advocate"],
      opra_status: ["draft", "sent", "response_received"],
    },
  },
} as const
