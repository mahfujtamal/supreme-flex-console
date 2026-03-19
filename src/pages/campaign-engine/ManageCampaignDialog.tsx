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
  }, []);

  const markSaved = useCallback(() => {
    setDirty(false);
    setRefreshKey(k => k + 1);
  }, []);

  const handleClose = () => {
    if (dirty) setConfirmExit(true);
    else onClose();
  };

  const { data: targetRules } = useQuery({
    queryKey: ["manage_target_summary", campaignId, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_targeting_rules")
        .select("block_id, network_type, network_zones(network_zone_name), districts(district_name), areas(area_name), channels(channel_name), sub_channels(sub_channel_name)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data ?? [];
    },
  });

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

  /* Build per-block summaries, union them with OR */
  const targetSummary = useMemo(() => {
    if (!targetRules?.length) return null;

    // Group by block_id
    const blockMap = new Map<number, any[]>();
    targetRules.forEach((r: any) => {
      const bid = r.block_id ?? 0;
      if (!blockMap.has(bid)) blockMap.set(bid, []);
      blockMap.get(bid)!.push(r);
    });

    return Array.from(blockMap.entries()).sort((a, b) => a[0] - b[0]).map(([blockId, rows]) => {
      const zones = new Set<string>();
      const districts = new Set<string>();
      const areaSet = new Set<string>();
      const channelsSet = new Set<string>();
      const subChannels = new Set<string>();
      const networks = new Set<string>();

      rows.forEach((r: any) => {
        if (r.network_zones?.network_zone_name) zones.add(r.network_zones.network_zone_name);
        if (r.districts?.district_name) districts.add(r.districts.district_name);
        if (r.areas?.area_name) areaSet.add(r.areas.area_name);
        if (r.channels?.channel_name) channelsSet.add(r.channels.channel_name);
        if (r.sub_channels?.sub_channel_name) subChannels.add(r.sub_channels.sub_channel_name);
        if (r.network_type) networks.add(r.network_type);
      });

      const parts: { label: string; values: string[] }[] = [];
      if (zones.size) parts.push({ label: "Zone", values: Array.from(zones) });
      if (districts.size) parts.push({ label: "District", values: Array.from(districts) });
      if (areaSet.size) parts.push({ label: "Area", values: Array.from(areaSet) });
      if (channelsSet.size) parts.push({ label: "Channel", values: Array.from(channelsSet) });
      if (subChannels.size) parts.push({ label: "Sub-Ch", values: Array.from(subChannels) });
      if (networks.size) parts.push({ label: "Network", values: Array.from(networks) });

      return { blockId, parts };
    });
  }, [targetRules]);

  const networkWarning = useMemo(() => {
    if (!targetRules?.length || !productRules?.length) return null;
    const targetNetworks = new Set<string>();
    targetRules.forEach((r: any) => { if (r.network_type) targetNetworks.add(r.network_type); });
    if (targetNetworks.has("ANY") || (targetNetworks.has("4G") && targetNetworks.has("5G"))) return null;
    const target4G = targetNetworks.has("4G");
    const target5G = targetNetworks.has("5G");

    const conflicts: string[] = [];
    productRules.forEach((r: any) => {
      if (r.rule_type === "UNAVAILABLE") return;
      const cap = r.products?.network_capability;
      if (!cap || cap === "ANY" || cap === "BOTH") return;
      if (cap === "5G" && target4G && !target5G) conflicts.push(r.products.product_name);
      if (cap === "4G" && target5G && !target4G) conflicts.push(r.products.product_name);
    });
    if (!conflicts.length) return null;
    return `Some targeted customers will not be able to use the selected hardware: ${conflicts.join(", ")}. Product network capability doesn't match the target group.`;
  }, [targetRules, productRules]);

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage Campaign Rules</DialogTitle></DialogHeader>

          {targetSummary && targetSummary.length > 0 && (
            <div className="rounded-md bg-muted/50 border p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Summary (Blocks joined by OR)</p>
              {targetSummary.map((block, bi) => (
                <div key={block.blockId}>
                  {bi > 0 && (
                    <div className="flex justify-center my-1">
                      <Badge variant="outline" className="bg-background text-[10px] font-bold">OR</Badge>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 rounded border bg-background/50 px-2 py-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground mr-1">Block {bi + 1}:</span>
                    {block.parts.map((part, pi) => (
                      <span key={part.label} className="flex items-center gap-1">
                        {pi > 0 && <span className="text-xs font-bold text-muted-foreground mx-0.5">·</span>}
                        <span className="text-[10px] text-muted-foreground font-medium">{part.label}:</span>
                        {part.values.map(v => (
                          <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">{v}</Badge>
                        ))}
                      </span>
                    ))}
                    {block.parts.length === 0 && <span className="text-[10px] text-muted-foreground italic">All (no filters)</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {networkWarning && (
            <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">{networkWarning}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="targeting" className="mt-2">
            <TabsList>
              <TabsTrigger value="targeting">Targeting Rules</TabsTrigger>
              <TabsTrigger value="products">Product Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="targeting">
              <TargetingRulesTab campaignId={campaignId} campaignScope={campaignScope} onDirty={markDirty} onSaved={markSaved} />
            </TabsContent>
            <TabsContent value="products">
              <ProductRulesTab campaignId={campaignId} onDirty={markDirty} onSaved={markSaved} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Are you sure you want to exit?</AlertDialogDescription>
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
