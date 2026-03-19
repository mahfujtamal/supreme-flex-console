import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TargetingRulesTab from "./TargetingRulesTab";
import ProductRulesTab from "./ProductRulesTab";

interface Props {
  campaignId: string;
  campaignScope: string;
  onClose: () => void;
}

export default function ManageCampaignDialog({ campaignId, campaignScope, onClose }: Props) {
  const [dirty, setDirty] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const markDirty = useCallback(() => {
    setDirty(true);
    setRefreshKey(k => k + 1);
  }, []);

  const handleClose = () => {
    if (dirty) {
      setConfirmExit(true);
    } else {
      onClose();
    }
  };

  /* ── Fetch targeting rules for summary tags ── */
  const { data: targetRules } = useQuery({
    queryKey: ["manage_target_summary", campaignId, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_targeting_rules")
        .select("network_type, network_zones(network_zone_name), districts(district_name), areas(area_name), channels(channel_name), sub_channels(sub_channel_name)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ── Fetch product rules for cross-validation ── */
  const { data: productRules } = useQuery({
    queryKey: ["manage_product_summary", campaignId, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_product_rules")
        .select("rule_type, products(product_name, network_capability)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ── Build consolidated target summary tags — hierarchical display ── */
  const targetSummary = useMemo(() => {
    if (!targetRules?.length) return null;
    const zones = new Set<string>();
    const districts = new Set<string>();
    const areas = new Set<string>();
    const channels = new Set<string>();
    const subChannels = new Set<string>();
    const networks = new Set<string>();

    targetRules.forEach((r: any) => {
      if (r.network_zones?.network_zone_name) zones.add(r.network_zones.network_zone_name);
      if (r.districts?.district_name) districts.add(r.districts.district_name);
      if (r.areas?.area_name) areas.add(r.areas.area_name);
      if (r.channels?.channel_name) channels.add(r.channels.channel_name);
      if (r.sub_channels?.sub_channel_name) subChannels.add(r.sub_channels.sub_channel_name);
      if (r.network_type) networks.add(r.network_type);
    });

    // Build hierarchical groups: Geography (Zone > District > Area) | Distribution (Channel > Sub-Ch) | Network
    const hierarchies: { parts: { label: string; values: string[] }[] }[] = [];

    // Geography hierarchy
    const geoParts: { label: string; values: string[] }[] = [];
    if (zones.size) geoParts.push({ label: "Zone", values: Array.from(zones) });
    if (districts.size) geoParts.push({ label: "District", values: Array.from(districts) });
    if (areas.size) geoParts.push({ label: "Area", values: Array.from(areas) });
    if (geoParts.length) hierarchies.push({ parts: geoParts });

    // Distribution hierarchy
    const distParts: { label: string; values: string[] }[] = [];
    if (channels.size) distParts.push({ label: "Channel", values: Array.from(channels) });
    if (subChannels.size) distParts.push({ label: "Sub-Ch", values: Array.from(subChannels) });
    if (distParts.length) hierarchies.push({ parts: distParts });

    // Network
    if (networks.size) hierarchies.push({ parts: [{ label: "Network", values: Array.from(networks) }] });

    return hierarchies;
  }, [targetRules]);

  /* ── Cross-validation: product vs target network mismatch ── */
  const networkWarning = useMemo(() => {
    if (!targetRules?.length || !productRules?.length) return null;

    const targetNetworks = new Set<string>();
    targetRules.forEach((r: any) => {
      if (r.network_type) targetNetworks.add(r.network_type);
    });

    // If target includes ANY or both 4G+5G, no conflict possible
    if (targetNetworks.has("ANY") || (targetNetworks.has("4G") && targetNetworks.has("5G"))) return null;
    const target4G = targetNetworks.has("4G");
    const target5G = targetNetworks.has("5G");

    const conflicts: string[] = [];
    productRules.forEach((r: any) => {
      if (r.rule_type === "UNAVAILABLE") return;
      const cap = r.products?.network_capability;
      if (!cap || cap === "ANY" || cap === "BOTH") return;
      // Product is 5G-only but target is 4G-only
      if (cap === "5G" && target4G && !target5G) {
        conflicts.push(r.products.product_name);
      }
      // Product is 4G-only but target is 5G-only
      if (cap === "4G" && target5G && !target4G) {
        conflicts.push(r.products.product_name);
      }
    });

    if (!conflicts.length) return null;
    return `Some targeted customers will not be able to use the selected hardware: ${conflicts.join(", ")}. Product network capability doesn't match the target group.`;
  }, [targetRules, productRules]);

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage Campaign Rules</DialogTitle></DialogHeader>

          {/* ── Target Summary Tags ── */}
          {targetSummary && targetSummary.length > 0 && (
            <div className="rounded-md bg-muted/50 border p-3 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Summary (OR within group, AND across groups)</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {targetSummary.map((group, gi) => (
                  <span key={group.label} className="flex items-center gap-1">
                    {gi > 0 && <span className="text-xs font-bold text-muted-foreground mx-1">|</span>}
                    <span className="text-[10px] text-muted-foreground font-medium mr-0.5">{group.label}:</span>
                    {group.values.map(v => (
                      <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">{v}</Badge>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Cross-validation warning ── */}
          {networkWarning && (
            <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                {networkWarning}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="targeting" className="mt-2">
            <TabsList>
              <TabsTrigger value="targeting">Targeting Rules</TabsTrigger>
              <TabsTrigger value="products">Product Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="targeting">
              <TargetingRulesTab campaignId={campaignId} campaignScope={campaignScope} onDirty={markDirty} />
            </TabsContent>
            <TabsContent value="products">
              <ProductRulesTab campaignId={campaignId} onDirty={markDirty} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to exit? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Discard & Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
