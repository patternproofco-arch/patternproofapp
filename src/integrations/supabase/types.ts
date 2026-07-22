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
      agent_messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "agent_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      attorney_client_links: {
        Row: {
          attorney_case_notes: string | null
          attorney_user_id: string
          client_user_id: string
          created_at: string
          deposition_prep_consent: boolean
          deposition_prep_consent_at: string | null
          id: string
          include_all_evidence: boolean
          include_all_incidents: boolean
          include_patterns: boolean
          invitation_id: string | null
          org_id: string | null
          revoked_at: string | null
          scope_evidence: string[]
          scope_incidents: string[]
          status: string
        }
        Insert: {
          attorney_case_notes?: string | null
          attorney_user_id: string
          client_user_id: string
          created_at?: string
          deposition_prep_consent?: boolean
          deposition_prep_consent_at?: string | null
          id?: string
          include_all_evidence?: boolean
          include_all_incidents?: boolean
          include_patterns?: boolean
          invitation_id?: string | null
          org_id?: string | null
          revoked_at?: string | null
          scope_evidence?: string[]
          scope_incidents?: string[]
          status?: string
        }
        Update: {
          attorney_case_notes?: string | null
          attorney_user_id?: string
          client_user_id?: string
          created_at?: string
          deposition_prep_consent?: boolean
          deposition_prep_consent_at?: string | null
          id?: string
          include_all_evidence?: boolean
          include_all_incidents?: boolean
          include_patterns?: boolean
          invitation_id?: string | null
          org_id?: string | null
          revoked_at?: string | null
          scope_evidence?: string[]
          scope_incidents?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorney_client_links_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "attorney_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_document_requests: {
        Row: {
          attorney_user_id: string
          client_user_id: string
          completed_at: string | null
          created_at: string
          details: string | null
          id: string
          link_id: string
          status: string
          title: string
        }
        Insert: {
          attorney_user_id: string
          client_user_id: string
          completed_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          link_id: string
          status?: string
          title: string
        }
        Update: {
          attorney_user_id?: string
          client_user_id?: string
          completed_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          link_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorney_document_requests_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "attorney_client_links"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_evidence_reviews: {
        Row: {
          attorney_user_id: string
          client_user_id: string
          created_at: string
          evidence_id: string
          exhibit_label: string | null
          id: string
          linked_incident_id: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attorney_user_id: string
          client_user_id: string
          created_at?: string
          evidence_id: string
          exhibit_label?: string | null
          id?: string
          linked_incident_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attorney_user_id?: string
          client_user_id?: string
          created_at?: string
          evidence_id?: string
          exhibit_label?: string | null
          id?: string
          linked_incident_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorney_evidence_reviews_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attorney_evidence_reviews_linked_incident_id_fkey"
            columns: ["linked_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_incident_notes: {
        Row: {
          attorney_user_id: string
          client_user_id: string
          created_at: string
          flagged: boolean
          id: string
          incident_id: string
          link_id: string
          note: string | null
          reviewed: boolean
          updated_at: string
        }
        Insert: {
          attorney_user_id: string
          client_user_id: string
          created_at?: string
          flagged?: boolean
          id?: string
          incident_id: string
          link_id: string
          note?: string | null
          reviewed?: boolean
          updated_at?: string
        }
        Update: {
          attorney_user_id?: string
          client_user_id?: string
          created_at?: string
          flagged?: boolean
          id?: string
          incident_id?: string
          link_id?: string
          note?: string | null
          reviewed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attorney_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          attorney_email: string
          attorney_name: string | null
          client_user_id: string
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          expires_at: string | null
          firm_name: string | null
          id: string
          include_all_evidence: boolean
          include_all_incidents: boolean
          include_patterns: boolean
          invite_token: string
          personal_note: string | null
          scope_evidence: string[]
          scope_incidents: string[]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          attorney_email: string
          attorney_name?: string | null
          client_user_id: string
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          expires_at?: string | null
          firm_name?: string | null
          id?: string
          include_all_evidence?: boolean
          include_all_incidents?: boolean
          include_patterns?: boolean
          invite_token?: string
          personal_note?: string | null
          scope_evidence?: string[]
          scope_incidents?: string[]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          attorney_email?: string
          attorney_name?: string | null
          client_user_id?: string
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          expires_at?: string | null
          firm_name?: string | null
          id?: string
          include_all_evidence?: boolean
          include_all_incidents?: boolean
          include_patterns?: boolean
          invite_token?: string
          personal_note?: string | null
          scope_evidence?: string[]
          scope_incidents?: string[]
          status?: string
        }
        Relationships: []
      }
      attorney_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          link_id: string
          read_at: string | null
          sender_role: Database["public"]["Enums"]["app_role"]
          sender_user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          link_id: string
          read_at?: string | null
          sender_role: Database["public"]["Enums"]["app_role"]
          sender_user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          link_id?: string
          read_at?: string | null
          sender_role?: Database["public"]["Enums"]["app_role"]
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorney_messages_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "attorney_client_links"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_missing_evidence_checklist: {
        Row: {
          attorney_user_id: string
          client_user_id: string
          created_at: string
          id: string
          is_resolved: boolean
          item_label: string
          notes: string | null
          resolved_at: string | null
          source: string
          updated_at: string
        }
        Insert: {
          attorney_user_id: string
          client_user_id: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          item_label: string
          notes?: string | null
          resolved_at?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          attorney_user_id?: string
          client_user_id?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          item_label?: string
          notes?: string | null
          resolved_at?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      attorney_profiles: {
        Row: {
          bar_number: string | null
          confidentiality_accepted_at: string | null
          created_at: string
          email: string
          firm_id: string | null
          firm_name: string | null
          full_name: string
          jurisdiction: string | null
          onboarded: boolean
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bar_number?: string | null
          confidentiality_accepted_at?: string | null
          created_at?: string
          email: string
          firm_id?: string | null
          firm_name?: string | null
          full_name: string
          jurisdiction?: string | null
          onboarded?: boolean
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bar_number?: string | null
          confidentiality_accepted_at?: string | null
          created_at?: string
          email?: string
          firm_id?: string | null
          firm_name?: string | null
          full_name?: string
          jurisdiction?: string | null
          onboarded?: boolean
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorney_profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_survivor_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          attorney_user_id: string
          created_at: string
          expires_at: string
          id: string
          invite_token: string
          personal_note: string | null
          status: string
          survivor_email: string
          survivor_name: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          attorney_user_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          personal_note?: string | null
          status?: string
          survivor_email: string
          survivor_name?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          attorney_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          personal_note?: string | null
          status?: string
          survivor_email?: string
          survivor_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attorney_time_logs: {
        Row: {
          attorney_user_id: string
          client_user_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          link_id: string | null
          notes: string | null
          page_path: string | null
          started_at: string
        }
        Insert: {
          attorney_user_id: string
          client_user_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          link_id?: string | null
          notes?: string | null
          page_path?: string | null
          started_at?: string
        }
        Update: {
          attorney_user_id?: string
          client_user_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          link_id?: string | null
          notes?: string | null
          page_path?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorney_time_logs_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "attorney_client_links"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          created_at: string
          event_type: string
          id: string
          meta: Json | null
          subject_id: string | null
          subject_kind: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          event_type: string
          id?: string
          meta?: Json | null
          subject_id?: string | null
          subject_kind?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json | null
          subject_id?: string | null
          subject_kind?: string | null
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
      case_collaborators: {
        Row: {
          accepted_at: string | null
          collaborator_email: string
          collaborator_name: string | null
          collaborator_user_id: string | null
          created_at: string
          id: string
          invite_token: string
          link_id: string
          owner_attorney_user_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          collaborator_email: string
          collaborator_name?: string | null
          collaborator_user_id?: string | null
          created_at?: string
          id?: string
          invite_token?: string
          link_id: string
          owner_attorney_user_id: string
          role: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          collaborator_email?: string
          collaborator_name?: string | null
          collaborator_user_id?: string | null
          created_at?: string
          id?: string
          invite_token?: string
          link_id?: string
          owner_attorney_user_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_collaborators_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "attorney_client_links"
            referencedColumns: ["id"]
          },
        ]
      }
      case_grants: {
        Row: {
          attorney_user_id: string
          client_link_id: string
          created_at: string
          granted_at: string
          granted_by: string
          id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          attorney_user_id: string
          client_link_id: string
          created_at?: string
          granted_at?: string
          granted_by: string
          id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          attorney_user_id?: string
          client_link_id?: string
          created_at?: string
          granted_at?: string
          granted_by?: string
          id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_grants_client_link_id_fkey"
            columns: ["client_link_id"]
            isOneToOne: false
            referencedRelation: "attorney_client_links"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          attached_evidence_ids: string[]
          case_name: string | null
          case_types: string[]
          created_at: string
          highlighted_incident_ids: string[]
          id: string
          jurisdiction: string | null
          legal_document_ids: string[]
          other_party: string | null
          pattern_summary: string | null
          relationship_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attached_evidence_ids?: string[]
          case_name?: string | null
          case_types?: string[]
          created_at?: string
          highlighted_incident_ids?: string[]
          id?: string
          jurisdiction?: string | null
          legal_document_ids?: string[]
          other_party?: string | null
          pattern_summary?: string | null
          relationship_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attached_evidence_ids?: string[]
          case_name?: string | null
          case_types?: string[]
          created_at?: string
          highlighted_incident_ids?: string[]
          id?: string
          jurisdiction?: string | null
          legal_document_ids?: string[]
          other_party?: string | null
          pattern_summary?: string | null
          relationship_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clio_connections: {
        Row: {
          access_token: string | null
          attorney_user_id: string
          clio_account_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          attorney_user_id: string
          clio_account_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          attorney_user_id?: string
          clio_account_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      communications: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          date: string
          direction: string
          from_party: string | null
          harassment_flag: boolean
          id: string
          linked_incident_id: string | null
          notes: string | null
          screenshot_url: string | null
          time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          content?: string | null
          created_at?: string
          date: string
          direction: string
          from_party?: string | null
          harassment_flag?: boolean
          id?: string
          linked_incident_id?: string | null
          notes?: string | null
          screenshot_url?: string | null
          time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          date?: string
          direction?: string
          from_party?: string | null
          harassment_flag?: boolean
          id?: string
          linked_incident_id?: string | null
          notes?: string | null
          screenshot_url?: string | null
          time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      court_dates: {
        Row: {
          court_name: string
          created_at: string
          hearing_at: string
          hearing_type: string
          id: string
          location: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          court_name: string
          created_at?: string
          hearing_at: string
          hearing_type: string
          id?: string
          location?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          court_name?: string
          created_at?: string
          hearing_at?: string
          hearing_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
          bytes: number | null
          created_at: string
          date: string
          deleted_at: string | null
          derivative_kind: string | null
          description: string | null
          family_id: string | null
          file_type: string
          file_url: string
          id: string
          import_batch_id: string | null
          integrity_verified_at: string | null
          linked_incident_id: string | null
          linked_recording_id: string | null
          mime: string | null
          original_filename: string | null
          parent_evidence_id: string | null
          preservation_status: string | null
          preserved_at: string | null
          raw_metadata: Json | null
          sha256: string | null
          title: string
          user_id: string
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          date: string
          deleted_at?: string | null
          derivative_kind?: string | null
          description?: string | null
          family_id?: string | null
          file_type: string
          file_url: string
          id?: string
          import_batch_id?: string | null
          integrity_verified_at?: string | null
          linked_incident_id?: string | null
          linked_recording_id?: string | null
          mime?: string | null
          original_filename?: string | null
          parent_evidence_id?: string | null
          preservation_status?: string | null
          preserved_at?: string | null
          raw_metadata?: Json | null
          sha256?: string | null
          title: string
          user_id: string
        }
        Update: {
          bytes?: number | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          derivative_kind?: string | null
          description?: string | null
          family_id?: string | null
          file_type?: string
          file_url?: string
          id?: string
          import_batch_id?: string | null
          integrity_verified_at?: string | null
          linked_incident_id?: string | null
          linked_recording_id?: string | null
          mime?: string | null
          original_filename?: string | null
          parent_evidence_id?: string | null
          preservation_status?: string | null
          preserved_at?: string | null
          raw_metadata?: Json | null
          sha256?: string | null
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
          {
            foreignKeyName: "evidence_parent_evidence_id_fkey"
            columns: ["parent_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_families: {
        Row: {
          canonical_evidence_id: string | null
          created_at: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_evidence_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canonical_evidence_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      firms: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          receipt: Json | null
          source_kind: string | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          receipt?: Json | null
          source_kind?: string | null
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          receipt?: Json | null
          source_kind?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          abuse_types: string[]
          anchor_incident_id: string | null
          anchor_label: string | null
          confidence: number | null
          confirmed_at: string | null
          created_at: string
          date: string | null
          date_precision: string
          date_range_end: string | null
          date_range_start: string | null
          deleted_at: string | null
          description: string
          emotional_impact: string | null
          has_escalation_flag: boolean
          id: string
          location: string | null
          severity_level: number | null
          source: string
          source_evidence_id: string | null
          time: string | null
          user_id: string
          witnesses: string | null
        }
        Insert: {
          abuse_types?: string[]
          anchor_incident_id?: string | null
          anchor_label?: string | null
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          date?: string | null
          date_precision?: string
          date_range_end?: string | null
          date_range_start?: string | null
          deleted_at?: string | null
          description: string
          emotional_impact?: string | null
          has_escalation_flag?: boolean
          id?: string
          location?: string | null
          severity_level?: number | null
          source?: string
          source_evidence_id?: string | null
          time?: string | null
          user_id: string
          witnesses?: string | null
        }
        Update: {
          abuse_types?: string[]
          anchor_incident_id?: string | null
          anchor_label?: string | null
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          date?: string | null
          date_precision?: string
          date_range_end?: string | null
          date_range_start?: string | null
          deleted_at?: string | null
          description?: string
          emotional_impact?: string | null
          has_escalation_flag?: boolean
          id?: string
          location?: string | null
          severity_level?: number | null
          source?: string
          source_evidence_id?: string | null
          time?: string | null
          user_id?: string
          witnesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_anchor_incident_id_fkey"
            columns: ["anchor_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_source_evidence_id_fkey"
            columns: ["source_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          ai_extracted: boolean
          ai_extraction_confirmed: boolean
          case_number: string | null
          court_name: string | null
          created_at: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          effective_date: string | null
          expiration_date: string | null
          file_type: string
          file_url: string
          id: string
          incident_date: string | null
          issuing_officer: string | null
          judge_name: string | null
          key_terms: string | null
          linked_incident_ids: string[] | null
          notes: string | null
          protected_party: string | null
          restrained_party: string | null
          title: string
          user_id: string
        }
        Insert: {
          ai_extracted?: boolean
          ai_extraction_confirmed?: boolean
          case_number?: string | null
          court_name?: string | null
          created_at?: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          effective_date?: string | null
          expiration_date?: string | null
          file_type: string
          file_url: string
          id?: string
          incident_date?: string | null
          issuing_officer?: string | null
          judge_name?: string | null
          key_terms?: string | null
          linked_incident_ids?: string[] | null
          notes?: string | null
          protected_party?: string | null
          restrained_party?: string | null
          title: string
          user_id: string
        }
        Update: {
          ai_extracted?: boolean
          ai_extraction_confirmed?: boolean
          case_number?: string | null
          court_name?: string | null
          created_at?: string
          document_type?: Database["public"]["Enums"]["legal_document_type"]
          effective_date?: string | null
          expiration_date?: string | null
          file_type?: string
          file_url?: string
          id?: string
          incident_date?: string | null
          issuing_officer?: string | null
          judge_name?: string | null
          key_terms?: string | null
          linked_incident_ids?: string[] | null
          notes?: string | null
          protected_party?: string | null
          restrained_party?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      message_threads: {
        Row: {
          attorney_summary: string | null
          conversation_participant: string | null
          created_at: string
          exhibit_label: string | null
          file_url: string
          flags: Json
          id: string
          message_count: number
          parse_error: string | null
          parse_status: string
          source_filename: string
          source_type: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attorney_summary?: string | null
          conversation_participant?: string | null
          created_at?: string
          exhibit_label?: string | null
          file_url: string
          flags?: Json
          id?: string
          message_count?: number
          parse_error?: string | null
          parse_status?: string
          source_filename: string
          source_type: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attorney_summary?: string | null
          conversation_participant?: string | null
          created_at?: string
          exhibit_label?: string | null
          file_url?: string
          flags?: Json
          id?: string
          message_count?: number
          parse_error?: string | null
          parse_status?: string
          source_filename?: string
          source_type?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
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
      pattern_analyses: {
        Row: {
          analysis: Json
          created_at: string
          id: string
          incident_count_at_time: number
          model_used: string | null
          reviewed_status: Json
          user_id: string
        }
        Insert: {
          analysis: Json
          created_at?: string
          id?: string
          incident_count_at_time?: number
          model_used?: string | null
          reviewed_status?: Json
          user_id: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          incident_count_at_time?: number
          model_used?: string | null
          reviewed_status?: Json
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      thread_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string | null
          created_at: string
          flags: Json
          id: string
          position: number
          recipient: string | null
          sender: string | null
          sent_at_time: string | null
          sent_on: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          flags?: Json
          id?: string
          position?: number
          recipient?: string | null
          sender?: string | null
          sent_at_time?: string | null
          sent_on?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          flags?: Json
          id?: string
          position?: number
          recipient?: string | null
          sender?: string | null
          sent_at_time?: string | null
          sent_on?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          attorney_user_id: string
          billable: boolean
          case_link_id: string
          created_at: string
          description: string
          entry_date: string
          id: string
          minutes: number
          updated_at: string
        }
        Insert: {
          attorney_user_id: string
          billable?: boolean
          case_link_id: string
          created_at?: string
          description: string
          entry_date?: string
          id?: string
          minutes: number
          updated_at?: string
        }
        Update: {
          attorney_user_id?: string
          billable?: boolean
          case_link_id?: string
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_case_link_id_fkey"
            columns: ["case_link_id"]
            isOneToOne: false
            referencedRelation: "attorney_client_links"
            referencedColumns: ["id"]
          },
        ]
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
      voice_notes: {
        Row: {
          audio_url: string
          created_at: string
          date: string
          duration_seconds: number | null
          id: string
          title: string
          transcribed_at: string | null
          transcript: string | null
          transcription_status: string
          user_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          date: string
          duration_seconds?: number | null
          id?: string
          title: string
          transcribed_at?: string | null
          transcript?: string | null
          transcription_status?: string
          user_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          date?: string
          duration_seconds?: number | null
          id?: string
          title?: string
          transcribed_at?: string | null
          transcript?: string | null
          transcription_status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_audit_event: {
        Args: {
          p_actor_id?: string
          p_actor_kind?: string
          p_event_type: string
          p_meta?: Json
          p_subject_id?: string
          p_subject_kind?: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      access_level:
        | "full"
        | "court_packet_only"
        | "incidents_only"
        | "evidence_only"
      app_role: "survivor" | "attorney" | "admin"
      attorney_type: "attorney" | "advocate"
      legal_document_type:
        | "tro"
        | "fro"
        | "police_report"
        | "911_log"
        | "cps_report"
        | "custody_order"
        | "court_order"
        | "hearing_transcript"
        | "other"
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
      app_role: ["survivor", "attorney", "admin"],
      attorney_type: ["attorney", "advocate"],
      legal_document_type: [
        "tro",
        "fro",
        "police_report",
        "911_log",
        "cps_report",
        "custody_order",
        "court_order",
        "hearing_transcript",
        "other",
      ],
      opra_status: ["draft", "sent", "response_received"],
    },
  },
} as const
