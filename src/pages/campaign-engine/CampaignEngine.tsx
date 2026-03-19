import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Pencil, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import CampaignFormDialog from "./CampaignFormDialog";
import ManageCampaignDialog from "./ManageCampaignDialog";
import CouponManagementTab from "./CouponManagementTab";
import ReferralProgramsTab from "./ReferralProgramsTab";

const PAGE_SIZE = 10;

function CampaignDashboard() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<any>(null);
  const [manageCampaignId, setManageCampaignId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", page, search],
    queryFn: async () => {
      let q = supabase.from("campaign_master").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (search) q = q.ilike("campaign_name", `%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase.from("campaign_master").update({ status: !status }).eq("campaign_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaigns..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" />New Campaign</Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign Name</TableHead>
              <TableHead className="w-[80px]">Scope</TableHead>
              <TableHead className="w-[120px]">Trigger Type</TableHead>
              <TableHead className="w-[60px]">Rank</TableHead>
              <TableHead className="w-[100px]">Start Date</TableHead>
              <TableHead className="w-[100px]">End Date</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : !data?.items?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No campaigns found.</TableCell></TableRow>
            ) : data.items.map((c: any) => (
              <TableRow key={c.campaign_id}>
                <TableCell className="font-medium">{c.campaign_name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.scope}</Badge></TableCell>
                <TableCell className="text-xs">{c.campaign_trigger_type.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(c.start_date), "dd MMM yyyy")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.end_date ? format(new Date(c.end_date), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: c.campaign_id, status: c.status })}>
                    {c.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditCampaign(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setManageCampaignId(c.campaign_id)}><Settings2 className="h-3.5 w-3.5" /></Button>
                  </div>
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

      <CampaignFormDialog
        open={createOpen || !!editCampaign}
        campaign={editCampaign}
        onClose={() => { setCreateOpen(false); setEditCampaign(null); }}
      />

      {manageCampaignId && (
        <ManageCampaignDialog
          campaignId={manageCampaignId}
          campaignScope={data?.items?.find((c: any) => c.campaign_id === manageCampaignId)?.scope ?? "BOTH"}
          onClose={() => setManageCampaignId(null)}
        />
      )}
    </div>
  );
}

export default function CampaignEngine() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Campaign Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">Create and manage promotional campaigns, coupons, and referral programs.</p>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="coupons">Coupon Management</TabsTrigger>
          <TabsTrigger value="referrals">Referral Programs</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns"><CampaignDashboard /></TabsContent>
        <TabsContent value="coupons"><CouponManagementTab /></TabsContent>
        <TabsContent value="referrals"><ReferralProgramsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
