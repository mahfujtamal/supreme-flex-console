import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Search, Users } from "lucide-react";
import { Customer360Dialog } from "./Customer360Dialog";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  EXPIRED: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  CHURNED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const STATUSES = ["ALL", "ACTIVE", "EXPIRED", "CHURNED"] as const;

interface CustomerRow {
  customer_id: string;
  full_name: string;
  primary_contact_number: string;
  customer_type: string;
  account_status: string;
  joined_date: string;
  anchor_count: number;
  service_count: number;
}

export default function CustomersPage() {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", filterStatus, search],
    queryFn: async () => {
      const trimmed = search.trim();

      // Find customer IDs matching gpfi_msisdn search
      let gpfiCustomerIds: string[] = [];
      if (trimmed) {
        const { data: serviceMatches } = await supabase
          .from("active_services")
          .select("customer_id")
          .ilike("gpfi_msisdn", `%${trimmed}%`);
        gpfiCustomerIds = (serviceMatches || []).map((s) => s.customer_id);
      }

      let query = supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus !== "ALL") {
        query = query.eq("account_status", filterStatus as any);
      }

      if (trimmed) {
        const orFilters = [
          `full_name.ilike.%${trimmed}%`,
          `primary_contact_number.ilike.%${trimmed}%`,
        ];
        if (gpfiCustomerIds.length > 0) {
          query = query.or(
            `${orFilters.join(",")},customer_id.in.(${gpfiCustomerIds.join(",")})`
          );
        } else {
          query = query.or(orFilters.join(","));
        }
      }

      const { data: rawCustomers, error } = await query;
      if (error) throw error;
      if (!rawCustomers?.length) return [];

      const customerIds = rawCustomers.map((c) => c.customer_id);

      // Fetch anchor counts
      const { data: anchors } = await supabase
        .from("anchors")
        .select("customer_id")
        .in("customer_id", customerIds);

      // Fetch active service counts
      const { data: services } = await supabase
        .from("active_services")
        .select("customer_id")
        .in("customer_id", customerIds);

      const anchorCounts: Record<string, number> = {};
      (anchors || []).forEach((a) => {
        anchorCounts[a.customer_id] = (anchorCounts[a.customer_id] || 0) + 1;
      });

      const serviceCounts: Record<string, number> = {};
      (services || []).forEach((s) => {
        serviceCounts[s.customer_id] = (serviceCounts[s.customer_id] || 0) + 1;
      });

      return rawCustomers.map((c): CustomerRow => ({
        ...c,
        anchor_count: anchorCounts[c.customer_id] || 0,
        service_count: serviceCounts[c.customer_id] || 0,
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" /> Customer 360
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View customer lifecycle: anchors, active services, and network info
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact number, or GPFI MSISDN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All Statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Primary Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Total Anchors</TableHead>
              <TableHead className="text-center">Active Services</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading customers...
                </TableCell>
              </TableRow>
            ) : !customers?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.customer_id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell className="font-mono text-sm">{c.primary_contact_number}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[c.account_status] || ""} variant="secondary">
                      {c.account_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">{c.anchor_count}</TableCell>
                  <TableCell className="text-center font-medium">{c.service_count}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedCustomerId(c.customer_id)}
                    >
                      <Eye className="h-4 w-4 mr-1" /> View 360
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Customer360Dialog
        customerId={selectedCustomerId}
        open={!!selectedCustomerId}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomerId(null);
        }}
      />
    </div>
  );
}
