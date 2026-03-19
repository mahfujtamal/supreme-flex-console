import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface ConsolidatedBlock {
  blockId: number;
  zones: { id: string; name: string }[];
  districts: { id: string; name: string }[];
  areas: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  subChannels: { id: string; name: string }[];
  networks: string[];
  minAge: number | null;
  maxAge: number | null;
}

export default function TargetingRulesTab({ campaignId, campaignScope, onDirty }: { campaignId: string; campaignScope: string; onDirty?: () => void }) {
  const isAcq = campaignScope === "ACQ";
  const [open, setOpen] = useState(false);
  const [editBlockId, setEditBlockId] = useState<number | null>(null);
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

  // Lookups
  const { data: zones } = useQuery({ queryKey: ["zones_lookup"], queryFn: async () => { const { data } = await supabase.from("network_zones").select("network_zone_id, network_zone_name").eq("status", true).order("network_zone_name"); return data ?? []; } });
  const { data: allDistricts } = useQuery({ queryKey: ["districts_lookup_full"], queryFn: async () => { const { data } = await supabase.from("districts").select("district_id, district_name").eq("status", true).order("district_name"); return data ?? []; } });
  const { data: allAreas } = useQuery({ queryKey: ["areas_lookup_full"], queryFn: async () => { const { data } = await supabase.from("areas").select("area_id, area_name, district_id, network_zone_id, is_4g_area, is_5g_area").eq("status", true).order("area_name"); return data ?? []; } });
  const { data: channels } = useQuery({ queryKey: ["channels_lookup"], queryFn: async () => { const { data } = await supabase.from("channels").select("channel_id, channel_name").eq("status", true).order("channel_name"); return data ?? []; } });
  const { data: allSubChannels } = useQuery({ queryKey: ["sub_channels_lookup_full"], queryFn: async () => { const { data } = await supabase.from("sub_channels").select("sub_channel_id, sub_channel_name, channel_id").eq("status", true).order("sub_channel_name"); return data ?? []; } });

  // Cascading filters
  const networkFilteredAreas = (() => {
    const all = allAreas ?? [];
    if (networkType === NONE || networkType === "ANY") return all;
    if (networkType === "4G") return all.filter(a => a.is_4g_area);
    if (networkType === "5G") return all.filter(a => a.is_5g_area);
    return all;
  })();

  const filteredZones = (() => {
    const allZones = zones ?? [];
    if (networkType === NONE || networkType === "ANY") return allZones;
    const zoneIdsWithCoverage = new Set(networkFilteredAreas.map(a => a.network_zone_id));
    return allZones.filter(z => zoneIdsWithCoverage.has(z.network_zone_id));
  })();

  const selectedZoneIds = zoneIds.filter(v => v !== ALL_VALUE);
  const districts = (() => {
    let relevantAreas = networkFilteredAreas;
    if (selectedZoneIds.length && !zoneIds.includes(ALL_VALUE)) {
      relevantAreas = relevantAreas.filter(a => selectedZoneIds.includes(a.network_zone_id));
    }
    const districtIdsWithCoverage = new Set(relevantAreas.map(a => a.district_id));
    return (allDistricts ?? []).filter(d => districtIdsWithCoverage.has(d.district_id));
  })();

  const selectedDistrictIds = districtIds.filter(v => v !== ALL_VALUE);
  const areas = (() => {
    let filtered = networkFilteredAreas;
    if (selectedZoneIds.length && !zoneIds.includes(ALL_VALUE)) {
      filtered = filtered.filter(a => selectedZoneIds.includes(a.network_zone_id));
    }
    if (selectedDistrictIds.length && !districtIds.includes(ALL_VALUE)) {
      filtered = filtered.filter(a => selectedDistrictIds.includes(a.district_id));
    }
    return filtered;
  })();

  const selectedChannelIds = channelIds.filter(v => v !== ALL_VALUE);
  const subChannels = (() => {
    if (!selectedChannelIds.length || channelIds.includes(ALL_VALUE)) return allSubChannels ?? [];
    return (allSubChannels ?? []).filter(sc => selectedChannelIds.includes(sc.channel_id));
  })();

  const channelSelected = channelIds.length > 0;

  const handleNetworkTypeChange = (val: string) => { setNetworkType(val); setZoneIds([]); setDistrictIds([]); setAreaIds([]); setChannelIds([]); setSubChannelIds([]); };
  const handleZoneChange = (vals: string[]) => { setZoneIds(vals); setDistrictIds([]); setAreaIds([]); };
  const handleDistrictChange = (vals: string[]) => { setDistrictIds(vals); setAreaIds([]); };
  const handleChannelChange = (vals: string[]) => { setChannelIds(vals); setSubChannelIds([]); };

  // Fetch existing rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ["targeting_rules", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_targeting_rules")
        .select("*, network_zones(network_zone_name), districts(district_name), areas(area_name), channels(channel_name), sub_channels(sub_channel_name)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group rules by block_id into consolidated blocks
  const blocks: ConsolidatedBlock[] = useMemo(() => {
    if (!rules?.length) return [];
    const blockMap = new Map<number, any[]>();
    rules.forEach((r: any) => {
      const bid = r.block_id ?? 0;
      if (!blockMap.has(bid)) blockMap.set(bid, []);
      blockMap.get(bid)!.push(r);
    });

    return Array.from(blockMap.entries()).map(([blockId, rows]) => {
      const zoneMap = new Map<string, string>();
      const districtMap = new Map<string, string>();
      const areaMap = new Map<string, string>();
      const channelMap = new Map<string, string>();
      const subChannelMap = new Map<string, string>();
      const networkSet = new Set<string>();
      let minAgeVal: number | null = null;
      let maxAgeVal: number | null = null;

      rows.forEach((r: any) => {
        if (r.network_zone_id && r.network_zones?.network_zone_name) zoneMap.set(r.network_zone_id, r.network_zones.network_zone_name);
        if (r.district_id && r.districts?.district_name) districtMap.set(r.district_id, r.districts.district_name);
        if (r.area_id && r.areas?.area_name) areaMap.set(r.area_id, r.areas.area_name);
        if (r.channel_id && r.channels?.channel_name) channelMap.set(r.channel_id, r.channels.channel_name);
        if (r.sub_channel_id && r.sub_channels?.sub_channel_name) subChannelMap.set(r.sub_channel_id, r.sub_channels.sub_channel_name);
        if (r.network_type) networkSet.add(r.network_type);
        if (r.min_network_age_days != null) minAgeVal = r.min_network_age_days;
        if (r.max_network_age_days != null) maxAgeVal = r.max_network_age_days;
      });

      return {
        blockId,
        zones: Array.from(zoneMap.entries()).map(([id, name]) => ({ id, name })),
        districts: Array.from(districtMap.entries()).map(([id, name]) => ({ id, name })),
        areas: Array.from(areaMap.entries()).map(([id, name]) => ({ id, name })),
        channels: Array.from(channelMap.entries()).map(([id, name]) => ({ id, name })),
        subChannels: Array.from(subChannelMap.entries()).map(([id, name]) => ({ id, name })),
        networks: Array.from(networkSet),
        minAge: minAgeVal,
        maxAge: maxAgeVal,
      };
    }).sort((a, b) => a.blockId - b.blockId);
  }, [rules]);

  const nextBlockId = blocks.length ? Math.max(...blocks.map(b => b.blockId)) + 1 : 0;

  const resolveIds = (selected: string[]) => {
    if (!selected.length) return [null];
    if (selected.includes(ALL_VALUE)) return [null];
    return selected;
  };

  // Save a single block: delete rows for that block_id, re-insert
  const saveBlock = useMutation({
    mutationFn: async (blockId: number) => {
      // Delete existing rows for this block
      await supabase.from("campaign_targeting_rules").delete().eq("campaign_id", campaignId).eq("block_id", blockId);

      const zoneVals = resolveIds(zoneIds);
      const districtVals = resolveIds(districtIds);
      const areaVals = resolveIds(areaIds);
      const channelVals = resolveIds(channelIds);
      const subChannelVals = resolveIds(subChannelIds);

      const rows: any[] = [];
      for (const z of zoneVals) {
        for (const d of districtVals) {
          for (const a of areaVals) {
            for (const ch of channelVals) {
              for (const sc of subChannelVals) {
                const payload: any = { campaign_id: campaignId, block_id: blockId };
                if (z) payload.network_zone_id = z;
                if (d) payload.district_id = d;
                if (a) payload.area_id = a;
                if (ch) payload.channel_id = ch;
                if (sc) payload.sub_channel_id = sc;
                if (networkType !== NONE) payload.network_type = networkType;
                if (isAcq) {
                  payload.min_network_age_days = 0;
                  payload.max_network_age_days = 0;
                } else {
                  if (minAge) payload.min_network_age_days = parseInt(minAge);
                  if (maxAge) payload.max_network_age_days = parseInt(maxAge);
                }
                rows.push(payload);
              }
            }
          }
        }
      }

      if (rows.length) {
        const { error } = await supabase.from("campaign_targeting_rules").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["targeting_rules", campaignId] });
      closeDialog();
      onDirty?.();
      toast({ title: editBlockId !== null ? "Target block updated" : "Target block added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBlock = useMutation({
    mutationFn: async (blockId: number) => {
      const { error } = await supabase.from("campaign_targeting_rules").delete().eq("campaign_id", campaignId).eq("block_id", blockId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["targeting_rules", campaignId] });
      onDirty?.();
      toast({ title: "Target block removed" });
    },
  });

  const deleteAllRules = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campaign_targeting_rules").delete().eq("campaign_id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["targeting_rules", campaignId] }); onDirty?.(); toast({ title: "All targeting rules removed" }); },
  });

  const closeDialog = () => {
    setOpen(false); setEditBlockId(null); setZoneIds([]); setDistrictIds([]); setAreaIds([]);
    setChannelIds([]); setSubChannelIds([]); setNetworkType(NONE); setMinAge(""); setMaxAge("");
  };

  const openEditBlock = (block: ConsolidatedBlock) => {
    setEditBlockId(block.blockId);
    setZoneIds(block.zones.map(z => z.id));
    setDistrictIds(block.districts.map(d => d.id));
    setAreaIds(block.areas.map(a => a.id));
    setChannelIds(block.channels.map(c => c.id));
    setSubChannelIds(block.subChannels.map(sc => sc.id));
    setNetworkType(block.networks.length ? block.networks[0] : NONE);
    setMinAge(block.minAge != null ? String(block.minAge) : "");
    setMaxAge(block.maxAge != null ? String(block.maxAge) : "");
    setOpen(true);
  };

  const openAddBlock = () => {
    setEditBlockId(null);
    setOpen(true);
  };

  const hasSelection = zoneIds.length > 0 || districtIds.length > 0 || areaIds.length > 0 ||
    channelIds.length > 0 || subChannelIds.length > 0 || networkType !== NONE || minAge || maxAge;

  const buildSummary = () => {
    const parts: string[] = [];
    const summarize = (label: string, selected: string[], options: { value: string; label: string }[]) => {
      if (!selected.length) return;
      if (selected.includes(ALL_VALUE)) { parts.push(`${label}: ALL`); return; }
      const names = selected.map(v => options.find(o => o.value === v)?.label ?? v);
      parts.push(`${label}: ${names.join(", ")}`);
    };
    summarize("Zone", zoneIds, (filteredZones ?? []).map(z => ({ value: z.network_zone_id, label: z.network_zone_name })));
    summarize("District", districtIds, (districts ?? []).map(d => ({ value: d.district_id, label: d.district_name })));
    summarize("Area", areaIds, (areas ?? []).map(a => ({ value: a.area_id, label: a.area_name })));
    summarize("Channel", channelIds, (channels ?? []).map(c => ({ value: c.channel_id, label: c.channel_name })));
    summarize("Sub-Ch", subChannelIds, (subChannels ?? []).map(sc => ({ value: sc.sub_channel_id, label: sc.sub_channel_name })));
    if (networkType !== NONE) parts.push(`Network: ${networkType}`);
    if (!isAcq && (minAge || maxAge)) parts.push(`Age: ${minAge || "0"}–${maxAge || "∞"} days`);
    if (isAcq) parts.push("Age: 0 (ACQ)");
    return parts.join(" | ");
  };

  const TagGroup = ({ label, items }: { label: string; items: { id: string; name: string }[] }) => {
    if (!items.length) return null;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}:</span>
        {items.map(item => (
          <Badge key={item.id} variant="secondary" className="text-xs px-2 py-0.5">{item.name}</Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end gap-2">
        {blocks.length > 0 && (
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteAllRules.mutate()}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Clear All
          </Button>
        )}
        <Button size="sm" onClick={openAddBlock}><Plus className="h-4 w-4 mr-1.5" />Add Target Block</Button>
      </div>

      {isLoading ? (
        <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">Loading...</div>
      ) : !blocks.length ? (
        <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
          No targeting rules yet. Add a target block to define audience criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, idx) => (
            <div key={block.blockId} className="border rounded-lg p-4 space-y-3 bg-card">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Target Block {idx + 1} <span className="normal-case font-normal">(OR within category, AND across)</span>
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBlock(block)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteBlock.mutate(block.blockId)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <TagGroup label="Zone" items={block.zones} />
                  <TagGroup label="District" items={block.districts} />
                  <TagGroup label="Area" items={block.areas} />
                </div>

                {(block.zones.length > 0 || block.districts.length > 0 || block.areas.length > 0) &&
                 (block.channels.length > 0 || block.subChannels.length > 0) && (
                  <div className="border-t my-1" />
                )}

                <div className="space-y-1">
                  <TagGroup label="Channel" items={block.channels} />
                  <TagGroup label="Sub-Channel" items={block.subChannels} />
                </div>

                {(block.networks.length > 0 || block.minAge != null) && (
                  <>
                    <div className="border-t my-1" />
                    <div className="flex items-center gap-3 flex-wrap">
                      {block.networks.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Network:</span>
                          {block.networks.map(n => <Badge key={n} variant="secondary" className="text-xs px-2 py-0.5">{n}</Badge>)}
                        </div>
                      )}
                      {block.minAge != null && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Age:</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">{block.minAge}–{block.maxAge ?? "∞"} days</Badge>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!block.zones.length && !block.districts.length && !block.areas.length &&
                 !block.channels.length && !block.subChannels.length && !block.networks.length && (
                  <p className="text-xs text-muted-foreground italic">All geography, channels, and networks (no filters applied)</p>
                )}
              </div>

              {idx < blocks.length - 1 && (
                <div className="flex justify-center -mb-6 relative z-10">
                  <Badge variant="outline" className="bg-background text-xs font-bold">OR</Badge>
                </div>
              )}
            </div>
          ))}

          <Button size="sm" variant="outline" className="w-full" onClick={openAddBlock}>
            <Plus className="h-4 w-4 mr-1.5" />Add Another Target Block
          </Button>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editBlockId !== null ? `Edit Target Block` : `Add Target Block ${blocks.length + 1}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Network Type</Label>
                <Select value={networkType} onValueChange={handleNetworkTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any</SelectItem>
                    {NETWORK_TYPES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Network Zone</Label>
                <MultiSelectDropdown
                  options={(filteredZones ?? []).map(z => ({ value: z.network_zone_id, label: z.network_zone_name }))}
                  selected={zoneIds} onChange={handleZoneChange} placeholder="None (ALL)" allLabel="ALL Zones"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>District</Label>
                <MultiSelectDropdown
                  options={(districts ?? []).map(d => ({ value: d.district_id, label: d.district_name }))}
                  selected={districtIds} onChange={handleDistrictChange} placeholder="None (ALL)" allLabel="ALL Districts"
                />
              </div>
              <div className="space-y-2">
                <Label>Area</Label>
                <MultiSelectDropdown
                  options={(areas ?? []).map(a => ({ value: a.area_id, label: a.area_name }))}
                  selected={areaIds} onChange={(vals) => setAreaIds(vals)} placeholder="None (ALL)" allLabel="ALL Areas"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <MultiSelectDropdown
                  options={(channels ?? []).map(c => ({ value: c.channel_id, label: c.channel_name }))}
                  selected={channelIds} onChange={handleChannelChange} placeholder="None (ALL)" allLabel="ALL Channels"
                />
              </div>
              <div className="space-y-2">
                <Label className={!channelSelected ? "text-muted-foreground" : ""}>Sub-Channel</Label>
                <MultiSelectDropdown
                  options={(subChannels ?? []).map(sc => ({ value: sc.sub_channel_id, label: sc.sub_channel_name }))}
                  selected={subChannelIds} onChange={setSubChannelIds}
                  placeholder={channelSelected ? "None (ALL)" : "Select Channel first"}
                  allLabel="ALL Sub-Channels" disabled={!channelSelected}
                />
              </div>
            </div>
            {!isAcq && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Network Age (days) <span className="text-destructive">*</span></Label>
                  <Input type="number" value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="e.g. 0" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Max Network Age (days) <span className="text-destructive">*</span></Label>
                  <Input type="number" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="e.g. 365" min="0" />
                </div>
              </div>
            )}

            {hasSelection && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Rule Summary (OR within category, AND across)</p>
                <p className="text-sm">{buildSummary()}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={() => {
                if (!isAcq && (!minAge || !maxAge)) {
                  toast({ title: "Network Age required", description: "Min and Max Network Age are mandatory for Base Management campaigns.", variant: "destructive" });
                  return;
                }
                const bid = editBlockId !== null ? editBlockId : nextBlockId;
                saveBlock.mutate(bid);
              }}
              disabled={saveBlock.isPending}
            >
              {saveBlock.isPending ? "Saving..." : editBlockId !== null ? "Update Block" : "Add Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
