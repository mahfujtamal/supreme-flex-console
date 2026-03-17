import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isBefore } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HardDrive, Search, ShieldCheck, ShieldX } from "lucide-react";

const ASSET_TYPES = ["ALL", "CPE", "SIM", "PHYSICAL_ADDON"] as const;
const ASSET_STATUSES = ["ALL", "ACTIVE", "REPLACED", "RETURNED", "DEFECTIVE"] as const;

export default function AssetLifecyclePage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const { data: assets, isLoading } = useQuery({
    queryKey: ["all_customer_assets", search, filterType, filterStatus],
    queryFn: async () => {
      // If searching by gpfi_msisdn or customer mobile, find matching customer_ids first
      let customerIds: string[] | null = null;
      if (search.trim()) {
        // Search active_services for gpfi_msisdn match
        const { data: svcMatches } = await supabase
          .from("active_services")
          .select("customer_id")
          .ilike("gpfi_msisdn", `%${search.trim()}%`);

        // Search customers for mobile match
        const { data: custMatches } = await supabase
          .from("customers")
          .select("customer_id")
          .ilike("primary_contact_number", `%${search.trim()}%`);

        const ids = new Set<string>();
        svcMatches?.forEach((s) => ids.add(s.customer_id));
        custMatches?.forEach((c) => ids.add(c.customer_id));
        customerIds = [...ids];
      }

      let query = supabase
        .from("customer_assets")
        .select("*, products(product_name), customers(full_name, primary_contact_number), anchors!inner(anchor_id)")
        .order("installation_date", { ascending: false });

      if (search.trim()) {
        if (customerIds && customerIds.length > 0) {
          query = query.or(
            `serial_number.ilike.%${search.trim()}%,customer_id.in.(${customerIds.join(",")})`
          );
        } else {
          query = query.ilike("serial_number", `%${search.trim()}%`);
        }
      }

      if (filterType !== "ALL") {
        query = query.eq("asset_type", filterType as any);
      }
      if (filterStatus !== "ALL") {
        query = query.eq("asset_status", filterStatus as any);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch gpfi_msisdn for each anchor
      const anchorIds = [...new Set((data || []).map((a: any) => a.anchor_id).filter(Boolean))];
      let gpfiMap: Record<string, string> = {};
      if (anchorIds.length > 0) {
        const { data: svcData } = await supabase
          .from("active_services")
          .select("anchor_id, gpfi_msisdn")
          .in("anchor_id", anchorIds);
        (svcData || []).forEach((s) => {
          if (s.anchor_id && s.gpfi_msisdn) gpfiMap[s.anchor_id] = s.gpfi_msisdn;
        });
      }

      return (data || []).map((a: any) => ({ ...a, _gpfi_msisdn: gpfiMap[a.anchor_id] || null }));
    },
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardDrive className="h-6 w-6" /> Asset Lifecycle
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track all customer hardware assets, warranty status, and replacement history.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Serial Number, GPFI MSISDN, or Customer Mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-[160px]">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Asset Type" />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "ALL" ? "All Types" : t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[160px]">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {ASSET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All Statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead>MAC Address</TableHead>
              <TableHead>Asset Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Anchor ID</TableHead>
              <TableHead>Installation</TableHead>
              <TableHead>Warranty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading assets…
                </TableCell>
              </TableRow>
            ) : !assets?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No assets found
                </TableCell>
              </TableRow>
            ) : (
              assets.map((a: any) => {
                const warrantyEnd = a.warranty_end_date ? new Date(a.warranty_end_date) : null;
                const inWarranty = warrantyEnd ? isBefore(now, warrantyEnd) : false;
                return (
                  <TableRow key={a.asset_id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {a.serial_number}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.mac_address || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {a.asset_type?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{a.customers?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {a.customers?.primary_contact_number || ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          a.asset_status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : a.asset_status === "REPLACED"
                            ? "bg-slate-100 text-slate-800"
                            : a.asset_status === "DEFECTIVE"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }
                        variant="secondary"
                      >
                        {a.asset_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.anchor_id?.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(a.installation_date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {warrantyEnd ? (
                        inWarranty ? (
                          <Badge className="bg-green-100 text-green-800" variant="secondary">
                            <ShieldCheck className="h-3 w-3 mr-1" /> IN WARRANTY
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800" variant="secondary">
                            <ShieldX className="h-3 w-3 mr-1" /> EXPIRED
                          </Badge>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
