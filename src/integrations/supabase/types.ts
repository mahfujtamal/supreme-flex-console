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
      campaign_master: {
        Row: {
          allow_cod_payment: boolean
          allow_online_payment: boolean
          campaign_id: string
          campaign_name: string
          campaign_trigger_type: Database["public"]["Enums"]["campaign_trigger_type"]
          created_at: string
          description: string
          end_date: string | null
          on_ownership_transfer_behavior: Database["public"]["Enums"]["ownership_transfer_behavior"]
          scope: Database["public"]["Enums"]["campaign_scope"]
          start_date: string
          status: boolean
          updated_at: string
        }
        Insert: {
          allow_cod_payment?: boolean
          allow_online_payment?: boolean
          campaign_id?: string
          campaign_name: string
          campaign_trigger_type: Database["public"]["Enums"]["campaign_trigger_type"]
          created_at?: string
          description?: string
          end_date?: string | null
          on_ownership_transfer_behavior?: Database["public"]["Enums"]["ownership_transfer_behavior"]
          scope: Database["public"]["Enums"]["campaign_scope"]
          start_date: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          allow_cod_payment?: boolean
          allow_online_payment?: boolean
          campaign_id?: string
          campaign_name?: string
          campaign_trigger_type?: Database["public"]["Enums"]["campaign_trigger_type"]
          created_at?: string
          description?: string
          end_date?: string | null
          on_ownership_transfer_behavior?: Database["public"]["Enums"]["ownership_transfer_behavior"]
          scope?: Database["public"]["Enums"]["campaign_scope"]
          start_date?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      campaign_product_rules: {
        Row: {
          campaign_id: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          product_id: string
          rule_id: string
          rule_type: Database["public"]["Enums"]["campaign_rule_type"]
        }
        Insert: {
          campaign_id: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          product_id: string
          rule_id?: string
          rule_type: Database["public"]["Enums"]["campaign_rule_type"]
        }
        Update: {
          campaign_id?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          product_id?: string
          rule_id?: string
          rule_type?: Database["public"]["Enums"]["campaign_rule_type"]
        }
        Relationships: [
          {
            foreignKeyName: "campaign_product_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_master"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_product_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      campaign_targeting_rules: {
        Row: {
          area_id: string | null
          campaign_id: string
          channel_id: string | null
          district_id: string | null
          max_network_age_days: number | null
          min_network_age_days: number | null
          network_type:
            | Database["public"]["Enums"]["campaign_network_type"]
            | null
          network_zone_id: string | null
          rule_id: string
          sub_channel_id: string | null
        }
        Insert: {
          area_id?: string | null
          campaign_id: string
          channel_id?: string | null
          district_id?: string | null
          max_network_age_days?: number | null
          min_network_age_days?: number | null
          network_type?:
            | Database["public"]["Enums"]["campaign_network_type"]
            | null
          network_zone_id?: string | null
          rule_id?: string
          sub_channel_id?: string | null
        }
        Update: {
          area_id?: string | null
          campaign_id?: string
          channel_id?: string | null
          district_id?: string | null
          max_network_age_days?: number | null
          min_network_age_days?: number | null
          network_type?:
            | Database["public"]["Enums"]["campaign_network_type"]
            | null
          network_zone_id?: string | null
          rule_id?: string
          sub_channel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_targeting_rules_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "campaign_targeting_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_master"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_targeting_rules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["channel_id"]
          },
          {
            foreignKeyName: "campaign_targeting_rules_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["district_id"]
          },
          {
            foreignKeyName: "campaign_targeting_rules_network_zone_id_fkey"
            columns: ["network_zone_id"]
            isOneToOne: false
            referencedRelation: "network_zones"
            referencedColumns: ["network_zone_id"]
          },
          {
            foreignKeyName: "campaign_targeting_rules_sub_channel_id_fkey"
            columns: ["sub_channel_id"]
            isOneToOne: false
            referencedRelation: "sub_channels"
            referencedColumns: ["sub_channel_id"]
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
      coupons: {
        Row: {
          campaign_id: string
          coupon_code: string
          coupon_id: string
          created_at: string
          current_global_uses: number
          global_usage_limit: number
          max_uses_per_customer: number
          status: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          coupon_code: string
          coupon_id?: string
          created_at?: string
          current_global_uses?: number
          global_usage_limit?: number
          max_uses_per_customer?: number
          status?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          coupon_code?: string
          coupon_id?: string
          created_at?: string
          current_global_uses?: number
          global_usage_limit?: number
          max_uses_per_customer?: number
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_master"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      customer_referral_codes: {
        Row: {
          anchor_id: string
          code_id: string
          created_at: string
          referral_code: string
        }
        Insert: {
          anchor_id: string
          code_id?: string
          created_at?: string
          referral_code: string
        }
        Update: {
          anchor_id?: string
          code_id?: string
          created_at?: string
          referral_code?: string
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
      inventory_master: {
        Row: {
          allocated_agent_id: string | null
          allocated_entity_id: string | null
          created_at: string
          inventory_id: string
          item_type: Database["public"]["Enums"]["inventory_item_type"]
          mac_address: string | null
          msisdn: string | null
          product_id: string
          serial_number: string | null
          status: Database["public"]["Enums"]["inventory_status"]
          updated_at: string
        }
        Insert: {
          allocated_agent_id?: string | null
          allocated_entity_id?: string | null
          created_at?: string
          inventory_id?: string
          item_type: Database["public"]["Enums"]["inventory_item_type"]
          mac_address?: string | null
          msisdn?: string | null
          product_id: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          updated_at?: string
        }
        Update: {
          allocated_agent_id?: string | null
          allocated_entity_id?: string | null
          created_at?: string
          inventory_id?: string
          item_type?: Database["public"]["Enums"]["inventory_item_type"]
          mac_address?: string | null
          msisdn?: string | null
          product_id?: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_master_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
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
      order_items: {
        Row: {
          inventory_id: string | null
          item_id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price_bdt: number
        }
        Insert: {
          inventory_id?: string | null
          item_id?: string
          order_id: string
          product_id: string
          quantity?: number
          unit_price_bdt?: number
        }
        Update: {
          inventory_id?: string | null
          item_id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price_bdt?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_master"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_agent_id: string | null
          assigned_dh_kam_id: string | null
          contact_msisdn: string
          created_at: string
          customer_name: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          final_total_bdt: number
          order_id: string
          order_status: Database["public"]["Enums"]["order_status"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_dh_kam_id?: string | null
          contact_msisdn: string
          created_at?: string
          customer_name: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          final_total_bdt?: number
          order_id?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_dh_kam_id?: string | null
          contact_msisdn?: string
          created_at?: string
          customer_name?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          final_total_bdt?: number
          order_id?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
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
      referral_programs: {
        Row: {
          campaign_id: string
          created_at: string
          current_global_referrals: number
          global_referral_limit: number
          max_referrals_per_customer: number
          referral_program_id: string
          referrer_applicable_product_category: Database["public"]["Enums"]["referrer_product_category"]
          referrer_discount_type: Database["public"]["Enums"]["discount_type"]
          referrer_discount_value: number
          referrer_reward_billing_cycles: number
          status: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          current_global_referrals?: number
          global_referral_limit?: number
          max_referrals_per_customer?: number
          referral_program_id?: string
          referrer_applicable_product_category: Database["public"]["Enums"]["referrer_product_category"]
          referrer_discount_type: Database["public"]["Enums"]["discount_type"]
          referrer_discount_value: number
          referrer_reward_billing_cycles: number
          status?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          current_global_referrals?: number
          global_referral_limit?: number
          max_referrals_per_customer?: number
          referral_program_id?: string
          referrer_applicable_product_category?: Database["public"]["Enums"]["referrer_product_category"]
          referrer_discount_type?: Database["public"]["Enums"]["discount_type"]
          referrer_discount_value?: number
          referrer_reward_billing_cycles?: number
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_programs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaign_master"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      referral_usage_history: {
        Row: {
          applied_at: string
          referee_order_id: string
          referral_program_id: string
          referrer_anchor_id: string
          reward_status: Database["public"]["Enums"]["reward_status"]
          usage_id: string
        }
        Insert: {
          applied_at?: string
          referee_order_id: string
          referral_program_id: string
          referrer_anchor_id: string
          reward_status?: Database["public"]["Enums"]["reward_status"]
          usage_id?: string
        }
        Update: {
          applied_at?: string
          referee_order_id?: string
          referral_program_id?: string
          referrer_anchor_id?: string
          reward_status?: Database["public"]["Enums"]["reward_status"]
          usage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_usage_history_referral_program_id_fkey"
            columns: ["referral_program_id"]
            isOneToOne: false
            referencedRelation: "referral_programs"
            referencedColumns: ["referral_program_id"]
          },
        ]
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
      campaign_network_type: "4G" | "5G" | "ANY"
      campaign_rule_type: "EXCLUSIVE" | "UNAVAILABLE" | "DISCOUNT"
      campaign_scope: "ACQ" | "LC" | "BOTH"
      campaign_trigger_type:
        | "RULE_BASED"
        | "COUPON_BASED"
        | "REFERRAL_BASED"
        | "HYBRID"
      customer_type: "B2C" | "B2B"
      discount_type: "FLAT" | "PERCENT"
      inventory_item_type: "CPE" | "SIM" | "ADDON"
      inventory_status:
        | "IN_WAREHOUSE"
        | "ALLOCATED_TO_DH"
        | "ALLOCATED_TO_KAM"
        | "WITH_AGENT"
        | "DELIVERED"
        | "DEFECTIVE"
      network_capability: "4G" | "5G" | "BOTH" | "ANY"
      order_status:
        | "PENDING_DISPATCH"
        | "OUT_FOR_DELIVERY"
        | "ACTIVE"
        | "CANCELLED"
      ownership_transfer_behavior: "KEEP" | "REMOVE"
      payment_status: "PENDING_COD" | "PAID_COD" | "ONLINE_PAID"
      product_category: "WIFI_PLAN" | "CPE" | "SIM" | "ADDON"
      referrer_product_category:
        | "WIFI_PLAN"
        | "CPE"
        | "PHYSICAL_ADDON"
        | "DIGITAL_ADDON"
        | "ANY"
      referrer_product_type: "WIFI_PLAN" | "ADDON" | "BOTH"
      reward_status: "PENDING_ACTIVATION" | "REWARD_APPLIED" | "FAILED"
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
      campaign_network_type: ["4G", "5G", "ANY"],
      campaign_rule_type: ["EXCLUSIVE", "UNAVAILABLE", "DISCOUNT"],
      campaign_scope: ["ACQ", "LC", "BOTH"],
      campaign_trigger_type: [
        "RULE_BASED",
        "COUPON_BASED",
        "REFERRAL_BASED",
        "HYBRID",
      ],
      customer_type: ["B2C", "B2B"],
      discount_type: ["FLAT", "PERCENT"],
      inventory_item_type: ["CPE", "SIM", "ADDON"],
      inventory_status: [
        "IN_WAREHOUSE",
        "ALLOCATED_TO_DH",
        "ALLOCATED_TO_KAM",
        "WITH_AGENT",
        "DELIVERED",
        "DEFECTIVE",
      ],
      network_capability: ["4G", "5G", "BOTH", "ANY"],
      order_status: [
        "PENDING_DISPATCH",
        "OUT_FOR_DELIVERY",
        "ACTIVE",
        "CANCELLED",
      ],
      ownership_transfer_behavior: ["KEEP", "REMOVE"],
      payment_status: ["PENDING_COD", "PAID_COD", "ONLINE_PAID"],
      product_category: ["WIFI_PLAN", "CPE", "SIM", "ADDON"],
      referrer_product_category: [
        "WIFI_PLAN",
        "CPE",
        "PHYSICAL_ADDON",
        "DIGITAL_ADDON",
        "ANY",
      ],
      referrer_product_type: ["WIFI_PLAN", "ADDON", "BOTH"],
      reward_status: ["PENDING_ACTIVATION", "REWARD_APPLIED", "FAILED"],
      warranty_unit: ["DAYS", "MONTHS", "YEARS"],
    },
  },
} as const
