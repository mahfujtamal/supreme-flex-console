import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { formatBDT } from "@/lib/currency";

const RULE_TYPES = ["EXCLUSIVE", "UNAVAILABLE", "DISCOUNT"] as const;
const DISCOUNT_TYPES = ["FLAT", "PERCENT"] as const;

export default function ProductRulesTab({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [ruleType, setRuleType] = useState<string>("EXCLUSIVE");
  const [discountType, setDiscountType] = useState<string>("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products_lookup_with_exclusive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("product_id, product_name, product_category, is_exclusive")
        .eq("status", true)
        .order("product_name");
      return data ?? [];
    },
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["product_rules", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_product_rules")
        .select("*, products(product_name, product_category)")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  // Filter products based on selected rule type
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (ruleType === "EXCLUSIVE") {
      return products.filter(p => p.is_exclusive === true);
    }
    // UNAVAILABLE / DISCOUNT → standard products only
    return products.filter(p => p.is_exclusive === false);
  }, [products, ruleType]);

  const noExclusiveProducts = ruleType === "EXCLUSIVE" && filteredProducts.length === 0 && products && products.length > 0;

  const addRule = useMutation({
    mutationFn: async () => {
      // DB validation: verify product exclusivity matches rule type
      const { data: product, error: pErr } = await supabase
        .from("products")
        .select("is_exclusive")
        .eq("product_id", productId)
        .single();
      if (pErr) throw pErr;

      if (ruleType === "EXCLUSIVE" && !product.is_exclusive) {
        throw new Error("Selected product is not marked as Exclusive in Product Master.");
      }
      if (ruleType !== "EXCLUSIVE" && product.is_exclusive) {
        throw new Error("Exclusive products cannot be used with standard rule types.");
      }

      const payload: any = {
        campaign_id: campaignId,
        product_id: productId,
        rule_type: ruleType as any,
      };
      if (ruleType === "DISCOUNT") {
        payload.discount_type = discountType as any;
        payload.discount_value = parseFloat(discountValue);
      }
      const { error } = await supabase.from("campaign_product_rules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_rules", campaignId] }); closeDialog(); toast({ title: "Product rule added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("campaign_product_rules").delete().eq("rule_id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product_rules", campaignId] }); toast({ title: "Rule removed" }); },
  });

  const closeDialog = () => { setOpen(false); setProductId(""); setRuleType("EXCLUSIVE"); setDiscountType("FLAT"); setDiscountValue(""); };

  // Reset product selection when rule type changes (since the list changes)
  const handleRuleTypeChange = (val: string) => {
    setRuleType(val);
    setProductId("");
  };

  const canSave = productId && ruleType && (ruleType !== "DISCOUNT" || (discountValue && parseFloat(discountValue) > 0));

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Product Rule</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Rule Type</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
            ) : !rules?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No product rules yet.</TableCell></TableRow>
            ) : rules.map((r: any) => (
              <TableRow key={r.rule_id}>
                <TableCell className="font-medium text-sm">{r.products?.product_name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{r.products?.product_category}</Badge></TableCell>
                <TableCell>
                  <Badge variant={r.rule_type === "DISCOUNT" ? "default" : r.rule_type === "UNAVAILABLE" ? "destructive" : "secondary"} className="text-xs">
                    {r.rule_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {r.rule_type === "DISCOUNT"
                    ? r.discount_type === "PERCENT"
                      ? `${r.discount_value}%`
                      : formatBDT(r.discount_value)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule.mutate(r.rule_id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Product Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select value={ruleType} onValueChange={handleRuleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {noExclusiveProducts && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No Exclusive products found. Please mark a product as Exclusive in the Product Master first.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Product {ruleType === "EXCLUSIVE" ? "(Exclusive only)" : "(Standard only)"}</Label>
              <Select value={productId} onValueChange={setProductId} disabled={noExclusiveProducts}>
                <SelectTrigger><SelectValue placeholder={noExclusiveProducts ? "No eligible products" : "Select product"} /></SelectTrigger>
                <SelectContent>
                  {filteredProducts.map(p => <SelectItem key={p.product_id} value={p.product_id}>{p.product_name} ({p.product_category})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {ruleType === "DISCOUNT" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value</Label>
                  <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "PERCENT" ? "e.g. 10" : "e.g. 500"} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => addRule.mutate()} disabled={!canSave || addRule.isPending}>{addRule.isPending ? "Adding..." : "Add Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
