import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const NETWORK_TYPES = ["4G", "5G", "ANY"] as const;
const NONE = "__none__";

export default function TargetingRulesTab({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [zoneId, setZoneId] = useState(NONE);
  const [districtId, setDistrictId] = useState(NONE);
  const [areaId, setAreaId] = useState(NONE);
  const [channelId, setChannelId] = useState(NONE);
  const [subChannelId, setSubChannelId] = useState(NONE);
  const [networkType, setNetworkType] = useState(NONE);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: zones } = useQuery({ queryKey: ["zones_lookup"], queryFn: async () => { const { data } = await supabase.from("network_zones").select("network_zone_id, network_zone_name").eq("status", true).order("network_zone_name"); return data ?? []; } });
  const { data: districts } = useQuery({ queryKey: ["districts_lookup"], queryFn: async () => { const { data } = await supabase.from("districts").select("district_id, district_name").eq("status", true).order("district_name"); return data ?? []; } });
  const { data: areas } = useQuery({ queryKey: ["areas_lookup"], queryFn: async () => { const { data } = await supabase.from("areas").select("area_id, area_name").eq("status", true).order("area_name"); return data ?? []; } });
  const { data: channels } = useQuery({ queryKey: ["channels_lookup"], queryFn: async () => { const { data } = await supabase.from("channels").select("channel_id, channel_name").eq("status", true).order("channel_name"); return data ?? []; } });
  const { data: subChannels } = useQuery({ queryKey: ["sub_channels_lookup"], queryFn: async () => { const { data } = await supabase.from("sub_channels").select("sub_channel_id, sub_channel_name").eq("status", true).order("sub_channel_name"); return data ?? []; } });

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

  const addRule = useMutation({
    mutationFn: async () => {
      const payload: any = { campaign_id: campaignId };
      if (zoneId !== NONE) payload.network_zone_id = zoneId;
      if (districtId !== NONE) payload.district_id = districtId;
      if (areaId !== NONE) payload.area_id = areaId;
      if (channelId !== NONE) payload.channel_id = channelId;
      if (subChannelId !== NONE) payload.sub_channel_id = subChannelId;
      if (networkType !== NONE) payload.network_type = networkType;
      if (minAge) payload.min_network_age_days = parseInt(minAge);
      if (maxAge) payload.max_network_age_days = parseInt(maxAge);
      const { error } = await supabase.from("campaign_targeting_rules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["targeting_rules", campaignId] }); closeDialog(); toast({ title: "Targeting rule added" }); },
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
    setOpen(false); setZoneId(NONE); setDistrictId(NONE); setAreaId(NONE);
    setChannelId(NONE); setSubChannelId(NONE); setNetworkType(NONE); setMinAge(""); setMaxAge("");
  };

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
                <TableCell className="text-xs">{r.network_zones?.network_zone_name || "—"}</TableCell>
                <TableCell className="text-xs">{r.districts?.district_name || "—"}</TableCell>
                <TableCell className="text-xs">{r.areas?.area_name || "—"}</TableCell>
                <TableCell className="text-xs">{r.channels?.channel_name || "—"}</TableCell>
                <TableCell className="text-xs">{r.sub_channels?.sub_channel_name || "—"}</TableCell>
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
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {zones?.map(z => <SelectItem key={z.network_zone_id} value={z.network_zone_id}>{z.network_zone_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Select value={districtId} onValueChange={setDistrictId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {districts?.map(d => <SelectItem key={d.district_id} value={d.district_id}>{d.district_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Area</Label>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {areas?.map(a => <SelectItem key={a.area_id} value={a.area_id}>{a.area_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {channels?.map(c => <SelectItem key={c.channel_id} value={c.channel_id}>{c.channel_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sub-Channel</Label>
                <Select value={subChannelId} onValueChange={setSubChannelId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {subChannels?.map(sc => <SelectItem key={sc.sub_channel_id} value={sc.sub_channel_id}>{sc.sub_channel_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Network Type</Label>
                <Select value={networkType} onValueChange={setNetworkType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any</SelectItem>
                    {NETWORK_TYPES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
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
