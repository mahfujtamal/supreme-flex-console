import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarDays, Plus, Search } from "lucide-react";
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

const PAGE_SIZE = 10;

export default function CouponManagementTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<any>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [campaignId, setCampaignId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("-1");
  const [globalUsageLimit, setGlobalUsageLimit] = useState("-1");

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-coupon-eligible"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_master")
        .select("campaign_id, campaign_name, campaign_trigger_type")
        .in("campaign_trigger_type", ["COUPON_BASED", "HYBRID"])
        .eq("status", true)
        .order("campaign_name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["coupons", page, search],
    queryFn: async () => {
      let q = supabase
        .from("coupons")
        .select("*, campaign_master(campaign_name, start_date, end_date)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search) q = q.ilike("coupon_code", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        campaign_id: campaignId,
        coupon_code: couponCode.trim().toUpperCase(),
        max_uses_per_customer: parseInt(maxUsesPerCustomer),
        global_usage_limit: parseInt(globalUsageLimit),
      };
      if (editCoupon) {
        const { error } = await supabase.from("coupons").update(payload).eq("coupon_id", editCoupon.coupon_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editCoupon ? "Coupon updated" : "Coupon created" });
      qc.invalidateQueries({ queryKey: ["coupons"] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("coupons").update({ status: !status }).eq("coupon_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  function openCreate() {
    setEditCoupon(null);
    setCampaignId("");
    setCouponCode("");
    setMaxUsesPerCustomer("-1");
    setGlobalUsageLimit("-1");
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditCoupon(c);
    setCampaignId(c.campaign_id);
    setCouponCode(c.coupon_code);
    setMaxUsesPerCustomer(String(c.max_uses_per_customer));
    setGlobalUsageLimit(String(c.global_usage_limit));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditCoupon(null);
  }

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search coupon codes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Create Coupon</Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Coupon Code</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead className="w-[160px]">Campaign Dates</TableHead>
              <TableHead className="w-[90px] text-center">Per User</TableHead>
              <TableHead className="w-[90px] text-center">Global Limit</TableHead>
              <TableHead className="w-[90px] text-center">Used</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No coupons found.</TableCell></TableRow>
            ) : data.items.map((c: any) => (
              <TableRow key={c.coupon_id}>
                <TableCell className="font-mono font-medium text-sm">{c.coupon_code}</TableCell>
                <TableCell className="text-sm">{c.campaign_master?.campaign_name ?? "—"}</TableCell>
                <TableCell>
                  {c.campaign_master?.start_date ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {format(new Date(c.campaign_master.start_date), "dd MMM yy")}
                        {" → "}
                        {c.campaign_master.end_date ? format(new Date(c.campaign_master.end_date), "dd MMM yy") : "∞"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm">{c.max_uses_per_customer === -1 ? "∞" : c.max_uses_per_customer}</TableCell>
                <TableCell className="text-center text-sm">{c.global_usage_limit === -1 ? "∞" : c.global_usage_limit}</TableCell>
                <TableCell className="text-center text-sm">{c.current_global_uses}</TableCell>
                <TableCell>
                  <Badge variant={c.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: c.coupon_id, status: c.status })}>
                    {c.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
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
            <DialogTitle>{editCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
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
            <div>
              <Label>Coupon Code *</Label>
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="e.g. SUMMER2026" className="font-mono uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Uses / Customer</Label>
                <Input type="number" value={maxUsesPerCustomer} onChange={(e) => setMaxUsesPerCustomer(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">-1 = unlimited</p>
              </div>
              <div>
                <Label>Global Usage Limit</Label>
                <Input type="number" value={globalUsageLimit} onChange={(e) => setGlobalUsageLimit(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">-1 = unlimited</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!campaignId || !couponCode.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editCoupon ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
