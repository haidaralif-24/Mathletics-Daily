
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "id": boolean,"osn_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: boolean,"osn_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "id"?: boolean,"osn_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"grades": {
                  Row: {
                    "base_points": number,"criteria_ticks": NonNullable<Json>,"graded_at": string,"graded_by": string | null,"is_correct": boolean,"needs_regrade": boolean,"private_feedback": string | null,"speed_points": number,"steps_points": number,"submission_id": string,"total_points": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "base_points"?: number,"criteria_ticks"?: NonNullable<Json>,"graded_at"?: string,"graded_by"?: string | null,"is_correct": boolean,"needs_regrade"?: boolean,"private_feedback"?: string | null,"speed_points"?: number,"steps_points"?: number,"submission_id": string,"total_points"?: never
                  }
                  Update: {
                    "base_points"?: number,"criteria_ticks"?: NonNullable<Json>,"graded_at"?: string,"graded_by"?: string | null,"is_correct"?: boolean,"needs_regrade"?: boolean,"private_feedback"?: string | null,"speed_points"?: number,"steps_points"?: number,"submission_id"?: string,"total_points"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "grades_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: true
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"class_name": string | null,"created_at": string,"display_name": string,"email": string,"id": string,"must_change_password": boolean,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"class_name"?: string | null,"created_at"?: string,"display_name": string,"email": string,"id": string,"must_change_password"?: boolean,"role"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"class_name"?: string | null,"created_at"?: string,"display_name"?: string,"email"?: string,"id"?: string,"must_change_password"?: boolean,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"question_keys": {
                  Row: {
                    "accepted_answers": (string)[],"answer_type": string,"created_at": string,"question_id": string,"tolerance": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_answers": (string)[],"answer_type"?: string,"created_at"?: string,"question_id": string,"tolerance"?: number | null
                  }
                  Update: {
                    "accepted_answers"?: (string)[],"answer_type"?: string,"created_at"?: string,"question_id"?: string,"tolerance"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"question_markschemes": {
                  Row: {
                    "description_md": string,"id": string,"points": number,"position": number,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description_md": string,"id"?: string,"points": number,"position": number,"question_id": string
                  }
                  Update: {
                    "description_md"?: string,"id"?: string,"points"?: number,"position"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_markschemes_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"question_solutions": {
                  Row: {
                    "publish_markscheme": boolean,"question_id": string,"solution_md": string
                  }
                  ComputedFields: never
                  Insert: {
                    "publish_markscheme"?: boolean,"question_id": string,"solution_md": string
                  }
                  Update: {
                    "publish_markscheme"?: boolean,"question_id"?: string,"solution_md"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_solutions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "body_latex": string,"closes_at": string | null,"created_at": string,"created_by": string | null,"difficulty": number | null,"id": string,"image_path": string | null,"release_at": string | null,"release_date": string,"title": string,"topic": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_latex": string,"closes_at"?: never,"created_at"?: string,"created_by"?: string | null,"difficulty"?: number | null,"id"?: string,"image_path"?: string | null,"release_at"?: never,"release_date": string,"title": string,"topic"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body_latex"?: string,"closes_at"?: never,"created_at"?: string,"created_by"?: string | null,"difficulty"?: number | null,"id"?: string,"image_path"?: string | null,"release_at"?: never,"release_date"?: string,"title"?: string,"topic"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"submissions": {
                  Row: {
                    "auto_verdict": string | null,"created_at": string,"final_answer": string,"first_submitted_at": string,"id": string,"question_id": string,"step_photo_paths": (string)[],"steps_text": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_verdict"?: string | null,"created_at"?: string,"final_answer": string,"first_submitted_at"?: string,"id"?: string,"question_id": string,"step_photo_paths"?: (string)[],"steps_text"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "auto_verdict"?: string | null,"created_at"?: string,"final_answer"?: string,"first_submitted_at"?: string,"id"?: string,"question_id"?: string,"step_photo_paths"?: (string)[],"steps_text"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "get_osn_date":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_active_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"leaderboard":
{ Args: { "p_period"?: string }; Returns: {
              "attempted": number,"avg_submit_seconds": number,"class_name": string,"correct_count": number,"display_name": string,"rank": number,"total_points": number,"user_id": string
            }[]
                           },
"submit_answer":
{ Args: { "p_auto_verdict"?: string,"p_final_answer": string,"p_photo_paths": (string)[],"p_question_id": string,"p_steps_text": string }; Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
