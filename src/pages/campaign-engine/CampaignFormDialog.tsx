import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  campaign: any | null;
  onClose: () => void;
}

const SCOPES = ["ACQ", "LC", "BOTH"] as const;
const TRIGGERS = ["RULE_BASED", "COUPON_BASED", "REFERRAL_BASED", "HYBRID"] as const;
const OT_BEHAVIORS = ["KEEP", "REMOVE"] as const;

export default function CampaignFormDialog({ open, campaign, onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState<string>("ACQ");
  const [triggerType, setTriggerType] = useState<string>("RULE_BASED");
  const [otBehavior, setOtBehavior] = useState<string>("KEEP");
  const [allowCod, setAllowCod] = useState(true);
  const [allowOnline, setAllowOnline] = useState(true);
  const [campaignRank, setCampaignRank] = useState("100");
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (campaign) {
      setName(campaign.campaign_name);
      setDescription(campaign.description || "");
      setStartDate(campaign.start_date ? campaign.start_date.slice(0, 10) : "");
      setEndDate(campaign.end_date ? campaign.end_date.slice(0, 10) : "");
      setScope(campaign.scope);
      setTriggerType(campaign.campaign_trigger_type);
      setOtBehavior(campaign.on_ownership_transfer_behavior);
      setAllowCod(campaign.allow_cod_payment);
      setAllowOnline(campaign.allow_online_payment);
      setCampaignRank(String(campaign.campaign_rank ?? 100));
    } else {
      setName(""); setDescription(""); setStartDate(""); setEndDate("");
      setScope("ACQ"); setTriggerType("RULE_BASED"); setOtBehavior("KEEP");
      setAllowCod(true); setAllowOnline(true); setCampaignRank("100");
    }
  }, [campaign, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        campaign_name: name,
        description,
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null,
        scope: scope as any,
        campaign_trigger_type: triggerType as any,
        on_ownership_transfer_behavior: otBehavior as any,
        allow_cod_payment: allowCod,
        allow_online_payment: allowOnline,
        campaign_rank: parseInt(campaignRank) || 100,
      };
      if (campaign) {
        const { error } = await supabase.from("campaign_master").update(payload).eq("campaign_id", campaign.campaign_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaign_master").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      onClose();
      toast({ title: campaign ? "Campaign updated" : "Campaign created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canSave = name.trim() && startDate;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{campaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer 2026 Promo" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Campaign description..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid grid-cols-3 gap-4 col-span-2">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trigger Type</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIGGERS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>On Ownership Transfer</Label>
                <Select value={otBehavior} onValueChange={setOtBehavior}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OT_BEHAVIORS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Campaign Rank (Priority)</Label>
            <Input type="number" min="1" value={campaignRank} onChange={(e) => setCampaignRank(e.target.value)} placeholder="Lower = higher priority" />
            <p className="text-xs text-muted-foreground">When multiple campaigns apply, the one with the lowest rank wins. Default: 100.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={allowCod} onCheckedChange={setAllowCod} id="cod" />
              <Label htmlFor="cod">Allow COD</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={allowOnline} onCheckedChange={setAllowOnline} id="online" />
              <Label htmlFor="online">Allow Online Payment</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? "Saving..." : campaign ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
