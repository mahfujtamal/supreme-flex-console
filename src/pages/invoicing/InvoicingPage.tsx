import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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
import { FileText } from "lucide-react";
import { formatBDT } from "@/lib/currency";

const TRIGGER_TYPES = ["ALL", "ACQUISITION", "CPE_CHANGE", "PHYSICAL_ADDON"] as const;
const PAYMENT_STATUSES = ["ALL", "PENDING", "PAID"] as const;

export default function InvoicingPage() {
  const [filterTrigger, setFilterTrigger] = useState("ALL");
  const [filterPayment, setFilterPayment] = useState("ALL");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["onetime_invoices", filterTrigger, filterPayment],
    queryFn: async () => {
      let query = supabase
        .from("onetime_invoices")
        .select("*, customers(full_name, primary_contact_number)")
        .order("created_at", { ascending: false });

      if (filterTrigger !== "ALL") {
        query = query.eq("trigger_type", filterTrigger as any);
      }
      if (filterPayment !== "ALL") {
        query = query.eq("payment_status", filterPayment as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6" /> One-Time Invoices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hardware and setup fees from acquisitions, CPE changes, and physical add-ons
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterTrigger} onValueChange={setFilterTrigger}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Trigger Type" />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "ALL" ? "All Triggers" : t.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Payment Status" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All Payments" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Primary Contact</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : !invoices?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv: any) => (
                <TableRow key={inv.invoice_id}>
                  <TableCell className="font-medium">
                    {inv.customers?.full_name || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {inv.customers?.primary_contact_number || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {inv.trigger_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatBDT(Number(inv.charged_amount_bdt))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        inv.payment_status === "PAID"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(inv.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
