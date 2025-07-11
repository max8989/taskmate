import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Database types
export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          household_id: string | null
          display_name: string
          avatar_url: string | null
          role: 'admin' | 'member'
          current_streak: number
          total_points: number
          created_at: string
        }
        Insert: {
          id: string
          household_id?: string | null
          display_name: string
          avatar_url?: string | null
          role?: 'admin' | 'member'
          current_streak?: number
          total_points?: number
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          display_name?: string
          avatar_url?: string | null
          role?: 'admin' | 'member'
          current_streak?: number
          total_points?: number
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          household_id: string
          title: string
          description: string | null
          category: string
          is_recurring: boolean
          frequency_type: 'daily' | 'weekly' | 'monthly' | null
          frequency_value: number
          points_value: number
          created_by: string | null
          created_at: string
          scheduled_days: number[] | null
          scheduled_time: string | null
        }
        Insert: {
          id?: string
          household_id: string
          title: string
          description?: string | null
          category?: string
          is_recurring?: boolean
          frequency_type?: 'daily' | 'weekly' | 'monthly' | null
          frequency_value?: number
          points_value?: number
          created_by?: string | null
          created_at?: string
          scheduled_days?: number[] | null
          scheduled_time?: string | null
        }
        Update: {
          id?: string
          household_id?: string
          title?: string
          description?: string | null
          category?: string
          is_recurring?: boolean
          frequency_type?: 'daily' | 'weekly' | 'monthly' | null
          frequency_value?: number
          points_value?: number
          created_by?: string | null
          created_at?: string
          scheduled_days?: number[] | null
          scheduled_time?: string | null
        }
      }
      task_assignments: {
        Row: {
          id: string
          task_id: string
          assigned_to: string
          due_date: string
          due_datetime: string | null
          is_completed: boolean
          completed_at: string | null
          completed_by: string | null
          rotation_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          assigned_to: string
          due_date: string
          due_datetime?: string | null
          is_completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          rotation_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          assigned_to?: string
          due_date?: string
          due_datetime?: string | null
          is_completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          rotation_order?: number | null
          created_at?: string
        }
      }
      task_participants: {
        Row: {
          id: string
          task_id: string
          user_id: string
          rotation_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          rotation_order: number
          is_active?: boolean
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          rotation_order?: number
          is_active?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Common types
export type Profile = Tables<'profiles'>
export type Household = Tables<'households'>
export type Task = Tables<'tasks'>
export type TaskAssignment = Tables<'task_assignments'>
export type TaskParticipant = Tables<'task_participants'> 