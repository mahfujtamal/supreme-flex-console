import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatBDT } from "@/lib/currency";

const PAGE_SIZE = 10;

const PRODUCT_CATEGORY_OPTIONS = ["WIFI_PLAN", "CPE", "PHYSICAL_ADDON", "DIGITAL_ADDON", "ANY"] as const;

export default function ReferralProgramsTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [campaignId, setCampaignId] = useState("");
  const [maxReferrals, setMaxReferrals] = useState("-1");
  const [globalLimit, setGlobalLimit] = useState("-1");
  const [discountType, setDiscountType] = useState<string>("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const [billingCycles, setBillingCycles] = useState("1");
  const [productCategory, setProductCategory] = useState<string>("WIFI_PLAN");

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-referral-eligible"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_master")
        .select("campaign_id, campaign_name, campaign_trigger_type")
        .in("campaign_trigger_type", ["REFERRAL_BASED", "HYBRID"])
        .eq("status", true)
        .order("campaign_name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["referral-programs", page, search],
    queryFn: async () => {
      let q = supabase
        .from("referral_programs")
        .select("*, campaign_master(campaign_name)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search) q = q.ilike("campaign_master.campaign_name", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        campaign_id: campaignId,
        max_referrals_per_customer: parseInt(maxReferrals),
        global_referral_limit: parseInt(globalLimit),
        referrer_discount_type: discountType,
        referrer_discount_value: parseFloat(discountValue),
        referrer_reward_billing_cycles: parseInt(billingCycles),
        referrer_applicable_product_category: productCategory,
      };
      if (editItem) {
        const { error } = await supabase.from("referral_programs").update(payload).eq("referral_program_id", editItem.referral_program_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("referral_programs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editItem ? "Program updated" : "Program created" });
      qc.invalidateQueries({ queryKey: ["referral-programs"] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("referral_programs").update({ status: !status }).eq("referral_program_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referral-programs"] }),
  });

  function openCreate() {
    setEditItem(null);
    setCampaignId("");
    setMaxReferrals("-1");
    setGlobalLimit("-1");
    setDiscountType("FLAT");
    setDiscountValue("");
    setDurationMonths("1");
    setProductType("WIFI_PLAN");
    setDialogOpen(true);
  }

  function openEdit(r: any) {
    setEditItem(r);
    setCampaignId(r.campaign_id);
    setMaxReferrals(String(r.max_referrals_per_customer));
    setGlobalLimit(String(r.global_referral_limit));
    setDiscountType(r.referrer_discount_type);
    setDiscountValue(String(r.referrer_discount_value));
    setDurationMonths(String(r.referrer_reward_duration_months));
    setProductType(r.referrer_applicable_product_type);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
  }

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search programs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Create Referral Program</Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead className="w-[100px]">Discount</TableHead>
              <TableHead className="w-[90px] text-center">Duration</TableHead>
              <TableHead className="w-[100px]">Product Type</TableHead>
              <TableHead className="w-[90px] text-center">Per User</TableHead>
              <TableHead className="w-[90px] text-center">Global</TableHead>
              <TableHead className="w-[80px] text-center">Used</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No referral programs found.</TableCell></TableRow>
            ) : data.items.map((r: any) => (
              <TableRow key={r.referral_program_id}>
                <TableCell className="font-medium text-sm">{r.campaign_master?.campaign_name ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {r.referrer_discount_type === "FLAT"
                    ? formatBDT(r.referrer_discount_value)
                    : `${r.referrer_discount_value}%`}
                </TableCell>
                <TableCell className="text-center text-sm">{r.referrer_reward_duration_months} mo</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{r.referrer_applicable_product_type}</Badge></TableCell>
                <TableCell className="text-center text-sm">{r.max_referrals_per_customer === -1 ? "∞" : r.max_referrals_per_customer}</TableCell>
                <TableCell className="text-center text-sm">{r.global_referral_limit === -1 ? "∞" : r.global_referral_limit}</TableCell>
                <TableCell className="text-center text-sm">{r.current_global_referrals}</TableCell>
                <TableCell>
                  <Badge variant={r.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: r.referral_program_id, status: r.status })}>
                    {r.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Referral Program" : "Create Referral Program"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Campaign *</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent>
                  {campaigns?.map((c) => (
                    <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name} ({c.campaign_trigger_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount Type *</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">Flat (BDT)</SelectItem>
                    <SelectItem value="PERCENT">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Discount Value *</Label>
                <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="e.g. 100" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reward Duration (months) *</Label>
                <Input type="number" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} min="1" />
              </div>
              <div>
                <Label>Applicable Product Type *</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Referrals / Customer</Label>
                <Input type="number" value={maxReferrals} onChange={(e) => setMaxReferrals(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">-1 = unlimited</p>
              </div>
              <div>
                <Label>Global Referral Limit</Label>
                <Input type="number" value={globalLimit} onChange={(e) => setGlobalLimit(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">-1 = unlimited</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!campaignId || !discountValue || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
