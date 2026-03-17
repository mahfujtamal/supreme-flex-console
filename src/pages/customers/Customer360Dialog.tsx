import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { User, Wifi, Package, FileText } from "lucide-react";
import { formatBDT } from "@/lib/currency";

interface Customer360DialogProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function calculateExpiryDate(activationDate: string, validityDays: number, productCategory: string): Date {
  const activation = new Date(activationDate);
  const extraDays = productCategory === "WIFI_PLAN" ? validityDays + 1 : validityDays;
  return addDays(activation, extraDays);
}

export function Customer360Dialog({ customerId, open, onOpenChange }: Customer360DialogProps) {
  const { data: customer } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("customer_id", customerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: services } = useQuery({
    queryKey: ["active_services", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("active_services")
        .select("*")
        .eq("customer_id", customerId)
        .order("activation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: invoices } = useQuery({
    queryKey: ["customer_invoices", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("onetime_invoices")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    EXPIRED: "bg-amber-100 text-amber-800",
    CHURNED: "bg-red-100 text-red-800",
    SUSPENDED: "bg-orange-100 text-orange-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Customer 360
          </DialogTitle>
        </DialogHeader>

        {customer && (
          <div className="space-y-6">
            {/* Profile Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" /> Profile Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="font-medium">{customer.full_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">MSISDN</p>
                    <p className="font-mono font-medium">{customer.contact_msisdn}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Customer Type</p>
                    <Badge variant="outline">{customer.customer_type}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account Status</p>
                    <Badge className={statusColor[customer.account_status] || ""} variant="secondary">
                      {customer.account_status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joined Date</p>
                    <p className="font-medium">{format(new Date(customer.joined_date), "dd MMM yyyy")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Active Services */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4" /> Active Services
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan ID</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Activation</TableHead>
                      <TableHead>Expiry (Calc.)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!services?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                          No active services
                        </TableCell>
                      </TableRow>
                    ) : (
                      services.map((s) => {
                        const calcExpiry = calculateExpiryDate(
                          s.activation_date,
                          s.validity_days,
                          s.product_category
                        );
                        return (
                          <TableRow key={s.service_id}>
                            <TableCell className="font-mono text-sm">{s.product_id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {s.product_category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(s.activation_date), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(calcExpiry, "dd MMM yyyy")}
                              {s.product_category === "WIFI_PLAN" && (
                                <span className="text-xs text-muted-foreground ml-1">(+1d)</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={statusColor[s.service_status] || ""}
                                variant="secondary"
                              >
                                {s.service_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Separator />

            {/* Hardware History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> Hardware History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!invoices?.filter(
                      (i) => i.trigger_type === "ACQUISITION" || i.trigger_type === "CPE_CHANGE"
                    ).length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          No hardware history
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices
                        .filter(
                          (i) => i.trigger_type === "ACQUISITION" || i.trigger_type === "CPE_CHANGE"
                        )
                        .map((inv) => (
                          <TableRow key={inv.invoice_id}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {inv.trigger_type}
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
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
