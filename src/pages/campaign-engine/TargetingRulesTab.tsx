import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelectDropdown, ALL_VALUE } from "@/components/ui/multi-select-dropdown";
import { useToast } from "@/hooks/use-toast";

const NETWORK_TYPES = ["4G", "5G", "ANY"] as const;
const NONE = "__none__";

export default function TargetingRulesTab({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [districtIds, setDistrictIds] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [subChannelIds, setSubChannelIds] = useState<string[]>([]);
  const [networkType, setNetworkType] = useState(NONE);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: zones } = useQuery({ queryKey: ["zones_lookup"], queryFn: async () => { const { data } = await supabase.from("network_zones").select("network_zone_id, network_zone_name").eq("status", true).order("network_zone_name"); return data ?? []; } });
  const { data: allDistricts } = useQuery({ queryKey: ["districts_lookup_full"], queryFn: async () => { const { data } = await supabase.from("districts").select("district_id, district_name").eq("status", true).order("district_name"); return data ?? []; } });
  const { data: allAreas } = useQuery({ queryKey: ["areas_lookup_full"], queryFn: async () => { const { data } = await supabase.from("areas").select("area_id, area_name, district_id, network_zone_id, is_4g_area, is_5g_area").eq("status", true).order("area_name"); return data ?? []; } });
  const { data: channels } = useQuery({ queryKey: ["channels_lookup"], queryFn: async () => { const { data } = await supabase.from("channels").select("channel_id, channel_name").eq("status", true).order("channel_name"); return data ?? []; } });
  const { data: allSubChannels } = useQuery({ queryKey: ["sub_channels_lookup_full"], queryFn: async () => { const { data } = await supabase.from("sub_channels").select("sub_channel_id, sub_channel_name, channel_id").eq("status", true).order("sub_channel_name"); return data ?? []; } });

  // Cascading: filter districts by selected zones (via areas that link zone→district)
  const selectedZoneIds = zoneIds.filter(v => v !== ALL_VALUE);
  const districts = (() => {
    if (!selectedZoneIds.length || zoneIds.includes(ALL_VALUE)) return allDistricts ?? [];
    // Find district IDs that have areas in the selected zones
    const districtIdsInZones = new Set((allAreas ?? []).filter(a => selectedZoneIds.includes(a.network_zone_id)).map(a => a.district_id));
    return (allDistricts ?? []).filter(d => districtIdsInZones.has(d.district_id));
  })();

  // Cascading: filter areas by selected districts (and zones)
  const selectedDistrictIds = districtIds.filter(v => v !== ALL_VALUE);
  const areas = (() => {
    let filtered = allAreas ?? [];
    if (selectedZoneIds.length && !zoneIds.includes(ALL_VALUE)) {
      filtered = filtered.filter(a => selectedZoneIds.includes(a.network_zone_id));
    }
    if (selectedDistrictIds.length && !districtIds.includes(ALL_VALUE)) {
      filtered = filtered.filter(a => selectedDistrictIds.includes(a.district_id));
    }
    return filtered;
  })();

  // Cascading: derive available network types from selected areas
  const selectedAreaIds = areaIds.filter(v => v !== ALL_VALUE);
  const availableNetworkTypes = (() => {
    const relevantAreas = selectedAreaIds.length && !areaIds.includes(ALL_VALUE)
      ? areas.filter(a => selectedAreaIds.includes(a.area_id))
      : areas;
    if (!relevantAreas.length) return NETWORK_TYPES as unknown as string[];
    const has4G = relevantAreas.some(a => a.is_4g_area);
    const has5G = relevantAreas.some(a => a.is_5g_area);
    const types: string[] = [];
    if (has4G) types.push("4G");
    if (has5G) types.push("5G");
    if (has4G || has5G) types.push("ANY");
    return types.length ? types : (NETWORK_TYPES as unknown as string[]);
  })();

  // Cascading: filter sub-channels by selected channels
  const selectedChannelIds = channelIds.filter(v => v !== ALL_VALUE);
  const subChannels = (() => {
    if (!selectedChannelIds.length || channelIds.includes(ALL_VALUE)) return allSubChannels ?? [];
    return (allSubChannels ?? []).filter(sc => selectedChannelIds.includes(sc.channel_id));
  })();

  // Reset children when parent changes
  const handleZoneChange = (vals: string[]) => {
    setZoneIds(vals);
    setDistrictIds([]); setAreaIds([]); setNetworkType(NONE);
  };
  const handleDistrictChange = (vals: string[]) => {
    setDistrictIds(vals);
    setAreaIds([]); setNetworkType(NONE);
  };
  const handleAreaChange = (vals: string[]) => {
    setAreaIds(vals);
    // Reset network type if no longer valid
    if (networkType !== NONE && !availableNetworkTypes.includes(networkType)) {
      setNetworkType(NONE);
    }
  };
  const handleChannelChange = (vals: string[]) => {
    setChannelIds(vals);
    setSubChannelIds([]);
  };

  const { data: rules, isLoading } = useQuery({
    queryKey: ["targeting_rules", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_targeting_rules")
        .select("*, network_zones(network_zone_name), districts(district_name), areas(area_name), channels(channel_name), sub_channels(sub_channel_name)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  // Helper: resolve selected values to actual IDs or null (ALL = wildcard)
  const resolveIds = (selected: string[], allOptions: { value: string }[]) => {
    if (!selected.length) return [null]; // no selection = wildcard
    if (selected.includes(ALL_VALUE)) return [null]; // ALL = wildcard
    return selected;
  };

  const addRule = useMutation({
    mutationFn: async () => {
      const zoneVals = resolveIds(zoneIds, []);
      const districtVals = resolveIds(districtIds, []);
      const areaVals = resolveIds(areaIds, []);
      const channelVals = resolveIds(channelIds, []);
      const subChannelVals = resolveIds(subChannelIds, []);

      // Build rows: cartesian product of all non-null selections
      const rows: any[] = [];
      for (const z of zoneVals) {
        for (const d of districtVals) {
          for (const a of areaVals) {
            for (const ch of channelVals) {
              for (const sc of subChannelVals) {
                const payload: any = { campaign_id: campaignId };
                if (z) payload.network_zone_id = z;
                if (d) payload.district_id = d;
                if (a) payload.area_id = a;
                if (ch) payload.channel_id = ch;
                if (sc) payload.sub_channel_id = sc;
                if (networkType !== NONE) payload.network_type = networkType;
                if (minAge) payload.min_network_age_days = parseInt(minAge);
                if (maxAge) payload.max_network_age_days = parseInt(maxAge);
                rows.push(payload);
              }
            }
          }
        }
      }

      const { error } = await supabase.from("campaign_targeting_rules").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["targeting_rules", campaignId] }); closeDialog(); toast({ title: `Targeting rule${zoneIds.length > 1 || districtIds.length > 1 ? "s" : ""} added` }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("campaign_targeting_rules").delete().eq("rule_id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["targeting_rules", campaignId] }); toast({ title: "Rule removed" }); },
  });

  const closeDialog = () => {
    setOpen(false); setZoneIds([]); setDistrictIds([]); setAreaIds([]);
    setChannelIds([]); setSubChannelIds([]); setNetworkType(NONE); setMinAge(""); setMaxAge("");
  };

  // Summary helper for display
  const summaryLabel = (val: string | null, name: string | undefined) => name ?? "ALL";

  // Build summary for the rule preview
  const buildSummary = () => {
    const parts: string[] = [];
    const summarize = (label: string, selected: string[], options: { value: string; label: string }[]) => {
      if (!selected.length) return;
      if (selected.includes(ALL_VALUE)) {
        parts.push(`${label}: ALL`);
      } else {
        const names = selected.map(v => options.find(o => o.value === v)?.label ?? v);
        parts.push(`${label}: ${names.join(", ")}`);
      }
    };
    summarize("Zone", zoneIds, (zones ?? []).map(z => ({ value: z.network_zone_id, label: z.network_zone_name })));
    summarize("District", districtIds, (districts ?? []).map(d => ({ value: d.district_id, label: d.district_name })));
    summarize("Area", areaIds, (areas ?? []).map(a => ({ value: a.area_id, label: a.area_name })));
    summarize("Channel", channelIds, (channels ?? []).map(c => ({ value: c.channel_id, label: c.channel_name })));
    summarize("Sub-Ch", subChannelIds, (subChannels ?? []).map(sc => ({ value: sc.sub_channel_id, label: sc.sub_channel_name })));
    if (networkType !== NONE) parts.push(`Network: ${networkType}`);
    if (minAge || maxAge) parts.push(`Age: ${minAge || "0"}–${maxAge || "∞"} days`);
    return parts.join(" | ");
  };

  const hasSelection = zoneIds.length > 0 || districtIds.length > 0 || areaIds.length > 0 ||
    channelIds.length > 0 || subChannelIds.length > 0 || networkType !== NONE || minAge || maxAge;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Rule</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Sub-Ch</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Age (days)</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
            ) : !rules?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No targeting rules yet.</TableCell></TableRow>
            ) : rules.map((r: any) => (
              <TableRow key={r.rule_id}>
                <TableCell className="text-xs">
                  {r.network_zones?.network_zone_name
                    ? r.network_zones.network_zone_name
                    : <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ALL</Badge>}
                </TableCell>
                <TableCell className="text-xs">
                  {r.districts?.district_name
                    ? r.districts.district_name
                    : <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ALL</Badge>}
                </TableCell>
                <TableCell className="text-xs">
                  {r.areas?.area_name
                    ? r.areas.area_name
                    : <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ALL</Badge>}
                </TableCell>
                <TableCell className="text-xs">
                  {r.channels?.channel_name
                    ? r.channels.channel_name
                    : <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ALL</Badge>}
                </TableCell>
                <TableCell className="text-xs">
                  {r.sub_channels?.sub_channel_name
                    ? r.sub_channels.sub_channel_name
                    : <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ALL</Badge>}
                </TableCell>
                <TableCell className="text-xs">{r.network_type || "—"}</TableCell>
                <TableCell className="text-xs">{r.min_network_age_days ?? "—"} – {r.max_network_age_days ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule.mutate(r.rule_id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Targeting Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Network Zone</Label>
                 <MultiSelectDropdown
                   options={(zones ?? []).map(z => ({ value: z.network_zone_id, label: z.network_zone_name }))}
                   selected={zoneIds}
                   onChange={handleZoneChange}
                   placeholder="None (ALL)"
                   allLabel="ALL Zones"
                 />
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                 <MultiSelectDropdown
                   options={(districts ?? []).map(d => ({ value: d.district_id, label: d.district_name }))}
                   selected={districtIds}
                   onChange={handleDistrictChange}
                   placeholder="None (ALL)"
                   allLabel="ALL Districts"
                 />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Area</Label>
                <MultiSelectDropdown
                  options={(areas ?? []).map(a => ({ value: a.area_id, label: a.area_name }))}
                  selected={areaIds}
                  onChange={handleAreaChange}
                  placeholder="None (ALL)"
                  allLabel="ALL Areas"
                />
              </div>
              <div className="space-y-2">
                <Label>Network Type</Label>
                <Select value={networkType} onValueChange={setNetworkType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any</SelectItem>
                    {availableNetworkTypes.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                 <MultiSelectDropdown
                   options={(channels ?? []).map(c => ({ value: c.channel_id, label: c.channel_name }))}
                   selected={channelIds}
                   onChange={handleChannelChange}
                   placeholder="None (ALL)"
                   allLabel="ALL Channels"
                 />
              </div>
              <div className="space-y-2">
                <Label>Sub-Channel</Label>
                <MultiSelectDropdown
                  options={(subChannels ?? []).map(sc => ({ value: sc.sub_channel_id, label: sc.sub_channel_name }))}
                  selected={subChannelIds}
                  onChange={setSubChannelIds}
                  placeholder="None (ALL)"
                  allLabel="ALL Sub-Channels"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Network Age (days)</Label>
                <Input type="number" value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="e.g. 0" />
              </div>
              <div className="space-y-2">
                <Label>Max Network Age (days)</Label>
                <Input type="number" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="e.g. 365" />
              </div>
            </div>

            {/* Rule summary preview */}
            {hasSelection && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Rule Summary</p>
                <p className="text-sm">{buildSummary()}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => addRule.mutate()} disabled={addRule.isPending}>{addRule.isPending ? "Adding..." : "Add Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
