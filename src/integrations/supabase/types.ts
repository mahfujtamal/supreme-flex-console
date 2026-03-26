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
      active_services: {
        Row: {
          activation_date: string
          anchor_id: string | null
          cpe_model: string | null
          created_at: string
          current_cpe_inventory_id: string | null
          customer_id: string
          expiry_date: string | null
          gpfi_msisdn: string | null
          product_category: string
          product_id: string
          service_id: string
          service_status: Database["public"]["Enums"]["service_status"]
          updated_at: string
          validity_days: number
        }
        Insert: {
          activation_date?: string
          anchor_id?: string | null
          cpe_model?: string | null
          created_at?: string
          current_cpe_inventory_id?: string | null
          customer_id: string
          expiry_date?: string | null
          gpfi_msisdn?: string | null
          product_category?: string
          product_id: string
          service_id?: string
          service_status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
          validity_days?: number
        }
        Update: {
          activation_date?: string
          anchor_id?: string | null
          cpe_model?: string | null
          created_at?: string
          current_cpe_inventory_id?: string | null
          customer_id?: string
          expiry_date?: string | null
          gpfi_msisdn?: string | null
          product_category?: string
          product_id?: string
          service_id?: string
          service_status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "active_services_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "anchors"
            referencedColumns: ["anchor_id"]
          },
          {
            foreignKeyName: "active_services_current_cpe_inventory_id_fkey"
            columns: ["current_cpe_inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_master"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "active_services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          permissions: Json
          role_id: string
          role_name: string
        }
        Insert: {
          created_at?: string
          permissions?: Json
          role_id?: string
          role_name: string
        }
        Update: {
          created_at?: string
          permissions?: Json
          role_id?: string
          role_name?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          admin_id: string
          created_at: string
          email: string
          full_name: string
          is_active: boolean
          last_login: string | null
          role_id: string | null
        }
        Insert: {
          admin_id?: string
          created_at?: string
          email: string
          full_name: string
          is_active?: boolean
          last_login?: string | null
          role_id?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          email?: string
          full_name?: string
          is_active?: boolean
          last_login?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      anchors: {
        Row: {
          anchor_id: string
          area: string | null
          coordinates: string | null
          created_at: string
          customer_id: string
          district: string | null
          location_tac: string | null
          network_zone: string | null
          order_id: string | null
          test_status: Database["public"]["Enums"]["test_status"]
        }
        Insert: {
          anchor_id?: string
          area?: string | null
          coordinates?: string | null
          created_at?: string
          customer_id: string
          district?: string | null
          location_tac?: string | null
          network_zone?: string | null
          order_id?: string | null
          test_status?: Database["public"]["Enums"]["test_status"]
        }
        Update: {
          anchor_id?: string
          area?: string | null
          coordinates?: string | null
          created_at?: string
          customer_id?: string
          district?: string | null
          location_tac?: string | null
          network_zone?: string | null
          order_id?: string | null
          test_status?: Database["public"]["Enums"]["test_status"]
        }
        Relationships: [
          {
            foreignKeyName: "anchors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "anchors_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
        ]
      }
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
      asset_replacement_history: {
        Row: {
          anchor_id: string
          charge_amount_bdt: number
          new_asset_id: string
          notes: string | null
          old_asset_id: string
          reason: Database["public"]["Enums"]["replacement_reason"]
          replaced_at: string
          replacement_id: string
        }
        Insert: {
          anchor_id: string
          charge_amount_bdt?: number
          new_asset_id: string
          notes?: string | null
          old_asset_id: string
          reason: Database["public"]["Enums"]["replacement_reason"]
          replaced_at?: string
          replacement_id?: string
        }
        Update: {
          anchor_id?: string
          charge_amount_bdt?: number
          new_asset_id?: string
          notes?: string | null
          old_asset_id?: string
          reason?: Database["public"]["Enums"]["replacement_reason"]
          replaced_at?: string
          replacement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_replacement_history_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "anchors"
            referencedColumns: ["anchor_id"]
          },
          {
            foreignKeyName: "asset_replacement_history_new_asset_id_fkey"
            columns: ["new_asset_id"]
            isOneToOne: false
            referencedRelation: "customer_assets"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "asset_replacement_history_old_asset_id_fkey"
            columns: ["old_asset_id"]
            isOneToOne: false
            referencedRelation: "customer_assets"
            referencedColumns: ["asset_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["audit_action_type"]
          admin_id: string | null
          created_at: string
          ip_address: string | null
          log_id: string
          new_state: Json | null
          previous_state: Json | null
          target_record_id: string
          target_table: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["audit_action_type"]
          admin_id?: string | null
          created_at?: string
          ip_address?: string | null
          log_id?: string
          new_state?: Json | null
          previous_state?: Json | null
          target_record_id: string
          target_table: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["audit_action_type"]
          admin_id?: string | null
          created_at?: string
          ip_address?: string | null
          log_id?: string
          new_state?: Json | null
          previous_state?: Json | null
          target_record_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["admin_id"]
          },
        ]
      }
      campaign_discount_mappings: {
        Row: {
          component_name: string
          created_at: string
          discount_amount_bdt: number
          mapping_id: string
          rule_id: string
        }
        Insert: {
          component_name: string
          created_at?: string
          discount_amount_bdt?: number
          mapping_id?: string
          rule_id: string
        }
        Update: {
          component_name?: string
          created_at?: string
          discount_amount_bdt?: number
          mapping_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_discount_mappings_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "campaign_product_rules"
            referencedColumns: ["rule_id"]
          },
        ]
      }
      campaign_master: {
        Row: {
          allow_cod_payment: boolean
          allow_online_payment: boolean
          campaign_id: string
          campaign_name: string
          campaign_rank: number
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
          campaign_rank?: number
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
          campaign_rank?: number
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
          applicable_components: string[]
          campaign_id: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          product_id: string
          rule_id: string
          rule_type: Database["public"]["Enums"]["campaign_rule_type"]
        }
        Insert: {
          applicable_components?: string[]
          campaign_id: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          product_id: string
          rule_id?: string
          rule_type: Database["public"]["Enums"]["campaign_rule_type"]
        }
        Update: {
          applicable_components?: string[]
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
          block_id: number
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
          block_id?: number
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
          block_id?: number
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
          is_assisted: boolean
          is_self_delivered: boolean
          status: boolean
          updated_at: string
        }
        Insert: {
          channel_id?: string
          channel_name: string
          created_at?: string
          is_assisted?: boolean
          is_self_delivered?: boolean
          status?: boolean
          updated_at?: string
        }
        Update: {
          channel_id?: string
          channel_name?: string
          created_at?: string
          is_assisted?: boolean
          is_self_delivered?: boolean
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
      customer_assets: {
        Row: {
          anchor_id: string
          asset_id: string
          asset_status: Database["public"]["Enums"]["asset_status"]
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          customer_id: string
          installation_date: string
          mac_address: string | null
          product_id: string
          serial_number: string
          updated_at: string
          warranty_end_date: string | null
          warranty_start_date: string
        }
        Insert: {
          anchor_id: string
          asset_id?: string
          asset_status?: Database["public"]["Enums"]["asset_status"]
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          customer_id: string
          installation_date?: string
          mac_address?: string | null
          product_id: string
          serial_number: string
          updated_at?: string
          warranty_end_date?: string | null
          warranty_start_date?: string
        }
        Update: {
          anchor_id?: string
          asset_id?: string
          asset_status?: Database["public"]["Enums"]["asset_status"]
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          customer_id?: string
          installation_date?: string
          mac_address?: string | null
          product_id?: string
          serial_number?: string
          updated_at?: string
          warranty_end_date?: string | null
          warranty_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_assets_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "anchors"
            referencedColumns: ["anchor_id"]
          },
          {
            foreignKeyName: "customer_assets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      customers: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          customer_id: string
          customer_type: string
          full_name: string
          joined_date: string
          primary_contact_number: string
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          customer_id?: string
          customer_type?: string
          full_name: string
          joined_date?: string
          primary_contact_number: string
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          customer_id?: string
          customer_type?: string
          full_name?: string
          joined_date?: string
          primary_contact_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      distribution_houses: {
        Row: {
          area_id: string | null
          created_at: string
          dh_code: string
          dh_id: string
          district_id: string | null
          last_assigned_at: string | null
          name: string
          status: Database["public"]["Enums"]["dh_status"]
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          dh_code: string
          dh_id?: string
          district_id?: string | null
          last_assigned_at?: string | null
          name: string
          status?: Database["public"]["Enums"]["dh_status"]
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          dh_code?: string
          dh_id?: string
          district_id?: string | null
          last_assigned_at?: string | null
          name?: string
          status?: Database["public"]["Enums"]["dh_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_houses_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "distribution_houses_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["district_id"]
          },
        ]
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
      field_agents: {
        Row: {
          agent_id: string
          agent_name: string
          created_at: string
          dh_id: string
          msisdn: string
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_name: string
          created_at?: string
          dh_id: string
          msisdn: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_name?: string
          created_at?: string
          dh_id?: string
          msisdn?: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_agents_dh_id_fkey"
            columns: ["dh_id"]
            isOneToOne: false
            referencedRelation: "distribution_houses"
            referencedColumns: ["dh_id"]
          },
        ]
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
      kams: {
        Row: {
          assigned_segments: string[]
          created_at: string
          kam_id: string
          msisdn: string
          name: string
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          assigned_segments?: string[]
          created_at?: string
          kam_id: string
          msisdn: string
          name: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          assigned_segments?: string[]
          created_at?: string
          kam_id?: string
          msisdn?: string
          name?: string
          status?: Database["public"]["Enums"]["agent_status"]
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
      onetime_invoices: {
        Row: {
          charged_amount_bdt: number
          created_at: string
          customer_id: string
          invoice_id: string
          parent_summary_invoice_id: string | null
          payment_status: Database["public"]["Enums"]["invoice_payment_status"]
          refund_amount_bdt: number | null
          refund_reason: string | null
          refunded_at: string | null
          trigger_type: Database["public"]["Enums"]["invoice_trigger_type"]
        }
        Insert: {
          charged_amount_bdt?: number
          created_at?: string
          customer_id: string
          invoice_id?: string
          parent_summary_invoice_id?: string | null
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          refund_amount_bdt?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          trigger_type: Database["public"]["Enums"]["invoice_trigger_type"]
        }
        Update: {
          charged_amount_bdt?: number
          created_at?: string
          customer_id?: string
          invoice_id?: string
          parent_summary_invoice_id?: string | null
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          refund_amount_bdt?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          trigger_type?: Database["public"]["Enums"]["invoice_trigger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "onetime_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      order_items: {
        Row: {
          fulfillment_date: string | null
          inventory_id: string | null
          item_fulfillment_status:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          item_id: string
          locked_unit_price_bdt: number | null
          order_id: string
          price_anchor_type: string
          price_locked_at: string | null
          product_id: string
          quantity: number
          unit_price_bdt: number
        }
        Insert: {
          fulfillment_date?: string | null
          inventory_id?: string | null
          item_fulfillment_status?:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          item_id?: string
          locked_unit_price_bdt?: number | null
          order_id: string
          price_anchor_type?: string
          price_locked_at?: string | null
          product_id: string
          quantity?: number
          unit_price_bdt?: number
        }
        Update: {
          fulfillment_date?: string | null
          inventory_id?: string | null
          item_fulfillment_status?:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          item_id?: string
          locked_unit_price_bdt?: number | null
          order_id?: string
          price_anchor_type?: string
          price_locked_at?: string | null
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
          channel_id: string | null
          contact_msisdn: string
          created_at: string
          customer_name: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          final_total_bdt: number
          fulfillment_status:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          order_id: string
          order_status: Database["public"]["Enums"]["order_status"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          price_snapshot_date: string | null
          staff_user_id: string | null
          sub_channel_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_dh_kam_id?: string | null
          channel_id?: string | null
          contact_msisdn: string
          created_at?: string
          customer_name: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          final_total_bdt?: number
          fulfillment_status?:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          order_id?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_snapshot_date?: string | null
          staff_user_id?: string | null
          sub_channel_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_dh_kam_id?: string | null
          channel_id?: string | null
          contact_msisdn?: string
          created_at?: string
          customer_name?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          final_total_bdt?: number
          fulfillment_status?:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          order_id?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_snapshot_date?: string | null
          staff_user_id?: string | null
          sub_channel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["channel_id"]
          },
          {
            foreignKeyName: "orders_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "sub_channel_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sub_channel_id_fkey"
            columns: ["sub_channel_id"]
            isOneToOne: false
            referencedRelation: "sub_channels"
            referencedColumns: ["sub_channel_id"]
          },
        ]
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
      price_components: {
        Row: {
          amount_bdt: number
          component_id: string
          component_name: string
          component_type: string
          created_at: string
          price_version_id: string
          sort_order: number
        }
        Insert: {
          amount_bdt?: number
          component_id?: string
          component_name: string
          component_type?: string
          created_at?: string
          price_version_id: string
          sort_order?: number
        }
        Update: {
          amount_bdt?: number
          component_id?: string
          component_name?: string
          component_type?: string
          created_at?: string
          price_version_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_components_price_version_id_fkey"
            columns: ["price_version_id"]
            isOneToOne: false
            referencedRelation: "product_price_versions"
            referencedColumns: ["price_version_id"]
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
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
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
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
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
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
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
          end_date: string | null
          is_locked: boolean
          max_referrals_per_customer: number
          program_id: string
          referee_config_matrix: Json
          referral_code_prefix: string | null
          referrer_product_id: string | null
          referrer_reward_type: string
          referrer_reward_unit: string | null
          referrer_reward_value: number
          reward_on_signup: boolean
          start_date: string
          status: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          end_date?: string | null
          is_locked?: boolean
          max_referrals_per_customer?: number
          program_id?: string
          referee_config_matrix?: Json
          referral_code_prefix?: string | null
          referrer_product_id?: string | null
          referrer_reward_type?: string
          referrer_reward_unit?: string | null
          referrer_reward_value?: number
          reward_on_signup?: boolean
          start_date: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          end_date?: string | null
          is_locked?: boolean
          max_referrals_per_customer?: number
          program_id?: string
          referee_config_matrix?: Json
          referral_code_prefix?: string | null
          referrer_product_id?: string | null
          referrer_reward_type?: string
          referrer_reward_unit?: string | null
          referrer_reward_value?: number
          reward_on_signup?: boolean
          start_date?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_programs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_master"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "referral_programs_referrer_product_id_fkey"
            columns: ["referrer_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      referral_redemptions: {
        Row: {
          applied_rewards: Json
          created_at: string
          program_id: string
          redemption_id: string
          referee_customer_id: string
          referral_code: string
          referrer_customer_id: string
        }
        Insert: {
          applied_rewards?: Json
          created_at?: string
          program_id: string
          redemption_id?: string
          referee_customer_id: string
          referral_code: string
          referrer_customer_id: string
        }
        Update: {
          applied_rewards?: Json
          created_at?: string
          program_id?: string
          redemption_id?: string
          referee_customer_id?: string
          referral_code?: string
          referrer_customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_redemptions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "referral_programs"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "referral_redemptions_referee_customer_id_fkey"
            columns: ["referee_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "referral_redemptions_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      referral_reward_ledger: {
        Row: {
          applied_at: string | null
          created_at: string
          earned_at: string | null
          force_approved_at: string | null
          force_approved_by: string | null
          ledger_id: string
          notification_log: Json
          program_id: string
          referee_customer_id: string
          referee_invoice_paid: boolean
          referee_service_active: boolean
          referral_code: string
          referrer_customer_id: string
          reward_rule_snapshot: Json
          reward_status: Database["public"]["Enums"]["referral_reward_status"]
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          earned_at?: string | null
          force_approved_at?: string | null
          force_approved_by?: string | null
          ledger_id?: string
          notification_log?: Json
          program_id: string
          referee_customer_id: string
          referee_invoice_paid?: boolean
          referee_service_active?: boolean
          referral_code: string
          referrer_customer_id: string
          reward_rule_snapshot?: Json
          reward_status?: Database["public"]["Enums"]["referral_reward_status"]
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          earned_at?: string | null
          force_approved_at?: string | null
          force_approved_by?: string | null
          ledger_id?: string
          notification_log?: Json
          program_id?: string
          referee_customer_id?: string
          referee_invoice_paid?: boolean
          referee_service_active?: boolean
          referral_code?: string
          referrer_customer_id?: string
          reward_rule_snapshot?: Json
          reward_status?: Database["public"]["Enums"]["referral_reward_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_reward_ledger_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "referral_programs"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "referral_reward_ledger_referee_customer_id_fkey"
            columns: ["referee_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "referral_reward_ledger_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
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
      sub_channel_users: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          msisdn: string
          role: string
          status: string
          sub_channel_id: string
          updated_at: string
          user_name: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          msisdn: string
          role?: string
          status?: string
          sub_channel_id: string
          updated_at?: string
          user_name: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          msisdn?: string
          role?: string
          status?: string
          sub_channel_id?: string
          updated_at?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_channel_users_sub_channel_id_fkey"
            columns: ["sub_channel_id"]
            isOneToOne: false
            referencedRelation: "sub_channels"
            referencedColumns: ["sub_channel_id"]
          },
        ]
      }
      sub_channels: {
        Row: {
          channel_id: string
          created_at: string
          delivery_ownership: Database["public"]["Enums"]["delivery_ownership_mode"]
          status: boolean
          sub_channel_id: string
          sub_channel_name: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          delivery_ownership?: Database["public"]["Enums"]["delivery_ownership_mode"]
          status?: boolean
          sub_channel_id?: string
          sub_channel_name: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          delivery_ownership?: Database["public"]["Enums"]["delivery_ownership_mode"]
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
      transaction_ledger: {
        Row: {
          anchor_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          created_at: string
          customer_id: string
          discount_breakdown: Json
          ledger_id: string
          order_id: string | null
          price_breakdown: Json
          product_id: string
          product_name: string
          total_discount_bdt: number
          total_payable_bdt: number
          total_pre_discount_bdt: number
          trigger_type: string
        }
        Insert: {
          anchor_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          customer_id: string
          discount_breakdown?: Json
          ledger_id?: string
          order_id?: string | null
          price_breakdown?: Json
          product_id: string
          product_name: string
          total_discount_bdt?: number
          total_payable_bdt?: number
          total_pre_discount_bdt?: number
          trigger_type?: string
        }
        Update: {
          anchor_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          customer_id?: string
          discount_breakdown?: Json
          ledger_id?: string
          order_id?: string | null
          price_breakdown?: Json
          product_id?: string
          product_name?: string
          total_discount_bdt?: number
          total_payable_bdt?: number
          total_pre_discount_bdt?: number
          trigger_type?: string
        }
        Relationships: []
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
      check_and_release_referral_reward: {
        Args: { p_ledger_id: string }
        Returns: Database["public"]["Enums"]["referral_reward_status"]
      }
      force_approve_referral_reward: {
        Args: { p_admin_name?: string; p_ledger_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "ACTIVE" | "EXPIRED" | "CHURNED"
      addon_type: "PHYSICAL" | "DIGITAL"
      agent_status: "ACTIVE" | "INACTIVE"
      app_role: "admin" | "moderator" | "user"
      asset_status: "ACTIVE" | "REPLACED" | "RETURNED" | "DEFECTIVE"
      asset_type: "CPE" | "SIM" | "PHYSICAL_ADDON"
      audit_action_type:
        | "CREATE"
        | "UPDATE"
        | "DELETE"
        | "BULK_IMPORT"
        | "STATUS_CHANGE"
      billing_frequency: "ONE_TIME" | "WEEKLY" | "MONTHLY" | "YEARLY"
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
      delivery_ownership_mode:
        | "FOLLOW_CHANNEL"
        | "SELF_DELIVERY"
        | "DH_DELIVERY"
      dh_status: "ACTIVE" | "INACTIVE"
      discount_type: "FLAT" | "PERCENT"
      fulfillment_status:
        | "PAID_AWAITING_INSTALLATION"
        | "PROVISIONAL"
        | "EARNED"
        | "CANCELLED"
        | "REFUNDED"
      inventory_item_type: "CPE" | "SIM" | "ADDON"
      inventory_status:
        | "IN_WAREHOUSE"
        | "ALLOCATED_TO_DH"
        | "ALLOCATED_TO_KAM"
        | "WITH_AGENT"
        | "DELIVERED"
        | "DEFECTIVE"
      invoice_payment_status: "PENDING" | "PAID"
      invoice_trigger_type: "ACQUISITION" | "CPE_CHANGE" | "PHYSICAL_ADDON"
      network_capability: "4G" | "5G" | "BOTH" | "ANY"
      order_status:
        | "PENDING_DISPATCH"
        | "OUT_FOR_DELIVERY"
        | "ACTIVE"
        | "CANCELLED"
        | "ASSIGNED"
        | "CONTACTED"
        | "NETWORK_TEST"
        | "INSTALLED"
      ownership_transfer_behavior: "KEEP" | "REMOVE"
      payment_status: "PENDING_COD" | "PAID_COD" | "ONLINE_PAID"
      product_category: "WIFI_PLAN" | "CPE" | "SIM" | "ADDON"
      referral_reward_status:
        | "PENDING"
        | "AWAITING_ACTIVATION"
        | "AWAITING_PAYMENT"
        | "EARNED"
        | "APPLIED"
        | "FORCE_APPROVED"
      referrer_product_category:
        | "WIFI_PLAN"
        | "CPE"
        | "PHYSICAL_ADDON"
        | "DIGITAL_ADDON"
        | "ANY"
      referrer_product_type: "WIFI_PLAN" | "ADDON" | "BOTH"
      replacement_reason: "WARRANTY" | "PAID" | "UPGRADE"
      reward_status: "PENDING_ACTIVATION" | "REWARD_APPLIED" | "FAILED"
      service_status: "ACTIVE" | "SUSPENDED"
      test_status: "PENDING" | "SUCCESS" | "FAIL"
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
      account_status: ["ACTIVE", "EXPIRED", "CHURNED"],
      addon_type: ["PHYSICAL", "DIGITAL"],
      agent_status: ["ACTIVE", "INACTIVE"],
      app_role: ["admin", "moderator", "user"],
      asset_status: ["ACTIVE", "REPLACED", "RETURNED", "DEFECTIVE"],
      asset_type: ["CPE", "SIM", "PHYSICAL_ADDON"],
      audit_action_type: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "BULK_IMPORT",
        "STATUS_CHANGE",
      ],
      billing_frequency: ["ONE_TIME", "WEEKLY", "MONTHLY", "YEARLY"],
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
      delivery_ownership_mode: [
        "FOLLOW_CHANNEL",
        "SELF_DELIVERY",
        "DH_DELIVERY",
      ],
      dh_status: ["ACTIVE", "INACTIVE"],
      discount_type: ["FLAT", "PERCENT"],
      fulfillment_status: [
        "PAID_AWAITING_INSTALLATION",
        "PROVISIONAL",
        "EARNED",
        "CANCELLED",
        "REFUNDED",
      ],
      inventory_item_type: ["CPE", "SIM", "ADDON"],
      inventory_status: [
        "IN_WAREHOUSE",
        "ALLOCATED_TO_DH",
        "ALLOCATED_TO_KAM",
        "WITH_AGENT",
        "DELIVERED",
        "DEFECTIVE",
      ],
      invoice_payment_status: ["PENDING", "PAID"],
      invoice_trigger_type: ["ACQUISITION", "CPE_CHANGE", "PHYSICAL_ADDON"],
      network_capability: ["4G", "5G", "BOTH", "ANY"],
      order_status: [
        "PENDING_DISPATCH",
        "OUT_FOR_DELIVERY",
        "ACTIVE",
        "CANCELLED",
        "ASSIGNED",
        "CONTACTED",
        "NETWORK_TEST",
        "INSTALLED",
      ],
      ownership_transfer_behavior: ["KEEP", "REMOVE"],
      payment_status: ["PENDING_COD", "PAID_COD", "ONLINE_PAID"],
      product_category: ["WIFI_PLAN", "CPE", "SIM", "ADDON"],
      referral_reward_status: [
        "PENDING",
        "AWAITING_ACTIVATION",
        "AWAITING_PAYMENT",
        "EARNED",
        "APPLIED",
        "FORCE_APPROVED",
      ],
      referrer_product_category: [
        "WIFI_PLAN",
        "CPE",
        "PHYSICAL_ADDON",
        "DIGITAL_ADDON",
        "ANY",
      ],
      referrer_product_type: ["WIFI_PLAN", "ADDON", "BOTH"],
      replacement_reason: ["WARRANTY", "PAID", "UPGRADE"],
      reward_status: ["PENDING_ACTIVATION", "REWARD_APPLIED", "FAILED"],
      service_status: ["ACTIVE", "SUSPENDED"],
      test_status: ["PENDING", "SUCCESS", "FAIL"],
      warranty_unit: ["DAYS", "MONTHS", "YEARS"],
    },
  },
} as const
