import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, Package, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

const ITEM_TYPES = ["CPE", "SIM", "ADDON"] as const;
const STATUSES = ["IN_WAREHOUSE", "ALLOCATED_TO_DH", "ALLOCATED_TO_KAM", "WITH_AGENT", "DELIVERED", "DEFECTIVE"] as const;

const statusColors: Record<string, string> = {
  IN_WAREHOUSE: "bg-blue-100 text-blue-800",
  ALLOCATED_TO_DH: "bg-amber-100 text-amber-800",
  ALLOCATED_TO_KAM: "bg-orange-100 text-orange-800",
  WITH_AGENT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  DEFECTIVE: "bg-red-100 text-red-800",
};

const InventoryTab = () => {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [showImport, setShowImport] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["inventory_master", filterStatus, filterType],
    queryFn: async () => {
      let query = supabase.from("inventory_master").select("*, products(product_name)").order("created_at", { ascending: false });
      if (filterStatus !== "ALL") query = query.eq("status", filterStatus as any);
      if (filterType !== "ALL") query = query.eq("item_type", filterType as any);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from("inventory_master").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_master"] });
      toast.success("Bulk import successful!");
      setShowImport(false);
      setCsvData([]);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

        const requiredCols = ["product_id", "item_type"];
        const missing = requiredCols.filter((c) => !headers.includes(c));
        if (missing.length) {
          setCsvError(`Missing required columns: ${missing.join(", ")}`);
          return;
        }

        const rows = lines.slice(1).map((line) => {
          const vals = line.split(",").map((v) => v.trim());
          const row: any = {};
          headers.forEach((h, i) => {
            const val = vals[i];
            if (val && val !== "") row[h] = val;
          });
          return row;
        }).filter((r) => r.product_id && r.item_type);

        setCsvData(rows);
      } catch {
        setCsvError("Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Item Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowImport(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Bulk Import CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Serial #</TableHead>
              <TableHead>MAC Address</TableHead>
              <TableHead>MSISDN</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Allocated Entity</TableHead>
              <TableHead>Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !inventory?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />No inventory items found
              </TableCell></TableRow>
            ) : inventory.map((item: any) => (
              <TableRow key={item.inventory_id}>
                <TableCell className="font-medium">{(item as any).products?.product_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{item.item_type}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{item.serial_number ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{item.mac_address ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{item.msisdn ?? "—"}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status] ?? ""}`}>
                    {item.status.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell>{item.allocated_entity_id ?? "—"}</TableCell>
                <TableCell>{item.allocated_agent_id ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Import Modal */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Inventory (CSV)</DialogTitle>
            <DialogDescription>
              Upload a CSV with columns: product_id, item_type, serial_number, mac_address, msisdn, status, allocated_entity_id
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".csv" onChange={handleFileUpload} />
            {csvError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Parse Error</AlertTitle>
                <AlertDescription>{csvError}</AlertDescription>
              </Alert>
            )}
            {csvData.length > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Ready to Import</AlertTitle>
                <AlertDescription>{csvData.length} rows parsed successfully.</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => bulkInsertMutation.mutate(csvData)}
              disabled={!csvData.length || bulkInsertMutation.isPending}
              className="w-full"
            >
              {bulkInsertMutation.isPending ? "Importing…" : `Import ${csvData.length} Rows`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryTab;
