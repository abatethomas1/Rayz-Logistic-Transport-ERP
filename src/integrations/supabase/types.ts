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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      erp_advance_allocations: {
        Row: {
          advance_id: string
          amount: number
          created_at: string
          id: string
          invoice_id: string
          operation_id: string
          source_work_id: string
        }
        Insert: {
          advance_id: string
          amount: number
          created_at?: string
          id: string
          invoice_id: string
          operation_id: string
          source_work_id: string
        }
        Update: {
          advance_id?: string
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          operation_id?: string
          source_work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_advance_allocations_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "erp_customer_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_advance_allocations_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_advance_allocations_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_audit: {
        Row: {
          action: string
          actor_id: string
          id: string
          occurred_at: string
          operation_id: string
          reason: string
          record_id: string
        }
        Insert: {
          action: string
          actor_id: string
          id?: string
          occurred_at?: string
          operation_id: string
          reason?: string
          record_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          id?: string
          occurred_at?: string
          operation_id?: string
          reason?: string
          record_id?: string
        }
        Relationships: []
      }
      erp_cash_entries: {
        Row: {
          amount: number
          direction: string
          id: string
          operation_id: string
          posted_at: string
          reference: string
          source_id: string
          source_work_id: string
          transaction_date: string
        }
        Insert: {
          amount: number
          direction: string
          id?: string
          operation_id: string
          posted_at?: string
          reference: string
          source_id: string
          source_work_id: string
          transaction_date: string
        }
        Update: {
          amount?: number
          direction?: string
          id?: string
          operation_id?: string
          posted_at?: string
          reference?: string
          source_id?: string
          source_work_id?: string
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_cash_entries_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_cash_entries_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_cash_reversals: {
        Row: {
          amount: number
          authorized_by: string
          cash_entry_id: string
          id: string
          occurred_at: string
          operation_id: string
          reason: string
          source_work_id: string
        }
        Insert: {
          amount: number
          authorized_by: string
          cash_entry_id: string
          id: string
          occurred_at?: string
          operation_id: string
          reason: string
          source_work_id: string
        }
        Update: {
          amount?: number
          authorized_by?: string
          cash_entry_id?: string
          id?: string
          occurred_at?: string
          operation_id?: string
          reason?: string
          source_work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_cash_reversals_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: true
            referencedRelation: "erp_cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_cash_reversals_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_cash_reversals_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_configuration: {
        Row: {
          active: boolean
          category: string
          description: string
          name: string
        }
        Insert: {
          active?: boolean
          category: string
          description?: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string
          description?: string
          name?: string
        }
        Relationships: []
      }
      erp_cost_postings: {
        Row: {
          category: string
          converted_etb: number
          currency: string
          id: string
          operation_id: string
          original_amount: number
          posted_at: string
          posted_by: string
          rate: number
          rate_date: string
          rate_source: string
          source_work_id: string
          stage_id: string | null
          supplier: string
          task_id: string | null
        }
        Insert: {
          category: string
          converted_etb: number
          currency: string
          id: string
          operation_id: string
          original_amount: number
          posted_at?: string
          posted_by: string
          rate: number
          rate_date: string
          rate_source: string
          source_work_id: string
          stage_id?: string | null
          supplier: string
          task_id?: string | null
        }
        Update: {
          category?: string
          converted_etb?: number
          currency?: string
          id?: string
          operation_id?: string
          original_amount?: number
          posted_at?: string
          posted_by?: string
          rate?: number
          rate_date?: string
          rate_source?: string
          source_work_id?: string
          stage_id?: string | null
          supplier?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_cost_postings_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_cost_postings_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_cost_postings_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "erp_port_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_cost_postings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "erp_local_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_customer_advances: {
        Row: {
          allocated: number
          amount: number
          customer_name: string
          id: string
          operation_id: string
          received_date: string
          reversed: boolean
          source_work_id: string
        }
        Insert: {
          allocated?: number
          amount: number
          customer_name: string
          id: string
          operation_id: string
          received_date: string
          reversed?: boolean
          source_work_id: string
        }
        Update: {
          allocated?: number
          amount?: number
          customer_name?: string
          id?: string
          operation_id?: string
          received_date?: string
          reversed?: boolean
          source_work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_customer_advances_customer_name_fkey"
            columns: ["customer_name"]
            isOneToOne: false
            referencedRelation: "erp_customers"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "erp_customer_advances_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_customer_advances_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_customers: {
        Row: {
          contact: string
          created_at: string
          email: string
          id: string
          industry: string
          name: string
          phone: string
          terms: string
        }
        Insert: {
          contact?: string
          created_at?: string
          email?: string
          id?: string
          industry?: string
          name: string
          phone?: string
          terms?: string
        }
        Update: {
          contact?: string
          created_at?: string
          email?: string
          id?: string
          industry?: string
          name?: string
          phone?: string
          terms?: string
        }
        Relationships: []
      }
      erp_documents: {
        Row: {
          area: string
          category: string
          created_at: string
          created_by: string
          id: string
          mime_type: string
          name: string
          object_path: string
          operation_id: string
          ready: boolean
          work_id: string | null
        }
        Insert: {
          area: string
          category: string
          created_at?: string
          created_by: string
          id?: string
          mime_type: string
          name: string
          object_path: string
          operation_id: string
          ready?: boolean
          work_id?: string | null
        }
        Update: {
          area?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          mime_type?: string
          name?: string
          object_path?: string
          operation_id?: string
          ready?: boolean
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_documents_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_documents_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_freight_dependencies: {
        Row: {
          freight_id: string
          stage_id: string | null
          task_id: string | null
        }
        Insert: {
          freight_id: string
          stage_id?: string | null
          task_id?: string | null
        }
        Update: {
          freight_id?: string
          stage_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_freight_dependencies_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "erp_freight_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_freight_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "erp_local_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_stage_reference"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "erp_port_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_freight_items: {
        Row: {
          blocker: string
          clearance_at: string | null
          clearance_by: string | null
          clearance_confirmed: boolean
          freight_type: string
          id: string
          identifier: string
          operation_id: string
          weight: number
        }
        Insert: {
          blocker?: string
          clearance_at?: string | null
          clearance_by?: string | null
          clearance_confirmed?: boolean
          freight_type: string
          id: string
          identifier: string
          operation_id: string
          weight: number
        }
        Update: {
          blocker?: string
          clearance_at?: string | null
          clearance_by?: string | null
          clearance_confirmed?: boolean
          freight_type?: string
          id?: string
          identifier?: string
          operation_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_freight_items_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_invoice_lines: {
        Row: {
          amount: number
          description: string
          id: string
          invoice_id: string
          tax_amount: number
        }
        Insert: {
          amount: number
          description: string
          id?: string
          invoice_id: string
          tax_amount?: number
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "erp_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_invoices: {
        Row: {
          amount: number
          due: string
          id: string
          issued: string
          operation_id: string
          tax_amount: number
        }
        Insert: {
          amount: number
          due: string
          id: string
          issued: string
          operation_id: string
          tax_amount?: number
        }
        Update: {
          amount?: number
          due?: string
          id?: string
          issued?: string
          operation_id?: string
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_invoices_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_local_tasks: {
        Row: {
          assigned_to: string
          authority: string
          completed: string | null
          id: string
          operation_id: string
          source_work_id: string
          started: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to: string
          authority?: string
          completed?: string | null
          id: string
          operation_id: string
          source_work_id: string
          started?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string
          authority?: string
          completed?: string | null
          id?: string
          operation_id?: string
          source_work_id?: string
          started?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_local_tasks_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_local_tasks_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_master_audit: {
        Row: {
          actor_id: string
          after_data: Json
          before_data: Json | null
          id: string
          kind: string
          occurred_at: string
          record_key: string
        }
        Insert: {
          actor_id: string
          after_data: Json
          before_data?: Json | null
          id?: string
          kind: string
          occurred_at?: string
          record_key: string
        }
        Update: {
          actor_id?: string
          after_data?: Json
          before_data?: Json | null
          id?: string
          kind?: string
          occurred_at?: string
          record_key?: string
        }
        Relationships: []
      }
      erp_operations: {
        Row: {
          customer_charge: number
          customer_name: string
          destination: string
          due: string
          freight_type: string
          id: string
          opened: string
          origin: string
          quantity: number
          status: string
          weight: number
        }
        Insert: {
          customer_charge: number
          customer_name: string
          destination: string
          due: string
          freight_type: string
          id: string
          opened: string
          origin: string
          quantity: number
          status: string
          weight: number
        }
        Update: {
          customer_charge?: number
          customer_name?: string
          destination?: string
          due?: string
          freight_type?: string
          id?: string
          opened?: string
          origin?: string
          quantity?: number
          status?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_operations_customer_name_fkey"
            columns: ["customer_name"]
            isOneToOne: false
            referencedRelation: "erp_customers"
            referencedColumns: ["name"]
          },
        ]
      }
      erp_port_stages: {
        Row: {
          arrival: string
          assigned_to: string | null
          id: string
          operation_id: string
          port_name: string
          release: string
          status: string
        }
        Insert: {
          arrival: string
          assigned_to?: string | null
          id: string
          operation_id: string
          port_name: string
          release: string
          status: string
        }
        Update: {
          arrival?: string
          assigned_to?: string | null
          id?: string
          operation_id?: string
          port_name?: string
          release?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_port_stages_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_port_stages_port_name_fkey"
            columns: ["port_name"]
            isOneToOne: false
            referencedRelation: "erp_ports"
            referencedColumns: ["name"]
          },
        ]
      }
      erp_ports: {
        Row: {
          active: boolean
          country: string
          name: string
        }
        Insert: {
          active?: boolean
          country: string
          name: string
        }
        Update: {
          active?: boolean
          country?: string
          name?: string
        }
        Relationships: []
      }
      erp_rate_cards: {
        Row: {
          amount: number
          effective_from: string
          effective_to: string
          freight_type: string
          id: string
          lane: string
          ownership: string
          source_work_id: string
        }
        Insert: {
          amount: number
          effective_from: string
          effective_to: string
          freight_type: string
          id: string
          lane: string
          ownership: string
          source_work_id: string
        }
        Update: {
          amount?: number
          effective_from?: string
          effective_to?: string
          freight_type?: string
          id?: string
          lane?: string
          ownership?: string
          source_work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_rate_cards_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_records: {
        Row: {
          area: string
          assigned_to: string | null
          data: Json
          id: string
          kind: string
          operation_id: string
        }
        Insert: {
          area?: string
          assigned_to?: string | null
          data: Json
          id: string
          kind: string
          operation_id: string
        }
        Update: {
          area?: string
          assigned_to?: string | null
          data?: Json
          id?: string
          kind?: string
          operation_id?: string
        }
        Relationships: []
      }
      erp_trips: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          assigned_to: string
          charge: number
          completed_at: string | null
          cost: number
          freight_id: string
          id: string
          offloaded_at: string | null
          operation_id: string
          planned_arrival: string
          planned_departure: string
          request_id: string
          source_work_id: string
          status: string
          truck: string
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          assigned_to: string
          charge: number
          completed_at?: string | null
          cost: number
          freight_id: string
          id: string
          offloaded_at?: string | null
          operation_id: string
          planned_arrival: string
          planned_departure: string
          request_id: string
          source_work_id: string
          status: string
          truck: string
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          assigned_to?: string
          charge?: number
          completed_at?: string | null
          cost?: number
          freight_id?: string
          id?: string
          offloaded_at?: string | null
          operation_id?: string
          planned_arrival?: string
          planned_departure?: string
          request_id?: string
          source_work_id?: string
          status?: string
          truck?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_trips_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "erp_freight_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_trips_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_trips_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "erp_truck_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_trips_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_trips_truck_fkey"
            columns: ["truck"]
            isOneToOne: false
            referencedRelation: "erp_trucks"
            referencedColumns: ["truck"]
          },
        ]
      }
      erp_truck_requests: {
        Row: {
          assigned_to: string
          id: string
          operation_id: string
          source_work_id: string
          status: string
          truck_count: number
        }
        Insert: {
          assigned_to: string
          id: string
          operation_id: string
          source_work_id: string
          status?: string
          truck_count: number
        }
        Update: {
          assigned_to?: string
          id?: string
          operation_id?: string
          source_work_id?: string
          status?: string
          truck_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_truck_requests_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "erp_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_truck_requests_source_work_id_fkey"
            columns: ["source_work_id"]
            isOneToOne: true
            referencedRelation: "erp_work"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_trucks: {
        Row: {
          active: boolean
          capacity: number
          driver: string
          ownership: string
          supplier: string
          trailer: string
          truck: string
        }
        Insert: {
          active?: boolean
          capacity: number
          driver: string
          ownership: string
          supplier: string
          trailer?: string
          truck: string
        }
        Update: {
          active?: boolean
          capacity?: number
          driver?: string
          ownership?: string
          supplier?: string
          trailer?: string
          truck?: string
        }
        Relationships: []
      }
      erp_work: {
        Row: {
          amount: number
          area: string
          assigned_to: string
          created_by: string
          dependencies: number
          details: string
          documents: Json
          history: Json
          id: string
          kind: string
          operation_id: string
          payload: Json
          status: string
          submitted_by: string | null
          title: string
        }
        Insert: {
          amount?: number
          area: string
          assigned_to: string
          created_by: string
          dependencies?: number
          details?: string
          documents?: Json
          history?: Json
          id: string
          kind: string
          operation_id: string
          payload?: Json
          status?: string
          submitted_by?: string | null
          title: string
        }
        Update: {
          amount?: number
          area?: string
          assigned_to?: string
          created_by?: string
          dependencies?: number
          details?: string
          documents?: Json
          history?: Json
          id?: string
          kind?: string
          operation_id?: string
          payload?: Json
          status?: string
          submitted_by?: string | null
          title?: string
        }
        Relationships: []
      }
      operation_assignments: {
        Row: {
          area: string
          operation_id: string
          user_id: string
        }
        Insert: {
          area: string
          operation_id: string
          user_id: string
        }
        Update: {
          area?: string
          operation_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string
          display_name: string
          id: string
          preferences: Json
        }
        Insert: {
          avatar_url?: string
          display_name?: string
          id: string
          preferences?: Json
        }
        Update: {
          avatar_url?: string
          display_name?: string
          id?: string
          preferences?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      area_department: { Args: { a: string }; Returns: string }
      assign_staff: {
        Args: {
          operation_id?: string
          staff_id: string
          staff_role: string
          work_area?: string
        }
        Returns: undefined
      }
      department_manager: { Args: { a: string }; Returns: boolean }
      erp_document_action: {
        Args: { action: string; input: Json }
        Returns: Json
      }
      erp_document_read: { Args: { doc_id: string }; Returns: boolean }
      erp_document_upload: { Args: { path: string }; Returns: boolean }
      erp_financial_action: {
        Args: { action: string; input: Json }
        Returns: Json
      }
      erp_freight_ready: { Args: { fid: string }; Returns: boolean }
      erp_master_action: {
        Args: { input: Json; kind: string }
        Returns: undefined
      }
      erp_operational_action: {
        Args: { action: string; input: Json }
        Returns: Json
      }
      erp_post_approved_bill: { Args: { work_id: string }; Returns: undefined }
      general_approver: { Args: never; Returns: boolean }
      operation_access: { Args: { op: string }; Returns: boolean }
      staff_area: { Args: never; Returns: string }
      staff_department: { Args: never; Returns: string }
      staff_directory: {
        Args: never
        Returns: {
          display_name: string
          id: string
          role: string
        }[]
      }
      staff_role: { Args: never; Returns: string }
      workspace_action: { Args: { action: string; input: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
