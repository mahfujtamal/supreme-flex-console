import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isBefore } from "date-fns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Wifi, MapPin, Anchor, CheckCircle, XCircle, Clock, HardDrive, ShieldCheck, ShieldX } from "lucide-react";

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

const testStatusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  SUCCESS: { icon: CheckCircle, color: "text-green-600", label: "Success" },
  FAIL: { icon: XCircle, color: "text-red-600", label: "Failed" },
  PENDING: { icon: Clock, color: "text-amber-600", label: "Pending" },
};

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

  const { data: anchors } = useQuery({
    queryKey: ["customer_anchors", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("anchors")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
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

  const { data: assets } = useQuery({
    queryKey: ["customer_assets", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("customer_assets")
        .select("*, products(product_name, warranty_value, warranty_unit)")
        .eq("customer_id", customerId)
        .order("installation_date", { ascending: false });
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
    REPLACED: "bg-slate-100 text-slate-800",
    RETURNED: "bg-blue-100 text-blue-800",
    DEFECTIVE: "bg-red-100 text-red-800",
  };

  const servicesByAnchor: Record<string, typeof services extends (infer T)[] | undefined ? T[] : never> = {};
  (services || []).forEach((s) => {
    if (s.anchor_id) {
      if (!servicesByAnchor[s.anchor_id]) servicesByAnchor[s.anchor_id] = [];
      servicesByAnchor[s.anchor_id].push(s);
    }
  });

  const assetsByAnchor: Record<string, any[]> = {};
  (assets || []).forEach((a: any) => {
    if (a.anchor_id) {
      if (!assetsByAnchor[a.anchor_id]) assetsByAnchor[a.anchor_id] = [];
      assetsByAnchor[a.anchor_id].push(a);
    }
  });

  const now = new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Customer 360 — Lifecycle View
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="font-medium">{customer.full_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Primary Contact</p>
                    <p className="font-mono font-medium">{customer.primary_contact_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <Badge variant="outline">{customer.customer_type}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account Status</p>
                    <Badge className={statusColor[customer.account_status] || ""} variant="secondary">
                      {customer.account_status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="anchors" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="anchors" className="flex items-center gap-1">
                  <Anchor className="h-3.5 w-3.5" /> Anchors/Orders
                </TabsTrigger>
                <TabsTrigger value="services" className="flex items-center gap-1">
                  <Wifi className="h-3.5 w-3.5" /> Service Details
                </TabsTrigger>
                <TabsTrigger value="assets" className="flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" /> Physical Assets
                </TabsTrigger>
                <TabsTrigger value="network" className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Network Info
                </TabsTrigger>
              </TabsList>

              {/* Tab A: All Anchors/Orders */}
              <TabsContent value="anchors" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anchor ID</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Test Status</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Assets</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!anchors?.length ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                              No anchors found
                            </TableCell>
                          </TableRow>
                        ) : (
                          anchors.map((a) => {
                            const cfg = testStatusConfig[a.test_status] || testStatusConfig.PENDING;
                            const Icon = cfg.icon;
                            const hasService = (servicesByAnchor[a.anchor_id]?.length || 0) > 0;
                            const assetCount = assetsByAnchor[a.anchor_id]?.length || 0;
                            return (
                              <TableRow key={a.anchor_id}>
                                <TableCell className="font-mono text-xs">
                                  {a.anchor_id.slice(0, 8)}…
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {a.order_id ? `${a.order_id.slice(0, 8)}…` : "—"}
                                </TableCell>
                                <TableCell>
                                  <span className={`flex items-center gap-1 text-sm ${cfg.color}`}>
                                    <Icon className="h-4 w-4" /> {cfg.label}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {a.test_status === "SUCCESS" && hasService ? (
                                    <Badge className="bg-green-100 text-green-800" variant="secondary">
                                      View Service
                                    </Badge>
                                  ) : a.test_status === "SUCCESS" ? (
                                    <span className="text-xs text-muted-foreground">Awaiting activation</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {assetCount > 0 ? (
                                    <Badge variant="outline">{assetCount} asset{assetCount > 1 ? "s" : ""}</Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(a.created_at), "dd MMM yyyy")}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab B: Service Details */}
              <TabsContent value="services" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>GPFI MSISDN</TableHead>
                          <TableHead>Plan ID</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Activation</TableHead>
                          <TableHead>Expiry (Calc.)</TableHead>
                          <TableHead>CPE Model</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!services?.length ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
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
                                <TableCell className="font-mono text-sm font-medium">
                                  {s.gpfi_msisdn || "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{s.product_id}</TableCell>
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
                                <TableCell className="text-sm">
                                  {s.cpe_model || "—"}
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
              </TabsContent>

              {/* Tab C: Physical Assets */}
              <TabsContent value="assets" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Serial Number</TableHead>
                          <TableHead>MAC Address</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Installation</TableHead>
                          <TableHead>Warranty Status</TableHead>
                          <TableHead>Asset Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!assets?.length ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                              No physical assets found
                            </TableCell>
                          </TableRow>
                        ) : (
                          assets.map((a: any) => {
                            const warrantyEnd = a.warranty_end_date ? new Date(a.warranty_end_date) : null;
                            const inWarranty = warrantyEnd ? isBefore(now, warrantyEnd) : false;
                            return (
                              <TableRow key={a.asset_id}>
                                <TableCell className="font-mono text-sm font-medium">{a.serial_number}</TableCell>
                                <TableCell className="font-mono text-xs">{a.mac_address || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{a.asset_type}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">{a.products?.product_name || "—"}</TableCell>
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
                                <TableCell>
                                  <Badge className={statusColor[a.asset_status] || ""} variant="secondary">
                                    {a.asset_status}
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
              </TabsContent>

              {/* Tab D: Network Info */}
              <TabsContent value="network" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anchor ID</TableHead>
                          <TableHead>Network Zone</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead>Area</TableHead>
                          <TableHead>Location TAC</TableHead>
                          <TableHead>Coordinates</TableHead>
                          <TableHead>Test Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!anchors?.length ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                              No network info available
                            </TableCell>
                          </TableRow>
                        ) : (
                          anchors.map((a) => {
                            const cfg = testStatusConfig[a.test_status] || testStatusConfig.PENDING;
                            const Icon = cfg.icon;
                            return (
                              <TableRow key={a.anchor_id}>
                                <TableCell className="font-mono text-xs">
                                  {a.anchor_id.slice(0, 8)}…
                                </TableCell>
                                <TableCell>{a.network_zone || "—"}</TableCell>
                                <TableCell>{a.district || "—"}</TableCell>
                                <TableCell>{a.area || "—"}</TableCell>
                                <TableCell className="font-mono text-sm">{a.location_tac || "—"}</TableCell>
                                <TableCell className="font-mono text-xs">{a.coordinates || "—"}</TableCell>
                                <TableCell>
                                  <span className={`flex items-center gap-1 text-sm ${cfg.color}`}>
                                    <Icon className="h-4 w-4" /> {cfg.label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
