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
      document_knowledge: {
        Row: {
          chunk_index: number
          content_chunk: string
          created_at: string
          document_name: string
          document_type: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          processed_at: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          content_chunk: string
          created_at?: string
          document_name: string
          document_type?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          processed_at?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content_chunk?: string
          created_at?: string
          document_name?: string
          document_type?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          processed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      huddle_person_overrides: {
        Row: {
          created_at: string
          huddle_play_id: string
          id: string
          override: string
          raw_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          huddle_play_id: string
          id?: string
          override: string
          raw_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          huddle_play_id?: string
          id?: string
          override?: string
          raw_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      huddle_plays: {
        Row: {
          created_at: string
          embedding: string | null
          final_reply: string | null
          generated_reply: string
          id: string
          principles: string | null
          screenshot_text: string
          selected_tone: string | null
          updated_at: string
          user_draft: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          final_reply?: string | null
          generated_reply: string
          id?: string
          principles?: string | null
          screenshot_text: string
          selected_tone?: string | null
          updated_at?: string
          user_draft: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          final_reply?: string | null
          generated_reply?: string
          id?: string
          principles?: string | null
          screenshot_text?: string
          selected_tone?: string | null
          updated_at?: string
          user_draft?: string
          user_id?: string
        }
        Relationships: []
      }
      people_overrides: {
        Row: {
          created_at: string
          id: string
          override: string
          raw_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          override: string
          raw_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          override?: string
          raw_name?: string
          user_id?: string
        }
        Relationships: []
      }
      trello_board_positions: {
        Row: {
          column_id: string
          created_at: string
          id: string
          mode: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          mode?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          mode?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_style_profiles: {
        Row: {
          avg_sentence_length: number | null
          common_sentences: Json | null
          common_topics: string[] | null
          created_at: string
          formality: string | null
          huddle_count: number | null
          id: string
          common_phrases: Json | null
          personal_profile: Json | null
          style_fingerprint: Json | null
          sentiment: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_sentence_length?: number | null
          common_sentences?: Json | null
          common_topics?: string[] | null
          created_at?: string
          common_phrases?: Json | null
          formality?: string | null
          huddle_count?: number | null
          id?: string
          personal_profile?: Json | null
          style_fingerprint?: Json | null
          sentiment?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_sentence_length?: number | null
          common_sentences?: Json | null
          common_topics?: string[] | null
          created_at?: string
          common_phrases?: Json | null
          formality?: string | null
          huddle_count?: number | null
          id?: string
          personal_profile?: Json | null
          style_fingerprint?: Json | null
          sentiment?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_huddle_plays: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_user_id: string
        }
        Returns: {
          id: string
          screenshot_text: string
          user_draft: string
          generated_reply: string
          final_reply: string
          created_at: string
          similarity: number
        }[]
      }
      search_document_knowledge: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          document_name: string
          content_chunk: string
          similarity: number
          metadata: Json
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
