import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Upload, Package, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function BulkInwardingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [stockPurpose, setStockPurpose] = useState<"SALES_STOCK" | "SWAP_BUFFER_STOCK">("SALES_STOCK");

  const { data: products } = useQuery({
    queryKey: ["products_physical"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("product_id, product_name, product_category")
        .in("product_category", ["CPE", "SIM", "ADDON"])
        .eq("status", true).order("product_name");
      return data ?? [];
    },
  });

  const { data: recentStock } = useQuery({
    queryKey: ["recent_gpfi_stock"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_master").select("*, products(product_name, product_category)")
        .eq("status", "IN_GPFI_STAGING" as any)
        .order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvErrors(["File must have a header and data rows"]); return; }

    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    const reqCols = ["product_name", "item_type", "serial_number"];
    const missing = reqCols.filter(c => !header.includes(c));
    if (missing.length) { setCsvErrors([`Missing columns: ${missing.join(", ")}`]); return; }

    const productMap = new Map((products ?? []).map(p => [p.product_name.toLowerCase(), p.product_id]));

    const errors: string[] = [];
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const row: any = {};
      header.forEach((h, idx) => row[h] = cols[idx] ?? "");

      const productId = productMap.get(row.product_name?.toLowerCase());
      if (!productId) { errors.push(`Row ${i + 1}: product "${row.product_name}" not found`); continue; }
      if (!["CPE", "SIM", "ADDON"].includes(row.item_type?.toUpperCase())) { errors.push(`Row ${i + 1}: invalid item_type "${row.item_type}"`); continue; }

      rows.push({
        product_id: productId,
        item_type: row.item_type.toUpperCase(),
        serial_number: row.serial_number || null,
        imei: row.imei || null,
        msisdn: row.msisdn || null,
        status: "IN_GPFI_STAGING",
        stock_type: "GPFI_STAGING",
      });
    }
    setCsvErrors(errors);
    setCsvRows(rows);
  };

  const bulkInward = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_master").insert(csvRows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recent_gpfi_stock"] });
      toast({ title: `${csvRows.length} items inwarded to GPFI Staging` });
      setCsvRows([]);
      setCsvErrors([]);
    },
    onError: (e: Error) => toast({ title: "Inwarding failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Bulk Inwarding — GPFI Sales Manager</h1>
        <p className="text-sm text-muted-foreground">Upload physical stock (CPE, SIMs, Add-ons) into GPFI Staging</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In GPFI Staging</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recentStock?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Stock CSV</CardTitle>
          <CardDescription>CSV columns: <code>product_name, item_type (CPE/SIM/ADDON), serial_number, imei, msisdn</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".csv" onChange={handleFileUpload} />
          {csvErrors.length > 0 && (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md space-y-1">
              <div className="flex items-center gap-1 font-medium"><AlertCircle className="h-3.5 w-3.5" /> Errors</div>
              {csvErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          {csvRows.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" /> {csvRows.length} items ready to inward</p>
              <Button onClick={() => bulkInward.mutate()} disabled={bulkInward.isPending}>
                {bulkInward.isPending ? "Inwarding..." : `Inward ${csvRows.length} Items`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Recent GPFI Staging Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>MSISDN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!recentStock?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No stock in GPFI staging.</TableCell></TableRow>
              ) : recentStock.map((item: any) => (
                <TableRow key={item.inventory_id}>
                  <TableCell className="font-medium">{(item as any).products?.product_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{item.item_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{item.serial_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{item.imei ?? "—"}</TableCell>
                  <TableCell className="text-sm">{item.msisdn ?? "—"}</TableCell>
                  <TableCell><Badge variant="default" className="text-xs">{item.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(item.created_at), "dd MMM yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
