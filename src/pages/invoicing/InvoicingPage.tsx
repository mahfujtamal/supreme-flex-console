import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { formatBDT } from "@/lib/currency";

const TRIGGER_TYPES = ["ALL", "ACQUISITION", "CPE_CHANGE", "PHYSICAL_ADDON"] as const;
const PAYMENT_STATUSES = ["ALL", "PENDING", "PAID"] as const;

export default function InvoicingPage() {
  const [filterTrigger, setFilterTrigger] = useState("ALL");
  const [filterPayment, setFilterPayment] = useState("ALL");
  const [selectedLedger, setSelectedLedger] = useState<any>(null);

  // One-time invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["onetime_invoices", filterTrigger, filterPayment],
    queryFn: async () => {
      let query = supabase
        .from("onetime_invoices")
        .select("*, customers(full_name, primary_contact_number)")
        .order("created_at", { ascending: false });
      if (filterTrigger !== "ALL") query = query.eq("trigger_type", filterTrigger as any);
      if (filterPayment !== "ALL") query = query.eq("payment_status", filterPayment as any);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Transaction ledger entries
  const { data: ledgerEntries, isLoading: ledgerLoading } = useQuery({
    queryKey: ["transaction_ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const exportTaxCSV = () => {
    if (!ledgerEntries?.length) return;
    const rows: string[] = ["Date,Product,Customer ID,Component,Original BDT,Discount BDT,Net BDT,Campaign"];
    ledgerEntries.forEach((entry: any) => {
      const dateStr = format(new Date(entry.created_at), "yyyy-MM-dd");
      const priceBreakdown: any[] = Array.isArray(entry.price_breakdown) ? entry.price_breakdown : [];
      const discountBreakdown: any[] = Array.isArray(entry.discount_breakdown) ? entry.discount_breakdown : [];
      priceBreakdown.forEach((pb: any) => {
        const disc = discountBreakdown.find((d: any) => d.component_name === pb.component_name);
        const discAmt = disc ? Number(disc.discount_amount_bdt) : 0;
        const net = Number(pb.amount_bdt) - discAmt;
        rows.push(`${dateStr},"${entry.product_name}",${entry.customer_id},${pb.component_name},${Number(pb.amount_bdt).toFixed(2)},${discAmt.toFixed(2)},${net.toFixed(2)},"${entry.campaign_name || ""}"`);
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax_report_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Invoicing & Financial Reporting
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          One-time invoices with full component breakdown, discount mapping, and tax reporting.
        </p>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">One-Time Invoices</TabsTrigger>
          <TabsTrigger value="ledger">Transaction Ledger</TabsTrigger>
        </TabsList>

        {/* INVOICES TAB */}
        <TabsContent value="invoices">
          <div className="flex items-center gap-3 mb-4">
            <Select value={filterTrigger} onValueChange={setFilterTrigger}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Trigger Type" /></SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => <SelectItem key={t} value={t}>{t === "ALL" ? "All Triggers" : t.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Payment Status" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All Payments" : s}</SelectItem>)}
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
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading invoices...</TableCell></TableRow>
                ) : !invoices?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>
                ) : invoices.map((inv: any) => (
                  <TableRow key={inv.invoice_id}>
                    <TableCell className="font-medium">{inv.customers?.full_name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{inv.customers?.primary_contact_number || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{inv.trigger_type.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="font-medium">{formatBDT(Number(inv.charged_amount_bdt))}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={inv.payment_status === "PAID" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                        {inv.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TRANSACTION LEDGER TAB */}
        <TabsContent value="ledger">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Immutable price snapshots captured at fulfillment. Each entry shows the exact pre-discount breakdown and applied discounts.</p>
            <Button variant="outline" size="sm" onClick={exportTaxCSV} disabled={!ledgerEntries?.length}>
              <Download className="h-4 w-4 mr-1.5" />Export Tax CSV
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Pre-Discount</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Final Payable</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !ledgerEntries?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No ledger entries yet. Entries are created automatically at fulfillment.</TableCell></TableRow>
                ) : ledgerEntries.map((entry: any) => (
                  <TableRow key={entry.ledger_id}>
                    <TableCell className="text-sm">{format(new Date(entry.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="font-medium text-sm">{entry.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{formatBDT(Number(entry.total_pre_discount_bdt))}</TableCell>
                    <TableCell className="font-mono text-sm text-destructive">{Number(entry.total_discount_bdt) > 0 ? `-${formatBDT(Number(entry.total_discount_bdt))}` : "—"}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold">{formatBDT(Number(entry.total_payable_bdt))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.campaign_name || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedLedger(entry)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Ledger Detail Dialog */}
      <Dialog open={!!selectedLedger} onOpenChange={() => setSelectedLedger(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Invoice Breakdown — {selectedLedger?.product_name}</DialogTitle></DialogHeader>
          {selectedLedger && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">Snapshot at {format(new Date(selectedLedger.created_at), "dd MMM yyyy HH:mm")}</div>

              {/* Pre-Discount Breakdown */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pre-Discount Breakdown</h4>
                <div className="space-y-1">
                  {(Array.isArray(selectedLedger.price_breakdown) ? selectedLedger.price_breakdown : []).map((pb: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{pb.component_name}</span>
                      <span className="font-mono">{formatBDT(Number(pb.amount_bdt))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t pt-1">
                    <span>Total</span>
                    <span className="font-mono">{formatBDT(Number(selectedLedger.total_pre_discount_bdt))}</span>
                  </div>
                </div>
              </div>

              {/* Discount per Component */}
              {Number(selectedLedger.total_discount_bdt) > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Discount per Component</h4>
                  <div className="space-y-1">
                    {(Array.isArray(selectedLedger.discount_breakdown) ? selectedLedger.discount_breakdown : []).map((db: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm text-destructive">
                        <span>{db.component_name}</span>
                        <span className="font-mono">-{formatBDT(Number(db.discount_amount_bdt))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold border-t pt-1 text-destructive">
                      <span>Total Discount</span>
                      <span className="font-mono">-{formatBDT(Number(selectedLedger.total_discount_bdt))}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Final Payable */}
              <div className="flex justify-between text-base font-bold border-t pt-3">
                <span>Final Payable</span>
                <span className="font-mono text-primary">{formatBDT(Number(selectedLedger.total_payable_bdt))}</span>
              </div>

              {selectedLedger.campaign_name && (
                <div className="text-xs text-muted-foreground">Campaign: {selectedLedger.campaign_name}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
