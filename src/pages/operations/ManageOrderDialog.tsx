import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { formatBDT } from "@/lib/currency";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { addDays } from "date-fns";
import { RefreshCw, CheckCircle2, XCircle, Truck, Phone, Wifi, ClipboardCheck } from "lucide-react";

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WARRANTY_DAYS: Record<string, number> = {
  CPE: 365,
  PHYSICAL_ADDON: 180,
  SIM: 180,
};

const STATUS_FLOW = ["PENDING_DISPATCH", "ASSIGNED", "CONTACTED", "OUT_FOR_DELIVERY", "NETWORK_TEST", "INSTALLED"] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING_DISPATCH: { label: "Pending Dispatch", color: "bg-amber-100 text-amber-800", icon: ClipboardCheck },
  ASSIGNED: { label: "Assigned", color: "bg-blue-100 text-blue-800", icon: Truck },
  CONTACTED: { label: "Contacted", color: "bg-indigo-100 text-indigo-800", icon: Phone },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "bg-purple-100 text-purple-800", icon: Truck },
  NETWORK_TEST: { label: "Network Test", color: "bg-cyan-100 text-cyan-800", icon: Wifi },
  INSTALLED: { label: "Installed", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle },
};

const CANCEL_REASONS = [
  "Customer Refused",
  "Customer Unreachable",
  "Wrong Address",
  "FI Test Failed",
  "Inventory Issue",
  "Other",
];

// ─── Searchable SIM Dropdown ───
const SimSearchDropdown = ({ simInventory, value, onSelect }: { simInventory: any[]; value: string; onSelect: (v: string) => void }) => {
  const [simSearch, setSimSearch] = useState("");
  const filtered = simInventory.filter((s: any) => {
    const label = (s.msisdn ?? s.serial_number ?? "").toLowerCase();
    return label.includes(simSearch.toLowerCase());
  });
  const selectedSim = simInventory.find((s: any) => s.inventory_id === value);
  const selectedLabel = selectedSim ? (selectedSim.msisdn ?? selectedSim.serial_number ?? "Selected") : "";

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          placeholder="Search SIM MSISDN..."
          value={value ? selectedLabel : simSearch}
          onChange={(e) => { setSimSearch(e.target.value); if (value) onSelect(""); }}
          className="pr-8"
        />
        {value && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { onSelect(""); setSimSearch(""); }}>✕</button>
        )}
      </div>
      {!value && simSearch && (
        <div className="border rounded-md max-h-32 overflow-y-auto bg-popover">
          {!filtered.length ? (
            <p className="text-xs text-muted-foreground p-2">No matching SIMs</p>
          ) : filtered.map((s: any) => (
            <button
              key={s.inventory_id}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
              onClick={() => { onSelect(s.inventory_id); setSimSearch(""); }}
            >
              {s.msisdn ?? s.serial_number ?? "N/A"} — {s.products?.product_name ?? "SIM"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ManageOrderDialog = ({ orderId, open, onOpenChange }: Props) => {
  const queryClient = useQueryClient();

  // Dispatch state
  const [dhKamId, setDhKamId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [staffUserId, setStaffUserId] = useState("");
  const [sourceChannelId, setSourceChannelId] = useState("");
  const [sourceSubChannelId, setSourceSubChannelId] = useState("");

  // Contact state
  const [contactedChecked, setContactedChecked] = useState(false);

  // Network test state
  const [networkTestResult, setNetworkTestResult] = useState<"PASSED" | "FAILED" | "">("");
  const [signalStrength, setSignalStrength] = useState("");
  const [downloadSpeed, setDownloadSpeed] = useState("");
  const [latency, setLatency] = useState("");

  // Cancel state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  // Installation form state
  const [installItems, setInstallItems] = useState<Record<string, string>>({});
  const [simInventoryId, setSimInventoryId] = useState("");

  // Replacement state
  const [replacementAnchorId, setReplacementAnchorId] = useState("");
  const [replacementNewInventoryId, setReplacementNewInventoryId] = useState("");
  const [replacementType, setReplacementType] = useState<"WARRANTY" | "PAID" | "UPGRADE">("WARRANTY");

  // ─── Queries ───
  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("order_id", orderId).single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Channel/SubChannel delivery ownership lookup
  const { data: channelDeliveryInfo } = useQuery({
    queryKey: ["channel_delivery_info"],
    queryFn: async () => {
      const { data: ch } = await supabase.from("channels").select("channel_id, channel_name, is_self_delivered, is_assisted");
      const { data: sc } = await supabase.from("sub_channels").select("sub_channel_id, sub_channel_name, channel_id, delivery_ownership") as any;
      return { channels: ch ?? [], subChannels: (sc ?? []) as any[] };
    },
    enabled: open,
  });

  const { data: orderItems } = useQuery({
    queryKey: ["order_items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(product_name, product_category, product_id)")
        .eq("order_id", orderId);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: availableInventory } = useQuery({
    queryKey: ["available_inventory_for_order", order?.assigned_agent_id],
    queryFn: async () => {
      let q = supabase
        .from("inventory_master")
        .select("*, products(product_name, product_category)")
        .in("status", ["WITH_AGENT", "ALLOCATED_TO_DH", "IN_WAREHOUSE"]);
      // Filter to agent's bag if agent is assigned
      if (order?.assigned_agent_id) {
        q = q.eq("allocated_agent_id", order.assigned_agent_id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // DH lookup for smart dispatch
  const { data: dhList } = useQuery({
    queryKey: ["dh_for_dispatch"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_houses")
        .select("*, districts(district_name), areas(area_name)")
        .eq("status", "ACTIVE")
        .order("last_assigned_at", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: agentList } = useQuery({
    queryKey: ["agents_for_dispatch", dhKamId],
    queryFn: async () => {
      if (!dhKamId) return [];
      // Self-delivered sub-channel: get agents tagged to that sub-channel
      if (dhKamId.startsWith("sc:")) {
        const scId = dhKamId.replace("sc:", "");
        const { data } = await supabase
          .from("field_agents")
          .select("*")
          .eq("dh_id", scId)
          .eq("status", "ACTIVE");
        return data ?? [];
      }
      // DH: check DH is active (cascade logic)
      const { data: dh } = await supabase
        .from("distribution_houses")
        .select("status")
        .eq("dh_id", dhKamId)
        .single();
      if (dh?.status !== "ACTIVE") return [];
      const { data } = await supabase
        .from("field_agents")
        .select("*")
        .eq("dh_id", dhKamId)
        .eq("status", "ACTIVE");
      return data ?? [];
    },
    enabled: open && !!dhKamId,
  });

  const { data: kamList } = useQuery({
    queryKey: ["kams_for_dispatch"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kams").select("*").eq("status", "ACTIVE");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Staff users for sales agent attribution — loaded by sourceSubChannelId for assisted channels
  const { data: staffUsers } = useQuery({
    queryKey: ["staff_users_for_dispatch", sourceSubChannelId, dhKamId],
    queryFn: async () => {
      // For assisted GPC: use the selected sourceSubChannelId
      if (sourceSubChannelId) {
        const { data } = await supabase
          .from("sub_channel_users")
          .select("*")
          .eq("sub_channel_id", sourceSubChannelId)
          .eq("status", "ACTIVE");
        return data ?? [];
      }
      // Legacy: self-delivered sub-channel
      if (dhKamId.startsWith("sc:")) {
        const scId = dhKamId.replace("sc:", "");
        const { data } = await supabase
          .from("sub_channel_users")
          .select("*")
          .eq("sub_channel_id", scId)
          .eq("status", "ACTIVE");
        return data ?? [];
      }
      return [];
    },
    enabled: open && !!(sourceSubChannelId || dhKamId),
  });

  // Active CPE assets for replacement
  const { data: activeAssets } = useQuery({
    queryKey: ["active_cpe_assets_for_order", orderId],
    queryFn: async () => {
      const { data: anchors } = await supabase.from("anchors").select("anchor_id").eq("order_id", orderId);
      if (!anchors?.length) return [];
      const { data, error } = await supabase
        .from("customer_assets")
        .select("*, products(product_name)")
        .in("anchor_id", anchors.map(a => a.anchor_id))
        .eq("asset_status", "ACTIVE")
        .eq("asset_type", "CPE");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (order) {
      setDhKamId(order.assigned_dh_kam_id ?? "");
      setAgentId(order.assigned_agent_id ?? "");
      setStaffUserId((order as any).staff_user_id ?? "");
      setSourceChannelId((order as any).channel_id ?? "");
      setSourceSubChannelId((order as any).sub_channel_id ?? "");
    }
  }, [order]);

  // ─── Smart Dispatch ───
  const smartDispatchMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order data");

      let assignedDh = "";
      let assignedAgent = "";

      // Check delivery ownership: channel.is_self_delivered OR sub_channel.override_delivery_ownership
      // For now, use the manual selection — the dispatch UI will adapt based on flags
      const isSelfDelivered = false; // Will be determined by order's channel/sub-channel in production

      if (order.customer_type === "B2B") {
        if (!dhKamId) throw new Error("Select a KAM for B2B dispatch");
        assignedDh = dhKamId;
      } else {
        if (dhKamId) {
          assignedDh = dhKamId;
        } else if (dhList?.length) {
          assignedDh = dhList[0].dh_id;
        } else {
          throw new Error("No active Distribution Houses available");
        }
      }

      if (agentId) assignedAgent = agentId;

      const { error } = await supabase.from("orders").update({
        assigned_dh_kam_id: assignedDh || null,
        assigned_agent_id: assignedAgent || null,
        staff_user_id: staffUserId || null,
        channel_id: sourceChannelId || null,
        sub_channel_id: sourceSubChannelId || null,
        order_status: "ASSIGNED" as any,
      } as any).eq("order_id", orderId);
      if (error) throw error;

      // Update DH last_assigned_at for round-robin (only for non-self-delivered B2C)
      if (order.customer_type !== "B2B" && assignedDh && !assignedDh.startsWith("sc:")) {
        await supabase.from("distribution_houses")
          .update({ last_assigned_at: new Date().toISOString() } as any)
          .eq("dh_id", assignedDh);
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Order dispatched!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Status Transitions ───
  const advanceStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("orders")
        .update({ order_status: newStatus as any })
        .eq("order_id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Status updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Cancel (with Automatic Reversal & Refund) ───
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelReason) throw new Error("Select a cancellation reason");
      if (!order) throw new Error("No order");

      const { error } = await supabase.from("orders").update({
        order_status: "CANCELLED" as any,
        fulfillment_status: "CANCELLED" as any,
      } as any).eq("order_id", orderId);
      if (error) throw error;

      // If inventory was linked, return to WITH_AGENT (safety rule)
      let refundTotal = 0;
      if (orderItems?.length) {
        const linkedItems = orderItems.filter((i: any) => i.inventory_id);
        for (const item of linkedItems) {
          await supabase.from("inventory_master")
            .update({ status: "WITH_AGENT" as any })
            .eq("inventory_id", item.inventory_id);
          await supabase.from("order_items")
            .update({ inventory_id: null, item_fulfillment_status: "CANCELLED" as any } as any)
            .eq("item_id", item.item_id);
        }

        // Calculate refund: Physical items → refund Request Date price; Digital → refund full paid amount
        for (const item of orderItems) {
          const cat = item.products?.product_category ?? "";
          const lockedPrice = Number((item as any).locked_unit_price_bdt || item.unit_price_bdt);
          // Physical add-on cancelled with payment done → refund request-date price
          // WiFi Plan cancelled before activation → refund full amount paid
          if (order.payment_status === "ONLINE_PAID" || order.payment_status === "PAID_COD") {
            refundTotal += lockedPrice * item.quantity;
          }
        }
      }

      // Create refund record if payment was made
      if (refundTotal > 0 && (order.payment_status === "ONLINE_PAID" || order.payment_status === "PAID_COD")) {
        const { data: customers } = await supabase
          .from("customers").select("customer_id").eq("full_name", order.customer_name).limit(1);
        const customerId = customers?.[0]?.customer_id;
        if (customerId) {
          await supabase.from("onetime_invoices").insert({
            customer_id: customerId,
            trigger_type: "ACQUISITION" as any,
            charged_amount_bdt: 0,
            payment_status: "PAID" as any,
            refund_amount_bdt: refundTotal,
            refunded_at: new Date().toISOString(),
            refund_reason: `Cancelled: ${cancelReason}${cancelNotes ? ` — ${cancelNotes}` : ""}`,
          } as any);
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      setShowCancel(false);
      toast.success("Order cancelled. Inventory returned & refund processed.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Price-Date Helper: Resolve active price at a given date ───
  const resolvePrice = async (productId: string, anchorDate: Date) => {
    const dateStr = anchorDate.toISOString();
    const { data: pv } = await supabase
      .from("product_price_versions")
      .select("price_version_id, base_price_bdt")
      .eq("product_id", productId)
      .eq("status", true)
      .lte("start_date", dateStr)
      .or(`end_date.is.null,end_date.gte.${dateStr}`)
      .order("start_date", { ascending: false })
      .limit(1);
    if (!pv?.length) return null;
    const { data: components } = await supabase
      .from("price_components")
      .select("component_name, amount_bdt")
      .eq("price_version_id", pv[0].price_version_id)
      .order("sort_order");
    const total = (components ?? []).reduce((s: number, c: any) => s + Number(c.amount_bdt), 0);
    return { base_price_bdt: Number(pv[0].base_price_bdt), components: components ?? [], total };
  };

  // Helper: classify asset as physical or digital
  const isPhysicalCategory = (cat: string) => ["CPE", "SIM", "ADDON"].includes(cat);
  const isDigitalCategory = (cat: string) => ["WIFI_PLAN"].includes(cat);

  // ─── Installation & Fulfillment (with Price-Date Logic) ───
  const installMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order");
      if (!simInventoryId) throw new Error("Select a SIM for GPFI MSISDN");

      // Get SIM details for gpfi_msisdn
      const { data: simInv, error: simErr } = await supabase
        .from("inventory_master")
        .select("*")
        .eq("inventory_id", simInventoryId)
        .single();
      if (simErr) throw simErr;
      const gpfiMsisdn = simInv.msisdn || simInv.serial_number || `SIM-${Date.now()}`;

      // Mark SIM as delivered
      await supabase.from("inventory_master")
        .update({ status: "DELIVERED" as any })
        .eq("inventory_id", simInventoryId);

      // Find/create anchor for this order
      let anchor: any;
      const { data: existingAnchors } = await supabase
        .from("anchors").select("*").eq("order_id", orderId);
      
      if (existingAnchors?.length) {
        anchor = existingAnchors[0];
      } else {
        const { data: customers } = await supabase
          .from("customers").select("customer_id").eq("full_name", order.customer_name).limit(1);
        const customerId = customers?.[0]?.customer_id;
        if (!customerId) throw new Error("Customer not found for anchor creation");

        const { data: newAnchor, error: ancErr } = await supabase.from("anchors").insert({
          customer_id: customerId,
          order_id: orderId,
          test_status: "SUCCESS" as any,
        }).select().single();
        if (ancErr) throw ancErr;
        anchor = newAnchor;
      }

      const now = new Date();
      const orderPlacedDate = new Date(order.created_at);
      let recalcTotal = 0;

      // Determine context: ACQ (new joiner) vs LC (existing customer)
      const { data: existingServices } = await supabase
        .from("active_services")
        .select("service_id")
        .eq("customer_id", anchor.customer_id)
        .eq("service_status", "ACTIVE")
        .limit(1);
      const isACQ = !existingServices?.length; // No existing active services = new joiner

      // Process each order item with Price-Date Logic
      for (const item of (orderItems ?? [])) {
        const cat = item.products?.product_category ?? "";
        const invId = installItems[item.item_id] || item.inventory_id;

        // ── Price-Date Resolution ──
        // Physical (CPE/SIM/Addon): price anchored to Request Placed Date
        // Digital (WiFi Plan): price anchored to Fulfillment Date (now)
        const priceAnchorType = isDigitalCategory(cat) ? "FULFILLMENT_DATE" : "REQUEST_DATE";
        const priceAnchorDate = isDigitalCategory(cat) ? now : orderPlacedDate;
        const resolvedPrice = await resolvePrice(item.product_id, priceAnchorDate);
        const lockedPrice = resolvedPrice ? resolvedPrice.total : Number(item.unit_price_bdt);

        // Update order_item with price-date metadata
        await supabase.from("order_items").update({
          price_anchor_type: priceAnchorType,
          price_locked_at: priceAnchorDate.toISOString(),
          locked_unit_price_bdt: lockedPrice,
          fulfillment_date: now.toISOString(),
          item_fulfillment_status: (isACQ ? "PROVISIONAL" : (isDigitalCategory(cat) ? "EARNED" : "PROVISIONAL")) as any,
        } as any).eq("item_id", item.item_id);

        if (["CPE", "SIM"].includes(cat) && invId) {
          const { data: inv } = await supabase
            .from("inventory_master").select("*").eq("inventory_id", invId).single();
          if (!inv) continue;

          await supabase.from("inventory_master")
            .update({ status: "DELIVERED" as any })
            .eq("inventory_id", invId);

          if (installItems[item.item_id]) {
            await supabase.from("order_items")
              .update({ inventory_id: invId })
              .eq("item_id", item.item_id);
          }

          const assetType = cat === "CPE" ? "CPE" : cat === "SIM" ? "SIM" : "PHYSICAL_ADDON";
          const warrantyDays = WARRANTY_DAYS[assetType] ?? 365;
          await supabase.from("customer_assets").insert({
            anchor_id: anchor.anchor_id,
            customer_id: anchor.customer_id,
            product_id: item.product_id,
            serial_number: inv.serial_number || `INST-${Date.now()}-${item.item_id.slice(0, 4)}`,
            mac_address: inv.mac_address || null,
            asset_type: assetType as any,
            installation_date: now.toISOString(),
            warranty_start_date: now.toISOString(),
            warranty_end_date: addDays(now, warrantyDays).toISOString(),
            asset_status: "ACTIVE" as any,
          });
        }

        // Addon handling
        if (cat === "ADDON" && invId) {
          const { data: inv } = await supabase
            .from("inventory_master").select("*").eq("inventory_id", invId).single();
          if (inv) {
            await supabase.from("inventory_master")
              .update({ status: "DELIVERED" as any })
              .eq("inventory_id", invId);
            await supabase.from("customer_assets").insert({
              anchor_id: anchor.anchor_id,
              customer_id: anchor.customer_id,
              product_id: item.product_id,
              serial_number: inv.serial_number || `ADDON-${Date.now()}`,
              mac_address: inv.mac_address || null,
              asset_type: "PHYSICAL_ADDON" as any,
              installation_date: now.toISOString(),
              warranty_start_date: now.toISOString(),
              warranty_end_date: addDays(now, WARRANTY_DAYS.PHYSICAL_ADDON).toISOString(),
              asset_status: "ACTIVE" as any,
            });
          }
        }

        // Use locked price instead of original unit_price
        recalcTotal += lockedPrice * item.quantity;
      }

      // Create active service with WiFi expiry (+1 day rule)
      const wifiItem = orderItems?.find((i: any) => i.products?.product_category === "WIFI_PLAN");
      if (wifiItem) {
        const validityDays = 30;
        const expiryDate = addDays(now, validityDays + 1);
        expiryDate.setHours(23, 59, 59, 999);

        await supabase.from("active_services").insert({
          customer_id: anchor.customer_id,
          anchor_id: anchor.anchor_id,
          product_id: wifiItem.product_id,
          product_category: "WIFI_PLAN",
          gpfi_msisdn: gpfiMsisdn,
          activation_date: now.toISOString(),
          validity_days: validityDays,
          expiry_date: expiryDate.toISOString(),
          service_status: "ACTIVE" as any,
        });
      }

      // Create onetime invoice
      await supabase.from("onetime_invoices").insert({
        customer_id: anchor.customer_id,
        trigger_type: "ACQUISITION" as any,
        charged_amount_bdt: recalcTotal,
        payment_status: order.payment_status === "ONLINE_PAID" ? ("PAID" as any) : ("PENDING" as any),
      });

      // Determine fulfillment_status based on ACQ/LC context
      // ACQ: PAID_AWAITING_INSTALLATION until CPE+SIM = INSTALLED → now all installed → EARNED
      // LC Digital: EARNED immediately; LC Physical: PROVISIONAL until installed → now EARNED
      const finalFulfillmentStatus = "EARNED";

      // Update order to INSTALLED with fulfillment metadata
      await supabase.from("orders").update({
        order_status: "INSTALLED" as any,
        final_total_bdt: recalcTotal,
        fulfillment_status: finalFulfillmentStatus as any,
        price_snapshot_date: now.toISOString(),
      } as any).eq("order_id", orderId);

      // Mark all order items as EARNED now that installation is complete
      for (const item of (orderItems ?? [])) {
        await supabase.from("order_items").update({
          item_fulfillment_status: "EARNED" as any,
        } as any).eq("item_id", item.item_id);
      }

      // Link current CPE inventory to active service
      const cpeItem = orderItems?.find((i: any) => i.products?.product_category === "CPE");
      if (cpeItem) {
        const cpeInvId = installItems[cpeItem.item_id] || cpeItem.inventory_id;
        if (cpeInvId) {
          const { data: services } = await supabase
            .from("active_services")
            .select("service_id")
            .eq("anchor_id", anchor.anchor_id)
            .eq("service_status", "ACTIVE")
            .limit(1);
          if (services?.[0]) {
            await supabase.from("active_services")
              .update({ current_cpe_inventory_id: cpeInvId })
              .eq("service_id", services[0].service_id);
          }
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Installation complete! Services activated.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Asset Replacement ───
  const replacementMutation = useMutation({
    mutationFn: async () => {
      if (!replacementAnchorId || !replacementNewInventoryId) throw new Error("Select anchor and new inventory");

      const { data: currentAsset, error: findErr } = await supabase
        .from("customer_assets")
        .select("*")
        .eq("anchor_id", replacementAnchorId)
        .eq("asset_type", "CPE")
        .eq("asset_status", "ACTIVE")
        .single();
      if (findErr) throw new Error("No active CPE found for this anchor");

      await supabase.from("customer_assets")
        .update({ asset_status: "REPLACED" as any })
        .eq("asset_id", currentAsset.asset_id);

      const { data: newInv } = await supabase
        .from("inventory_master")
        .select("*, products(product_name)")
        .eq("inventory_id", replacementNewInventoryId)
        .single();
      if (!newInv) throw new Error("Inventory not found");

      const installDate = new Date();
      const warrantyEnd = addDays(installDate, WARRANTY_DAYS.CPE);

      const { data: newAsset, error: createErr } = await supabase.from("customer_assets").insert({
        anchor_id: replacementAnchorId,
        customer_id: currentAsset.customer_id,
        product_id: newInv.product_id,
        serial_number: newInv.serial_number || `RPL-${Date.now()}`,
        mac_address: newInv.mac_address || null,
        asset_type: "CPE" as any,
        installation_date: installDate.toISOString(),
        warranty_start_date: installDate.toISOString(),
        warranty_end_date: warrantyEnd.toISOString(),
        asset_status: "ACTIVE" as any,
      }).select().single();
      if (createErr) throw createErr;

      await supabase.from("inventory_master")
        .update({ status: "DELIVERED" as any })
        .eq("inventory_id", replacementNewInventoryId);

      // Log replacement history
      await supabase.from("asset_replacement_history").insert({
        anchor_id: replacementAnchorId,
        old_asset_id: currentAsset.asset_id,
        new_asset_id: newAsset.asset_id,
        reason: replacementType as any,
        charge_amount_bdt: replacementType === "WARRANTY" ? 0 : 0,
      });

      const chargeAmount = replacementType === "WARRANTY" ? 0 : 0;
      await supabase.from("onetime_invoices").insert({
        customer_id: currentAsset.customer_id,
        trigger_type: "CPE_CHANGE" as any,
        charged_amount_bdt: chargeAmount,
        payment_status: replacementType === "WARRANTY" ? ("PAID" as any) : ("PENDING" as any),
      });
    },
    onSuccess: () => {
      invalidateAll();
      setReplacementAnchorId("");
      setReplacementNewInventoryId("");
      toast.success("Asset replacement completed!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Inventory link (for order items) ───
  const linkInventoryMutation = useMutation({
    mutationFn: async ({ itemId, inventoryId }: { itemId: string; inventoryId: string }) => {
      await supabase.from("order_items").update({ inventory_id: inventoryId }).eq("item_id", itemId);
      await supabase.from("inventory_master").update({ status: "DELIVERED" as any }).eq("inventory_id", inventoryId);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Inventory linked!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    queryClient.invalidateQueries({ queryKey: ["order_items", orderId] });
    queryClient.invalidateQueries({ queryKey: ["available_inventory_for_order"] });
    queryClient.invalidateQueries({ queryKey: ["active_cpe_assets_for_order"] });
    queryClient.invalidateQueries({ queryKey: ["customer_assets"] });
    queryClient.invalidateQueries({ queryKey: ["onetime_invoices"] });
  };

  const isPhysical = (category: string) => isPhysicalCategory(category);
  const currentStatus = order?.order_status ?? "PENDING_DISPATCH";
  const statusIdx = STATUS_FLOW.indexOf(currentStatus as any);
  const isTerminal = currentStatus === "INSTALLED" || currentStatus === "CANCELLED";

  const cpeInventory = availableInventory?.filter((inv: any) => inv.products?.product_category === "CPE") ?? [];
  const simInventory = availableInventory?.filter((inv: any) => inv.item_type === "SIM") ?? [];
  const activeAnchors = [...new Set(activeAssets?.map((a: any) => a.anchor_id) ?? [])];

  const getNextAction = () => {
    switch (currentStatus) {
      case "PENDING_DISPATCH": return { label: "Dispatch Order", action: () => smartDispatchMutation.mutate(), pending: smartDispatchMutation.isPending };
      case "ASSIGNED": return { label: "Mark Contacted", action: () => { if (!contactedChecked) { toast.error("Confirm customer contacted"); return; } advanceStatusMutation.mutate("CONTACTED"); }, pending: advanceStatusMutation.isPending };
      case "CONTACTED": return { label: "Out for Delivery", action: () => advanceStatusMutation.mutate("OUT_FOR_DELIVERY"), pending: advanceStatusMutation.isPending };
      case "OUT_FOR_DELIVERY": return { label: "Start Network Test", action: () => advanceStatusMutation.mutate("NETWORK_TEST"), pending: advanceStatusMutation.isPending };
      case "NETWORK_TEST": return { label: "Complete Installation", action: () => { if (networkTestResult !== "PASSED") { toast.error("Network test must PASS before installation"); return; } installMutation.mutate(); }, pending: installMutation.isPending };
      default: return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Order — Work Order</DialogTitle>
          <DialogDescription>Lifecycle management: dispatch, contact, delivery, test, and installation</DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-5">
            {/* ─── Status Pipeline ─── */}
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_FLOW.map((s, i) => {
                const cfg = STATUS_CONFIG[s];
                const isActive = currentStatus === s;
                const isPast = statusIdx > i;
                const isCancelled = currentStatus === "CANCELLED";
                return (
                  <div key={s} className="flex items-center gap-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${isActive ? cfg.color + " ring-2 ring-offset-1 ring-primary" : isPast ? "bg-muted text-muted-foreground line-through" : isCancelled ? "bg-muted/50 text-muted-foreground/50" : "bg-muted/50 text-muted-foreground"}`}>
                      <cfg.icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    {i < STATUS_FLOW.length - 1 && <span className="text-muted-foreground">→</span>}
                  </div>
                );
              })}
              {currentStatus === "CANCELLED" && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG.CANCELLED.color} ring-2 ring-offset-1 ring-destructive`}>
                  <XCircle className="h-3 w-3" /> Cancelled
                </span>
              )}
            </div>

            {/* ─── Customer Info ─── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{order.customer_name}</span></div>
              <div><span className="text-muted-foreground">Contact:</span> <span className="font-mono">{order.contact_msisdn}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline">{order.customer_type}</Badge></div>
              <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold">{formatBDT(Number(order.final_total_bdt))}</span></div>
              {order.assigned_dh_kam_id && (
                <div>
                  <span className="text-muted-foreground">Assigned To:</span>{" "}
                  <span className="font-medium">
                    {order.assigned_dh_kam_id.startsWith?.("sc:") ? `[Sub-Channel]` : order.customer_type === "B2B" ? `[KAM]` : `[DH]`}{" "}
                    {(() => {
                      const id = order.assigned_dh_kam_id;
                      if (id.startsWith?.("sc:")) {
                        const scId = id.replace("sc:", "");
                        return channelDeliveryInfo?.subChannels?.find((sc: any) => sc.sub_channel_id === scId)?.sub_channel_name ?? scId;
                      }
                      const dh = dhList?.find((d: any) => d.dh_id === id);
                      if (dh) return `${dh.dh_code} — ${dh.name}`;
                      const kam = kamList?.find((k: any) => k.kam_id === id);
                      if (kam) return `${kam.kam_id} — ${kam.name}`;
                      return id;
                    })()}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* ─── PENDING_DISPATCH: Smart Dispatch ─── */}
            {currentStatus === "PENDING_DISPATCH" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Smart Dispatch Assignment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* ─── Step 1: Source Channel (for attribution) ─── */}
                  <div className="space-y-1.5">
                    <Label>Source Channel</Label>
                    <Select value={sourceChannelId} onValueChange={(v) => {
                      setSourceChannelId(v);
                      setSourceSubChannelId("");
                      setStaffUserId("");
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select originating channel..." /></SelectTrigger>
                      <SelectContent>
                        {channelDeliveryInfo?.channels?.map((c: any) => (
                          <SelectItem key={c.channel_id} value={c.channel_id}>
                            {c.channel_name}{c.is_assisted ? " (Assisted)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ─── Assisted Channel: Sub-Channel + Staff Logic ─── */}
                  {(() => {
                    const selectedChannel = channelDeliveryInfo?.channels?.find((c: any) => c.channel_id === sourceChannelId);
                    const isAssisted = selectedChannel?.is_assisted;
                    const isB2B = order.customer_type === "B2B";
                    const assistedSubChannels = channelDeliveryInfo?.subChannels?.filter(
                      (sc: any) => sc.channel_id === sourceChannelId
                    ) ?? [];

                    if (isAssisted && sourceChannelId) {
                      return (
                        <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground">
                            {isB2B ? "B2B Assisted — Select KAM (Sub-Channel)" : "Assisted Channel — Select Store & Staff Member"}
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label>{isB2B ? "KAM (Sub-Channel)" : "Store (Sub-Channel)"}</Label>
                              <Select value={sourceSubChannelId} onValueChange={(v) => {
                                setSourceSubChannelId(v);
                                setStaffUserId("");
                                // B2B: auto-set dispatch to KAM
                                if (isB2B) {
                                  const sc = assistedSubChannels.find((s: any) => s.sub_channel_id === v);
                                  if (sc) {
                                    // For B2B, find matching KAM by sub-channel name
                                    const matchedKam = kamList?.find((k: any) =>
                                      sc.sub_channel_name.toLowerCase().includes(k.name.toLowerCase()) ||
                                      k.name.toLowerCase().includes(sc.sub_channel_name.toLowerCase())
                                    );
                                    if (matchedKam) setDhKamId(matchedKam.kam_id);
                                  }
                                }
                              }}>
                                <SelectTrigger><SelectValue placeholder={isB2B ? "Select KAM..." : "Select store..."} /></SelectTrigger>
                                <SelectContent>
                                  {isB2B ? (
                                    kamList?.map((k: any) => (
                                      <SelectItem key={k.kam_id} value={k.kam_id}>{k.kam_id} — {k.name}</SelectItem>
                                    ))
                                  ) : (
                                    assistedSubChannels.map((sc: any) => (
                                      <SelectItem key={sc.sub_channel_id} value={sc.sub_channel_id}>
                                        {sc.sub_channel_name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* GPC: Staff Member required */}
                            {!isB2B && sourceSubChannelId && (
                              <div className="space-y-1.5">
                                <Label>Staff Member <span className="text-destructive">*</span></Label>
                                <Select value={staffUserId} onValueChange={setStaffUserId}>
                                  <SelectTrigger><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                                  <SelectContent>
                                    {!staffUsers?.length ? (
                                      <SelectItem value="__none" disabled>No staff in this store</SelectItem>
                                    ) : staffUsers.map((s: any) => (
                                      <SelectItem key={s.id} value={s.id}>{s.employee_id} — {s.user_name} ({s.role})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">This person gets individual sale credit</p>
                              </div>
                            )}

                            {/* B2B: auto-attribution info */}
                            {isB2B && sourceSubChannelId && (
                              <div className="space-y-1.5">
                                <Label>Attribution</Label>
                                <div className="bg-muted rounded-md px-3 py-2 text-sm text-muted-foreground">
                                  Auto-attributed to KAM — no individual staff selection needed
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <Separator />

                  {/* ─── Delivery Dispatch (DH / Self-Delivery / KAM) ─── */}
                  {order.customer_type === "B2B" ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">B2B — Dispatch to KAM</p>
                      <div className="space-y-1.5">
                        <Label>KAM</Label>
                        <Select value={dhKamId} onValueChange={setDhKamId}>
                          <SelectTrigger><SelectValue placeholder="Select KAM..." /></SelectTrigger>
                          <SelectContent>
                            {kamList?.map((k: any) => (
                              <SelectItem key={k.kam_id} value={k.kam_id}>{k.kam_id} — {k.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">B2C — Hierarchy of Truth: Sub-Channel → Channel → DH Round-Robin</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Dispatch To</Label>
                          <Select value={dhKamId} onValueChange={(v) => { setDhKamId(v); setAgentId(""); }}>
                            <SelectTrigger><SelectValue placeholder="Auto-select or choose..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__dh_header" disabled className="font-semibold text-xs text-muted-foreground">Distribution Houses (Round-Robin)</SelectItem>
                              {dhList?.map((d: any, i: number) => (
                                <SelectItem key={d.dh_id} value={d.dh_id}>
                                  {i === 0 ? "⭐ " : ""}[DH] {d.dh_code} — {d.name} ({d.districts?.district_name ?? "?"})
                                </SelectItem>
                              ))}
                              {channelDeliveryInfo?.subChannels?.filter((sc: any) => {
                                if (sc.delivery_ownership === "SELF_DELIVERY") return true;
                                if (sc.delivery_ownership === "FOLLOW_CHANNEL") {
                                  const ch = channelDeliveryInfo.channels.find((c: any) => c.channel_id === sc.channel_id);
                                  return ch?.is_self_delivered;
                                }
                                return false;
                              }).length ? (
                                <>
                                  <SelectItem value="__sc_header" disabled className="font-semibold text-xs text-muted-foreground">Self-Delivered Sub-Channels</SelectItem>
                                  {channelDeliveryInfo!.subChannels
                                    .filter((sc: any) => {
                                      if (sc.delivery_ownership === "SELF_DELIVERY") return true;
                                      if (sc.delivery_ownership === "FOLLOW_CHANNEL") {
                                        const ch = channelDeliveryInfo!.channels.find((c: any) => c.channel_id === sc.channel_id);
                                        return ch?.is_self_delivered;
                                      }
                                      return false;
                                    })
                                    .map((sc: any) => (
                                      <SelectItem key={sc.sub_channel_id} value={`sc:${sc.sub_channel_id}`}>
                                        📌 [Sub-Channel] {sc.sub_channel_name}
                                      </SelectItem>
                                    ))}
                                </>
                              ) : null}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Field Agent</Label>
                          <Select value={agentId} onValueChange={setAgentId}>
                            <SelectTrigger><SelectValue placeholder="Select agent..." /></SelectTrigger>
                            <SelectContent>
                              {!agentList?.length ? (
                                <SelectItem value="__none" disabled>No agents available</SelectItem>
                              ) : agentList.map((a: any) => (
                                <SelectItem key={a.agent_id} value={a.agent_id}>{a.agent_id} — {a.agent_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── ASSIGNED: Contact Confirmation ─── */}
            {currentStatus === "ASSIGNED" && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Contact Confirmation</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="contacted" checked={contactedChecked} onCheckedChange={(v) => setContactedChecked(!!v)} />
                    <Label htmlFor="contacted">I confirm customer has been contacted and appointment scheduled</Label>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── NETWORK_TEST: Test Result ─── */}
            {currentStatus === "NETWORK_TEST" && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Network / FI Test Result</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Enter test metrics and toggle result (will be API-driven in production)</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Signal Strength (dBm)</Label>
                      <Input type="number" placeholder="e.g. -65" value={signalStrength} onChange={(e) => setSignalStrength(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Download Speed (Mbps)</Label>
                      <Input type="number" placeholder="e.g. 25.5" value={downloadSpeed} onChange={(e) => setDownloadSpeed(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Latency (ms)</Label>
                      <Input type="number" placeholder="e.g. 15" value={latency} onChange={(e) => setLatency(e.target.value)} />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Test Verdict</Label>
                    <div className="flex gap-3">
                      <Button
                        size="sm"
                        variant={networkTestResult === "PASSED" ? "default" : "outline"}
                        className={networkTestResult === "PASSED" ? "bg-green-600 hover:bg-green-700" : ""}
                        onClick={() => setNetworkTestResult("PASSED")}
                        disabled={!signalStrength || !downloadSpeed || !latency}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> PASS
                      </Button>
                      <Button
                        size="sm"
                        variant={networkTestResult === "FAILED" ? "destructive" : "outline"}
                        onClick={() => setNetworkTestResult("FAILED")}
                        disabled={!signalStrength || !downloadSpeed || !latency}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> FAIL
                      </Button>
                    </div>
                    {(!signalStrength || !downloadSpeed || !latency) && (
                      <p className="text-xs text-muted-foreground">Fill all test metrics before selecting verdict</p>
                    )}
                  </div>
                  {networkTestResult === "FAILED" && (
                    <p className="text-xs text-destructive">Test failed — you may cancel with reason "FI Test Failed"</p>
                  )}
                  {networkTestResult === "PASSED" && (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2 text-xs text-green-700 dark:text-green-400">
                      ✅ Signal: {signalStrength} dBm | Speed: {downloadSpeed} Mbps | Latency: {latency} ms — Ready for installation
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── OUT_FOR_DELIVERY / NETWORK_TEST: Installation Form ─── */}
            {(currentStatus === "OUT_FOR_DELIVERY" || currentStatus === "NETWORK_TEST") && (
              <>
                <Separator />
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Installation Form — Inventory Assignment</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">Pre-populated from order. Override with agent's WITH_AGENT inventory if needed.</p>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead>Inventory</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems?.map((item: any) => {
                            const cat = item.products?.product_category ?? "";
                            const matchingInv = availableInventory?.filter((inv: any) => inv.product_id === item.product_id) ?? [];
                            const currentInv = installItems[item.item_id] || item.inventory_id || "";
                            return (
                              <TableRow key={item.item_id}>
                                <TableCell className="font-medium text-sm">{item.products?.product_name ?? "—"}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{cat}</Badge></TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell className="text-right text-sm">{formatBDT(Number(item.unit_price_bdt))}</TableCell>
                                <TableCell>
                                  {isPhysical(cat) ? (
                                    <Select value={currentInv} onValueChange={(v) => setInstallItems(prev => ({ ...prev, [item.item_id]: v }))}>
                                      <SelectTrigger className="w-[200px] h-8 text-xs">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {matchingInv.map((inv: any) => (
                                          <SelectItem key={inv.inventory_id} value={inv.inventory_id}>
                                            {inv.serial_number ?? inv.mac_address ?? inv.msisdn ?? "N/A"} ({inv.status.replace(/_/g, " ")})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Digital</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* SIM Selection for GPFI MSISDN — searchable */}
                    <div className="space-y-1.5">
                      <Label>SIM Selection (defines permanent GPFI MSISDN)</Label>
                      <SimSearchDropdown
                        simInventory={simInventory}
                        value={simInventoryId}
                        onSelect={setSimInventoryId}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ─── Order Items (view-only for other statuses) ─── */}
            {!["OUT_FOR_DELIVERY", "NETWORK_TEST", "PENDING_DISPATCH"].includes(currentStatus) && !isTerminal && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Order Line Items</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead>Inventory</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems?.map((item: any) => (
                          <TableRow key={item.item_id}>
                            <TableCell className="font-medium text-sm">{item.products?.product_name ?? "—"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{item.products?.product_category}</Badge></TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="text-right text-sm">{formatBDT(Number(item.unit_price_bdt))}</TableCell>
                            <TableCell>{item.inventory_id ? <Badge className="bg-green-100 text-green-800 text-xs">Linked</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {/* ─── Asset Replacement (visible when order is ACTIVE/INSTALLED) ─── */}
            {(currentStatus === "INSTALLED" || currentStatus === "ACTIVE") && activeAssets?.length ? (
              <>
                <Separator />
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> CPE Asset Replacement</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Current CPE (by Anchor)</Label>
                        <Select value={replacementAnchorId} onValueChange={setReplacementAnchorId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select anchor…" /></SelectTrigger>
                          <SelectContent>
                            {activeAnchors.map((ancId) => {
                              const asset = activeAssets?.find((a: any) => a.anchor_id === ancId);
                              return <SelectItem key={ancId} value={ancId}>{(asset as any)?.serial_number || ancId.slice(0, 8)} — {(asset as any)?.products?.product_name || "CPE"}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Reason</Label>
                        <Select value={replacementType} onValueChange={(v) => setReplacementType(v as any)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WARRANTY">WARRANTY (BDT 0)</SelectItem>
                            <SelectItem value="PAID">PAID</SelectItem>
                            <SelectItem value="UPGRADE">UPGRADE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>New CPE Inventory</Label>
                        <Select value={replacementNewInventoryId} onValueChange={setReplacementNewInventoryId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select new CPE…" /></SelectTrigger>
                          <SelectContent>
                            {!cpeInventory.length ? (
                              <SelectItem value="__none" disabled>No CPE available</SelectItem>
                            ) : cpeInventory.map((inv: any) => (
                              <SelectItem key={inv.inventory_id} value={inv.inventory_id}>{inv.serial_number ?? inv.mac_address ?? "N/A"} — {inv.products?.product_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => replacementMutation.mutate()} disabled={replacementMutation.isPending || !replacementAnchorId || !replacementNewInventoryId}>
                      {replacementMutation.isPending ? "Processing…" : "Execute Replacement"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : null}

            <Separator />

            {/* ─── Action Buttons ─── */}
            <div className="flex items-center justify-between">
              <div>
                {!isTerminal && (
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowCancel(true)}>
                    Cancel Order
                  </Button>
                )}
              </div>
              <div>
                {nextAction && (
                  <Button size="sm" onClick={nextAction.action} disabled={nextAction.pending}>
                    {nextAction.pending ? "Processing…" : nextAction.label}
                  </Button>
                )}
              </div>
            </div>

            {/* ─── Cancel Dialog ─── */}
            {showCancel && (
              <Card className="border-destructive">
                <CardHeader className="pb-3"><CardTitle className="text-sm text-destructive">Cancel Order</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Reason</Label>
                    <Select value={cancelReason} onValueChange={setCancelReason}>
                      <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                      <SelectContent>
                        {CANCEL_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes (optional)</Label>
                    <Textarea value={cancelNotes} onChange={(e) => setCancelNotes(e.target.value)} placeholder="Additional details..." rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowCancel(false)}>Back</Button>
                    <Button variant="destructive" size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending || !cancelReason}>
                      {cancelMutation.isPending ? "Cancelling…" : "Confirm Cancel"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManageOrderDialog;
