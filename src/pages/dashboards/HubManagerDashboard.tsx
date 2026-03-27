import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, ArrowRightLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function HubManagerDashboard() {
  const { data: bufferStock } = useQuery({
    queryKey: ["hm_buffer_stock"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_master").select("*, products(product_name, product_category)")
        .eq("status", "WITH_HUB_MANAGER" as any).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const { data: fieldAgents } = useQuery({
    queryKey: ["hm_field_agents"],
    queryFn: async () => {
      const { data } = await supabase.from("field_agents").select("agent_id, agent_name, msisdn, status, hub_manager_id").order("agent_name");
      return data ?? [];
    },
  });

  const { data: kamsList } = useQuery({
    queryKey: ["hm_kams"],
    queryFn: async () => {
      const { data } = await supabase.from("kams").select("kam_id, name, msisdn, status, hub_manager_id").order("name");
      return data ?? [];
    },
  });

  const { data: pendingTransfers } = useQuery({
    queryKey: ["hm_pending_transfers"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transfers").select("*, inventory_master(serial_number, products(product_name))")
        .eq("to_entity_type", "HUB_MANAGER").eq("transfer_status", "PENDING" as any).order("requested_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hub Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground">360° view of regional buffer stock and reporting staff</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Buffer Stock</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{bufferStock?.length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Incoming</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{pendingTransfers?.length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Field Staff</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{(fieldAgents?.length ?? 0) + (kamsList?.length ?? 0)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Swap Buffer Stock</CardTitle>
            <CardDescription>Items available for assignment to field staff</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Serial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!bufferStock?.length ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No buffer stock</TableCell></TableRow>
                ) : bufferStock.slice(0, 10).map((item: any) => (
                  <TableRow key={item.inventory_id}>
                    <TableCell className="font-medium text-sm">{(item as any).products?.product_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{item.item_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{item.serial_number ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reporting Staff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kamsList && kamsList.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">KAMs</h4>
                <div className="space-y-1">
                  {kamsList.map((k: any) => (
                    <div key={k.kam_id} className="flex items-center justify-between text-sm py-1">
                      <span>{k.name} <span className="text-muted-foreground">({k.kam_id})</span></span>
                      <Badge variant={k.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">{k.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {fieldAgents && fieldAgents.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Field Agents</h4>
                <div className="space-y-1">
                  {fieldAgents.map((a: any) => (
                    <div key={a.agent_id} className="flex items-center justify-between text-sm py-1">
                      <span>{a.agent_name} <span className="text-muted-foreground">({a.agent_id})</span></span>
                      <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">{a.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
