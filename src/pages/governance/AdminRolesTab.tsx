import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_PERMISSIONS = [
  { key: "can_edit_pricing", label: "Edit Pricing" },
  { key: "can_approve_campaigns", label: "Approve Campaigns" },
  { key: "can_manage_inventory", label: "Manage Inventory" },
  { key: "can_manage_orders", label: "Manage Orders" },
  { key: "can_manage_users", label: "Manage Users" },
  { key: "can_view_logs", label: "View Logs" },
];

const PAGE_SIZE = 10;

export default function AdminRolesTab() {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_PERMISSIONS.map((p) => [p.key, false]))
  );
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin_roles", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("admin_roles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { roles: data, count: count ?? 0 };
    },
  });

  const createRole = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("admin_roles")
        .insert({ role_name: roleName, permissions });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_roles"] });
      setOpen(false);
      setRoleName("");
      setPermissions(Object.fromEntries(DEFAULT_PERMISSIONS.map((p) => [p.key, false])));
      toast({ title: "Role created", description: `"${roleName}" added.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Define roles with granular permissions</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Create Role
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Role Name</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="w-[160px]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">Loading...</TableCell>
              </TableRow>
            ) : !data?.roles?.length ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No roles found.</TableCell>
              </TableRow>
            ) : (
              data.roles.map((role) => {
                const perms = (role.permissions as Record<string, boolean>) || {};
                const granted = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
                return (
                  <TableRow key={role.role_id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">{role.role_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {granted.length ? granted.map((k) => (
                          <Badge key={k} variant="outline" className="text-xs font-normal">
                            {k.replace(/^can_/, "").replace(/_/g, " ")}
                          </Badge>
                        )) : (
                          <span className="text-xs text-muted-foreground">No permissions</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(role.created_at), "dd MMM yy, HH:mm")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Admin Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. MARKETING_MANAGER" />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-3 rounded-md border p-3">
                {DEFAULT_PERMISSIONS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between">
                    <span className="text-sm">{p.label}</span>
                    <Switch
                      checked={permissions[p.key]}
                      onCheckedChange={(v) => setPermissions((prev) => ({ ...prev, [p.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createRole.mutate()} disabled={!roleName.trim() || createRole.isPending}>
              {createRole.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
