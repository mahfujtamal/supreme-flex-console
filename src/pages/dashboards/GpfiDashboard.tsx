import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function GpfiDashboard() {
  const { data: stockCounts } = useQuery({
    queryKey: ["gpfi_stock_counts"],
    queryFn: async () => {
      const [staging, hubManager, fieldStaff, delivered] = await Promise.all([
        supabase.from("inventory_master").select("inventory_id", { count: "exact", head: true }).eq("status", "IN_GPFI_STAGING" as any),
        supabase.from("inventory_master").select("inventory_id", { count: "exact", head: true }).eq("status", "WITH_HUB_MANAGER" as any),
        supabase.from("inventory_master").select("inventory_id", { count: "exact", head: true }).eq("status", "WITH_FIELD_STAFF" as any),
        supabase.from("inventory_master").select("inventory_id", { count: "exact", head: true }).eq("status", "DELIVERED"),
      ]);
      return {
        staging: staging.count ?? 0,
        hubManager: hubManager.count ?? 0,
        fieldStaff: fieldStaff.count ?? 0,
        delivered: delivered.count ?? 0,
      };
    },
  });

  const { data: channels } = useQuery({
    queryKey: ["gpfi_channels_overview"],
    queryFn: async () => {
      const { data } = await supabase.from("channels").select("channel_id, channel_name, status").order("channel_name");
      return data ?? [];
    },
  });

  const { data: hubManagers } = useQuery({
    queryKey: ["gpfi_hub_managers_overview"],
    queryFn: async () => {
      const { data } = await supabase.from("hub_managers").select("*, channels(channel_name), sub_channels(sub_channel_name)").eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  const { data: pendingTransfers } = useQuery({
    queryKey: ["gpfi_pending_count"],
    queryFn: async () => {
      const { count } = await supabase.from("stock_transfers").select("transfer_id", { count: "exact", head: true }).eq("transfer_status", "PENDING" as any);
      return count ?? 0;
    },
  });

  const stats = [
    { label: "GPFI Staging", value: stockCounts?.staging ?? 0, icon: Package, color: "text-blue-500" },
    { label: "With Hub Managers", value: stockCounts?.hubManager ?? 0, icon: Users, color: "text-amber-500" },
    { label: "With Field Staff", value: stockCounts?.fieldStaff ?? 0, icon: Users, color: "text-green-500" },
    { label: "Pending Handshakes", value: pendingTransfers ?? 0, icon: ArrowRightLeft, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">GPFI Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground">Global view of all channels, stock custody, and transfers</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Channels Overview</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels?.map((c: any) => (
                  <TableRow key={c.channel_id}>
                    <TableCell className="font-medium">{c.channel_name}</TableCell>
                    <TableCell><Badge variant={c.status ? "default" : "secondary"}>{c.status ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Active Hub Managers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Assignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hubManagers?.length ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">No hub managers</TableCell></TableRow>
                ) : hubManagers.map((hm: any) => (
                  <TableRow key={hm.hub_manager_id}>
                    <TableCell className="font-medium">{hm.name}</TableCell>
                    <TableCell className="text-sm">{hm.channels?.channel_name ?? hm.sub_channels?.sub_channel_name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
