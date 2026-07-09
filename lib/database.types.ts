export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          subscription_tier: 'free' | 'seeker' | 'builder' | 'legacy'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'seeker' | 'builder' | 'legacy'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'seeker' | 'builder' | 'legacy'
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
      }
      laws: {
        Row: {
          id: string
          law_number: number
          title: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          law_number: number
          title: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          law_number?: number
          title?: string
          description?: string | null
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string
          image_url: string | null
          price: string
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          image_url?: string | null
          price: string
          category: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          image_url?: string | null
          price?: string
          category?: string
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: 'free' | 'seeker' | 'builder' | 'legacy'
          status: 'active' | 'canceled' | 'past_due'
          stripe_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier: 'free' | 'seeker' | 'builder' | 'legacy'
          status: 'active' | 'canceled' | 'past_due'
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tier?: 'free' | 'seeker' | 'builder' | 'legacy'
          status?: 'active' | 'canceled' | 'past_due'
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
