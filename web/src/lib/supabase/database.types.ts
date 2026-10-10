
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
            "block_outcomes": {
                  Row: {
                    "actual_minutes": number,"assigned_at": string,"auto": boolean,"block_id": string,"minutes_late": number | null,"outcome": string,"owner_id": string,"score": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_minutes"?: number,"assigned_at"?: string,"auto"?: boolean,"block_id": string,"minutes_late"?: number | null,"outcome": string,"owner_id"?: string,"score"?: number | null
                  }
                  Update: {
                    "actual_minutes"?: number,"assigned_at"?: string,"auto"?: boolean,"block_id"?: string,"minutes_late"?: number | null,"outcome"?: string,"owner_id"?: string,"score"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "block_outcomes_block_id_owner_id_fkey"
      columns: ["block_id","owner_id"]
isOneToOne: false
      referencedRelation: "calendar_blocks"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"block_series": {
                  Row: {
                    "active": boolean,"created_at": string,"duration_minutes": number,"goal_id": string | null,"id": string,"owner_id": string,"project_id": string | null,"start_minute": number,"task_id": string | null,"timer_mode": string | null,"title": string,"type": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"duration_minutes": number,"goal_id"?: string | null,"id"?: string,"owner_id"?: string,"project_id"?: string | null,"start_minute": number,"task_id"?: string | null,"timer_mode"?: string | null,"title": string,"type": string,"weekdays": (number)[]
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"duration_minutes"?: number,"goal_id"?: string | null,"id"?: string,"owner_id"?: string,"project_id"?: string | null,"start_minute"?: number,"task_id"?: string | null,"timer_mode"?: string | null,"title"?: string,"type"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "block_series_goal_id_owner_id_fkey"
      columns: ["goal_id","owner_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "block_series_project_fk"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "block_series_task_id_owner_id_fkey"
      columns: ["task_id","owner_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked": string,"blocker": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked": string,"blocker": string,"created_at"?: string
                  }
                  Update: {
                    "blocked"?: string,"blocker"?: string,"created_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"breaks": {
                  Row: {
                    "after_session_id": string,"created_at": string,"id": string,"owner_id": string,"suggested_minutes": number,"taken": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "after_session_id": string,"created_at"?: string,"id"?: string,"owner_id"?: string,"suggested_minutes": number,"taken": boolean
                  }
                  Update: {
                    "after_session_id"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string,"suggested_minutes"?: number,"taken"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "breaks_after_session_id_owner_id_fkey"
      columns: ["after_session_id","owner_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"calendar_blocks": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"created_at": string,"end_at": string,"external_uid": string | null,"goal_id": string | null,"id": string,"if_then_text": string | null,"owner_id": string,"project_id": string | null,"series_id": string | null,"start_at": string,"status": string,"task_id": string | null,"timer_mode": string | null,"title": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"end_at": string,"external_uid"?: string | null,"goal_id"?: string | null,"id"?: string,"if_then_text"?: string | null,"owner_id"?: string,"project_id"?: string | null,"series_id"?: string | null,"start_at": string,"status"?: string,"task_id"?: string | null,"timer_mode"?: string | null,"title": string,"type": string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"end_at"?: string,"external_uid"?: string | null,"goal_id"?: string | null,"id"?: string,"if_then_text"?: string | null,"owner_id"?: string,"project_id"?: string | null,"series_id"?: string | null,"start_at"?: string,"status"?: string,"task_id"?: string | null,"timer_mode"?: string | null,"title"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_blocks_goal_id_owner_id_fkey"
      columns: ["goal_id","owner_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "calendar_blocks_project_fk"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "calendar_blocks_series_id_owner_id_fkey"
      columns: ["series_id","owner_id"]
isOneToOne: false
      referencedRelation: "block_series"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "calendar_blocks_task_id_owner_id_fkey"
      columns: ["task_id","owner_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"call_signals": {
                  Row: {
                    "co_session_id": string,"created_at": string,"from_user": string,"id": number,"kind": string,"payload": NonNullable<Json>,"to_user": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "co_session_id": string,"created_at"?: string,"from_user"?: string,"id"?: never,"kind": string,"payload": NonNullable<Json>,"to_user"?: string | null
                  }
                  Update: {
                    "co_session_id"?: string,"created_at"?: string,"from_user"?: string,"id"?: never,"kind"?: string,"payload"?: NonNullable<Json>,"to_user"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "call_signals_co_session_id_fkey"
      columns: ["co_session_id"]
isOneToOne: false
      referencedRelation: "co_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"co_session_members": {
                  Row: {
                    "call_choice": string | null,"co_session_id": string,"goal_set": boolean,"goal_text": string | null,"left_at": string | null,"ready": boolean,"result": string | null,"task_title": string | null,"user_id": string,"wants_next": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "call_choice"?: string | null,"co_session_id": string,"goal_set"?: boolean,"goal_text"?: string | null,"left_at"?: string | null,"ready"?: boolean,"result"?: string | null,"task_title"?: string | null,"user_id": string,"wants_next"?: boolean
                  }
                  Update: {
                    "call_choice"?: string | null,"co_session_id"?: string,"goal_set"?: boolean,"goal_text"?: string | null,"left_at"?: string | null,"ready"?: boolean,"result"?: string | null,"task_title"?: string | null,"user_id"?: string,"wants_next"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "co_session_members_co_session_id_fkey"
      columns: ["co_session_id"]
isOneToOne: false
      referencedRelation: "co_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"co_sessions": {
                  Row: {
                    "break_until": string | null,"call_changed_at": string | null,"call_changed_by": string | null,"call_mode": string,"created_at": string,"ended_at": string | null,"group_id": string,"id": string,"minutes": number,"round": number,"starts_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "break_until"?: string | null,"call_changed_at"?: string | null,"call_changed_by"?: string | null,"call_mode"?: string,"created_at"?: string,"ended_at"?: string | null,"group_id": string,"id"?: string,"minutes": number,"round"?: number,"starts_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "break_until"?: string | null,"call_changed_at"?: string | null,"call_changed_by"?: string | null,"call_mode"?: string,"created_at"?: string,"ended_at"?: string | null,"group_id"?: string,"id"?: string,"minutes"?: number,"round"?: number,"starts_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "co_sessions_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"commitment_revisions": {
                  Row: {
                    "change": string,"commitment_id": string,"id": string,"new_minutes": number | null,"new_start": string | null,"owner_id": string,"reason": string | null,"revised_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "change": string,"commitment_id": string,"id"?: string,"new_minutes"?: number | null,"new_start"?: string | null,"owner_id"?: string,"reason"?: string | null,"revised_at"?: string
                  }
                  Update: {
                    "change"?: string,"commitment_id"?: string,"id"?: string,"new_minutes"?: number | null,"new_start"?: string | null,"owner_id"?: string,"reason"?: string | null,"revised_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commitment_revisions_commitment_id_owner_id_fkey"
      columns: ["commitment_id","owner_id"]
isOneToOne: false
      referencedRelation: "commitments"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"commitments": {
                  Row: {
                    "block_id": string | null,"committed_at": string,"committed_minutes": number,"committed_start": string | null,"goal_id": string | null,"id": string,"level": string,"owner_id": string,"snapshot": NonNullable<Json>,"week_start": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "block_id"?: string | null,"committed_at"?: string,"committed_minutes": number,"committed_start"?: string | null,"goal_id"?: string | null,"id"?: string,"level": string,"owner_id"?: string,"snapshot"?: NonNullable<Json>,"week_start"?: string | null
                  }
                  Update: {
                    "block_id"?: string | null,"committed_at"?: string,"committed_minutes"?: number,"committed_start"?: string | null,"goal_id"?: string | null,"id"?: string,"level"?: string,"owner_id"?: string,"snapshot"?: NonNullable<Json>,"week_start"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "commitments_block_id_owner_id_fkey"
      columns: ["block_id","owner_id"]
isOneToOne: false
      referencedRelation: "calendar_blocks"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "commitments_goal_id_owner_id_fkey"
      columns: ["goal_id","owner_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"day_plans": {
                  Row: {
                    "available_minutes": number | null,"closed_at": string | null,"completion_rate": number | null,"created_at": string,"day": string,"done_task_count": number | null,"energy": number | null,"multiplier_used": number | null,"opened_at": string | null,"owner_id": string,"planned_minutes": number | null,"planned_task_count": number | null,"reflection_question": string | null,"reflection_text": string | null,"sleep_hours": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "available_minutes"?: number | null,"closed_at"?: string | null,"completion_rate"?: number | null,"created_at"?: string,"day": string,"done_task_count"?: number | null,"energy"?: number | null,"multiplier_used"?: number | null,"opened_at"?: string | null,"owner_id"?: string,"planned_minutes"?: number | null,"planned_task_count"?: number | null,"reflection_question"?: string | null,"reflection_text"?: string | null,"sleep_hours"?: number | null
                  }
                  Update: {
                    "available_minutes"?: number | null,"closed_at"?: string | null,"completion_rate"?: number | null,"created_at"?: string,"day"?: string,"done_task_count"?: number | null,"energy"?: number | null,"multiplier_used"?: number | null,"opened_at"?: string | null,"owner_id"?: string,"planned_minutes"?: number | null,"planned_task_count"?: number | null,"reflection_question"?: string | null,"reflection_text"?: string | null,"sleep_hours"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"decision_events": {
                  Row: {
                    "area": string,"at": string,"id": string,"owner_id": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area": string,"at"?: string,"id"?: string,"owner_id"?: string,"source": string
                  }
                  Update: {
                    "area"?: string,"at"?: string,"id"?: string,"owner_id"?: string,"source"?: string
                  }
                  Relationships: [
                    
                  ]
                },"distractions": {
                  Row: {
                    "at": string,"id": string,"kind": string,"note": string | null,"owner_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"id"?: string,"kind": string,"note"?: string | null,"owner_id"?: string,"session_id": string
                  }
                  Update: {
                    "at"?: string,"id"?: string,"kind"?: string,"note"?: string | null,"owner_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "distractions_session_id_owner_id_fkey"
      columns: ["session_id","owner_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"goal_confidence": {
                  Row: {
                    "confidence_pct": number,"created_at": string,"goal_id": string,"owner_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confidence_pct": number,"created_at"?: string,"goal_id": string,"owner_id"?: string,"week_start": string
                  }
                  Update: {
                    "confidence_pct"?: number,"created_at"?: string,"goal_id"?: string,"owner_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_confidence_goal_id_owner_id_fkey"
      columns: ["goal_id","owner_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"goal_projects": {
                  Row: {
                    "goal_id": string,"owner_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "goal_id": string,"owner_id"?: string,"project_id": string
                  }
                  Update: {
                    "goal_id"?: string,"owner_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_projects_goal_id_owner_id_fkey"
      columns: ["goal_id","owner_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "goal_projects_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "activated_at": string | null,"created_at": string,"current_value": number,"deadline": string | null,"id": string,"owner_id": string,"resolved_at": string | null,"status": string,"target_text": string,"target_unit": string | null,"target_value": number | null,"title": string,"type": string,"visibility": string,"weekly_commitment_minutes": number,"why_text": string | null,"woop_if_then": string | null,"woop_obstacle": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"created_at"?: string,"current_value"?: number,"deadline"?: string | null,"id"?: string,"owner_id"?: string,"resolved_at"?: string | null,"status"?: string,"target_text": string,"target_unit"?: string | null,"target_value"?: number | null,"title": string,"type": string,"visibility"?: string,"weekly_commitment_minutes"?: number,"why_text"?: string | null,"woop_if_then"?: string | null,"woop_obstacle"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"created_at"?: string,"current_value"?: number,"deadline"?: string | null,"id"?: string,"owner_id"?: string,"resolved_at"?: string | null,"status"?: string,"target_text"?: string,"target_unit"?: string | null,"target_value"?: number | null,"title"?: string,"type"?: string,"visibility"?: string,"weekly_commitment_minutes"?: number,"why_text"?: string | null,"woop_if_then"?: string | null,"woop_obstacle"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"joined_at": string,"left_at": string | null,"share_level": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"joined_at"?: string,"left_at"?: string | null,"share_level"?: string | null,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"joined_at"?: string,"left_at"?: string | null,"share_level"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"kind": string,"quest_minutes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"quest_minutes"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"quest_minutes"?: number
                  }
                  Relationships: [
                    
                  ]
                },"guide_prompts": {
                  Row: {
                    "id": string,"outcome": string,"owner_id": string,"resolved_at": string | null,"shown_at": string,"shown_on": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"outcome"?: string,"owner_id"?: string,"resolved_at"?: string | null,"shown_at"?: string,"shown_on": string,"type": string
                  }
                  Update: {
                    "id"?: string,"outcome"?: string,"owner_id"?: string,"resolved_at"?: string | null,"shown_at"?: string,"shown_on"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"habit_logs": {
                  Row: {
                    "day": string,"habit_id": string,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"habit_id": string,"owner_id"?: string
                  }
                  Update: {
                    "day"?: string,"habit_id"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_logs_habit_id_owner_id_fkey"
      columns: ["habit_id","owner_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string,"owner_id": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string,"owner_id"?: string,"weekdays"?: (number)[]
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"invite_links": {
                  Row: {
                    "created_at": string,"expires_at": string,"from_user": string,"token": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"from_user": string,"token"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"from_user"?: string,"token"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ladder_state": {
                  Row: {
                    "calibrated": boolean,"clean_count": number,"consecutive_misses": number,"current_rung": number,"owner_id": string,"suggest_down": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calibrated"?: boolean,"clean_count"?: number,"consecutive_misses"?: number,"current_rung"?: number,"owner_id"?: string,"suggest_down"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "calibrated"?: boolean,"clean_count"?: number,"consecutive_misses"?: number,"current_rung"?: number,"owner_id"?: string,"suggest_down"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"login_attempts": {
                  Row: {
                    "at": string,"id": number,"ip": string,"success": boolean,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"id"?: never,"ip": string,"success": boolean,"username": string
                  }
                  Update: {
                    "at"?: string,"id"?: never,"ip"?: string,"success"?: boolean,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"milestones": {
                  Row: {
                    "done_at": string | null,"due_date": string | null,"goal_id": string,"id": string,"owner_id": string,"sort_order": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "done_at"?: string | null,"due_date"?: string | null,"goal_id": string,"id"?: string,"owner_id"?: string,"sort_order"?: number,"title": string
                  }
                  Update: {
                    "done_at"?: string | null,"due_date"?: string | null,"goal_id"?: string,"id"?: string,"owner_id"?: string,"sort_order"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_goal_id_owner_id_fkey"
      columns: ["goal_id","owner_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"missions": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"kind": string,"owner_id": string,"progress": number | null,"result_after": number | null,"result_before": number | null,"skill": string,"target": number,"title": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"owner_id"?: string,"progress"?: number | null,"result_after"?: number | null,"result_before"?: number | null,"skill": string,"target": number,"title": string,"week_start": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"progress"?: number | null,"result_after"?: number | null,"result_before"?: number | null,"skill"?: string,"target"?: number,"title"?: string,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"outcomes": {
                  Row: {
                    "created_at": string,"graded_at": string | null,"id": string,"owner_id": string,"result": string | null,"sort_order": number,"text": string,"visibility": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"graded_at"?: string | null,"id"?: string,"owner_id"?: string,"result"?: string | null,"sort_order"?: number,"text": string,"visibility"?: string,"week_start": string
                  }
                  Update: {
                    "created_at"?: string,"graded_at"?: string | null,"id"?: string,"owner_id"?: string,"result"?: string | null,"sort_order"?: number,"text"?: string,"visibility"?: string,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"partner_requests": {
                  Row: {
                    "created_at": string,"expires_at": string,"from_user": string,"id": string,"responded_at": string | null,"status": string,"to_user": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"from_user": string,"id"?: string,"responded_at"?: string | null,"status"?: string,"to_user": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"from_user"?: string,"id"?: string,"responded_at"?: string | null,"status"?: string,"to_user"?: string
                  }
                  Relationships: [
                    
                  ]
                },"personal_records": {
                  Row: {
                    "achieved_at": string,"owner_id": string,"previous_value": number | null,"record_type": string,"ref_id": string | null,"seen_at": string | null,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "achieved_at": string,"owner_id"?: string,"previous_value"?: number | null,"record_type": string,"ref_id"?: string | null,"seen_at"?: string | null,"value": number
                  }
                  Update: {
                    "achieved_at"?: string,"owner_id"?: string,"previous_value"?: number | null,"record_type"?: string,"ref_id"?: string | null,"seen_at"?: string | null,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"presence": {
                  Row: {
                    "focus_until": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "focus_until"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "focus_until"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"day_boundary_hour": number,"display_name": string | null,"partner_code": string,"timezone": string,"user_id": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_boundary_hour"?: number,"display_name"?: string | null,"partner_code"?: string,"timezone"?: string,"user_id": string,"username": string
                  }
                  Update: {
                    "created_at"?: string,"day_boundary_hour"?: number,"display_name"?: string | null,"partner_code"?: string,"timezone"?: string,"user_id"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"name": string,"owner_id": string,"status": string,"visibility": string,"weekly_budget_minutes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name": string,"owner_id"?: string,"status"?: string,"visibility"?: string,"weekly_budget_minutes"?: number
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"status"?: string,"visibility"?: string,"weekly_budget_minutes"?: number
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"owner_id": string,"p256dh": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"owner_id"?: string,"p256dh": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"owner_id"?: string,"p256dh"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string,"from_user": string,"group_id": string,"id": string,"kind": string,"note": string | null,"seen_at": string | null,"to_user": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_user"?: string,"group_id": string,"id"?: string,"kind": string,"note"?: string | null,"seen_at"?: string | null,"to_user": string
                  }
                  Update: {
                    "created_at"?: string,"from_user"?: string,"group_id"?: string,"id"?: string,"kind"?: string,"note"?: string | null,"seen_at"?: string | null,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"recordings": {
                  Row: {
                    "audio_deleted_at": string | null,"audio_path": string | null,"block_id": string | null,"clarity": number | null,"conciseness": number | null,"confidence": number | null,"drill_type": string,"duration_seconds": number,"engagement": number | null,"filler_breakdown": NonNullable<Json>,"filler_count": number | null,"fillers_per_min": number | null,"framework": string | null,"guessed_fillers": number | null,"hedges_per_min": number | null,"id": string,"is_baseline": boolean,"is_milestone": boolean,"listened": boolean,"long_pause_count": number | null,"one_fix": string | null,"owner_id": string,"parent_recording_id": string | null,"pitch_var": number | null,"prompt_id": string | null,"prompt_text": string,"recorded_at": string,"repeats": number | null,"speaking_seconds": number | null,"structure": number | null,"take_number": number,"target_seconds": number,"task_id": string | null,"time_on_target": boolean | null,"transcript": string | null,"transcript_segments": NonNullable<Json>,"visibility": string,"vocab_variety": number | null,"volume_var": number | null,"word_count": number | null,"wpm": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_deleted_at"?: string | null,"audio_path"?: string | null,"block_id"?: string | null,"clarity"?: number | null,"conciseness"?: number | null,"confidence"?: number | null,"drill_type": string,"duration_seconds": number,"engagement"?: number | null,"filler_breakdown"?: NonNullable<Json>,"filler_count"?: number | null,"fillers_per_min"?: number | null,"framework"?: string | null,"guessed_fillers"?: number | null,"hedges_per_min"?: number | null,"id"?: string,"is_baseline"?: boolean,"is_milestone"?: boolean,"listened"?: boolean,"long_pause_count"?: number | null,"one_fix"?: string | null,"owner_id"?: string,"parent_recording_id"?: string | null,"pitch_var"?: number | null,"prompt_id"?: string | null,"prompt_text": string,"recorded_at"?: string,"repeats"?: number | null,"speaking_seconds"?: number | null,"structure"?: number | null,"take_number"?: number,"target_seconds": number,"task_id"?: string | null,"time_on_target"?: boolean | null,"transcript"?: string | null,"transcript_segments"?: NonNullable<Json>,"visibility"?: string,"vocab_variety"?: number | null,"volume_var"?: number | null,"word_count"?: number | null,"wpm"?: number | null
                  }
                  Update: {
                    "audio_deleted_at"?: string | null,"audio_path"?: string | null,"block_id"?: string | null,"clarity"?: number | null,"conciseness"?: number | null,"confidence"?: number | null,"drill_type"?: string,"duration_seconds"?: number,"engagement"?: number | null,"filler_breakdown"?: NonNullable<Json>,"filler_count"?: number | null,"fillers_per_min"?: number | null,"framework"?: string | null,"guessed_fillers"?: number | null,"hedges_per_min"?: number | null,"id"?: string,"is_baseline"?: boolean,"is_milestone"?: boolean,"listened"?: boolean,"long_pause_count"?: number | null,"one_fix"?: string | null,"owner_id"?: string,"parent_recording_id"?: string | null,"pitch_var"?: number | null,"prompt_id"?: string | null,"prompt_text"?: string,"recorded_at"?: string,"repeats"?: number | null,"speaking_seconds"?: number | null,"structure"?: number | null,"take_number"?: number,"target_seconds"?: number,"task_id"?: string | null,"time_on_target"?: boolean | null,"transcript"?: string | null,"transcript_segments"?: NonNullable<Json>,"visibility"?: string,"vocab_variety"?: number | null,"volume_var"?: number | null,"word_count"?: number | null,"wpm"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recordings_block_id_owner_id_fkey"
      columns: ["block_id","owner_id"]
isOneToOne: false
      referencedRelation: "calendar_blocks"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "recordings_parent_recording_id_fkey"
      columns: ["parent_recording_id"]
isOneToOne: false
      referencedRelation: "recordings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recordings_prompt_id_fkey"
      columns: ["prompt_id"]
isOneToOne: false
      referencedRelation: "speaking_prompts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recordings_task_id_owner_id_fkey"
      columns: ["task_id","owner_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "closed_at": string | null,"created_at": string,"id": string,"owner_id": string,"step": number,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"created_at"?: string,"id"?: string,"owner_id"?: string,"step"?: number,"week_start": string
                  }
                  Update: {
                    "closed_at"?: string | null,"created_at"?: string,"id"?: string,"owner_id"?: string,"step"?: number,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_invites": {
                  Row: {
                    "call_mode": string,"co_session_id": string | null,"created_at": string,"expires_at": string,"from_user": string,"group_id": string,"id": string,"minutes": number,"party": number,"pushed_at": string | null,"responded_at": string | null,"seen_by_sender_at": string | null,"snooze_until": string | null,"status": string,"to_user": string
                  }
                  ComputedFields: never
                  Insert: {
                    "call_mode"?: string,"co_session_id"?: string | null,"created_at"?: string,"expires_at"?: string,"from_user": string,"group_id": string,"id"?: string,"minutes"?: number,"party"?: number,"pushed_at"?: string | null,"responded_at"?: string | null,"seen_by_sender_at"?: string | null,"snooze_until"?: string | null,"status"?: string,"to_user": string
                  }
                  Update: {
                    "call_mode"?: string,"co_session_id"?: string | null,"created_at"?: string,"expires_at"?: string,"from_user"?: string,"group_id"?: string,"id"?: string,"minutes"?: number,"party"?: number,"pushed_at"?: string | null,"responded_at"?: string | null,"seen_by_sender_at"?: string | null,"snooze_until"?: string | null,"status"?: string,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_invites_co_session_id_fkey"
      columns: ["co_session_id"]
isOneToOne: false
      referencedRelation: "co_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_invites_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "active_seconds": number | null,"block_id": string | null,"co_session_id": string | null,"created_at": string,"ended_at": string | null,"goal_met": string | null,"goal_text": string | null,"id": string,"is_clean": boolean | null,"ladder_rung": number | null,"mode": string,"outcome": string | null,"overran": boolean,"owner_id": string,"paused_at": string | null,"paused_seconds": number,"planned_minutes": number | null,"predicted_minutes": number | null,"quality": number | null,"reentry_note": string | null,"started_at": string,"suggested_mode": string | null,"task_id": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_seconds"?: number | null,"block_id"?: string | null,"co_session_id"?: string | null,"created_at"?: string,"ended_at"?: string | null,"goal_met"?: string | null,"goal_text"?: string | null,"id"?: string,"is_clean"?: boolean | null,"ladder_rung"?: number | null,"mode": string,"outcome"?: string | null,"overran"?: boolean,"owner_id"?: string,"paused_at"?: string | null,"paused_seconds"?: number,"planned_minutes"?: number | null,"predicted_minutes"?: number | null,"quality"?: number | null,"reentry_note"?: string | null,"started_at"?: string,"suggested_mode"?: string | null,"task_id": string,"visibility"?: string
                  }
                  Update: {
                    "active_seconds"?: number | null,"block_id"?: string | null,"co_session_id"?: string | null,"created_at"?: string,"ended_at"?: string | null,"goal_met"?: string | null,"goal_text"?: string | null,"id"?: string,"is_clean"?: boolean | null,"ladder_rung"?: number | null,"mode"?: string,"outcome"?: string | null,"overran"?: boolean,"owner_id"?: string,"paused_at"?: string | null,"paused_seconds"?: number,"planned_minutes"?: number | null,"predicted_minutes"?: number | null,"quality"?: number | null,"reentry_note"?: string | null,"started_at"?: string,"suggested_mode"?: string | null,"task_id"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_block_id_owner_id_fkey"
      columns: ["block_id","owner_id"]
isOneToOne: false
      referencedRelation: "calendar_blocks"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "sessions_co_session_id_fkey"
      columns: ["co_session_id"]
isOneToOne: false
      referencedRelation: "co_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_task_id_owner_id_fkey"
      columns: ["task_id","owner_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "active_project_cap": number,"aging_days": number,"anchored_at": string | null,"audio_retention_days": number | null,"call_link": string | null,"coach_tone": string,"created_at": string,"daily_focus_minutes": number | null,"daily_prompt_budget": number,"day_end_hour": number,"day_start_hour": number,"default_available_minutes": number,"filler_words": (string)[],"focus_areas": (string)[],"guide_overrides": NonNullable<Json>,"ics_fetched_at": string | null,"ics_url": string | null,"invites_mode": string,"keep_audio": boolean,"onboarded_at": string | null,"owner_id": string,"personal_bands": boolean,"presence_visible": boolean,"push_enabled": boolean,"quiet_end_hour": number,"quiet_start_hour": number,"setup_checklist": NonNullable<Json>,"share_level": string,"skill_anchors": Json | null,"sound_enabled": boolean,"theme": string,"wip_cap": number,"work_kind": string | null,"work_mode": string,"work_mode_on": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_project_cap"?: number,"aging_days"?: number,"anchored_at"?: string | null,"audio_retention_days"?: number | null,"call_link"?: string | null,"coach_tone"?: string,"created_at"?: string,"daily_focus_minutes"?: number | null,"daily_prompt_budget"?: number,"day_end_hour"?: number,"day_start_hour"?: number,"default_available_minutes"?: number,"filler_words"?: (string)[],"focus_areas"?: (string)[],"guide_overrides"?: NonNullable<Json>,"ics_fetched_at"?: string | null,"ics_url"?: string | null,"invites_mode"?: string,"keep_audio"?: boolean,"onboarded_at"?: string | null,"owner_id": string,"personal_bands"?: boolean,"presence_visible"?: boolean,"push_enabled"?: boolean,"quiet_end_hour"?: number,"quiet_start_hour"?: number,"setup_checklist"?: NonNullable<Json>,"share_level"?: string,"skill_anchors"?: Json | null,"sound_enabled"?: boolean,"theme"?: string,"wip_cap"?: number,"work_kind"?: string | null,"work_mode"?: string,"work_mode_on"?: string | null
                  }
                  Update: {
                    "active_project_cap"?: number,"aging_days"?: number,"anchored_at"?: string | null,"audio_retention_days"?: number | null,"call_link"?: string | null,"coach_tone"?: string,"created_at"?: string,"daily_focus_minutes"?: number | null,"daily_prompt_budget"?: number,"day_end_hour"?: number,"day_start_hour"?: number,"default_available_minutes"?: number,"filler_words"?: (string)[],"focus_areas"?: (string)[],"guide_overrides"?: NonNullable<Json>,"ics_fetched_at"?: string | null,"ics_url"?: string | null,"invites_mode"?: string,"keep_audio"?: boolean,"onboarded_at"?: string | null,"owner_id"?: string,"personal_bands"?: boolean,"presence_visible"?: boolean,"push_enabled"?: boolean,"quiet_end_hour"?: number,"quiet_start_hour"?: number,"setup_checklist"?: NonNullable<Json>,"share_level"?: string,"skill_anchors"?: Json | null,"sound_enabled"?: boolean,"theme"?: string,"wip_cap"?: number,"work_kind"?: string | null,"work_mode"?: string,"work_mode_on"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"shared_list_items": {
                  Row: {
                    "created_at": string,"created_by": string,"done_at": string | null,"done_by": string | null,"id": string,"list_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"list_id": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"list_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shared_list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "shared_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"shared_lists": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_by": string,"group_id": string,"id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string,"group_id": string,"id"?: string,"title": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string,"group_id"?: string,"id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shared_lists_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"speaking_prompts": {
                  Row: {
                    "active": boolean,"category": string,"created_at": string,"drill_type": string,"framework": string | null,"id": string,"owner_id": string | null,"project_id": string | null,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category"?: string,"created_at"?: string,"drill_type": string,"framework"?: string | null,"id"?: string,"owner_id"?: string | null,"project_id"?: string | null,"text": string
                  }
                  Update: {
                    "active"?: boolean,"category"?: string,"created_at"?: string,"drill_type"?: string,"framework"?: string | null,"id"?: string,"owner_id"?: string | null,"project_id"?: string | null,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "speaking_prompts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"deferral_count": number,"done_when": string | null,"energy": string | null,"estimate_minutes": number | null,"first_action": string | null,"first_planned_at": string | null,"first_started_at": string | null,"hidden_until": string | null,"id": string,"if_then_minute": number | null,"if_then_trigger": string | null,"killed_at": string | null,"kind": string,"last_touched_at": string,"owner_id": string,"planned_for": string | null,"project_id": string | null,"reentry_note": string | null,"share_override": string | null,"sort_order": number,"source": string,"status": string,"title": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"deferral_count"?: number,"done_when"?: string | null,"energy"?: string | null,"estimate_minutes"?: number | null,"first_action"?: string | null,"first_planned_at"?: string | null,"first_started_at"?: string | null,"hidden_until"?: string | null,"id"?: string,"if_then_minute"?: number | null,"if_then_trigger"?: string | null,"killed_at"?: string | null,"kind"?: string,"last_touched_at"?: string,"owner_id"?: string,"planned_for"?: string | null,"project_id"?: string | null,"reentry_note"?: string | null,"share_override"?: string | null,"sort_order"?: number,"source"?: string,"status"?: string,"title": string,"visibility"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"deferral_count"?: number,"done_when"?: string | null,"energy"?: string | null,"estimate_minutes"?: number | null,"first_action"?: string | null,"first_planned_at"?: string | null,"first_started_at"?: string | null,"hidden_until"?: string | null,"id"?: string,"if_then_minute"?: number | null,"if_then_trigger"?: string | null,"killed_at"?: string | null,"kind"?: string,"last_touched_at"?: string,"owner_id"?: string,"planned_for"?: string | null,"project_id"?: string | null,"reentry_note"?: string | null,"share_override"?: string | null,"sort_order"?: number,"source"?: string,"status"?: string,"title"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                }
          }
          Views: {
            "task_actuals": {
                  Row: {
                    "actual_seconds": number | null,"owner_id": string | null,"session_count": number | null,"task_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sessions_task_id_owner_id_fkey"
      columns: ["task_id","owner_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invite_link":
{ Args: { "p_token": string }; Returns: string
                           },
"accept_shared_list":
{ Args: { "p_id": string }; Returns: undefined
                           },
"beat":
{ Args: { "p_focus_until": string,"p_status": string }; Returns: undefined
                           },
"can_read":
{ Args: { "p_owner_id": string,"p_resource_id": string,"p_resource_type": string }; Returns: boolean
                           },
"cancel_partner_request":
{ Args: { "p_id": string }; Returns: undefined
                           },
"co_extend":
{ Args: { "p_cs": string,"p_minutes": number }; Returns: undefined
                           },
"co_finish":
{ Args: { "p_cs": string,"p_result": string }; Returns: undefined
                           },
"co_leave":
{ Args: { "p_cs": string }; Returns: undefined
                           },
"co_next_round":
{ Args: { "p_cs": string }; Returns: undefined
                           },
"co_ready":
{ Args: { "p_call": string,"p_cs": string,"p_goal": string,"p_task_title": string }; Returns: string
                           },
"co_set_call":
{ Args: { "p_call": string,"p_cs": string }; Returns: undefined
                           },
"create_invite_link":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"email_for_username":
{ Args: { "p_username": string }; Returns: string
                           },
"find_partner_code":
{ Args: { "p_code": string }; Returns: {
              "display_name": string,"user_id": string,"username": string
            }[]
                           },
"friends_snapshot":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"invite_people":
{ Args: { "p_invite": string }; Returns: {
              "display_name": string,"is_host": boolean,"user_id": string,"username": string
            }[]
                           },
"is_partner":
{ Args: { "p_other": string }; Returns: boolean
                           },
"leave_partner":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"login_allowed":
{ Args: { "p_ip": string,"p_username": string }; Returns: boolean
                           },
"my_group_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_partner":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pair_quest":
{ Args: { "p_group"?: string }; Returns: Json
                           },
"partner_snapshot":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"partner_week_self":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"peek_invite_link":
{ Args: { "p_token": string }; Returns: {
              "display_name": string,"username": string
            }[]
                           },
"pending_partner_requests":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"display_name": string,"id": string,"incoming": boolean,"username": string
            }[]
                           },
"record_login_attempt":
{ Args: { "p_ip": string,"p_success": boolean,"p_username": string }; Returns: undefined
                           },
"regenerate_partner_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"remove_friend":
{ Args: { "p_user": string }; Returns: undefined
                           },
"request_partner":
{ Args: { "p_code": string }; Returns: string
                           },
"respond_partner_request":
{ Args: { "p_action": string,"p_id": string }; Returns: string
                           },
"respond_session_invite":
{ Args: { "p_action": string,"p_id": string }; Returns: Json
                           },
"send_session_invite":
{ Args: { "p_call"?: string,"p_friends"?: (string)[],"p_minutes": number }; Returns: Json
                           },
"server_now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"session_people":
{ Args: { "p_cs": string }; Returns: {
              "display_name": string,"user_id": string,"username": string
            }[]
                           },
"set_friend_share":
{ Args: { "p_level": string,"p_user": string }; Returns: undefined
                           },
"shows_presence":
{ Args: { "p_user": string }; Returns: boolean
                           },
"username_available":
{ Args: { "p_username": string }; Returns: boolean
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
