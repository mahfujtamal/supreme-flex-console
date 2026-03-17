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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          area_id: string
          area_name: string
          created_at: string
          district_id: string
          is_4g_area: boolean
          is_5g_area: boolean
          network_zone_id: string
          status: boolean
          updated_at: string
        }
        Insert: {
          area_id?: string
          area_name: string
          created_at?: string
          district_id: string
          is_4g_area?: boolean
          is_5g_area?: boolean
          network_zone_id: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          area_id?: string
          area_name?: string
          created_at?: string
          district_id?: string
          is_4g_area?: boolean
          is_5g_area?: boolean
          network_zone_id?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["district_id"]
          },
          {
            foreignKeyName: "areas_network_zone_id_fkey"
            columns: ["network_zone_id"]
            isOneToOne: false
            referencedRelation: "network_zones"
            referencedColumns: ["network_zone_id"]
          },
        ]
      }
      channels: {
        Row: {
          channel_id: string
          channel_name: string
          created_at: string
          status: boolean
          updated_at: string
        }
        Insert: {
          channel_id?: string
          channel_name: string
          created_at?: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          channel_id?: string
          channel_name?: string
          created_at?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      districts: {
        Row: {
          created_at: string
          district_id: string
          district_name: string
          status: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          district_id?: string
          district_name: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          district_id?: string
          district_name?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      network_zones: {
        Row: {
          created_at: string
          network_zone_id: string
          network_zone_name: string
          status: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          network_zone_id?: string
          network_zone_name: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          network_zone_id?: string
          network_zone_name?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      permission_master: {
        Row: {
          description: string | null
          module: string
          permission_id: string
          permission_name: string
        }
        Insert: {
          description?: string | null
          module: string
          permission_id?: string
          permission_name: string
        }
        Update: {
          description?: string | null
          module?: string
          permission_id?: string
          permission_name?: string
        }
        Relationships: []
      }
      physical_addon_compatibility: {
        Row: {
          addon_product_id: string
          compatibility_id: string
          cpe_product_id: string
          created_at: string
        }
        Insert: {
          addon_product_id: string
          compatibility_id?: string
          cpe_product_id: string
          created_at?: string
        }
        Update: {
          addon_product_id?: string
          compatibility_id?: string
          cpe_product_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physical_addon_compatibility_addon_product_id_fkey"
            columns: ["addon_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "physical_addon_compatibility_cpe_product_id_fkey"
            columns: ["cpe_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_price_versions: {
        Row: {
          base_price_bdt: number
          created_at: string
          end_date: string | null
          price_version_id: string
          product_id: string
          start_date: string
          status: boolean
          updated_at: string
        }
        Insert: {
          base_price_bdt: number
          created_at?: string
          end_date?: string | null
          price_version_id?: string
          product_id: string
          start_date: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          base_price_bdt?: number
          created_at?: string
          end_date?: string | null
          price_version_id?: string
          product_id?: string
          start_date?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          addon_type: Database["public"]["Enums"]["addon_type"] | null
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at: string
          is_exclusive: boolean
          network_capability: Database["public"]["Enums"]["network_capability"]
          product_category: Database["public"]["Enums"]["product_category"]
          product_id: string
          product_name: string
          serial_required: boolean
          status: boolean
          updated_at: string
          warranty_unit: Database["public"]["Enums"]["warranty_unit"] | null
          warranty_value: number | null
        }
        Insert: {
          addon_type?: Database["public"]["Enums"]["addon_type"] | null
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          is_exclusive?: boolean
          network_capability?: Database["public"]["Enums"]["network_capability"]
          product_category: Database["public"]["Enums"]["product_category"]
          product_id?: string
          product_name: string
          serial_required?: boolean
          status?: boolean
          updated_at?: string
          warranty_unit?: Database["public"]["Enums"]["warranty_unit"] | null
          warranty_value?: number | null
        }
        Update: {
          addon_type?: Database["public"]["Enums"]["addon_type"] | null
          billing_type?: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          is_exclusive?: boolean
          network_capability?: Database["public"]["Enums"]["network_capability"]
          product_category?: Database["public"]["Enums"]["product_category"]
          product_id?: string
          product_name?: string
          serial_required?: boolean
          status?: boolean
          updated_at?: string
          warranty_unit?: Database["public"]["Enums"]["warranty_unit"] | null
          warranty_value?: number | null
        }
        Relationships: []
      }
      role_master: {
        Row: {
          created_at: string
          role_description: string | null
          role_id: string
          role_name: string
        }
        Insert: {
          created_at?: string
          role_description?: string | null
          role_id?: string
          role_name: string
        }
        Update: {
          created_at?: string
          role_description?: string | null
          role_id?: string
          role_name?: string
        }
        Relationships: []
      }
      role_permission: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permission_master"
            referencedColumns: ["permission_id"]
          },
          {
            foreignKeyName: "role_permission_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["role_id"]
          },
        ]
      }
      sub_channels: {
        Row: {
          channel_id: string
          created_at: string
          status: boolean
          sub_channel_id: string
          sub_channel_name: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          status?: boolean
          sub_channel_id?: string
          sub_channel_name: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          status?: boolean
          sub_channel_id?: string
          sub_channel_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["channel_id"]
          },
        ]
      }
      user_account: {
        Row: {
          created_at: string
          email: string
          employee_id: string | null
          role_status: boolean | null
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          email: string
          employee_id?: string | null
          role_status?: boolean | null
          user_id?: string
          user_name: string
        }
        Update: {
          created_at?: string
          email?: string
          employee_id?: string | null
          role_status?: boolean | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      user_role: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["role_id"]
          },
          {
            foreignKeyName: "user_role_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      addon_type: "PHYSICAL" | "DIGITAL"
      app_role: "admin" | "moderator" | "user"
      billing_type: "ONE_TIME" | "RECURRING"
      network_capability: "4G" | "5G" | "BOTH" | "ANY"
      product_category: "WIFI_PLAN" | "CPE" | "SIM" | "ADDON"
      warranty_unit: "DAYS" | "MONTHS" | "YEARS"
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
      addon_type: ["PHYSICAL", "DIGITAL"],
      app_role: ["admin", "moderator", "user"],
      billing_type: ["ONE_TIME", "RECURRING"],
      network_capability: ["4G", "5G", "BOTH", "ANY"],
      product_category: ["WIFI_PLAN", "CPE", "SIM", "ADDON"],
      warranty_unit: ["DAYS", "MONTHS", "YEARS"],
    },
  },
} as const
